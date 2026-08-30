import { open as openFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { adaptiveMinTextBytes, utf8Bytes } from "./capsule.js";
import {
  isBashToolResult,
  isEditToolResult,
  isIpythonToolResult,
  SessionManager,
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
import { registerPrimeContextCommands } from "./commands.js";
import { boundedResultTextStats, ExchangeTracker } from "./exchange.js";
import { adaptToolIntent, classifyValidationCommand, collectFactualOutcome, jsonBytes, type SuiteIdentity } from "./intent.js";
import {
  appendProviderTextMessage,
  deterministicFastSummary,
  fixedExchangeBudgetBytes,
  projectFoldCandidateMessages,
  projectModelContext,
  selectFoldGeneration,
  type ContextEntryRef,
  type ContextPurpose,
  type FixedExchangeView,
  type FoldCandidateEntry,
  type ProjectedImageRef,
  type RecoveryProjectionLease,
} from "./projection.js";
import {
  createTaskRuntime,
  deriveTaskSelection,
  explicitSteeringPaths,
  previewTaskContract,
  updateTaskContract,
  type AcceptanceGateClassifier,
  type ActiveGoalSelection,
  type SteeringEntry,
  type TaskRuntimeV2,
  type TaskSelection,
} from "./runtime.js";
import { deriveReadiness, reduceTurn, type WorkflowReadiness } from "./workflow.js";
import {
  persistentControlMessage,
  renderPrimeContextAnchor,
  renderPrimeContextFold,
  renderPrimeContextState,
  taskAnchorHasDurableState,
  type ContextMessageLike,
  type RenderedTaskAnchor,
  type TaskAnchorInput,
} from "./context.js";
import {
  DEFAULT_CONFIG,
  PRIME_CONTEXT_ANCHOR_TYPE,
  PRIME_CONTEXT_FOLD_TYPE,
  PRIME_CONTEXT_STATE_TYPE,
  RUNTIME_STATE_ENTRY_TYPE,
  SNAPSHOT_ENTRY_TYPE,
  applySnapshotChanges,
  emptySnapshot,
  latestProviderVisibleControlMessage,
  loadLatestRuntime,
  loadLatestSnapshot,
  loadPrimeContextConfig,
  providerVisibleBranchEntries,
  storageRoot,
  type BranchEntryLike,
  type PrimeContextMode,
  type ResolvedPrimeContextConfig,
  type SnapshotChanges,
  type SnapshotUpdateResult,
  type TaskSnapshotV1,
} from "./state.js";
import { appendPrimeContextGlobalPolicy } from "./policy.js";
import { registerPrimeContextTool, type PrimeContextActions } from "./tool.js";

interface RecallSessionHeader {
  id: string;
  timestamp: string;
  cwd: string;
  parentSession?: string;
  rlmDepth?: number;
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

const RECOVERY_LEASE_MAX_BYTES = 12 * 1024 * 1024;
const RECOVERY_LEASE_TOTAL_BYTES = 24 * 1024 * 1024;

function recoveryLeaseBytes(content: readonly Record<string, unknown>[]): number {
  return content.reduce((total, block) => total + (
    block.type === "text" && typeof block.text === "string"
      ? Buffer.byteLength(block.text, "utf8")
      : block.type === "image" && typeof block.data === "string"
        ? Buffer.byteLength(block.data, "utf8")
        : 0
  ), 0);
}

interface RuntimeState {
  mode: PrimeContextMode;
  config: ResolvedPrimeContextConfig;
  configWarnings: string[];
  archive?: ObservationArchive;
  snapshot: TaskSnapshotV1;
  taskRuntime?: TaskRuntimeV2;
  readiness: WorkflowReadiness;
  branchAnchorId?: string;
  exchanges: ExchangeTracker;
  fixedViews: Map<string, FixedExchangeView>;
  projectedRefs: WeakMap<object, string>;
  recoveryLeases: Map<string, RecoveryProjectionLease>;
  recoveryUtilities: Map<string, {
    subjectKeys: readonly string[];
    exposedBytes: number;
    inspectRecallHit: boolean;
    useful: boolean;
  }>;
  pendingImages: Map<string, readonly ProjectedImageRef[]>;
  consumedImageRefs: Set<string>;
  projectedRecoveryToolCallIds: Set<string>;
  projectedImageRefs: Set<string>;
  lastProviderProjection?: {
    entryCount: number;
    lastEntryId?: string;
    foldGeneration: number;
  };
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
    lastStateContent?: string;
    structuralBoundary: boolean;
    needsAnchorRefresh: boolean;
  };
  lifecycle: {
    agentRun: number;
    turnIndex?: number;
    selectedModelKey?: string;
    replayMetadataPagingEligible: boolean;
  };
}

export const REQUIRED_HOOKS = new Set([
  "session_start",
  "session_compact",
  "session_tree",
  "before_agent_start",
  "agent_start",
  "turn_start",
  "model_select",
  "tool_execution_start",
  "tool_call",
  "tool_result",
  "turn_end",
  "model_context",
  "message_end",
  "session_before_compact",
  "session_before_tree",
]);

const PENDING_IMAGE_RESULT_MAX = 64;
const PENDING_IMAGE_PER_RESULT_MAX = 4096;
const CONSUMED_IMAGE_REF_MAX = PENDING_IMAGE_RESULT_MAX * PENDING_IMAGE_PER_RESULT_MAX;

function clearPendingImages(runtime: RuntimeState, toolCallId: string): void {
  const previous = runtime.pendingImages.get(toolCallId) ?? [];
  runtime.pendingImages.delete(toolCallId);
  for (const image of previous) runtime.consumedImageRefs.delete(image.ref);
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
    const result = textPart("result-value", "result", event.details?.result);
    const traceback = textPart("traceback", "traceback", event.details?.error?.traceback.join("\n"));
    if (stdout) parts.push(stdout);
    if (stderr) parts.push(stderr);
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

function branchUserEntries(branch: readonly BranchEntryLike[], selection: TaskSelection): SteeringEntry[] {
  const entries: SteeringEntry[] = [];
  let selected = selection.source === "goal";
  for (let index = 0; index < branch.length; index += 1) {
    const entry = branch[index];
    const message = record(entry.message);
    if (entry.type !== "message" || message?.role !== "user") continue;
    const id = entry.id ?? `user:${index}`;
    if (!selected && id === selection.rootUserEntryId) selected = true;
    if (!selected) continue;
    const text = messageText(message.content);
    if (text.trim()) entries.push({ id, text });
  }
  return entries;
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
    if (entry.type === "custom_message" && entry.customType === PRIME_CONTEXT_FOLD_TYPE) return [entry.content];
    return [];
  }));
}

