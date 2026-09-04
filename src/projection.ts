import { escapeXml, truncateUtf8, utf8Bytes } from "./capsule.js";
import {
  goalControlState,
  projectStableControlMessages,
  renderGoalControlState,
  type ContextMessageLike,
} from "./context.js";
import { PRIME_CONTEXT_ANCHOR_TYPE } from "./state.js";

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

export interface DeltaDependency {
  baselineToolCallId: string;
  baselineEntryId?: string;
  contextEpoch: number;
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
  /** A repeat/delta is valid only while this exact baseline remains visible. */
  deltaDependency?: DeltaDependency;
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
  contextEpoch?: number,
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
  const complete = new Set([...callIds].filter((id) => {
    if (!resultIds.has(id)) return false;
    const view = views.get(id);
    if (!view) return false;
    const dependency = view.deltaDependency;
    return dependency === undefined || (
      contextEpoch !== undefined && dependency.contextEpoch === contextEpoch &&
      resultIds.has(dependency.baselineToolCallId)
    );
  }));
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


export type ContextPurpose = "provider" | "budget" | "compaction" | "branch-summary" | "refine";

export interface ContextEntryRef {
  messageIndex: number;
  entryId: string;
}

export interface SharedProjectionInput<T extends ContextMessageLike> {
  purpose: ContextPurpose;
  messages: readonly T[];
  entryRefs?: readonly ContextEntryRef[];
  fixedViews: ReadonlyMap<string, FixedExchangeView> | readonly FixedExchangeView[];
  /** Raw custom sources keyed by exact entry ID; model messages themselves stay provider-shaped. */
  sourceMessages?: ReadonlyMap<string, ContextMessageLike>;
  pendingImages?: ReadonlyMap<string, readonly ProjectedImageRef[]>;
  activeModelKey?: string;
  contextEpoch?: number;
  /** Internal prefix state used only by incremental provider/budget projection. */
  initialShownImageRefs?: readonly string[];
  initialProjectedImageBytes?: number;
}

export interface SharedProjectionResult<T extends ContextMessageLike> {
  messages: readonly T[];
  entryRefs?: readonly ContextEntryRef[];
  /** Stable identity for provider usage-anchor compatibility. */
  projectionIdentity?: string;
  shownRecoveryToolCallIds?: readonly string[];
  shownImageRefs?: readonly string[];
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

interface IndexedProjection<T extends ContextMessageLike> {
  messages: readonly T[];
  entryRefs?: readonly ContextEntryRef[];
  handledGoalEntryIds?: ReadonlySet<string>;
}

const WATCH_TURNS_TO_KEEP = 2;
const WATCH_SUMMARY_MAX_BYTES = 768;

function projectedText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.flatMap((block) => {
    if (!block || typeof block !== "object") return [];
    const value = block as Record<string, unknown>;
    return value.type === "text" && typeof value.text === "string" ? [value.text] : [];
  }).join("\n");
}

function replaceProjectedText(content: unknown, text: string): unknown {
  if (!Array.isArray(content)) return text;
  let replaced = false;
  const blocks = content.flatMap((block) => {
    if (!block || typeof block !== "object" || (block as Record<string, unknown>).type !== "text") return [block];
    if (replaced) return [];
    replaced = true;
    return [{ ...(block as Record<string, unknown>), text }];
  });
  return replaced ? blocks : [{ type: "text", text }, ...blocks];
}

function orderedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(orderedValue);
  if (!value || typeof value !== "object") return typeof value === "string" ? value.trim() : value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, orderedValue(child)]));
}

