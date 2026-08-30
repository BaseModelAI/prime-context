import { truncateUtf8, type OutcomeSummary } from "./capsule.js";
import type { IntentKind, SuiteIdentity, SuiteScope } from "./intent.js";

export const TASK_RUNTIME_SCHEMA = "prime-context.runtime/v2" as const;

export const TASK_RUNTIME_BOUNDS = Object.freeze({
  validationGates: 8,
  validations: 16,
  activeDiagnostics: 12,
  modifiedResources: 32,
  recentSubjects: 32,
  recentIntentKeys: 16,
  steeringResources: 32,
  steeringResourcePathBytes: 1024,
  steeringResourcesBytes: 8192,
  foldRetainedEntryIds: 256,
  foldRenderedBytes: 4096,
  steeringDeltaBytes: 8192,
  suiteFamilyBytes: 128,
  suiteTargetBytes: 1024,
  identityBytes: 1024,
  summaryBytes: 2048,
  resourcePathBytes: 1024,
});

export interface ValidationState {
  suite: SuiteIdentity;
  status: "success" | "failure";
  summary: string;
  total?: number;
  requirementsRevision: number;
  workspaceRevision: number;
  turnSequence: number;
}

export interface ValidationGate {
  key: string;
  suiteFamily?: string;
  target?: string;
  source: "explicit-user-command" | "default-cumulative";
}

export interface ActiveDiagnostic {
  id: string;
  summary: string;
  suiteFamily?: string;
  subjectKey?: string;
  source?: string;
  resources: string[];
  exchangeId?: string;
  workspaceRevision: number;
  state: "active" | "awaiting-rerun";
}

export interface SubjectState {
  subjectKey: string;
  intentKind: IntentKind;
  intentKey: string;
  resources: string[];
  exchangeId?: string;
  outcomeStatus: OutcomeSummary["status"];
  workspaceRevision: number;
  turnSequence: number;
}

export interface SteeringResource {
  path: string;
  userEntryId: string;
  requirementsRevision: number;
}

export interface FoldState {
  generation: number;
  throughEntryId: string;
  retainedEntryIds: string[];
  renderedMessage: string;
}

export interface TaskRuntimeV2 {
  schema: typeof TASK_RUNTIME_SCHEMA;
  taskKey: string;
  goalId?: string;
  objective?: string;
  objectiveVersion: number;
  requirementsRevision: number;
  requirementsLocked: boolean;
  workspaceRevision: number;
  turnSequence: number;
  validationGates: ValidationGate[];
  validations: ValidationState[];
  activeDiagnostics: ActiveDiagnostic[];
  modifiedResources: Array<{ path: string; revision: number }>;
  recentSubjects: SubjectState[];
  recentIntentKeys: string[];
  steeringDeltas: string[];
  steeringResources: SteeringResource[];
  lastProcessedUserEntryId?: string;
  fold?: FoldState;
}

export interface RuntimeBranchEntry {
  id?: string;
  entryId?: string;
  type: string;
  message?: unknown;
}

export interface ActiveGoalSelection {
  goalId: string;
  objective?: string;
  status?: string;
}

export interface TaskSelection {
  taskKey: string;
  goalId?: string;
  objective?: string;
  rootUserEntryId?: string;
  source: "goal" | "user";
}

export interface SteeringEntry {
  id: string;
  text: string;
}

export type AcceptanceGateCandidate =
  | SuiteIdentity
  | Omit<ValidationGate, "source">;

/**
 * Return undefined when the steering does not discuss acceptance commands.
 * Return an array (including an empty array for explicit removal) to replace
 * the current explicit gates.
 */
export type AcceptanceGateClassifier = (
  text: string,
  currentExplicitGates: readonly ValidationGate[],
) => readonly AcceptanceGateCandidate[] | undefined;

export interface RequirementDelta extends SteeringEntry {
  material?: boolean;
  lockDeclared?: boolean;
  acceptanceGates?: readonly AcceptanceGateCandidate[];
  replaceExplicitGates?: boolean;
}