function latestCompactionObservationRefs(branch: readonly BranchEntryLike[]): string[] {
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    if (branch[index].type === "compaction") return observationRefsFromValues([branch[index].summary]);
  }
  return [];
}

export function branchProjectionEntries(branch: readonly BranchEntryLike[]): FoldCandidateEntry[] {
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

function branchSourceMessages(branch: readonly BranchEntryLike[]): Map<string, ContextMessageLike> {
  return new Map(branchProjectionEntries(branch).map((entry) => [entry.entryId, entry.message]));
}

interface FoldApplication {
  prefixEntryIds: ReadonlySet<string>;
  foldMessageEntryId: string;
}

function resolveFoldApplication(
  branch: readonly BranchEntryLike[],
  fold: TaskRuntimeV2["fold"],
  taskKey?: string,
): FoldApplication | undefined {
  if (!fold) return undefined;
  const allEntryIds = branch.flatMap((entry) => entry.id ? [entry.id] : []);
  if (allEntryIds.length !== branch.length || new Set(allEntryIds).size !== allEntryIds.length) {
    return undefined;
  }
  const cutoffMatches = branch.flatMap((entry, index) => entry.id === fold.throughEntryId ? [index] : []);
  if (cutoffMatches.length !== 1) return undefined;
  const cutoff = cutoffMatches[0];
  const prefix = branch.slice(0, cutoff + 1);
  if (prefix.some((entry) => !entry.id)) return undefined;
  const prefixEntryIds = new Set(prefix.map((entry) => entry.id as string));
  if (prefixEntryIds.size !== prefix.length ||
    new Set(fold.retainedEntryIds).size !== fold.retainedEntryIds.length ||
    fold.retainedEntryIds.some((id) => !prefixEntryIds.has(id))) {
    return undefined;
  }
  const matches = branch.flatMap((entry, index) => {
    if (!entry.id) return [];
    const raw = entry.type === "custom_message"
      ? { customType: entry.customType, content: entry.content, details: entry.details }
      : record(entry.message);
    const details = record(raw?.details);
    return raw?.customType === PRIME_CONTEXT_FOLD_TYPE && raw.content === fold.renderedMessage &&
      details?.taskKey === taskKey && details?.generation === fold.generation &&
      details?.throughEntryId === fold.throughEntryId
      ? [{ entryId: entry.id, index }]
      : [];
  });
  if (matches.length !== 1 || matches[0].index <= cutoff) return undefined;
  return { prefixEntryIds, foldMessageEntryId: matches[0].entryId };
}

function filterFoldPrefix(
  entries: readonly BranchEntryLike[],
  fold: NonNullable<TaskRuntimeV2["fold"]>,
  prefixEntryIds: ReadonlySet<string>,
): readonly BranchEntryLike[] {
  const retained = new Set(fold.retainedEntryIds);
  return entries.filter((entry) => !entry.id || !prefixEntryIds.has(entry.id) || retained.has(entry.id));
}

/** Apply an immutable fold using raw chronological branch membership. Ambiguity fails open. */
export function foldVisibleBranchEntries(
  branch: readonly BranchEntryLike[],
  fold: TaskRuntimeV2["fold"],
  taskKey?: string,
): readonly BranchEntryLike[] {
  if (!fold) return branch;
  const application = resolveFoldApplication(branch, fold, taskKey);
  return application ? filterFoldPrefix(branch, fold, application.prefixEntryIds) : branch;
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

export function visibleFixedToolCallIds(
  branch: readonly BranchEntryLike[],
  fold: TaskRuntimeV2["fold"],
  taskKey?: string,
): Set<string> {
  const modelBranch = providerModelBranchEntries(branch);
  if (!fold) return completeVisibleToolCallIds(modelBranch);
  const application = resolveFoldApplication(branch, fold, taskKey);
  return completeVisibleToolCallIds(application
    ? filterFoldPrefix(modelBranch, fold, application.prefixEntryIds)
    : modelBranch);
}

export interface ForkVisibleImportSelection {
  visibleBranch: readonly BranchEntryLike[];
  completeToolCallIds: Set<string>;
  fixedRefs: string[];
  refs: string[];
}

export function selectForkVisibleImports(
  branch: readonly BranchEntryLike[],
  fold: TaskRuntimeV2["fold"],
  taskKey: string | undefined,
  pinnedRefs: readonly string[],
  parentViews: readonly FixedExchangeView[],
): ForkVisibleImportSelection {
  const modelBranch = providerModelBranchEntries(branch);
  const application = resolveFoldApplication(branch, fold, taskKey);
  const visibleBranch = fold && application
    ? filterFoldPrefix(modelBranch, fold, application.prefixEntryIds)
    : modelBranch;
  const completeToolCallIds = completeVisibleToolCallIds(visibleBranch);
  const visibleViews = parentViews.filter((view) => completeToolCallIds.has(view.toolCallId));
  const fixedRefs = visibleViews.map((view) => view.exchangeId);
  const projected = projectFoldCandidateMessages(
    branchProjectionEntries(modelBranch),
    visibleViews,
    "provider",
    fold,
    application?.foldMessageEntryId,
    application?.prefixEntryIds,
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
  entries: readonly FoldCandidateEntry[],
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

function acceptanceClassifier(cwd: string): AcceptanceGateClassifier {
  return (text, current) => {
    const explicitRemoval = /(?:remove|drop|no longer require).{0,40}(?:acceptance|validation|test|check)/i.test(text);
    const acceptanceContext = /(?:acceptance|final (?:validation|check)|must (?:run|pass)|required (?:validation|test|check|command)|before (?:completion|completing|goal completion))/i.test(text);
    if (!acceptanceContext && !explicitRemoval) return undefined;
    const suites: SuiteIdentity[] = [];
    for (const command of [...commandCandidates(text), ...literalAcceptanceCommands(text)]) {
      const classified = classifyValidationCommand(command, cwd);
      if (classified && !suites.some((suite) => suite.family === classified.suite.family && suite.target === classified.suite.target)) {
        suites.push(classified.suite);
      }
    }
    const currentCandidates = current.map(({ key, suiteFamily, target }) => ({ key, suiteFamily, target }));
    if (explicitRemoval) {
      if (suites.length === 0) return [];
      const removed = new Set(suites.map((suite) => `suite:${suite.family}:${suite.target}`));
      return currentCandidates.filter((gate) => !removed.has(gate.key));
    }
    if (suites.length === 0) return undefined;
    const replaces = /(?:replace|instead|only).{0,40}(?:acceptance|validation|test|check)|(?:acceptance|validation) (?:commands?|gates?) (?:is|are|now)/i.test(text);
    return replaces ? suites : [...currentCandidates, ...suites];
  };
}

export default function primeContext(pi: ExtensionAPI): void {
  const runtime: RuntimeState = {
    mode: "on",
    config: { ...DEFAULT_CONFIG },
    configWarnings: [],
    snapshot: emptySnapshot(),
    readiness: "NOT_READY",
    exchanges: new ExchangeTracker(),
    fixedViews: new Map(),
    projectedRefs: new WeakMap(),
    recoveryLeases: new Map(),
    recoveryUtilities: new Map(),
    pendingImages: new Map(),
    consumedImageRefs: new Set(),
    projectedRecoveryToolCallIds: new Set(),
    projectedImageRefs: new Set(),
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

  // System-prompt policy survives ordinary turns, autonomous continuations, and compaction.
  pi.on("before_agent_start", (event) => ({
    systemPrompt: appendPrimeContextGlobalPolicy(event.systemPrompt),
  }));

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

  const clearProjectionLeases = (): void => {
    runtime.recoveryLeases.clear();
    runtime.recoveryUtilities.clear();
    runtime.pendingImages.clear();
    runtime.consumedImageRefs.clear();
    runtime.projectedRecoveryToolCallIds.clear();
    runtime.projectedImageRefs.clear();
  };

  const registerRecoveryLease = (
    toolCallId: string,
    content: readonly (TextContent | ImageContent)[],
  ): void => {
    const cloned = content.map((block) => ({ ...block })) as readonly Record<string, unknown>[];
    const bytes = recoveryLeaseBytes(cloned);
    runtime.recoveryLeases.delete(toolCallId);
    if (bytes > RECOVERY_LEASE_MAX_BYTES) return;
    while (runtime.recoveryLeases.size >= 32 ||
      [...runtime.recoveryLeases.values()].reduce(
        (total, lease) => total + (lease.bytes ?? recoveryLeaseBytes(lease.content)),
        bytes,
      ) > RECOVERY_LEASE_TOTAL_BYTES) {
      const oldest = runtime.recoveryLeases.keys().next().value;
      if (oldest === undefined) break;
      runtime.recoveryLeases.delete(oldest);
      runtime.recoveryUtilities.delete(oldest);
    }
    runtime.recoveryLeases.set(toolCallId, { content: cloned, bytes });
  };

  const registerRecoveryUtility = (
    toolCallId: string,
    subjectKeys: readonly string[],
    exposedBytes: number,
    inspectRecallHit: boolean,
  ): void => {
    runtime.recoveryUtilities.delete(toolCallId);
    runtime.recoveryUtilities.set(toolCallId, {
      subjectKeys: [...new Set(subjectKeys)].slice(0, 8),
      exposedBytes: Math.max(0, exposedBytes),
      inspectRecallHit,
      useful: true,
    });
    while (runtime.recoveryUtilities.size > 32) {
      const oldest = runtime.recoveryUtilities.keys().next().value;
      if (oldest === undefined) break;
      runtime.recoveryUtilities.delete(oldest);
      runtime.recoveryLeases.delete(oldest);
    }
  };

  const selectTaskRuntime = (
    branch: readonly BranchEntryLike[],
    goal?: ActiveGoalSelection,
    reload = false,
  ): TaskSelection | undefined => {
    const selection = deriveTaskSelection(branch, goal);
    if (!selection) {
      runtime.taskRuntime = undefined;
      runtime.readiness = "NOT_READY";
      runtime.archive?.setBranchScope(undefined, branchScopeIds(branch), [
        ...observationRefs(branch), ...runtime.snapshot.pinnedObservationIds,
      ]);
      return undefined;
    }
    if (reload || runtime.taskRuntime?.taskKey !== selection.taskKey) {
      runtime.taskRuntime = loadLatestRuntime(branch, selection.taskKey) ?? createTaskRuntime(selection);
      runtime.readiness = deriveReadiness(runtime.taskRuntime);
      runtime.exchanges.clearPending();
      runtime.archive?.resetBranchState();
    }
    runtime.archive?.setBranchScope(selection.taskKey, branchScopeIds(branch), [
      ...observationRefs(branch), ...runtime.snapshot.pinnedObservationIds,
    ]);
    return selection;
  };

  const refreshTaskContract = (
    branch: readonly BranchEntryLike[],
    goal: ActiveGoalSelection | undefined,
    cwd: string,
    reload = false,
  ): TaskSelection | undefined => {
    const selection = selectTaskRuntime(branch, goal, reload);
    if (!selection || !runtime.taskRuntime) return undefined;
    const objective = taskObjective(branch, selection, runtime.taskRuntime.objective ?? "");
    if (runtime.taskRuntime.objective === undefined && objective.trim()) {
      runtime.taskRuntime = {
        ...runtime.taskRuntime,
        objective,
        objectiveVersion: Math.max(1, runtime.taskRuntime.objectiveVersion),
      };
    }
    const update = updateTaskContract(runtime.taskRuntime, {
      objective,
      userEntries: branchUserEntries(branch, selection),
    }, acceptanceClassifier(cwd));
    runtime.taskRuntime = update.runtime;
    runtime.readiness = deriveReadiness(update.runtime);
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
    if (!selection || !runtime.taskRuntime) return undefined;
    const objective = taskObjective(branch, selection, visiblePrompt);
    const child = childAnchorContext(objective);
    const input = {
      taskKey: selection.taskKey,
      objective,
      runtime: runtime.taskRuntime,
      snapshot: runtime.snapshot,
      ...(child ? { child } : {}),
    };
    if (!input.objective.trim() || !taskAnchorHasDurableState(input, visiblePrompt)) return undefined;
    return renderPrimeContextAnchor(input);
  };

  const clearControlState = (structuralBoundary: boolean): void => {
    runtime.control.expectedAnchor = undefined;
    runtime.control.lastStateContent = undefined;
    runtime.control.structuralBoundary = structuralBoundary;
    runtime.control.needsAnchorRefresh = false;
  };

  const reloadSelectedBranch = (
    ctx: { cwd: string; sessionManager: { getBranch(): unknown[] } },
    preserveProjectionLeases = false,
  ) => {
    const fullBranch = ctx.sessionManager.getBranch() as BranchEntryLike[];
    const providerBranch = providerVisibleBranchEntries(fullBranch);
    runtime.exchanges.clearPending();
    runtime.projectedRefs = new WeakMap();
    if (!preserveProjectionLeases) clearProjectionLeases();
    runtime.branchAnchorId = undefined;
    runtime.archive?.resetBranchState();
    runtime.snapshot = loadLatestSnapshot(fullBranch);
    const goal = activeGoalFromBranch(fullBranch);
    const branch = scopeBranchToGoal(fullBranch, goal);
    const selection = refreshTaskContract(branch, goal, ctx.cwd, true);
    runtime.control.expectedAnchor = currentTaskAnchor(
      branch,
      selection,
      latestBranchUserText(providerBranch),
    );
    runtime.control.lastStateContent = runtime.taskRuntime
      ? latestProviderVisibleControlMessage(
        fullBranch,
        PRIME_CONTEXT_STATE_TYPE,
        runtime.taskRuntime.taskKey,
      )?.content
      : undefined;
  };

  const installUserBashViews = async (ctx: ExtensionContext): Promise<void> => {
    if (!runtime.archive) return;
    const entries = branchProjectionEntries(ctx.sessionManager.getBranch() as BranchEntryLike[]);
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
          taskKey: runtime.taskRuntime?.taskKey,
          goalId: runtime.taskRuntime?.goalId,
          branchAnchorId: entry.entryId,
          turnSequence: runtime.taskRuntime?.turnSequence,
          requirementsRevision: runtime.taskRuntime?.requirementsRevision,
          workspaceRevisionAtStart: runtime.taskRuntime?.workspaceRevision,
          workspaceRevisionAtResult: runtime.taskRuntime?.workspaceRevision,
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
      await runtime.archive.finalizeExchanges(completed, ctx.signal, {
        budgetBytes: fixedExchangeBudgetBytes(ctx.getContextUsage()),
        capsuleMaxBytes: runtime.config.capsuleMaxBytes,
      });
      installFixedViews(await runtime.archive.loadFixedExchangeViews(
        ctx.signal,
        completed.map((item) => item.metadata.exchangeId),
      ));
    } finally {
      await Promise.all(frozenSources.map((path) =>
        runtime.archive!.removeFrozenTextSource(path).catch(() => undefined)
      ));
    }
  };

  pi.on("session_start", async (event, ctx) => {
    const loaded = loadPrimeContextConfig(ctx.cwd);
    runtime.config = loaded.config;
    runtime.configWarnings = loaded.warnings;
    runtime.mode = loaded.config.enabled ? "on" : "off";
    const archiveRoot = storageRoot();
    const currentArchive = new ObservationArchive(archiveRoot, ctx.sessionManager.getSessionId());
    runtime.archive = currentArchive;
    runtime.sessionRecall = await discoverRecallSources(ctx, archiveRoot);
    runtime.exchanges.resetSession();
    runtime.fixedViews.clear();
    runtime.projectedRefs = new WeakMap();
    runtime.lastProviderProjection = undefined;
    runtime.taskRuntime = undefined;
    runtime.readiness = "NOT_READY";
    runtime.lifecycle.selectedModelKey = ctx.model
      ? `${ctx.model.provider}:${ctx.model.id}`
      : undefined;
    runtime.lifecycle.replayMetadataPagingEligible = false;
    clearControlState(false);
    reloadSelectedBranch(ctx);
    runtime.exchanges.setMinimumSequence(await currentArchive.maxExchangeSequence(undefined, ctx.signal));
    currentArchive.recordBranchRuntimeReload();
    const sessionBranch = ctx.sessionManager.getBranch() as BranchEntryLike[];
    const selectedRuntime = runtime.taskRuntime as TaskRuntimeV2 | undefined;
    installFixedViews(
      await currentArchive.loadFixedExchangeViews(ctx.signal).catch(() => []),
      true,
      visibleFixedToolCallIds(sessionBranch, selectedRuntime?.fold, selectedRuntime?.taskKey),
    );

    if (event.reason === "fork" && runtime.sessionRecall.parent) {
      const parentSessionId = runtime.sessionRecall.parent.sessionId;
      if (parentSessionId && parentSessionId !== ctx.sessionManager.getSessionId()) {
        const branch = ctx.sessionManager.getBranch() as BranchEntryLike[];
        const parentArchive = runtime.sessionRecall.parent.archive;
        const parentViews = await parentArchive.loadFixedExchangeViews(ctx.signal).catch(() => []);
        const selectedRuntime = runtime.taskRuntime as TaskRuntimeV2 | undefined;
        const visible = selectForkVisibleImports(
          branch,
          selectedRuntime?.fold,
          selectedRuntime?.taskKey,
          runtime.snapshot.pinnedObservationIds,
          parentViews,
        );
        const refs = visible.refs;
        await currentArchive
          .importFrom(
            parentArchive,
            refs,
            ctx.signal,
            {
              taskKey: (runtime.taskRuntime as TaskRuntimeV2 | undefined)?.taskKey,
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

  pi.on("before_agent_start", (event, ctx) => {
    if (runtime.mode === "off") return;
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
        const preview = previewTaskContract(
          createTaskRuntime({ taskKey: "", objective: event.prompt, source: "user" }),
          event.prompt,
          acceptanceClassifier(ctx.cwd),
        ).runtime;
        const child = childAnchorContext(event.prompt);
        const input = {
          objective: event.prompt,
          runtime: preview,
          snapshot: runtime.snapshot,
          ...(child ? { child } : {}),
        };
        if (!event.prompt.trim() || !taskAnchorHasDurableState(input, event.prompt)) {
          runtime.control.expectedAnchor = undefined;
          return;
        }
        const anchor = renderPrimeContextAnchor(input);
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
    const selection = refreshTaskContract(branch, goal, ctx.cwd);
    if (!selection) {
      runtime.control.expectedAnchor = undefined;
      return;
    }
    const base = runtime.taskRuntime ?? createTaskRuntime(selection);
    const preview = /<goal_context>/i.test(event.prompt)
      ? base
      : previewTaskContract(base, event.prompt, acceptanceClassifier(ctx.cwd)).runtime;
    const objective = goal?.objective?.trim() || taskObjective(branch, selection, event.prompt);
    const child = childAnchorContext(event.prompt || objective);
    const input = {
      taskKey: selection.taskKey,
      objective,
      runtime: preview,
      snapshot: runtime.snapshot,
      ...(child ? { child } : {}),
    };
    const visiblePrompt = latestBranchUserText(providerBranch) || event.prompt;
    if (!input.objective.trim() || !taskAnchorHasDurableState(input, visiblePrompt)) {
      runtime.control.expectedAnchor = undefined;
      return;
    }
    const anchor = renderPrimeContextAnchor(input);
    runtime.control.expectedAnchor = anchor;
    const unscoped = selection.source === "user" && selection.rootUserEntryId
      ? { content: anchor.content, afterEntryId: selection.rootUserEntryId }
      : undefined;
    const persisted = latestProviderVisibleControlMessage(
      fullBranch,
      PRIME_CONTEXT_ANCHOR_TYPE,
      anchor.details.taskKey,
      unscoped,
    );
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
    runtime.exchanges.clearPending();
    runtime.projectedRecoveryToolCallIds.clear();
    runtime.projectedImageRefs.clear();
    await installUserBashViews(ctx);
  });
  hooks.add("agent_start");

  pi.on("turn_start", async (event, ctx) => {
    if (runtime.mode === "off") return;
    runtime.lifecycle.turnIndex = event.turnIndex;
    await installUserBashViews(ctx);
  });
  hooks.add("turn_start");

  pi.on("model_select", (event) => {
    if (runtime.mode === "off") return;
    const modelKey = `${event.model.provider}:${event.model.id}`;
    const previousKey = event.previousModel
      ? `${event.previousModel.provider}:${event.previousModel.id}`
      : runtime.lifecycle.selectedModelKey;
    runtime.lifecycle.selectedModelKey = modelKey;
    runtime.lifecycle.replayMetadataPagingEligible = previousKey !== undefined && previousKey !== modelKey;
  });
  hooks.add("model_select");

  pi.on("session_before_compact", async (event, ctx) => {
    if (runtime.mode === "off" || event.customInstructions || event.preparation.isSplitTurn ||
      event.preparation.turnPrefixMessages.length > 0 || !runtime.taskRuntime) return;
    await installUserBashViews(ctx);
    const messages = event.preparation.messagesToSummarize as unknown as ContextMessageLike[];
    const entryRefs = messages.flatMap((message, messageIndex) => {
      const id = message && typeof message === "object" ? runtime.projectedRefs.get(message as object) : undefined;
      return id ? [{ messageIndex, entryId: id }] : [];
    });
    if (entryRefs.length !== messages.length) return;
    const compactBranch = ((event.branchEntries ?? ctx.sessionManager.getBranch()) ?? []) as unknown as BranchEntryLike[];
    const compactFold = resolveFoldApplication(
      compactBranch,
      runtime.taskRuntime.fold,
      runtime.taskRuntime.taskKey,
    );
    const compactProjection = projectModelContext({
      purpose: "compaction",
      messages,
      entryRefs,
      fixedViews: runtime.fixedViews,
      fold: runtime.taskRuntime.fold,
      foldMessageEntryId: compactFold?.foldMessageEntryId,
      foldPrefixEntryIds: compactFold?.prefixEntryIds,
      sourceMessages: branchSourceMessages(compactBranch),
      activeModelKey: runtime.lifecycle.selectedModelKey,
    });
    const files = fileLists(event.preparation.fileOps);
    const state = renderPrimeContextState(runtime.taskRuntime, runtime.snapshot).content;
    const anchor = runtime.control.expectedAnchor?.content ?? renderPrimeContextAnchor({
      taskKey: runtime.taskRuntime.taskKey,
      objective: runtime.taskRuntime.objective ?? runtime.taskRuntime.taskKey,
      runtime: runtime.taskRuntime,
      snapshot: runtime.snapshot,
    }).content;
    const summary = deterministicFastSummary({
      messages: compactProjection.messages,
      entryRefs: compactProjection.entryRefs ?? entryRefs,
      fixedViews: runtime.fixedViews,
      previousSummary: event.preparation.previousSummary,
      anchor,
      state,
      hiddenSteering: runtime.taskRuntime.steeringDeltas,
      fileOps: files,
      sourceMessages: branchSourceMessages(compactBranch),
    });
    if (!summary) return;
    return {
      compaction: {
        summary,
        firstKeptEntryId: event.preparation.firstKeptEntryId,
        tokensBefore: event.preparation.tokensBefore,
        details: files,
      },
    };
  });
  hooks.add("session_before_compact");

  pi.on("session_before_tree", async (event, ctx) => {
    if (runtime.mode === "off" || !event.preparation.userWantsSummary ||
      event.preparation.customInstructions || !runtime.taskRuntime) return;
    await installUserBashViews(ctx);
    const entries = branchProjectionEntries(event.preparation.entriesToSummarize as unknown as BranchEntryLike[]);
    if (entries.length === 0) return;
    const files = treeFixedFileLists(entries, runtime.fixedViews);
    if (!files) return;
    const foldApplication = resolveFoldApplication(
      ctx.sessionManager.getBranch() as BranchEntryLike[],
      runtime.taskRuntime.fold,
      runtime.taskRuntime.taskKey,
    );
    const projected = projectFoldCandidateMessages(
      entries,
      runtime.fixedViews,
      "branch-summary",
      runtime.taskRuntime.fold,
      foldApplication?.foldMessageEntryId,
      foldApplication?.prefixEntryIds,
    );
    const summary = deterministicFastSummary({
      messages: projected.messages,
      entryRefs: projected.entryRefs,
      fixedViews: runtime.fixedViews,
      anchor: runtime.control.expectedAnchor?.content ?? renderPrimeContextAnchor({
        taskKey: runtime.taskRuntime.taskKey,
        objective: runtime.taskRuntime.objective ?? runtime.taskRuntime.taskKey,
        runtime: runtime.taskRuntime,
        snapshot: runtime.snapshot,
      }).content,
      state: renderPrimeContextState(runtime.taskRuntime, runtime.snapshot).content,
      hiddenSteering: runtime.taskRuntime.steeringDeltas,
      fileOps: files,
      sourceMessages: projected.sourceMessages,
    });
    if (!summary) return;
    return { summary: { summary, details: files } };
  });
  hooks.add("session_before_tree");

  pi.on("session_compact", async (_event, ctx) => {
    clearControlState(true);
    runtime.fixedViews.clear();
    reloadSelectedBranch(ctx, true);
    runtime.archive?.recordBranchRuntimeReload();
    const branch = ctx.sessionManager.getBranch() as BranchEntryLike[];
    const allowed = visibleFixedToolCallIds(branch, runtime.taskRuntime?.fold, runtime.taskRuntime?.taskKey);
    installFixedViews(await runtime.archive?.loadFixedExchangeViews(ctx.signal).catch(() => []) ?? [], true, allowed);
  });
  hooks.add("session_compact");

  pi.on("session_tree", async (_event, ctx) => {
    clearControlState(true);
    runtime.fixedViews.clear();
    reloadSelectedBranch(ctx);
    runtime.archive?.recordBranchRuntimeReload();
    const branch = ctx.sessionManager.getBranch() as BranchEntryLike[];
    const allowed = visibleFixedToolCallIds(branch, runtime.taskRuntime?.fold, runtime.taskRuntime?.taskKey);
    installFixedViews(await runtime.archive?.loadFixedExchangeViews(ctx.signal).catch(() => []) ?? [], true, allowed);
    await installUserBashViews(ctx);
  });
  hooks.add("session_tree");

  pi.on("tool_execution_start", (event) => {
    if (runtime.mode === "off") return;
    const exchange = runtime.exchanges.start(event);
    exchange.replayOriginKey = runtime.lifecycle.selectedModelKey;
  });
  hooks.add("tool_execution_start");

  pi.on("tool_call", (event, ctx) => {
    if (runtime.mode === "off") return;
    const branch = ctx.sessionManager.getBranch() as BranchEntryLike[];
    runtime.branchAnchorId = branchAnchorId(branch);
    runtime.archive?.setBranchScope(runtime.taskRuntime?.taskKey, branchScopeIds(branch), [
      ...observationRefs(branch), ...runtime.snapshot.pinnedObservationIds,
    ]);
    const toolSchema = pi.getAllTools?.().find((tool) => tool.name === event.toolName)?.parameters;
    runtime.exchanges.noteCall(event, ctx.cwd, toolSchema);
  });
  hooks.add("tool_call");

  pi.on("tool_result", async (event, ctx) => {
    if (runtime.mode === "off") return;
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
      // All summaries, capsules, and exact bytes come from the same immutable
      // snapshot. The public complete-output path may change after tool_result.
      const resolvedText = await resolveArchiveText(
        content,
        archiveResult && runtime.archive ? frozenResultPath : fullOutputPath,
        ctx.signal,
      );
      const parts = archiveResult ? typedObservationParts(event) : [];
      const visibleResult = visibleToolResultText(content, resolvedText.large ? 64 * 1024 : Number.POSITIVE_INFINITY);
      const exchange = runtime.exchanges.noteResult(
        event,
        ctx.cwd,
        resolvedText.text,
        {
          source: resolvedText.source,
          parts: archiveResult ? parts : [],
          retainResultText: archiveResult,
          visibleResultText: visibleResult.text,
          visibleResultBytes: visibleResult.textBytes,
          visibleResultTruncated: visibleResult.truncated,
          visibleResultTail: visibleResult.tail,
          visibleResultSamples: visibleResult.samples,
          outcomeText: resolvedText.outcomeText,
          resultSummary: resolvedText,
          large: resolvedText.large,
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
    const selection = refreshTaskContract(branch, goal, ctx.cwd);
    runtime.control.expectedAnchor = currentTaskAnchor(
      branch,
      selection,
      latestBranchUserText(providerBranch),
    );
    const persistedState = runtime.taskRuntime
      ? latestProviderVisibleControlMessage(
        fullBranch,
        PRIME_CONTEXT_STATE_TYPE,
        runtime.taskRuntime.taskKey,
      )?.content
      : undefined;
    const stateBefore = persistedState ?? runtime.control.lastStateContent ??
      (runtime.taskRuntime ? renderPrimeContextState(runtime.taskRuntime, runtime.snapshot).content : undefined);
    const contextUsage = ctx.getContextUsage();
    const exchanges = runtime.exchanges.finishTurn(event.message, event.toolResults);
    for (const exchange of exchanges) {
      if (!exchange.rawResult) continue;
      const finalEvent = {
        ...exchange.rawResult,
        toolName: exchange.rawResult.toolName ?? exchange.toolName,
        content: Array.isArray(exchange.rawResult.content) ? exchange.rawResult.content : [],
        isError: exchange.rawResult.isError ?? exchange.outcome?.isError ?? false,
      } as unknown as ToolResultEvent;
      const finalContent = finalEvent.content as (TextContent | ImageContent)[];
      const finalTypedParts = typedObservationParts(finalEvent);
      runtime.exchanges.noteFinalDetails(exchange, finalEvent.isError, finalEvent.details);
      if (!typedObservationPartsEqual(exchange.archiveParts ?? [], finalTypedParts)) {
        exchange.persistedResultChanged = true;
        exchange.archiveParts = finalTypedParts;
      }
      const finalPath = resultFullOutputPath(exchange.rawResult.details);
      if (exchange.persistedResultChanged) exchange.archiveParts = finalTypedParts;
      const finalVisibleSource = visiblePartSource(finalContent);
      if (exchange.frozenVisibleResultSource &&
        !await partSourcesEqual(exchange.frozenVisibleResultSource, finalVisibleSource, ctx.signal)) {
        exchange.persistedTextChanged = true;
        exchange.persistedResultChanged = true;
        exchange.persistedCanonicalResultChanged = true;
      }
      if (!shouldArchiveToolResult(exchange.toolName) || !exchange.persistedCanonicalResultChanged) continue;
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
      runtime.exchanges.noteCanonicalResult(
        exchange,
        resolved,
        finalEvent.isError,
        finalEvent.details,
        [canonicalPart, ...finalTypedParts],
      );
    }

    if (runtime.archive) {
      for (const exchange of exchanges) {
        if (!shouldArchiveToolResult(exchange.toolName) || !exchange.rawResult || !exchange.resultSummary) continue;
        const content = Array.isArray(exchange.rawResult.content)
          ? exchange.rawResult.content as (TextContent | ImageContent)[]
          : [];
        const metadata = runtime.exchanges.toObservationMetadata(exchange, {
          taskKey: runtime.taskRuntime?.taskKey,
          goalId: runtime.taskRuntime?.goalId,
          branchAnchorId: runtime.branchAnchorId,
          turnSequence: runtime.taskRuntime === undefined ? undefined : runtime.taskRuntime.turnSequence + 1,
          requirementsRevision: runtime.taskRuntime?.requirementsRevision,
          workspaceRevisionAtStart: runtime.taskRuntime?.workspaceRevision,
        });
        if (!metadata) continue;
        const archived = await runtime.archive.archiveVisibleContent(
          content,
          exchange.toolName,
          exchange.outcome?.isError ?? false,
          adaptiveMinTextBytes(runtime.config.minTextBytes, contextUsage),
          runtime.config.capsuleMaxBytes,
          ctx.signal,
          exchange.resultSummary,
          contextUsage,
          metadata,
          exchange.archiveParts ?? [],
        );
        if (archived?.observation.envelope?.resultCapsule) {
          exchange.admittedCapsule = archived.observation.envelope.resultCapsule;
        }
        if (archived) {
          const images = archived.observation.envelope
            ? imageRefsForEnvelope(archived.observation.envelope)
            : projectedImageRefs(archived.observation.id, content);
          if (images.length > 0) setPendingImages(runtime, exchange.toolCallId, images);
        }
      }
    }

    let completedArchives;
    let createdFold: ReturnType<typeof renderPrimeContextFold> | undefined;
    if (!runtime.taskRuntime) {
      completedArchives = exchanges.flatMap((exchange) => {
        const metadata = runtime.exchanges.toObservationMetadata(exchange, {
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
    } else {
      if (event.toolExecution !== "parallel" && event.toolExecution !== "sequential") {
        throw new Error("Prime Context requires Prime Agent turn_end.toolExecution support.");
      }
      const reduced = reduceTurn(runtime.taskRuntime, exchanges, {
        toolExecution: event.toolExecution,
      });
      runtime.taskRuntime = reduced.runtime;
      runtime.readiness = reduced.readiness;
      const currentFold = runtime.taskRuntime.fold;
      const currentFoldApplication = resolveFoldApplication(
        fullBranch,
        currentFold,
        runtime.taskRuntime.taskKey,
      );
      const rawEntryIds = fullBranch.flatMap((entry) => entry.id ? [entry.id] : []);
      const exactRawOrder = rawEntryIds.length === fullBranch.length &&
        new Set(rawEntryIds).size === rawEntryIds.length &&
        (!currentFold || currentFoldApplication !== undefined);
      const fold = exactRawOrder ? selectFoldGeneration(
        branchProjectionEntries(providerModelBranchEntries(fullBranch)),
        runtime.fixedViews,
        contextUsage,
        currentFold,
        (generation, throughEntryId) =>
          renderPrimeContextFold(runtime.taskRuntime!, runtime.snapshot, generation, throughEntryId).content,
        {
          entryIds: rawEntryIds,
          ...(currentFoldApplication
            ? { currentFoldMessageEntryId: currentFoldApplication.foldMessageEntryId }
            : {}),
        },
      ) : undefined;
      if (fold) {
        if (!currentFold || fold.generation > currentFold.generation) runtime.archive?.recordFoldGeneration();
        runtime.taskRuntime = { ...runtime.taskRuntime, fold };
        createdFold = renderPrimeContextFold(
          runtime.taskRuntime,
          runtime.snapshot,
          fold.generation,
          fold.throughEntryId,
        );
      }
      pi.appendEntry(RUNTIME_STATE_ENTRY_TYPE, runtime.taskRuntime);
      const revisions = new Map(reduced.exchangeRevisions.map((revision) => [revision.toolCallId, revision]));
      completedArchives = exchanges.flatMap((exchange) => {
        const revision = revisions.get(exchange.toolCallId);
        const metadata = runtime.exchanges.toObservationMetadata(exchange, {
          taskKey: reduced.runtime.taskKey,
          goalId: reduced.runtime.goalId,
          branchAnchorId: runtime.branchAnchorId,
          turnSequence: reduced.runtime.turnSequence,
          requirementsRevision: reduced.runtime.requirementsRevision,
          workspaceRevisionAtStart: revision?.workspaceRevisionAtStart,
          workspaceRevisionAtResult: revision?.workspaceRevisionAtResult,
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
    }

    const controlMessages: ContextMessageLike[] = [];
    if (runtime.control.needsAnchorRefresh && runtime.control.expectedAnchor) {
      controlMessages.push(persistentControlMessage(PRIME_CONTEXT_ANCHOR_TYPE, runtime.control.expectedAnchor));
    }
    if (runtime.taskRuntime) {
      const stateAfter = renderPrimeContextState(runtime.taskRuntime, runtime.snapshot);
      if (stateAfter.content !== stateBefore) {
        controlMessages.push(persistentControlMessage(PRIME_CONTEXT_STATE_TYPE, stateAfter));
        runtime.control.lastStateContent = stateAfter.content;
      }
      if (createdFold) controlMessages.push(persistentControlMessage(PRIME_CONTEXT_FOLD_TYPE, createdFold));
    }

    // Archive completion is independent from the synchronous control result.
    if (runtime.archive && completedArchives.length > 0) {
      try {
        await runtime.archive.finalizeExchanges(completedArchives, ctx.signal, {
          budgetBytes: fixedExchangeBudgetBytes(contextUsage),
          capsuleMaxBytes: runtime.config.capsuleMaxBytes,
        });
        const ids = completedArchives.map((completed) => completed.metadata.exchangeId);
        for (const completed of completedArchives) {
          const record = await runtime.archive.findObservation(completed.metadata.exchangeId, ctx.signal, true);
          const images = record.envelope ? imageRefsForEnvelope(record.envelope) : [];
          const toolCallId = completed.metadata.toolCallId;
          if (toolCallId && images.length > 0) setPendingImages(runtime, toolCallId, images);
          else if (toolCallId) clearPendingImages(runtime, toolCallId);
        }
        installFixedViews(await runtime.archive.loadFixedExchangeViews(ctx.signal, ids));
      } catch {
        // Raw session messages remain the provider view when batch finalization fails.
      }
    }

    if (runtime.archive) {
      for (const exchange of exchanges) {
        if (!exchange.frozenResultPath) continue;
        await runtime.archive.removeFrozenTextSource(exchange.frozenResultPath).catch(() => undefined);
        exchange.frozenResultPath = undefined;
      }
    }

    for (const [toolCallId, images] of runtime.pendingImages) {
      if (!runtime.fixedViews.get(toolCallId)?.images?.length ||
        !images.every((image) => runtime.consumedImageRefs.has(image.ref) ||
          !PROVIDER_IMAGE_MIME_TYPES.has(image.mimeType.toLowerCase()))) continue;
      clearPendingImages(runtime, toolCallId);
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
    const selectedBranch = ctx.sessionManager.getBranch() as BranchEntryLike[];
    let temporaryAnchorText: string | undefined;
    if (purpose === "provider") {
      const providerBranch = providerVisibleBranchEntries(selectedBranch);
      const goal = activeGoalFromBranch(selectedBranch);
      const branch = scopeBranchToGoal(selectedBranch, goal);
      const selection = refreshTaskContract(branch, goal, ctx.cwd);
      const anchor = currentTaskAnchor(
        branch,
        selection,
        latestBranchUserText(providerBranch),
      );
      runtime.control.expectedAnchor = anchor;
      const unscoped = anchor && selection?.source === "user" && selection.rootUserEntryId
        ? { content: anchor.content, afterEntryId: selection.rootUserEntryId }
        : undefined;
      const persisted = anchor
        ? latestProviderVisibleControlMessage(
          selectedBranch,
          PRIME_CONTEXT_ANCHOR_TYPE,
          anchor.details.taskKey,
          unscoped,
        )
        : undefined;
      const positionallyScopedUnscoped = unscoped !== undefined && persisted?.details?.taskKey === undefined;
      if (!anchor || sameAnchor(persisted, anchor, positionallyScopedUnscoped)) {
        runtime.control.structuralBoundary = false;
        runtime.control.needsAnchorRefresh = false;
      } else if (runtime.control.structuralBoundary || runtime.control.needsAnchorRefresh) {
        runtime.control.structuralBoundary = false;
        runtime.control.needsAnchorRefresh = true;
        temporaryAnchorText = anchor.content;
      }
      runtime.archive?.noteContextTurn(goal !== undefined);
    }
    const refs = event.entryRefs as ContextEntryRef[] | undefined;
    const foldApplication = resolveFoldApplication(
      selectedBranch,
      runtime.taskRuntime?.fold,
      runtime.taskRuntime?.taskKey,
    );
    const projected = projectModelContext({
      purpose,
      messages: event.messages as unknown as ContextMessageLike[],
      entryRefs: refs,
      fixedViews: runtime.fixedViews,
      fold: runtime.taskRuntime?.fold,
      foldMessageEntryId: foldApplication?.foldMessageEntryId,
      foldPrefixEntryIds: foldApplication?.prefixEntryIds,
      sourceMessages: branchSourceMessages(selectedBranch),
      recoveryLeases: runtime.recoveryLeases,
      pendingImages: runtime.pendingImages,
      consumedImageRefs: runtime.consumedImageRefs,
      activeModelKey: runtime.lifecycle.selectedModelKey,
    });
    if (purpose === "provider") {
      for (const id of projected.shownRecoveryToolCallIds ?? []) runtime.projectedRecoveryToolCallIds.add(id);
      for (const message of projected.messages) {
        if (message.role === "toolResult" && typeof message.toolCallId === "string" &&
            runtime.recoveryUtilities.has(message.toolCallId)) {
          runtime.projectedRecoveryToolCallIds.add(message.toolCallId);
        }
      }
      for (const ref of projected.shownImageRefs ?? []) runtime.projectedImageRefs.add(ref);
    }
    const messages = temporaryAnchorText
      ? appendProviderTextMessage(projected.messages, temporaryAnchorText)
      : projected.messages;
    for (const ref of projected.entryRefs ?? []) {
      const message = messages[ref.messageIndex];
      if (message && typeof message === "object") runtime.projectedRefs.set(message as object, ref.entryId);
    }
    if (purpose === "provider") {
      const effectiveRefs = projected.entryRefs ?? refs ?? [];
      const previous = runtime.lastProviderProjection;
      const foldGeneration = runtime.taskRuntime?.fold?.generation ?? 0;
      const extendedStableGeneration = Boolean(
        previous && previous.foldGeneration === foldGeneration &&
        effectiveRefs.length > previous.entryCount && previous.entryCount > 0 &&
        effectiveRefs[previous.entryCount - 1]?.entryId === previous.lastEntryId
      );
      runtime.archive?.recordProviderProjection(
        utf8Bytes(JSON.stringify(messages)),
        extendedStableGeneration,
      );
      runtime.lastProviderProjection = {
        entryCount: effectiveRefs.length,
        ...(effectiveRefs.at(-1)?.entryId ? { lastEntryId: effectiveRefs.at(-1)!.entryId } : {}),
        foldGeneration,
      };
    }
    const messagesChanged = messages !== event.messages;
    const refsChanged = projected.entryRefs !== undefined && (
      refs === undefined || projected.entryRefs.length !== refs.length ||
      projected.entryRefs.some((ref, index) => ref.messageIndex !== refs[index]?.messageIndex || ref.entryId !== refs[index]?.entryId)
    );
    if (!messagesChanged && !refsChanged) return;
    return {
      messages: messages as typeof event.messages,
      ...(projected.entryRefs === undefined ? {} : { entryRefs: projected.entryRefs }),
    };
  });
  hooks.add("model_context");

  pi.on("message_end", async (event, ctx) => {
    if (runtime.mode === "off" || event.message.role !== "assistant") return;
    runtime.archive?.recordUsage(event.message.usage ?? {});
    const successful = event.message.stopReason !== "error" && event.message.stopReason !== "aborted";
    if (successful) {
      for (const id of runtime.projectedRecoveryToolCallIds) {
        const utility = runtime.recoveryUtilities.get(id);
        if (utility) {
          runtime.archive?.recordRecovery(
            utility.useful,
            utility.subjectKeys,
            utility.exposedBytes,
            utility.inspectRecallHit,
          );
          runtime.recoveryUtilities.delete(id);
        }
        runtime.recoveryLeases.delete(id);
      }
      const imageBytes = new Map<string, number>();
      for (const view of runtime.fixedViews.values()) {
        for (const image of view.images ?? []) imageBytes.set(image.ref, image.bytes);
      }
      for (const images of runtime.pendingImages.values()) {
        for (const image of images) imageBytes.set(image.ref, image.bytes);
      }
      let projectedMediaBytes = 0;
      for (const ref of runtime.projectedImageRefs) {
        if (!runtime.consumedImageRefs.has(ref)) projectedMediaBytes += imageBytes.get(ref) ?? 0;
        runtime.consumedImageRefs.add(ref);
      }
      if (projectedMediaBytes > 0) runtime.archive?.recordTypedMediaProjection(projectedMediaBytes);
      while (runtime.consumedImageRefs.size > CONSUMED_IMAGE_REF_MAX) {
        const oldest = runtime.consumedImageRefs.values().next().value as string | undefined;
        if (!oldest) break;
        runtime.consumedImageRefs.delete(oldest);
      }
    }
    runtime.projectedRecoveryToolCallIds.clear();
    runtime.projectedImageRefs.clear();
    if (runtime.archive) await runtime.archive.flushSessionState(ctx.signal).catch(() => undefined);
  });
  hooks.add("message_end");

  const actions: PrimeContextActions = {
    getMode: () => runtime.mode,
    setMode: (mode) => {
      runtime.mode = mode;
    },
    getArchive: () => runtime.archive,
    getSnapshot: () => runtime.snapshot,
    getTaskRuntime: () => runtime.taskRuntime,
    getReadiness: () => runtime.readiness,
    updateSnapshot: (changes: SnapshotChanges): SnapshotUpdateResult => {
      const result = applySnapshotChanges(runtime.snapshot, changes);
      if (result.ok && result.changed) {
        pi.appendEntry(SNAPSHOT_ENTRY_TYPE, result.snapshot);
        runtime.snapshot = result.snapshot;
      }
      return result;
    },
    getReadMaxBytes: () => runtime.config.readMaxBytes,
    consumeConfigWarnings: () => runtime.configWarnings.splice(0),
    hooksLoaded: () => requiredHooksLoaded(hooks),
    clearFixedViews: () => runtime.fixedViews.clear(),
    registerRecoveryLease,
    registerRecoveryUtility,
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

  registerPrimeContextTool(pi, actions);
  registerPrimeContextCommands(pi, actions);
}
