import type {
  ExchangeObservationMetadata,
  ObservationPartInput,
  ObservationSource,
  ResolvedArchiveText,
} from "./archive.js";
import {
  adaptToolIntent,
  collectFactualOutcome,
  jsonBytes,
  parseToolIntent,
  type ToolIntent,
} from "./intent.js";
import type { OutcomeSummary } from "./capsule.js";
import type { StreamPartSource } from "./envelope.js";
import { hasOpaqueReplayMetadata } from "./projection.js";

export interface ModelToolCall {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  thoughtSignature?: string;
  [key: string]: unknown;
}

export interface ToolResultMessageLike {
  role: "toolResult";
  toolCallId: string;
  toolName?: string;
  content?: unknown;
  details?: unknown;
  isError?: boolean;
}

export type ToolExecutionMode = "parallel" | "sequential";

/** Final host-owned exchange after all supported result replacement hooks. */
export interface FinalizedToolExchange {
  sourceOrder: number;
  toolCallId: string;
  toolName: string;
  originalInput: unknown;
  executedInput?: unknown;
  result: ToolResultMessageLike;
}

/** Temporary immutable complete-output source retained only until turn finalization. */
export interface PendingFullOutputCapture {
  toolCallId: string;
  path: string;
  text?: string;
  visibleText?: string;
  visibleBytes?: number;
  visibleTruncated?: boolean;
  visibleTail?: string;
  visibleSamples?: readonly string[];
  publicFullOutputPath?: string;
  semanticDetails?: unknown;
  isError?: boolean;
}

export interface ActionableObservation {
  text: string;
  observationRef?: string;
  resource?: string;
  sourceToolCallId?: string;
}

export interface ExchangeArtifact {
  pathOrId: string;
  description?: string;
  sourceToolCallId?: string;
}

export type ProgressEffect =
  | { kind: "none" }
  | { kind: "information"; observations: ActionableObservation[] }
  | { kind: "mutation"; artifacts?: ExchangeArtifact[] }
  | { kind: "failure"; observation: ActionableObservation };

/** Canonical facts consumed by archive, projection, task state, hints, and metrics. */
export interface ExchangeFacts {
  sourceOrder: number;
  toolCallId: string;
  toolName: string;
  originalInput: unknown;
  executedInput?: unknown;
  executionMode: ToolExecutionMode;

  finalResult: ToolResultMessageLike;
  text: string;
  textBytes: number;
  typedParts: readonly ObservationPartInput[];

  intent: ToolIntent;
  outcome: OutcomeSummary;
  progress: ProgressEffect;

  fullOutputSnapshotPath?: string;
}

export interface BuildExchangeFactsInput {
  exchanges: readonly FinalizedToolExchange[];
  executionMode: ToolExecutionMode;
  pendingFullOutputs?: ReadonlyMap<string, PendingFullOutputCapture> | readonly PendingFullOutputCapture[];
  cwd?: string;
  toolSchemas?: ReadonlyMap<string, unknown>;
  extractTypedParts?: (exchange: FinalizedToolExchange) => readonly ObservationPartInput[];
}

export interface PendingOutcome {
  isError: boolean;
  outcome: OutcomeSummary;
}

export interface PendingExchange {
  id: string;
  toolCallId: string;
  toolName: string;
  sourceOrder: number;
  rawCall?: ModelToolCall;
  persistedCall: boolean;
  modelInput: Record<string, unknown>;
  executedInput?: Record<string, unknown>;
  toolSchema?: unknown;
  cwd?: string;
  intent?: ToolIntent;
  outcome?: PendingOutcome;
  archiveSource?: ObservationSource;
  archiveParts?: ObservationPartInput[];
  resultText?: string;
  largeResult?: boolean;
  resultSummary?: ResolvedArchiveText;
  frozenResultPath?: string;
  frozenVisibleResultSource?: StreamPartSource;
  observedResultText?: string;
  observedResultPreview?: string;
  observedResultTail?: string;
  observedResultSamples?: string[];
  observedResultTruncated?: boolean;
  observedResultBytes?: number;
  observedResultDetails?: unknown;
  observedSemanticDetails?: unknown;
  observedFullOutputPath?: string;
  observedDetailsComparable?: boolean;
  observedResultIsError?: boolean;
  admittedCapsule?: string;
  rawResult?: ToolResultMessageLike;
  persistedResultChanged?: boolean;
  persistedCanonicalResultChanged?: boolean;
  persistedTextChanged?: boolean;
  persistedPathChanged?: boolean;
  replayProtected?: boolean;
  replayOriginKey?: string;
  completed: boolean;
}

