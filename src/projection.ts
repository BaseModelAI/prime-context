import { escapeXml, truncateUtf8, utf8Bytes } from "./capsule.js";
import {
  mapStableControlMessages,
  type ContextMessageLike,
} from "./context.js";
import type { FoldState } from "./runtime.js";
import {
  PRIME_CONTEXT_ANCHOR_TYPE,
  PRIME_CONTEXT_FOLD_TYPE,
  PRIME_CONTEXT_STATE_TYPE,
} from "./state.js";

export const FIXED_EXCHANGE_VIEW_SCHEMA = "prime-context.fixed-exchange-view/v1" as const;
export const FIXED_EXCHANGE_VIEW_GENERATION = 0 as const;

export interface FixedExchangeLiteralResult {
  kind: "literal";
}

export interface FixedExchangeCapsuleResult {
  kind: "capsule";
  text: string;
}

export interface ProjectedImageRef {
  ref: string;
  mimeType: string;
  bytes: number;
  width?: number;
  height?: number;
}

export interface RecoveryProjectionLease {
  content: readonly Record<string, unknown>[];
  bytes?: number;
}

export interface FixedExchangeView {
  schema: typeof FIXED_EXCHANGE_VIEW_SCHEMA;
  generation: typeof FIXED_EXCHANGE_VIEW_GENERATION;
  exchangeId: string;
  toolCallId: string;
  callArguments?: Record<string, unknown>;
  result: FixedExchangeLiteralResult | FixedExchangeCapsuleResult;
  visibleBytes: number;
  images?: readonly ProjectedImageRef[];
  /** Provider/model identity that produced replay-protected call metadata. */
  replayOriginKey?: string;
}

export interface FixedViewContextUsage {
  tokens: number | null;
  contextWindow: number;
  percent?: number | null;
}

export function fixedExchangeBudgetBytes(usage?: FixedViewContextUsage): number {
  if (!usage || usage.tokens === null || usage.contextWindow <= 0) return 24 * 1024;
  const pressure = usage.tokens / usage.contextWindow;
  if (pressure >= 0.8) return 8 * 1024;
  if (pressure >= 0.6) return 16 * 1024;
  return 24 * 1024;
}

export interface ArchivedCallField {
  pointer: string;
  textBytes: number;
  lineCount: number;
  text?: string;
}

export interface ArchivedCallContext {
  intentKind: string;
  subjectKey: string;
  normalizedExecutable?: string;
  effectiveCwd?: string;
  resources?: readonly string[];
  suite?: { family: string; target: string; scope: string };
  diffRef?: string;
  identityMaxBytes?: number;
}

