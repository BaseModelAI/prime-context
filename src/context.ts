import { escapeXml, truncateUtf8, utf8Bytes } from "./capsule.js";
import {
  PRIME_CONTEXT_ANCHOR_SCHEMA,
  PRIME_CONTEXT_ANCHOR_TYPE,
  type PrimeContextAnchorDetails,
  TASK_STATE_BOUNDS,
  type TaskSnapshotV2,
} from "./state.js";

const GOAL_CONTEXT_TYPE = "goal_context";
const IPYTHON_STATE_TYPES = new Set(["ipython_state", "ipython_state_restored"]);

export interface ContextMessageLike {
  role: string;
  content?: unknown;
  customType?: string;
  display?: boolean;
  details?: unknown;
  timestamp?: number;
  [key: string]: unknown;
}

export interface TaskAnchorInput {
  task: TaskSnapshotV2;
  child?: {
    parentSessionId: string;
    parentRefs: readonly string[];
    relevantPaths: readonly string[];
    constraints: readonly string[];
  };
}

export interface RenderedTaskAnchor {
  content: string;
  details: PrimeContextAnchorDetails;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function contentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.flatMap((part) => {
    const value = record(part);
    return value?.type === "text" && typeof value.text === "string" ? [value.text] : [];
  }).join("\n");
}

function replaceTextContent(content: unknown, text: string): unknown {
  if (!Array.isArray(content)) return text;
  let replaced = false;
  const next = content.flatMap((part) => {
    const value = record(part);
    if (value?.type !== "text") return [part];
    if (replaced) return [];
    replaced = true;
    return [{ ...value, text }];
  });
  return replaced ? next : [{ type: "text", text }, ...next];
}

function quoted(value: string): string {
  return escapeXml(JSON.stringify(value));
}

function normalizedText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function unique(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizedText(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value.trim());
  }
  return result;
}