function restorePersistedCommand(exchange: PendingExchange): void {
  if (exchange.persistedCall && exchange.toolName === "bash" && exchange.intent) {
    exchange.intent.command = typeof exchange.modelInput.command === "string" ? exchange.modelInput.command : "";
  }
}

export interface ToolExecutionStartLike {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolCallLike {
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
}

export interface ToolResultLike extends ToolCallLike {
  details?: unknown;
  isError: boolean;
}

export interface ExchangeSemanticContext {
  taskKey?: string;
  goalId?: string;
  branchAnchorId?: string;
  turnSequence?: number;
  requirementsRevision?: number;
  workspaceRevisionAtStart?: number;
  workspaceRevisionAtResult?: number;
}

interface AssistantMessageLike {
  role?: string;
  content?: unknown;
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  try {
    return structuredClone(value);
  } catch {
    return { ...value };
  }
}

function cloneUnknown(value: unknown): unknown {
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
}

export function boundedResultTextStats(
  content: unknown,
  maxBytes = Number.POSITIVE_INFINITY,
): { text: string; textBytes: number; truncated: boolean; tail: string; samples: string[] } {
  if (!Array.isArray(content)) {
    return { text: "", textBytes: 0, truncated: false, tail: "", samples: ["0", "", "", "", "", ""] };
  }
  let totalChars = 0;
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const candidate = block as Record<string, unknown>;
    if (candidate.type !== "text" || typeof candidate.text !== "string" || candidate.text.length === 0) continue;
    totalChars += candidate.text.length;
  }
  const centers = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.floor(totalChars * ratio));
  const windows = centers.map((center) => ({
    start: Math.max(0, center - 64),
    end: Math.min(totalChars, center + 64),
  }));
  const aggregateSamples = windows.map(() => "");
  const tailStart = Math.max(0, totalChars - 4096);
  const keptChunks: string[] = [];
  let pendingKept: string[] = [];
  let keptBytes = 0;
  let textBytes = 0;
  let tail = "";
  let charOffset = 0;
  const flushKept = (): void => {
    if (pendingKept.length === 0) return;
    keptChunks.push(pendingKept.join(""));
    pendingKept = [];
  };
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const candidate = block as Record<string, unknown>;
    if (candidate.type !== "text" || typeof candidate.text !== "string" || candidate.text.length === 0) continue;
    const value = candidate.text;
    const blockStart = charOffset;
    const blockEnd = blockStart + value.length;
    for (const [index, window] of windows.entries()) {
      const overlapStart = Math.max(blockStart, window.start);
      const overlapEnd = Math.min(blockEnd, window.end);
      if (overlapStart < overlapEnd) {
        aggregateSamples[index] += value.slice(overlapStart - blockStart, overlapEnd - blockStart);
      }
    }
    if (blockEnd > tailStart) {
      tail += value.slice(Math.max(0, tailStart - blockStart));
    }
    charOffset = blockEnd;
    const bytes = Buffer.byteLength(value, "utf8");
    textBytes += bytes;
    if (keptBytes >= maxBytes) continue;
    if (keptBytes + bytes <= maxBytes) {
      pendingKept.push(value);
      keptBytes += bytes;
      if (pendingKept.length >= 1024) flushKept();
      continue;
    }
    const remaining = Math.max(0, maxBytes - keptBytes);
    let low = 0;
    let high = Math.min(value.length, remaining);
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (Buffer.byteLength(value.slice(0, middle), "utf8") <= remaining) low = middle;
      else high = middle - 1;
    }
    if (low > 0) {
      const code = value.charCodeAt(low - 1);
      if (code >= 0xd800 && code <= 0xdbff) low -= 1;
    }
    const prefix = value.slice(0, low);
    pendingKept.push(prefix);
    keptBytes += Buffer.byteLength(prefix, "utf8");
    flushKept();
  }
  flushKept();
  return {
    text: keptChunks.join(""),
    textBytes,
    truncated: textBytes > keptBytes,
    tail,
    samples: [String(totalChars), ...aggregateSamples],
  };
}

const joinedResultText = boundedResultTextStats;

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function typedTextPart(
  name: string,
  kind: ObservationPartInput["kind"],
  text: unknown,
  mediaType = "text/plain; charset=utf-8",
): ObservationPartInput | undefined {
  return typeof text === "string" && text.length > 0 ? { name, kind, text, mediaType } : undefined;
}

function safeJson(value: unknown): string | undefined {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return undefined;
  }
}

