import type { ExchangeFacts, ProgressEffect } from "./exchange.js";
import {
  addActionableObservations,
  addTaskArtifacts,
  type TaskActionableObservation,
  type TaskArtifact,
  type TaskSnapshotV2,
} from "./state.js";

export function applyProgressEffect(snapshot: TaskSnapshotV2, effect: ProgressEffect): TaskSnapshotV2 {
  switch (effect.kind) {
    case "information":
      return addActionableObservations(snapshot, effect.observations as readonly TaskActionableObservation[]);
    case "failure":
      return addActionableObservations(snapshot, [effect.observation]);
    case "mutation":
      return effect.artifacts?.length
        ? addTaskArtifacts(snapshot, effect.artifacts as readonly TaskArtifact[])
        : snapshot;
    case "none":
      return snapshot;
  }
}

/** Apply exactly one canonical effect per exchange in host source order. */
export function applyProgressEffects(
  snapshot: TaskSnapshotV2,
  exchanges: readonly ExchangeFacts[],
): TaskSnapshotV2 {
  return exchanges
    .map((facts, inputOrder) => ({ facts, inputOrder }))
    .sort((left, right) => left.facts.sourceOrder - right.facts.sourceOrder || left.inputOrder - right.inputOrder)
    .reduce((current, { facts }) => applyProgressEffect(current, facts.progress), snapshot);
}

export const EXACT_REPEAT_HINT = `<prime_context_hint>
This action reproduced the same result without changing task state. Use the existing evidence or change the approach before repeating it again.
</prime_context_hint>`;

export interface ExactRepeatValue {
  action: string;
  subject: string;
  resultText: string;
}

export interface ExactRepeatHintState {
  taskKey?: string;
  contextEpoch: number;
  candidate?: ExactRepeatValue & { occurrences: number };
  emitted: ExactRepeatValue[];
}

export interface ExactRepeatHintContext {
  taskKey?: string;
  contextEpoch: number;
  userInitiated?: boolean;
  pollingOrTimeSensitive?: boolean;
  intervening?: "user" | "mutation" | "evidence" | "epoch" | "task";
}

export interface ExactRepeatHintResult {
  state: ExactRepeatHintState;
  hint?: typeof EXACT_REPEAT_HINT;
}

const REPEAT_RESULT_MAX_BYTES = 24 * 1024;
const REPEAT_ACTION_MAX_BYTES = 4 * 1024;
const REPEAT_EMITTED_MAX = 8;

export function createExactRepeatHintState(taskKey?: string, contextEpoch = 0): ExactRepeatHintState {
  return { ...(taskKey ? { taskKey } : {}), contextEpoch, emitted: [] };
}

function normalizedActionValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizedActionValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, normalizedActionValue(item)]));
  }
  return typeof value === "string" ? value.trim() : value;
}

function normalizedAction(facts: ExchangeFacts): string | undefined {
  try {
    const value = JSON.stringify({
      toolName: facts.toolName,
      input: normalizedActionValue(facts.executedInput ?? facts.originalInput),
    });
    return Buffer.byteLength(value, "utf8") <= REPEAT_ACTION_MAX_BYTES ? value : undefined;
  } catch {
    return undefined;
  }
}

function sameRepeatValue(left: ExactRepeatValue, right: ExactRepeatValue): boolean {
  return left.action === right.action && left.subject === right.subject && left.resultText === right.resultText;
}

function timeSensitive(facts: ExchangeFacts): boolean {
  const name = facts.toolName.toLowerCase();
  if (["wait", "sleep", "poll", "watch", "heartbeat"].some((part) => name.includes(part))) return true;
  if (facts.toolName !== "bash") return false;
  const input = facts.executedInput ?? facts.originalInput;
  const command = input && typeof input === "object" && typeof (input as Record<string, unknown>).command === "string"
    ? (input as Record<string, unknown>).command as string
    : "";
  return /(?:^|[;&|]\s*|\s)(?:sleep|wait|watch|tail\s+-f|while\s+true)\b/i.test(command);
}