function explicitProtectedPaths(values: readonly string[]): string[] {
  const paths: string[] = [];
  for (const value of values) {
    const clauses = value.split(/\n|[.;](?:\s|$)/);
    for (const clause of clauses) {
      if (!/(?:do not|must not|never)\s+(?:edit|modify|touch)|protected paths?/i.test(clause)) continue;
      const tail = clause.replace(/^.*?(?:(?:do not|must not|never)\s+(?:edit|modify|touch)|protected paths?\s*:?)/i, "");
      for (const candidate of tail.split(/,|\band\b/i)) {
        const cleaned = candidate.trim().replace(/^[`'"]|[`'"]$/g, "");
        if (/^(?:[A-Za-z0-9_.-]+\/|\.\/|\/|README\b|[^ ]+\.\w+|[^ ]+\/\*\*)/.test(cleaned)) paths.push(cleaned);
      }
    }
  }
  return unique(paths);
}

/** Render one bounded descriptive task anchor. */
export function renderPrimeContextAnchor(input: TaskAnchorInput): RenderedTaskAnchor {
  const objective = input.task.objective?.trim() ?? "";
  const constraints = activeConstraintTexts(input.task)
    .filter((value) => normalizedText(value) !== normalizedText(objective));
  const protectedPaths = explicitProtectedPaths([objective, ...constraints]);
  const lines = ["<prime_context_anchor>", `objective: ${quoted(objective)}`];
  if (constraints.length > 0) {
    lines.push("constraints:", ...constraints.map((value) => `- ${quoted(value)}`));
  }
  if (protectedPaths.length > 0) {
    lines.push("protected_paths:", ...protectedPaths.map((path) => `- ${escapeXml(boundedDisplay(path))}`));
  }
  if (input.task.focus) lines.push(`durable_focus: ${quoted(boundedDisplay(input.task.focus, 256))}`);
  if (input.task.openItems.length > 0) {
    lines.push("open_items:", ...input.task.openItems.map((item) => `- [${escapeXml(boundedDisplay(item.id, 96))}] ${escapeXml(boundedDisplay(item.text, 256))}`));
  }
  if (input.task.pinnedObservationIds.length > 0) {
    lines.push("pinned_outputs:", ...input.task.pinnedObservationIds.map((id) => `- ${escapeXml(boundedDisplay(id, 128))}`));
  }
  if (input.child) {
    const parentRefs = unique(input.child.parentRefs).slice(0, 8);
    const relevantPaths = unique(input.child.relevantPaths).slice(0, 8);
    const childConstraints = unique(input.child.constraints).slice(0, 6);
    lines.push("child_context:", `- parent_session: ${escapeXml(boundedDisplay(input.child.parentSessionId, 128))}`);
    if (parentRefs.length > 0) lines.push("- parent_refs:", ...parentRefs.map((ref) => `  - ${escapeXml(boundedDisplay(ref, 128))}`));
    if (relevantPaths.length > 0) lines.push("- relevant_paths:", ...relevantPaths.map((path) => `  - ${escapeXml(boundedDisplay(path, 192))}`));
    if (childConstraints.length > 0) lines.push("- inherited_constraints:", ...childConstraints.map((value) => `  - ${quoted(boundedDisplay(value, 256))}`));
    lines.push('- parent_lookup: "prime_context action=recall scope=parent id=<parent_ref>"');
    lines.push('- reply_contract: "Return touched paths, current validation facts, and child refs; do not copy large diagnostics."');
  }
  lines.push("</prime_context_anchor>");
  return {
    content: lines.join("\n"),
    details: { schema: PRIME_CONTEXT_ANCHOR_SCHEMA, taskKey: input.task.taskKey },
  };
}

function boundedDisplay(value: string, maxBytes = 160): string {
  const display = value.trim().replace(/[\r\n\t]+/g, " ");
  if (utf8Bytes(display) <= maxBytes) return display;
  return `${truncateUtf8(display, Math.max(0, maxBytes - 3))}…`;
}

function short(value: string, maxBytes = 88): string {
  return boundedDisplay(value, maxBytes);
}

function boundedList(values: readonly string[], limit = 4, itemBytes = 160): string {
  const shown = values.slice(0, limit).map((value) => boundedDisplay(value, itemBytes));
  const omitted = values.length - shown.length;
  return `${shown.join(", ")}${omitted > 0 ? `, +${omitted}` : ""}`;
}

export interface PrimeContextTaskRenderOptions {
  /** Set when the current user request already shows the snapshot objective. */
  objectiveVisible?: boolean;
}

type TaskPacketField =
  | { label: string; value: string | undefined }
  | { label: string; values: readonly string[] };

const TASK_PACKET_MAX_BYTES = TASK_STATE_BOUNDS.renderedTokens * 4;
const TASK_PACKET_VALUE_MAX_BYTES = 384;

function visibleValue(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = normalizedText(value);
  return normalized || undefined;
}

function escapedValueWithin(value: string, maxBytes: number): string {
  const normalized = normalizedText(value);
  if (!normalized || maxBytes <= 0) return "";
  const escaped = escapeXml(normalized);
  if (utf8Bytes(escaped) <= maxBytes) return escaped;

  let low = 0;
  let high = utf8Bytes(normalized);
  let best = "";
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const prefix = truncateUtf8(normalized, middle).trimEnd();
    const candidate = prefix ? escapeXml(`${prefix}…`) : "";
    if (candidate && utf8Bytes(candidate) <= maxBytes) {
      best = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return best;
}

function packetBytes(lines: readonly string[], closingTag: string): number {
  return utf8Bytes([...lines, closingTag].join("\n"));
}

function appendBoundedPacketLine(
  lines: string[],
  closingTag: string,
  prefix: string,
  value: string,
): boolean {
  const remaining = TASK_PACKET_MAX_BYTES - packetBytes([...lines, prefix], closingTag);
  const escaped = escapedValueWithin(value, Math.min(TASK_PACKET_VALUE_MAX_BYTES, remaining));
  if (!escaped) return false;
  const next = `${prefix}${escaped}`;
  if (packetBytes([...lines, next], closingTag) > TASK_PACKET_MAX_BYTES) return false;
  lines.push(next);
  return true;
}

function renderTaskPacket(tag: "prime_context_task" | "prime_context_update", fields: readonly TaskPacketField[]): string {
  const closingTag = `</${tag}>`;
  const lines = [`<${tag}>`];
  for (const field of fields) {
    if ("value" in field) {
      const value = visibleValue(field.value);
      if (value) appendBoundedPacketLine(lines, closingTag, `${field.label}: `, value);
      continue;
    }

    const values = unique(field.values).map(visibleValue).filter((value): value is string => value !== undefined);
    if (values.length === 0) continue;
    const headingIndex = lines.length;
    lines.push(`${field.label}:`);
    let added = false;
    for (const value of values) {
      added = appendBoundedPacketLine(lines, closingTag, "- ", value) || added;
    }
    if (!added) lines.splice(headingIndex, 1);
  }
  if (lines.length === 1) return "";
  lines.push(closingTag);
  return lines.join("\n");
}

function activeConstraintTexts(snapshot: TaskSnapshotV2): string[] {
  return snapshot.explicitConstraints
    .filter((constraint) => constraint.supersededBy === undefined)
    .slice(0, TASK_STATE_BOUNDS.constraints)
    .map((constraint) => constraint.text);
}

function openItems(snapshot: TaskSnapshotV2): TaskSnapshotV2["openItems"] {
  return snapshot.openItems.slice(0, TASK_STATE_BOUNDS.openItems);
}

function formatOpenItem(item: TaskSnapshotV2["openItems"][number]): string {
  const id = visibleValue(item.id);
  const text = visibleValue(item.text);
  return id && text ? `[${id}] ${text}` : text ?? id ?? "";
}

function observations(snapshot: TaskSnapshotV2): TaskSnapshotV2["actionableObservations"] {
  return snapshot.actionableObservations.slice(0, TASK_STATE_BOUNDS.actionableObservations);
}

function observationKey(observation: TaskSnapshotV2["actionableObservations"][number]): string {
  return [observation.text, observation.resource ?? ""].map(normalizedText).join("\u0000");
}

function formatObservation(observation: TaskSnapshotV2["actionableObservations"][number]): string {
  const text = visibleValue(observation.text) ?? "";
  const resource = visibleValue(observation.resource);
  return resource ? `${text} (${resource})` : text;
}

function artifacts(snapshot: TaskSnapshotV2): TaskSnapshotV2["artifacts"] {
  return snapshot.artifacts.slice(0, TASK_STATE_BOUNDS.artifacts);
}

function artifactKey(artifact: TaskSnapshotV2["artifacts"][number]): string {
  return [artifact.pathOrId, artifact.description ?? ""].map(normalizedText).join("\u0000");
}

function formatArtifact(artifact: TaskSnapshotV2["artifacts"][number]): string {
  const pathOrId = visibleValue(artifact.pathOrId) ?? "";
  const description = visibleValue(artifact.description);
  return description ? `${pathOrId} — ${description}` : pathOrId;
}

function visibleSet(values: readonly string[]): Set<string> {
  return new Set(values.map(normalizedText).filter(Boolean));
}

/** Render the bounded descriptive packet that starts a task. */
export function renderPrimeContextTask(
  snapshot: TaskSnapshotV2,
  options: PrimeContextTaskRenderOptions = {},
): string {
  return renderTaskPacket("prime_context_task", [
    { label: "objective", value: options.objectiveVisible ? undefined : snapshot.objective },
    { label: "constraints", values: activeConstraintTexts(snapshot) },
    { label: "focus", value: snapshot.focus },
    { label: "open_items", values: openItems(snapshot).map(formatOpenItem) },
    { label: "new_facts", values: observations(snapshot).map(formatObservation) },
    { label: "artifacts", values: artifacts(snapshot).map(formatArtifact) },
    { label: "pinned_observations", values: snapshot.pinnedObservationIds.slice(0, TASK_STATE_BOUNDS.pins) },
  ]);
}

/** Render only meaningful model-visible changes between two canonical snapshots. */
export function renderPrimeContextUpdate(previous: TaskSnapshotV2, current: TaskSnapshotV2): string | undefined {
  const previousConstraints = visibleSet(activeConstraintTexts(previous));
  const currentConstraints = visibleSet(activeConstraintTexts(current));
  const constraintAdded = activeConstraintTexts(current).filter((text) => !previousConstraints.has(normalizedText(text)));
  const constraintRemoved = activeConstraintTexts(previous).filter((text) => !currentConstraints.has(normalizedText(text)));

  const previousItems = new Map(openItems(previous).map((item) => [normalizedText(item.id), item]));
  const currentItems = new Map(openItems(current).map((item) => [normalizedText(item.id), item]));
  const openItemAdded = openItems(current)
    .filter((item) => !previousItems.has(normalizedText(item.id)))
    .map(formatOpenItem);
  const openItemRemoved = openItems(previous)
    .filter((item) => !currentItems.has(normalizedText(item.id)))
    .map(formatOpenItem);
  const openItemUpdated = openItems(current)
    .filter((item) => {
      const before = previousItems.get(normalizedText(item.id));
      return before !== undefined && normalizedText(before.text) !== normalizedText(item.text);
    })
    .map(formatOpenItem);

  const previousPins = visibleSet(previous.pinnedObservationIds.slice(0, TASK_STATE_BOUNDS.pins));
  const currentPins = visibleSet(current.pinnedObservationIds.slice(0, TASK_STATE_BOUNDS.pins));
  const pinsAdded = current.pinnedObservationIds.slice(0, TASK_STATE_BOUNDS.pins)
    .filter((id) => !previousPins.has(normalizedText(id)));
  const pinsRemoved = previous.pinnedObservationIds.slice(0, TASK_STATE_BOUNDS.pins)
    .filter((id) => !currentPins.has(normalizedText(id)));

  const previousObservations = new Set(observations(previous).map(observationKey));
  const newFacts = observations(current)
    .filter((observation) => !previousObservations.has(observationKey(observation)))
    .map(formatObservation);
  const previousArtifacts = new Set(artifacts(previous).map(artifactKey));
  const newArtifacts = artifacts(current)
    .filter((artifact) => !previousArtifacts.has(artifactKey(artifact)))
    .map(formatArtifact);

  const objectiveChanged = normalizedText(previous.objective ?? "") !== normalizedText(current.objective ?? "");
  const focusChanged = normalizedText(previous.focus ?? "") !== normalizedText(current.focus ?? "");
  const fields: TaskPacketField[] = [
    { label: "objective", value: objectiveChanged ? current.objective : undefined },
    { label: "objective_removed", value: objectiveChanged && !visibleValue(current.objective) ? previous.objective : undefined },
    { label: "constraint_added", values: constraintAdded },
    { label: "constraint_removed", values: constraintRemoved },
    { label: "focus", value: focusChanged ? current.focus : undefined },
    { label: "focus_removed", value: focusChanged && !visibleValue(current.focus) ? previous.focus : undefined },
    { label: "open_item_added", values: openItemAdded },
    { label: "open_item_updated", values: openItemUpdated },
    { label: "open_item_removed", values: openItemRemoved },
    { label: "pin_added", values: pinsAdded },
    { label: "pin_removed", values: pinsRemoved },
    { label: "new_fact", values: newFacts },
    { label: "artifact", values: newArtifacts },
  ];
  const hasVisibleChange = fields.some((field) => "value" in field
    ? visibleValue(field.value) !== undefined
    : field.values.some((value) => visibleValue(value) !== undefined));
  return hasVisibleChange ? renderTaskPacket("prime_context_update", fields) : undefined;
}


function goalObjective(message: ContextMessageLike): string | undefined {
  const details = record(message.details);
  if (typeof details?.objective === "string" && details.objective.trim()) return details.objective;
  const text = contentText(message.content);
  const match = text.match(/<(?:untrusted_)?objective>\s*([\s\S]*?)\s*<\/(?:untrusted_)?objective>/i);
  return match?.[1]?.trim();
}

function goalRemaining(message: ContextMessageLike): string | undefined {
  const details = record(message.details);
  const direct = details?.remainingTokens ?? details?.remaining_tokens;
  if (typeof direct === "number" || direct === "string") return String(direct);
  if (typeof details?.tokenBudget === "number" && typeof details.tokensUsed === "number") {
    return String(Math.max(0, details.tokenBudget - details.tokensUsed));
  }
  const text = contentText(message.content);
  return text.match(/\bremaining_tokens="([^"]+)"/i)?.[1] ??
    text.match(/(?:^|[-•]\s*)remaining[_ ]tokens:\s*(unbounded|\d+)/im)?.[1];
}

function attribute(name: string, value: string | number | undefined): string {
  return value === undefined ? "" : ` ${name}="${escapeXml(String(value))}"`;
}

interface GoalProjectionState {
  objective: string;
  version: number;
  status?: string;
  remaining?: string;
  occurrences: number;
}

function mapGoalMessage(
  message: ContextMessageLike,
  states: Map<string, GoalProjectionState>,
): ContextMessageLike {
  const details = record(message.details);
  const objective = goalObjective(message);
  if (!objective) return message;
  const goalId = typeof details?.goalId === "string" ? details.goalId : "goal";
  const status = typeof details?.status === "string" ? details.status : undefined;
  const remaining = goalRemaining(message);
  const previous = states.get(goalId);
  const objectiveChanged = !previous || previous.objective !== objective;
  const version = objectiveChanged ? (previous?.version ?? 0) + 1 : previous.version;
  const occurrences = (previous?.occurrences ?? 0) + 1;
  let text: string;
  if (objectiveChanged) {
    text = [
      `<goal_objective${attribute("id", goalId)}${attribute("version", version)}>`,
      `objective: ${quoted(objective)}`,
      ...(status !== previous?.status ? [`status: ${escapeXml(status ?? "unknown")}`] : []),
      ...(remaining !== previous?.remaining ? [`remaining_tokens: ${escapeXml(remaining ?? "unknown")}`] : []),
      "</goal_objective>",
    ].join("\n");
  } else {
    const continuation = typeof details?.continuationsUsed === "number" ? details.continuationsUsed : occurrences - 1;
    text = `<goal_tick${attribute("id", goalId)}${attribute("continuation", continuation)}` +
      `${status !== previous.status ? attribute("status", status) : ""}` +
      `${remaining !== previous.remaining ? attribute("remaining_tokens", remaining) : ""} />`;
  }
  states.set(goalId, { objective, version, status, remaining, occurrences });
  return { ...message, content: replaceTextContent(message.content, text) };
}

function listedNames(text: string, marker: RegExp): string[] | undefined {
  const match = text.match(marker);
  if (!match) return undefined;
  const names = match[1].trim().replace(/\.$/, "");
  return names ? names.split(/,\s*/).filter(Boolean) : [];
}

function mapIpythonMessage(message: ContextMessageLike): ContextMessageLike {
  const customType = message.customType ?? "";
  if (!IPYTHON_STATE_TYPES.has(customType)) return message;
  const text = contentText(message.content);
  if (/^<ipython_inventory\b/i.test(text.trim())) return message;
  const available = listedNames(text, /(?:These names are still defined|These names are available again):\s*([^\n<]+)/i);
  const failed = listedNames(text, /These could not be restored[^:]*:\s*([^\n<]+)/i) ?? [];
  const pruned = listedNames(text, /Variables above[^:]*were removed:\s*(.*?)(?=\. These names are|[\n<]|$)/i) ?? [];
  const availableCount = available?.length ?? (/starting fresh|not defined any names/i.test(text) ? 0 : undefined);
  const kind = customType === "ipython_state_restored" ? "restored" : "persisted";
  const summary = [
    `<ipython_inventory kind="${kind}" available="${availableCount ?? "unknown"}" failed="${failed.length}" pruned="${pruned.length}">`,
    "Use `name in globals()` or filter `globals()` to locate a specific value.",
    "</ipython_inventory>",
  ].join("\n");
  return { ...message, content: replaceTextContent(message.content, summary) };
}

/** Pure prefix mapping. Earlier messages never depend on later continuations. */
export function mapStableControlMessages(messages: readonly ContextMessageLike[]): readonly ContextMessageLike[] {
  const goals = new Map<string, GoalProjectionState>();
  let changed = false;
  const mapped = messages.map((message) => {
    let next = message;
    if (message.role === "custom" && message.customType === GOAL_CONTEXT_TYPE) {
      next = mapGoalMessage(message, goals);
    } else if (message.role === "custom" && IPYTHON_STATE_TYPES.has(message.customType ?? "")) {
      next = mapIpythonMessage(message);
    }
    changed ||= next !== message;
    return next;
  });
  return changed ? mapped : messages;
}


export function persistentControlMessage(
  customType: typeof PRIME_CONTEXT_ANCHOR_TYPE,
  rendered: RenderedTaskAnchor,
  timestamp = Date.now(),
): ContextMessageLike {
  return {
    role: "custom",
    customType,
    content: rendered.content,
    display: false,
    details: rendered.details,
    timestamp,
  };
}
