import { escapeXml, truncateUtf8, utf8Bytes } from "./capsule.js";
import type { TaskRuntimeV2, ValidationGate, ValidationState } from "./runtime.js";
import { deriveReadiness } from "./workflow.js";
import {
  PRIME_CONTEXT_ANCHOR_SCHEMA,
  PRIME_CONTEXT_ANCHOR_TYPE,
  PRIME_CONTEXT_FOLD_SCHEMA,
  PRIME_CONTEXT_FOLD_TYPE,
  PRIME_CONTEXT_STATE_SCHEMA,
  PRIME_CONTEXT_STATE_TYPE,
  type PrimeContextAnchorDetails,
  type PrimeContextFoldDetails,
  type PrimeContextStateDetails,
  type TaskSnapshotV1,
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
  taskKey?: string;
  objective: string;
  runtime: TaskRuntimeV2;
  snapshot: TaskSnapshotV1;
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

export interface RenderedTaskState {
  content: string;
  details: PrimeContextStateDetails;
}

export interface RenderedTaskFold {
  content: string;
  details: PrimeContextFoldDetails;
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

function durableSnapshot(snapshot: TaskSnapshotV1): boolean {
  return Boolean(snapshot.focus) || snapshot.openItems.length > 0 || snapshot.pinnedObservationIds.length > 0;
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

function normalizedGate(gate: ValidationGate): string {
  if (gate.suiteFamily && gate.target) return `${gate.suiteFamily}:${gate.target}`;
  return gate.key;
}

/** Render the persistent task contract. Field order and model-visible bytes are stable. */
export function renderPrimeContextAnchor(input: TaskAnchorInput): RenderedTaskAnchor {
  const objective = input.objective.trim();
  const constraints = unique(input.runtime.steeringDeltas)
    .filter((value) => normalizedText(value) !== normalizedText(objective));
  const protectedPaths = explicitProtectedPaths([objective, ...constraints]);
  const lines = [
    "<prime_context_anchor>",
    `objective: ${quoted(objective)}`,
    `requirements_revision: r${input.runtime.requirementsRevision}`,
  ];
  if (constraints.length > 0) {
    lines.push("constraints:", ...constraints.map((value) => `- ${quoted(value)}`));
  }
  if (input.runtime.validationGates.length > 0) {
    lines.push("required_gates:", ...input.runtime.validationGates.map((gate) => `- ${escapeXml(boundedDisplay(normalizedGate(gate)))}`));
  }
  if (protectedPaths.length > 0) {
    lines.push("protected_paths:", ...protectedPaths.map((path) => `- ${escapeXml(boundedDisplay(path))}`));
  }
  if (input.snapshot.focus) lines.push(`durable_focus: ${quoted(boundedDisplay(input.snapshot.focus, 256))}`);
  if (input.snapshot.openItems.length > 0) {
    lines.push("open_items:", ...input.snapshot.openItems.map((item) => `- [${escapeXml(boundedDisplay(item.id, 96))}] ${escapeXml(boundedDisplay(item.text, 256))}`));
  }
  if (input.snapshot.pinnedObservationIds.length > 0) {
    lines.push("pinned_outputs:", ...input.snapshot.pinnedObservationIds.map((id) => `- ${escapeXml(boundedDisplay(id, 128))}`));
  }
  if (input.child) {
    const parentRefs = unique(input.child.parentRefs).slice(0, 8);
    const relevantPaths = unique(input.child.relevantPaths).slice(0, 8);
    const childConstraints = unique(input.child.constraints).slice(0, 6);
    lines.push("child_context:", `- parent_session: ${escapeXml(boundedDisplay(input.child.parentSessionId, 128))}`);
    if (parentRefs.length > 0) {
      lines.push("- parent_refs:", ...parentRefs.map((ref) => `  - ${escapeXml(boundedDisplay(ref, 128))}`));
    }
    if (relevantPaths.length > 0) {
      lines.push("- relevant_paths:", ...relevantPaths.map((path) => `  - ${escapeXml(boundedDisplay(path, 192))}`));
    }
    if (childConstraints.length > 0) {
      lines.push("- inherited_constraints:", ...childConstraints.map((value) => `  - ${quoted(boundedDisplay(value, 256))}`));
    }
    lines.push('- parent_lookup: "prime_context action=recall scope=parent id=<parent_ref>"');
    lines.push('- reply_contract: "Return touched paths, current validation facts, and child refs; do not copy large diagnostics."');
  }
  lines.push("</prime_context_anchor>");
  return {
    content: lines.join("\n"),
    details: {
      schema: PRIME_CONTEXT_ANCHOR_SCHEMA,
      ...(input.taskKey === undefined ? {} : { taskKey: input.taskKey }),
      objectiveVersion: input.runtime.objectiveVersion,
      requirementsRevision: input.runtime.requirementsRevision,
    },
  };
}

/** The submitted prompt needs no duplicate anchor when it is the complete, only durable contract. */
export function taskAnchorHasDurableState(input: TaskAnchorInput, visiblePrompt: string): boolean {
  if (input.child || input.runtime.goalId || durableSnapshot(input.snapshot)) return true;
  if (input.runtime.validations.length > 0 || input.runtime.activeDiagnostics.length > 0 ||
      input.runtime.modifiedResources.length > 0) return true;
  const prompt = normalizedText(visiblePrompt);
  const otherSteering = input.runtime.steeringDeltas.some((value) => normalizedText(value) !== prompt);
  if (otherSteering) return true;
  const objectiveVisible = normalizedText(input.objective) === prompt;
  return !objectiveVisible;
}

function latestGateValidation(runtime: TaskRuntimeV2, gate: ValidationGate): ValidationState | undefined {
  return runtime.validations.find((validation) => {
    if (gate.suiteFamily && validation.suite.family !== gate.suiteFamily) return false;
    if (gate.target && validation.suite.target !== gate.target) return false;
    return gate.suiteFamily !== undefined || gate.target !== undefined ||
      `suite:${validation.suite.family}:${validation.suite.target}` === gate.key;
  });
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

export function modifiedResourcesSinceGate(runtime: TaskRuntimeV2, gate: ValidationGate): string[] {
  const validation = latestGateValidation(runtime, gate);
  const revision = validation?.workspaceRevision ?? -1;
  return runtime.modifiedResources
    .filter((resource) => resource.revision > revision)
    .map((resource) => resource.path);
}

function subjectPath(subject: string): string | undefined {
  return subject.startsWith("path:") ? subject.slice(5) : undefined;
}

/** Deterministic current-state ranking. Manual focus and pins are retained as overrides. */
export function rankWorkingSet(
  runtime: TaskRuntimeV2,
  snapshot?: Pick<TaskSnapshotV1, "focus" | "pinnedObservationIds">,
  limit = 12,
): string[] {
  const ranked: string[] = [];
  const add = (value: string | undefined): void => {
    const normalized = value?.trim();
    if (normalized && !ranked.includes(normalized)) ranked.push(normalized);
  };
  for (const diagnostic of runtime.activeDiagnostics) {
    for (const resource of diagnostic.resources ?? []) add(resource);
    add(subjectPath(diagnostic.subjectKey ?? ""));
  }
  for (const resource of runtime.modifiedResources) add(resource.path);
  const latestSteeringRevision = runtime.steeringResources.reduce(
    (latest, resource) => Math.max(latest, resource.requirementsRevision),
    -1,
  );
  for (const resource of runtime.steeringResources) {
    if (resource.requirementsRevision === latestSteeringRevision) add(resource.path);
  }
  for (const gate of runtime.validationGates) {
    const subjects = runtime.recentSubjects.filter((subject) =>
      subject.intentKind === "test" || subject.intentKind === "build" || subject.intentKind === "lint");
    for (const subject of subjects) {
      if ((gate.target && subject.subjectKey.includes(gate.target)) ||
        (gate.suiteFamily && subject.subjectKey.includes(gate.suiteFamily))) {
        for (const resource of subject.resources) add(resource);
      }
    }
    if (gate.target?.includes("/") || gate.target?.includes(".")) add(gate.target);
  }
  for (const subject of runtime.recentSubjects) {
    if (subject.intentKind !== "read" && subject.intentKind !== "search") continue;
    for (const resource of subject.resources) add(resource);
    add(subjectPath(subject.subjectKey));
  }
  const bounded = ranked.slice(0, Math.max(0, limit));
  const override = (value: string | undefined): void => {
    if (value && !bounded.includes(value)) bounded.push(value);
  };
  override(snapshot?.focus ? `focus:${short(snapshot.focus, 120)}` : undefined);
  for (const pin of snapshot?.pinnedObservationIds ?? []) override(`pin:${pin}`);
  return bounded;
}

/** Render a bounded checkpoint of current typed facts only. */
export function renderPrimeContextState(runtime: TaskRuntimeV2, snapshot?: TaskSnapshotV1): RenderedTaskState {
  const gateFacts = runtime.validationGates.map((gate) => {
    const validation = latestGateValidation(runtime, gate);
    const modified = modifiedResourcesSinceGate(runtime, gate);
    const modifiedFact = boundedList(modified.length > 0 ? modified : ["none"]);
    if (!validation) return `${boundedDisplay(normalizedGate(gate))}=not-run modified=${modifiedFact}`;
    const current = validation.requirementsRevision === runtime.requirementsRevision &&
      validation.workspaceRevision === runtime.workspaceRevision;
    const status = validation.status === "success" ? "pass" : "fail";
    return `${boundedDisplay(normalizedGate(gate))}=${status}${current ? "" : "-stale"}@r${validation.requirementsRevision}/w${validation.workspaceRevision} modified=${modifiedFact}`;
  });
  const diagnostics = runtime.activeDiagnostics.map((diagnostic) => {
    const resources = diagnostic.resources?.length ? ` resources=${boundedList(diagnostic.resources)}` : "";
    const ref = diagnostic.exchangeId ? ` ref=${boundedDisplay(diagnostic.exchangeId, 96)}:result` : "";
    return `${boundedDisplay(diagnostic.summary, 160)} [${diagnostic.state}]${resources}${ref}`;
  });
  const actions = runtime.recentSubjects.slice(0, 6).map((subject) => {
    const resources = subject.resources.length > 0 ? ` ${boundedList(subject.resources)}` : "";
    const ref = subject.exchangeId ? ` ref=${boundedDisplay(subject.exchangeId, 96)}` : "";
    return `${subject.intentKind} ${boundedDisplay(subject.subjectKey, 160)}${resources}${ref}`;
  });
  const firstUnmetGate = runtime.validationGates.find((gate) => {
    const validation = latestGateValidation(runtime, gate);
    return !validation || validation.status !== "success" ||
      validation.requirementsRevision !== runtime.requirementsRevision ||
      validation.workspaceRevision !== runtime.workspaceRevision;
  });
  const firstDiagnostic = runtime.activeDiagnostics[0];
  const nextObligation = firstDiagnostic?.state === "active"
    ? `resolve ${short(firstDiagnostic.summary)}`
    : firstDiagnostic
      ? `rerun current ${boundedDisplay(firstDiagnostic.suiteFamily ?? "validation")} gate`
      : firstUnmetGate
        ? `run current gate ${boundedDisplay(normalizedGate(firstUnmetGate))}`
        : snapshot?.openItems[0]
          ? `complete open item ${boundedDisplay(snapshot.openItems[0].id, 96)}`
          : "none";
  const lines = [
    "<prime_context_state>",
    `objective: ${quoted(runtime.objective ?? runtime.taskKey)} v${runtime.objectiveVersion}`,
    `requirements: r${runtime.requirementsRevision} ${runtime.requirementsLocked ? "locked" : "open"}`,
    `workspace: w${runtime.workspaceRevision}`,
    `readiness: ${deriveReadiness(runtime)}`,
  ];
  if (gateFacts.length > 0) lines.push("validation_gates:", ...gateFacts.map((fact) => `- ${escapeXml(fact)}`));
  if (diagnostics.length > 0) lines.push("active_diagnostics:", ...diagnostics.map((fact) => `- ${escapeXml(fact)}`));
  if (actions.length > 0) lines.push("recent_actions:", ...actions.map((fact) => `- ${escapeXml(fact)}`));
  const hot = rankWorkingSet(runtime, snapshot);
  if (hot.length > 0) lines.push("hot:", ...hot.map((value) => `- ${escapeXml(boundedDisplay(value))}`));
  if (snapshot?.openItems.length) lines.push(`open_items: ${snapshot.openItems.length}`);
  lines.push(`next_obligation: ${escapeXml(nextObligation)}`, "</prime_context_state>");
  return {
    content: lines.join("\n"),
    details: {
      schema: PRIME_CONTEXT_STATE_SCHEMA,
      taskKey: runtime.taskKey,
      requirementsRevision: runtime.requirementsRevision,
      workspaceRevision: runtime.workspaceRevision,
    },
  };
}

/** Render one immutable structured fold message from current typed facts. */
export function renderPrimeContextFold(
  runtime: TaskRuntimeV2,
  snapshot: TaskSnapshotV1,
  generation: number,
  throughEntryId: string,
): RenderedTaskFold {
  const lines = [`<prime_context_fold generation="${generation}">`];
  const subjects = rankWorkingSet(runtime, undefined, 8).slice(0, 8);
  if (subjects.length > 0) {
    lines.push("current_subjects:");
    for (const value of subjects) {
      const subject = runtime.recentSubjects.find((candidate) =>
        candidate.resources.includes(value) || subjectPath(candidate.subjectKey) === value);
      lines.push(`- ${escapeXml(boundedDisplay(value, 160))}${subject?.exchangeId ? ` last_action=${escapeXml(boundedDisplay(subject.exchangeId, 96))}` : ""}`);
    }
  }
  if (runtime.activeDiagnostics.length > 0) {
    lines.push("unresolved:");
    for (const diagnostic of runtime.activeDiagnostics.slice(0, 8)) {
      lines.push(`- ${escapeXml(boundedDisplay(diagnostic.summary, 160))}${diagnostic.exchangeId ? ` ref=${escapeXml(boundedDisplay(diagnostic.exchangeId, 96))}:result` : ""}`);
    }
  }
  if (runtime.validationGates.length > 0) {
    lines.push("validation:");
    for (const gate of runtime.validationGates) {
      const validation = latestGateValidation(runtime, gate);
      const current = validation && validation.requirementsRevision === runtime.requirementsRevision &&
        validation.workspaceRevision === runtime.workspaceRevision;
      const status = validation ? `${validation.status === "success" ? "pass" : "fail"}${current ? "" : "-stale"}@w${validation.workspaceRevision}` : "not-run";
      const modified = modifiedResourcesSinceGate(runtime, gate);
      lines.push(`- ${escapeXml(boundedDisplay(normalizedGate(gate)))} ${status} modified=${escapeXml(boundedList(modified.length ? modified : ["none"]))}`);
    }
  }
  if (snapshot.pinnedObservationIds.length > 0) {
    lines.push("pinned:", ...snapshot.pinnedObservationIds.map((id) => `- ${escapeXml(boundedDisplay(id, 128))}`));
  }
  lines.push("</prime_context_fold>");
  return {
    content: lines.join("\n"),
    details: {
      schema: PRIME_CONTEXT_FOLD_SCHEMA,
      taskKey: runtime.taskKey,
      generation,
      throughEntryId,
    },
  };
}

interface GoalProjectionState {
  objective: string;
  version: number;
  status?: string;
  remaining?: string;
  occurrences: number;
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

export interface AnchorMatchOptions {
  allowUnscopedAfterLatestUser?: boolean;
}

export function matchingAnchorInMessages(
  messages: readonly ContextMessageLike[],
  anchor: RenderedTaskAnchor,
  options: AnchorMatchOptions = {},
): boolean {
  let latestUserIndex = -1;
  if (options.allowUnscopedAfterLatestUser) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "user") {
        latestUserIndex = index;
        break;
      }
    }
  }
  return messages.some((message, index) => {
    if (message.role !== "custom" || message.customType !== PRIME_CONTEXT_ANCHOR_TYPE || message.content !== anchor.content) return false;
    const details = record(message.details);
    if (details?.temporary === true) return false;
    if (details?.taskKey === anchor.details.taskKey) return true;
    return options.allowUnscopedAfterLatestUser === true && details?.taskKey === undefined &&
      latestUserIndex >= 0 && index > latestUserIndex;
  });
}

export function appendTemporaryAnchor(
  messages: readonly ContextMessageLike[],
  anchor: RenderedTaskAnchor,
  options: AnchorMatchOptions = {},
): readonly ContextMessageLike[] {
  if (matchingAnchorInMessages(messages, anchor, options) || messages.some((message) => {
    const details = record(message.details);
    return message.role === "custom" && message.customType === PRIME_CONTEXT_ANCHOR_TYPE &&
      message.content === anchor.content && details?.temporary === true && details.taskKey === anchor.details.taskKey;
  })) return messages;
  return [...messages, {
    role: "custom",
    customType: PRIME_CONTEXT_ANCHOR_TYPE,
    content: anchor.content,
    display: false,
    details: { ...anchor.details, temporary: true },
  }];
}

export function persistentControlMessage(
  customType: typeof PRIME_CONTEXT_ANCHOR_TYPE,
  rendered: RenderedTaskAnchor,
  timestamp?: number,
): ContextMessageLike;
export function persistentControlMessage(
  customType: typeof PRIME_CONTEXT_STATE_TYPE,
  rendered: RenderedTaskState,
  timestamp?: number,
): ContextMessageLike;
export function persistentControlMessage(
  customType: typeof PRIME_CONTEXT_FOLD_TYPE,
  rendered: RenderedTaskFold,
  timestamp?: number,
): ContextMessageLike;
export function persistentControlMessage(
  customType: typeof PRIME_CONTEXT_ANCHOR_TYPE | typeof PRIME_CONTEXT_STATE_TYPE | typeof PRIME_CONTEXT_FOLD_TYPE,
  rendered: RenderedTaskAnchor | RenderedTaskState | RenderedTaskFold,
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
