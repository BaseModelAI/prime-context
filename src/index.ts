import { existsSync, writeFileSync } from "node:fs";
import { open as openFile, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { adaptiveMinTextBytes, utf8Bytes } from "./capsule.js";
import {
  isBashToolResult,
  isEditToolResult,
  isIpythonToolResult,
  SessionManager,
  type BeforeAgentStartEvent,
  type ExtensionAPI,
  type ExtensionContext,
  type ToolResultEvent,
} from "@earendil-works/pi-coding-agent";
import type { ImageContent, TextContent } from "@earendil-works/pi-ai";
import {
  ObservationArchive,
  RECOVERY_IMAGE_MAX_BYTES,
  imageDimensions,
  imageRefsForEnvelope,
  normalizeObservationRef,
  resolveArchiveText,
  type CompletedExchangeArchive,
  type ObservationPartInput,
  type RecallArchiveSource,
  type RecallScope,
  type ResolvedArchiveText,
} from "./archive.js";
import { sourceBytes, summarizePartSource, type StreamPartSource } from "./envelope.js";
import { registerPrimeContextCommands, type LearnCommandRequest } from "./commands.js";
import {
  beginAuxiliaryTask,
  beginAuxiliaryTurn,
  buildSemanticDistillPrompt,
  buildStallRecoveryPrompt,
  buildTaskScoutPrompt,
  createAuxiliaryRuntime,
  createModelResolutionHooks,
  executeAuxiliaryOnce,
  finalizeAuxiliaryTask,
  parseSemanticCapsuleOutput,
  parseStallRecoveryOutput,
  parseTaskScoutOutput,
  renderSemanticCapsule,
  renderStallRecoveryHint,
  renderTaskScoutSupplement,
  resolveAuxiliaryModel,
  type AuxiliaryKind,
  type AuxiliaryRuntime,
  type CompactTaskPacket,
} from "./auxiliary.js";
import { runKnowledgeCompiler, type KnowledgeCompilerCall, type TaskOutcome } from "./learn.js";
import { completeSimple } from "@earendil-works/pi-ai";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import {
  buildExchangeFacts,
  boundedResultTextStats,
  ExchangeTracker,
  type ExchangeFacts,
  type PendingExchange,
} from "./exchange.js";
import { adaptToolIntent, collectFactualOutcome, jsonBytes } from "./intent.js";
import {
  buildProviderRepresentation,
  fixedExchangeBudgetBytes,
  projectBranchCandidateMessages,
  projectModelContext,
  type ContextEntryRef,
  type ContextPurpose,
  type FixedExchangeView,
  type ProjectionCandidateEntry,
  type ProjectedImageRef,
  type ProviderProjectionCache,
} from "./projection.js";
import {
  deriveTaskSelection,
  explicitSteeringPaths,
  type ActiveGoalSelection,
  type TaskSelection,
} from "./runtime.js";
import {
  EXACT_REPEAT_HINT,
  applyProgressEffects,
  createExactRepeatHintState,
  detectStallSignature,
  hasStrongExactRepeat,
  observeExactRepeatHint,
  resetExactRepeatHintState,
  type ExactRepeatHintState,
} from "./workflow.js";
import {
  persistentControlMessage,
  renderPrimeContextAnchor,
  renderPrimeContextTask,
  renderPrimeContextUpdate,
  type ContextMessageLike,
  type RenderedTaskAnchor,
  type TaskAnchorInput,
} from "./context.js";
import {
  DEFAULT_CONFIG,
  PRIME_CONTEXT_ANCHOR_TYPE,
  PRIME_CONTEXT_UPDATE_TYPE,
  SNAPSHOT_ENTRY_TYPE,
  applySnapshotChanges,
  createTaskSnapshotV2,
  latestProviderVisibleControlMessage,
  loadLatestTaskSnapshotV2,
  loadPrimeContextConfig,
  providerVisibleBranchEntries,
  storageRoot,
  type BranchEntryLike,
  type PrimeContextMode,
  type ResolvedPrimeContextConfig,
  type SnapshotChanges,
  type SnapshotUpdateResult,
  type TaskSnapshotV2,
} from "./state.js";
import { appendPrimeContextGlobalPolicy } from "./policy.js";
import { registerPrimeContextTool, type PrimeContextActions } from "./tool.js";
import {
  loadSkillLibrary,
  renderSelectedSkillsPacket,
  resolveSkillLibraryPath,
  selectSkills,
  validateSelectedSkillNames,
  type SkillLibrarySnapshot,
} from "./skills.js";

interface UserBashEndPayload {
  entryId: string;
  command: string;
  output: string;
  isError: boolean;
  exitCode?: number | null;
  cancelled?: boolean;
  truncated?: boolean;
  fullOutputPath?: string;
  details?: unknown;
}

interface RecallSessionHeader {
  id: string;
  timestamp: string;
  cwd: string;
  parentSession?: string;
  rlmDepth?: number;
}

async function readBoundedTextFile(path: string, maxBytes = 48 * 1024): Promise<string | undefined> {
  let handle;
  try {
    handle = await openFile(path, "r");
    const size = (await handle.stat()).size;
    if (size <= maxBytes) return (await handle.readFile()).toString("utf8");
    const edgeBytes = Math.floor(maxBytes / 2);
    const head = Buffer.alloc(edgeBytes);
    const tail = Buffer.alloc(edgeBytes);
    const [{ bytesRead: headBytes }, { bytesRead: tailBytes }] = await Promise.all([
      handle.read(head, 0, edgeBytes, 0),
      handle.read(tail, 0, edgeBytes, Math.max(0, size - edgeBytes)),
    ]);
    return `${head.toString("utf8", 0, headBytes)}
…
${tail.toString("utf8", 0, tailBytes)}`;
  } catch {
    return undefined;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function readRecallSessionHeader(path: string): Promise<RecallSessionHeader | undefined> {
  let handle;
  try {
    handle = await openFile(path, "r");
    const buffer = Buffer.alloc(64 * 1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const newline = buffer.indexOf(0x0a, 0);
    if (bytesRead === 0 || newline < 0 || newline > bytesRead) return undefined;
    const value = JSON.parse(buffer.toString("utf8", 0, newline)) as Record<string, unknown>;
    if (value.type !== "session" || typeof value.id !== "string" || !value.id ||
        typeof value.timestamp !== "string" || typeof value.cwd !== "string") return undefined;
    return {
      id: value.id,
      timestamp: value.timestamp,
      cwd: value.cwd,
      ...(typeof value.parentSession === "string" ? { parentSession: value.parentSession } : {}),
      ...(typeof value.rlmDepth === "number" && Number.isInteger(value.rlmDepth)
        ? { rlmDepth: value.rlmDepth }
        : {}),
    };
  } catch {
    return undefined;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

interface RuntimeState {
  mode: PrimeContextMode;
  config: ResolvedPrimeContextConfig;
  configWarnings: string[];
  skillLibrary: SkillLibrarySnapshot;
  auxiliary: AuxiliaryRuntime;
  autoLearnedTaskKeys: Set<string>;
  autoLearnInFlight: boolean;
  exactRepeat: ExactRepeatHintState;
  recentAttempts: { action: string; decisiveObservation: string }[];
  toolStartedAt: Map<string, number>;
  archive?: ObservationArchive;
  taskSnapshot: TaskSnapshotV2;
  branchAnchorId?: string;
  exchanges: ExchangeTracker;
  fixedViews: Map<string, FixedExchangeView>;
  sourceMessages: Map<string, ContextMessageLike>;
  pendingImages: Map<string, readonly ProjectedImageRef[]>;
  projectionEpoch: number;
  projectionToolSetRevision?: string;
  projectionCache: ProviderProjectionCache<ContextMessageLike>;
  sessionRecall?: {
    normalizedCwd: string;
    cwdKey: string;
    isRlmChild: boolean;
    currentSessionId: string;
    archiveRoot: string;
    projectSessionDir?: string;
    parent?: RecallArchiveSource;
  };
  control: {
    expectedAnchor?: RenderedTaskAnchor;
    structuralBoundary: boolean;
    needsAnchorRefresh: boolean;
  };
  lifecycle: {
    agentRun: number;
    turnIndex?: number;
    turnStartedAt?: number;
    selectedModelKey?: string;
    replayMetadataPagingEligible: boolean;
  };
}

export const REQUIRED_HOOKS = new Set([
  "session_start",
  "session_shutdown",
  "resources_discover",
  "session_compact",
  "session_tree",
  "before_agent_start",
  "agent_start",
  "agent_end",
  "turn_start",
  "model_select",
  "tool_execution_start",
  "tool_call",
  "tool_result",
  "turn_end",
  "user_bash_end",
  "model_context",
  "message_end",
  "session_before_compact",
  "session_before_tree",
]);

const PENDING_IMAGE_RESULT_MAX = 64;
const PENDING_IMAGE_PER_RESULT_MAX = 4096;
function clearPendingImages(runtime: RuntimeState, toolCallId: string): void {
  runtime.pendingImages.delete(toolCallId);
}

function setPendingImages(
  runtime: RuntimeState,
  toolCallId: string,
  images: readonly ProjectedImageRef[],
): void {
  clearPendingImages(runtime, toolCallId);
  if (runtime.pendingImages.size >= PENDING_IMAGE_RESULT_MAX) return;
  const admitted = images.filter((image) =>
    PROVIDER_IMAGE_MIME_TYPES.has(image.mimeType.toLowerCase()) &&
    Number.isFinite(image.bytes) && image.bytes >= 0 && image.bytes <= RECOVERY_IMAGE_MAX_BYTES
  ).slice(0, PENDING_IMAGE_PER_RESULT_MAX);
  runtime.pendingImages.set(toolCallId, admitted);
}

export function requiredHooksLoaded(hooks: ReadonlySet<string>): boolean {
  return [...REQUIRED_HOOKS].every((hook) => hooks.has(hook));
}

export function shouldArchiveToolResult(toolName: string): boolean {
  return toolName !== "prime_context";
}

export function shouldCommitExchangeArchive(exchange: Readonly<PendingExchange>, callArgumentByteLimit = 6_144): boolean {
  return exchange.largeResult === true || exchange.admittedCapsule !== undefined ||
    exchange.archiveSource !== undefined || exchange.frozenResultPath !== undefined ||
    exchange.persistedResultChanged === true || exchange.persistedCanonicalResultChanged === true ||
    (exchange.intent?.modelInputBytes ?? 0) > callArgumentByteLimit ||
    (exchange.archiveParts ?? []).some((part) => part.kind !== "result" || !(part.mediaType ?? "").startsWith("text/"));
}

function visibleToolResultText(
  content: readonly (TextContent | ImageContent)[],
  maxBytes = Number.POSITIVE_INFINITY,
): { text: string; textBytes: number; truncated: boolean; tail: string; samples: string[] } {
  return boundedResultTextStats(content, maxBytes);
}

function resultFullOutputPath(details: unknown): string | undefined {
  if (!details || typeof details !== "object") return undefined;
  const path = (details as Record<string, unknown>).fullOutputPath;
  return typeof path === "string" ? path : undefined;
}

function visiblePartSource(content: readonly (TextContent | ImageContent)[]): StreamPartSource {
  const texts = content.flatMap((block) => block.type === "text" && block.text.length > 0 ? [block.text] : []);
  if (texts.length <= 1) return { kind: "text", text: texts[0] ?? "" };
  return { kind: "texts", texts: () => texts.values() };
}

async function resolvedPartSource(
  source: StreamPartSource,
  signal?: AbortSignal,
): Promise<ResolvedArchiveText> {
  const summary = await summarizePartSource(source, signal);
  const { source: partSource, ...values } = summary;
  return {
    ...values,
    text: summary.exactText ?? summary.capsuleText,
    source: source.kind === "path" ? "public-complete-output" : "visible-tool-result",
    partSource,
  };
}

async function partSourcesEqual(
  left: StreamPartSource,
  right: StreamPartSource,
  signal?: AbortSignal,
): Promise<boolean> {
  const leftIterator = sourceBytes(left, signal)[Symbol.asyncIterator]();
  const rightIterator = sourceBytes(right, signal)[Symbol.asyncIterator]();
  let leftChunk = Buffer.alloc(0);
  let rightChunk = Buffer.alloc(0);
  let leftDone = false;
  let rightDone = false;
  for (;;) {
    if (leftChunk.length === 0 && !leftDone) {
      const next = await leftIterator.next();
      leftDone = Boolean(next.done);
      leftChunk = next.value ?? Buffer.alloc(0);
    }
    if (rightChunk.length === 0 && !rightDone) {
      const next = await rightIterator.next();
      rightDone = Boolean(next.done);
      rightChunk = next.value ?? Buffer.alloc(0);
    }
    if (leftDone && rightDone && leftChunk.length === 0 && rightChunk.length === 0) return true;
    if ((leftDone && leftChunk.length === 0) !== (rightDone && rightChunk.length === 0)) return false;
    const compared = Math.min(leftChunk.length, rightChunk.length);
    if (!leftChunk.subarray(0, compared).equals(rightChunk.subarray(0, compared))) return false;
    leftChunk = leftChunk.subarray(compared);
    rightChunk = rightChunk.subarray(compared);
  }
}

function textPart(
  name: string,
  kind: ObservationPartInput["kind"],
  text: string | undefined,
  mediaType = "text/plain; charset=utf-8",
): ObservationPartInput | undefined {
  return text ? { name, kind, text, mediaType } : undefined;
}

export function typedObservationParts(event: ToolResultEvent): ObservationPartInput[] {
  if (!shouldArchiveToolResult(event.toolName)) return [];
  const parts: ObservationPartInput[] = [];
  if (isEditToolResult(event)) {
    const diff = textPart("diff", "diff", event.details?.diff);
    if (diff) parts.push(diff);
  }
  if (isIpythonToolResult(event)) {
    const stdout = textPart("stdout", "stdout", event.details?.stdout);
    const stderr = textPart("stderr", "stderr", event.details?.stderr);
    const backgroundOutput = textPart("background-output", "stdout", event.details?.backgroundOutput);
    const result = textPart("result-value", "result", event.details?.result);
    const traceback = textPart("traceback", "traceback", event.details?.error?.traceback.join("\n"));
    if (stdout) parts.push(stdout);
    if (stderr) parts.push(stderr);
    if (backgroundOutput) parts.push(backgroundOutput);
    if (result) parts.push(result);
    if (traceback) parts.push(traceback);
    const ipythonDetails = record(event.details);
    const sentAgentMessages = ipythonDetails?.sentAgentMessages;
    if (Array.isArray(sentAgentMessages) && sentAgentMessages.length > 0) {
      parts.push({
        name: "sent-agent-messages",
        kind: "result",
        mediaType: "application/json",
        text: JSON.stringify(sentAgentMessages, null, 2),
      });
    }
    if (ipythonDetails?.error && typeof ipythonDetails.error === "object") {
      parts.push({
        name: "error",
        kind: "traceback",
        mediaType: "application/json",
        text: JSON.stringify(ipythonDetails.error, null, 2),
      });
    }
    if (event.details?.diffs?.length) {
      parts.push({
        name: "diff",
        kind: "diff",
        mediaType: "application/json",
        text: JSON.stringify(event.details.diffs, null, 2),
      });
    }
    for (const [index, attachment] of (event.details?.attachments ?? []).entries()) {
      parts.push({
        name: `attachment:${index + 1}`,
        kind: "attachment",
        mediaType: attachment.mimeType,
        binaryBase64: attachment.data,
      });
    }
  }
  let imageIndex = 0;
  for (const block of event.content) {
    if (block.type !== "image") continue;
    imageIndex += 1;
    parts.push({
      name: `image:${imageIndex}`,
      kind: "image",
      mediaType: block.mimeType,
      binaryBase64: block.data,
    });
  }
  return parts;
}

const PROVIDER_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

function projectedImageRefs(
  exchangeId: string,
  content: readonly (TextContent | ImageContent)[],
): ProjectedImageRef[] {
  const images: ProjectedImageRef[] = [];
  let imageIndex = 0;
  for (const block of content) {
    if (block.type !== "image") continue;
    imageIndex += 1;
    const bytes = Buffer.from(block.data, "base64");
    const dimensions = imageDimensions(bytes, block.mimeType);
    images.push({
      ref: `${exchangeId}:image:${imageIndex}`,
      mimeType: block.mimeType,
      bytes: bytes.byteLength,
      ...(dimensions ?? {}),
    });
  }
  return images;
}

export function typedObservationPartsEqual(
  left: readonly ObservationPartInput[],
  right: readonly ObservationPartInput[],
): boolean {
  if (left.length !== right.length) return false;
  return left.every((part, index) => {
    const candidate = right[index];
    if (!candidate || part.name !== candidate.name || part.kind !== candidate.kind ||
      part.pointer !== candidate.pointer || part.mediaType !== candidate.mediaType ||
      part.text !== candidate.text || part.binaryBase64 !== candidate.binaryBase64) return false;
    if (part.source === candidate.source) return true;
    if (!part.source || !candidate.source || part.source.kind !== candidate.source.kind) return false;
    if (part.source.kind === "text" && candidate.source.kind === "text") {
      return part.source.text === candidate.source.text;
    }
    if (part.source.kind === "path" && candidate.source.kind === "path") {
      return part.source.path === candidate.source.path;
    }
    if (part.source.kind === "bytes" && candidate.source.kind === "bytes") {
      return Buffer.from(part.source.bytes).equals(Buffer.from(candidate.source.bytes));
    }
    return false;
  });
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function canonicalProjectionValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalProjectionValue);
  const object = record(value);
  if (!object) return value;
  return Object.fromEntries(
    Object.keys(object).sort().map((key) => [key, canonicalProjectionValue(object[key])]),
  );
}

function activeToolSetRevision(pi: ExtensionAPI): string {
  const installed = new Map((pi.getAllTools?.() ?? []).map((tool) => [tool.name, tool] as const));
  const activeNames = [...new Set(pi.getActiveTools?.() ?? installed.keys())].sort();
  return JSON.stringify(activeNames.map((name) => {
    const tool = installed.get(name);
    return tool === undefined
      ? { name }
      : canonicalProjectionValue({ name, description: tool.description, parameters: tool.parameters });
  }));
}

export function explicitUserTaskOutcome(text: string): TaskOutcome {
  const subject = String.raw`(?:your|the|this|that)\s+(?:solution|answer|implementation|change|fix|work|task|result)`;
  if (new RegExp(String.raw`\b${subject}\s+(?:is|was|looks)\s+(?:correct|successful|complete|good)\b|\b${subject}\s+(?:passed|succeeded|works)\b|\bconfirmed\s*:\s*(?:pass|success)\b`, "iu").test(text)) {
    return "success";
  }
  if (new RegExp(String.raw`\b${subject}\s+(?:is|was|looks)\s+(?:incorrect|wrong|unsuccessful|incomplete|broken)\b|\b${subject}\s+(?:failed|does\s+not\s+work)\b|\bconfirmed\s*:\s*(?:fail(?:ure)?|error)\b`, "iu").test(text)) {
    return "failure";
  }
  return "unknown";
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => record(part))
    .filter((part): part is Record<string, unknown> => Boolean(part) && part?.type === "text")
    .map((part) => typeof part.text === "string" ? part.text : "")
    .join("\n");
}

function activeGoalFromBranch(branch: readonly BranchEntryLike[]): ActiveGoalSelection | undefined {
  const seen = new Set<string>();
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    if (branch[index].type !== "custom" || branch[index].customType !== "thread_goal_state") continue;
    const data = record(branch[index].data);
    const goalId = typeof data?.goalId === "string" ? data.goalId : undefined;
    if (!data || !goalId || seen.has(goalId)) continue;
    seen.add(goalId);
    if (data.status !== "active") continue;
    return {
      goalId,
      status: "active",
      ...(typeof data.objective === "string" ? { objective: data.objective } : {}),
    };
  }
  return undefined;
}

function scopeBranchToGoal(
  branch: readonly BranchEntryLike[],
  goal: ActiveGoalSelection | undefined,
): readonly BranchEntryLike[] {
  if (!goal) return branch;
  const goalIndex = branch.findIndex((entry) => record(entry.data)?.goalId === goal.goalId);
  if (goalIndex < 0) return branch;
  for (let index = goalIndex - 1; index >= 0; index -= 1) {
    if (record(branch[index].message)?.role === "user") return branch.slice(index);
  }
  return branch.slice(goalIndex);
}


function taskObjective(
  branch: readonly BranchEntryLike[],
  selection: TaskSelection,
  fallback = "",
): string {
  if (selection.objective?.trim()) return selection.objective;
  if (selection.rootUserEntryId) {
    const root = branch.find((entry) => entry.id === selection.rootUserEntryId);
    const text = messageText(record(root?.message)?.content);
    if (text.trim()) return text;
  }
  return fallback;
}

function latestBranchUserText(branch: readonly BranchEntryLike[]): string {
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    const message = record(branch[index].message);
    if (message?.role === "user") return messageText(message.content);
  }
  return "";
}

function sameAnchor(
  persisted: { content: string; details?: Record<string, unknown> } | undefined,
  anchor: RenderedTaskAnchor,
  allowPositionallyScopedUnscoped = false,
): boolean {
  if (persisted?.content !== anchor.content) return false;
  return persisted.details?.taskKey === anchor.details.taskKey ||
    (allowPositionallyScopedUnscoped && persisted.details?.taskKey === undefined);
}

function branchAnchorId(branch: readonly BranchEntryLike[]): string | undefined {
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    if (branch[index].id) return branch[index].id;
  }
  return undefined;
}

function branchScopeIds(branch: readonly BranchEntryLike[]): string[] {
  const ids: string[] = [];
  for (const entry of branch) {
    if (entry.id) ids.push(entry.id);
    const message = record(entry.message);
    if (message?.role !== "assistant" || !Array.isArray(message.content)) continue;
    for (const part of message.content) {
      const item = record(part);
      if (item?.type === "toolCall" && typeof item.id === "string") ids.push(item.id);
    }
  }
  return ids;
}

function observationRefsFromValues(
  values: readonly unknown[],
  limit = Number.POSITIVE_INFINITY,
): string[] {
  const ids = new Set<string>();
  const visit = (value: unknown): void => {
    if (ids.size >= limit || value === null || value === undefined) return;
    if (typeof value === "string") {
      for (const match of value.matchAll(/\bobs_[A-Za-z0-9-]+\b/g)) {
        ids.add(match[0]);
        if (ids.size >= limit) break;
      }
      for (const match of value.matchAll(/\bo\d+\b/g)) {
        ids.add(normalizeObservationRef(match[0]));
        if (ids.size >= limit) break;
      }
      for (const match of value.matchAll(/\bub_[A-Za-z0-9-]+\b/g)) {
        ids.add(match[0]);
        if (ids.size >= limit) break;
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (typeof value === "object") {
      for (const item of Object.values(value as Record<string, unknown>)) visit(item);
    }
  };
  for (const value of values) {
    visit(value);
    if (ids.size >= limit) break;
  }
  return [...ids];
}

function observationRefs(branch: readonly BranchEntryLike[], limit = Number.POSITIVE_INFINITY): string[] {
  return observationRefsFromValues(branch, limit);
}

function observationRefsInProjectedMessages(messages: readonly ContextMessageLike[]): string[] {
  return observationRefsFromValues(messages.map((message) => message.content));
}

function summaryObservationRefs(branch: readonly BranchEntryLike[]): string[] {
  return observationRefsFromValues(branch.flatMap((entry) => {
    if (entry.type === "compaction" || entry.type === "branch_summary") return [entry.summary];
    return [];
  }));
}

function latestCompactionObservationRefs(branch: readonly BranchEntryLike[]): string[] {
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    if (branch[index].type === "compaction") return observationRefsFromValues([branch[index].summary]);
  }
  return [];
}

export function branchProjectionEntries(branch: readonly BranchEntryLike[]): ProjectionCandidateEntry[] {
  return branch.flatMap((entry) => {
    if (!entry.id) return [];
    if (entry.type === "message") {
      const message = record(entry.message);
      if (message?.role === "bashExecution" && message.excludeFromContext === true) return [];
      return message && typeof message.role === "string"
        ? [{ entryId: entry.id, message: message as unknown as ContextMessageLike }]
        : [];
    }
    if (entry.type === "custom_message" && entry.customType && entry.content !== undefined) {
      return [{
        entryId: entry.id,
        message: {
          role: "custom",
          customType: entry.customType,
          content: entry.content,
          display: entry.display,
          details: entry.details,
        },
      }];
    }
    if ((entry.type === "compaction" || entry.type === "branch_summary") && typeof entry.summary === "string") {
      return [{ entryId: entry.id, message: { role: "user", content: entry.summary } }];
    }
    return [];
  });
}

/** Match host model ordering: current compaction summary, then retained/post-compaction entries. */
export function providerModelBranchEntries(branch: readonly BranchEntryLike[]): readonly BranchEntryLike[] {
  let latestCompaction: BranchEntryLike | undefined;
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    if (branch[index].type === "compaction") {
      latestCompaction = branch[index];
      break;
    }
  }
  const visible = providerVisibleBranchEntries(branch);
  return latestCompaction ? [latestCompaction, ...visible] : visible;
}

export function completeVisibleToolCallIds(branch: readonly BranchEntryLike[]): Set<string> {
  const calls = new Set<string>();
  const results = new Set<string>();
  for (const entry of branch) {
    const message = record(entry.message);
    if (entry.type !== "message" || !message) continue;
    if (message.role === "bashExecution" && message.excludeFromContext !== true && entry.id) {
      calls.add(entry.id);
      results.add(entry.id);
    } else if (message.role === "assistant" && Array.isArray(message.content)) {
      for (const part of message.content) {
        const block = record(part);
        if (block?.type === "toolCall" && typeof block.id === "string") calls.add(block.id);
      }
    } else if (message.role === "toolResult" && typeof message.toolCallId === "string") {
      results.add(message.toolCallId);
    }
  }
  return new Set([...calls].filter((id) => results.has(id)));
}

export function visibleFixedToolCallIds(branch: readonly BranchEntryLike[]): Set<string> {
  return completeVisibleToolCallIds(providerModelBranchEntries(branch));
}

export interface ForkVisibleImportSelection {
  visibleBranch: readonly BranchEntryLike[];
  completeToolCallIds: Set<string>;
  fixedRefs: string[];
  refs: string[];
}

export function selectForkVisibleImports(
  branch: readonly BranchEntryLike[],
  pinnedRefs: readonly string[],
  parentViews: readonly FixedExchangeView[],
): ForkVisibleImportSelection {
  const modelBranch = providerModelBranchEntries(branch);
  const visibleBranch = modelBranch;
  const completeToolCallIds = completeVisibleToolCallIds(visibleBranch);
  const visibleViews = parentViews.filter((view) => completeToolCallIds.has(view.toolCallId));
  const fixedRefs = visibleViews.map((view) => view.exchangeId);
  const projected = projectBranchCandidateMessages(
    branchProjectionEntries(modelBranch),
    visibleViews,
    "provider",
  );
  const required = [...new Set([
    ...pinnedRefs.map(normalizeObservationRef),
    ...summaryObservationRefs(visibleBranch),
    ...latestCompactionObservationRefs(branch),
  ])];
  return {
    visibleBranch,
    completeToolCallIds,
    fixedRefs,
    refs: selectForkImportRefs(
      required,
      [],
      [
        ...observationRefsInProjectedMessages(projected.messages),
        ...(projected.shownImageRefs ?? []),
      ],
    ),
  };
}

function fileLists(fileOps: unknown): { readFiles: string[]; modifiedFiles: string[] } {
  const value = record(fileOps);
  const values = (key: string): string[] => {
    const item = value?.[key];
    if (item instanceof Set) return [...item].filter((path): path is string => typeof path === "string");
    return Array.isArray(item) ? item.filter((path): path is string => typeof path === "string") : [];
  };
  const modifiedFiles = [...new Set([...values("modifiedFiles"), ...values("modified"), ...values("written"), ...values("edited")])];
  const modified = new Set(modifiedFiles);
  return {
    readFiles: [...new Set([...values("readFiles"), ...values("read")])].filter((path) => !modified.has(path)),
    modifiedFiles,
  };
}

function treeFixedFileLists(
  entries: readonly ProjectionCandidateEntry[],
  views: ReadonlyMap<string, FixedExchangeView>,
): { readFiles: string[]; modifiedFiles: string[] } | undefined {
  const readFiles = new Set<string>();
  const modifiedFiles = new Set<string>();
  for (const entry of entries) {
    if (entry.message.role !== "assistant" || !Array.isArray(entry.message.content)) continue;
    for (const part of entry.message.content) {
      const call = record(part);
      if (call?.type !== "toolCall" || typeof call.id !== "string" || typeof call.name !== "string") continue;
      const view = views.get(call.id);
      if (!view) return undefined;
      const args = view.callArguments ?? record(call.arguments);
      const path = typeof args?.path === "string" ? args.path :
        typeof args?.file_path === "string" ? args.file_path : undefined;
      if (call.name === "read") {
        if (!path) return undefined;
        readFiles.add(path);
      } else if (call.name === "edit" || call.name === "write") {
        if (!path) return undefined;
        modifiedFiles.add(path);
      } else {
        return undefined;
      }
    }
  }
  for (const path of modifiedFiles) readFiles.delete(path);
  return { readFiles: [...readFiles], modifiedFiles: [...modifiedFiles] };
}

export function scopeFixedExchangeViews(
  views: readonly FixedExchangeView[],
  allowedToolCallIds: ReadonlySet<string>,
): FixedExchangeView[] {
  return views.filter((view) => allowedToolCallIds.has(view.toolCallId));
}

export function selectForkImportRefs(
  pinnedRefs: readonly string[],
  fixedRefs: readonly string[],
  visibleRefs: readonly string[],
  _target?: number,
): string[] {
  return [...new Set([...pinnedRefs, ...fixedRefs, ...visibleRefs])];
}

function commandCandidates(text: string): string[] {
  return [...text.matchAll(/`([^`\n]+)`/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function literalAcceptanceCommands(text: string): string[] {
  const executable = /(?:^|\s)((?:\.\/)?(?:python3?|pytest|py\.test|vitest|jest|mocha|npm|pnpm|yarn|bun|cargo|go|ctest|dotnet|mvnw?|gradlew?|mix|swift|tsc|eslint|ruff|clippy|biome|prettier|black))\b/gi;
  const starts = [...text.matchAll(executable)].map((match) => (match.index ?? 0) + match[0].length - match[1].length);
  const commands: string[] = [];
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    let end = starts[index + 1] ?? text.length;
    const tail = text.slice(start, end);
    const boundary = tail.search(/(?:\r?\n|[,;.]\s|\s+(?:and|then|before|after|so that|to confirm)\b)/i);
    if (boundary > 0) end = start + boundary;
    const command = text.slice(start, end).trim().replace(/[,:;.]+$/, "").trim();
    if (command) commands.push(command);
  }
  for (const fence of text.matchAll(/```(?:[A-Za-z0-9_-]+)?\s*\n([\s\S]*?)```/g)) {
    commands.push(...fence[1].split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  }
  return [...new Set(commands)];
}


function rollingMean(previous: number | undefined, current: number): number {
  return previous === undefined ? current : previous * 0.75 + current * 0.25;
}

function boundedStallAction(facts: ExchangeFacts): string {
  try {
    const input = canonicalProjectionValue(facts.executedInput ?? facts.originalInput);
    const action = `${facts.toolName}:${facts.intent.subjectKey}:${JSON.stringify(input)}`;
    return Buffer.from(action, "utf8").subarray(0, 1_024).toString("utf8");
  } catch {
    return `${facts.toolName}:${facts.intent.subjectKey}`.slice(0, 1_024);
  }
}

function decisiveStallObservation(facts: ExchangeFacts): string {
  switch (facts.progress.kind) {
    case "mutation":
      return `mutation:${facts.progress.artifacts?.map((artifact) => artifact.pathOrId).join(",") || facts.intent.subjectKey}`;
    case "failure":
      return `error:${facts.outcome.exceptions[0] ?? facts.outcome.commandFailures[0] ??
        facts.outcome.testSummary ?? facts.progress.observation.text}`.slice(0, 1_024);
    case "information":
      return `evidence:${facts.progress.observations.map((observation) => observation.text).join(" | ")}`.slice(0, 1_024);
    case "none":
      return (facts.outcome.testSummary ?? facts.outcome.exceptions[0] ??
        facts.outcome.commandFailures[0] ?? facts.text).slice(0, 1_024);
  }
}

function compactTaskPacket(snapshot: TaskSnapshotV2): CompactTaskPacket {
  return {
    objective: snapshot.objective,
    explicitConstraints: snapshot.explicitConstraints
      .filter((constraint) => !constraint.supersededBy)
      .map((constraint) => constraint.text),
    focus: snapshot.focus,
    openItems: snapshot.openItems.map((item) => item.text),
    decisiveObservations: snapshot.actionableObservations.slice(-6).map((observation) => observation.text),
  };
}

export default function primeContext(pi: ExtensionAPI): void {
  const runtime: RuntimeState = {
    mode: "on",
    config: { ...DEFAULT_CONFIG },
    configWarnings: [],
    skillLibrary: Object.freeze({ revision: 0, entries: Object.freeze([]) }),
    auxiliary: createAuxiliaryRuntime({ enabled: false }),
    autoLearnedTaskKeys: new Set(),
    autoLearnInFlight: false,
    exactRepeat: createExactRepeatHintState("session"),
    recentAttempts: [],
    toolStartedAt: new Map(),
    taskSnapshot: createTaskSnapshotV2("session"),
    exchanges: new ExchangeTracker(),
    fixedViews: new Map(),
    sourceMessages: new Map(),
    pendingImages: new Map(),
    projectionEpoch: 0,
    projectionCache: {},
    control: {
      structuralBoundary: false,
      needsAnchorRefresh: false,
    },
    lifecycle: {
      agentRun: 0,
      replayMetadataPagingEligible: false,
    },
  };
  const hooks = new Set<string>();
  let setAutomaticRefinementEnabled: ((enabled: boolean | undefined) => void) | undefined;
  const advanceProjectionEpoch = (): void => {
    runtime.projectionEpoch += 1;
    runtime.exactRepeat = createExactRepeatHintState(runtime.taskSnapshot.taskKey, runtime.projectionEpoch);
    runtime.recentAttempts = [];
  };
  const persistBenchmarkAccounting = (): void => {
    const target = process.env.PRIME_CONTEXT_BENCHMARK_METRICS;
    if (!target) return;
    try {
      writeFileSync(target, `${JSON.stringify({
        schema: "prime-context.benchmark-accounting/v1",
        auxiliary: runtime.auxiliary.accounting,
      }, null, 2)}
`, "utf8");
    } catch {
      // Benchmark accounting is observational and must never change task behavior.
    }
  };
  const executeTrackedAuxiliary: typeof executeAuxiliaryOnce = async (options) => {
    const result = await executeAuxiliaryOnce(options);
    persistBenchmarkAccounting();
    return result;
  };

  pi.on("resources_discover", (event) => {
    const loaded = loadPrimeContextConfig(event.cwd);
    const skillsPath = join(resolveSkillLibraryPath(event.cwd, loaded.config.libraryPath), "skills");
    return existsSync(skillsPath) ? { skillPaths: [skillsPath] } : {};
  });
  hooks.add("resources_discover");

  // The bundled policy is synchronous and idempotent. Task-specific material is
  // appended later, after the task boundary handler has established the snapshot.
  pi.on("before_agent_start", (event) => ({
    systemPrompt: appendPrimeContextGlobalPolicy(event.systemPrompt),
  }));

  const taskSkillSupplement = async (
    event: BeforeAgentStartEvent,
    ctx: ExtensionContext,
  ): Promise<string> => {
    if (runtime.mode === "off") return "";
    beginAuxiliaryTask(runtime.auxiliary, runtime.taskSnapshot.taskKey);
    const installedToolNames = pi.getAllTools?.().map((tool) => tool.name) ?? [];
    const selection = selectSkills(runtime.skillLibrary, {
      taskText: event.prompt,
      installedToolNames,
      skillBudgetTokens: runtime.config.skillBudgetTokens,
    });
    if (selection.highConfidence) return selection.packet;

    const pathSignals = new Set(event.prompt.match(/(?:^|\s)(?:[./~][^\s,;:]+|[A-Za-z0-9_-]+\/[A-Za-z0-9_./-]+)/gu) ?? []);
    const mentionedTools = installedToolNames.filter((name) =>
      event.prompt.toLowerCase().includes(name.toLowerCase())
    );
    const scoutEligible = selection.rankedMatches.length >= 2 ||
      utf8Bytes(event.prompt) >= 2_048 || pathSignals.size >= 2 || mentionedTools.length >= 2;
    if (!scoutEligible || runtime.config.auxiliaryMode === "off" || !ctx.model || !ctx.modelRegistry) {
      return selection.packet;
    }

    const mainModel = ctx.model;
    const modelRegistry = ctx.modelRegistry;
    try {
      const task: CompactTaskPacket = {
        objective: runtime.taskSnapshot.objective ?? event.prompt,
        explicitConstraints: runtime.taskSnapshot.explicitConstraints
          .filter((constraint) => !constraint.supersededBy)
          .map((constraint) => constraint.text),
        focus: runtime.taskSnapshot.focus,
        openItems: runtime.taskSnapshot.openItems.map((item) => item.text),
        decisiveObservations: runtime.taskSnapshot.actionableObservations
          .slice(-4)
          .map((observation) => observation.text),
      };
      const prompt = buildTaskScoutPrompt({
        task,
        availableTools: installedToolNames,
        skillCatalog: runtime.skillLibrary.entries,
        libraryRevision: String(runtime.skillLibrary.revision),
      });
      const hooks = createModelResolutionHooks({
        currentModel: () => mainModel,
        modelRegistry,
      });
      const resolved = await resolveAuxiliaryModel("task-scout", runtime.config, hooks);
      if (!resolved) return selection.packet;
      const currentUsage = ctx.getContextUsage?.();
      runtime.auxiliary.economics.currentMainInputUnitCost = mainModel.cost.input;
      runtime.auxiliary.economics.currentMainOutputUnitCost = mainModel.cost.output;
      if (currentUsage?.totalTokens !== undefined) {
        runtime.auxiliary.economics.latestProviderInputTokens = currentUsage.totalTokens;
      }

      const result = await executeTrackedAuxiliary({
        runtime: runtime.auxiliary,
        prompt,
        auth: resolved,
        plan: {
          kind: "task-scout",
          model: resolved.model,
          blocking: true,
          estimatedInputTokens: prompt.estimatedInputTokens,
          maxOutputTokens: prompt.maxOutputTokens,
          estimatedPromptTokensSaved: 1200,
          estimatedMainTurnsAvoided: 0.25,
          estimatedToolCallsAvoided: 1,
          completionRisk: "medium",
          estimatedCriticalPathMsSaved: 6000,
          estimatedAuxiliaryLatencyMs: 1500,
        },
        parseOutput: (output) => parseTaskScoutOutput(
          output,
          new Set(runtime.skillLibrary.entries.map((entry) => entry.name)),
        ),
      });
      if (result.status !== "success" || !result.output) return selection.packet;
      const selectedEntries = validateSelectedSkillNames(
        result.output.selectedSkillNames,
        runtime.skillLibrary,
        installedToolNames,
      );
      return [
        renderSelectedSkillsPacket(selectedEntries),
        renderTaskScoutSupplement(result.output),
      ].filter(Boolean).join("\n\n");
    } catch {
      return selection.packet;
    }
  };

  const resolveRuntimeAuxiliary = async (kind: AuxiliaryKind, ctx: ExtensionContext) => {
    if (runtime.config.auxiliaryMode === "off" || !ctx.model || !ctx.modelRegistry) return undefined;
    const resolved = await resolveAuxiliaryModel(kind, runtime.config, createModelResolutionHooks({
      currentModel: () => ctx.model!,
      modelRegistry: ctx.modelRegistry,
    }));
    runtime.auxiliary.economics.currentMainInputUnitCost = ctx.model.cost.input;
    runtime.auxiliary.economics.currentMainOutputUnitCost = ctx.model.cost.output;
    runtime.auxiliary.economics.latestProviderInputTokens = ctx.getContextUsage?.()?.totalTokens;
    return resolved;
  };

  const runStallRecovery = async (ctx: ExtensionContext): Promise<string | undefined> => {
    const resolved = await resolveRuntimeAuxiliary("stall-recovery", ctx);
    if (!resolved) return undefined;
    const installedTools = pi.getAllTools?.().map((tool) => tool.name) ?? [];
    const supplement = record(runtime.control.expectedAnchor?.details)?.skillSupplement;
    const selectedSkills = typeof supplement === "string"
      ? runtime.skillLibrary.entries.filter((entry) => supplement.includes(`name="${entry.name}"`)).map((entry) => entry.name)
      : [];
    const prompt = buildStallRecoveryPrompt({
      task: compactTaskPacket(runtime.taskSnapshot),
      selectedSkills,
      availableTools: installedTools,
      recentAttempts: runtime.recentAttempts,
    });
    const result = await executeTrackedAuxiliary({
      runtime: runtime.auxiliary,
      prompt,
      auth: resolved,
      signal: ctx.signal,
      plan: {
        kind: "stall-recovery",
        model: resolved.model,
        blocking: true,
        estimatedInputTokens: prompt.estimatedInputTokens,
        maxOutputTokens: prompt.maxOutputTokens,
        estimatedPromptTokensSaved: 300,
        estimatedMainTurnsAvoided: 1,
        estimatedToolCallsAvoided: 1,
        completionRisk: "high",
        estimatedCriticalPathMsSaved: 8_000,
        estimatedAuxiliaryLatencyMs: 1_500,
      },
      parseOutput: parseStallRecoveryOutput,
    });
    return result.status === "success" && result.output
      ? `<prime_context_hint>
${renderStallRecoveryHint(result.output)}
</prime_context_hint>`
      : undefined;
  };

  const distillLargestExchange = async (
    facts: readonly ExchangeFacts[],
    archives: CompletedExchangeArchive[],
    contextUsage: ReturnType<ExtensionContext["getContextUsage"]>,
    ctx: ExtensionContext,
  ): Promise<boolean> => {
    if ((contextUsage?.percent ?? 0) < 55) return false;
    const factsByCall = new Map(facts.map((item) => [item.toolCallId, item]));
    const candidates = archives.flatMap((archive) => {
      const item = factsByCall.get(archive.metadata.toolCallId);
      if (!item || !archive.largeResult || !archive.admittedCapsule ||
          item.textBytes < runtime.config.minTextBytes ||
          /^(?:bash|edit|write|ipython)$/iu.test(item.toolName)) return [];
      return [{ archive, facts: item }];
    }).sort((left, right) => right.facts.textBytes - left.facts.textBytes);
    const candidate = candidates[0];
    if (!candidate) return false;
    const resolved = await resolveRuntimeAuxiliary("semantic-distill", ctx);
    if (!resolved) return false;
    const ref = candidate.archive.metadata.exchangeId;
    const rawResult = candidate.facts.fullOutputSnapshotPath
      ? await readBoundedTextFile(candidate.facts.fullOutputSnapshotPath) ?? candidate.facts.text
      : candidate.facts.text;
    const prompt = buildSemanticDistillPrompt({
      task: compactTaskPacket(runtime.taskSnapshot),
      tool: candidate.facts.toolName,
      subject: candidate.facts.intent.subjectKey,
      deterministicCapsule: candidate.archive.admittedCapsule!,
      rawResult,
      availableRecovery: [{ ref, part: "result" }],
    });
    const result = await executeTrackedAuxiliary({
      runtime: runtime.auxiliary,
      prompt,
      auth: resolved,
      signal: ctx.signal,
      plan: {
        kind: "semantic-distill",
        model: resolved.model,
        blocking: true,
        estimatedInputTokens: prompt.estimatedInputTokens,
        maxOutputTokens: prompt.maxOutputTokens,
        estimatedPromptTokensSaved: Math.max(700, Math.ceil(candidate.facts.textBytes / 2)),
        estimatedMainTurnsAvoided: 0.25,
        estimatedToolCallsAvoided: 0.25,
        completionRisk: candidate.facts.outcome.status === "unknown" ? "medium" : "low",
        estimatedCriticalPathMsSaved: 3_000,
        estimatedAuxiliaryLatencyMs: 1_500,
      },
      parseOutput: (output) => parseSemanticCapsuleOutput(output, {
        capsuleMaxBytes: runtime.config.capsuleMaxBytes,
        allowedSourceAnchors: new Set([ref]),
      }),
    });
    if (result.status !== "success" || !result.output) return false;
    const rendered = renderSemanticCapsule(result.output, runtime.config.capsuleMaxBytes);
    if (!rendered) return false;
    candidate.archive.admittedCapsule = rendered;
    return true;
  };

  const cwdKey = (cwd: string): string => Buffer.from(resolve(cwd), "utf8").toString("base64url");
  const discoverRecallSources = async (
    ctx: ExtensionContext,
    archiveRoot: string,
  ): Promise<NonNullable<RuntimeState["sessionRecall"]>> => {
    const normalizedCwd = resolve(ctx.cwd);
    const key = cwdKey(normalizedCwd);
    const getHeader = ctx.sessionManager.getHeader as (() => ReturnType<ExtensionContext["sessionManager"]["getHeader"]>) | undefined;
    const getSessionDir = ctx.sessionManager.getSessionDir as (() => string) | undefined;
    const header = typeof getHeader === "function" ? getHeader.call(ctx.sessionManager) : null;
    const currentSessionId = ctx.sessionManager.getSessionId();
    let parent: RecallArchiveSource | undefined;
    let isRlmChild = false;
    let projectSessionDir = typeof getSessionDir === "function" ? getSessionDir.call(ctx.sessionManager) : undefined;
    let parentFile = header?.parentSession;
    let direct = true;
    let expectedParentDepth = header?.rlmDepth === undefined ? undefined : header.rlmDepth - 1;
    const seen = new Set<string>();
    while (parentFile && !seen.has(parentFile)) {
      seen.add(parentFile);
      const parentHeader = await readRecallSessionHeader(parentFile);
      if (!parentHeader) break;
      if (direct) {
        parent = {
          archive: new ObservationArchive(archiveRoot, parentHeader.id),
          scope: "parent",
          sessionId: parentHeader.id,
          sessionDate: parentHeader.timestamp,
        };
        isRlmChild = expectedParentDepth !== undefined && parentHeader.rlmDepth === expectedParentDepth;
        if (!isRlmChild) break;
      } else if (expectedParentDepth === undefined || parentHeader.rlmDepth !== expectedParentDepth) {
        break;
      }
      projectSessionDir = dirname(parentFile);
      direct = false;
      if (parentHeader.rlmDepth === 0) break;
      expectedParentDepth = parentHeader.rlmDepth === undefined ? undefined : parentHeader.rlmDepth - 1;
      parentFile = parentHeader.parentSession;
    }
    return {
      normalizedCwd,
      cwdKey: key,
      isRlmChild,
      currentSessionId,
      archiveRoot,
      ...(projectSessionDir ? { projectSessionDir } : {}),
      ...(parent ? { parent } : {}),
    };
  };

  const installFixedViews = (
    views: readonly FixedExchangeView[],
    replace = false,
    allowedToolCallIds?: ReadonlySet<string>,
  ): void => {
    if (replace) runtime.fixedViews.clear();
    const scoped = allowedToolCallIds ? scopeFixedExchangeViews(views, allowedToolCallIds) : views;
    for (const view of scoped) runtime.fixedViews.set(view.toolCallId, view);
  };

  const clearProjectionImages = (): void => {
    runtime.pendingImages.clear();
  };

  const refreshTaskSelection = (
    branch: readonly BranchEntryLike[],
    goal?: ActiveGoalSelection,
    reload = false,
  ): TaskSelection | undefined => {
    const selection = deriveTaskSelection(branch, goal);
    if (!selection) {
      runtime.archive?.setBranchScope(undefined, branchScopeIds(branch), [
        ...observationRefs(branch), ...runtime.taskSnapshot.pinnedObservationIds,
      ]);
      return undefined;
    }
    if (reload || runtime.taskSnapshot.taskKey !== selection.taskKey) {
      runtime.exchanges.clearPending();
      runtime.archive?.resetBranchState();
    }
    runtime.archive?.setBranchScope(selection.taskKey, branchScopeIds(branch), [
      ...observationRefs(branch), ...runtime.taskSnapshot.pinnedObservationIds,
    ]);
    runtime.branchAnchorId = branchAnchorId(branch);
    return selection;
  };



  const childAnchorContext = (prompt: string): TaskAnchorInput["child"] | undefined => {
    const recall = runtime.sessionRecall;
    if (!recall?.isRlmChild || !recall.parent) return undefined;
    const refPattern = /(?<![A-Za-z0-9_])(?:(?<session>[A-Za-z0-9_-]+):)?(?<ref>o\d+|obs_[A-Za-z0-9_-]+)(?<part>:[A-Za-z0-9_#/.~-]+)?(?![A-Za-z0-9_])/g;
    const explicitRefs = [...prompt.matchAll(refPattern)].flatMap((match) => {
      const source = match.groups?.session;
      const ref = match.groups?.ref;
      if (!ref || (source && source !== recall.parent!.sessionId)) return [];
      return [`${ref}${match.groups?.part ?? ""}`];
    });
    const parentRefs = [...new Set(explicitRefs)].slice(0, 8);
    const relevantPaths = explicitSteeringPaths(prompt).slice(0, 8);
    const constraints = prompt
      .split(/(?:\n+|(?<=[.!?])\s+)/)
      .map((value) => value.replace(/^[-*]\s*/, "").trim())
      .filter((value) => /\b(?:must|do not|don't|never|only|required|without|limit(?:ed)? to)\b/i.test(value))
      .slice(0, 6);
    return {
      parentSessionId: recall.parent.sessionId,
      parentRefs,
      relevantPaths,
      constraints,
    };
  };

  const currentTaskAnchor = (
    branch: readonly BranchEntryLike[],
    selection: TaskSelection | undefined,
    visiblePrompt: string,
  ): RenderedTaskAnchor | undefined => {
    if (!selection) return undefined;
    const objective = taskObjective(branch, selection, visiblePrompt);
    if (!objective.trim()) return undefined;
    if (runtime.taskSnapshot.taskKey !== selection.taskKey) {
      runtime.taskSnapshot = createTaskSnapshotV2(selection.taskKey, objective, selection.rootUserEntryId);
    } else if (!runtime.taskSnapshot.objective) {
      runtime.taskSnapshot = {
        ...runtime.taskSnapshot,
        objective,
        ...(selection.rootUserEntryId ? { objectiveSourceEntryId: selection.rootUserEntryId } : {}),
      };
    }
    const child = childAnchorContext(objective);
    const input: TaskAnchorInput = {
      task: runtime.taskSnapshot,
      ...(child ? { child } : {}),
    };
    const content = renderPrimeContextTask(runtime.taskSnapshot, {
      objectiveVisible: visiblePrompt.includes(objective),
    });
    if (!content) return undefined;
    return { ...renderPrimeContextAnchor(input), content };
  };

  const clearControlState = (structuralBoundary: boolean): void => {
    runtime.control.expectedAnchor = undefined;
    runtime.control.structuralBoundary = structuralBoundary;
    runtime.control.needsAnchorRefresh = false;
  };

  const reloadSelectedBranch = (
    ctx: { cwd: string; sessionManager: { getBranch(): unknown[] } },
    preserveProjectionImages = false,
  ) => {
    const fullBranch = ctx.sessionManager.getBranch() as BranchEntryLike[];
    const providerBranch = providerVisibleBranchEntries(fullBranch);
    runtime.sourceMessages = new Map(branchProjectionEntries(fullBranch).map((entry) => [entry.entryId, entry.message]));
    runtime.exchanges.clearPending();
    advanceProjectionEpoch();
    if (!preserveProjectionImages) clearProjectionImages();
    runtime.branchAnchorId = undefined;
    runtime.archive?.resetBranchState();
    const goal = activeGoalFromBranch(fullBranch);
    const branch = scopeBranchToGoal(fullBranch, goal);
    const selection = refreshTaskSelection(branch, goal, true);
    if (selection) {
      const loadedTask = loadLatestTaskSnapshotV2(fullBranch, selection.taskKey);
      if (loadedTask) runtime.taskSnapshot = loadedTask;
      else if (runtime.taskSnapshot.taskKey !== selection.taskKey) {
        runtime.taskSnapshot = createTaskSnapshotV2(
          selection.taskKey,
          runtime.taskSnapshot.objective ?? selection.objective,
          selection.rootUserEntryId,
        );
      }
    }
    runtime.control.expectedAnchor = currentTaskAnchor(
      branch,
      selection,
      latestBranchUserText(providerBranch),
    );
  };

  const installUserBashViews = async (
    ctx: ExtensionContext,
    event?: UserBashEndPayload,
  ): Promise<void> => {
    if (!runtime.archive) return;
    const entries: ProjectionCandidateEntry[] = event ? [{
      entryId: event.entryId,
      message: {
        role: "bashExecution",
        command: event.command,
        output: event.output,
        ...(event.exitCode === undefined ? {} : { exitCode: event.exitCode }),
        ...(event.cancelled === undefined ? {} : { cancelled: event.cancelled }),
        ...(event.fullOutputPath === undefined ? {} : { fullOutputPath: event.fullOutputPath }),
      },
    }] : branchProjectionEntries(ctx.sessionManager.getBranch() as BranchEntryLike[]);
    const completed: CompletedExchangeArchive[] = [];
    const frozenSources: string[] = [];
    try {
      for (const [sourceOrder, entry] of entries.entries()) {
      const message = entry.message;
      if (message.role !== "bashExecution" || message.excludeFromContext === true ||
        runtime.fixedViews.has(entry.entryId)) continue;
      const command = typeof message.command === "string" ? message.command : "";
      const output = typeof message.output === "string" ? message.output : "";
      const fullOutputPath = typeof message.fullOutputPath === "string" ? message.fullOutputPath : undefined;
      let frozenOutputPath: string | undefined;
      if (fullOutputPath) {
        try {
          frozenOutputPath = await runtime.archive.freezeTextSource(fullOutputPath, ctx.signal);
          frozenSources.push(frozenOutputPath);
        } catch {
          ctx.signal?.throwIfAborted();
        }
      }
      const resolved = await resolveArchiveText(
        [{ type: "text", text: output }],
        frozenOutputPath,
        ctx.signal,
      );
      const details = {
        ...(typeof message.exitCode === "number" ? { exitCode: message.exitCode } : {}),
        ...(fullOutputPath ? { fullOutputPath } : {}),
      };
      const exchangeId = `ub_${entry.entryId}`;
      const modelInput = { command };
      const intent = adaptToolIntent({
        exchangeId,
        toolCallId: entry.entryId,
        toolName: "bash",
        input: modelInput,
        cwd: ctx.cwd,
        modelInputBytes: jsonBytes(modelInput),
        details,
        resultText: resolved.outcomeText ?? resolved.text,
        isError: message.cancelled === true || (typeof message.exitCode === "number" && message.exitCode !== 0),
      });
      const isError = message.cancelled === true || (typeof message.exitCode === "number" && message.exitCode !== 0);
      const outcome = collectFactualOutcome(intent, resolved.outcomeText ?? resolved.text, isError, details);
      if (!resolved.large && !fullOutputPath) continue;
      completed.push({
        metadata: {
          exchangeId,
          toolCallId: entry.entryId,
          intentKind: intent.kind,
          subjectKey: intent.subjectKey,
          resources: intent.resources,
          ...(intent.suite ? { suite: intent.suite } : {}),
          effectiveCwd: intent.effectiveCwd,
          mutatesWorkspace: intent.mutatesWorkspace,
          modelInputBytes: intent.modelInputBytes,
          executedInputBytes: intent.executedInputBytes,
          ...(intent.facts ? { facts: intent.facts } : {}),
          outcome,
          ...(runtime.taskSnapshot.taskKey === "session" ? {} : { taskKey: runtime.taskSnapshot.taskKey }),
          branchAnchorId: entry.entryId,
        },
        toolName: "bash",
        isError,
        source: resolved.source,
        parts: [{
          name: "result",
          kind: "result",
          mediaType: "text/plain; charset=utf-8",
          ...(resolved.partSource ? { source: resolved.partSource } : { text: resolved.text }),
        }],
        persistedModelInput: modelInput,
        persistedRawCall: { type: "toolCall", id: entry.entryId, name: "bash", arguments: modelInput },
        persistedRawResult: { details, isError },
        resultText: resolved.text,
        largeResult: resolved.large,
        canonicalResultChangedAfterHook: resolved.large,
        resultSummary: resolved,
        sourceOrder,
      });
    }
      if (completed.length === 0) return;
      const installedViews = await runtime.archive.finalizeExchanges(completed, ctx.signal, {
        budgetBytes: fixedExchangeBudgetBytes(ctx.getContextUsage()),
        capsuleMaxBytes: runtime.config.capsuleMaxBytes,
        archiveAdmissionBytes: runtime.config.minTextBytes,
      });
      installFixedViews(installedViews);
    } finally {
      await Promise.all(frozenSources.map((path) =>
        runtime.archive!.removeFrozenTextSource(path).catch(() => undefined)
      ));
    }
  };

  pi.on("session_start", async (event, ctx) => {
    if (typeof ctx.setAutomaticRefinementEnabled !== "function") {
      throw new Error(
        `Prime Context requires patched prime-agent@0.9.1. Run: prime-context-patch-agent "$(npm root -g)/prime-agent"`,
      );
    }
    setAutomaticRefinementEnabled = (enabled) => ctx.setAutomaticRefinementEnabled(enabled);
    const loaded = loadPrimeContextConfig(ctx.cwd);
    runtime.config = loaded.config;
    runtime.configWarnings = loaded.warnings;
    runtime.auxiliary = createAuxiliaryRuntime({
      enabled: loaded.config.enabled && loaded.config.auxiliaryMode === "utility-gated",
    });
    persistBenchmarkAccounting();
    runtime.autoLearnedTaskKeys.clear();
    runtime.autoLearnInFlight = false;
    runtime.exactRepeat = createExactRepeatHintState("session");
    runtime.recentAttempts = [];
    const skills = loadSkillLibrary({
      libraryPath: resolveSkillLibraryPath(ctx.cwd, loaded.config.libraryPath),
      revision: runtime.skillLibrary.revision + 1,
    });
    runtime.skillLibrary = skills.snapshot;
    runtime.configWarnings.push(...skills.diagnostics.map((item) => item.message));
    runtime.mode = loaded.config.enabled ? "on" : "off";
    setAutomaticRefinementEnabled(runtime.mode === "on" ? false : undefined);
    const archiveRoot = storageRoot();
    const currentArchive = new ObservationArchive(archiveRoot, ctx.sessionManager.getSessionId());
    runtime.archive = currentArchive;
    runtime.sessionRecall = await discoverRecallSources(ctx, archiveRoot);
    runtime.exchanges.resetSession();
    runtime.fixedViews.clear();
    runtime.taskSnapshot = createTaskSnapshotV2("session");
    runtime.lifecycle.selectedModelKey = ctx.model
      ? `${ctx.model.provider}:${ctx.model.id}`
      : undefined;
    runtime.lifecycle.replayMetadataPagingEligible = false;
    runtime.projectionToolSetRevision = undefined;
    clearControlState(false);
    reloadSelectedBranch(ctx);
    runtime.exchanges.setMinimumSequence(await currentArchive.maxExchangeSequence(undefined, ctx.signal));
    currentArchive.recordBranchRuntimeReload();
    const sessionBranch = ctx.sessionManager.getBranch() as BranchEntryLike[];
    installFixedViews(
      await currentArchive.loadFixedExchangeViews(ctx.signal).catch(() => []),
      true,
      visibleFixedToolCallIds(sessionBranch),
    );

    if (event.reason === "fork" && runtime.sessionRecall.parent) {
      const parentSessionId = runtime.sessionRecall.parent.sessionId;
      if (parentSessionId && parentSessionId !== ctx.sessionManager.getSessionId()) {
        const branch = ctx.sessionManager.getBranch() as BranchEntryLike[];
        const parentArchive = runtime.sessionRecall.parent.archive;
        const parentViews = await parentArchive.loadFixedExchangeViews(ctx.signal).catch(() => []);
            const visible = selectForkVisibleImports(
          branch,
          runtime.taskSnapshot.pinnedObservationIds,
          parentViews,
        );
        const refs = visible.refs;
        await currentArchive
          .importFrom(
            parentArchive,
            refs,
            ctx.signal,
            {
              ...(runtime.taskSnapshot.taskKey === "session" ? {} : { taskKey: runtime.taskSnapshot.taskKey }),
              branchAnchorId: branchAnchorId(branch),
            },
          )
          .catch(() => undefined);
        runtime.exchanges.setMinimumSequence(await currentArchive.maxExchangeSequence(refs, ctx.signal));
        installFixedViews(
          await currentArchive.loadFixedExchangeViews(ctx.signal).catch(() => []),
          true,
          visible.completeToolCallIds,
        );
      }
    }
    await installUserBashViews(ctx);
  });
  hooks.add("session_start");

  pi.on("before_agent_start", async (event, ctx) => {
    if (runtime.mode === "off") return;
    runtime.exactRepeat = resetExactRepeatHintState(runtime.exactRepeat, {
      taskKey: runtime.taskSnapshot.taskKey,
      contextEpoch: runtime.exactRepeat.contextEpoch,
    });
    runtime.recentAttempts = [];
    const fullBranch = ctx.sessionManager.getBranch() as BranchEntryLike[];
    const providerBranch = providerVisibleBranchEntries(fullBranch);
    const goal = activeGoalFromBranch(fullBranch);
    if (!goal) {
      const currentSelection = deriveTaskSelection(fullBranch);
      const incomingSelection = deriveTaskSelection([
        ...fullBranch,
        { type: "message", message: { role: "user", content: event.prompt } },
      ]);
      if (incomingSelection && incomingSelection.taskKey !== currentSelection?.taskKey) {
        if (!event.prompt.trim()) {
          runtime.control.expectedAnchor = undefined;
          return;
        }
        runtime.taskSnapshot = createTaskSnapshotV2(
          incomingSelection.taskKey,
          event.prompt,
          incomingSelection.rootUserEntryId,
        );
        const content = renderPrimeContextTask(runtime.taskSnapshot, { objectiveVisible: true });
        if (!content) {
          runtime.control.expectedAnchor = undefined;
          return;
        }
        const child = childAnchorContext(event.prompt);
        const rendered = renderPrimeContextAnchor({
          task: runtime.taskSnapshot,
          ...(child ? { child } : {}),
        });
        const skillSupplement = await taskSkillSupplement(event, ctx);
        const anchor = {
          ...rendered,
          content: skillSupplement ? `${content}\n\n${skillSupplement}` : content,
          details: { ...rendered.details, ...(skillSupplement ? { skillSupplement } : {}) },
        };
        runtime.control.expectedAnchor = anchor;
        return {
          message: {
            customType: PRIME_CONTEXT_ANCHOR_TYPE,
            content: anchor.content,
            display: false,
            details: anchor.details,
          },
        };
      }
    }
    const branch = scopeBranchToGoal(fullBranch, goal);
    const selection = refreshTaskSelection(branch, goal);
    if (!selection) {
      runtime.control.expectedAnchor = undefined;
      return;
    }
    const objective = goal?.objective?.trim() || taskObjective(branch, selection, event.prompt);
    if (!objective.trim()) {
      runtime.control.expectedAnchor = undefined;
      return;
    }
    const loadedTask = loadLatestTaskSnapshotV2(fullBranch, selection.taskKey);
    if (loadedTask) runtime.taskSnapshot = loadedTask;
    else if (runtime.taskSnapshot.taskKey !== selection.taskKey) {
      runtime.taskSnapshot = createTaskSnapshotV2(selection.taskKey, objective, selection.rootUserEntryId);
    } else if (!runtime.taskSnapshot.objective) {
      runtime.taskSnapshot = {
        ...runtime.taskSnapshot,
        objective,
        ...(selection.rootUserEntryId ? { objectiveSourceEntryId: selection.rootUserEntryId } : {}),
      };
    }
    const visiblePrompt = latestBranchUserText(providerBranch) || event.prompt;
    const content = renderPrimeContextTask(runtime.taskSnapshot, {
      objectiveVisible: visiblePrompt.includes(objective),
    });
    if (!content) {
      runtime.control.expectedAnchor = undefined;
      return;
    }
    const child = childAnchorContext(event.prompt || objective);
    const rendered = renderPrimeContextAnchor({
      task: runtime.taskSnapshot,
      ...(child ? { child } : {}),
    });
    const lookupUnscoped = selection.source === "user" && selection.rootUserEntryId
      ? { content, afterEntryId: selection.rootUserEntryId }
      : undefined;
    const persisted = latestProviderVisibleControlMessage(
      fullBranch,
      PRIME_CONTEXT_ANCHOR_TYPE,
      rendered.details.taskKey,
      lookupUnscoped,
    );
    const persistedSupplement = record(persisted?.details)?.skillSupplement;
    const skillSupplement = typeof persistedSupplement === "string"
      ? persistedSupplement
      : persisted ? "" : await taskSkillSupplement(event, ctx);
    const anchor = {
      ...rendered,
      content: skillSupplement ? `${content}\n\n${skillSupplement}` : content,
      details: { ...rendered.details, ...(skillSupplement ? { skillSupplement } : {}) },
    };
    runtime.control.expectedAnchor = anchor;
    const unscoped = selection.source === "user" && selection.rootUserEntryId
      ? { content: anchor.content, afterEntryId: selection.rootUserEntryId }
      : undefined;
    const positionallyScopedUnscoped = unscoped !== undefined && persisted?.details?.taskKey === undefined;
    if (!runtime.control.needsAnchorRefresh && sameAnchor(persisted, anchor, positionallyScopedUnscoped)) return;
    return {
      message: {
        customType: PRIME_CONTEXT_ANCHOR_TYPE,
        content: anchor.content,
        display: false,
        details: anchor.details,
      },
    };
  });
  hooks.add("before_agent_start");

  pi.on("agent_start", async (_event, ctx) => {
    if (runtime.mode === "off") return;
    runtime.lifecycle.agentRun += 1;
    runtime.lifecycle.turnIndex = 0;
    runtime.lifecycle.turnStartedAt = undefined;
    runtime.toolStartedAt.clear();
    runtime.exchanges.clearPending();
  });
  hooks.add("agent_start");

  pi.on("turn_start", async (event, ctx) => {
    if (runtime.mode === "off") return;
    runtime.lifecycle.turnIndex = event.turnIndex;
    runtime.lifecycle.turnStartedAt = Date.now();
    beginAuxiliaryTurn(runtime.auxiliary, String(event.turnIndex));
  });
  hooks.add("turn_start");

  pi.on("user_bash_end", async (event: UserBashEndPayload, ctx: ExtensionContext) => {
    if (runtime.mode === "off") return;
    runtime.sourceMessages.set(event.entryId, {
      role: "bashExecution",
      command: event.command,
      output: event.output,
      ...(event.exitCode === undefined ? {} : { exitCode: event.exitCode }),
      ...(event.cancelled === undefined ? {} : { cancelled: event.cancelled }),
      ...(event.fullOutputPath === undefined ? {} : { fullOutputPath: event.fullOutputPath }),
    });
    await installUserBashViews(ctx, event);
  });
  hooks.add("user_bash_end");

  pi.on("model_select", (event) => {
    if (runtime.mode === "off") return;
    const modelKey = `${event.model.provider}:${event.model.id}`;
    const previousKey = event.previousModel
      ? `${event.previousModel.provider}:${event.previousModel.id}`
      : runtime.lifecycle.selectedModelKey;
    runtime.lifecycle.selectedModelKey = modelKey;
    runtime.lifecycle.replayMetadataPagingEligible = previousKey !== undefined && previousKey !== modelKey;
    if (previousKey !== undefined && previousKey !== modelKey) advanceProjectionEpoch();
  });
  hooks.add("model_select");

  pi.on("session_before_compact", () => undefined);
  hooks.add("session_before_compact");

  pi.on("session_before_tree", () => undefined);
  hooks.add("session_before_tree");

  pi.on("session_compact", async (_event, ctx) => {
    clearControlState(true);
    runtime.exactRepeat = createExactRepeatHintState(runtime.taskSnapshot.taskKey, runtime.exactRepeat.contextEpoch + 1);
    runtime.recentAttempts = [];
    runtime.fixedViews.clear();
    reloadSelectedBranch(ctx, true);
    runtime.archive?.recordBranchRuntimeReload();
    const branch = ctx.sessionManager.getBranch() as BranchEntryLike[];
    const allowed = visibleFixedToolCallIds(branch);
    installFixedViews(await runtime.archive?.loadFixedExchangeViews(ctx.signal).catch(() => []) ?? [], true, allowed);
  });
  hooks.add("session_compact");

  pi.on("session_tree", async (_event, ctx) => {
    clearControlState(true);
    runtime.exactRepeat = createExactRepeatHintState(runtime.taskSnapshot.taskKey, runtime.exactRepeat.contextEpoch + 1);
    runtime.recentAttempts = [];
    runtime.fixedViews.clear();
    reloadSelectedBranch(ctx);
    runtime.archive?.recordBranchRuntimeReload();
    const branch = ctx.sessionManager.getBranch() as BranchEntryLike[];
    const allowed = visibleFixedToolCallIds(branch);
    installFixedViews(await runtime.archive?.loadFixedExchangeViews(ctx.signal).catch(() => []) ?? [], true, allowed);
  });
  hooks.add("session_tree");

  pi.on("tool_execution_start", (event) => {
    if (runtime.mode === "off") return;
    const exchange = runtime.exchanges.start(event);
    runtime.toolStartedAt.set(event.toolCallId, Date.now());
    exchange.replayOriginKey = runtime.lifecycle.selectedModelKey;
  });
  hooks.add("tool_execution_start");

  pi.on("tool_call", (event, ctx) => {
    if (runtime.mode === "off") return;
    const branch = ctx.sessionManager.getBranch() as BranchEntryLike[];
    runtime.branchAnchorId = branchAnchorId(branch);
    runtime.archive?.setBranchScope(
      runtime.taskSnapshot.taskKey === "session" ? undefined : runtime.taskSnapshot.taskKey,
      branchScopeIds(branch), [
      ...observationRefs(branch), ...runtime.taskSnapshot.pinnedObservationIds,
    ]);
    const toolSchema = pi.getAllTools?.().find((tool) => tool.name === event.toolName)?.parameters;
    runtime.exchanges.noteCall(event, ctx.cwd, toolSchema);
  });
  hooks.add("tool_call");

  pi.on("tool_result", async (event, ctx) => {
    if (runtime.mode === "off") return;
    const startedAt = runtime.toolStartedAt.get(event.toolCallId);
    runtime.toolStartedAt.delete(event.toolCallId);
    if (startedAt !== undefined) {
      const latency = Math.max(0, Date.now() - startedAt);
      runtime.auxiliary.economics.recentMeanToolLatencyMs = rollingMean(
        runtime.auxiliary.economics.recentMeanToolLatencyMs,
        latency,
      );
    }
    try {
      const content = event.content as (TextContent | ImageContent)[];
      const archiveResult = shouldArchiveToolResult(event.toolName);
      const fullOutputPath = isBashToolResult(event) ? event.details?.fullOutputPath : undefined;
      let frozenResultPath: string | undefined;
      if (archiveResult && runtime.archive && typeof fullOutputPath === "string") {
        try {
          frozenResultPath = await runtime.archive.freezeTextSource(fullOutputPath, ctx.signal);
        } catch {
          ctx.signal?.throwIfAborted();
        }
      }
      // Freeze mutable complete output here. Interpretation is deferred until the
      // host supplies the canonical finalized exchange at turn_end.
      const visibleResult = visibleToolResultText(content, 1024 * 1024);
      const exchange = runtime.exchanges.noteResult(
        event,
        ctx.cwd,
        visibleResult.text,
        {
          retainResultText: false,
          visibleResultText: visibleResult.text,
          visibleResultBytes: visibleResult.textBytes,
          visibleResultTruncated: visibleResult.truncated,
          visibleResultTail: visibleResult.tail,
          visibleResultSamples: visibleResult.samples,
          large: visibleResult.truncated,
        },
      );
      exchange.frozenResultPath = frozenResultPath;
      exchange.frozenVisibleResultSource = visiblePartSource(content);
      // Admission is intentionally deferred to turn_end, where all completed
      // exchanges are reduced in assistant source order rather than completion order.
    } catch {
      return;
    }
  });
  hooks.add("tool_result");

  pi.on("turn_end", async (event, ctx) => {
    if (runtime.mode === "off") return;

    // The submitted user message is committed by this point. Commit its real entry ID,
    // never the before_agent_start preview, before reducing the turn.
    const fullBranch = ctx.sessionManager.getBranch() as BranchEntryLike[];
    const providerBranch = providerVisibleBranchEntries(fullBranch);
    const goal = activeGoalFromBranch(fullBranch);
    const branch = scopeBranchToGoal(fullBranch, goal);
    const selection = refreshTaskSelection(branch, goal);
    if (selection) {
      const loadedTask = loadLatestTaskSnapshotV2(fullBranch, selection.taskKey);
      if (loadedTask) runtime.taskSnapshot = loadedTask;
      else if (runtime.taskSnapshot.taskKey !== selection.taskKey) {
        runtime.taskSnapshot = createTaskSnapshotV2(
          selection.taskKey,
          runtime.taskSnapshot.objective ?? selection.objective,
          selection.rootUserEntryId,
        );
      }
    }
    runtime.control.expectedAnchor = currentTaskAnchor(
      branch,
      selection,
      latestBranchUserText(providerBranch),
    );
    const contextUsage = ctx.getContextUsage();
    if (!Array.isArray(event.exchanges)) {
      throw new Error(
        `Prime Context requires patched prime-agent@0.9.1 finalized exchanges. Run: prime-context-patch-agent "$(npm root -g)/prime-agent"`,
      );
    }
    const taskSnapshotBefore = structuredClone(runtime.taskSnapshot);
    const toolSchemas = new Map(
      (pi.getAllTools?.() ?? []).map((tool) => [tool.name, tool.parameters] as const),
    );
    for (const source of runtime.exchanges.pendingFullOutputSources()) {
      try {
        const resolved = await resolveArchiveText([], source.path, ctx.signal);
        runtime.exchanges.noteResolvedFullOutput(source.toolCallId, resolved);
      } catch {
        ctx.signal?.throwIfAborted();
      }
    }
    const exchangeFacts = buildExchangeFacts({
      exchanges: event.exchanges,
      executionMode: event.toolExecution,
      pendingFullOutputs: runtime.exchanges.pendingFullOutputCaptures(),
      cwd: ctx.cwd,
      toolSchemas,
    });
    let exactRepeatHint: string | undefined;
    if (runtime.exactRepeat.taskKey !== runtime.taskSnapshot.taskKey) runtime.recentAttempts = [];
    for (const facts of exchangeFacts) {
      const observed = observeExactRepeatHint(runtime.exactRepeat, facts, {
        taskKey: runtime.taskSnapshot.taskKey,
        contextEpoch: runtime.exactRepeat.contextEpoch,
      });
      runtime.exactRepeat = observed.state;
      if (observed.hint) exactRepeatHint = observed.hint;
      runtime.recentAttempts.push({
        action: boundedStallAction(facts),
        decisiveObservation: decisiveStallObservation(facts),
      });
      runtime.recentAttempts = runtime.recentAttempts.slice(-4);
    }
    const stallSignature = hasStrongExactRepeat(runtime.exactRepeat)
      ? "repeat-after-hint"
      : detectStallSignature(runtime.recentAttempts);
    const nextTaskSnapshot = applyProgressEffects(runtime.taskSnapshot, exchangeFacts);
    const taskUpdate = renderPrimeContextUpdate(taskSnapshotBefore, nextTaskSnapshot);

    const finalizedById = new Map(event.exchanges.map((exchange) => [exchange.toolCallId, exchange]));
    const factsById = new Map(exchangeFacts.map((facts) => [facts.toolCallId, facts]));
    const exchanges = runtime.exchanges.finishTurn(
      event.message,
      event.exchanges.map((exchange) => exchange.result),
      event.exchanges,
    );
    for (const exchange of exchanges) {
      const canonicalFacts = factsById.get(exchange.toolCallId);
      if (canonicalFacts) runtime.exchanges.noteCanonicalFacts(exchange, canonicalFacts);
      const finalized = finalizedById.get(exchange.toolCallId);
      if (finalized) {
        exchange.sourceOrder = finalized.sourceOrder;
        exchange.modelInput = finalized.originalInput && typeof finalized.originalInput === "object"
          ? structuredClone(finalized.originalInput) as Record<string, unknown>
          : {};
        exchange.executedInput = finalized.executedInput && typeof finalized.executedInput === "object"
          ? structuredClone(finalized.executedInput) as Record<string, unknown>
          : undefined;
        exchange.rawResult = finalized.result;
      }
      if (!exchange.rawResult) continue;
      const finalEvent = {
        ...exchange.rawResult,
        toolName: exchange.rawResult.toolName ?? exchange.toolName,
        content: Array.isArray(exchange.rawResult.content) ? exchange.rawResult.content : [],
        isError: exchange.rawResult.isError ?? exchange.outcome?.isError ?? false,
      } as unknown as ToolResultEvent;
      const finalContent = finalEvent.content as (TextContent | ImageContent)[];
      const finalTypedParts = typedObservationParts(finalEvent);
      if (exchange.archiveParts && !typedObservationPartsEqual(exchange.archiveParts, finalTypedParts)) {
        exchange.persistedResultChanged = true;
      }
      exchange.archiveParts = finalTypedParts;
      const finalPath = resultFullOutputPath(exchange.rawResult.details);
      const finalVisibleSource = visiblePartSource(finalContent);
      if (exchange.frozenVisibleResultSource &&
        !await partSourcesEqual(exchange.frozenVisibleResultSource, finalVisibleSource, ctx.signal)) {
        exchange.persistedTextChanged = true;
        exchange.persistedResultChanged = true;
        exchange.persistedCanonicalResultChanged = true;
      }
      if (!shouldArchiveToolResult(exchange.toolName)) continue;
      if (!exchange.persistedCanonicalResultChanged && exchange.resultSummary) {
        const canonicalPart: ObservationPartInput = {
          name: "result",
          kind: "result",
          mediaType: "text/plain; charset=utf-8",
          source: exchange.resultSummary.partSource ?? { kind: "text", text: exchange.resultSummary.text },
        };
        const facts = factsById.get(exchange.toolCallId);
        if (facts) runtime.exchanges.noteCanonicalResult(
          exchange,
          exchange.resultSummary,
          [canonicalPart, ...finalTypedParts],
          facts,
        );
        continue;
      }
      let canonicalFrozenPath: string | undefined;
      if (!exchange.persistedTextChanged && finalPath && runtime.archive) {
        try {
          canonicalFrozenPath = await runtime.archive.freezeTextSource(finalPath, ctx.signal);
        } catch {
          ctx.signal?.throwIfAborted();
        }
      }
      const authoritativeSource: StreamPartSource = canonicalFrozenPath
        ? { kind: "path", path: canonicalFrozenPath }
        : finalVisibleSource;
      const previousSource: StreamPartSource | undefined = exchange.resultSummary?.partSource ??
        (exchange.resultSummary ? { kind: "text", text: exchange.resultSummary.text } : undefined);
      const exactUnchanged = !exchange.persistedTextChanged && !exchange.persistedPathChanged && previousSource
        ? await partSourcesEqual(previousSource, authoritativeSource, ctx.signal)
        : false;
      let resolved: ResolvedArchiveText;
      if (exactUnchanged && exchange.resultSummary) {
        resolved = exchange.resultSummary;
        if (canonicalFrozenPath) {
          await runtime.archive?.removeFrozenTextSource(canonicalFrozenPath).catch(() => undefined);
          canonicalFrozenPath = undefined;
        }
      } else {
        resolved = await resolvedPartSource(authoritativeSource, ctx.signal);
        exchange.persistedTextChanged ||= !exactUnchanged;
        if (canonicalFrozenPath) {
          if (exchange.frozenResultPath && exchange.frozenResultPath !== canonicalFrozenPath) {
            await runtime.archive?.removeFrozenTextSource(exchange.frozenResultPath).catch(() => undefined);
          }
          exchange.frozenResultPath = canonicalFrozenPath;
        }
      }
      const canonicalPart: ObservationPartInput = {
        name: "result",
        kind: "result",
        mediaType: "text/plain; charset=utf-8",
        source: resolved.partSource ?? { kind: "text", text: resolved.text },
      };
      const facts = factsById.get(exchange.toolCallId);
      if (facts) runtime.exchanges.noteCanonicalResult(
        exchange,
        resolved,
        [canonicalPart, ...finalTypedParts],
        facts,
      );
    }


    if (event.toolExecution !== "parallel" && event.toolExecution !== "sequential") {
      throw new Error("Prime Context requires Prime Agent turn_end.toolExecution support.");
    }
    const completedArchives = exchanges.flatMap((exchange) => {
      if (!shouldCommitExchangeArchive(exchange, runtime.config.capsuleMaxBytes)) return [];
      const metadata = runtime.exchanges.toObservationMetadata(exchange, {
        ...(runtime.taskSnapshot.taskKey === "session" ? {} : { taskKey: runtime.taskSnapshot.taskKey }),
        branchAnchorId: runtime.branchAnchorId,
      });
      return metadata ? [{
        metadata,
        toolName: exchange.toolName,
        isError: exchange.outcome?.isError ?? false,
        source: exchange.archiveSource,
        parts: exchange.archiveParts,
        resultText: exchange.resultText,
        largeResult: exchange.largeResult,
        resultSummary: exchange.resultSummary,
        admittedCapsule: exchange.admittedCapsule,
        sourceOrder: exchange.sourceOrder,
        replayProtected: exchange.replayProtected,
        replayOriginKey: exchange.replayProtected ? exchange.replayOriginKey ?? "unknown" : undefined,
        ...(exchange.persistedCall ? {
          persistedModelInput: exchange.modelInput,
          persistedRawCall: exchange.rawCall,
          persistedRawResult: exchange.rawResult,
          resultChangedAfterHook: exchange.persistedResultChanged,
          canonicalResultChangedAfterHook: exchange.persistedCanonicalResultChanged,
        } : {}),
      }] : [];
    });


    let turnHint: string | undefined;
    if (exactRepeatHint) {
      turnHint = EXACT_REPEAT_HINT;
    } else if (stallSignature) {
      turnHint = await runStallRecovery(ctx).catch(() => undefined) ?? EXACT_REPEAT_HINT;
    } else {
      await distillLargestExchange(exchangeFacts, completedArchives, contextUsage, ctx).catch(() => false);
    }

    const controlMessages: ContextMessageLike[] = [];
    if (runtime.control.needsAnchorRefresh && runtime.control.expectedAnchor) {
      controlMessages.push(persistentControlMessage(PRIME_CONTEXT_ANCHOR_TYPE, runtime.control.expectedAnchor));
    }

    if (turnHint) {
      controlMessages.push({
        role: "custom",
        customType: "prime-context.hint",
        content: turnHint,
        display: false,
        details: { schema: "prime-context.hint/v1", taskKey: runtime.taskSnapshot.taskKey },
        timestamp: Date.now(),
      });
    }

    let archiveCommitted = true;
    if (runtime.archive && completedArchives.length > 0) {
      try {
        const installedViews = await runtime.archive.finalizeExchanges(completedArchives, ctx.signal, {
          budgetBytes: fixedExchangeBudgetBytes(contextUsage),
          capsuleMaxBytes: runtime.config.capsuleMaxBytes,
          archiveAdmissionBytes: runtime.config.minTextBytes,
          contextEpoch: runtime.projectionEpoch + 1,
        });
        for (const view of installedViews) {
          const images = view.images ?? [];
          if (images.length > 0) setPendingImages(runtime, view.toolCallId, images);
          else clearPendingImages(runtime, view.toolCallId);
        }
        installFixedViews(installedViews);
      } catch {
        archiveCommitted = false;
        // Raw session messages remain the provider view when batch finalization fails.
      }
    }

    if (taskUpdate && archiveCommitted) {
      runtime.taskSnapshot = nextTaskSnapshot;
      pi.appendEntry(SNAPSHOT_ENTRY_TYPE, runtime.taskSnapshot);
      const taskMessage: ContextMessageLike = {
        role: "custom",
        customType: PRIME_CONTEXT_UPDATE_TYPE,
        content: taskUpdate,
        display: false,
        details: { schema: "prime-context.task-update/v1", taskKey: runtime.taskSnapshot.taskKey },
        timestamp: Date.now(),
      };
      const anchorOffset = runtime.control.needsAnchorRefresh && runtime.control.expectedAnchor ? 1 : 0;
      controlMessages.splice(anchorOffset, 0, taskMessage);
      }

    if (runtime.archive) {
      for (const exchange of exchanges) {
        if (!exchange.frozenResultPath) continue;
        await runtime.archive.removeFrozenTextSource(exchange.frozenResultPath).catch(() => undefined);
        exchange.frozenResultPath = undefined;
      }
    }

    return controlMessages.length > 0 ? { messages: controlMessages } : undefined;
  });

  hooks.add("turn_end");

  pi.on("model_context", (event: {
    purpose: ContextPurpose;
    messages: ContextMessageLike[];
    entryRefs?: ContextEntryRef[];
  }, ctx: ExtensionContext) => {
    if (runtime.mode === "off") return;
    const purpose = event.purpose as ContextPurpose;
    const refs = event.entryRefs as ContextEntryRef[] | undefined;
    const toolSetRevision = activeToolSetRevision(pi);
    if (runtime.projectionToolSetRevision === undefined) {
      runtime.projectionToolSetRevision = toolSetRevision;
    } else if (runtime.projectionToolSetRevision !== toolSetRevision) {
      runtime.projectionToolSetRevision = toolSetRevision;
      advanceProjectionEpoch();
    }
    if (refs !== undefined) {
      const missingSourceIds = new Set(refs
        .map((ref) => ref.entryId)
        .filter((entryId) => !runtime.sourceMessages.has(entryId)));
      if (missingSourceIds.size > 0) {
        const branch = ctx.sessionManager.getBranch() as BranchEntryLike[];
        for (let index = branch.length - 1; index >= 0 && missingSourceIds.size > 0; index -= 1) {
          for (const candidate of branchProjectionEntries([branch[index]])) {
            if (!missingSourceIds.delete(candidate.entryId)) continue;
            runtime.sourceMessages.set(candidate.entryId, candidate.message);
          }
        }
      }
    }
    const projectionInput = {
      purpose,
      messages: event.messages as unknown as ContextMessageLike[],
      entryRefs: refs,
      fixedViews: runtime.fixedViews,
      sourceMessages: refs === undefined ? undefined : (() => {
        const sourceMessages = new Map(runtime.sourceMessages);
        for (const ref of refs) {
          const message = event.messages[ref.messageIndex];
          if (message && !sourceMessages.has(ref.entryId)) sourceMessages.set(ref.entryId, message);
        }
        return sourceMessages;
      })(),
      pendingImages: runtime.pendingImages,
      activeModelKey: runtime.lifecycle.selectedModelKey,
      contextEpoch: runtime.projectionEpoch,
    };
    const projected = purpose === "provider" || purpose === "budget"
      ? buildProviderRepresentation({
          ...projectionInput,
          purpose,
          epochId: runtime.projectionEpoch,
          modelKey: runtime.lifecycle.selectedModelKey ?? "unselected",
          toolSetRevision,
          cache: runtime.projectionCache,
        })
      : projectModelContext(projectionInput);
    const messages = projected.messages;
    const messagesChanged = messages !== event.messages;
    const refsChanged = projected.entryRefs !== undefined && (
      refs === undefined || projected.entryRefs.length !== refs.length ||
      projected.entryRefs.some((ref, index) => ref.messageIndex !== refs[index]?.messageIndex || ref.entryId !== refs[index]?.entryId)
    );
    if (!messagesChanged && !refsChanged && projected.projectionIdentity === undefined) return;
    return {
      ...(messagesChanged ? { messages: messages as typeof event.messages } : {}),
      ...(projected.entryRefs === undefined || !refsChanged ? {} : { entryRefs: projected.entryRefs }),
      ...(projected.projectionIdentity === undefined ? {} : {
        projectionIdentity: projected.projectionIdentity,
      }),
    };
  });
  hooks.add("model_context");

  pi.on("message_end", (event) => {
    if (runtime.mode === "off") return;
    const message = record(event.message);
    if (message?.role !== "assistant") return;
    const usage = record(message.usage);
    if (!usage) return;
    const input = [usage.input, usage.cacheRead, usage.cacheWrite]
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      .reduce((total, value) => total + Math.max(0, value), 0);
    if (input > 0) runtime.auxiliary.economics.latestProviderInputTokens = input;
    if (typeof usage.output === "number" && Number.isFinite(usage.output) && usage.output >= 0) {
      runtime.auxiliary.economics.conservativeMainOutputTokens = Math.max(512, rollingMean(
        runtime.auxiliary.economics.conservativeMainOutputTokens,
        usage.output,
      ));
    }
    const totalCost = record(usage.cost)?.total;
    if (typeof totalCost === "number" && Number.isFinite(totalCost) && totalCost >= 0) {
      runtime.auxiliary.economics.recentMeanSolverCallCost = rollingMean(
        runtime.auxiliary.economics.recentMeanSolverCallCost,
        totalCost,
      );
    }
    if (runtime.lifecycle.turnStartedAt !== undefined) {
      runtime.auxiliary.economics.recentMeanSolverLatencyMs = rollingMean(
        runtime.auxiliary.economics.recentMeanSolverLatencyMs,
        Math.max(0, Date.now() - runtime.lifecycle.turnStartedAt),
      );
      runtime.lifecycle.turnStartedAt = undefined;
    }
  });
  hooks.add("message_end");

  const actions: PrimeContextActions = {
    getMode: () => runtime.mode,
    setMode: (mode) => {
      if (runtime.mode !== mode) advanceProjectionEpoch();
      runtime.mode = mode;
      setAutomaticRefinementEnabled?.(mode === "on" ? false : undefined);
    },
    getArchive: () => runtime.archive,
    getSnapshot: () => runtime.taskSnapshot,
    updateSnapshot: (changes: SnapshotChanges): SnapshotUpdateResult => {
      const result = applySnapshotChanges(runtime.taskSnapshot, changes);
      if (result.ok && result.changed) {
        runtime.taskSnapshot = result.snapshot;
        pi.appendEntry(SNAPSHOT_ENTRY_TYPE, result.snapshot);
      }
      return result;
    },
    getReadMaxBytes: () => runtime.config.readMaxBytes,
    consumeConfigWarnings: () => runtime.configWarnings.splice(0),
    hooksLoaded: () => requiredHooksLoaded(hooks),
    clearFixedViews: () => {
      if (runtime.fixedViews.size > 0) advanceProjectionEpoch();
      runtime.fixedViews.clear();
    },
    resolveRecallSources: async (scope: RecallScope, signal?: AbortSignal) => {
      signal?.throwIfAborted();
      const recall = runtime.sessionRecall;
      if (scope === "parent") return recall?.parent ? [recall.parent] : [];
      if (scope !== "project" || !recall?.projectSessionDir) return [];
      const infos = await SessionManager.list(recall.normalizedCwd, recall.projectSessionDir);
      signal?.throwIfAborted();
      return infos.flatMap((info) => {
        if (info.id === recall.currentSessionId || cwdKey(info.cwd) !== recall.cwdKey) return [];
        return [{
          archive: new ObservationArchive(recall.archiveRoot, info.id),
          scope: "project" as const,
          sessionId: info.id,
          sessionDate: info.created.toISOString(),
        }];
      });
    },
  };

  const compileKnowledge = async (
    request: LearnCommandRequest,
    ctx: ExtensionContext,
    automatic: boolean,
    automaticOutcome: TaskOutcome = "unknown",
  ): Promise<string> => {
      if (runtime.mode === "off") throw new Error("Prime Context is disabled.");
      if (!ctx.model || !ctx.modelRegistry) throw new Error("No registered model is available for learning.");
      const messagesFromEntries = (entries: readonly BranchEntryLike[]): AgentMessage[] => entries.flatMap((entry) => {
        if (entry.type !== "message") return [];
        const role = record(entry.message)?.role;
        return role === "user" || role === "assistant" || role === "toolResult"
          ? [entry.message as AgentMessage]
          : [];
      });
      const topic = request.topic;
      const episodes = [];
      if (request.from.length === 0) {
        const fullBranch = ctx.sessionManager.getBranch() as BranchEntryLike[];
        const branch = scopeBranchToGoal(fullBranch, activeGoalFromBranch(fullBranch));
        const messages = messagesFromEntries(branch);
        if (messages.length === 0) throw new Error("The current selected branch has no learning episode.");
        episodes.push({ task: topic, taskOutcome: automatic ? automaticOutcome : "unknown", messages });
      } else {
        for (const source of [...new Set(request.from)]) {
          const sessionFile = resolve(ctx.cwd, source);
          const info = await stat(sessionFile);
          if (!info.isFile() || info.size > 16 * 1024 * 1024) {
            throw new Error(`Learning session file must be a regular file of at most 16 MiB: ${source}`);
          }
          const entries = (await readFile(sessionFile, "utf8")).split(/\r?\n/u).flatMap((line) => {
            if (!line.trim()) return [];
            try {
              const value = JSON.parse(line) as BranchEntryLike;
              return value && typeof value === "object" ? [value] : [];
            } catch {
              throw new Error(`Invalid JSONL session file: ${source}`);
            }
          });
          const messages = messagesFromEntries(entries);
          if (messages.length === 0) throw new Error(`Session file has no learning episode: ${source}`);
          const task = entries.flatMap((entry) => entry.type === "message" && record(entry.message)?.role === "user"
            ? [messageText(record(entry.message)?.content)]
            : []).find(Boolean) ?? topic;
          episodes.push({ task, taskOutcome: "unknown" as const, messages });
        }
      }
      const hooks = createModelResolutionHooks({
        currentModel: () => ctx.model,
        modelRegistry: ctx.modelRegistry,
      });
      const resolved = await resolveAuxiliaryModel("knowledge-compile", runtime.config, hooks);
      if (!resolved) throw new Error("The configured learning model could not be resolved or authenticated.");
      const complete = async (call: KnowledgeCompilerCall) => {
        if (automatic) {
          const prompt = {
            kind: "knowledge-compile" as const,
            systemPrompt: call.systemPrompt,
            userPrompt: call.prompt,
            context: {
              systemPrompt: call.systemPrompt,
              messages: [{ role: "user" as const, content: call.prompt, timestamp: Date.now() }],
            },
            maxOutputTokens: call.maxOutputTokens,
            estimatedInputTokens: Math.ceil(utf8Bytes(`${call.systemPrompt}\n${call.prompt}`) / 4),
          };
          runtime.auxiliary.economics.currentMainInputUnitCost = ctx.model?.cost.input;
          runtime.auxiliary.economics.currentMainOutputUnitCost = ctx.model?.cost.output;
          runtime.auxiliary.economics.latestProviderInputTokens = ctx.getContextUsage?.()?.totalTokens;
          const execution = await executeTrackedAuxiliary({
            runtime: runtime.auxiliary,
            prompt,
            auth: resolved,
            signal: call.signal ?? ctx.signal,
            plan: {
              kind: "knowledge-compile",
              model: resolved.model,
              blocking: false,
              estimatedInputTokens: prompt.estimatedInputTokens,
              maxOutputTokens: prompt.maxOutputTokens,
              estimatedPromptTokensSaved: 4_000,
              estimatedMainTurnsAvoided: 0.5,
              estimatedToolCallsAvoided: 0,
              completionRisk: "low",
              estimatedCriticalPathMsSaved: 0,
              estimatedAuxiliaryLatencyMs: 2_000,
            },
            parseOutput: (text) => text,
          });
          if (execution.status !== "success" || !execution.output) throw new Error(execution.reason);
          return {
            text: execution.output,
            provider: resolved.model.provider,
            model: resolved.model.id,
            inputTokens: execution.usage?.input,
            outputTokens: execution.usage?.output,
            cost: execution.usage?.cost,
          };
        }
        const message = await completeSimple(resolved.model, {
          systemPrompt: call.systemPrompt,
          messages: [{ role: "user", content: call.prompt, timestamp: Date.now() }],
        }, {
          apiKey: resolved.apiKey,
          headers: resolved.headers,
          maxTokens: call.maxOutputTokens,
          reasoning: "off",
          signal: call.signal ?? ctx.signal,
          timeoutMs: 60_000,
          maxRetries: 0,
        });
        if (message.stopReason === "error" || message.stopReason === "aborted") {
          throw new Error(message.errorMessage ?? `Learning completion ${message.stopReason}.`);
        }
        return {
          text: message.content.flatMap((block) => block.type === "text" ? [block.text] : []).join("\n").trim(),
          provider: message.provider,
          model: message.model,
          inputTokens: message.usage.input,
          outputTokens: message.usage.output,
          cost: message.usage.cost.total,
        };
      };
      const result = await runKnowledgeCompiler({
        topic,
        episodes,
        library: runtime.skillLibrary,
        automatic,
      }, {
        libraryPath: resolveSkillLibraryPath(ctx.cwd, runtime.config.libraryPath),
        complete,
        signal: ctx.signal,
      });
      return result.message;
  };

  pi.on("agent_end", (event, ctx) => {
    if (runtime.mode === "off" || runtime.config.autoLearn !== "utility-gated" ||
        runtime.autoLearnInFlight || !ctx.model || !ctx.modelRegistry) return;
    const finalAssistant = [...event.messages].reverse().find((message) => message.role === "assistant");
    if (!finalAssistant || finalAssistant.content.some((block) => block.type === "toolCall")) return;
    const observations = runtime.taskSnapshot.actionableObservations;
    const branch = ctx.sessionManager.getBranch() as BranchEntryLike[];
    const selectedSkill = branch.some((entry) => {
      const details = record(entry.details);
      return entry.type === "custom_message" && entry.customType === PRIME_CONTEXT_ANCHOR_TYPE &&
        details?.taskKey === runtime.taskSnapshot.taskKey && typeof details.skillSupplement === "string";
    });
    const hasFailure = observations.some((observation) => /\b(?:fail(?:ed|ure)?|error)\b/iu.test(observation.text));
    const latestUser = [...branch].reverse().find((entry) =>
      entry.type === "message" && record(entry.message)?.role === "user"
    );
    const userFeedback = messageText(record(latestUser?.message)?.content);
    const taskOutcome = explicitUserTaskOutcome(userFeedback);
    if (taskOutcome === "unknown") return;
    const explicitCorrection = /\b(?:instead|general rule|procedure|always|never)\b/iu.test(userFeedback);
    if (!(explicitCorrection || (selectedSkill && hasFailure && taskOutcome === "success"))) return;
    const taskKey = runtime.taskSnapshot.taskKey;
    if (runtime.autoLearnedTaskKeys.has(taskKey)) return;
    runtime.autoLearnedTaskKeys.add(taskKey);
    runtime.autoLearnInFlight = true;
    void compileKnowledge({
      topic: runtime.taskSnapshot.objective ?? runtime.taskSnapshot.focus ?? "current task procedure",
      from: [],
    }, ctx, true, taskOutcome).catch(() => undefined).finally(() => {
      runtime.autoLearnInFlight = false;
    });
  });
  hooks.add("agent_end");

  pi.on("session_shutdown", () => {
    finalizeAuxiliaryTask(runtime.auxiliary);
    persistBenchmarkAccounting();
    runtime.autoLearnInFlight = false;
    setAutomaticRefinementEnabled?.(undefined);
  });
  hooks.add("session_shutdown");

  registerPrimeContextTool(pi, actions);
  registerPrimeContextCommands(pi, actions, {
    learn: (request, ctx) => compileKnowledge(request, ctx, false),
  });
}