/** Extract final typed parts from native details and content without interpreting provisional results. */
export function extractFinalTypedParts(result: ToolResultMessageLike): ObservationPartInput[] {
  const parts: ObservationPartInput[] = [];
  const details = objectValue(result.details);
  const add = (part: ObservationPartInput | undefined): void => {
    if (part) parts.push(part);
  };

  add(typedTextPart("diff", "diff", details?.diff));
  add(typedTextPart("stdout", "stdout", details?.stdout));
  add(typedTextPart("stderr", "stderr", details?.stderr));
  add(typedTextPart("result-value", "result", details?.result));

  const error = objectValue(details?.error);
  const traceback = Array.isArray(error?.traceback)
    ? error.traceback.filter((line): line is string => typeof line === "string").join("\n")
    : typeof error?.traceback === "string"
      ? error.traceback
      : typeof details?.traceback === "string"
        ? details.traceback
        : undefined;
  add(typedTextPart("traceback", "traceback", traceback));
  if (error) add(typedTextPart("error", "traceback", safeJson(error), "application/json"));
  if (Array.isArray(details?.diffs) && details.diffs.length > 0) {
    add(typedTextPart("diffs", "diff", safeJson(details.diffs), "application/json"));
  }
  if (Array.isArray(details?.sentAgentMessages) && details.sentAgentMessages.length > 0) {
    add(typedTextPart(
      "sent-agent-messages",
      "result",
      safeJson(details.sentAgentMessages),
      "application/json",
    ));
  }

  if (Array.isArray(details?.attachments)) {
    for (const [index, raw] of details.attachments.entries()) {
      const attachment = objectValue(raw);
      if (!attachment || typeof attachment.data !== "string") continue;
      parts.push({
        name: `attachment:${index + 1}`,
        kind: "attachment",
        ...(typeof attachment.mimeType === "string" ? { mediaType: attachment.mimeType } : {}),
        binaryBase64: attachment.data,
      });
    }
  }

  if (Array.isArray(result.content)) {
    let imageIndex = 0;
    for (const raw of result.content) {
      const block = objectValue(raw);
      if (block?.type !== "image" || typeof block.data !== "string") continue;
      imageIndex += 1;
      parts.push({
        name: `image:${imageIndex}`,
        kind: "image",
        ...(typeof block.mimeType === "string" ? { mediaType: block.mimeType } : {}),
        binaryBase64: block.data,
        ...(typeof block.width === "number" ? { width: block.width } : {}),
        ...(typeof block.height === "number" ? { height: block.height } : {}),
      });
    }
  }
  return parts;
}

function capturesByToolCall(
  captures: BuildExchangeFactsInput["pendingFullOutputs"],
): ReadonlyMap<string, PendingFullOutputCapture> {
  if (!captures) return new Map();
  if (Array.isArray(captures)) {
    return new Map(captures.map((capture: PendingFullOutputCapture) => [capture.toolCallId, capture]));
  }
  return captures as ReadonlyMap<string, PendingFullOutputCapture>;
}

function boundedFactText(value: string, maxBytes = 2048): string {
  if (Buffer.byteLength(value, "utf8") <= maxBytes) return value;
  let low = 0;
  let high = value.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(value.slice(0, middle), "utf8") <= maxBytes) low = middle;
    else high = middle - 1;
  }
  if (low > 0 && /[\uD800-\uDBFF]/.test(value[low - 1])) low -= 1;
  return value.slice(0, low);
}