function decodePointer(pointer: string): string[] | undefined {
  if (pointer === "") return [];
  if (pointer[0] !== "/") return undefined;
  const tokens = pointer.slice(1).split("/");
  if (tokens.some((token) => /~(?![01])/u.test(token))) return undefined;
  return tokens.map((token) => token.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function sourceLines(text: string): string[] {
  return text.split("\n").filter((line) => line.trim().length > 0);
}

function boundedPreview(toolName: string, source: string | undefined): string {
  if (!source || !["edit", "ipython", "bash"].includes(toolName)) return "";
  const lines = sourceLines(source);
  if (lines.length === 0) return "";
  let selected: string[];
  if (toolName === "edit") {
    selected = lines.slice(0, 1);
  } else if (toolName === "ipython") {
    selected = lines.slice(0, 2);
    const last = lines.at(-1);
    if (last !== undefined && !selected.includes(last)) selected.push(last);
  } else {
    selected = lines.slice(0, 1);
    const last = lines.at(-1);
    if (last !== undefined && last !== selected[0]) selected.push(last);
  }
  const preview = selected.join("\n");
  return utf8Bytes(preview) <= 384 ? preview : `${truncateUtf8(preview, 381)}...`;
}

function boundedContext(context: ArchivedCallContext | undefined): string {
  if (!context) return "";
  const values = [
    `intent=${context.intentKind}`,
    `subject=${context.subjectKey}`,
    ...(context.normalizedExecutable ? [`executable=${context.normalizedExecutable}`] : []),
    ...(context.effectiveCwd ? [`cwd=${context.effectiveCwd}`] : []),
    ...(context.resources?.length ? [`resources=${context.resources.join(",")}`] : []),
    ...(context.suite
      ? [`suite=${context.suite.family}:${context.suite.target}:${context.suite.scope}`]
      : []),
  ];
  const summary = values.join("; ");
  const maxBytes = Math.max(512, Math.min(768, context.identityMaxBytes ?? 512));
  return utf8Bytes(summary) <= maxBytes ? summary : `${truncateUtf8(summary, maxBytes - 3)}...`;
}

export function archivedCallMarker(
  exchangeId: string,
  toolName: string,
  field: ArchivedCallField,
  context?: ArchivedCallContext,
): string {
  const ref = `${exchangeId}:call#${field.pointer}`;
  const summary = boundedContext(context);
  const attributes = [
    `ref="${escapeXml(ref)}"`,
    `bytes="${field.textBytes}"`,
    `lines="${field.lineCount}"`,
    ...(summary ? [`context="${escapeXml(summary)}"`] : []),
    ...(context?.diffRef ? [`diff-ref="${escapeXml(context.diffRef)}"`] : []),
  ].join(" ");
  const preview = boundedPreview(toolName, field.text);
  return preview
    ? `<archived-call ${attributes}>\n${escapeXml(preview)}\n</archived-call>`
    : `<archived-call ${attributes} />`;
}

function cloneArguments(value: Record<string, unknown>): Record<string, unknown> {
  try {
    return structuredClone(value);
  } catch {
    return { ...value };
  }
}

function valueAtPointer(root: Record<string, unknown>, tokens: readonly string[]): unknown {
  let value: unknown = root;
  for (const token of tokens) {
    if (!value || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[token];
  }
  return value;
}

function replaceAtPointer(root: Record<string, unknown>, tokens: readonly string[], replacement: string): boolean {
  if (tokens.length === 0) return false;
  let parent: unknown = root;
  for (const token of tokens.slice(0, -1)) {
    if (!parent || typeof parent !== "object") return false;
    parent = (parent as Record<string, unknown>)[token];
  }
  if (!parent || typeof parent !== "object") return false;
  const key = tokens.at(-1) as string;
  if (!Object.prototype.hasOwnProperty.call(parent, key)) return false;
  (parent as Record<string, unknown>)[key] = replacement;
  return true;
}

/**
 * Replace only call fields that Step C actually archived. A root pointer is
 * the bounded fallback for a generic object composed of many small fields.
 */
export function compactArchivedCallArguments(
  exchangeId: string,
  toolName: string,
  argumentsValue: Record<string, unknown>,
  fields: readonly ArchivedCallField[],
  context?: ArchivedCallContext,
): Record<string, unknown> | undefined {
  const usable = fields
    .map((field) => ({ field, tokens: decodePointer(field.pointer) }))
    .filter((entry): entry is { field: ArchivedCallField; tokens: string[] } =>
      entry.tokens !== undefined && entry.field.textBytes > 0
    );
  if (usable.length === 0) return undefined;
  const root = usable.find((entry) => entry.tokens.length === 0);
  if (root) {
    const archived = archivedCallMarker(exchangeId, toolName, root.field, context);
    const compact: Record<string, unknown> = { archived };
    for (const [key, value] of Object.entries(argumentsValue)) {
      const scalar = value === null || typeof value === "number" || typeof value === "boolean" ||
        (typeof value === "string" && utf8Bytes(value) <= 192);
      if (!scalar || key === "archived") continue;
      const candidate = { ...compact, [key]: value };
      if (jsonBytes(candidate) > 4096) break;
      compact[key] = value;
    }
    return compact;
  }

  const compact = cloneArguments(argumentsValue);
  let replacements = 0;
  for (const { field, tokens } of usable) {
    const sourceValue = valueAtPointer(argumentsValue, tokens);
    const source = field.text ?? (typeof sourceValue === "string" ? sourceValue : undefined);
    const marker = archivedCallMarker(exchangeId, toolName, { ...field, text: source }, context);
    if (replaceAtPointer(compact, tokens, marker)) replacements += 1;
  }
  return replacements > 0 ? compact : undefined;
}

export interface FixedViewCandidate {
  exchangeId: string;
  toolCallId: string;
  sourceOrder: number;
  toolName: string;
  renderedToolCall: Record<string, unknown>;
  compactCallArguments?: Record<string, unknown>;
  resultText: string;
  fixedCapsule?: string;
  requiresCapsule?: boolean;
  forceLiteral?: boolean;
  isError: boolean;
  hasUniqueDiagnostic?: boolean;
  changesWorkspace?: boolean;
  replayOriginKey?: string;
  capsule(maxBytes: number): string;
}

export interface FixedViewSelection {
  view: FixedExchangeView;
  foldedResult: boolean;
  capsule?: string;
}

function jsonBytes(value: Record<string, unknown>): number {
  try {
    return utf8Bytes(JSON.stringify(value));
  } catch {
    return utf8Bytes(String(value));
  }
}

function literalPriority(candidate: FixedViewCandidate, novel: boolean): number {
  if (candidate.isError || (candidate.hasUniqueDiagnostic && novel)) return 0;
  if (novel && utf8Bytes(candidate.resultText) < 8192) return 1;
  if (candidate.changesWorkspace) return 3;
  return 4;
}

/** Select one immutable generation-zero view for a completed source-ordered batch. */
export function selectFixedExchangeViews(
  input: readonly FixedViewCandidate[],
  budgetBytes: number,
  capsuleMaxBytes: number,
): FixedViewSelection[] {
  const candidates = input
    .map((candidate, inputOrder) => ({ candidate, inputOrder }))
    .sort((left, right) =>
      left.candidate.sourceOrder - right.candidate.sourceOrder || left.inputOrder - right.inputOrder
    )
    .map(({ candidate }) => candidate);
  const baselineCapsules = new Map<FixedViewCandidate, string>();
  for (const candidate of candidates) {
    if (candidate.forceLiteral) continue;
    if (candidate.fixedCapsule !== undefined) baselineCapsules.set(candidate, candidate.fixedCapsule);
    else if (candidate.requiresCapsule) baselineCapsules.set(candidate, candidate.capsule(capsuleMaxBytes));
  }
  const baselineTotal = candidates.reduce((total, candidate) =>
    total + jsonBytes(candidate.renderedToolCall) + utf8Bytes(
      candidate.forceLiteral
        ? candidate.resultText
        : baselineCapsules.get(candidate) ?? candidate.resultText,
    ), 0);
  const overBudget = baselineTotal > budgetBytes;

  const seenResults = new Set<string>();
  const novel = new Map<FixedViewCandidate, boolean>();
  for (const candidate of candidates) {
    const isNovel = !seenResults.has(candidate.resultText);
    novel.set(candidate, isNovel);
    seenResults.add(candidate.resultText);
  }

  const passThrough = candidates.filter((candidate) =>
    candidate.fixedCapsule === undefined && !candidate.requiresCapsule
  );
  const adjustable = candidates.filter((candidate) => !candidate.forceLiteral);
  const callAndForcedBytes = candidates.reduce((total, candidate) =>
    total + jsonBytes(candidate.renderedToolCall) +
      (candidate.forceLiteral ? utf8Bytes(candidate.resultText) : 0), 0);
  const share = adjustable.length === 0
    ? capsuleMaxBytes
    : Math.max(0, Math.floor(Math.max(0, budgetBytes - callAndForcedBytes) / adjustable.length));
  const capsules = new Map(baselineCapsules);
  if (overBudget) {
    for (const candidate of adjustable) {
      const maxBytes = candidate.isError ? capsuleMaxBytes : Math.min(capsuleMaxBytes, share);
      const admitted = baselineCapsules.get(candidate);
      capsules.set(
        candidate,
        admitted !== undefined && utf8Bytes(admitted) <= maxBytes ? admitted : candidate.capsule(maxBytes),
      );
    }
  }

  const literal = new Set<FixedViewCandidate>(
    candidates.filter((candidate) => candidate.forceLiteral),
  );
  if (!overBudget) {
    for (const candidate of passThrough) literal.add(candidate);
  } else {
    let selectedBytes = candidates.reduce((total, candidate) =>
      total + jsonBytes(candidate.renderedToolCall) + utf8Bytes(
        candidate.forceLiteral ? candidate.resultText : capsules.get(candidate) ?? "",
      ), 0);
    const optional = passThrough
      .filter((candidate) => !candidate.forceLiteral)
      .map((candidate, sourceOrder) => ({
        candidate,
        sourceOrder,
        priority: literalPriority(candidate, novel.get(candidate) ?? false),
      }))
      .sort((left, right) => left.priority - right.priority || left.sourceOrder - right.sourceOrder);
    for (const { candidate, priority } of optional) {
      const capsule = capsules.get(candidate) ?? "";
      const delta = utf8Bytes(candidate.resultText) - utf8Bytes(capsule);
      if (delta <= 0) {
        literal.add(candidate);
        selectedBytes += delta;
        continue;
      }
      const failureAllowance = priority === 0 && utf8Bytes(candidate.resultText) <= capsuleMaxBytes
        ? capsuleMaxBytes
        : 0;
      if (selectedBytes + delta <= budgetBytes + failureAllowance) {
        literal.add(candidate);
        selectedBytes += delta;
      }
    }
  }

  return candidates.map((candidate) => {
    const result = candidate.forceLiteral
      ? { kind: "literal" as const }
      : !overBudget && baselineCapsules.has(candidate)
      ? { kind: "capsule" as const, text: baselineCapsules.get(candidate) as string }
      : literal.has(candidate)
      ? { kind: "literal" as const }
      : { kind: "capsule" as const, text: capsules.get(candidate) as string };
    const selectedResultText = result.kind === "literal" ? candidate.resultText : result.text;
    return {
      view: {
        schema: FIXED_EXCHANGE_VIEW_SCHEMA,
        generation: FIXED_EXCHANGE_VIEW_GENERATION,
        exchangeId: candidate.exchangeId,
        toolCallId: candidate.toolCallId,
        ...(candidate.compactCallArguments === undefined
          ? {}
          : { callArguments: candidate.compactCallArguments }),
        result,
        visibleBytes: jsonBytes(candidate.renderedToolCall) + utf8Bytes(selectedResultText),
        ...(candidate.replayOriginKey === undefined ? {} : { replayOriginKey: candidate.replayOriginKey }),
      },
      foldedResult: candidate.fixedCapsule === undefined && result.kind === "capsule",
      ...(result.kind === "capsule" ? { capsule: result.text } : {}),
    };
  });
}

interface MessageLike {
  role?: unknown;
  content?: unknown;
  [key: string]: unknown;
}

function toolCall(block: unknown): block is Record<string, unknown> & {
  type: "toolCall";
  id: string;
  arguments: Record<string, unknown>;
} {
  if (!block || typeof block !== "object") return false;
  const value = block as Record<string, unknown>;
  return value.type === "toolCall" && typeof value.id === "string" &&
    Boolean(value.arguments) && typeof value.arguments === "object" && !Array.isArray(value.arguments);
}

export function hasOpaqueReplayMetadata(block: Record<string, unknown>): boolean {
  const carriesOpaqueField = (value: unknown, depth: number): boolean => {
    if (!value || typeof value !== "object" || depth > 3) return false;
    return Object.entries(value as Record<string, unknown>).some(([key, child]) =>
      (/(?:signature|signed|encrypted|opaque)/iu.test(key) && child !== undefined && child !== null) ||
      carriesOpaqueField(child, depth + 1)
    );
  };
  return Object.entries(block).some(([key, value]) =>
    !["type", "id", "name", "arguments"].includes(key) &&
    (/(?:signature|signed|encrypted|opaque)/iu.test(key) || carriesOpaqueField(value, 1)) &&
    value !== undefined && value !== null
  );
}

export function hasOpaqueResultContent(content: unknown): boolean {
  return Array.isArray(content) && content.some((block) => block && typeof block === "object" &&
    hasOpaqueReplayMetadata(block as Record<string, unknown>));
}

function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function projectResultContent(content: unknown, text: string): unknown {
  if (!Array.isArray(content)) return content;
  let wroteText = false;
  let changed = false;
  const projected: unknown[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object" || (block as Record<string, unknown>).type !== "text" ||
      hasOpaqueReplayMetadata(block as Record<string, unknown>)) {
      projected.push(block);
      continue;
    }
    if (wroteText) {
      changed = true;
      continue;
    }
    wroteText = true;
    const original = block as Record<string, unknown>;
    if (original.text === text) projected.push(block);
    else {
      changed = true;
      projected.push({ ...original, text });
    }
  }
  return wroteText && changed ? projected : content;
}

function viewMap(
  views: ReadonlyMap<string, FixedExchangeView> | readonly FixedExchangeView[],
): ReadonlyMap<string, FixedExchangeView> {
  return Array.isArray(views)
    ? new Map(views.map((view) => [view.toolCallId, view]))
    : views as ReadonlyMap<string, FixedExchangeView>;
}

/** Apply only cached fixed views, without changing persisted message objects. */
export function projectFixedExchangeViews<T extends MessageLike>(
  messages: readonly T[],
  viewsInput: ReadonlyMap<string, FixedExchangeView> | readonly FixedExchangeView[],
  activeModelKey?: string,
): readonly T[] {
  const views = viewMap(viewsInput);
  if (views.size === 0) return messages;
  const callIds = new Set<string>();
  const resultIds = new Set<string>();
  for (const message of messages) {
    if (message.role === "assistant" && Array.isArray(message.content)) {
      for (const block of message.content) if (toolCall(block)) callIds.add(block.id);
    }
    if (message.role === "toolResult" && typeof message.toolCallId === "string") {
      resultIds.add(message.toolCallId);
    }
  }
  const complete = new Set([...callIds].filter((id) => resultIds.has(id) && views.has(id)));
  if (complete.size === 0) return messages;

  let anyChanged = false;
  const projected = messages.map((message) => {
    if (message.role === "assistant" && Array.isArray(message.content)) {
      let contentChanged = false;
      const content = message.content.map((block) => {
        if (!toolCall(block) || !complete.has(block.id)) return block;
        const view = views.get(block.id) as FixedExchangeView;
        const sameReplayOrigin = view.replayOriginKey !== undefined &&
          (activeModelKey === undefined || activeModelKey === view.replayOriginKey);
        if (view.callArguments === undefined || sameReplayOrigin || hasOpaqueReplayMetadata(block) ||
          sameJson(block.arguments, view.callArguments)) return block;
        contentChanged = true;
        return { ...block, arguments: view.callArguments };
      });
      if (!contentChanged) return message;
      anyChanged = true;
      return { ...message, content } as T;
    }
    if (message.role === "toolResult" && typeof message.toolCallId === "string" &&
      complete.has(message.toolCallId)) {
      const view = views.get(message.toolCallId) as FixedExchangeView;
      if (view.result.kind === "literal") return message;
      const content = projectResultContent(message.content, view.result.text);
      if (content === message.content) return message;
      anyChanged = true;
      return { ...message, content } as T;
    }
    return message;
  });
  return anyChanged ? projected : messages;
}


export type ContextPurpose = "provider" | "compaction" | "branch-summary" | "refine";

export interface ContextEntryRef {
  messageIndex: number;
  entryId: string;
}

export interface SharedProjectionInput<T extends ContextMessageLike> {
  purpose: ContextPurpose;
  messages: readonly T[];
  entryRefs?: readonly ContextEntryRef[];
  fixedViews: ReadonlyMap<string, FixedExchangeView> | readonly FixedExchangeView[];
  fold?: FoldState;
  foldMessageEntryId?: string;
  foldPrefixEntryIds?: ReadonlySet<string>;
  /** Raw custom sources keyed by exact entry ID; model messages themselves stay provider-shaped. */
  sourceMessages?: ReadonlyMap<string, ContextMessageLike>;
  recoveryLeases?: ReadonlyMap<string, RecoveryProjectionLease>;
  pendingImages?: ReadonlyMap<string, readonly ProjectedImageRef[]>;
  consumedImageRefs?: ReadonlySet<string>;
  activeModelKey?: string;
}

export interface SharedProjectionResult<T extends ContextMessageLike> {
  messages: readonly T[];
  entryRefs?: ContextEntryRef[];
  shownRecoveryToolCallIds?: string[];
  shownImageRefs?: string[];
}

function foldProjection<T extends ContextMessageLike>(
  messages: readonly T[],
  entryRefs: readonly ContextEntryRef[] | undefined,
  fold: FoldState | undefined,
  foldMessageEntryId: string | undefined,
  foldPrefixEntryIds: ReadonlySet<string> | undefined,
): SharedProjectionResult<T> {
  if (!fold || !entryRefs || !foldMessageEntryId || !foldPrefixEntryIds ||
    !foldPrefixEntryIds.has(fold.throughEntryId) || foldPrefixEntryIds.has(foldMessageEntryId) ||
    new Set(fold.retainedEntryIds).size !== fold.retainedEntryIds.length ||
    fold.retainedEntryIds.some((id) => !foldPrefixEntryIds.has(id))) {
    return { messages, ...(entryRefs === undefined ? {} : { entryRefs: entryRefs.map((ref) => ({ ...ref })) }) };
  }
  const indices = new Set<number>();
  const ids = new Set<string>();
  for (const ref of entryRefs) {
    if (ref.messageIndex < 0 || ref.messageIndex >= messages.length ||
      indices.has(ref.messageIndex) || ids.has(ref.entryId)) {
      return { messages, entryRefs: entryRefs.map((item) => ({ ...item })) };
    }
    indices.add(ref.messageIndex);
    ids.add(ref.entryId);
  }
  const retained = new Set(fold.retainedEntryIds);
  const refByIndex = new Map(entryRefs.map((ref) => [ref.messageIndex, ref.entryId]));
  const keptIndices: number[] = [];
  for (let index = 0; index < messages.length; index += 1) {
    const id = refByIndex.get(index);
    if (id === undefined || !foldPrefixEntryIds.has(id) || retained.has(id)) keptIndices.push(index);
  }
  if (keptIndices.length === messages.length) return { messages, entryRefs: entryRefs.map((ref) => ({ ...ref })) };
  const rebased = new Map(keptIndices.map((source, target) => [source, target]));
  return {
    messages: keptIndices.map((index) => messages[index]),
    entryRefs: entryRefs.flatMap((ref) => {
      const messageIndex = rebased.get(ref.messageIndex);
      return messageIndex === undefined ? [] : [{ messageIndex, entryId: ref.entryId }];
    }),
  };
}

function stripModelDetails<T extends ContextMessageLike>(messages: readonly T[]): readonly T[] {
  let changed = false;
  const projected = messages.map((message) => {
    if (!("details" in message) || message.details === undefined) return message;
    changed = true;
    const { details: _details, ...visible } = message;
    return visible as T;
  });
  return changed ? projected : messages;
}

function stableModelControls<T extends ContextMessageLike>(
  messages: readonly T[],
  entryRefs: readonly ContextEntryRef[] | undefined,
  sources: ReadonlyMap<string, ContextMessageLike> | undefined,
): readonly T[] {
  if (!entryRefs || !sources || sources.size === 0) return messages;
  const sourceByIndex = new Map(entryRefs.flatMap((ref) => {
    const source = sources.get(ref.entryId);
    return source ? [[ref.messageIndex, source] as const] : [];
  }));
  if (sourceByIndex.size === 0) return messages;
  const controls = messages.map((message, index) => sourceByIndex.get(index) ?? message);
  const mapped = mapStableControlMessages(controls);
  let changed = false;
  const projected = messages.map((message, index) => {
    const source = sourceByIndex.get(index);
    if (!source || mapped[index] === source) return message;
    changed = true;
    return { ...message, content: mapped[index].content } as T;
  });
  return changed ? projected : messages;
}

/** Append one provider-valid text message without cloning or attaching raw custom details. */
export function appendProviderTextMessage<T extends ContextMessageLike>(
  messages: readonly T[],
  text: string,
): readonly T[] {
  return [...messages, {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: 0,
  } as T];
}

function imagePlaceholder(image: ProjectedImageRef): Record<string, unknown> {
  const dimensions = image.width && image.height ? `${image.width}x${image.height}` : "unknown";
  return {
    type: "text",
    text: `<prime_context_image ref="${escapeXml(image.ref)}" mime="${escapeXml(image.mimeType)}" bytes="${image.bytes}" dimensions="${dimensions}">
` +
      `Tool-generated image was shown once. Inspect this ref to view it again.
</prime_context_image>`,
  };
}

const PROVIDER_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const PROVIDER_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const PROVIDER_IMAGE_TOTAL_BYTES = 16 * 1024 * 1024;

function projectLeasedContent<T extends ContextMessageLike>(
  messages: readonly T[],
  input: SharedProjectionInput<T>,
): { messages: readonly T[]; shownRecoveryToolCallIds: string[]; shownImageRefs: string[] } {
  const shownRecoveryToolCallIds: string[] = [];
  const shownImageRefs: string[] = [];
  let projectedImageBytes = 0;
  const provider = input.purpose === "provider";
  const images = new Map<string, readonly ProjectedImageRef[]>();
  const freshImageRefs = new Set<string>();
  for (const [toolCallId, view] of viewMap(input.fixedViews)) {
    if (view.images?.length) images.set(toolCallId, view.images);
  }
  for (const [toolCallId, refs] of input.pendingImages ?? []) {
    // A bounded pending set marks only the fresh descriptors. Keep the fixed
    // view's complete descriptor list so capped images become placeholders
    // instead of passing through raw.
    if (!images.has(toolCallId)) images.set(toolCallId, refs);
    for (const image of refs) freshImageRefs.add(image.ref);
  }
  let changed = false;
  const projected = messages.map((message) => {
    if (message.role !== "toolResult" || typeof message.toolCallId !== "string" || !Array.isArray(message.content)) {
      return message;
    }
    const lease = provider ? input.recoveryLeases?.get(message.toolCallId) : undefined;
    if (lease) {
      shownRecoveryToolCallIds.push(message.toolCallId);
      changed = true;
      return { ...message, content: lease.content.map((block) => ({ ...block })) } as T;
    }
    const descriptors = images.get(message.toolCallId);
    if (descriptors === undefined) return message;
    let imageIndex = 0;
    let contentChanged = false;
    const content = message.content.map((block) => {
      if (!block || typeof block !== "object" || (block as Record<string, unknown>).type !== "image") return block;
      const descriptor = descriptors[imageIndex++];
      const opaque = hasOpaqueReplayMetadata(block as Record<string, unknown>);
      if (!descriptor) {
        if (opaque) return block;
        contentChanged = true;
        return {
          type: "text",
          text: `<prime_context_image tool_call="${escapeXml(String(message.toolCallId))}" index="${imageIndex}">\n` +
            "Image descriptor omitted by the bounded pending-media budget. Inspect the archived tool result to recover it.\n" +
            "</prime_context_image>",
        };
      }
      if (opaque) {
        if (provider && !input.consumedImageRefs?.has(descriptor.ref)) shownImageRefs.push(descriptor.ref);
        return block;
      }
      if (provider && PROVIDER_IMAGE_MIME_TYPES.has(descriptor.mimeType.toLowerCase()) &&
        descriptor.bytes <= PROVIDER_IMAGE_MAX_BYTES &&
        projectedImageBytes + descriptor.bytes <= PROVIDER_IMAGE_TOTAL_BYTES &&
        freshImageRefs.has(descriptor.ref) && !input.consumedImageRefs?.has(descriptor.ref)) {
        shownImageRefs.push(descriptor.ref);
        projectedImageBytes += descriptor.bytes;
        return block;
      }
      contentChanged = true;
      return imagePlaceholder(descriptor);
    });
    if (!contentChanged) return message;
    changed = true;
    return { ...message, content } as T;
  });
  return {
    messages: changed ? projected : messages,
    shownRecoveryToolCallIds,
    shownImageRefs,
  };
}

function projectBashExecutionViews<T extends ContextMessageLike>(
  messages: readonly T[],
  entryRefs: readonly ContextEntryRef[] | undefined,
  sourceMessages: ReadonlyMap<string, ContextMessageLike> | undefined,
  views: ReadonlyMap<string, FixedExchangeView> | readonly FixedExchangeView[],
): readonly T[] {
  if (!entryRefs || !sourceMessages) return messages;
  const byIndex = new Map(entryRefs.map((ref) => [ref.messageIndex, ref.entryId]));
  const fixed = viewMap(views);
  let changed = false;
  const projected = messages.map((message, messageIndex) => {
    const entryId = byIndex.get(messageIndex);
    const source = entryId ? sourceMessages.get(entryId) : undefined;
    const view = entryId ? fixed.get(entryId) : undefined;
    if (source?.role !== "bashExecution" || !view) return message;
    const compactCommand = typeof view.callArguments?.command === "string"
      ? view.callArguments.command
      : source.command;
    const compactOutput = view.result.kind === "capsule" ? view.result.text : source.output;
    if (compactCommand === source.command && compactOutput === source.output) return message;
    const { fullOutputPath: _fullOutputPath, ...rest } = source;
    changed = true;
    return providerMessageFromSource({
      ...rest,
      command: compactCommand,
      output: compactOutput,
      truncated: false,
    }) as T;
  });
  return changed ? projected : messages;
}

/** One copy-on-write projection shared by providers, compaction, branch summaries, and refinement. */
export function projectModelContext<T extends ContextMessageLike>(
  input: SharedProjectionInput<T>,
): SharedProjectionResult<T> {
  const stable = stableModelControls(input.messages, input.entryRefs, input.sourceMessages);
  const folded = foldProjection(
    stable,
    input.entryRefs,
    input.fold,
    input.foldMessageEntryId,
    input.foldPrefixEntryIds,
  );
  let messages = projectFixedExchangeViews(
    folded.messages,
    input.fixedViews,
    input.activeModelKey,
  ) as readonly T[];
  messages = projectBashExecutionViews(
    messages,
    folded.entryRefs,
    input.sourceMessages,
    input.fixedViews,
  );
  const leased = projectLeasedContent(messages, input);
  messages = stripModelDetails(leased.messages);
  return {
    messages,
    ...(folded.entryRefs === undefined ? {} : { entryRefs: folded.entryRefs }),
    ...(leased.shownRecoveryToolCallIds.length === 0 ? {} : {
      shownRecoveryToolCallIds: leased.shownRecoveryToolCallIds,
    }),
    ...(leased.shownImageRefs.length === 0 ? {} : { shownImageRefs: leased.shownImageRefs }),
  };
}

export interface FoldCandidateEntry<T extends ContextMessageLike = ContextMessageLike> {
  entryId: string;
  message: T;
}

export interface FoldPressure {
  tokens: number | null;
  contextWindow: number;
}

export interface ProjectedFoldCandidates {
  messages: readonly ContextMessageLike[];
  entryRefs: ContextEntryRef[];
  sourceMessages: ReadonlyMap<string, ContextMessageLike>;
  shownImageRefs?: string[];
}

function bashExecutionText(message: ContextMessageLike): string {
  const output = typeof message.output === "string" ? message.output : "";
  let rendered: string;
  if (output) {
    let longest = 0;
    for (const match of output.matchAll(/`+/g)) longest = Math.max(longest, match[0].length);
    const fence = "`".repeat(Math.max(3, longest + 1));
    rendered = `${fence}\n${output}\n${fence}`;
  } else rendered = "(no output)";
  if (message.cancelled === true) rendered += "\n\n(command cancelled)";
  else if (typeof message.exitCode === "number" && message.exitCode !== 0) {
    rendered += `\n\nCommand exited with code ${message.exitCode}`;
  }
  if (message.truncated === true) {
    rendered += typeof message.fullOutputPath === "string"
      ? `\n\n[Output truncated. Full output: ${message.fullOutputPath}]`
      : "\n\n[Output truncated.]";
  }
  return `Ran \`${typeof message.command === "string" ? message.command : ""}\`\n${rendered}`;
}

function providerMessageFromSource(message: ContextMessageLike): ContextMessageLike {
  if (message.role === "custom") {
    return {
      role: "user",
      content: typeof message.content === "string"
        ? [{ type: "text", text: message.content }]
        : message.content,
      timestamp: typeof message.timestamp === "number" ? message.timestamp : 0,
    };
  }
  if (message.role === "bashExecution") {
    return {
      role: "user",
      content: [{ type: "text", text: bashExecutionText(message) }],
      timestamp: typeof message.timestamp === "number" ? message.timestamp : 0,
    };
  }
  return message;
}

/** Build the same provider-shaped, details-stripped shared projection used for fold accounting. */
export function projectFoldCandidateMessages(
  entries: readonly FoldCandidateEntry[],
  views: ReadonlyMap<string, FixedExchangeView> | readonly FixedExchangeView[],
  purpose: ContextPurpose = "provider",
  fold?: FoldState,
  foldMessageEntryId?: string,
  foldPrefixEntryIds?: ReadonlySet<string>,
): ProjectedFoldCandidates {
  const sourceMessages = new Map(entries.map((entry) => [entry.entryId, entry.message]));
  const entryRefs = entries.map((entry, messageIndex) => ({ messageIndex, entryId: entry.entryId }));
  const messages = entries.map((entry) => providerMessageFromSource(entry.message));
  const projected = projectModelContext({
    purpose,
    messages,
    entryRefs,
    fixedViews: views,
    fold,
    foldMessageEntryId,
    foldPrefixEntryIds,
    sourceMessages,
  });
  return {
    messages: projected.messages,
    entryRefs: projected.entryRefs ?? entryRefs,
    sourceMessages,
    shownImageRefs: projected.shownImageRefs,
  };
}

function messageBlocks(message: ContextMessageLike): Record<string, unknown>[] {
  return Array.isArray(message.content)
    ? message.content.filter((part): part is Record<string, unknown> => Boolean(part) && typeof part === "object")
    : [];
}

function hasMedia(message: ContextMessageLike): boolean {
  return messageBlocks(message).some((part) => part.type === "image" || part.type === "audio" || part.type === "file");
}

function safeFoldIndices(
  entries: readonly FoldCandidateEntry[],
  eligibleEntryIds: ReadonlySet<string>,
  views: ReadonlyMap<string, FixedExchangeView>,
): Set<number> {
  const safe = new Set<number>();
  const resultIndex = new Map<string, number>();
  const duplicateResults = new Set<string>();
  const callCounts = new Map<string, number>();
  const allResultIds = new Set<string>();
  for (let index = 0; index < entries.length; index += 1) {
    const message = entries[index].message;
    if (message.role === "toolResult" && typeof message.toolCallId === "string") {
      if (allResultIds.has(message.toolCallId)) duplicateResults.add(message.toolCallId);
      allResultIds.add(message.toolCallId);
      if (eligibleEntryIds.has(entries[index].entryId)) resultIndex.set(message.toolCallId, index);
    }
    if (message.role === "assistant") {
      for (const call of messageBlocks(message).filter(toolCall)) {
        callCounts.set(call.id, (callCounts.get(call.id) ?? 0) + 1);
      }
    }
  }
  const latestControl = new Map<string, number>();
  for (let index = 0; index < entries.length; index += 1) {
    const type = entries[index].message.customType;
    if (type === PRIME_CONTEXT_ANCHOR_TYPE || type === PRIME_CONTEXT_STATE_TYPE || type === PRIME_CONTEXT_FOLD_TYPE) {
      latestControl.set(type, index);
    }
  }
  for (let index = 0; index < entries.length; index += 1) {
    if (!eligibleEntryIds.has(entries[index].entryId)) continue;
    const message = entries[index].message;
    if (message.role === "assistant") {
      const blocks = messageBlocks(message);
      const calls = blocks.filter(toolCall);
      if (calls.length === 0 || calls.length !== blocks.length || calls.some(hasOpaqueReplayMetadata) ||
        calls.some((call) => callCounts.get(call.id) !== 1 || duplicateResults.has(call.id))) continue;
      const results = calls.map((call) => resultIndex.get(call.id));
      if (results.some((result) => result === undefined) || calls.some((call) => !views.has(call.id))) continue;
      if (results.some((result) => hasOpaqueResultContent(entries[result!].message.content) || hasMedia(entries[result!].message))) continue;
      safe.add(index);
      for (const result of results) safe.add(result!);
      continue;
    }
    if (message.role === "custom") {
      if (hasMedia(message)) continue;
      const type = message.customType ?? "";
      const supersededControl = type === PRIME_CONTEXT_FOLD_TYPE ||
        ((type === PRIME_CONTEXT_ANCHOR_TYPE || type === PRIME_CONTEXT_STATE_TYPE) &&
          (latestControl.get(type) ?? index) > index);
      const fixedControl = /(?:capsule|delta|receipt|compact_tick|goal_tick|ipython_(?:state|state_restored))/i.test(type);
      if (supersededControl || fixedControl) safe.add(index);
    }
  }
  return safe;
}

function asViewMap(views: ReadonlyMap<string, FixedExchangeView> | readonly FixedExchangeView[]): ReadonlyMap<string, FixedExchangeView> {
  return Array.isArray(views)
    ? new Map(views.map((view) => [view.toolCallId, view]))
    : views as ReadonlyMap<string, FixedExchangeView>;
}

export interface FoldRawEntryOrder {
  /** Every selected-branch entry ID in raw chronological order. */
  entryIds: readonly string[];
  /** Exact persisted message that activates `current`, validated by the caller. */
  currentFoldMessageEntryId?: string;
}

/** Select one immutable raw chronological prefix fold. Unsafe model entries remain exact exceptions. */
export function selectFoldGeneration(
  entries: readonly FoldCandidateEntry[],
  viewsInput: ReadonlyMap<string, FixedExchangeView> | readonly FixedExchangeView[],
  pressure: FoldPressure | undefined,
  current: FoldState | undefined,
  render: (generation: number, throughEntryId: string) => string,
  rawOrder?: FoldRawEntryOrder,
): FoldState | undefined {
  if (!pressure || pressure.tokens === null || pressure.contextWindow <= 0 ||
    pressure.tokens / pressure.contextWindow <= 0.65) return undefined;
  const turnStarts = entries.flatMap((entry, index) =>
    entry.message.role === "user" || entry.message.role === "assistant" ||
      entry.message.role === "bashExecution" ? [index] : []);
  if (turnStarts.length <= 4) return undefined;
  const cutoffExclusive = turnStarts[turnStarts.length - 4];
  if (cutoffExclusive <= 0) return undefined;
  const throughEntryId = entries[cutoffExclusive - 1]?.entryId;
  if (!throughEntryId) return undefined;

  const rawEntryIds = rawOrder?.entryIds ?? entries.map((entry) => entry.entryId);
  const rawIndex = new Map(rawEntryIds.map((id, index) => [id, index]));
  const entryIndex = new Map(entries.map((entry, index) => [entry.entryId, index]));
  if (rawEntryIds.some((id) => !id) || rawIndex.size !== rawEntryIds.length ||
    entries.some((entry) => !rawIndex.has(entry.entryId)) || entryIndex.size !== entries.length) {
    return undefined;
  }
  const candidateRawCutoff = rawIndex.get(throughEntryId);
  if (candidateRawCutoff === undefined) return undefined;
  const candidateRawIds = rawEntryIds.slice(0, candidateRawCutoff + 1);
  const candidatePrefix = new Set(candidateRawIds);

  const previousRetained = new Set(current?.retainedEntryIds ?? []);
  if (current && (previousRetained.size !== current.retainedEntryIds.length || previousRetained.size > 256)) {
    return undefined;
  }
  const currentPrefix = new Set<string>();
  let currentRawCutoff = -1;
  if (current) {
    currentRawCutoff = rawIndex.get(current.throughEntryId) ?? -1;
    const foldMessageIndex = rawOrder?.currentFoldMessageEntryId
      ? rawIndex.get(rawOrder.currentFoldMessageEntryId) ?? -1
      : -1;
    if (currentRawCutoff < 0 || candidateRawCutoff <= currentRawCutoff ||
      foldMessageIndex <= currentRawCutoff || candidateRawCutoff <= foldMessageIndex) {
      return undefined;
    }
    for (let index = 0; index <= currentRawCutoff; index += 1) currentPrefix.add(rawEntryIds[index]);
    if ([...previousRetained].some((id) => !currentPrefix.has(id))) return undefined;
  }

  const oldHidden = new Set<string>();
  for (const id of currentPrefix) {
    if (!previousRetained.has(id)) oldHidden.add(id);
  }
  const views = asViewMap(viewsInput);
  const safe = safeFoldIndices(entries, candidatePrefix, views);
  const unsafeVisible = new Set(entries.flatMap((entry, index) =>
    candidatePrefix.has(entry.entryId) && !oldHidden.has(entry.entryId) && !safe.has(index)
      ? [entry.entryId]
      : []));
  const retainedEntryIds = candidateRawIds.filter((id) => unsafeVisible.has(id));
  if (retainedEntryIds.length > 256) return undefined;

  const retained = new Set(retainedEntryIds);
  const projected = projectFoldCandidateMessages(entries, views).messages;
  let incrementalBytes = 0;
  let hiddenCount = 0;
  for (let raw = currentRawCutoff + 1; raw <= candidateRawCutoff; raw += 1) {
    const id = rawEntryIds[raw];
    const modelIndex = entryIndex.get(id);
    if (modelIndex === undefined || retained.has(id)) continue;
    incrementalBytes += utf8Bytes(JSON.stringify(projected[modelIndex]));
    hiddenCount += 1;
  }
  const savedTokens = Math.floor(incrementalBytes / 4);
  if (hiddenCount === 0 || savedTokens < 8000 && savedTokens < pressure.tokens * 0.15) return undefined;
  const generation = (current?.generation ?? 0) + 1;
  const renderedMessage = render(generation, throughEntryId);
  if (utf8Bytes(renderedMessage) > 4096) return undefined;
  return { generation, throughEntryId, retainedEntryIds, renderedMessage };
}

export interface FastPathFileOperations {
  read?: readonly string[];
  modified?: readonly string[];
  readFiles?: readonly string[];
  modifiedFiles?: readonly string[];
}

export interface DeterministicSummaryInput {
  messages: readonly ContextMessageLike[];
  entryRefs: readonly ContextEntryRef[];
  fixedViews: ReadonlyMap<string, FixedExchangeView> | readonly FixedExchangeView[];
  previousSummary?: string;
  anchor?: string;
  state?: string;
  hiddenSteering?: readonly string[];
  fileOps?: FastPathFileOperations;
  sourceMessages?: ReadonlyMap<string, ContextMessageLike>;
}

function smallVisibleText(message: ContextMessageLike, maxBytes = 2048): string | undefined {
  if (hasMedia(message)) return undefined;
  if (typeof message.content === "string") return utf8Bytes(message.content) <= maxBytes ? message.content : undefined;
  if (!Array.isArray(message.content)) return "";
  const blocks = messageBlocks(message);
  if (blocks.some((part) => part.type === "thinking" || part.type === "toolCall")) return undefined;
  if (blocks.some((part) => part.type !== "text")) return undefined;
  const text = blocks.map((part) => typeof part.text === "string" ? part.text : "").join("\n");
  return utf8Bytes(text) <= maxBytes ? text : undefined;
}

/** Return a deterministic summary only when every discarded message is exactly representable. */
export function deterministicFastSummary(input: DeterministicSummaryInput): string | undefined {
  const refs = new Map(input.entryRefs.map((ref) => [ref.messageIndex, ref.entryId]));
  if (input.messages.some((_message, index) => !refs.has(index))) return undefined;
  const views = asViewMap(input.fixedViews);
  const resultIndex = new Map<string, number>();
  const duplicateResults = new Set<string>();
  for (let index = 0; index < input.messages.length; index += 1) {
    const message = input.messages[index];
    if (message.role !== "toolResult" || typeof message.toolCallId !== "string") continue;
    if (resultIndex.has(message.toolCallId)) duplicateResults.add(message.toolCallId);
    resultIndex.set(message.toolCallId, index);
  }
  if (duplicateResults.size > 0) return undefined;
  const consumed = new Set<number>();
  const tape: string[] = [];
  for (let index = 0; index < input.messages.length; index += 1) {
    if (consumed.has(index)) continue;
    const message = input.messages[index];
    const ref = refs.get(index)!;
    const source = input.sourceMessages?.get(ref);
    if (source?.role === "custom") {
      if (hasMedia(source) || !/(?:capsule|delta|fold|receipt|compact_tick|goal_(?:context|tick)|ipython_(?:state|state_restored)|prime_context_(?:anchor|state))/i.test(source.customType ?? "")) {
        return undefined;
      }
      const text = smallVisibleText(message, 8192);
      if (text === undefined) return undefined;
      tape.push(`- ref=${escapeXml(ref)} control=${escapeXml(source.customType ?? "custom")} content=${escapeXml(JSON.stringify(text))}`);
      continue;
    }
    if (message.role === "assistant") {
      const blocks = messageBlocks(message);
      const calls = blocks.filter(toolCall);
      if (calls.length > 0) {
        if (calls.length !== blocks.length || calls.some(hasOpaqueReplayMetadata) ||
          new Set(calls.map((call) => call.id)).size !== calls.length) return undefined;
        const results = calls.map((call) => resultIndex.get(call.id));
        if (results.some((result) => result === undefined) || calls.some((call) => !views.has(call.id))) return undefined;
        for (let offset = 0; offset < calls.length; offset += 1) {
          const result = results[offset]!;
          if (result < index || consumed.has(result) || hasMedia(input.messages[result]) ||
            hasOpaqueResultContent(input.messages[result].content)) return undefined;
          const view = views.get(calls[offset].id)!;
          tape.push(`- ref=${escapeXml(ref)} exchange=${escapeXml(view.exchangeId)} tool=${escapeXml(String(calls[offset].name ?? "tool"))}`);
          consumed.add(result);
        }
        consumed.add(index);
        continue;
      }
      const text = smallVisibleText(message);
      if (text === undefined) return undefined;
      tape.push(`- ref=${escapeXml(ref)} assistant=${escapeXml(JSON.stringify(text))}`);
      continue;
    }
    if (message.role === "toolResult") return undefined;
    if (message.role === "user" || message.role === "bashExecution") {
      const text = smallVisibleText(message);
      if (text === undefined) return undefined;
      tape.push(`- ref=${escapeXml(ref)} user=${escapeXml(JSON.stringify(text))}`);
      continue;
    }
    if (message.role === "custom") {
      if (hasMedia(message)) return undefined;
      const type = message.customType ?? "";
      if (!/(?:capsule|delta|fold|receipt|compact_tick|goal_(?:context|tick)|ipython_(?:state|state_restored)|prime_context_(?:anchor|state))/i.test(type)) return undefined;
      const text = smallVisibleText(message, 8192);
      if (text === undefined) return undefined;
      tape.push(`- ref=${escapeXml(ref)} control=${escapeXml(type)} content=${escapeXml(JSON.stringify(text))}`);
      continue;
    }
    return undefined;
  }
  const read = input.fileOps?.readFiles ?? input.fileOps?.read ?? [];
  const modified = input.fileOps?.modifiedFiles ?? input.fileOps?.modified ?? [];
  const lines = ["<prime_context_compaction>"];
  if (input.previousSummary !== undefined) lines.push("previous_summary:", input.previousSummary);
  if (input.anchor) lines.push("current_anchor:", input.anchor);
  if (input.state) lines.push("current_state:", input.state);
  if (input.hiddenSteering?.length) {
    lines.push("hidden_steering:", ...input.hiddenSteering.map((text) => `- ${escapeXml(JSON.stringify(text))}`));
  }
  lines.push("file_operations:", `- read: ${escapeXml(read.join(", ") || "none")}`, `- modified: ${escapeXml(modified.join(", ") || "none")}`);
  if (tape.length) lines.push("chronological:", ...tape);
  lines.push("</prime_context_compaction>");
  return lines.join("\n");
}
