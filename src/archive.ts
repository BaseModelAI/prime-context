import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { promisify } from "node:util";
import { createGunzip, gunzip } from "node:zlib";
import type { ImageContent, TextContent } from "@earendil-works/pi-ai";
import {
  ObservationBroker,
  type BrokerContextState,
  type BrokerPersistentState,
  type BrokerStats,
} from "./broker.js";
import {
  adaptiveCapsuleMaxBytes,
  analyzeOutcome,
  hasTerminalOutcome,
  isLowSignalTraceOutput,
  isRepetitiveOutput,
  renderBoundedCapsule,
  renderCapsule,
  splitVisibleLines,
  truncateUtf8,
  utf8Bytes,
  type CapsuleContextUsage,
  type OutcomeSummary,
} from "./capsule.js";
import { aggregateGenericCallParts } from "./exchange.js";
import type { IntentKind, SuiteIdentity, ToolIntentFacts } from "./intent.js";
import {
  LARGE_TEXT_BYTES,
  sourceBytes,
  summarizePartSource,
  writeTextChunks,
  type SourceLineRecord,
  type StreamPartSource,
  type TextSourceSummary,
} from "./envelope.js";
import {
  compactArchivedCallArguments,
  hasOpaqueReplayMetadata,
  hasOpaqueResultContent,
  selectFixedExchangeViews,
  type FixedExchangeView,
  type FixedViewCandidate,
  type ProjectedImageRef,
} from "./projection.js";

const gunzipAsync = promisify(gunzip);
export const RECOVERY_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export type ObservationSource = "visible-tool-result" | "public-complete-output";

export type ObservationPartKind =
  | "call"
  | "call-field"
  | "result"
  | "diff"
  | "stdout"
  | "stderr"
  | "traceback"
  | "attachment"
  | "image";

export interface ObservationChunk {
  relativeFile: string;
  firstLine?: number;
  lineCount?: number;
  textBytes: number;
}

export interface ObservationPart {
  name: string;
  kind: ObservationPartKind;
  pointer?: string;
  mediaType?: string;
  textBytes?: number;
  lineCount?: number;
  binaryBytes?: number;
  width?: number;
  height?: number;
  chunks: ObservationChunk[];
}

export interface ObservationPartInput {
  name: string;
  kind: ObservationPartKind;
  pointer?: string;
  mediaType?: string;
  text?: string;
  source?: StreamPartSource;
  binaryBase64?: string;
  width?: number;
  height?: number;
}

export interface ExchangeObservationMetadata {
  exchangeId: string;
  toolCallId: string;
  intentKind: IntentKind;
  subjectKey: string;
  resources: string[];
  suite?: SuiteIdentity;
  effectiveCwd?: string;
  mutatesWorkspace: boolean;
  modelInputBytes: number;
  executedInputBytes: number;
  facts?: ToolIntentFacts;
  outcome: OutcomeSummary;
  taskKey?: string;
  goalId?: string;
  branchAnchorId?: string;
  turnSequence?: number;
  requirementsRevision?: number;
  workspaceRevisionAtStart?: number;
  workspaceRevisionAtResult?: number;
  forkImported?: boolean;
}

function capsuleFactualLines(
  exchange: ExchangeObservationMetadata | undefined,
  outcome: OutcomeSummary,
): string[] {
  if (!exchange) return [];
  const facts = exchange.facts;
  return [
    ...(outcome.status === "unknown" ? [] : [`Outcome: ${outcome.status}.`]),
    ...(exchange?.suite ? [`Suite: ${exchange.suite.family}:${exchange.suite.target} [${exchange.suite.scope}].`] : []),
    ...(exchange?.workspaceRevisionAtResult === undefined
      ? []
      : [`Workspace at execution: w${exchange.workspaceRevisionAtResult}.`]),
    ...(outcome.testSummary ? [`Tests: ${outcome.testSummary}.`] : []),
    ...outcome.failingTests.map((value) => `Failing test: ${value}`),
    ...outcome.exceptions.map((value) => `Exception: ${value}`),
    ...outcome.sourceLocations.map((value) => `Source: ${value}`),
    ...outcome.exitStatuses.map((value) => `Command: ${value}`),
    ...outcome.commandFailures.map((value) => `Failure: ${value}`),
    ...(exchange.intentKind === "edit" && exchange.resources[0]
      ? [`Resource: ${exchange.resources[0]}.`]
      : []),
    ...(typeof facts?.editCount === "number" ? [`Edit count: ${facts.editCount}.`] : []),
    ...(typeof facts?.firstChangedLine === "number" ? [`First changed line: ${facts.firstChangedLine}.`] : []),
    ...(exchange.intentKind === "edit" && typeof facts?.diffBytes === "number"
      ? [`Diff: ${exchange.exchangeId}:diff (${facts.diffBytes} bytes).`]
      : []),
    ...(typeof facts?.truncation === "string" ? [`Output truncation: ${facts.truncation}.`] : []),
    ...(facts?.kernelRestarted === "true" ? ["Kernel restarted: true."] : []),
    ...(typeof facts?.durationMs === "number" ? [`Kernel duration: ${facts.durationMs} ms.`] : []),
  ];
}

export interface ObservationEnvelopeV2 {
  schema: "prime-context.exchange/v2";
  id: string;
  toolCallId: string;
  toolName: string;
  intentKind: IntentKind;
  subjectKey: string;
  resources: string[];
  suite?: SuiteIdentity;
  taskKey: string;
  goalId?: string;
  branchAnchorId: string;
  turnSequence: number;
  requirementsRevision: number;
  workspaceRevisionAtStart: number;
  workspaceRevisionAtResult: number;
  isError: boolean;
  outcome: OutcomeSummary;
  callSummary: string;
  resultCapsule: string;
  parts: ObservationPart[];
  source?: ObservationSource;
  createdAt: string;
  effectiveCwd?: string;
  mutatesWorkspace: boolean;
  modelInputBytes: number;
  executedInputBytes: number;
  facts?: ToolIntentFacts;
  forkImported?: boolean;
  fixedView?: FixedExchangeView;
}

export interface ObservationEnvelopeIndexRefV2 {
  schema: "prime-context.exchange/v2";
  id: string;
  relativeFile: string;
}

export interface ObservationRecord {
  id: string;
  relativeFile: string;
  toolName: string;
  isError: boolean;
  textBytes: number;
  lineCount: number;
  createdAt: string;
  source?: ObservationSource;
  exchange?: ExchangeObservationMetadata;
  envelope?: ObservationEnvelopeV2;
  partRefs?: string[];
}

export interface ObservationIndexV1 {
  schema: "prime-context.observation-index/v1";
  observations: Array<ObservationRecord | ObservationEnvelopeIndexRefV2>;
}

interface ArchiveSessionMetadataV1 {
  schema: "prime-context.archive-session/v1";
  nextSequence: number;
  observationCount: number;
  utility?: BrokerPersistentState["utility"];
  metrics?: BrokerPersistentState["metrics"];
}

export interface CompletedExchangeArchive {
  metadata: ExchangeObservationMetadata;
  toolName: string;
  isError: boolean;
  source?: ObservationSource;
  parts?: readonly ObservationPartInput[];
  persistedModelInput?: Record<string, unknown>;
  persistedRawCall?: Record<string, unknown>;
  persistedRawResult?: { content?: unknown; details?: unknown; isError?: boolean };
  resultChangedAfterHook?: boolean;
  canonicalResultChangedAfterHook?: boolean;
  resultText?: string;
  largeResult?: boolean;
  resultSummary?: ResolvedArchiveText;
  admittedCapsule?: string;
  sourceOrder?: number;
  replayProtected?: boolean;
  replayOriginKey?: string;
  fixedView?: FixedExchangeView;
}

export interface FixedViewFinalizeOptions {
  budgetBytes: number;
  capsuleMaxBytes: number;
  archiveAdmissionBytes?: number;
  contextEpoch?: number;
}

function isDeltaView(view: FixedExchangeView): boolean {
  return view.result.kind === "capsule" && view.result.text.includes("<prime_context_delta ");
}

export interface ArchivedContent {
  content: (TextContent | ImageContent)[];
  observation: ObservationRecord;
}

export type RecallScope = "task" | "session" | "parent" | "project";

export interface RecallArchiveSource {
  archive: ObservationArchive;
  scope: "parent" | "project";
  sessionId: string;
  sessionDate: string;
}

export interface ObservationRecoveryDetails {
  observationId: string;
  ref: string;
  partKind: ObservationPartKind;
  pointer?: string;
  startLine?: number;
  endLine?: number;
  totalLines?: number;
  startByte?: number;
  endByte?: number;
  totalBytes?: number;
  hasMore?: boolean;
  mediaType?: string;
  binaryBytes?: number;
  width?: number;
  height?: number;
  subjectKey?: string;
  resources?: string[];
  suite?: SuiteIdentity;
  scope: RecallScope;
  sessionId?: string;
  sessionDate?: string;
  currentWorkspace: boolean;
  currentRequirements: boolean;
}

export interface ObservationInspection {
  content: (TextContent | ImageContent)[];
  details: ObservationRecoveryDetails;
}

export interface ArchiveRecoveryContext {
  taskKey?: string;
  workspaceRevision?: number;
  requirementsRevision?: number;
  activeDiagnosticExchangeIds?: readonly string[];
  activeDiagnosticSignals?: readonly string[];
}

export interface RecallOptions {
  query?: string;
  id?: string;
  path?: string;
  kind?: "call" | "result" | "diff" | "diagnostic" | "image";
  tool?: string;
  status?: "success" | "failure" | "error";
  scope?: RecallScope;
  contextLines?: number;
}

export interface RecallResult {
  content: (TextContent | ImageContent)[];
  matches: ObservationRecoveryDetails[];
}

function emptyIndex(): ObservationIndexV1 {
  return { schema: "prime-context.observation-index/v1", observations: [] };
}

async function mapBounded<T, R>(
  values: readonly T[],
  limit: number,
  operation: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= values.length) return;
      results[index] = await operation(values[index]);
    }
  }));
  return results;
}

function isTextBlock(block: TextContent | ImageContent): block is TextContent {
  return block?.type === "text" && typeof (block as TextContent).text === "string";
}

function visibleTextSource(content: readonly (TextContent | ImageContent)[]): StreamPartSource {
  // Freeze the string references now. Callers may reuse and mutate their
  // content blocks after tool_result, while archival is admitted later.
  const texts = content.flatMap((block) => isTextBlock(block) && block.text.length > 0 ? [block.text] : []);
  if (texts.length <= 1) return { kind: "text", text: texts[0] ?? "" };
  return { kind: "texts", texts: () => texts.values() };
}

function rawResultText(result: { content?: unknown } | undefined): string | undefined {
  if (!Array.isArray(result?.content)) return undefined;
  const chunks: string[] = [];
  let pending: string[] = [];
  for (const block of result.content) {
    if (!block || typeof block !== "object") continue;
    const value = block as Record<string, unknown>;
    if (value.type !== "text" || typeof value.text !== "string" || value.text.length === 0) continue;
    pending.push(value.text);
    if (pending.length >= 1024) {
      chunks.push(pending.join(""));
      pending = [];
    }
  }
  if (pending.length > 0) chunks.push(pending.join(""));
  return chunks.join("");
}

function isEnvelopeIndexRef(
  entry: ObservationRecord | ObservationEnvelopeIndexRefV2,
): entry is ObservationEnvelopeIndexRefV2 {
  return "schema" in entry && entry.schema === "prime-context.exchange/v2";
}

interface ParsedObservationRef {
  id: string;
  partName?: string;
  pointer?: string;
}

function parseObservationRef(ref: string): ParsedObservationRef {
  const short = /^([^:]+)(?::(.+))?$/.exec(ref);
  if (!short) return { id: ref };
  if (!short[2]) return { id: short[1], partName: "result" };
  if (short[2].startsWith("call#")) {
    const pointer = short[2].slice("call#".length);
    if (pointer !== "" && !pointer.startsWith("/")) return { id: ref };
    return { id: short[1], partName: "call", pointer };
  }
  return { id: short[1], partName: short[2] };
}

export function normalizeObservationRef(ref: string): string {
  return parseObservationRef(ref).id;
}

function partReference(envelopeId: string, part: ObservationPart): string {
  return part.kind === "call-field"
    ? `${envelopeId}:call#${part.pointer ?? ""}`
    : `${envelopeId}:${part.name}`;
}

export function imageRefsForEnvelope(envelope: ObservationEnvelopeV2): ProjectedImageRef[] {
  return envelope.parts.flatMap((part) => part.kind === "image" && part.binaryBytes !== undefined
    ? [{
        ref: partReference(envelope.id, part),
        mimeType: part.mediaType ?? "application/octet-stream",
        bytes: part.binaryBytes,
        ...(part.width === undefined ? {} : { width: part.width }),
        ...(part.height === undefined ? {} : { height: part.height }),
      }]
    : []);
}

function sanitizedStorageName(name: string): string {
  return name.toLowerCase().replaceAll(/[^a-z0-9_-]+/g, "-").replaceAll(/^-+|-+$/g, "") || "part";
}

function jsonPointerToken(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

export function imageDimensions(bytes: Buffer, mediaType?: string): { width: number; height: number } | undefined {
  const mime = mediaType?.toLowerCase();
  if ((mime === "image/png" || bytes.subarray(1, 4).toString("ascii") === "PNG") &&
    bytes.length >= 24 && bytes.subarray(12, 16).toString("ascii") === "IHDR") {
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    return width > 0 && height > 0 ? { width, height } : undefined;
  }
  if (mime === "image/jpeg" || mime === "image/jpg" || (bytes[0] === 0xff && bytes[1] === 0xd8)) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
      const size = bytes.readUInt16BE(offset + 2);
      if (size < 2 || offset + 2 + size > bytes.length) break;
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        const height = bytes.readUInt16BE(offset + 5);
        const width = bytes.readUInt16BE(offset + 7);
        return width > 0 && height > 0 ? { width, height } : undefined;
      }
      offset += 2 + size;
    }
  }
  return undefined;
}

function deterministicJson(value: unknown): string {
  const canonical = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(canonical);
    if (item && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>)
          .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
          .map(([key, child]) => [key, canonical(child)]),
      );
    }
    return item;
  };
  return JSON.stringify(canonical(value)) ?? String(value);
}

function callField(pointer: string, text: string, mediaType = "text/plain; charset=utf-8"): ObservationPartInput {
  return { name: "call", kind: "call-field", pointer, mediaType, text };
}