export interface TaskContractUpdate {
  objective?: string;
  userEntries?: readonly SteeringEntry[];
  steeringBudgetBytes?: number;
}

export interface TaskRuntimeUpdateResult {
  runtime: TaskRuntimeV2;
  changed: boolean;
  materialDeltaCount: number;
  acceptanceGatesChanged: boolean;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function messageRole(entry: RuntimeBranchEntry): string | undefined {
  return record(entry.message)?.role as string | undefined;
}

function entryId(entry: RuntimeBranchEntry, index: number): string {
  return entry.id ?? entry.entryId ?? `user:${index}`;
}

function isCompletedAssistant(entry: RuntimeBranchEntry): boolean {
  const message = record(entry.message);
  return entry.type === "message" && message?.role === "assistant" && message.stopReason === "stop";
}

/** Select the active goal, or the root user entry of the current unfinished task. */
export function deriveTaskSelection(
  branch: readonly RuntimeBranchEntry[],
  activeGoal?: ActiveGoalSelection | null,
): TaskSelection | undefined {
  if (activeGoal?.goalId && activeGoal.status !== "completed" && activeGoal.status !== "cancelled") {
    return {
      taskKey: activeGoal.goalId,
      goalId: activeGoal.goalId,
      ...(activeGoal.objective === undefined ? {} : { objective: activeGoal.objective }),
      source: "goal",
    };
  }

  let rootIndex = branch.findIndex((entry) => entry.type === "message" && messageRole(entry) === "user");
  if (rootIndex < 0) return undefined;
  for (let index = 0; index < branch.length; index += 1) {
    if (!isCompletedAssistant(branch[index])) continue;
    const nextUser = branch.findIndex((entry, candidate) =>
      candidate > index && entry.type === "message" && messageRole(entry) === "user");
    if (nextUser >= 0) rootIndex = nextUser;
  }
  const rootUserEntryId = entryId(branch[rootIndex], rootIndex);
  return {
    taskKey: rootUserEntryId,
    rootUserEntryId,
    source: "user",
  };
}

export function createTaskRuntime(selection: TaskSelection): TaskRuntimeV2 {
  return {
    schema: TASK_RUNTIME_SCHEMA,
    taskKey: selection.taskKey,
    ...(selection.goalId === undefined ? {} : { goalId: selection.goalId }),
    ...(selection.objective === undefined ? {} : { objective: selection.objective }),
    objectiveVersion: selection.objective === undefined ? 0 : 1,
    requirementsRevision: 0,
    requirementsLocked: false,
    workspaceRevision: 0,
    turnSequence: 0,
    validationGates: [],
    validations: [],
    activeDiagnostics: [],
    modifiedResources: [],
    recentSubjects: [],
    recentIntentKeys: [],
    steeringDeltas: [],
    steeringResources: [],
  };
}

export function suiteGateKey(suite: Pick<SuiteIdentity, "family" | "target">): string {
  return `suite:${suite.family}:${suite.target}`;
}

function isSuiteIdentity(value: AcceptanceGateCandidate): value is SuiteIdentity {
  return "family" in value && "scope" in value;
}

function normalizeGate(candidate: AcceptanceGateCandidate): ValidationGate | undefined {
  if (isSuiteIdentity(candidate)) {
    if (!candidate.family || !candidate.target) return undefined;
    return {
      key: suiteGateKey(candidate),
      suiteFamily: candidate.family,
      target: candidate.target,
      source: "explicit-user-command",
    };
  }
  if (!candidate.key) return undefined;
  return {
    key: candidate.key,
    ...(candidate.suiteFamily === undefined ? {} : { suiteFamily: candidate.suiteFamily }),
    ...(candidate.target === undefined ? {} : { target: candidate.target }),
    source: "explicit-user-command",
  };
}

function sameGate(left: ValidationGate, right: ValidationGate): boolean {
  return left.key === right.key && left.suiteFamily === right.suiteFamily && left.target === right.target && left.source === right.source;
}

function normalizedExplicitGates(candidates: readonly AcceptanceGateCandidate[]): ValidationGate[] {
  const gates: ValidationGate[] = [];
  for (const candidate of candidates) {
    const gate = normalizeGate(candidate);
    if (!gate || gates.some((current) => current.key === gate.key)) continue;
    gates.push(gate);
  }
  return gates.slice(0, TASK_RUNTIME_BOUNDS.validationGates);
}

function equalGates(left: readonly ValidationGate[], right: readonly ValidationGate[]): boolean {
  return left.length === right.length && left.every((gate, index) => sameGate(gate, right[index]));
}

export function isRequirementsLockDeclaration(text: string): boolean {
  return /^\s*REQUIREMENTS LOCKED(?:[.!:]|$)/i.test(text);
}

/** Conservative semantic filter: only known non-contract chatter is ignored. */
export function isMaterialSteering(text: string): boolean {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return false;
  if (isRequirementsLockDeclaration(normalized)) return true;
  if (/^(?:ok(?:ay)?|thanks?|thank you|got it|sounds good|great|yes|no)[.!]*$/i.test(normalized)) return false;
  if (/^(?:continue|proceed|go on|keep going|resume)[.!]*$/i.test(normalized)) return false;
  if (/^(?:status|status update|any update|what(?:'s| is) the status|how is it going)\??$/i.test(normalized)) return false;
  if (/^(?:no (?:change|changes) to (?:the )?requirements|requirements (?:are )?unchanged|same requirements)[.!]*$/i.test(normalized)) return false;
  const question = /^(?:what|which|how|where|when|why|is|are|do|does|did|can|could|would|will)\b.*\?$/i.test(normalized);
  const contractChange = /\b(?:add|change|remove|drop|replace|implement|support|preserve|reject|require|required|must|only|protect|acceptance|constraint|API|path|file)\b/i.test(normalized);
  if (question && !contractChange) return false;
  return true;
}

function normalizeSteeringPath(value: string): string | undefined {
  const trimmed = value.trim()
    .replace(/^[`'"(<]+|[`'">),;:.]+$/g, "")
    .replace(/:\d+(?::\d+)?$/, "");
  if (!trimmed || /^(?:https?|file):\/\//i.test(trimmed) || /\s/.test(trimmed)) return undefined;
  const pathLike = trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../") ||
    trimmed.includes("/") || /(?:^|\.)[A-Za-z0-9_-]+\.[A-Za-z0-9*?_-]+$/.test(trimmed) ||
    /^(?:README|Dockerfile|Makefile|LICENSE)(?:\.[A-Za-z0-9_-]+)?$/i.test(trimmed);
  if (!pathLike || !/[A-Za-z0-9*?]/.test(trimmed)) return undefined;
  const normalized = trimmed.startsWith("./") ? trimmed.slice(2) : trimmed;
  return Buffer.byteLength(normalized, "utf8") <= TASK_RUNTIME_BOUNDS.steeringResourcePathBytes
    ? normalized
    : undefined;
}

/** Extract only path-shaped literals present in committed material user steering. */
export function explicitSteeringPaths(text: string): string[] {
  const candidates = [
    ...[...text.matchAll(/[`'"]([^`'"\n]+)[`'"]/g)].map((match) => match[1]),
    ...text.split(/\s+/),
  ];
  const paths: string[] = [];
  for (const candidate of candidates) {
    const normalized = normalizeSteeringPath(candidate);
    if (!normalized || paths.includes(normalized)) continue;
    paths.push(normalized);
  }
  return paths;
}

function cloneSuite(suite: SuiteIdentity): SuiteIdentity {
  return { family: suite.family, target: suite.target, scope: suite.scope };
}

export function cloneTaskRuntime(runtime: TaskRuntimeV2): TaskRuntimeV2 {
  return {
    ...runtime,
    validationGates: runtime.validationGates.map((gate) => ({ ...gate })),
    validations: runtime.validations.map((validation) => ({ ...validation, suite: cloneSuite(validation.suite) })),
    activeDiagnostics: runtime.activeDiagnostics.map((diagnostic) => ({
      ...diagnostic,
      resources: [...(diagnostic.resources ?? [])],
    })),
    modifiedResources: runtime.modifiedResources.map((resource) => ({ ...resource })),
    recentSubjects: runtime.recentSubjects.map((subject) => ({ ...subject, resources: [...subject.resources] })),
    recentIntentKeys: [...runtime.recentIntentKeys],
    steeringDeltas: [...runtime.steeringDeltas],
    steeringResources: (runtime.steeringResources ?? []).map((resource) => ({ ...resource })),
    ...(runtime.fold === undefined ? {} : {
      fold: {
        ...runtime.fold,
        retainedEntryIds: [...runtime.fold.retainedEntryIds],
      },
    }),
  };
}

function boundedSteering(deltas: readonly string[], budgetBytes: number): string[] {
  const budget = Math.max(0, Math.floor(budgetBytes));
  const kept: string[] = [];
  let bytes = 0;
  for (let index = deltas.length - 1; index >= 0; index -= 1) {
    const delta = deltas[index];
    const size = Buffer.byteLength(delta, "utf8");
    if (size > budget || bytes + size > budget) continue;
    kept.push(delta);
    bytes += size;
  }
  return kept.reverse();
}

function boundedSteeringResources(
  resources: readonly SteeringResource[],
  budgetBytes: number,
): SteeringResource[] {
  const budget = Math.max(0, Math.min(TASK_RUNTIME_BOUNDS.steeringResourcesBytes, Math.floor(budgetBytes)));
  const kept: SteeringResource[] = [];
  let bytes = 0;
  for (const resource of resources) {
    const size = Buffer.byteLength(resource.path, "utf8");
    if (size === 0 || size > TASK_RUNTIME_BOUNDS.steeringResourcePathBytes || bytes + size > budget) continue;
    kept.push({ ...resource });
    bytes += size;
    if (kept.length >= TASK_RUNTIME_BOUNDS.steeringResources) break;
  }
  return kept;
}

function boundedValidationGate(gate: ValidationGate): ValidationGate {
  const suiteFamily = gate.suiteFamily === undefined
    ? undefined
    : truncateUtf8(gate.suiteFamily, TASK_RUNTIME_BOUNDS.suiteFamilyBytes);
  const target = gate.target === undefined
    ? undefined
    : truncateUtf8(gate.target, TASK_RUNTIME_BOUNDS.suiteTargetBytes);
  return {
    ...gate,
    key: suiteFamily && target
      ? `suite:${suiteFamily}:${target}`
      : truncateUtf8(gate.key, TASK_RUNTIME_BOUNDS.suiteFamilyBytes + TASK_RUNTIME_BOUNDS.suiteTargetBytes + 16),
    ...(suiteFamily === undefined ? {} : { suiteFamily }),
    ...(target === undefined ? {} : { target }),
  };
}

function boundedSuiteIdentity(suite: SuiteIdentity): SuiteIdentity {
  return {
    ...suite,
    family: truncateUtf8(suite.family, TASK_RUNTIME_BOUNDS.suiteFamilyBytes),
    target: truncateUtf8(suite.target, TASK_RUNTIME_BOUNDS.suiteTargetBytes),
  };
}

export function boundTaskRuntime(
  runtime: TaskRuntimeV2,
  steeringBudgetBytes: number = TASK_RUNTIME_BOUNDS.steeringDeltaBytes,
): TaskRuntimeV2 {
  const bounded = cloneTaskRuntime(runtime);
  bounded.validationGates = bounded.validationGates.slice(0, TASK_RUNTIME_BOUNDS.validationGates)
    .map(boundedValidationGate);
  bounded.validations = bounded.validations.slice(0, TASK_RUNTIME_BOUNDS.validations).map((validation) => ({
    ...validation,
    suite: boundedSuiteIdentity(validation.suite),
    summary: truncateUtf8(validation.summary, TASK_RUNTIME_BOUNDS.summaryBytes),
  }));
  bounded.activeDiagnostics = bounded.activeDiagnostics.slice(0, TASK_RUNTIME_BOUNDS.activeDiagnostics)
    .map((diagnostic) => ({
      ...diagnostic,
      id: truncateUtf8(diagnostic.id, TASK_RUNTIME_BOUNDS.identityBytes),
      summary: truncateUtf8(diagnostic.summary, TASK_RUNTIME_BOUNDS.summaryBytes),
      ...(diagnostic.suiteFamily === undefined ? {} : {
        suiteFamily: truncateUtf8(diagnostic.suiteFamily, TASK_RUNTIME_BOUNDS.suiteFamilyBytes),
      }),
      ...(diagnostic.subjectKey === undefined ? {} : {
        subjectKey: truncateUtf8(diagnostic.subjectKey, TASK_RUNTIME_BOUNDS.identityBytes),
      }),
      resources: diagnostic.resources.slice(0, TASK_RUNTIME_BOUNDS.modifiedResources)
        .map((resource) => truncateUtf8(resource, TASK_RUNTIME_BOUNDS.resourcePathBytes)),
    }));
  bounded.modifiedResources = bounded.modifiedResources.slice(0, TASK_RUNTIME_BOUNDS.modifiedResources)
    .map((resource) => ({
      ...resource,
      path: truncateUtf8(resource.path, TASK_RUNTIME_BOUNDS.resourcePathBytes),
    }));
  bounded.recentSubjects = bounded.recentSubjects.slice(0, TASK_RUNTIME_BOUNDS.recentSubjects)
    .map((subject) => ({
      ...subject,
      subjectKey: truncateUtf8(subject.subjectKey, TASK_RUNTIME_BOUNDS.identityBytes),
      intentKey: truncateUtf8(subject.intentKey, TASK_RUNTIME_BOUNDS.identityBytes),
      resources: subject.resources.slice(0, TASK_RUNTIME_BOUNDS.modifiedResources)
        .map((resource) => truncateUtf8(resource, TASK_RUNTIME_BOUNDS.resourcePathBytes)),
    }));
  bounded.recentIntentKeys = bounded.recentIntentKeys.slice(0, TASK_RUNTIME_BOUNDS.recentIntentKeys)
    .map((key) => truncateUtf8(key, TASK_RUNTIME_BOUNDS.identityBytes));
  bounded.steeringResources = boundedSteeringResources(bounded.steeringResources, steeringBudgetBytes);
  bounded.steeringDeltas = boundedSteering(bounded.steeringDeltas, steeringBudgetBytes);
  return bounded;
}

export function applyRequirementDeltas(
  runtime: TaskRuntimeV2,
  deltas: readonly RequirementDelta[],
  steeringBudgetBytes: number = TASK_RUNTIME_BOUNDS.steeringDeltaBytes,
): TaskRuntimeUpdateResult {
  const next = cloneTaskRuntime(runtime);
  let changed = false;
  let materialDeltaCount = 0;
  let acceptanceGatesChanged = false;

  for (const delta of deltas) {
    if (next.lastProcessedUserEntryId === delta.id) continue;
    const material = delta.material ?? isMaterialSteering(delta.text);
    const lockDeclared = delta.lockDeclared ?? isRequirementsLockDeclaration(delta.text);
    if (material) {
      next.requirementsRevision += 1;
      next.steeringDeltas.push(delta.text);
      for (const path of explicitSteeringPaths(delta.text)) {
        next.steeringResources = [
          { path, userEntryId: delta.id, requirementsRevision: next.requirementsRevision },
          ...next.steeringResources.filter((resource) => resource.path !== path),
        ].slice(0, TASK_RUNTIME_BOUNDS.steeringResources);
      }
      materialDeltaCount += 1;
      changed = true;
    }
    if (lockDeclared && !next.requirementsLocked) {
      next.requirementsLocked = true;
      changed = true;
    }
    if (delta.acceptanceGates !== undefined && delta.replaceExplicitGates !== false) {
      const replacement = normalizedExplicitGates(delta.acceptanceGates);
      if (!equalGates(next.validationGates, replacement)) {
        next.validationGates = replacement;
        acceptanceGatesChanged = true;
        changed = true;
      }
    } else if (delta.acceptanceGates !== undefined) {
      const additions = normalizedExplicitGates(delta.acceptanceGates);
      const merged = [
        ...next.validationGates.filter((gate) => gate.source === "explicit-user-command"),
        ...additions,
      ].filter((gate, index, all) => all.findIndex((candidate) => candidate.key === gate.key) === index)
        .slice(0, TASK_RUNTIME_BOUNDS.validationGates);
      if (!equalGates(next.validationGates, merged)) {
        next.validationGates = merged;
        acceptanceGatesChanged = true;
        changed = true;
      }
    }
    next.lastProcessedUserEntryId = delta.id;
    changed = true;
  }

  return {
    runtime: boundTaskRuntime(next, steeringBudgetBytes),
    changed,
    materialDeltaCount,
    acceptanceGatesChanged,
  };
}

/** Preview one not-yet-persisted prompt without advancing the branch cursor. */
export function previewTaskContract(
  runtime: TaskRuntimeV2,
  text: string,
  classifyAcceptanceGates?: AcceptanceGateClassifier,
): TaskRuntimeUpdateResult {
  const next = cloneTaskRuntime(runtime);
  let changed = false;
  let materialDeltaCount = 0;
  let acceptanceGatesChanged = false;
  if (isMaterialSteering(text)) {
    next.requirementsRevision += 1;
    next.steeringDeltas.push(text);
    changed = true;
    materialDeltaCount = 1;
  }
  if (isRequirementsLockDeclaration(text) && !next.requirementsLocked) {
    next.requirementsLocked = true;
    changed = true;
  }
  const classified = classifyAcceptanceGates?.(
    text,
    next.validationGates.filter((gate) => gate.source === "explicit-user-command"),
  );
  if (classified !== undefined) {
    const replacement = normalizedExplicitGates(classified);
    if (!equalGates(next.validationGates, replacement)) {
      next.validationGates = replacement;
      acceptanceGatesChanged = true;
      changed = true;
    }
  }
  return {
    runtime: boundTaskRuntime(next),
    changed,
    materialDeltaCount,
    acceptanceGatesChanged,
  };
}

/** Apply an objective update and all branch user entries after the runtime cursor. */
export function updateTaskContract(
  runtime: TaskRuntimeV2,
  update: TaskContractUpdate,
  classifyAcceptanceGates?: AcceptanceGateClassifier,
): TaskRuntimeUpdateResult {
  let next = cloneTaskRuntime(runtime);
  let changed = false;
  let materialDeltaCount = 0;
  let acceptanceGatesChanged = false;

  if (update.objective !== undefined && update.objective !== next.objective) {
    next.objective = update.objective;
    next.objectiveVersion += 1;
    next.requirementsRevision += 1;
    changed = true;
    materialDeltaCount += 1;
  }

  const entries = update.userEntries ?? [];
  let start = 0;
  if (next.lastProcessedUserEntryId !== undefined) {
    const cursor = entries.findIndex((entry) => entry.id === next.lastProcessedUserEntryId);
    if (cursor >= 0) start = cursor + 1;
  }
  const deltas: RequirementDelta[] = [];
  for (const entry of entries.slice(start)) {
    const classified = classifyAcceptanceGates?.(
      entry.text,
      next.validationGates.filter((gate) => gate.source === "explicit-user-command"),
    );
    deltas.push({
      ...entry,
      ...(classified === undefined ? {} : {
        acceptanceGates: classified,
        replaceExplicitGates: true,
      }),
    });
  }
  if (deltas.length > 0) {
    const result = applyRequirementDeltas(next, deltas, update.steeringBudgetBytes);
    next = result.runtime;
    changed ||= result.changed;
    materialDeltaCount += result.materialDeltaCount;
    acceptanceGatesChanged ||= result.acceptanceGatesChanged;
  }

  return {
    runtime: boundTaskRuntime(next, update.steeringBudgetBytes),
    changed,
    materialDeltaCount,
    acceptanceGatesChanged,
  };
}

export type { IntentKind, SuiteIdentity, SuiteScope };