function watcherCallSignature(block: Record<string, unknown>): string | undefined {
  const name = typeof block.name === "string" ? block.name : "";
  const args = block.arguments;
  if (!args || typeof args !== "object" || Array.isArray(args)) return undefined;
  if (name === "ipython") {
    const code = (args as Record<string, unknown>).code;
    if (typeof code !== "string" ||
      !/(?:\.running\b|\.poll\s*\(|\.tail\s*\(|st_mtime|rpc-events\.jsonl)/iu.test(code) ||
      /(?:write_text|write_bytes|await\s+edit|\.kill\s*\(|\.terminate\s*\(|\.unlink\s*\(|\.rename\s*\(|\.mkdir\s*\(|\.rmdir\s*\(|\bbash\s*\()/iu.test(code)) {
      return undefined;
    }
  } else if (name === "bash") {
    const command = (args as Record<string, unknown>).command;
    if (typeof command !== "string" ||
      !/(?:\bps\b|\bpgrep\b|\bjobs\b|\btail\b|\bstat\b|\btest\s+-[efd]\b)/iu.test(command) ||
      /(?:^|[;&|]\s*)(?:rm|mv|cp|kill|pkill|touch|mkdir|rmdir|npm|pnpm|yarn|git)\b|(?:^|[^>])>(?!>)/iu.test(command)) {
      return undefined;
    }
  } else if (!/(?:poll|watch|status|heartbeat|wait)/iu.test(name)) {
    return undefined;
  }
  try {
    return JSON.stringify({ name, arguments: orderedValue(args) });
  } catch {
    return undefined;
  }
}

function watcherTerminalText(text: string): boolean {
  return /\brunning\s*[:=]?\s*(?:false|no)\b|\bstatus\s*[:=]\s*(?:complete|completed|failed|error|exited|terminated)\b|\b(?:process|job|run)\s+(?:completed|finished|failed|exited|terminated)\b|\bexit[_ ]code\s*[:=]\s*[1-9]\d*/iu.test(text);
}

function hasMediaContent(message: ContextMessageLike): boolean {
  return Array.isArray(message.content) && message.content.some((block) =>
    block && typeof block === "object" && (block as Record<string, unknown>).type === "image");
}

interface GoalWatchTurn {
  start: number;
  end: number;
  goalId: string;
  objective: string;
  status?: string;
  signature: string;
  latestObservation: string;
}

function completedGoalWatchTurn(
  messages: readonly ContextMessageLike[],
  start: number,
  end: number,
  sourceByIndex: ReadonlyMap<number, ContextMessageLike>,
): GoalWatchTurn | undefined {
  const goal = goalControlState(sourceByIndex.get(start) ?? messages[start]);
  if (!goal?.goalId) return undefined;
  const callIds = new Set<string>();
  const resultIds = new Set<string>();
  let signature: string | undefined;
  let latestResult = "";
  let finalAssistant = "";
  let lastRole = "";
  let finalAssistantHasCall = false;
  for (let index = start + 1; index < end; index += 1) {
    const message = sourceByIndex.get(index) ?? messages[index];
    if (hasMediaContent(message)) return undefined;
    lastRole = message.role;
    if (message.role === "assistant") {
      let hasCall = false;
      if (Array.isArray(message.content)) {
        for (const block of message.content) {
          if (!toolCall(block)) continue;
          const current = watcherCallSignature(block);
          if (!current || signature && current !== signature) return undefined;
          signature = current;
          callIds.add(block.id);
          hasCall = true;
        }
      }
      finalAssistant = projectedText(message.content).trim();
      finalAssistantHasCall = hasCall;
    } else if (message.role === "toolResult") {
      if (message.isError === true || typeof message.toolCallId !== "string") return undefined;
      const resultText = projectedText(message.content).trim();
      if (watcherTerminalText(resultText)) return undefined;
      resultIds.add(message.toolCallId);
      latestResult = resultText;
    } else {
      return undefined;
    }
  }
  if (!signature || callIds.size === 0 || lastRole !== "assistant" || finalAssistantHasCall ||
    [...callIds].some((id) => !resultIds.has(id)) || [...resultIds].some((id) => !callIds.has(id))) {
    return undefined;
  }
  const latestObservation = [latestResult, finalAssistant].filter(Boolean).join(" | ");
  return {
    start,
    end,
    goalId: goal.goalId,
    objective: goal.objective,
    ...(goal.status === undefined ? {} : { status: goal.status }),
    signature,
    latestObservation,
  };
}

function renderWatchSummary(turns: readonly GoalWatchTurn[]): string {
  const latest = turns.at(-1) as GoalWatchTurn;
  const observation = truncateUtf8(latest.latestObservation.replace(/\s+/g, " "), WATCH_SUMMARY_MAX_BYTES);
  return [
    `<goal_watch id="${escapeXml(latest.goalId)}" collapsed_polls="${turns.length}">`,
    ...(observation ? [`latest_collapsed_observation: ${escapeXml(observation)}`] : []),
    "Older identical read-only polling turns were folded into this current state.",
    "</goal_watch>",
  ].join("\n");
}

/** Bound consecutive, completed read-only watcher turns while keeping complete recent tool exchanges. */
function projectGoalWatcherTurns<T extends ContextMessageLike>(
  messages: readonly T[],
  entryRefs: readonly ContextEntryRef[] | undefined,
  sources: ReadonlyMap<string, ContextMessageLike> | undefined,
): IndexedProjection<T> {
  if (!entryRefs || !sources || sources.size === 0) return { messages, entryRefs };
  const refByIndex = new Map(entryRefs.map((ref) => [ref.messageIndex, ref]));
  const sourceByIndex = new Map(entryRefs.flatMap((ref) => {
    const source = sources.get(ref.entryId);
    return source ? [[ref.messageIndex, source] as const] : [];
  }));
  const goalStarts = messages.flatMap((_message, index) => {
    const source = sourceByIndex.get(index);
    return source && goalControlState(source)?.goalId ? [index] : [];
  });
  if (goalStarts.length === 0) return { messages, entryRefs };
  const turns = goalStarts.flatMap((start, turnIndex) => {
    const end = goalStarts[turnIndex + 1] ?? messages.length;
    const turn = completedGoalWatchTurn(messages, start, end, sourceByIndex);
    return turn ? [turn] : [];
  });
  if (turns.length === 0) return { messages, entryRefs };

  const dropped = new Set<number>();
  const replacements = new Map<number, T>();
  const handledGoalEntryIds = new Set<string>();
  for (let index = 0; index < turns.length;) {
    let end = index + 1;
    while (end < turns.length && turns[end].start === turns[end - 1].end &&
      turns[end].goalId === turns[index].goalId &&
      turns[end].objective === turns[index].objective &&
      turns[end].status === turns[index].status &&
      turns[end].signature === turns[index].signature) {
      end += 1;
    }
    const run = turns.slice(index, end);
    const collapsed = run.slice(0, Math.max(0, run.length - WATCH_TURNS_TO_KEEP));
    if (collapsed.length > 0) {
      for (const turn of collapsed) {
        for (let messageIndex = turn.start; messageIndex < turn.end; messageIndex += 1) dropped.add(messageIndex);
      }
      const summaryIndex = collapsed.at(-1)?.start as number;
      dropped.delete(summaryIndex);
      replacements.set(summaryIndex, {
        ...messages[summaryIndex],
        content: replaceProjectedText(messages[summaryIndex].content, renderWatchSummary(collapsed)),
      } as T);
      const summaryRef = refByIndex.get(summaryIndex);
      if (summaryRef) handledGoalEntryIds.add(summaryRef.entryId);
    }
    for (const turn of run.slice(-WATCH_TURNS_TO_KEEP)) {
      const source = sourceByIndex.get(turn.start);
      const state = source && goalControlState(source);
      if (state) {
        replacements.set(turn.start, {
          ...messages[turn.start],
          content: replaceProjectedText(messages[turn.start].content, renderGoalControlState(state)),
        } as T);
        const ref = refByIndex.get(turn.start);
        if (ref) handledGoalEntryIds.add(ref.entryId);
      }
    }
    index = end;
  }

  const projected: T[] = [];
  const projectedRefs: ContextEntryRef[] = [];
  for (let inputIndex = 0; inputIndex < messages.length; inputIndex += 1) {
    if (dropped.has(inputIndex)) continue;
    const outputIndex = projected.length;
    projected.push(replacements.get(inputIndex) ?? messages[inputIndex]);
    const ref = refByIndex.get(inputIndex);
    if (ref) projectedRefs.push({ ...ref, messageIndex: outputIndex });
  }
  return { messages: projected, entryRefs: projectedRefs, handledGoalEntryIds };
}

function stableModelControls<T extends ContextMessageLike>(
  messages: readonly T[],
  entryRefs: readonly ContextEntryRef[] | undefined,
  sources: ReadonlyMap<string, ContextMessageLike> | undefined,
  handledGoalEntryIds: ReadonlySet<string> = new Set(),
): IndexedProjection<T> {
  if (!entryRefs || !sources || sources.size === 0) return { messages, entryRefs };
  const refByIndex = new Map(entryRefs.map((ref) => [ref.messageIndex, ref]));
  const sourceByIndex = new Map(entryRefs.flatMap((ref) => {
    const source = handledGoalEntryIds.has(ref.entryId) ? undefined : sources.get(ref.entryId);
    return source ? [[ref.messageIndex, source] as const] : [];
  }));
  if (sourceByIndex.size === 0) return { messages, entryRefs };
  const controls = messages.map((message, index) => sourceByIndex.get(index) ?? message);
  const projectedControls = projectStableControlMessages(controls);
  const controlsChanged = projectedControls.retainedIndexes.length !== messages.length ||
    projectedControls.retainedIndexes.some((inputIndex, outputIndex) =>
      inputIndex !== outputIndex || projectedControls.messages[outputIndex] !== controls[inputIndex]);
  if (!controlsChanged) return { messages, entryRefs };
  const projected: T[] = [];
  const projectedRefs: ContextEntryRef[] = [];
  for (let outputIndex = 0; outputIndex < projectedControls.retainedIndexes.length; outputIndex += 1) {
    const inputIndex = projectedControls.retainedIndexes[outputIndex];
    const message = messages[inputIndex];
    const source = sourceByIndex.get(inputIndex);
    const mapped = projectedControls.messages[outputIndex];
    projected.push(source && mapped !== source
      ? { ...message, content: mapped.content } as T
      : message);
    const ref = refByIndex.get(inputIndex);
    if (ref) projectedRefs.push({ ...ref, messageIndex: outputIndex });
  }
  return {
    messages: projected,
    entryRefs: projectedRefs,
  };
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
  const shownImageRefs: string[] = [...(input.initialShownImageRefs ?? [])];
  let projectedImageBytes = input.initialProjectedImageBytes ?? 0;
  const provider = input.purpose === "provider" || input.purpose === "budget";
  const images = new Map<string, readonly ProjectedImageRef[]>();
  for (const [toolCallId, view] of viewMap(input.fixedViews)) {
    if (view.images?.length) images.set(toolCallId, view.images);
  }
  for (const [toolCallId, refs] of input.pendingImages ?? []) {
    if (!images.has(toolCallId)) images.set(toolCallId, refs);
  }
  let changed = false;
  const projected = messages.map((message) => {
    if (message.role !== "toolResult" || typeof message.toolCallId !== "string" || !Array.isArray(message.content)) {
      return message;
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
        if (provider) shownImageRefs.push(descriptor.ref);
        return block;
      }
      if (provider && PROVIDER_IMAGE_MIME_TYPES.has(descriptor.mimeType.toLowerCase()) &&
        descriptor.bytes <= PROVIDER_IMAGE_MAX_BYTES &&
        projectedImageBytes + descriptor.bytes <= PROVIDER_IMAGE_TOTAL_BYTES) {
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
    if (source?.role !== "bashExecution" || !view || view.deltaDependency !== undefined) return message;
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
  const watched = projectGoalWatcherTurns(input.messages, input.entryRefs, input.sourceMessages);
  const stable = stableModelControls(
    watched.messages,
    watched.entryRefs,
    input.sourceMessages,
    watched.handledGoalEntryIds,
  );
  let messages = projectFixedExchangeViews(
    stable.messages,
    input.fixedViews,
    input.activeModelKey,
    input.contextEpoch,
  ) as readonly T[];
  messages = projectBashExecutionViews(
    messages,
    stable.entryRefs,
    input.sourceMessages,
    input.fixedViews,
  );
  const leased = projectLeasedContent(messages, { ...input, entryRefs: stable.entryRefs });
  messages = stripModelDetails(leased.messages);
  return {
    messages,
    ...(stable.entryRefs === undefined ? {} : { entryRefs: stable.entryRefs }),
    ...(leased.shownRecoveryToolCallIds.length === 0 ? {} : {
      shownRecoveryToolCallIds: leased.shownRecoveryToolCallIds,
    }),
    ...(leased.shownImageRefs.length === 0 ? {} : { shownImageRefs: leased.shownImageRefs }),
  };
}

export interface ProjectionSourceSpan {
  entryId: string;
  outputStart: number;
  outputEnd: number;
  estimatedBytes: number;
}

export interface ProjectionEpoch<T extends ContextMessageLike = ContextMessageLike> {
  id: number;
  modelKey: string;
  toolSetRevision: string | number;
  inputEntryIds: string[];
  outputMessages: readonly T[];
  outputRefs: readonly ContextEntryRef[];
  sourceSpans: ProjectionSourceSpan[];
  shownRecoveryToolCallIds: readonly string[];
  shownImageRefs: readonly string[];
}

export interface ProviderProjectionCache<T extends ContextMessageLike = ContextMessageLike> {
  epoch?: ProjectionEpoch<T>;
}

export interface ProviderRepresentationInput<T extends ContextMessageLike> extends SharedProjectionInput<T> {
  purpose: "provider" | "budget";
  epochId: number;
  modelKey: string;
  toolSetRevision: string | number;
  cache: ProviderProjectionCache<T>;
}

function completeOrderedEntryIds<T extends ContextMessageLike>(
  messages: readonly T[],
  refs: readonly ContextEntryRef[] | undefined,
): string[] | undefined {
  if (!refs || refs.length !== messages.length || refs.some((ref, index) => ref.messageIndex !== index)) {
    return undefined;
  }
  return refs.map((ref) => ref.entryId);
}

function estimatedMessageBytes(message: ContextMessageLike): number {
  try {
    return utf8Bytes(JSON.stringify(message));
  } catch {
    return 0;
  }
}

function projectionSpans<T extends ContextMessageLike>(
  inputEntryIds: readonly string[],
  outputMessages: readonly T[],
  outputRefs: readonly ContextEntryRef[],
  initialCursor = 0,
  initialRefIndex = 0,
): ProjectionSourceSpan[] {
  const outputs = new Map<string, number[]>();
  for (let refIndex = initialRefIndex; refIndex < outputRefs.length; refIndex += 1) {
    const ref = outputRefs[refIndex];
    const indices = outputs.get(ref.entryId) ?? [];
    indices.push(ref.messageIndex);
    outputs.set(ref.entryId, indices);
  }
  let cursor = initialCursor;
  return inputEntryIds.map((entryId) => {
    const indices = outputs.get(entryId) ?? [];
    const outputStart = indices.length === 0 ? cursor : Math.min(...indices);
    const outputEnd = indices.length === 0 ? outputStart : Math.max(...indices) + 1;
    cursor = outputEnd;
    let estimatedBytes = 0;
    for (const index of indices) {
      const message = outputMessages[index];
      if (message) estimatedBytes += estimatedMessageBytes(message);
    }
    return { entryId, outputStart, outputEnd, estimatedBytes };
  });
}

function projectedImageBytes<T extends ContextMessageLike>(
  input: SharedProjectionInput<T>,
  refs: readonly string[],
): number {
  if (refs.length === 0) return 0;
  const bytes = new Map<string, number>();
  for (const view of viewMap(input.fixedViews).values()) {
    for (const image of view.images ?? []) bytes.set(image.ref, image.bytes);
  }
  for (const images of input.pendingImages?.values() ?? []) {
    for (const image of images) if (!bytes.has(image.ref)) bytes.set(image.ref, image.bytes);
  }
  return refs.reduce((total, ref) => total + (bytes.get(ref) ?? 0), 0);
}

function cacheProjection<T extends ContextMessageLike>(
  input: ProviderRepresentationInput<T>,
  inputEntryIds: string[],
  result: SharedProjectionResult<T>,
  reusablePrefix?: ProjectionEpoch<T>,
): ProjectionEpoch<T> {
  const outputRefs = result.entryRefs ?? [];
  const sourceSpans = reusablePrefix
    ? [
        ...reusablePrefix.sourceSpans,
        ...projectionSpans(
          inputEntryIds.slice(reusablePrefix.inputEntryIds.length),
          result.messages,
          outputRefs,
          reusablePrefix.outputMessages.length,
          reusablePrefix.outputRefs.length,
        ),
      ]
    : projectionSpans(inputEntryIds, result.messages, outputRefs);
  return {
    id: input.epochId,
    modelKey: input.modelKey,
    toolSetRevision: input.toolSetRevision,
    inputEntryIds,
    outputMessages: result.messages,
    outputRefs,
    sourceSpans,
    shownRecoveryToolCallIds: result.shownRecoveryToolCallIds ?? [],
    shownImageRefs: result.shownImageRefs ?? [],
  };
}

/** Pure provider/budget representation with exact source-entry prefix reuse. */
export function buildProviderRepresentation<T extends ContextMessageLike>(
  input: ProviderRepresentationInput<T>,
): SharedProjectionResult<T> {
  const inputEntryIds = completeOrderedEntryIds(input.messages, input.entryRefs);
  const previous = input.cache.epoch;
  const compatible = inputEntryIds !== undefined && previous !== undefined &&
    previous.id === input.epochId && previous.modelKey === input.modelKey &&
    previous.toolSetRevision === input.toolSetRevision &&
    previous.inputEntryIds.length <= inputEntryIds.length &&
    previous.inputEntryIds.every((entryId, index) => inputEntryIds[index] === entryId);
  const appendedGoalControl = compatible && input.sourceMessages !== undefined &&
    inputEntryIds.slice(previous.inputEntryIds.length).some((entryId) => {
      const source = input.sourceMessages?.get(entryId);
      return source !== undefined && goalControlState(source)?.goalId !== undefined;
    });
  const reusable = compatible && !appendedGoalControl;

  let result: SharedProjectionResult<T>;
  if (reusable && previous.inputEntryIds.length === inputEntryIds.length) {
    result = {
      messages: previous.outputMessages,
      entryRefs: previous.outputRefs,
      ...(previous.shownRecoveryToolCallIds.length === 0 ? {} : {
        shownRecoveryToolCallIds: [...previous.shownRecoveryToolCallIds],
      }),
      ...(previous.shownImageRefs.length === 0 ? {} : { shownImageRefs: [...previous.shownImageRefs] }),
    };
  } else if (reusable) {
    const prefixLength = previous.inputEntryIds.length;
    const prefixOutputLength = previous.outputMessages.length;
    const suffixIds = inputEntryIds.slice(prefixLength);
    const suffixSources = input.sourceMessages === undefined
      ? undefined
      : new Map(suffixIds.flatMap((entryId) => {
          const source = input.sourceMessages?.get(entryId);
          return source ? [[entryId, source] as const] : [];
        }));
    const suffix = projectModelContext({
      ...input,
      messages: input.messages.slice(prefixLength),
      entryRefs: suffixIds.map((entryId, messageIndex) => ({ entryId, messageIndex })),
      sourceMessages: suffixSources,
      initialShownImageRefs: previous.shownImageRefs,
      initialProjectedImageBytes: projectedImageBytes(input, previous.shownImageRefs),
    });
    const suffixRefs = (suffix.entryRefs ?? []).map((ref) => ({
      ...ref,
      messageIndex: ref.messageIndex + prefixOutputLength,
    }));
    result = {
      messages: [...previous.outputMessages, ...suffix.messages],
      entryRefs: [...previous.outputRefs, ...suffixRefs],
      ...(suffix.shownRecoveryToolCallIds?.length ? {
        shownRecoveryToolCallIds: suffix.shownRecoveryToolCallIds,
      } : {}),
      ...(suffix.shownImageRefs?.length ? { shownImageRefs: suffix.shownImageRefs } : {}),
    };
  } else {
    result = projectModelContext(input);
  }

  result = {
    ...result,
    projectionIdentity: JSON.stringify([input.epochId, input.modelKey, input.toolSetRevision]),
  };
  // Budget projections are observational. Only a real provider projection advances the cache.
  if (input.purpose === "provider") {
    input.cache.epoch = inputEntryIds === undefined
      ? undefined
      : cacheProjection(input, inputEntryIds, result, reusable ? previous : undefined);
  }
  return result;
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
      content: typeof message.content === "string" ? [{ type: "text", text: message.content }] : message.content,
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

function messageBlocks(message: ContextMessageLike): Record<string, unknown>[] {
  return Array.isArray(message.content)
    ? message.content.filter((part): part is Record<string, unknown> => Boolean(part) && typeof part === "object")
    : [];
}

function hasMedia(message: ContextMessageLike): boolean {
  return messageBlocks(message).some((part) => part.type === "image" || part.type === "audio" || part.type === "file");
}

function asViewMap(
  views: ReadonlyMap<string, FixedExchangeView> | readonly FixedExchangeView[],
): ReadonlyMap<string, FixedExchangeView> {
  return Array.isArray(views)
    ? new Map(views.map((view) => [view.toolCallId, view]))
    : views as ReadonlyMap<string, FixedExchangeView>;
}

export interface ProjectionCandidateEntry<T extends ContextMessageLike = ContextMessageLike> {
  entryId: string;
  message: T;
}

export interface ProjectedBranchCandidates {
  messages: readonly ContextMessageLike[];
  entryIds: readonly string[];
  shownImageRefs: readonly string[];
}

/** Project raw branch candidates through the same provider/budget path used by live requests. */
export function projectBranchCandidateMessages(
  entries: readonly ProjectionCandidateEntry[],
  views: ReadonlyMap<string, FixedExchangeView> | readonly FixedExchangeView[],
  purpose: ContextPurpose = "provider",
): ProjectedBranchCandidates {
  const messages = entries.map((entry) => providerMessageFromSource(entry.message));
  const entryRefs = entries.map((entry, messageIndex) => ({ messageIndex, entryId: entry.entryId }));
  const sourceMessages = new Map(entries.map((entry) => [entry.entryId, entry.message]));
  const projected = projectModelContext({
    purpose,
    messages,
    entryRefs,
    fixedViews: views,
    sourceMessages,
  });
  return {
    messages: projected.messages,
    entryIds: projected.entryRefs?.map((ref) => ref.entryId) ?? [],
    shownImageRefs: projected.shownImageRefs ?? [],
  };
}