function collectOversizedCallFields(
  toolName: string,
  input: Record<string, unknown>,
  archiveAdmissionBytes = 24 * 1024,
): ObservationPartInput[] {
  if (toolName === "edit") {
    const edits = Array.isArray(input.edits) ? input.edits : [];
    const fields: Array<{ pointer: string; text: string }> = [];
    let total = 0;
    for (const [index, value] of edits.entries()) {
      if (!value || typeof value !== "object") continue;
      const edit = value as Record<string, unknown>;
      for (const key of ["oldText", "newText"] as const) {
        if (typeof edit[key] !== "string") continue;
        const text = edit[key] as string;
        total += utf8Bytes(text);
        fields.push({ pointer: `/edits/${index}/${key}`, text });
      }
    }
    return total > archiveAdmissionBytes ? fields.map(({ pointer, text }) => callField(pointer, text)) : [];
  }

  if (toolName === "ipython") {
    return typeof input.code === "string" && utf8Bytes(input.code) > archiveAdmissionBytes
      ? [callField("/code", input.code)]
      : [];
  }

  if (toolName === "bash") {
    return typeof input.command === "string" && utf8Bytes(input.command) > archiveAdmissionBytes
      ? [callField("/command", input.command)]
      : [];
  }

  const rootJson = deterministicJson(input);
  if (utf8Bytes(rootJson) <= archiveAdmissionBytes) return [];
  const parts: ObservationPartInput[] = [];
  const visit = (value: unknown, pointer: string): void => {
    if (typeof value === "string") {
      if (utf8Bytes(value) > archiveAdmissionBytes) parts.push(callField(pointer, value));
      return;
    }
    if (!value || typeof value !== "object") return;
    const before = parts.length;
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${pointer}/${index}`));
    } else {
      for (const key of Object.keys(value as Record<string, unknown>).sort()) {
        visit((value as Record<string, unknown>)[key], `${pointer}/${jsonPointerToken(key)}`);
      }
    }
    const json = deterministicJson(value);
    if (pointer && parts.length === before && utf8Bytes(json) > archiveAdmissionBytes) {
      parts.push(callField(pointer, json, "application/json"));
    }
  };
  visit(input, "");
  return parts;
}

export interface ResolvedArchiveText {
  text: string;
  source: ObservationSource;
  partSource?: StreamPartSource;
  textBytes?: number;
  lineCount?: number;
  large?: boolean;
  exactText?: string;
  capsuleText?: string;
  outcomeText?: string;
  representativeLines?: string[];
  head?: string[];
  tail?: string[];
  sourceRecords?: SourceLineRecord[];
  traceShapeCount?: number;
  traceShapeOverflow?: number;
  traceLineCount?: number;
  nonEmptyLineCount?: number;
  summaryLines?: string[];
}

function resolvedArchiveText(summary: TextSourceSummary, source: ObservationSource): ResolvedArchiveText {
  const value: ResolvedArchiveText = { text: summary.exactText ?? summary.capsuleText, source };
  const { source: partSource, ...details } = summary;
  Object.defineProperties(value, Object.fromEntries(
    Object.entries({ ...details, partSource }).map(([key, detail]) => [key, {
      value: detail,
      enumerable: false,
      configurable: false,
      writable: false,
    }]),
  ));
  return value;
}

export async function resolveArchiveText(
  content: readonly (TextContent | ImageContent)[],
  publicCompleteOutputPath?: string,
  signal?: AbortSignal,
): Promise<ResolvedArchiveText> {
  if (publicCompleteOutputPath) {
    try {
      const summary = await summarizePartSource({ kind: "path", path: publicCompleteOutputPath }, signal);
      return resolvedArchiveText(summary, "public-complete-output");
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }
  const summary = await summarizePartSource(visibleTextSource(content), signal);
  return resolvedArchiveText(summary, "visible-tool-result");
}

export function replaceVisibleText(
  content: readonly (TextContent | ImageContent)[],
  capsule: string,
): (TextContent | ImageContent)[] {
  let inserted = false;
  const output: (TextContent | ImageContent)[] = [];
  for (const block of content) {
    if (isTextBlock(block)) {
      if (!inserted) {
        output.push({ type: "text", text: capsule });
        inserted = true;
      }
      continue;
    }
    output.push(block);
  }
  return output;
}

function validateLineRange(startLine: number, endLine: number): void {
  if (!Number.isSafeInteger(startLine) || startLine < 1) {
    throw new Error("startLine must be a positive integer.");
  }
  if (!Number.isSafeInteger(endLine) || endLine < startLine) {
    throw new Error("endLine must be an integer greater than or equal to startLine.");
  }
}

function validateContextLines(contextLines: number): void {
  if (!Number.isSafeInteger(contextLines) || contextLines < 0 || contextLines > 20) {
    throw new Error("contextLines must be an integer from 0 to 20.");
  }
}

function validateMatchOffset(matchOffset: number): void {
  if (!Number.isSafeInteger(matchOffset) || matchOffset < 0 || matchOffset > 10000) {
    throw new Error("matchOffset must be an integer from 0 to 10000.");
  }
}

function validateMaxMatches(maxMatches: number): void {
  if (!Number.isSafeInteger(maxMatches) || maxMatches < 1 || maxMatches > 50) {
    throw new Error("maxMatches must be an integer from 1 to 50.");
  }
}

function boundedResponse(header: string, body: string, maxBytes: number): string {
  const complete = header + body;
  if (utf8Bytes(complete) <= maxBytes) return complete;
  const truncatedHeader = `${header}Response truncated at ${maxBytes} UTF-8 bytes; more content exists.\n`;
  if (utf8Bytes(truncatedHeader) >= maxBytes) return truncateUtf8(truncatedHeader, maxBytes);
  return truncatedHeader + truncateUtf8(body, maxBytes - utf8Bytes(truncatedHeader));
}

function findMatchingLines(lines: readonly string[], needle: string, limit: number): number[] {
  const matches: number[] = [];
  for (let index = 0; index < lines.length && matches.length < limit; index += 1) {
    if (lines[index].toLowerCase().includes(needle)) matches.push(index);
  }
  return matches;
}

function renderMatches(
  lines: readonly string[],
  matches: readonly number[],
  contextLines = 1,
): string {
  if (matches.length === 0) return "";
  const matchedLines = new Set(matches);
  const ranges: Array<{ first: number; last: number; matches: number[] }> = [];
  for (const lineIndex of matches) {
    const first = Math.max(0, lineIndex - contextLines);
    const last = Math.min(lines.length - 1, lineIndex + contextLines);
    const current = ranges.at(-1);
    if (current && first <= current.last + 1) {
      current.last = Math.max(current.last, last);
      current.matches.push(lineIndex);
    } else {
      ranges.push({ first, last, matches: [lineIndex] });
    }
  }

  return ranges
    .map((range) => {
      const heading = range.matches.length === 1
        ? `Match at line ${range.matches[0] + 1}:`
        : `Matches at lines ${range.matches.map((line) => line + 1).join(", ")}:`;
      const context = [heading];
      for (let index = range.first; index <= range.last; index += 1) {
        context.push(`${matchedLines.has(index) ? ">" : " "} ${index + 1}: ${lines[index]}`);
      }
      return context.join("\n");
    })
    .join("\n\n");
}

export class ObservationArchive {
  readonly sessionId: string;
  readonly sessionPath: string;
  readonly observationsPath: string;
  readonly indexPath: string;
  readonly sessionMetadataPath: string;
  private indexQueue: Promise<void> = Promise.resolve();
  private catalogPromise?: Promise<ObservationRecord[]>;
  private catalog?: ObservationRecord[];
  private catalogById = new Map<string, ObservationRecord>();
  private sessionMetadata?: ArchiveSessionMetadataV1;
  private mediumResultCounts = new Map<string, number>();
  private lastMediumResults = new Map<string, string>();
  private recentLargeParts: Array<{
    toolName: string;
    subjectKey: string;
    textBytes: number;
    lineCount: number;
    head: string[];
    tail: string[];
    part: ObservationPart;
  }> = [];
  private scopeActive = false;
  private activeTaskKey?: string;
  private activeBranchEntryIds = new Set<string>();
  private activeCitedObservationIds = new Set<string>();
  private broker = new ObservationBroker();

  constructor(root: string, sessionId: string) {
    this.sessionId = sessionId;
    this.sessionPath = join(root, "sessions", sessionId);
    this.observationsPath = join(this.sessionPath, "observations");
    this.indexPath = join(this.sessionPath, "index.json");
    this.sessionMetadataPath = join(this.sessionPath, "session.json");
  }

  async freezeTextSource(path: string, signal?: AbortSignal): Promise<string> {
    signal?.throwIfAborted();
    const staging = join(this.sessionPath, "staging");
    await mkdir(staging, { recursive: true });
    const frozenPath = join(staging, `${randomUUID()}.txt`);
    await copyFile(path, frozenPath);
    signal?.throwIfAborted();
    return frozenPath;
  }

  async removeFrozenTextSource(path: string): Promise<void> {
    await rm(path, { force: true });
  }

  brokerContext(): BrokerContextState {
    return this.broker.contextState();
  }

  brokerStatistics(): BrokerStats {
    return this.broker.statistics();
  }

  recordRecovery(
    useful: boolean,
    subjectKeys?: readonly string[],
    exposedBytes = 0,
    inspectRecallHit = false,
  ): void {
    this.broker.recordRecovery({ recovered: true, useful, subjectKeys, exposedBytes, inspectRecallHit });
  }

  recordTypedMediaProjection(bytes: number): void {
    this.broker.recordProjection({ typedMediaBytesProjectedOut: bytes });
  }

  recordBranchRuntimeReload(): void {
    this.broker.recordBranchRuntimeReload();
  }

  recordUsage(usage: { input?: number; cacheRead?: number; cacheWrite?: number }): void {
    this.broker.recordUsage(usage);
  }

  noteContextTurn(goalActive: boolean): void {
    this.broker.noteContextTurn(goalActive);
  }

  setBranchScope(
    taskKey: string | undefined,
    branchEntryIds: readonly string[],
    citedObservationIds: readonly string[] = [],
  ): void {
    this.scopeActive = true;
    this.activeTaskKey = taskKey;
    this.activeBranchEntryIds = new Set(branchEntryIds);
    this.activeCitedObservationIds = new Set(citedObservationIds.map(normalizeObservationRef));
  }

  private isOnActiveBranch(observation: ObservationRecord): boolean {
    if (!this.scopeActive) return true;
    if (!this.activeTaskKey || observation.exchange?.taskKey !== this.activeTaskKey) return false;
    const anchor = observation.exchange.branchAnchorId;
    if (observation.exchange.forkImported) return Boolean(anchor && this.activeBranchEntryIds.has(anchor));
    const toolCallId = observation.exchange.toolCallId;
    if (toolCallId) return this.activeBranchEntryIds.has(toolCallId);
    return Boolean(anchor && this.activeBranchEntryIds.has(anchor));
  }

  private isInActiveScope(observation: ObservationRecord): boolean {
    if (this.activeCitedObservationIds.has(observation.id)) return true;
    return this.isOnActiveBranch(observation);
  }

  resetBranchState(): void {
    this.mediumResultCounts.clear();
    this.lastMediumResults.clear();
    this.recentLargeParts = [];
    this.broker.resetBranchState();
  }

  private async withIndexLock<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.indexQueue.then(operation, operation);
    this.indexQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async readIndex(signal?: AbortSignal): Promise<ObservationIndexV1> {
    try {
      const raw = await readFile(this.indexPath, { encoding: "utf8", signal });
      const parsed = JSON.parse(raw) as Partial<ObservationIndexV1>;
      if (parsed.schema !== "prime-context.observation-index/v1" || !Array.isArray(parsed.observations)) {
        throw new Error("Invalid Prime Context observation index.");
      }
      return parsed as ObservationIndexV1;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyIndex();
      throw error;
    }
  }

  private async writeIndex(index: ObservationIndexV1, signal?: AbortSignal): Promise<void> {
    await mkdir(this.sessionPath, { recursive: true });
    const temporary = `${this.indexPath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify(index, null, 2)}\n`, { encoding: "utf8", signal });
      await rename(temporary, this.indexPath);
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  private async readSessionMetadata(signal?: AbortSignal): Promise<ArchiveSessionMetadataV1 | undefined> {
    try {
      const parsed = JSON.parse(await readFile(this.sessionMetadataPath, { encoding: "utf8", signal })) as
        Partial<ArchiveSessionMetadataV1>;
      if (parsed.schema !== "prime-context.archive-session/v1" ||
        !Number.isSafeInteger(parsed.nextSequence) || (parsed.nextSequence ?? 0) < 1 ||
        !Number.isSafeInteger(parsed.observationCount) || (parsed.observationCount ?? -1) < 0) return undefined;
      return parsed as ArchiveSessionMetadataV1;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  private metadataWithBrokerState(metadata: ArchiveSessionMetadataV1): ArchiveSessionMetadataV1 {
    const state = this.broker.persistentState();
    return { ...metadata, utility: state.utility, metrics: state.metrics };
  }

  async flushSessionState(signal?: AbortSignal): Promise<void> {
    const records = await this.readCatalog(signal);
    const metadata = this.metadataWithBrokerState(this.nextMetadata(records));
    await this.writeSessionMetadata(metadata, signal);
    this.sessionMetadata = metadata;
  }

  private async writeSessionMetadata(metadata: ArchiveSessionMetadataV1, signal?: AbortSignal): Promise<void> {
    await mkdir(this.sessionPath, { recursive: true });
    const temporary = `${this.sessionMetadataPath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify(metadata, null, 2)}
`, { encoding: "utf8", signal });
      signal?.throwIfAborted();
      await rename(temporary, this.sessionMetadataPath);
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  private async loadCatalog(signal?: AbortSignal): Promise<ObservationRecord[]> {
    const [legacy, names, storedSession] = await Promise.all([
      this.readIndex(signal),
      readdir(this.observationsPath).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return [] as string[];
        throw error;
      }),
      this.readSessionMetadata(signal),
    ]);
    const refs = new Map<string, ObservationEnvelopeIndexRefV2>();
    const orderedIds: string[] = [];
    const orderedIdSet = new Set<string>();
    const legacyRecords = new Map<string, ObservationRecord>();
    for (const entry of legacy.observations) {
      if (!orderedIdSet.has(entry.id)) {
        orderedIds.push(entry.id);
        orderedIdSet.add(entry.id);
      }
      if (isEnvelopeIndexRef(entry)) refs.set(entry.id, entry);
      else legacyRecords.set(entry.id, entry);
    }
    for (const name of names.filter((value) => value.endsWith(".meta.json")).sort()) {
      const id = name.slice(0, -".meta.json".length);
      refs.set(id, { schema: "prime-context.exchange/v2", id, relativeFile: join("observations", name) });
    }
    const loaded = await mapBounded([...refs.values()], 8, async (ref) =>
      this.envelopeRecord(ref, await this.readEnvelope(ref, signal))
    );
    const loadedById = new Map(loaded.map((record) => [record.id, record]));
    const standalone = loaded
      .filter((record) => !orderedIdSet.has(record.id))
      .sort((left, right) => {
        const leftSequence = /^o(\d+)$/.exec(left.id);
        const rightSequence = /^o(\d+)$/.exec(right.id);
        if (leftSequence && rightSequence) return Number(leftSequence[1]) - Number(rightSequence[1]);
        return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
      });
    orderedIds.push(...standalone.map((record) => record.id));
    const records = orderedIds.flatMap((id) => {
      const record = loadedById.get(id) ?? legacyRecords.get(id);
      return record ? [record] : [];
    });
    const maximum = records.reduce((value, record) => {
      const match = /^o(\d+)$/.exec(record.id);
      return match ? Math.max(value, Number(match[1])) : value;
    }, 0);
    this.broker.restorePersistentState(storedSession ? {
      utility: storedSession.utility,
      metrics: storedSession.metrics,
    } : undefined);
    this.sessionMetadata = this.metadataWithBrokerState({
      schema: "prime-context.archive-session/v1",
      nextSequence: Math.max(storedSession?.nextSequence ?? 1, maximum + 1),
      observationCount: records.length,
    });
    this.catalog = records;
    this.catalogById = new Map(records.map((record) => [record.id, record]));
    return records;
  }

  private async readCatalog(signal?: AbortSignal): Promise<ObservationRecord[]> {
    if (this.catalog) return this.catalog;
    this.catalogPromise ??= this.loadCatalog(signal);
    try {
      return await this.catalogPromise;
    } catch (error) {
      if (signal?.aborted) this.catalogPromise = undefined;
      throw error;
    }
  }

  private nextMetadata(records: readonly ObservationRecord[], addedId?: string): ArchiveSessionMetadataV1 {
    let nextSequence = this.sessionMetadata?.nextSequence ?? 1;
    if (addedId) {
      const match = /^o(\d+)$/.exec(addedId);
      if (match) nextSequence = Math.max(nextSequence, Number(match[1]) + 1);
    }
    return this.metadataWithBrokerState({
      schema: "prime-context.archive-session/v1",
      nextSequence,
      observationCount: records.length + (addedId && !this.catalogById.has(addedId) ? 1 : 0),
    });
  }

  private async publishRecord(record: ObservationRecord, signal?: AbortSignal): Promise<void> {
    const records = await this.readCatalog(signal);
    if (this.catalogById.has(record.id)) {
      this.replaceCatalogRecord(record);
      return;
    }
    const metadata = this.nextMetadata(records, record.id);
    await this.writeSessionMetadata(metadata, signal);
    records.push(record);
    this.catalogById.set(record.id, record);
    this.sessionMetadata = metadata;
  }

  private replaceCatalogRecord(record: ObservationRecord): void {
    if (!this.catalog) return;
    const previous = this.catalogById.get(record.id);
    if (!previous) return;
    const index = this.catalog.indexOf(previous);
    if (index >= 0) this.catalog[index] = record;
    this.catalogById.set(record.id, record);
  }

  private async readEnvelope(
    ref: ObservationEnvelopeIndexRefV2,
    signal?: AbortSignal,
  ): Promise<ObservationEnvelopeV2> {
    const raw = await readFile(join(this.sessionPath, ref.relativeFile), { encoding: "utf8", signal });
    const envelope = JSON.parse(raw) as ObservationEnvelopeV2;
    if (envelope.schema !== "prime-context.exchange/v2" || envelope.id !== ref.id || !Array.isArray(envelope.parts)) {
      throw new Error(`Invalid Prime Context exchange envelope: ${ref.id}`);
    }
    return envelope;
  }

  private async writeEnvelope(
    relativeFile: string,
    envelope: ObservationEnvelopeV2,
    signal?: AbortSignal,
  ): Promise<void> {
    await mkdir(this.observationsPath, { recursive: true });
    const filePath = join(this.sessionPath, relativeFile);
    const temporary = `${filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify(envelope, null, 2)}\n`, { encoding: "utf8", signal });
      await rename(temporary, filePath);
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  private async appendPart(
    envelope: ObservationEnvelopeV2,
    input: ObservationPartInput,
    signal?: AbortSignal,
    generation?: string,
  ): Promise<void> {
    await mkdir(this.observationsPath, { recursive: true });
    const storageName = input.kind === "call-field"
      ? `call-field-${envelope.parts.filter((part) => part.kind === "call-field").length + 1}`
      : sanitizedStorageName(input.name);
    const textSource = input.source ?? (input.text === undefined ? undefined : { kind: "text" as const, text: input.text });
    if (textSource) {
      const relativePrefix = join(
        "observations",
        `${envelope.id}.${storageName}${generation ? `.${sanitizedStorageName(generation)}` : ""}`,
      );
      const chunks = await writeTextChunks(textSource, this.sessionPath, relativePrefix, signal);
      const textBytes = chunks.reduce((sum, chunk) => sum + chunk.textBytes, 0);
      const lineCount = chunks.reduce((sum, chunk) => sum + chunk.lineCount, 0);
      envelope.parts.push({
        name: input.name,
        kind: input.kind,
        ...(input.pointer === undefined ? {} : { pointer: input.pointer }),
        ...(input.mediaType === undefined ? {} : { mediaType: input.mediaType }),
        textBytes,
        lineCount,
        chunks,
      });
      return;
    }
    if (input.binaryBase64 !== undefined) {
      const bytes = Buffer.from(input.binaryBase64, "base64");
      const dimensions = input.width && input.height
        ? { width: input.width, height: input.height }
        : imageDimensions(bytes, input.mediaType);
      const relativeFile = join(
        "observations",
        `${envelope.id}.${storageName}${generation ? `.${sanitizedStorageName(generation)}` : ""}.bin`,
      );
      const filePath = join(this.sessionPath, relativeFile);
      const temporary = `${filePath}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, bytes, { signal });
        signal?.throwIfAborted();
        await rename(temporary, filePath);
      } catch (error) {
        await rm(temporary, { force: true }).catch(() => undefined);
        throw error;
      }
      envelope.parts.push({
        name: input.name,
        kind: input.kind,
        ...(input.pointer === undefined ? {} : { pointer: input.pointer }),
        ...(input.mediaType === undefined ? {} : { mediaType: input.mediaType }),
        binaryBytes: bytes.byteLength,
        ...(dimensions ?? {}),
        chunks: [{ relativeFile, textBytes: 0 }],
      });
    }
  }

  private newEnvelope(
    metadata: ExchangeObservationMetadata,
    toolName: string,
    source?: ObservationSource,
    resultCapsule = "",
    isError = metadata.outcome.status === "failure",
  ): ObservationEnvelopeV2 {
    return {
      schema: "prime-context.exchange/v2",
      id: metadata.exchangeId,
      toolCallId: metadata.toolCallId,
      toolName,
      intentKind: metadata.intentKind,
      subjectKey: metadata.subjectKey,
      resources: [...metadata.resources],
      ...(metadata.suite === undefined ? {} : { suite: { ...metadata.suite } }),
      taskKey: metadata.taskKey ?? "session",
      ...(metadata.goalId === undefined ? {} : { goalId: metadata.goalId }),
      branchAnchorId: metadata.branchAnchorId ?? metadata.toolCallId,
      turnSequence: metadata.turnSequence ?? 0,
      requirementsRevision: metadata.requirementsRevision ?? 0,
      workspaceRevisionAtStart: metadata.workspaceRevisionAtStart ?? 0,
      workspaceRevisionAtResult: metadata.workspaceRevisionAtResult ?? metadata.workspaceRevisionAtStart ?? 0,
      isError,
      outcome: metadata.outcome,
      callSummary: `${toolName} ${metadata.subjectKey}`,
      resultCapsule,
      parts: [],
      ...(source === undefined ? {} : { source }),
      createdAt: new Date().toISOString(),
      ...(metadata.effectiveCwd === undefined ? {} : { effectiveCwd: metadata.effectiveCwd }),
      mutatesWorkspace: metadata.mutatesWorkspace,
      modelInputBytes: metadata.modelInputBytes,
      executedInputBytes: metadata.executedInputBytes,
      ...(metadata.facts === undefined ? {} : { facts: { ...metadata.facts } }),
      ...(metadata.forkImported === undefined ? {} : { forkImported: metadata.forkImported }),
    };
  }

  private updateEnvelopeMetadata(
    envelope: ObservationEnvelopeV2,
    metadata: ExchangeObservationMetadata,
  ): void {
    envelope.toolCallId = metadata.toolCallId;
    envelope.intentKind = metadata.intentKind;
    envelope.subjectKey = metadata.subjectKey;
    envelope.resources = [...metadata.resources];
    if (metadata.suite === undefined) delete envelope.suite;
    else envelope.suite = { ...metadata.suite };
    envelope.taskKey = metadata.taskKey ?? envelope.taskKey;
    if (metadata.goalId === undefined) delete envelope.goalId;
    else envelope.goalId = metadata.goalId;
    envelope.branchAnchorId = metadata.branchAnchorId ?? envelope.branchAnchorId;
    envelope.turnSequence = metadata.turnSequence ?? envelope.turnSequence;
    envelope.requirementsRevision = metadata.requirementsRevision ?? envelope.requirementsRevision;
    envelope.workspaceRevisionAtStart = metadata.workspaceRevisionAtStart ?? envelope.workspaceRevisionAtStart;
    envelope.workspaceRevisionAtResult = metadata.workspaceRevisionAtResult ?? envelope.workspaceRevisionAtResult;
    envelope.outcome = metadata.outcome;
    envelope.callSummary = `${envelope.toolName} ${metadata.subjectKey}`;
    if (metadata.effectiveCwd === undefined) delete envelope.effectiveCwd;
    else envelope.effectiveCwd = metadata.effectiveCwd;
    envelope.mutatesWorkspace = metadata.mutatesWorkspace;
    envelope.modelInputBytes = metadata.modelInputBytes;
    envelope.executedInputBytes = metadata.executedInputBytes;
    if (metadata.facts === undefined) delete envelope.facts;
    else envelope.facts = { ...metadata.facts };
    if (metadata.forkImported !== undefined) envelope.forkImported = metadata.forkImported;
  }

  private envelopeRecord(ref: ObservationEnvelopeIndexRefV2, envelope: ObservationEnvelopeV2): ObservationRecord {
    const result = envelope.parts.find((part) => part.name === "result" && part.kind === "result");
    return {
      id: envelope.id,
      relativeFile: ref.relativeFile,
      toolName: envelope.toolName,
      isError: envelope.isError,
      textBytes: result?.textBytes ?? 0,
      lineCount: result?.lineCount ?? 0,
      createdAt: envelope.createdAt,
      source: envelope.source,
      exchange: {
        exchangeId: envelope.id,
        toolCallId: envelope.toolCallId,
        intentKind: envelope.intentKind,
        subjectKey: envelope.subjectKey,
        resources: [...envelope.resources],
        ...(envelope.suite === undefined ? {} : { suite: { ...envelope.suite } }),
        ...(envelope.effectiveCwd === undefined ? {} : { effectiveCwd: envelope.effectiveCwd }),
        mutatesWorkspace: envelope.mutatesWorkspace,
        modelInputBytes: envelope.modelInputBytes,
        executedInputBytes: envelope.executedInputBytes,
        ...(envelope.facts === undefined ? {} : { facts: { ...envelope.facts } }),
        outcome: envelope.outcome,
        taskKey: envelope.taskKey,
        ...(envelope.goalId === undefined ? {} : { goalId: envelope.goalId }),
        branchAnchorId: envelope.branchAnchorId,
        turnSequence: envelope.turnSequence,
        requirementsRevision: envelope.requirementsRevision,
        workspaceRevisionAtStart: envelope.workspaceRevisionAtStart,
        workspaceRevisionAtResult: envelope.workspaceRevisionAtResult,
        ...(envelope.forkImported === undefined ? {} : { forkImported: envelope.forkImported }),
      },
      envelope,
      partRefs: envelope.parts.map((part) => partReference(envelope.id, part)),
    };
  }


  async archiveVisibleContent(
    content: readonly (TextContent | ImageContent)[],
    toolName: string,
    isError: boolean,
    minTextBytes: number,
    capsuleMaxBytes: number,
    signal?: AbortSignal,
    resolvedText?: ResolvedArchiveText,
    contextUsage?: CapsuleContextUsage,
    exchange?: ExchangeObservationMetadata,
    parts: readonly ObservationPartInput[] = [],
  ): Promise<ArchivedContent | null> {
    if (toolName === "prime_context") return null;
    const forceMedia = parts.some((part) =>
      part.binaryBase64 !== undefined && (part.kind === "image" || part.kind === "attachment")
    );
    const textBlocks = content.filter(isTextBlock);
    if (textBlocks.length === 0 && !forceMedia) return null;
    const archiveText = resolvedText ?? await resolveArchiveText(content, undefined, signal);
    const textBytes = archiveText.textBytes ?? utf8Bytes(archiveText.text);
    const lineCount = archiveText.lineCount ?? splitVisibleLines(archiveText.text).length;
    const large = archiveText.large ?? textBytes > LARGE_TEXT_BYTES;
    const partSource = archiveText.partSource ?? { kind: "text" as const, text: archiveText.text };
    const representativeLines = archiveText.representativeLines ?? splitVisibleLines(archiveText.text).slice(0, 64);
    const subjectKey = exchange?.subjectKey ?? `tool:${toolName}`;
    const exactLargeRepeat = large
      ? await this.isLargeExactRepeat(toolName, subjectKey, archiveText, textBytes, lineCount, partSource, signal)
      : false;
    const decision = this.broker.observe(toolName, archiveText.text, isError, {
      subjectKey,
      textBytes,
      lineCount,
      representativeLines,
      outcome: exchange?.outcome ?? (large ? analyzeOutcome(archiveText.outcomeText ?? archiveText.text, isError) : undefined),
      ...(exactLargeRepeat ? { exactRepeat: true } : {}),
    });
    const forceDelta = decision.kind === "delta";
    const belowConfiguredThreshold = !large && textBytes < minTextBytes;
    const genuineContextPressure = contextUsage !== undefined
      && contextUsage.contextWindow > 0
      && contextUsage.tokens !== null
      && contextUsage.tokens / contextUsage.contextWindow >= 0.4;
    let repeatedMedium = false;
    if (!forceMedia && !forceDelta && belowConfiguredThreshold) {
      // Novel 8–24 KiB results stay literal unless the actual provider context
      // is under pressure. Content shape alone is not context pressure.
      if (textBytes > 8192 && !genuineContextPressure) {
        this.broker.recordPassThrough();
        return null;
      }
      const sampledTerminal = textBytes >= 1024
        && hasTerminalOutcome(archiveText.text)
        && isRepetitiveOutput(archiveText.text);
      const visibleLines = splitVisibleLines(archiveText.text);
      const sampledCommandUsage = textBytes >= 4096
        && visibleLines.some((line) => /^usage:/i.test(line.trim()))
        && visibleLines.filter((line) => /^\s{2,}-{1,2}\S/.test(line)).length >= 10;
      const sampledLowSignalTrace = textBytes >= 2048 && isLowSignalTraceOutput(archiveText.text);
      if (!sampledTerminal && !sampledCommandUsage && !sampledLowSignalTrace && textBytes < 8192) {
        this.broker.recordPassThrough();
        return null;
      }
      if (sampledTerminal || sampledCommandUsage || sampledLowSignalTrace) {
        repeatedMedium = true;
      } else {
        const residentSubjectKey = truncateUtf8(subjectKey, 1024);
        const exactRepeat = textBytes <= LARGE_TEXT_BYTES && this.lastMediumResults.get(residentSubjectKey) === archiveText.text;
        if (textBytes <= LARGE_TEXT_BYTES) {
          this.lastMediumResults.delete(residentSubjectKey);
          this.lastMediumResults.set(residentSubjectKey, archiveText.text);
          while (this.lastMediumResults.size > 16) this.lastMediumResults.delete(this.lastMediumResults.keys().next().value!);
        }
        const seen = (this.mediumResultCounts.get(residentSubjectKey) ?? 0) + 1;
        this.mediumResultCounts.delete(residentSubjectKey);
        this.mediumResultCounts.set(residentSubjectKey, seen);
        while (this.mediumResultCounts.size > 64) {
          this.mediumResultCounts.delete(this.mediumResultCounts.keys().next().value!);
        }
        if (!exactRepeat && seen <= 2) {
          this.broker.recordPassThrough();
          return null;
        }
        repeatedMedium = true;
      }
    }

    return this.withIndexLock(async () => {
      signal?.throwIfAborted();
      await this.readCatalog(signal);
      const id = exchange?.exchangeId ?? `obs_${randomUUID()}`;
      const capsuleRef = exchange ? `${id}:result` : id;
      const metadata = {
        id: capsuleRef,
        toolName,
        textBytes,
        lineCount,
        source: archiveText.source,
        factualLines: capsuleFactualLines(exchange, decision.outcome),
      };
      const pressureCeiling = adaptiveCapsuleMaxBytes(archiveText.text, capsuleMaxBytes, contextUsage);
      const failureBaseline = decision.outcome.status === "failure"
        ? Math.max(512, capsuleMaxBytes - 512)
        : capsuleMaxBytes;
      const baselineCapsuleMax = adaptiveCapsuleMaxBytes(
        archiveText.text,
        repeatedMedium ? Math.min(failureBaseline, 1536) : failureBaseline,
        contextUsage,
      );
      const effectiveCapsuleMax = this.broker.utilityCapsuleMaxBytes(
        subjectKey,
        decision.outcome.status,
        baselineCapsuleMax,
        pressureCeiling,
      );
      const renderedCapsule = forceDelta
        ? this.broker.renderDelta(decision, metadata, effectiveCapsuleMax)
        : large
          ? renderBoundedCapsule(archiveText.sourceRecords ?? [], {
              outcomeText: archiveText.outcomeText ?? archiveText.text,
              traceLineCount: archiveText.traceLineCount ?? 0,
              nonEmptyLineCount: archiveText.nonEmptyLineCount ?? lineCount,
              summaryLines: archiveText.summaryLines,
            }, metadata, effectiveCapsuleMax)
          : renderCapsule(archiveText.text, metadata, effectiveCapsuleMax);
      const mediaOnlyAdmission = forceMedia && belowConfiguredThreshold && !forceDelta;
      const capsule = mediaOnlyAdmission ? "" : renderedCapsule;
      const capsuleBytes = utf8Bytes(capsule);
      const poorReturn = capsuleBytes > textBytes * 0.30;
      if (!forceMedia && ((forceDelta && poorReturn)
        || (belowConfiguredThreshold && decision.outcome.status === "failure" && textBytes < 8192 && poorReturn))) {
        this.broker.recordPassThrough();
        return null;
      }

      await mkdir(this.observationsPath, { recursive: true });
      const relativeFile = join("observations", `${id}.meta.json`);
      const synthetic: ExchangeObservationMetadata = exchange ?? {
        exchangeId: id,
        toolCallId: id,
        intentKind: "unknown",
        subjectKey: `${toolName}:result`,
        resources: [],
        mutatesWorkspace: false,
        modelInputBytes: 0,
        executedInputBytes: 0,
        outcome: decision.outcome,
      };
      const envelope = this.newEnvelope(synthetic, toolName, archiveText.source, capsule, isError);
      try {
        await this.appendPart(envelope, {
          name: "result",
          kind: "result",
          mediaType: "text/plain; charset=utf-8",
          source: partSource,
        }, signal);
        for (const part of parts) await this.appendPart(envelope, part, signal);
        await this.writeEnvelope(relativeFile, envelope, signal);
        const ref: ObservationEnvelopeIndexRefV2 = {
          schema: "prime-context.exchange/v2",
          id,
          relativeFile,
        };
        const record = this.envelopeRecord(ref, envelope);
        await this.publishRecord(record, signal);
        this.rememberLargePart(toolName, subjectKey, archiveText, this.resultPart(record));
        const archivedBytes = envelope.parts.reduce(
          (total, part) => total + (part.textBytes ?? part.binaryBytes ?? 0),
          0,
        );
        this.broker.recordArchive({
          subjectKey,
          sourceBytes: archivedBytes,
          projectedBytes: mediaOnlyAdmission ? archivedBytes : capsuleBytes,
          streamingBytes: archivedBytes,
        });
        if (mediaOnlyAdmission) this.broker.recordPassThrough();
        else this.broker.recordCapsule(forceDelta);
        await this.flushSessionState(signal).catch(() => undefined);
        return {
          content: mediaOnlyAdmission ? [...content] : replaceVisibleText(content, capsule),
          observation: record,
        };
      } catch (error) {
        await Promise.all(envelope.parts.flatMap((part) => part.chunks).map((chunk) =>
          rm(join(this.sessionPath, chunk.relativeFile), { force: true }).catch(() => undefined)
        ));
        await rm(join(this.sessionPath, relativeFile), { force: true }).catch(() => undefined);
        throw error;
      }
    });
  }

  private async *streamPartBytes(part: ObservationPart, signal?: AbortSignal): AsyncGenerator<Buffer> {
    for (const chunk of part.chunks) {
      const input = createReadStream(join(this.sessionPath, chunk.relativeFile), { signal });
      const output = input.pipe(createGunzip());
      try {
        for await (const value of output) {
          signal?.throwIfAborted();
          yield Buffer.isBuffer(value) ? value : Buffer.from(value);
        }
      } finally {
        input.destroy();
        output.destroy();
      }
    }
  }

  private async compareSourceToPart(
    source: StreamPartSource,
    part: ObservationPart,
    signal?: AbortSignal,
  ): Promise<boolean> {
    const right = this.streamPartBytes(part, signal)[Symbol.asyncIterator]();
    let rightBuffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let rightOffset = 0;
    try {
      for await (const leftBuffer of sourceBytes(source, signal)) {
        let leftOffset = 0;
        while (leftOffset < leftBuffer.byteLength) {
          if (rightOffset >= rightBuffer.byteLength) {
            const next = await right.next();
            if (next.done) return false;
            rightBuffer = next.value;
            rightOffset = 0;
          }
          const length = Math.min(leftBuffer.byteLength - leftOffset, rightBuffer.byteLength - rightOffset);
          if (!leftBuffer.subarray(leftOffset, leftOffset + length)
            .equals(rightBuffer.subarray(rightOffset, rightOffset + length))) return false;
          leftOffset += length;
          rightOffset += length;
        }
      }
      if (rightOffset < rightBuffer.byteLength) return false;
      return (await right.next()).done === true;
    } finally {
      await right.return?.(undefined as never);
    }
  }

  async sourceEqualsPart(
    observationId: string,
    partName: string,
    source: StreamPartSource,
    signal?: AbortSignal,
  ): Promise<boolean> {
    await this.readCatalog(signal);
    const observation = this.catalogById.get(normalizeObservationRef(observationId));
    if (!observation) throw new Error(`Unknown observation ID: ${observationId}`);
    const part = observation.envelope?.parts.find((candidate) =>
      candidate.name === partName && candidate.textBytes !== undefined
    );
    if (!part) throw new Error(`Unknown observation part: ${observationId}:${partName}`);
    return this.compareSourceToPart(source, part, signal);
  }

  private async isLargeExactRepeat(
    toolName: string,
    subjectKey: string,
    archiveText: ResolvedArchiveText,
    textBytes: number,
    lineCount: number,
    source: StreamPartSource,
    signal?: AbortSignal,
  ): Promise<boolean> {
    const head = archiveText.head ?? [];
    const tail = archiveText.tail ?? [];
    const candidates = this.recentLargeParts.filter((candidate) =>
      candidate.toolName === toolName && candidate.subjectKey === subjectKey && candidate.textBytes === textBytes && candidate.lineCount === lineCount &&
      candidate.head.length === head.length && candidate.tail.length === tail.length &&
      candidate.head.every((line, index) => line === head[index]) &&
      candidate.tail.every((line, index) => line === tail[index])
    ).slice(-2);
    for (const candidate of candidates) {
      if (await this.compareSourceToPart(source, candidate.part, signal)) return true;
    }
    return false;
  }

  private rememberLargePart(
    toolName: string,
    subjectKey: string,
    archiveText: ResolvedArchiveText,
    part: ObservationPart | undefined,
  ): void {
    if (!part || !archiveText.large) return;
    this.recentLargeParts.push({
      toolName,
      subjectKey,
      textBytes: archiveText.textBytes ?? part.textBytes ?? 0,
      lineCount: archiveText.lineCount ?? part.lineCount ?? 0,
      head: [...archiveText.head ?? []],
      tail: [...archiveText.tail ?? []],
      part,
    });
    if (this.recentLargeParts.length > 8) this.recentLargeParts.shift();
  }

  private async *streamChunkLines(
    chunk: ObservationChunk,
    maxLineBytes: number,
    query?: string,
    signal?: AbortSignal,
  ): AsyncGenerator<{ lineNumber: number; text: string; matches: boolean; truncated: boolean }> {
    const input = createReadStream(join(this.sessionPath, chunk.relativeFile), { signal });
    const output = input.pipe(createGunzip());
    const decoder = new StringDecoder("utf8");
    const needle = query?.toLowerCase();
    let text = "";
    let textBytes = 0;
    let searchTail = "";
    let matches = false;
    let truncated = false;
    let emitted = 0;

    const consume = (value: string): void => {
      if (needle) {
        const searchable = searchTail + value;
        if (searchable.toLowerCase().includes(needle)) matches = true;
        searchTail = needle.length <= 1 ? "" : searchable.slice(-(needle.length - 1));
      }
      if (textBytes >= maxLineBytes) {
        if (value.length > 0) truncated = true;
        return;
      }
      const remaining = maxLineBytes - textBytes;
      const kept = truncateUtf8(value, remaining);
      text += kept;
      textBytes += utf8Bytes(kept);
      if (kept !== value) truncated = true;
    };
    const finish = () => {
      const record = { lineNumber: (chunk.firstLine ?? 1) + emitted, text, matches, truncated };
      emitted += 1;
      text = "";
      textBytes = 0;
      searchTail = "";
      matches = false;
      truncated = false;
      return record;
    };
    const decodedPieces = async function* (): AsyncGenerator<string> {
      for await (const value of output) {
        signal?.throwIfAborted();
        const decoded = decoder.write(Buffer.isBuffer(value) ? value : Buffer.from(value));
        if (decoded) yield decoded;
      }
      const final = decoder.end();
      if (final) yield final;
    };
    try {
      for await (const decoded of decodedPieces()) {
        let offset = 0;
        for (;;) {
          const newline = decoded.indexOf("\n", offset);
          if (newline < 0) {
            consume(decoded.slice(offset));
            break;
          }
          consume(decoded.slice(offset, newline));
          yield finish();
          offset = newline + 1;
        }
      }
      while (emitted < (chunk.lineCount ?? emitted + (text.length > 0 ? 1 : 0))) yield finish();
    } finally {
      input.destroy();
      output.destroy();
    }
  }

  private resultPart(record: ObservationRecord): ObservationPart | undefined {
    return record.envelope?.parts.find((part) => part.name === "result" && part.kind === "result");
  }

  private resolvePart(record: ObservationRecord, ref: string): ObservationPart {
    const parsed = parseObservationRef(ref);
    if (parsed.id !== record.id || !record.envelope) {
      const result = parsed.id === record.id && parsed.partName === "result" ? this.resultPart(record) : undefined;
      if (result) return result;
      throw new Error(`Unknown observation part: ${ref}`);
    }
    const part = parsed.pointer === undefined
      ? record.envelope.parts.find((candidate) => candidate.name === parsed.partName)
      : record.envelope.parts.find((candidate) =>
        candidate.kind === "call-field" && candidate.name === "call" && candidate.pointer === parsed.pointer
      );
    if (!part) throw new Error(`Unknown observation part: ${ref}`);
    return part;
  }

  private async readBinaryPart(part: ObservationPart, ref: string, signal?: AbortSignal): Promise<Buffer> {
    if (part.binaryBytes === undefined || part.chunks.length !== 1) {
      throw new Error(`Observation part ${ref} is text and cannot be read as an image.`);
    }
    return readFile(join(this.sessionPath, part.chunks[0].relativeFile), { signal });
  }

  private renderStreamMatches(
    matches: readonly number[],
    lines: ReadonlyMap<number, string>,
    contextLines: number,
    totalLines: number,
  ): string {
    if (matches.length === 0) return "";
    const matched = new Set(matches);
    const ranges: Array<{ first: number; last: number; matches: number[] }> = [];
    for (const line of matches) {
      const first = Math.max(1, line - contextLines);
      const last = Math.min(totalLines, line + contextLines);
      const current = ranges.at(-1);
      if (current && first <= current.last + 1) {
        current.last = Math.max(current.last, last);
        current.matches.push(line);
      } else {
        ranges.push({ first, last, matches: [line] });
      }
    }
    return ranges.map((range) => {
      const heading = range.matches.length === 1
        ? `Match at line ${range.matches[0]}:`
        : `Matches at lines ${range.matches.join(", ")}:`;
      const output = [heading];
      for (let line = range.first; line <= range.last; line += 1) {
        const value = lines.get(line);
        if (value === undefined) continue;
        output.push(`${matched.has(line) ? ">" : " "} ${line}: ${value}`);
      }
      return output.join("\n");
    }).join("\n\n");
  }

  private async readTextPart(part: ObservationPart, ref: string, signal?: AbortSignal): Promise<string> {
    if (part.textBytes === undefined) throw new Error(`Observation part ${ref} is binary and cannot be read as text.`);
    const texts: string[] = [];
    for (const chunk of part.chunks) {
      const compressed = await readFile(join(this.sessionPath, chunk.relativeFile), { signal });
      signal?.throwIfAborted();
      texts.push((await gunzipAsync(compressed)).toString("utf8"));
    }
    return texts.join("");
  }

  private async readTextPartPrefix(
    part: ObservationPart,
    ref: string,
    maxBytes: number,
    signal?: AbortSignal,
  ): Promise<string> {
    if (part.textBytes === undefined) throw new Error(`Observation part ${ref} is binary and cannot be read as text.`);
    let text = "";
    for (const chunk of part.chunks) {
      const compressed = await readFile(join(this.sessionPath, chunk.relativeFile), { signal });
      signal?.throwIfAborted();
      text += (await gunzipAsync(compressed)).toString("utf8");
      if (utf8Bytes(text) >= maxBytes) break;
    }
    return truncateUtf8(text, maxBytes);
  }

  private async readCompressedChunkBytes(
    relativeFile: string,
    requestedStart: number,
    maxBytes: number,
    signal?: AbortSignal,
  ): Promise<Buffer> {
    const input = createReadStream(join(this.sessionPath, relativeFile), { signal });
    const output = input.pipe(createGunzip());
    const selected: Buffer[] = [];
    let offset = 0;
    let captured = 0;
    try {
      for await (const raw of output) {
        signal?.throwIfAborted();
        const body = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
        const bodyEnd = offset + body.byteLength;
        if (bodyEnd > requestedStart && captured < maxBytes) {
          const localStart = Math.max(0, requestedStart - offset);
          const take = Math.min(body.byteLength - localStart, maxBytes - captured);
          if (take > 0) {
            selected.push(body.subarray(localStart, localStart + take));
            captured += take;
          }
        }
        offset = bodyEnd;
        if (captured >= maxBytes) break;
      }
    } finally {
      output.destroy();
      input.destroy();
    }
    return Buffer.concat(selected);
  }

  private async readTextPartBytes(
    part: ObservationPart,
    ref: string,
    requestedStart: number,
    maxBytes: number,
    signal?: AbortSignal,
  ): Promise<{ text: string; startByte: number; endByte: number; totalBytes: number; hasMore: boolean }> {
    if (part.textBytes === undefined) throw new Error(`Observation part ${ref} is binary and cannot be read as text.`);
    const totalBytes = part.textBytes;
    if (!Number.isInteger(requestedStart) || requestedStart < 0 || requestedStart >= Math.max(1, totalBytes)) {
      throw new Error(`startByte must be between 0 and ${Math.max(0, totalBytes - 1)} for ${ref}.`);
    }
    const selected: Buffer[] = [];
    let absolute = 0;
    let captured = 0;
    const targetBytes = maxBytes + 4;
    for (const chunk of part.chunks) {
      const chunkEnd = absolute + chunk.textBytes;
      if (chunkEnd > requestedStart && captured < targetBytes) {
        const localStart = Math.max(0, requestedStart - absolute);
        const take = Math.min(chunk.textBytes - localStart, targetBytes - captured);
        if (take > 0) {
          const bytes = await this.readCompressedChunkBytes(
            chunk.relativeFile,
            localStart,
            take,
            signal,
          );
          selected.push(bytes);
          captured += bytes.byteLength;
        }
      }
      absolute = chunkEnd;
      if (captured >= targetBytes) break;
    }
    let bytes = Buffer.concat(selected);
    let startByte = requestedStart;
    while (bytes.length > 0 && (bytes[0] & 0xc0) === 0x80) {
      bytes = bytes.subarray(1);
      startByte += 1;
    }
    const decoder = new StringDecoder("utf8");
    let consumed = Math.min(bytes.byteLength, maxBytes);
    let text = decoder.write(bytes.subarray(0, consumed));
    while (text.length === 0 && consumed < bytes.byteLength) {
      text += decoder.write(bytes.subarray(consumed, consumed + 1));
      consumed += 1;
    }
    const returnedBytes = utf8Bytes(text);
    const endByte = startByte + returnedBytes;
    return { text, startByte, endByte, totalBytes, hasMore: endByte < totalBytes };
  }

  private async readRecordText(record: ObservationRecord, signal?: AbortSignal): Promise<string> {
    if (record.envelope) {
      const result = record.envelope.parts.find((part) => part.name === "result" && part.kind === "result");
      if (!result) throw new Error(`Unknown observation part: ${record.id}:result`);
      return this.readTextPart(result, `${record.id}:result`, signal);
    }
    const compressed = await readFile(join(this.sessionPath, record.relativeFile), { signal });
    signal?.throwIfAborted();
    return (await gunzipAsync(compressed)).toString("utf8");
  }

  async readExactText(ref: string, signal?: AbortSignal): Promise<string> {
    const parsed = parseObservationRef(ref);
    if (parsed.id !== ref) throw new Error(`Unknown observation ID: ${ref}`);
    const record = await this.findObservation(parsed.id, signal);
    return this.readRecordText(record, signal);
  }

  async readLines(
    id: string,
    startLine = 1,
    endLine = startLine + 199,
    maxBytes = 65536,
    signal?: AbortSignal,
  ): Promise<string> {
    return this.readPartLines(`${normalizeObservationRef(id)}:result`, startLine, endLine, maxBytes, signal);
  }

  async readPartLines(
    ref: string,
    startLine = 1,
    endLine = startLine + 199,
    maxBytes = 65536,
    signal?: AbortSignal,
    includeOutsideTask = false,
  ): Promise<string> {
    validateLineRange(startLine, endLine);
    const parsed = parseObservationRef(ref);
    const record = await this.findObservation(parsed.id, signal, includeOutsideTask);
    const part = record.envelope ? this.resolvePart(record, ref) : undefined;
    const bodyBudget = Math.max(0, maxBytes - Math.min(512, Math.floor(maxBytes / 4)));
    if (!part || part.chunks.some((chunk) => chunk.firstLine === undefined || chunk.lineCount === undefined)) {
      const text = part ? await this.readTextPart(part, ref, signal) : await this.readRecordText(record, signal);
      const lines = splitVisibleLines(text);
      if (startLine > lines.length) {
        return truncateUtf8(`Observation part ${ref}: startLine ${startLine} is beyond its ${lines.length} lines.\n`, maxBytes);
      }
      const requestedEnd = Math.min(endLine, lines.length);
      const selected: string[] = [];
      let retainedBytes = 0;
      for (let lineNumber = startLine; lineNumber <= requestedEnd; lineNumber += 1) {
        const rendered = `${lineNumber}: ${lines[lineNumber - 1]}`;
        const bytes = utf8Bytes(rendered) + (selected.length === 0 ? 0 : 1);
        if (retainedBytes + bytes > bodyBudget) break;
        selected.push(rendered);
        retainedBytes += bytes;
      }
      const returnedEnd = selected.length === 0 ? startLine - 1 : startLine + selected.length - 1;
      const header = selected.length === 0
        ? `Observation part ${ref}: no complete line fits the ${maxBytes}-byte response budget. More lines exist.\n`
        : `Observation part ${ref}: lines ${startLine}-${returnedEnd} of ${lines.length}.` +
          (returnedEnd < lines.length ? " More lines exist.\n" : "\n");
      return boundedResponse(header, selected.join("\n"), maxBytes);
    }
    const totalLines = part.lineCount ?? 0;
    if (startLine > totalLines) {
      return truncateUtf8(`Observation part ${ref}: startLine ${startLine} is beyond its ${totalLines} lines.\n`, maxBytes);
    }
    const requestedEnd = Math.min(endLine, totalLines);
    const selected: string[] = [];
    let retainedBytes = 0;
    const chunks = part.chunks.filter((chunk) => {
      const first = chunk.firstLine as number;
      const last = first + (chunk.lineCount as number) - 1;
      return first <= requestedEnd && last >= startLine;
    });
    outer: for (const chunk of chunks) {
      for await (const line of this.streamChunkLines(chunk, Math.max(0, bodyBudget - retainedBytes), undefined, signal)) {
        if (line.lineNumber < startLine) continue;
        if (line.lineNumber > requestedEnd) break outer;
        if (line.truncated) break outer;
        const rendered = `${line.lineNumber}: ${line.text}`;
        const bytes = utf8Bytes(rendered) + (selected.length === 0 ? 0 : 1);
        if (retainedBytes + bytes > bodyBudget) break outer;
        selected.push(rendered);
        retainedBytes += bytes;
      }
    }
    const returnedEnd = selected.length === 0 ? startLine - 1 : Number(/^\d+/.exec(selected.at(-1) ?? "")?.[0]);
    const header = selected.length === 0
      ? `Observation part ${ref}: no complete line fits the ${maxBytes}-byte response budget. More lines exist.\n`
      : `Observation part ${ref}: lines ${startLine}-${returnedEnd} of ${totalLines}.` +
        (returnedEnd < totalLines ? " More lines exist.\n" : "\n");
    return boundedResponse(header, selected.join("\n"), maxBytes);
  }

  async search(
    id: string,
    query: string,
    contextLines = 1,
    matchOffset = 0,
    maxMatches = 50,
    maxBytes = 65536,
    signal?: AbortSignal,
  ): Promise<string> {
    return this.searchPart(
      `${normalizeObservationRef(id)}:result`, query, contextLines, matchOffset, maxMatches, maxBytes, signal,
    );
  }

  async searchPart(
    ref: string,
    query: string,
    contextLines = 1,
    matchOffset = 0,
    maxMatches = 50,
    maxBytes = 65536,
    signal?: AbortSignal,
    includeOutsideTask = false,
  ): Promise<string> {
    if (query.length === 0) throw new Error("query must be a non-empty fixed string.");
    validateContextLines(contextLines);
    validateMatchOffset(matchOffset);
    validateMaxMatches(maxMatches);
    const parsed = parseObservationRef(ref);
    const record = await this.findObservation(parsed.id, signal, includeOutsideTask);
    const part = record.envelope ? this.resolvePart(record, ref) : undefined;
    if (!part || part.chunks.some((chunk) => chunk.firstLine === undefined || chunk.lineCount === undefined)) {
      const text = part ? await this.readTextPart(part, ref, signal) : await this.readRecordText(record, signal);
      const lines = splitVisibleLines(text);
      const matches = findMatchingLines(lines, query.toLowerCase(), matchOffset + maxMatches + 1);
      if (matches.length === 0) return `No matches for "${query}" in ${ref}.`;
      const shown = matches.slice(matchOffset, matchOffset + maxMatches);
      if (shown.length === 0) {
        return `No matches for "${query}" in ${ref} at match offset ${matchOffset}. Earlier matches exist.`;
      }
      const hasMore = matches.length > matchOffset + maxMatches;
      const header = `Search ${ref} for "${query}" at match offset ${matchOffset}: ` +
        `${shown.length} match${shown.length === 1 ? "" : "es"}.` +
        (matchOffset > 0 ? " Earlier matches exist." : "") + (hasMore ? " More matches exist.\n" : "\n");
      return boundedResponse(header, renderMatches(lines, shown, contextLines), maxBytes);
    }

    const shown: number[] = [];
    const captured = new Map<number, string>();
    const previous: Array<{ lineNumber: number; text: string }> = [];
    let capturedBytes = 0;
    let matchCount = 0;
    let hasMore = false;
    let scanTruncated = false;
    let captureUntil = 0;
    const keep = (line: { lineNumber: number; text: string }): void => {
      if (captured.has(line.lineNumber) || capturedBytes >= maxBytes * 2) return;
      captured.set(line.lineNumber, line.text);
      capturedBytes += utf8Bytes(line.text) + 16;
    };
    outer: for (const chunk of part.chunks) {
      for await (const line of this.streamChunkLines(chunk, maxBytes, query, signal)) {
        if (line.lineNumber <= captureUntil) keep(line);
        if (line.matches) {
          const index = matchCount;
          matchCount += 1;
          if (index >= matchOffset && shown.length < maxMatches) {
            shown.push(line.lineNumber);
            keep(line);
            for (const context of previous) keep(context);
            captureUntil = Math.max(captureUntil, line.lineNumber + contextLines);
          } else if (index >= matchOffset + maxMatches) {
            hasMore = true;
          }
        }
        previous.push({ lineNumber: line.lineNumber, text: line.text });
        if (previous.length > contextLines) previous.shift();
        const contextComplete = line.lineNumber >= captureUntil;
        if (shown.length >= maxMatches && contextComplete) {
          scanTruncated = line.lineNumber < (part.lineCount ?? line.lineNumber);
          break outer;
        }
        const byteBudgetSatisfied = capturedBytes >= maxBytes;
        if ((byteBudgetSatisfied || hasMore) && contextComplete) {
          hasMore ||= line.lineNumber < (part.lineCount ?? line.lineNumber);
          break outer;
        }
      }
    }

    if (matchCount === 0) return `No matches for "${query}" in ${ref}.`;
    if (shown.length === 0) {
      return `No matches for "${query}" in ${ref} at match offset ${matchOffset}. Earlier matches exist.`;
    }
    const header = `Search ${ref} for "${query}" at match offset ${matchOffset}: ` +
      `${shown.length} match${shown.length === 1 ? "" : "es"}.` +
      (matchOffset > 0 ? " Earlier matches exist." : "") +
      (hasMore ? " More matches exist.\n" : scanTruncated
        ? ` Search stopped at the requested match limit; continue at match offset ${matchOffset + shown.length}.\n`
        : "\n");
    return boundedResponse(
      header,
      this.renderStreamMatches(shown, captured, contextLines, part.lineCount ?? 0),
      maxBytes,
    );
  }

  private recoveryDetails(
    record: ObservationRecord,
    ref: string,
    part: ObservationPart,
    current?: ArchiveRecoveryContext,
  ): ObservationRecoveryDetails {
    const envelope = record.envelope;
    const sameTask = envelope !== undefined && current?.taskKey !== undefined && envelope.taskKey === current.taskKey;
    return {
      observationId: record.id,
      ref,
      partKind: part.kind,
      ...(part.pointer === undefined ? {} : { pointer: part.pointer }),
      ...(part.mediaType === undefined ? {} : { mediaType: part.mediaType }),
      ...(part.binaryBytes === undefined ? {} : { binaryBytes: part.binaryBytes }),
      ...(part.width === undefined ? {} : { width: part.width }),
      ...(part.height === undefined ? {} : { height: part.height }),
      ...(envelope?.subjectKey === undefined ? {} : { subjectKey: envelope.subjectKey }),
      ...(envelope?.resources === undefined ? {} : { resources: [...envelope.resources] }),
      ...(envelope?.suite === undefined ? {} : { suite: { ...envelope.suite } }),
      scope: this.isInActiveScope(record) ? "task" : "session",
      currentWorkspace: sameTask && current?.workspaceRevision !== undefined &&
        envelope.workspaceRevisionAtResult === current.workspaceRevision,
      currentRequirements: sameTask && current?.requirementsRevision !== undefined &&
        envelope.requirementsRevision === current.requirementsRevision,
    };
  }

  async inspect(
    ref: string,
    options: {
      startLine?: number;
      endLine?: number;
      startByte?: number;
      endByte?: number;
      query?: string;
      contextLines?: number;
      matchOffset?: number;
      maxMatches?: number;
      maxBytes?: number;
      current?: ArchiveRecoveryContext;
    } = {},
    signal?: AbortSignal,
    includeOutsideTask = false,
  ): Promise<ObservationInspection> {
    const parsed = parseObservationRef(ref);
    const record = await this.findObservation(parsed.id, signal, includeOutsideTask);
    const part = this.resolvePart(record, ref);
    const details = this.recoveryDetails(record, ref, part, options.current);
    if (part.binaryBytes !== undefined) {
      const imagePart = part.kind === "image" ||
        (part.kind === "attachment" && part.mediaType?.toLowerCase().startsWith("image/") === true);
      if (!imagePart) throw new Error(`Observation part ${ref} is binary but is not an image.`);
      const mediaType = part.mediaType?.toLowerCase() ?? "application/octet-stream";
      const dimensions = part.width && part.height ? `${part.width}x${part.height}` : "unknown";
      const label = `Image ${ref} | ${mediaType} | ${part.binaryBytes} bytes | ${dimensions}`;
      const providerImage = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]).has(mediaType);
      if (!providerImage || part.binaryBytes > RECOVERY_IMAGE_MAX_BYTES) {
        const reason = !providerImage
          ? "this MIME type cannot be displayed by the provider"
          : `the image exceeds the ${RECOVERY_IMAGE_MAX_BYTES}-byte display limit`;
        return {
          content: [{ type: "text", text: `${label} | exact bytes are archived but ${reason}.` }],
          details,
        };
      }
      const bytes = await this.readBinaryPart(part, ref, signal);
      return {
        content: [
          { type: "text", text: label },
          { type: "image", data: bytes.toString("base64"), mimeType: mediaType },
        ],
        details,
      };
    }

    const maxBytes = Math.max(1, options.maxBytes ?? 12 * 1024);
    let text: string;
    let truncatedByBytes = false;
    let startLine: number | undefined;
    let endLine: number | undefined;
    let bytePage: { startByte: number; endByte: number; totalBytes: number; hasMore: boolean } | undefined;
    if (options.query !== undefined) {
      text = await this.searchPart(
        ref,
        options.query,
        options.contextLines ?? 1,
        options.matchOffset ?? 0,
        options.maxMatches ?? 10,
        maxBytes,
        signal,
        includeOutsideTask,
      );
      const lines = [...text.matchAll(/^[ >]\s+(\d+):/gm)].map((match) => Number(match[1]));
      if (lines.length > 0) {
        startLine = Math.min(...lines);
        endLine = Math.max(...lines);
      }
    } else if (options.startByte !== undefined ||
      (part.kind === "call-field" && options.startLine === undefined && options.endLine === undefined)) {
      const requestedStart = options.startByte ?? 0;
      const requestedBytes = options.endByte === undefined
        ? maxBytes
        : Math.min(maxBytes, Math.max(1, options.endByte - requestedStart));
      const page = await this.readTextPartBytes(part, ref, requestedStart, requestedBytes, signal);
      text = page.text;
      bytePage = page;
    } else {
      const requestedStart = options.startLine ?? 1;
      const requestedEnd = options.endLine ?? requestedStart + 79;
      text = await this.readPartLines(
        ref,
        requestedStart,
        Math.min(requestedEnd, requestedStart + 79, part.lineCount ?? requestedEnd),
        maxBytes,
        signal,
        includeOutsideTask,
      );
      const returned = [...text.matchAll(/^(\d+):/gm)].map((match) => Number(match[1]));
      if (returned.length > 0) {
        startLine = returned[0];
        endLine = returned.at(-1);
      }
    }
    return {
      content: [{ type: "text", text }],
      details: {
        ...details,
        ...(startLine === undefined ? {} : { startLine }),
        ...(endLine === undefined ? {} : { endLine }),
        ...(part.lineCount === undefined ? {} : { totalLines: part.lineCount }),
        ...(bytePage === undefined ? {} : {
          startByte: bytePage.startByte,
          endByte: bytePage.endByte,
          totalBytes: bytePage.totalBytes,
        }),
        hasMore: bytePage?.hasMore ??
          (truncatedByBytes || endLine === undefined || endLine < (part.lineCount ?? endLine ?? 0)),
      },
    };
  }

  async recall(
    options: RecallOptions,
    maxBytes = 12 * 1024,
    current?: ArchiveRecoveryContext,
    signal?: AbortSignal,
    externalSources: readonly RecallArchiveSource[] = [],
  ): Promise<RecallResult> {
    validateContextLines(options.contextLines ?? 1);
    const requestedScope = options.scope ?? "task";
    const availableSources: Array<{
      archive: ObservationArchive;
      scope: RecallScope;
      sessionId: string;
      sessionDate?: string;
    }> = requestedScope === "task" || requestedScope === "session"
      ? [{ archive: this, scope: requestedScope, sessionId: this.sessionId }]
      : externalSources
        .filter((source) => source.scope === requestedScope)
        .map((source) => ({ ...source }));
    let exactInput = options.id;
    let sources = availableSources;
    if (exactInput && requestedScope !== "task") {
      const qualified = [...availableSources]
        .sort((left, right) => right.sessionId.length - left.sessionId.length)
        .find((source) => exactInput!.startsWith(`${source.sessionId}:`));
      if (qualified) {
        exactInput = exactInput.slice(qualified.sessionId.length + 1);
        sources = [qualified];
      }
    }
    const exact = exactInput ? parseObservationRef(exactInput) : undefined;
    const query = options.query?.toLowerCase();
    const path = options.path;
    const activeDiagnosticIds = new Set(current?.activeDiagnosticExchangeIds ?? []);
    const activeDiagnosticSignals = new Set(current?.activeDiagnosticSignals ?? []);
    const kindMatches = (part: ObservationPart): boolean => {
      if (!options.kind) return true;
      if (options.kind === "call") return part.kind === "call" || part.kind === "call-field";
      if (options.kind === "diagnostic") return part.kind === "stderr" || part.kind === "traceback";
      if (options.kind === "image") {
        return part.kind === "image" ||
          (part.kind === "attachment" && part.mediaType?.toLowerCase().startsWith("image/") === true);
      }
      return part.kind === options.kind;
    };
    const sourceRecords = (await Promise.all(sources.map(async (source) => ({
      source,
      records: [...await source.archive.readCatalog(signal)].filter((record) =>
        source.scope !== "task" || source.archive.isInActiveScope(record)
      ),
    })))).flatMap(({ source, records }) => records.map((record, catalogRecency) => ({
      source,
      record,
      catalogRecency,
    })));
    const seeds = sourceRecords.flatMap(({ source, record, catalogRecency }) => {
      const envelope = record.envelope;
      if (!envelope) return [];
      if (exact && exact.id !== record.id) return [];
      if (options.tool && envelope.toolName !== options.tool) return [];
      if (options.status === "error" && !record.isError) return [];
      if (options.status === "failure" && envelope.outcome.status !== "failure") return [];
      if (options.status === "success" && (record.isError || envelope.outcome.status !== "success")) return [];
      const parts = envelope.parts.filter(kindMatches);
      if (parts.length === 0) return [];
      const subjectSignals = [envelope.subjectKey, ...envelope.resources];
      const foldedSubjectSignals = subjectSignals.map((value) => value.toLowerCase());
      const suiteSignals = [envelope.suite?.family, envelope.suite?.target]
        .filter((value): value is string => typeof value === "string");
      const diagnosticSignals = [
        ...envelope.outcome.commandFailures,
        ...envelope.outcome.exceptions,
        ...envelope.outcome.failingTests,
        ...envelope.outcome.sourceLocations,
        ...envelope.outcome.exitStatuses,
        envelope.outcome.testSummary,
        envelope.outcome.signature,
      ].filter((value): value is string => typeof value === "string");
      const foldedSuiteSignals = suiteSignals.map((value) => value.toLowerCase());
      const foldedOutcomeSignals = diagnosticSignals.map((value) => value.toLowerCase());
      const exactPathSubject = Boolean(
        (path && subjectSignals.includes(path)) || (options.query && subjectSignals.includes(options.query))
      );
      const pathMatch = !path || subjectSignals.some((value) => value === path || value.includes(path));
      if (!pathMatch) return [];
      const sameTask = envelope.taskKey === current?.taskKey;
      const currentBranch = source.archive === this && source.archive.isOnActiveBranch(record);
      const activeDiagnostic = Boolean(
        (source.archive === this && sameTask && (
          activeDiagnosticIds.has(record.id) ||
          diagnosticSignals.some((value) => activeDiagnosticSignals.has(value))
        )) ||
        (options.query && envelope.outcome.failingTests.includes(options.query))
      );
      const suiteMatch = Boolean(query && foldedSuiteSignals.includes(query));
      const metadataQueryMatch = Boolean(query && [
        ...foldedSubjectSignals, ...foldedSuiteSignals, ...foldedOutcomeSignals,
      ].some((value) => value === query || value.includes(query)));
      const storedSignalMatch = Boolean(query && [envelope.callSummary, envelope.resultCapsule]
        .some((value) => value.toLowerCase().includes(query)));
      return [{
        source,
        record,
        catalogRecency,
        envelope,
        parts,
        exactPathSubject,
        activeDiagnostic,
        suiteMatch,
        metadataQueryMatch,
        storedSignalMatch,
        currentBranch,
        sameTask,
      }];
    });
    const candidates = await mapBounded(seeds, 4, async (seed) => {
      let fixedStringMatch = false;
      let matchedPartRef: string | undefined;
      if (query) {
        for (const part of seed.parts) {
          if (part.binaryBytes !== undefined) continue;
          const ref = partReference(seed.record.id, part);
          try {
            const found = await seed.source.archive.searchPart(
              ref,
              options.query!,
              0,
              0,
              1,
              256,
              signal,
              true,
            );
            if (!found.startsWith("No matches for")) {
              fixedStringMatch = true;
              matchedPartRef = ref;
              break;
            }
          } catch (error) {
            if (signal?.aborted) throw error;
            continue;
          }
        }
      }
      const exactPartMatch = fixedStringMatch;
      fixedStringMatch ||= seed.storedSignalMatch;
      const rank = [
        exact ? 1 : 0,
        seed.exactPathSubject ? 1 : 0,
        seed.activeDiagnostic ? 1 : 0,
        seed.suiteMatch ? 1 : 0,
        fixedStringMatch ? 1 : 0,
        exactPartMatch ? 1 : 0,
        seed.currentBranch ? 1 : 0,
        seed.sameTask ? 1 : 0,
        seed.sameTask && seed.envelope.workspaceRevisionAtResult === current?.workspaceRevision ? 1 : 0,
        seed.sameTask && seed.envelope.requirementsRevision === current?.requirementsRevision ? 1 : 0,
        Date.parse(seed.record.createdAt) || 0,
        seed.catalogRecency,
      ];
      return { ...seed, fixedStringMatch, exactPartMatch, matchedPartRef, rank };
    });
    candidates.sort((left, right) => {
      for (let index = 0; index < left.rank.length; index += 1) {
        if (left.rank[index] !== right.rank[index]) return right.rank[index] - left.rank[index];
      }
      const sessionOrder = right.source.sessionId.localeCompare(left.source.sessionId);
      return sessionOrder || right.record.id.localeCompare(left.record.id);
    });

    const content: (TextContent | ImageContent)[] = [];
    const sections: string[] = [];
    const matches: ObservationRecoveryDetails[] = [];
    let remaining = maxBytes;
    for (const candidate of candidates) {
      if (matches.length >= 3 || remaining <= 256) break;
      const exactRef = exact?.id === candidate.record.id && exactInput?.includes(":") ? exactInput : undefined;
      const orderedParts = exactRef
        ? candidate.parts.filter((part) => partReference(candidate.record.id, part) === exactRef)
        : candidate.matchedPartRef
          ? [...candidate.parts].sort((left, right) =>
              Number(partReference(candidate.record.id, right) === candidate.matchedPartRef) -
              Number(partReference(candidate.record.id, left) === candidate.matchedPartRef)
            )
          : candidate.parts;
      let selected: ObservationInspection | undefined;
      let partMatched = false;
      if (query && candidate.exactPartMatch) {
        for (const part of orderedParts) {
          if (part.binaryBytes !== undefined) continue;
          const ref = partReference(candidate.record.id, part);
          try {
            const attempt = await candidate.source.archive.inspect(ref, {
              query: options.query,
              contextLines: options.contextLines ?? 1,
              maxBytes: Math.max(1, remaining - 240),
              current,
            }, signal, true);
            const body = attempt.content.find((block): block is TextContent => block.type === "text")?.text ?? "";
            if (body.startsWith("No matches for")) continue;
            selected = attempt;
            partMatched = true;
            break;
          } catch (error) {
            if (signal?.aborted) throw error;
            continue;
          }
        }
      }
      const structuredMatch = Boolean(
        exact || path || candidate.metadataQueryMatch || candidate.storedSignalMatch || !query
      );
      if (!selected && structuredMatch) {
        for (const part of orderedParts) {
          const ref = partReference(candidate.record.id, part);
          try {
            selected = await candidate.source.archive.inspect(ref, {
              ...(part.binaryBytes === undefined ? { startLine: 1, endLine: 20 } : {}),
              maxBytes: Math.max(1, remaining - 240),
              current,
            }, signal, true);
            break;
          } catch (error) {
            if (signal?.aborted) throw error;
            continue;
          }
        }
      }
      if (!selected || (query && !partMatched && !structuredMatch)) continue;
      const external = candidate.source.archive !== this;
      const details: ObservationRecoveryDetails = {
        ...selected.details,
        scope: candidate.source.scope,
        ...((candidate.source.scope !== "task" || external) ? {
          sessionId: candidate.source.sessionId,
          sessionDate: candidate.source.sessionDate ?? candidate.record.createdAt,
        } : {}),
        currentWorkspace: candidate.sameTask && current?.workspaceRevision !== undefined &&
          candidate.envelope.workspaceRevisionAtResult === current.workspaceRevision,
        currentRequirements: candidate.sameTask && current?.requirementsRevision !== undefined &&
          candidate.envelope.requirementsRevision === current.requirementsRevision,
      };
      const label = selected.content.find((block): block is TextContent => block.type === "text")?.text ?? "";
      const heading = [
        `Recall ${details.ref} | ${details.partKind} | scope=${details.scope}`,
        details.sessionId ? `session=${details.sessionId}` : "",
        details.sessionDate ? `date=${details.sessionDate}` : "",
        `subject=${candidate.envelope.subjectKey}`,
        candidate.envelope.resources.length > 0 ? `resources=${candidate.envelope.resources.join(",")}` : "",
        candidate.envelope.suite ? `suite=${candidate.envelope.suite.family}:${candidate.envelope.suite.target}` : "",
        `workspace=${details.currentWorkspace ? "current" : "historical"}`,
        `requirements=${details.currentRequirements ? "current" : "historical"}`,
      ].filter(Boolean).join(" | ");
      const section = truncateUtf8(`${heading}\n${label}`, remaining);
      sections.push(section);
      remaining -= utf8Bytes(section) + 2;
      matches.push(details);
      const image = selected.content.find((block): block is ImageContent => block.type === "image");
      if (image) {
        content.push({ type: "text", text: sections.join("\n\n") }, image);
        sections.length = 0;
        break;
      }
    }
    if (sections.length > 0) content.push({ type: "text", text: sections.join("\n\n") });
    if (content.length === 0) content.push({ type: "text", text: "No recall matches found." });
    return { content, matches };
  }

  private async scanRecordMatches(
    record: ObservationRecord,
    query: string,
    contextLines: number,
    matchOffset: number,
    maxMatches: number,
    maxBytes: number,
    signal?: AbortSignal,
  ): Promise<{
    matchCount: number;
    shown: number[];
    captured: Map<number, string>;
    hasMore: boolean;
    scanTruncated: boolean;
    totalLines: number;
  }> {
    const part = this.resultPart(record);
    if (record.envelope && !part) {
      return { matchCount: 0, shown: [], captured: new Map(), hasMore: false, scanTruncated: false, totalLines: 0 };
    }
    if (!part || part.chunks.some((chunk) => chunk.firstLine === undefined || chunk.lineCount === undefined)) {
      const lines = splitVisibleLines(await this.readRecordText(record, signal));
      const matches = findMatchingLines(lines, query.toLowerCase(), matchOffset + maxMatches + 1);
      const shown = matches.slice(matchOffset, matchOffset + maxMatches).map((line) => line + 1);
      const captured = new Map<number, string>();
      for (const line of shown) {
        for (let context = Math.max(1, line - contextLines); context <= Math.min(lines.length, line + contextLines); context += 1) {
          captured.set(context, lines[context - 1]);
        }
      }
      return {
        matchCount: matches.length,
        shown,
        captured,
        hasMore: matches.length > matchOffset + maxMatches,
        scanTruncated: false,
        totalLines: lines.length,
      };
    }
    const shown: number[] = [];
    const captured = new Map<number, string>();
    const previous: Array<{ lineNumber: number; text: string }> = [];
    let capturedBytes = 0;
    let matchCount = 0;
    let hasMore = false;
    let scanTruncated = false;
    let captureUntil = 0;
    const keep = (line: { lineNumber: number; text: string }): void => {
      if (captured.has(line.lineNumber) || capturedBytes >= maxBytes * 2) return;
      captured.set(line.lineNumber, line.text);
      capturedBytes += utf8Bytes(line.text) + 16;
    };
    outer: for (const chunk of part.chunks) {
      for await (const line of this.streamChunkLines(chunk, maxBytes, query, signal)) {
        if (line.lineNumber <= captureUntil) keep(line);
        if (line.matches) {
          const index = matchCount;
          matchCount += 1;
          if (index >= matchOffset && shown.length < maxMatches) {
            shown.push(line.lineNumber);
            keep(line);
            for (const context of previous) keep(context);
            captureUntil = Math.max(captureUntil, line.lineNumber + contextLines);
          } else if (index >= matchOffset + maxMatches) {
            hasMore = true;
          }
        }
        previous.push({ lineNumber: line.lineNumber, text: line.text });
        if (previous.length > contextLines) previous.shift();
        const contextComplete = line.lineNumber >= captureUntil;
        if (shown.length >= maxMatches && contextComplete) {
          scanTruncated = line.lineNumber < (part.lineCount ?? line.lineNumber);
          break outer;
        }
        const byteBudgetSatisfied = capturedBytes >= maxBytes;
        if ((byteBudgetSatisfied || hasMore) && contextComplete) {
          hasMore ||= line.lineNumber < (part.lineCount ?? line.lineNumber);
          break outer;
        }
      }
    }
    return { matchCount, shown, captured, hasMore, scanTruncated, totalLines: part.lineCount ?? 0 };
  }

  async searchRecent(
    query: string,
    observationLimit = 20,
    contextLines = 1,
    matchOffset = 0,
    maxMatches = 50,
    maxBytes = 65536,
    signal?: AbortSignal,
  ): Promise<string> {
    if (query.length === 0) throw new Error("query must be a non-empty fixed string.");
    validateContextLines(contextLines);
    validateMatchOffset(matchOffset);
    validateMaxMatches(maxMatches);
    const observations = await this.list(observationLimit, signal);
    if (observations.length === 0) return "No archived observations in this session.";

    const sections: string[] = [];
    let shownCount = 0;
    let skip = matchOffset;
    let sawAnyMatch = false;
    let hasMore = false;
    let scanTruncated = false;
    for (const observation of observations) {
      signal?.throwIfAborted();
      const remaining = maxMatches - shownCount;
      const result = await this.scanRecordMatches(
        observation,
        query,
        contextLines,
        remaining > 0 ? skip : 0,
        remaining > 0 ? remaining : 1,
        maxBytes,
        signal,
      );
      if (result.matchCount > 0) sawAnyMatch = true;
      if (remaining <= 0) {
        if (result.matchCount > 0) {
          hasMore = true;
          break;
        }
        continue;
      }
      if (result.shown.length > 0) {
        sections.push(
          `Observation ${observation.id} (${observation.toolName}, ${observation.createdAt}):\n` +
            this.renderStreamMatches(result.shown, result.captured, contextLines, result.totalLines),
        );
        shownCount += result.shown.length;
      }
      if (shownCount >= maxMatches) {
        scanTruncated = result.scanTruncated || observation !== observations.at(-1);
        hasMore ||= result.hasMore;
        break;
      }
      if (result.hasMore) {
        hasMore = true;
        break;
      }
      if (result.scanTruncated) {
        scanTruncated = true;
        break;
      }
      if (result.matchCount <= skip) skip -= result.matchCount;
      else skip = 0;
    }

    if (shownCount === 0) {
      return sawAnyMatch
        ? `No matches for "${query}" at match offset ${matchOffset} in the ${observations.length} most recent observations. Earlier matches exist.`
        : `No matches for "${query}" in the ${observations.length} most recent observations.`;
    }
    const header =
      `Search the ${observations.length} most recent observations for "${query}" at match offset ${matchOffset}: ` +
      `${shownCount} match${shownCount === 1 ? "" : "es"} in ${sections.length} observation part` +
      `${sections.length === 1 ? "" : "s"}.` +
      (matchOffset > 0 ? " Earlier matches exist." : "") +
      (hasMore ? " More matches exist.\n" : scanTruncated
        ? ` Search stopped at the requested match limit; continue at match offset ${matchOffset + shownCount}.\n`
        : "\n");
    return boundedResponse(header, sections.join("\n\n"), maxBytes);
  }

  async findObservation(
    ref: string,
    signal?: AbortSignal,
    includeOutsideTask = false,
  ): Promise<ObservationRecord> {
    const id = normalizeObservationRef(ref);
    await this.readCatalog(signal);
    const record = this.catalogById.get(id);
    if (!record || (!includeOutsideTask && !this.isInActiveScope(record))) {
      throw new Error(`Unknown observation ID: ${ref}`);
    }
    return record;
  }

  async importFrom(
    source: ObservationArchive,
    observationIds: readonly string[],
    signal?: AbortSignal,
    forkScope?: { taskKey?: string; branchAnchorId?: string },
  ): Promise<number> {
    const requested = [...new Set(observationIds.map(normalizeObservationRef))];
    if (requested.length === 0) return 0;

    return this.withIndexLock(async () => {
      const sourceRecords = await source.readCatalog(signal);
      const targetRecords = await this.readCatalog(signal);
      const existing = new Set(targetRecords.map((observation) => observation.id));
      const copiedFiles: string[] = [];
      const imported: ObservationRecord[] = [];
      await mkdir(this.observationsPath, { recursive: true });
      try {
        for (const id of requested) {
          if (existing.has(id)) continue;
          const sourceRecord = source.catalogById.get(id);
          if (!sourceRecord) continue;
          signal?.throwIfAborted();
          const observationFiles: string[] = [];
          try {
            if (sourceRecord.envelope) {
              const envelope = structuredClone(sourceRecord.envelope);
              for (const chunk of envelope.parts.flatMap((part) => part.chunks)) {
                const targetFile = join(this.sessionPath, chunk.relativeFile);
                const temporary = `${targetFile}.${randomUUID()}.tmp`;
                copiedFiles.push(temporary);
                observationFiles.push(temporary);
                await copyFile(join(source.sessionPath, chunk.relativeFile), temporary);
                signal?.throwIfAborted();
                await rename(temporary, targetFile);
                copiedFiles.push(targetFile);
                observationFiles.push(targetFile);
              }
              if (forkScope?.taskKey !== undefined) envelope.taskKey = forkScope.taskKey;
              if (forkScope?.branchAnchorId !== undefined) envelope.branchAnchorId = forkScope.branchAnchorId;
              if (forkScope) envelope.forkImported = true;
              const relativeFile = join("observations", `${envelope.id}.meta.json`);
              await this.writeEnvelope(relativeFile, envelope, signal);
              copiedFiles.push(join(this.sessionPath, relativeFile));
              observationFiles.push(join(this.sessionPath, relativeFile));
              imported.push(this.envelopeRecord({
                schema: "prime-context.exchange/v2",
                id: envelope.id,
                relativeFile,
              }, envelope));
            } else {
              const targetFile = join(this.sessionPath, sourceRecord.relativeFile);
              const temporary = `${targetFile}.${randomUUID()}.tmp`;
              copiedFiles.push(temporary);
              observationFiles.push(temporary);
              await copyFile(join(source.sessionPath, sourceRecord.relativeFile), temporary);
              signal?.throwIfAborted();
              await rename(temporary, targetFile);
              copiedFiles.push(targetFile);
              observationFiles.push(targetFile);
              imported.push({
                ...sourceRecord,
                ...(forkScope && sourceRecord.exchange ? {
                  exchange: {
                    ...sourceRecord.exchange,
                    ...(forkScope.taskKey === undefined ? {} : { taskKey: forkScope.taskKey }),
                    ...(forkScope.branchAnchorId === undefined ? {} : { branchAnchorId: forkScope.branchAnchorId }),
                    forkImported: true,
                  },
                } : {}),
              });
            }
            existing.add(id);
          } catch (error) {
            if (signal?.aborted) throw error;
            await Promise.all(observationFiles.map((path) => rm(path, { force: true }).catch(() => undefined)));
          }
        }
        if (imported.length === 0) return 0;
        const combined = [...targetRecords, ...imported];
        const legacy = combined.filter((record) => !record.envelope);
        if (legacy.length > 0) await this.writeIndex({
          schema: "prime-context.observation-index/v1",
          observations: legacy,
        }, signal);
        let nextSequence = this.sessionMetadata?.nextSequence ?? 1;
        for (const record of imported) {
          const match = /^o(\d+)$/.exec(record.id);
          if (match) nextSequence = Math.max(nextSequence, Number(match[1]) + 1);
        }
        const metadata = this.metadataWithBrokerState({
          schema: "prime-context.archive-session/v1",
          nextSequence,
          observationCount: combined.length,
        });
        await this.writeSessionMetadata(metadata, signal);
        targetRecords.push(...imported);
        for (const record of imported) this.catalogById.set(record.id, record);
        this.sessionMetadata = metadata;
        await Promise.all(copiedFiles.filter((path) => path.endsWith(".tmp"))
          .map((path) => rm(path, { force: true }).catch(() => undefined)));
        return imported.length;
      } catch (error) {
        await Promise.all(copiedFiles.map((path) => rm(path, { force: true }).catch(() => undefined)));
        throw error;
      }
    });
  }

  async loadFixedExchangeViews(
    signal?: AbortSignal,
    exchangeIds?: readonly string[],
  ): Promise<FixedExchangeView[]> {
    const requested = exchangeIds ? new Set(exchangeIds) : undefined;
    const views: FixedExchangeView[] = [];
    for (const record of await this.readCatalog(signal)) {
      if (requested && !requested.has(record.id)) continue;
      const envelope = record.envelope;
      const view = envelope?.fixedView;
      if (envelope && envelope.toolName !== "prime_context" &&
        view?.schema === "prime-context.fixed-exchange-view/v1" && view.generation === 0 &&
        typeof view.toolCallId === "string" && Number.isSafeInteger(view.visibleBytes) && view.visibleBytes >= 0) {
        const images = imageRefsForEnvelope(envelope);
        views.push(images.length === 0 ? view : { ...view, images });
      }
    }
    return views;
  }

  async finalizeExchanges(
    exchanges: readonly CompletedExchangeArchive[],
    signal?: AbortSignal,
    fixedViewOptions?: FixedViewFinalizeOptions,
  ): Promise<FixedExchangeView[]> {
    if (exchanges.length === 0) return [];
    return this.withIndexLock(async () => {
      const records = await this.readCatalog(signal);
      const brokerStateBefore = this.broker.persistentState();
      const viewOptions = fixedViewOptions ?? { budgetBytes: 24 * 1024, capsuleMaxBytes: 6144 };
      const archiveAdmissionBytes = Math.min(
        viewOptions.archiveAdmissionBytes ?? 24 * 1024,
        viewOptions.budgetBytes,
      );
      const baselineBySubject = new Map<string, FixedExchangeView>();
      for (const record of records) {
        const envelope = record.envelope;
        const view = envelope?.fixedView;
        if (envelope && view && !isDeltaView(view)) baselineBySubject.set(envelope.subjectKey, view);
      }
      const ordered = exchanges
        .map((completed, inputOrder) => ({ completed, inputOrder }))
        .sort((left, right) =>
          (left.completed.sourceOrder ?? left.inputOrder) - (right.completed.sourceOrder ?? right.inputOrder) ||
          left.inputOrder - right.inputOrder
        )
        .map(({ completed }) => completed);
      interface PreparedEnvelope {
        completed: CompletedExchangeArchive;
        entry: ObservationEnvelopeIndexRefV2;
        envelope: ObservationEnvelopeV2;
        existing?: ObservationRecord;
        obsoleteChunks: Set<string>;
      }
      const prepared: PreparedEnvelope[] = [];
      const createdChunks = new Set<string>();
      const committed: PreparedEnvelope[] = [];
      const generation = `g-${randomUUID()}`;
      const appendPreparedPart = async (
        item: PreparedEnvelope,
        input: ObservationPartInput,
        replacement = false,
      ): Promise<void> => {
        const before = item.envelope.parts.length;
        await this.appendPart(item.envelope, input, signal, replacement ? generation : undefined);
        for (const part of item.envelope.parts.slice(before)) {
          for (const chunk of part.chunks) createdChunks.add(chunk.relativeFile);
        }
      };

      try {
        for (const completed of ordered) {
          const id = completed.metadata.exchangeId;
          const existing = this.catalogById.get(id);
          const entry: ObservationEnvelopeIndexRefV2 = {
            schema: "prime-context.exchange/v2",
            id,
            relativeFile: join("observations", `${id}.meta.json`),
          };
          let envelope: ObservationEnvelopeV2;
          if (existing?.envelope) {
            envelope = structuredClone(existing.envelope);
          } else if (!existing) {
            envelope = this.newEnvelope(
              completed.metadata,
              completed.toolName,
              completed.source,
              completed.toolName === "prime_context" ? "" : completed.admittedCapsule ?? "",
              completed.isError,
            );
          } else {
            continue;
          }
          const item: PreparedEnvelope = { completed, entry, envelope, existing, obsoleteChunks: new Set() };
          if (!existing && !completed.resultChangedAfterHook) {
            for (const part of completed.parts ?? []) {
              if (completed.toolName !== "prime_context" || part.kind !== "result") {
                await appendPreparedPart(item, part);
              }
            }
          }

          envelope.toolName = completed.toolName;
          this.updateEnvelopeMetadata(envelope, completed.metadata);
          envelope.isError = completed.isError;
          if (completed.source !== undefined) envelope.source = completed.source;
          if (completed.toolName === "prime_context") {
            envelope.resultCapsule = "";
            delete envelope.fixedView;
          } else {
            if (!completed.canonicalResultChangedAfterHook && !envelope.resultCapsule && completed.admittedCapsule) {
              envelope.resultCapsule = completed.admittedCapsule;
            }
            if (!envelope.fixedView && completed.fixedView) envelope.fixedView = completed.fixedView;
          }
          if (completed.resultChangedAfterHook) {
            const keepPart = (part: ObservationPart): boolean =>
              part.kind === "call" || part.kind === "call-field" ||
              (!completed.canonicalResultChangedAfterHook && part.kind === "result" && part.name === "result");
            const staleParts = envelope.parts.filter((part) => !keepPart(part));
            for (const part of staleParts) {
              for (const chunk of part.chunks) item.obsoleteChunks.add(chunk.relativeFile);
            }
            envelope.parts = envelope.parts.filter(keepPart);
            if (completed.toolName !== "prime_context") {
              for (const part of completed.parts ?? []) await appendPreparedPart(item, part, true);
            }
            if (completed.canonicalResultChangedAfterHook) {
              envelope.resultCapsule = "";
              delete envelope.fixedView;
            }
          }
          if (completed.persistedModelInput) {
            const existingPointers = new Set(
              envelope.parts.filter((part) => part.kind === "call-field").map((part) => part.pointer),
            );
            const oversizedCallParts = collectOversizedCallFields(
              completed.toolName,
              completed.persistedModelInput,
              archiveAdmissionBytes,
            );
            const callParts = [
              ...oversizedCallParts,
              ...aggregateGenericCallParts(
                completed.toolName, completed.persistedModelInput, archiveAdmissionBytes, oversizedCallParts,
              ),
            ];
            for (const part of callParts) {
              if (!existingPointers.has(part.pointer)) {
                await appendPreparedPart(item, part);
                existingPointers.add(part.pointer);
              }
            }
          }
          prepared.push(item);
        }

        {
          const candidates: FixedViewCandidate[] = [];
          const persistedResultTexts = new Map<string, string>();
          let immutableBytes = 0;
          for (const item of prepared) {
            const { completed, envelope } = item;
            const rawResultContent = completed.persistedRawResult?.content;
            const hasPageableText = Array.isArray(rawResultContent) && rawResultContent.some((block) =>
              block !== null && typeof block === "object" &&
              (block as Record<string, unknown>).type === "text" &&
              !hasOpaqueReplayMetadata(block as Record<string, unknown>)
            );
            const resultReplayProtected = hasOpaqueResultContent(rawResultContent) && !hasPageableText;
            const persistedResultText = completed.largeResult && !resultReplayProtected
              ? completed.resultText
              : rawResultText(completed.persistedRawResult) ?? completed.resultText;
            if (completed.toolName === "prime_context" || persistedResultText === undefined ||
              !completed.persistedModelInput) continue;
            const hasCanonicalResult = envelope.parts.some((part) => part.name === "result" && part.kind === "result");
            if (completed.largeResult && !resultReplayProtected && !hasCanonicalResult) continue;
            const resultText = persistedResultText;
            if (!completed.largeResult || resultReplayProtected) {
              persistedResultTexts.set(envelope.id, persistedResultText);
            }
            if (resultReplayProtected) delete envelope.fixedView;
            let fields = envelope.parts.flatMap((part) =>
              part.kind === "call-field" && part.pointer !== undefined && (part.textBytes ?? 0) > 0
                ? [{ pointer: part.pointer, textBytes: part.textBytes as number, lineCount: part.lineCount ?? 0 }]
                : []
            );
            const rawCall = completed.persistedRawCall ?? {
              type: "toolCall",
              id: envelope.toolCallId,
              name: completed.toolName,
              arguments: completed.persistedModelInput,
            };
            const replayProtected = completed.replayProtected || hasOpaqueReplayMetadata(rawCall);
            const diffRef = envelope.parts.some((part) => part.kind === "diff")
              ? `${envelope.id}:diff`
              : undefined;
            const identityMaxBytes = envelope.fixedView ? 512 : this.broker.noteReadOnlyIntent({
              subjectKey: completed.metadata.subjectKey,
              intentKind: completed.metadata.intentKind,
              mutatesWorkspace: completed.metadata.mutatesWorkspace,
              requirementsRevision: completed.metadata.requirementsRevision ?? 0,
              workspaceRevision: completed.metadata.workspaceRevisionAtResult ?? 0,
            });
            const callContext = {
              intentKind: completed.metadata.intentKind,
              subjectKey: completed.metadata.subjectKey,
              normalizedExecutable: typeof completed.metadata.facts?.normalizedExecutable === "string"
                ? completed.metadata.facts.normalizedExecutable
                : undefined,
              effectiveCwd: completed.metadata.effectiveCwd,
              resources: completed.metadata.resources,
              suite: completed.metadata.suite,
              diffRef,
              identityMaxBytes,
            };
            let compact = compactArchivedCallArguments(
              envelope.id, completed.toolName, completed.persistedModelInput, fields, callContext,
            );
            if (compact && utf8Bytes(JSON.stringify(compact)) > archiveAdmissionBytes &&
              !fields.some((field) => field.pointer === "")) {
              const rootPart = aggregateGenericCallParts(completed.toolName, completed.persistedModelInput, 1)[0];
              if (rootPart?.pointer === "") {
                await appendPreparedPart(item, rootPart);
                const root = envelope.parts.find((part) => part.kind === "call-field" && part.pointer === "");
                if (root?.textBytes) fields = [{ pointer: "", textBytes: root.textBytes, lineCount: root.lineCount ?? 0 }];
                compact = compactArchivedCallArguments(
                  envelope.id, completed.toolName, completed.persistedModelInput, fields, callContext,
                );
              }
            }
            const renderedToolCall = compact === undefined
              ? rawCall
              : { ...rawCall, arguments: compact };
            if (envelope.fixedView) {
              const images = imageRefsForEnvelope(envelope);
              const { images: _previousImages, ...baseView } = envelope.fixedView;
              envelope.fixedView = images.length === 0 ? baseView : { ...baseView, images };
              const fixedToolCall = replayProtected || envelope.fixedView.callArguments === undefined
                ? rawCall
                : { ...rawCall, arguments: envelope.fixedView.callArguments };
              const fixedResult = envelope.fixedView.result.kind === "capsule"
                ? envelope.fixedView.result.text
                : resultText;
              const calculatedBytes = utf8Bytes(JSON.stringify(fixedToolCall)) + utf8Bytes(fixedResult);
              if (replayProtected) envelope.fixedView = { ...envelope.fixedView, visibleBytes: calculatedBytes };
              immutableBytes += replayProtected || !Number.isSafeInteger(envelope.fixedView.visibleBytes)
                ? calculatedBytes
                : envelope.fixedView.visibleBytes;
              continue;
            }
            const outcome = completed.metadata.outcome;
            const hasUniqueDiagnostic = outcome.commandFailures.length > 0 || outcome.exceptions.length > 0 ||
              outcome.failingTests.length > 0 || outcome.sourceLocations.length > 0;
            const capsuleSourceText = !resultReplayProtected && envelope.resultCapsule && completed.resultText !== undefined
              ? completed.resultText
              : resultText;
            candidates.push({
              exchangeId: envelope.id,
              toolCallId: envelope.toolCallId,
              sourceOrder: completed.sourceOrder ?? candidates.length,
              toolName: completed.toolName,
              // Same-origin replay-protected calls remain byte-for-byte raw in
              // the provider view, so budget them at that actual raw size.
              renderedToolCall: replayProtected ? rawCall : renderedToolCall,
              ...(compact === undefined ? {} : { compactCallArguments: compact }),
              resultText,
              ...(!resultReplayProtected && envelope.resultCapsule
                ? { fixedCapsule: envelope.resultCapsule }
                : {}),
              requiresCapsule: !resultReplayProtected && Boolean(completed.canonicalResultChangedAfterHook),
              forceLiteral: resultReplayProtected,
              isError: completed.isError || outcome.status === "failure",
              hasUniqueDiagnostic,
              changesWorkspace: completed.metadata.mutatesWorkspace,
              ...(replayProtected && completed.replayOriginKey
                ? { replayOriginKey: completed.replayOriginKey }
                : {}),
              capsule: (maxBytes) => completed.largeResult && completed.resultSummary?.sourceRecords
                ? renderBoundedCapsule(completed.resultSummary.sourceRecords, {
                    outcomeText: completed.resultSummary.outcomeText ?? capsuleSourceText,
                    traceLineCount: completed.resultSummary.traceLineCount ?? 0,
                    nonEmptyLineCount: completed.resultSummary.nonEmptyLineCount ??
                      completed.resultSummary.lineCount ?? 0,
                    summaryLines: completed.resultSummary.summaryLines,
                  }, {
                    id: `${envelope.id}:result`,
                    toolName: completed.toolName,
                    textBytes: completed.resultSummary.textBytes ?? utf8Bytes(capsuleSourceText),
                    lineCount: completed.resultSummary.lineCount ?? splitVisibleLines(capsuleSourceText).length,
                    source: completed.source ?? envelope.source ?? "visible-tool-result",
                  }, maxBytes)
                : renderCapsule(capsuleSourceText, {
                    id: `${envelope.id}:result`,
                    toolName: completed.toolName,
                    textBytes: utf8Bytes(capsuleSourceText),
                    lineCount: splitVisibleLines(capsuleSourceText).length,
                    source: completed.source ?? envelope.source ?? "visible-tool-result",
                  }, maxBytes),
            });
          }

          const selections = selectFixedExchangeViews(
            candidates,
            Math.max(0, viewOptions.budgetBytes - immutableBytes),
            viewOptions.capsuleMaxBytes,
          );
          const selectedById = new Map(selections.map((selection) => [selection.view.exchangeId, selection]));
          for (const item of prepared) {
            const { completed, envelope } = item;
            let selection = selectedById.get(envelope.id);
            if (!selection) {
              if (envelope.fixedView) completed.fixedView = envelope.fixedView;
              continue;
            }
            if (isDeltaView(selection.view)) {
              const baseline = baselineBySubject.get(envelope.subjectKey);
              if (baseline === undefined) {
                selection = {
                  view: { ...selection.view, result: { kind: "literal" } },
                  foldedResult: false,
                };
                envelope.resultCapsule = "";
              } else {
                selection = {
                  ...selection,
                  view: {
                    ...selection.view,
                    deltaDependency: {
                      baselineToolCallId: baseline.toolCallId,
                      contextEpoch: viewOptions.contextEpoch ?? 0,
                    },
                  },
                };
              }
            }
            if (!isDeltaView(selection.view)) baselineBySubject.set(envelope.subjectKey, selection.view);
            const persistedResultText = persistedResultTexts.get(envelope.id);
            if (selection.foldedResult && persistedResultText !== undefined) {
              const hasCanonicalResult = envelope.parts.some((part) =>
                part.name === "result" && part.kind === "result"
              );
              if (!hasCanonicalResult) {
                await appendPreparedPart(item, {
                  name: "result",
                  kind: "result",
                  mediaType: "text/plain; charset=utf-8",
                  text: persistedResultText,
                }, item.obsoleteChunks.size > 0);
              }
            }
            if (selection.capsule !== undefined) envelope.resultCapsule = selection.capsule;
            const images = imageRefsForEnvelope(envelope);
            const view = images.length === 0 ? selection.view : { ...selection.view, images };
            const rawArguments = completed.persistedModelInput ?? {};
            const fixedArguments = view.callArguments ?? rawArguments;
            const rawText = rawResultText(completed.persistedRawResult) ?? completed.resultText ?? "";
            const fixedText = view.result.kind === "capsule" ? view.result.text : rawText;
            this.broker.recordProjection({
              callArgumentBytesProjectedOut: Math.max(
                0,
                utf8Bytes(JSON.stringify(rawArguments)) - utf8Bytes(JSON.stringify(fixedArguments)),
              ),
              resultBytesProjectedOut: Math.max(0, utf8Bytes(rawText) - utf8Bytes(fixedText)),
            });
            envelope.fixedView = view;
            completed.fixedView = view;
          }
        }

        const newRecords = prepared.filter((item) => !item.existing);
        let newlyArchivedBytes = 0;
        for (const item of prepared) {
          signal?.throwIfAborted();
          await this.writeEnvelope(item.entry.relativeFile, item.envelope, signal);
          committed.push(item);
          const previousParts = new Map((item.existing?.envelope?.parts ?? []).map((part) => [
            `${part.kind}:${part.name}:${part.pointer ?? ""}`,
            part.textBytes ?? part.binaryBytes ?? 0,
          ]));
          for (const part of item.envelope.parts) {
            const key = `${part.kind}:${part.name}:${part.pointer ?? ""}`;
            const bytes = part.textBytes ?? part.binaryBytes ?? 0;
            if (previousParts.get(key) !== bytes) newlyArchivedBytes += bytes;
          }
        }
        this.broker.recordArchivedBytes(newlyArchivedBytes);
        let nextSequence = this.sessionMetadata?.nextSequence ?? 1;
        for (const item of newRecords) {
          const match = /^o(\d+)$/.exec(item.envelope.id);
          if (match) nextSequence = Math.max(nextSequence, Number(match[1]) + 1);
        }
        const metadata = this.metadataWithBrokerState({
          schema: "prime-context.archive-session/v1",
          nextSequence,
          observationCount: records.length + newRecords.length,
        });
        await this.writeSessionMetadata(metadata, signal);

        for (const item of prepared) {
          const record = this.envelopeRecord(item.entry, item.envelope);
          if (item.existing) this.replaceCatalogRecord(record);
          else {
            records.push(record);
            this.catalogById.set(record.id, record);
          }
        }
        this.sessionMetadata = metadata;
        await Promise.all(prepared.flatMap((item) => [...item.obsoleteChunks]).map((relativeFile) =>
          rm(join(this.sessionPath, relativeFile), { force: true }).catch(() => undefined)
        ));
        return prepared.flatMap(({ envelope }) => {
          const view = envelope.fixedView;
          if (!view || envelope.toolName === "prime_context") return [];
          const images = imageRefsForEnvelope(envelope);
          return [images.length === 0 ? view : { ...view, images }];
        });
      } catch (error) {
        this.broker.restorePersistentState(brokerStateBefore);
        for (const item of [...committed].reverse()) {
          if (item.existing?.envelope) {
            await this.writeEnvelope(item.entry.relativeFile, item.existing.envelope).catch(() => undefined);
          } else {
            await rm(join(this.sessionPath, item.entry.relativeFile), { force: true }).catch(() => undefined);
          }
        }
        await Promise.all([...createdChunks].map((relativeFile) =>
          rm(join(this.sessionPath, relativeFile), { force: true }).catch(() => undefined)
        ));
        throw error;
      }
    });
  }

  async updateExchangeRevisions(
    revisions: ReadonlyArray<{
      toolCallId: string;
      workspaceRevisionAtStart: number;
      workspaceRevisionAtResult: number;
    }>,
    signal?: AbortSignal,
  ): Promise<number> {
    if (revisions.length === 0) return 0;
    const byToolCall = new Map(revisions.map((revision) => [revision.toolCallId, revision]));
    return this.withIndexLock(async () => {
      const records = await this.readCatalog(signal);
      let updated = 0;
      let legacyUpdated = false;
      for (const record of records) {
        if (record.envelope) {
          const revision = byToolCall.get(record.envelope.toolCallId);
          if (!revision) continue;
          record.envelope.workspaceRevisionAtStart = revision.workspaceRevisionAtStart;
          record.envelope.workspaceRevisionAtResult = revision.workspaceRevisionAtResult;
          await this.writeEnvelope(record.relativeFile, record.envelope, signal);
          this.replaceCatalogRecord(this.envelopeRecord({
            schema: "prime-context.exchange/v2",
            id: record.id,
            relativeFile: record.relativeFile,
          }, record.envelope));
          updated += 1;
          continue;
        }
        const exchange = record.exchange;
        if (!exchange) continue;
        const revision = byToolCall.get(exchange.toolCallId);
        if (!revision) continue;
        exchange.workspaceRevisionAtStart = revision.workspaceRevisionAtStart;
        exchange.workspaceRevisionAtResult = revision.workspaceRevisionAtResult;
        updated += 1;
        legacyUpdated = true;
      }
      if (legacyUpdated) await this.writeIndex({
        schema: "prime-context.observation-index/v1",
        observations: records.filter((record) => !record.envelope),
      }, signal);
      return updated;
    });
  }

  async maxExchangeSequence(
    observationIds?: readonly string[],
    signal?: AbortSignal,
  ): Promise<number> {
    const requested = observationIds ? new Set(observationIds.map(normalizeObservationRef)) : undefined;
    const records = await this.readCatalog(signal);
    if (!requested && this.sessionMetadata) return Math.max(0, this.sessionMetadata.nextSequence - 1);
    let maximum = 0;
    for (const observation of records) {
      if (requested && !requested.has(observation.id)) continue;
      const exchangeId = observation.envelope?.id ?? observation.exchange?.exchangeId ?? "";
      const match = /^o(\d+)$/.exec(exchangeId);
      if (match) maximum = Math.max(maximum, Number(match[1]));
    }
    return maximum;
  }

  async list(limit = 20, signal?: AbortSignal): Promise<ObservationRecord[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("limit must be an integer from 1 to 100.");
    }
    const records = [...await this.readCatalog(signal)];
    const exchangeSequence = (record: ObservationRecord): number | undefined => {
      const id = record.envelope?.id ?? record.exchange?.exchangeId;
      const match = id ? /^o(\d+)$/.exec(id) : undefined;
      return match ? Number(match[1]) : undefined;
    };
    const orderedExchanges = records
      .filter((record) => exchangeSequence(record) !== undefined)
      .sort((left, right) => exchangeSequence(left)! - exchangeSequence(right)!);
    let exchangeIndex = 0;
    const ordered = records.map((record) =>
      exchangeSequence(record) === undefined ? record : orderedExchanges[exchangeIndex++]
    );
    return ordered.filter((observation) => this.isInActiveScope(observation)).slice(-limit).reverse();
  }

  async clear(signal?: AbortSignal): Promise<number> {
    return this.withIndexLock(async () => {
      const count = (await this.readCatalog(signal)).length;
      signal?.throwIfAborted();
      await rm(this.observationsPath, { recursive: true, force: true });
      await rm(this.indexPath, { force: true });
      await rm(this.sessionMetadataPath, { force: true });
      signal?.throwIfAborted();
      this.broker.reset();
      const metadata = this.metadataWithBrokerState({
        schema: "prime-context.archive-session/v1",
        nextSequence: 1,
        observationCount: 0,
      });
      await this.writeSessionMetadata(metadata, signal);
      this.catalog = [];
      this.catalogById.clear();
      this.catalogPromise = Promise.resolve(this.catalog);
      this.sessionMetadata = metadata;
      this.mediumResultCounts.clear();
      this.lastMediumResults.clear();
      this.recentLargeParts = [];
      return count;
    });
  }

  async count(signal?: AbortSignal): Promise<number> {
    return (await this.readCatalog(signal)).filter((record) => this.isInActiveScope(record)).length;
  }

  async checkIndex(signal?: AbortSignal): Promise<boolean> {
    try {
      await this.readCatalog(signal);
      return true;
    } catch {
      return false;
    }
  }

}