function progressObservationText(outcome: OutcomeSummary): string {
  const candidates = [
    outcome.testSummary,
    ...outcome.commandFailures,
    ...outcome.exceptions,
    ...outcome.failingTests,
    ...outcome.sourceLocations,
    ...(outcome.status === "failure" ? outcome.exitStatuses : []),
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  return boundedFactText([...new Set(candidates)].slice(0, 3).join("; "));
}

function exchangeArtifacts(details: unknown, toolCallId: string): ExchangeArtifact[] {
  const native = objectValue(details);
  if (!native) return [];
  const artifacts: ExchangeArtifact[] = [];
  const seen = new Set<string>();
  const add = (pathOrId: unknown, description?: unknown): void => {
    if (typeof pathOrId !== "string" || pathOrId.length === 0 || seen.has(pathOrId) || artifacts.length >= 12) return;
    seen.add(pathOrId);
    artifacts.push({
      pathOrId,
      ...(typeof description === "string" && description.length > 0 ? { description } : {}),
      sourceToolCallId: toolCallId,
    });
  };
  for (const key of ["artifactPath", "outputPath", "createdPath", "downloadPath", "artifactId"] as const) {
    add(native[key]);
  }
  if (Array.isArray(native.artifacts)) {
    for (const value of native.artifacts) {
      if (typeof value === "string") add(value);
      else {
        const artifact = objectValue(value);
        add(artifact?.pathOrId ?? artifact?.path ?? artifact?.id, artifact?.description);
      }
    }
  }
  return artifacts;
}

function deriveProgressEffect(
  toolCallId: string,
  intent: ToolIntent,
  outcome: OutcomeSummary,
  isError: boolean,
  text: string,
  details: unknown,
): ProgressEffect {
  const observation: ActionableObservation = {
    text: progressObservationText(outcome),
    ...(intent.resources[0] ? { resource: intent.resources[0] } : {}),
    sourceToolCallId: toolCallId,
  };
  if (isError || outcome.status === "failure") {
    return {
      kind: "failure",
      observation: observation.text ? observation : { ...observation, text: "Tool execution failed." },
    };
  }
  const artifacts = exchangeArtifacts(details, toolCallId);
  if (intent.mutatesWorkspace || artifacts.length > 0) {
    return { kind: "mutation", ...(artifacts.length > 0 ? { artifacts } : {}) };
  }
  return observation.text
    ? { kind: "information", observations: [observation] }
    : { kind: "none" };
}

/** Build one canonical fact object per final exchange, deterministically in source order. */
function captureMatchesFinalResult(
  capture: PendingFullOutputCapture | undefined,
  visible: ReturnType<typeof boundedResultTextStats>,
  result: ToolResultMessageLike,
): capture is PendingFullOutputCapture {
  if (!capture || capture.isError !== (result.isError === true) ||
      capture.visibleBytes !== visible.textBytes || capture.visibleTruncated !== visible.truncated ||
      capture.visibleTail !== visible.tail || capture.publicFullOutputPath !== fullOutputPath(result.details) ||
      capture.visibleSamples?.length !== visible.samples.length ||
      !capture.visibleSamples.every((sample, index) => sample === visible.samples[index])) return false;
  if (!visible.truncated && capture.visibleText !== visible.text) return false;
  try {
    return JSON.stringify(capture.semanticDetails) === JSON.stringify(semanticDetailsSnapshot(result.details));
  } catch {
    return false;
  }
}

export function buildExchangeFacts(input: BuildExchangeFactsInput): ExchangeFacts[] {
  const captures = capturesByToolCall(input.pendingFullOutputs);
  return input.exchanges
    .map((exchange, inputOrder) => ({ exchange, inputOrder }))
    .sort((left, right) =>
      left.exchange.sourceOrder - right.exchange.sourceOrder || left.inputOrder - right.inputOrder
    )
    .map(({ exchange }) => {
      const originalInput = exchange.originalInput;
      const executedInput = exchange.executedInput;
      const finalResult = exchange.result as ToolResultMessageLike;
      const normalizedContent = typeof finalResult.content === "string"
        ? [{ type: "text", text: finalResult.content }]
        : finalResult.content;
      const visible = joinedResultText(normalizedContent);
      const typedParts = (input.extractTypedParts
        ? input.extractTypedParts(exchange)
        : extractFinalTypedParts(finalResult)).map((part) => ({ ...part }));
      const intent = parseToolIntent({
        toolName: exchange.toolName,
        originalInput,
        ...(executedInput === undefined ? {} : { executedInput }),
        nativeDetails: finalResult.details,
        exchangeId: `exchange:${exchange.toolCallId}`,
        toolCallId: exchange.toolCallId,
        cwd: input.cwd,
        toolSchema: input.toolSchemas?.get(exchange.toolName),
      });
      const isError = finalResult.isError === true;
      const capture = captures.get(exchange.toolCallId);
      const authoritativeCapture = captureMatchesFinalResult(capture, visible, finalResult) ? capture : undefined;
      const factualText = authoritativeCapture?.text ?? visible.text;
      const outcome = collectFactualOutcome(intent, factualText, isError, finalResult.details);
      const progress = deriveProgressEffect(
        exchange.toolCallId,
        intent,
        outcome,
        isError,
        factualText,
        finalResult.details,
      );
      return {
        sourceOrder: exchange.sourceOrder,
        toolCallId: exchange.toolCallId,
        toolName: exchange.toolName,
        originalInput,
        ...(executedInput === undefined ? {} : { executedInput }),
        executionMode: input.executionMode,
        finalResult,
        text: factualText,
        textBytes: Buffer.byteLength(factualText, "utf8"),
        typedParts,
        intent,
        outcome,
        progress,
        ...(authoritativeCapture?.path ? { fullOutputSnapshotPath: authoritativeCapture.path } : {}),
      };
    });
}

const AGGREGATE_CALL_BYTES = 24 * 1024;
const AGGREGATE_FIELD_MARKER_BYTES = 768;

function jsonPointerToken(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function aggregateFieldText(value: unknown): { text: string; mediaType: string } | undefined {
  if (typeof value === "string") {
    return { text: value, mediaType: "text/plain; charset=utf-8" };
  }
  try {
    const text = JSON.stringify(value);
    return text === undefined ? undefined : { text, mediaType: "application/json" };
  } catch {
    return undefined;
  }
}

/**
 * The archive's recursive fallback catches one large subtree. This handles the
 * other generic case: a large root object made from many useful, smaller
 * top-level fields. Archive only fields whose replacement marker saves space.
 */
export function aggregateGenericCallParts(
  toolName: string,
  input: Record<string, unknown>,
  maxBytes = AGGREGATE_CALL_BYTES,
  preArchived: readonly ObservationPartInput[] = [],
): ObservationPartInput[] {
  const preArchivedSavings = preArchived.reduce((total, part) => total + Math.max(0,
    Buffer.byteLength(part.text ?? "", "utf8") - 1024
  ), 0);
  if (["edit", "ipython", "bash"].includes(toolName) || jsonBytes(input) - preArchivedSavings <= maxBytes) return [];
  const candidates = Object.entries(input).flatMap(([key, value]) => {
    const serialized = aggregateFieldText(value);
    if (!serialized) return [];
    const textBytes = Buffer.byteLength(serialized.text, "utf8");
    // Larger fields are already handled by the recursive archive fallback.
    if (textBytes <= AGGREGATE_FIELD_MARKER_BYTES || textBytes > maxBytes) return [];
    return [{
      key,
      textBytes,
      part: {
        name: "call",
        kind: "call-field" as const,
        pointer: `/${jsonPointerToken(key)}`,
        mediaType: serialized.mediaType,
        text: serialized.text,
      },
    }];
  }).sort((left, right) => right.textBytes - left.textBytes || left.key.localeCompare(right.key));

  let projectedBytes = jsonBytes(input) - preArchivedSavings;
  const selected: ObservationPartInput[] = [];
  for (const candidate of candidates) {
    selected.push(candidate.part);
    projectedBytes -= candidate.textBytes - AGGREGATE_FIELD_MARKER_BYTES;
    if (projectedBytes <= maxBytes) break;
  }
  if (projectedBytes <= maxBytes) return selected;
  const root = aggregateFieldText(input);
  return root ? [{
    name: "call",
    kind: "call-field",
    pointer: "",
    mediaType: "application/json",
    text: root.text,
  }] : selected;
}

const SEMANTIC_DETAIL_KEYS = [
  "fullOutputPath", "status", "error", "errorEname", "diffs", "resources", "exitCode", "code", "signal",
  "firstChangedLine", "middlewareTag", "stdout", "stderr", "result", "traceback",
];

function semanticDetailsSnapshot(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    const textBytes = Buffer.byteLength(value, "utf8");
    if (textBytes <= 2048) return value;
    const samples: string[] = [];
    for (const ratio of [0.25, 0.5, 0.75]) {
      const center = Math.floor(value.length * ratio);
      samples.push(value.slice(Math.max(0, center - 64), Math.min(value.length, center + 64)));
    }
    return { textBytes, head: value.slice(0, 512), tail: value.slice(-512), samples };
  }
  if (Array.isArray(value)) {
    return {
      length: value.length,
      values: value.slice(0, 32).map((item) => semanticDetailsSnapshot(item, depth + 1)),
    };
  }
  if (!value || typeof value !== "object" || depth >= 4) return typeof value;
  const object = value as Record<string, unknown>;
  const keys = [...Object.keys(object)].sort((left, right) => {
    const leftPriority = SEMANTIC_DETAIL_KEYS.indexOf(left);
    const rightPriority = SEMANTIC_DETAIL_KEYS.indexOf(right);
    const leftRank = leftPriority < 0 ? SEMANTIC_DETAIL_KEYS.length : leftPriority;
    const rightRank = rightPriority < 0 ? SEMANTIC_DETAIL_KEYS.length : rightPriority;
    return leftRank - rightRank || left.localeCompare(right);
  }).slice(0, 32);
  return Object.fromEntries(keys.map((key) => [key, semanticDetailsSnapshot(object[key], depth + 1)]));
}

function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function fullOutputPath(details: unknown): string | undefined {
  if (!details || typeof details !== "object") return undefined;
  const path = (details as Record<string, unknown>).fullOutputPath;
  return typeof path === "string" ? path : undefined;
}

function persistedToolCalls(message: AssistantMessageLike): ModelToolCall[] {
  if (message.role !== "assistant" || !Array.isArray(message.content)) return [];
  return message.content.filter((block): block is ModelToolCall => {
    if (!block || typeof block !== "object") return false;
    const candidate = block as Partial<ModelToolCall>;
    return candidate.type === "toolCall" && typeof candidate.id === "string" &&
      typeof candidate.name === "string" && Boolean(candidate.arguments) && typeof candidate.arguments === "object";
  });
}

export class ExchangeTracker {
  private readonly pending = new Map<string, PendingExchange>();
  private sequence = 0;

  constructor(private readonly maxPending = 256) {}

  resetSession(): void {
    this.pending.clear();
    this.sequence = 0;
  }

  clearPending(): void {
    this.pending.clear();
  }

  setMinimumSequence(sequence: number): void {
    if (Number.isSafeInteger(sequence) && sequence > this.sequence) this.sequence = sequence;
  }

  reset(): void {
    this.resetSession();
  }

  start(event: ToolExecutionStartLike): PendingExchange {
    const existing = this.pending.get(event.toolCallId);
    if (existing) return existing;
    this.makeRoom();
    this.sequence += 1;
    const modelInput = cloneRecord(event.args);
    const exchange: PendingExchange = {
      id: `o${this.sequence}`,
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      sourceOrder: this.sequence,
      modelInput,
      persistedCall: false,
      rawCall: {
        type: "toolCall",
        id: event.toolCallId,
        name: event.toolName,
        arguments: modelInput,
      },
      completed: false,
    };
    this.pending.set(event.toolCallId, exchange);
    return exchange;
  }

  noteCall(event: ToolCallLike, cwd: string, toolSchema?: unknown): PendingExchange {
    const exchange = this.pending.get(event.toolCallId) ?? this.start({
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      args: event.input,
    });
    exchange.executedInput = cloneRecord(event.input);
    exchange.toolSchema = toolSchema;
    exchange.cwd = cwd;
    exchange.intent = adaptToolIntent({
      exchangeId: exchange.id,
      toolCallId: exchange.toolCallId,
      toolName: event.toolName,
      input: exchange.executedInput,
      cwd,
      modelInputBytes: jsonBytes(exchange.modelInput),
      toolSchema: exchange.toolSchema,
    });
    restorePersistedCommand(exchange);
    return exchange;
  }

  noteResult(
    event: ToolResultLike,
    cwd: string,
    resultText: string,
    archive?: {
      source?: ObservationSource;
      parts?: readonly ObservationPartInput[];
      retainResultText?: boolean;
      visibleResultText?: string;
      visibleResultBytes?: number;
      visibleResultTruncated?: boolean;
      visibleResultTail?: string;
      visibleResultSamples?: string[];
      outcomeText?: string;
      resultSummary?: ResolvedArchiveText;
      large?: boolean;
    },
  ): PendingExchange {
    const exchange = this.pending.get(event.toolCallId) ?? this.start({
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      args: event.input,
    });
    exchange.executedInput = cloneRecord(event.input);
    exchange.cwd = cwd;
    exchange.archiveSource = archive?.source;
    exchange.largeResult = archive?.large === true;
    exchange.resultSummary = archive?.resultSummary;
    exchange.archiveParts = archive?.parts?.map((part) => ({ ...part }));
    const observedResultText = archive?.visibleResultText ?? resultText;
    const observedBounded = joinedResultText([{ type: "text", text: observedResultText }], 1024 * 1024);
    exchange.observedResultBytes = archive?.visibleResultBytes ?? observedBounded.textBytes;
    exchange.observedResultPreview = observedBounded.text;
    exchange.observedResultTail = archive?.visibleResultTail ?? observedBounded.tail;
    exchange.observedResultSamples = archive?.visibleResultSamples ?? observedBounded.samples;
    exchange.observedResultTruncated = archive?.visibleResultTruncated === true || observedBounded.truncated;
    if (!exchange.observedResultTruncated && exchange.observedResultBytes <= 1024 * 1024) {
      exchange.observedResultText = observedResultText;
    } else {
      delete exchange.observedResultText;
    }
    exchange.observedFullOutputPath = fullOutputPath(event.details);
    exchange.observedSemanticDetails = semanticDetailsSnapshot(event.details);
    exchange.observedDetailsComparable = archive?.large !== true && exchange.observedResultBytes <= 1024 * 1024;
    if (exchange.observedDetailsComparable) exchange.observedResultDetails = cloneUnknown(event.details);
    else delete exchange.observedResultDetails;
    exchange.observedResultIsError = event.isError;
    if (archive?.retainResultText === false) delete exchange.resultText;
    else exchange.resultText = resultText;
    exchange.completed = true;
    return exchange;
  }

  noteCanonicalFacts(exchange: PendingExchange, facts: ExchangeFacts): void {
    exchange.intent = structuredClone(facts.intent);
    restorePersistedCommand(exchange);
    exchange.outcome = {
      isError: facts.finalResult.isError ?? false,
      outcome: structuredClone(facts.outcome),
    };
  }

  noteCanonicalResult(
    exchange: PendingExchange,
    resolved: ResolvedArchiveText,
    parts: readonly ObservationPartInput[],
    facts: ExchangeFacts,
  ): void {
    exchange.archiveSource = resolved.source;
    exchange.archiveParts = parts.map((part) => ({ ...part }));
    exchange.resultText = resolved.text;
    exchange.largeResult = resolved.large === true;
    exchange.resultSummary = resolved;
    delete exchange.admittedCapsule;
    this.noteCanonicalFacts(exchange, facts);
  }

  get(toolCallId: string): PendingExchange | undefined {
    return this.pending.get(toolCallId);
  }

  pendingFullOutputSources(): { toolCallId: string; path: string }[] {
    return [...this.pending.values()].flatMap((exchange) =>
      exchange.frozenResultPath && !exchange.resultSummary
        ? [{ toolCallId: exchange.toolCallId, path: exchange.frozenResultPath }]
        : []
    );
  }

  noteResolvedFullOutput(toolCallId: string, resolved: ResolvedArchiveText): void {
    const exchange = this.pending.get(toolCallId);
    if (!exchange) return;
    exchange.archiveSource = resolved.source;
    exchange.resultSummary = resolved;
    exchange.largeResult = resolved.large === true;
  }

  pendingFullOutputCaptures(): PendingFullOutputCapture[] {
    return [...this.pending.values()].flatMap((exchange) =>
      exchange.frozenResultPath && exchange.resultSummary
        ? [{
            toolCallId: exchange.toolCallId,
            path: exchange.frozenResultPath,
            text: exchange.resultSummary.text,
            visibleText: exchange.observedResultText,
            visibleBytes: exchange.observedResultBytes,
            visibleTruncated: exchange.observedResultTruncated,
            visibleTail: exchange.observedResultTail,
            visibleSamples: exchange.observedResultSamples,
            publicFullOutputPath: exchange.observedFullOutputPath,
            semanticDetails: exchange.observedSemanticDetails,
            isError: exchange.observedResultIsError,
          }]
        : []
    );
  }

  noteAdmittedCapsule(toolCallId: string, capsule: string | undefined): void {
    const exchange = this.pending.get(toolCallId);
    if (exchange && capsule) exchange.admittedCapsule = capsule;
  }

  finishTurn(
    message: AssistantMessageLike,
    toolResults?: readonly ToolResultMessageLike[],
    finalizedExchanges?: readonly FinalizedToolExchange[],
  ): PendingExchange[] {
    const order = new Map<string, number>();
    const calls = new Map<string, ModelToolCall>();
    for (const [index, call] of persistedToolCalls(message).entries()) {
      order.set(call.id, index);
      calls.set(call.id, call);
      const exchange = this.pending.get(call.id);
      if (exchange) {
        exchange.sourceOrder = index;
        exchange.rawCall = call;
        exchange.replayProtected = hasOpaqueReplayMetadata(call);
        exchange.persistedCall = true;
        exchange.modelInput = cloneRecord(call.arguments);
        if (exchange.intent) {
          exchange.intent.modelInputBytes = jsonBytes(call.arguments);
          if (exchange.toolName === "bash") {
            exchange.intent.command = typeof call.arguments.command === "string" ? call.arguments.command : "";
          }
        }
      }
    }
    if (finalizedExchanges) {
      for (const finalized of finalizedExchanges) {
        const originalInput = finalized.originalInput && typeof finalized.originalInput === "object"
          ? cloneRecord(finalized.originalInput as Record<string, unknown>)
          : {};
        let exchange = this.pending.get(finalized.toolCallId);
        if (!exchange) {
          exchange = this.start({
            toolCallId: finalized.toolCallId,
            toolName: finalized.toolName,
            args: originalInput,
          });
        }
        exchange.sourceOrder = finalized.sourceOrder;
        exchange.toolName = finalized.toolName;
        exchange.modelInput = originalInput;
        exchange.executedInput = finalized.executedInput && typeof finalized.executedInput === "object"
          ? cloneRecord(finalized.executedInput as Record<string, unknown>)
          : undefined;
        exchange.rawResult = finalized.result;
        exchange.rawCall = calls.get(finalized.toolCallId);
        exchange.persistedCall = exchange.rawCall !== undefined;
        exchange.completed = true;
      }
    }
    const exactResults = finalizedExchanges
      ? new Map(finalizedExchanges.map((exchange) => [exchange.toolCallId, exchange.result]))
      : toolResults === undefined ? undefined : new Map(toolResults.map((result) => [result.toolCallId, result]));
    const finalizedIds = finalizedExchanges && new Set(finalizedExchanges.map((exchange) => exchange.toolCallId));
    const completed = [...this.pending.values()]
      .filter((exchange) => finalizedIds
        ? finalizedIds.has(exchange.toolCallId)
        : exchange.completed && (exactResults === undefined || (exchange.persistedCall && exactResults.has(exchange.toolCallId))))
      .sort((left, right) => {
        const leftOrder = order.get(left.toolCallId) ?? left.sourceOrder;
        const rightOrder = order.get(right.toolCallId) ?? right.sourceOrder;
        return leftOrder - rightOrder;
      });
    for (const exchange of completed) {
      const rawResult = exactResults?.get(exchange.toolCallId);
      exchange.rawResult = rawResult;
      if (!rawResult) continue;
      if (exchange.observedResultBytes === undefined) {
        exchange.persistedResultChanged = false;
        exchange.persistedTextChanged = false;
        exchange.persistedPathChanged = false;
        exchange.persistedCanonicalResultChanged = false;
        continue;
      }
      const persisted = joinedResultText(rawResult.content, exchange.largeResult ? 64 * 1024 : Number.POSITIVE_INFINITY);
      const persistedText = persisted.text;
      const persistedIsError = rawResult.isError ?? exchange.observedResultIsError ?? exchange.outcome?.isError ?? false;
      const textChanged = persisted.textBytes !== (exchange.observedResultBytes ?? 0) ||
        (exchange.observedResultText !== undefined && !persisted.truncated
          ? persistedText !== exchange.observedResultText
          : persistedText !== (exchange.observedResultPreview ?? "") ||
            persisted.tail !== (exchange.observedResultTail ?? "") ||
            !sameJson(persisted.samples, exchange.observedResultSamples ?? []));
      const errorChanged = persistedIsError !== exchange.observedResultIsError;
      const finalSemanticDetails = semanticDetailsSnapshot(rawResult.details);
      const semanticDetailsChanged = !sameJson(finalSemanticDetails, exchange.observedSemanticDetails);
      const detailsChanged = exchange.observedDetailsComparable === false
        ? semanticDetailsChanged
        : !sameJson(rawResult.details, exchange.observedResultDetails);
      const pathChanged = fullOutputPath(rawResult.details) !== exchange.observedFullOutputPath;
      exchange.persistedResultChanged = textChanged || errorChanged || detailsChanged;
      exchange.persistedTextChanged = textChanged;
      exchange.persistedPathChanged = pathChanged;
      exchange.persistedCanonicalResultChanged = textChanged || errorChanged || pathChanged ||
        (exchange.toolName !== "bash" && semanticDetailsChanged);
      if (exchange.persistedResultChanged && exchange.intent) {
        const outcomeText = textChanged
          ? persistedText
          : exchange.resultSummary?.outcomeText ?? exchange.resultText ?? persistedText;
        exchange.intent = adaptToolIntent({
          exchangeId: exchange.id,
          toolCallId: exchange.toolCallId,
          toolName: exchange.toolName,
          input: exchange.executedInput ?? exchange.modelInput,
          cwd: exchange.cwd ?? exchange.intent.effectiveCwd ?? "",
          modelInputBytes: jsonBytes(exchange.modelInput),
          toolSchema: exchange.toolSchema,
          details: rawResult.details,
          resultText: outcomeText,
          isError: persistedIsError,
        });
        if (exchange.toolName === "bash") {
          exchange.intent.command = typeof exchange.modelInput.command === "string" ? exchange.modelInput.command : "";
        }
        exchange.outcome = {
          isError: persistedIsError,
          outcome: collectFactualOutcome(exchange.intent, outcomeText, persistedIsError, rawResult.details),
        };
      }
    }
    for (const exchange of completed) this.pending.delete(exchange.toolCallId);
    return completed;
  }

  toObservationMetadata(
    exchange: PendingExchange,
    semantic: ExchangeSemanticContext = {},
  ): ExchangeObservationMetadata | undefined {
    if (!exchange.intent || !exchange.outcome) return undefined;
    return {
      exchangeId: exchange.id,
      toolCallId: exchange.toolCallId,
      intentKind: exchange.intent.kind,
      subjectKey: exchange.intent.subjectKey,
      resources: [...exchange.intent.resources],
      suite: exchange.intent.suite ? { ...exchange.intent.suite } : undefined,
      effectiveCwd: exchange.intent.effectiveCwd,
      mutatesWorkspace: exchange.intent.mutatesWorkspace,
      modelInputBytes: exchange.intent.modelInputBytes,
      executedInputBytes: exchange.intent.executedInputBytes,
      facts: exchange.intent.facts ? { ...exchange.intent.facts } : undefined,
      outcome: exchange.outcome.outcome,
      ...semantic,
    };
  }

  private makeRoom(): void {
    if (this.pending.size < this.maxPending) return;
    const completed = [...this.pending.entries()].find(([, exchange]) => exchange.completed);
    this.pending.delete(completed?.[0] ?? this.pending.keys().next().value as string);
  }
}