/** Clear consecutive-repeat evidence at an explicit structural or evidentiary boundary. */
export function resetExactRepeatHintState(
  state: ExactRepeatHintState,
  context: Pick<ExactRepeatHintContext, "taskKey" | "contextEpoch">,
  clearEmitted = false,
): ExactRepeatHintState {
  return {
    ...(context.taskKey ? { taskKey: context.taskKey } : {}),
    contextEpoch: context.contextEpoch,
    emitted: clearEmitted ? [] : state.emitted.slice(-REPEAT_EMITTED_MAX),
  };
}

/** Observe one final exchange and emit the deterministic hint once after the second exact repeat. */
export function observeExactRepeatHint(
  state: ExactRepeatHintState,
  facts: ExchangeFacts,
  context: ExactRepeatHintContext,
): ExactRepeatHintResult {
  const structuralReset = state.taskKey !== context.taskKey || state.contextEpoch !== context.contextEpoch ||
    context.intervening === "task" || context.intervening === "epoch";
  let current = structuralReset
    ? resetExactRepeatHintState(state, context, true)
    : context.intervening
      ? resetExactRepeatHintState(state, context)
      : { ...state, emitted: state.emitted.slice(-REPEAT_EMITTED_MAX) };
  const action = normalizedAction(facts);
  if (context.userInitiated || facts.toolName === "user_bash" || context.pollingOrTimeSensitive || timeSensitive(facts) ||
    facts.progress.kind === "mutation" || !action || !facts.text || facts.textBytes > REPEAT_RESULT_MAX_BYTES) {
    return { state: resetExactRepeatHintState(current, context) };
  }
  const value: ExactRepeatValue = { action, subject: facts.intent.subjectKey, resultText: facts.text };
  if (!current.candidate || !sameRepeatValue(current.candidate, value)) {
    return { state: { ...current, candidate: { ...value, occurrences: 1 } } };
  }
  const occurrences = current.candidate.occurrences + 1;
  const candidate = { ...value, occurrences };
  const alreadyEmitted = current.emitted.some((item) => sameRepeatValue(item, value));
  if (occurrences < 2 || alreadyEmitted) return { state: { ...current, candidate } };
  current = { ...current, candidate, emitted: [...current.emitted, value].slice(-REPEAT_EMITTED_MAX) };
  return { state: current, hint: EXACT_REPEAT_HINT };
}

export type StallSignature = "repeat-after-hint" | "persistent-error" | "oscillation" | "stale-retrieval";

export interface StallAttempt {
  action: string;
  decisiveObservation: string;
}

function normalizedAttemptText(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 1_024);
}

/** Detect only direct bounded no-progress patterns from the active task and epoch. */
export function detectStallSignature(attempts: readonly StallAttempt[]): StallSignature | undefined {
  const recent = attempts.slice(-4).map((attempt) => ({
    action: normalizedAttemptText(attempt.action),
    decisiveObservation: normalizedAttemptText(attempt.decisiveObservation),
  }));
  if (recent.length >= 4) {
    const [a, b, c, d] = recent;
    if (a.decisiveObservation.startsWith("mutation:") && c.decisiveObservation.startsWith("mutation:") &&
      b.decisiveObservation.startsWith("error:") && d.decisiveObservation === b.decisiveObservation &&
      a.action !== c.action) return "persistent-error";
    if (!recent.some((attempt) => attempt.decisiveObservation.startsWith("mutation:")) &&
      a.action === c.action && b.action === d.action && a.action !== b.action &&
      new Set(recent.map((attempt) => attempt.decisiveObservation)).size === 1) return "oscillation";
  }
  const retrieval = recent.slice(-3);
  if (retrieval.length === 3 && /^(?:read|search|inspect|recall):/.test(retrieval[0].action) &&
    retrieval.every((attempt) => attempt.action === retrieval[0].action &&
      attempt.decisiveObservation === retrieval[0].decisiveObservation)) return "stale-retrieval";
  return undefined;
}

export function hasStrongExactRepeat(state: ExactRepeatHintState): boolean {
  const candidate = state.candidate;
  return candidate !== undefined && candidate.occurrences >= 3 && state.emitted.some((item) =>
    item.action === candidate.action && item.subject === candidate.subject && item.resultText === candidate.resultText
  );
}
