import type { OutcomeSummary } from "./capsule.js";
import {
  TASK_RUNTIME_BOUNDS,
  boundTaskRuntime,
  cloneTaskRuntime,
  suiteGateKey,
  type ActiveDiagnostic,
  type SubjectState,
  type TaskRuntimeV2,
  type ValidationGate,
  type ValidationState,
} from "./runtime.js";
import type { IntentKind, SuiteIdentity } from "./intent.js";

export interface RequirementsSignal {
  revision: number;
  lockDeclared: boolean;
}

export interface WorkflowTestResult {
  revision: number;
  status: "success" | "failure";
  summary: string;
  total: number;
}

export type WorkflowReadiness = "NOT_READY" | "COMMAND_CLEAN" | "STAGE_CLEAN" | "GOAL_READY";

export interface WorkflowState {
  requirementsRevision: number;
  locked: boolean;
  latestTestRevision: number | null;
  latestTestResult: WorkflowTestResult | null;
  cumulativeSuite: WorkflowTestResult | null;
  goalReady: boolean;
  readiness: WorkflowReadiness;
}

export type ToolExecutionMode = "parallel" | "sequential";

export interface TurnIntentFacts {
  kind: IntentKind;
  resources: readonly string[];
  subjectKey: string;
  suite?: SuiteIdentity;
  mutatesWorkspace: boolean;
}

export interface TurnOutcomeFacts {
  isError: boolean;
  outcome: OutcomeSummary;
}

/** Structurally accepts a completed PendingExchange without importing exchange.ts. */
export interface TurnExchangeFacts {
  id?: string;
  toolCallId?: string;
  toolName?: string;
  sourceOrder?: number;
  completed?: boolean;
  intent?: TurnIntentFacts;
  outcome?: TurnOutcomeFacts;
}

export type ValidationClassifier = (exchange: TurnExchangeFacts) => SuiteIdentity | undefined;

export interface ReduceTurnOptions {
  toolExecution: ToolExecutionMode;
  classifyValidation?: ValidationClassifier;
}

export interface ExchangeRevision {
  toolCallId: string;
  workspaceRevisionAtStart: number;
  workspaceRevisionAtResult: number;
}

export interface ReduceTurnResult {
  runtime: TaskRuntimeV2;
  readiness: WorkflowReadiness;
  changed: boolean;
  exchangeRevisions: ExchangeRevision[];
}

const SCOPE_RANK: Record<SuiteIdentity["scope"], number> = {
  focused: 0,
  package: 1,
  broad: 2,
};

function sameSuite(left: SuiteIdentity, right: SuiteIdentity): boolean {
  return left.family === right.family && left.target === right.target && left.scope === right.scope;
}

function validationMatchesGate(validation: ValidationState, gate: ValidationGate): boolean {
  if (gate.suiteFamily !== undefined && validation.suite.family !== gate.suiteFamily) return false;
  if (gate.target !== undefined && validation.suite.target !== gate.target) return false;
  if (gate.suiteFamily !== undefined || gate.target !== undefined) return true;
  return gate.key === suiteGateKey(validation.suite);
}

function currentValidation(runtime: TaskRuntimeV2, validation: ValidationState): boolean {
  return validation.requirementsRevision === runtime.requirementsRevision &&
    validation.workspaceRevision === runtime.workspaceRevision;
}

function gateIsClean(runtime: TaskRuntimeV2, gate: ValidationGate): boolean {
  const matching = runtime.validations
    .filter((validation) => currentValidation(runtime, validation) && validationMatchesGate(validation, gate))
    .sort((left, right) => right.turnSequence - left.turnSequence);
  const success = matching.find((validation) => validation.status === "success");
  if (!success) return false;
  return !matching.some((validation) => validation.status === "failure" && validation.turnSequence > success.turnSequence);
}

/** Derive readiness only from current requirement and workspace revisions. */
export function deriveReadiness(runtime: TaskRuntimeV2): WorkflowReadiness {
  const gatesClean = runtime.validationGates.length > 0 &&
    runtime.validationGates.every((gate) => gateIsClean(runtime, gate));
  if (gatesClean) return runtime.requirementsLocked ? "GOAL_READY" : "STAGE_CLEAN";

  const latestCurrentCommand = runtime.validations
    .filter((validation) => currentValidation(runtime, validation))
    .sort((left, right) => right.turnSequence - left.turnSequence)[0];
  return latestCurrentCommand?.status === "success" ? "COMMAND_CLEAN" : "NOT_READY";
}

function defaultValidation(exchange: TurnExchangeFacts): SuiteIdentity | undefined {
  const intent = exchange.intent;
  if (!intent) return undefined;
  if (intent.suite) return { ...intent.suite };
  if (intent.kind === "build" || intent.kind === "lint") {
    return {
      family: intent.kind,
      target: intent.subjectKey,
      scope: "broad",
    };
  }
  return undefined;
}

function validationSummary(suite: SuiteIdentity, outcome: OutcomeSummary): string {
  return outcome.testSummary ?? outcome.commandFailures[0] ?? outcome.exitStatuses[0] ??
    outcome.signature ?? `${suite.family} ${outcome.status}`;
}

function upsertValidation(validations: readonly ValidationState[], validation: ValidationState): ValidationState[] {
  return [
    validation,
    ...validations.filter((current) => !sameSuite(current.suite, validation.suite)),
  ].slice(0, TASK_RUNTIME_BOUNDS.validations);
}

function gateSuite(runtime: TaskRuntimeV2, gate: ValidationGate): SuiteIdentity | undefined {
  return runtime.validations.find((validation) => validationMatchesGate(validation, gate))?.suite;
}

function shouldReplaceDefaultGate(runtime: TaskRuntimeV2, candidate: ValidationState): boolean {
  const currentGate = runtime.validationGates.find((gate) => gate.source === "default-cumulative");
  if (!currentGate) return true;
  const currentSuite = gateSuite(runtime, currentGate);
  if (!currentSuite) return true;
  const current = runtime.validations.find((validation) => sameSuite(validation.suite, currentSuite));
  if (!current) return true;
  if (candidate.requirementsRevision !== current.requirementsRevision) {
    return candidate.requirementsRevision > current.requirementsRevision;
  }
  if (candidate.workspaceRevision !== current.workspaceRevision) {
    return candidate.workspaceRevision > current.workspaceRevision;
  }
  const scopeDifference = SCOPE_RANK[candidate.suite.scope] - SCOPE_RANK[currentSuite.scope];
  if (scopeDifference !== 0) return scopeDifference > 0;
  if (candidate.suite.family === currentSuite.family && candidate.suite.target === currentSuite.target &&
    candidate.total !== undefined && current.total !== undefined && candidate.total !== current.total) {
    return candidate.total > current.total;
  }
  return candidate.turnSequence >= current.turnSequence;
}

function updateDefaultGate(runtime: TaskRuntimeV2, validation: ValidationState, intent: TurnIntentFacts): void {
  if (intent.kind !== "test" || runtime.validationGates.some((gate) => gate.source === "explicit-user-command")) return;
  if (!shouldReplaceDefaultGate(runtime, validation)) return;
  runtime.validationGates = [{
    key: suiteGateKey(validation.suite),
    suiteFamily: validation.suite.family,
    target: validation.suite.target,
    source: "default-cumulative",
  }];
}

function diagnosticSource(suite: SuiteIdentity): string {
  return `suite:${suite.family}:${suite.scope}:${suite.target}`;
}

function diagnosticId(suite: SuiteIdentity, kind: string, summary: string): string {
  return `${suite.family}:${kind}:${summary}`.slice(0, 320);
}

function failureDiagnostics(
  exchange: TurnExchangeFacts,
  suite: SuiteIdentity,
  workspaceRevision: number,
): ActiveDiagnostic[] {
  const outcome = exchange.outcome?.outcome;
  if (!outcome) return [];
  const source = diagnosticSource(suite);
  const locations = outcome.sourceLocations
    .map((location) => location.trim().replace(/:\d+(?::\d+)?(?:\s.*)?$/, ""))
    .filter((location) => location.length > 0);
  const common = {
    suiteFamily: suite.family,
    subjectKey: exchange.intent?.subjectKey,
    source,
    resources: [...new Set([...locations, ...(exchange.intent?.resources ?? [])])],
    ...(exchange.id === undefined ? {} : { exchangeId: exchange.id }),
    workspaceRevision,
    state: "active" as const,
  };
  const diagnostics: ActiveDiagnostic[] = [
    ...outcome.failingTests.map((summary) => ({
      id: diagnosticId(suite, "test", summary), summary, ...common,
    })),
    ...outcome.exceptions.map((summary) => ({
      id: diagnosticId(suite, "exception", summary), summary, ...common,
    })),
    ...outcome.sourceLocations.map((summary) => ({
      id: diagnosticId(suite, "location", summary), summary, ...common,
    })),
  ];
  if (diagnostics.length === 0) {
    const summary = validationSummary(suite, outcome);
    diagnostics.push({ id: diagnosticId(suite, "failure", summary), summary, ...common });
  }
  return diagnostics;
}

function addDiagnostics(current: readonly ActiveDiagnostic[], additions: readonly ActiveDiagnostic[]): ActiveDiagnostic[] {
  const next = [...current];
  for (const diagnostic of additions) {
    const existing = next.findIndex((candidate) => candidate.id === diagnostic.id);
    if (existing >= 0) next.splice(existing, 1);
    next.unshift(diagnostic);
  }
  return next.slice(0, TASK_RUNTIME_BOUNDS.activeDiagnostics);
}

function diagnosticSuite(source: string | undefined): SuiteIdentity | undefined {
  if (!source?.startsWith("suite:")) return undefined;
  const [, family, scope, ...target] = source.split(":");
  if (!family || !["focused", "package", "broad"].includes(scope) || target.length === 0) return undefined;
  return { family, scope: scope as SuiteIdentity["scope"], target: target.join(":") };
}

function suiteCovers(success: SuiteIdentity, failed: SuiteIdentity): boolean {
  if (success.family !== failed.family) return false;
  if (success.scope === "broad") return true;
  if (SCOPE_RANK[success.scope] < SCOPE_RANK[failed.scope]) return false;
  if (success.target === "all" || success.target === failed.target) return true;
  return failed.target.split("|").some((target) =>
    target === success.target || target.startsWith(`${success.target}/`)
  );
}

function clearDiagnosticsForSuccess(
  current: readonly ActiveDiagnostic[],
  suite: SuiteIdentity,
): ActiveDiagnostic[] {
  return current.filter((diagnostic) => {
    const failedSuite = diagnosticSuite(diagnostic.source);
    return !failedSuite || !suiteCovers(suite, failedSuite);
  });
}

function awaitRerun(diagnostics: readonly ActiveDiagnostic[]): ActiveDiagnostic[] {
  return diagnostics.map((diagnostic) => ({ ...diagnostic, state: "awaiting-rerun" }));
}

function upsertModifiedResource(
  resources: readonly { path: string; revision: number }[],
  path: string,
  revision: number,
): Array<{ path: string; revision: number }> {
  return [
    { path, revision },
    ...resources.filter((resource) => resource.path !== path),
  ].slice(0, TASK_RUNTIME_BOUNDS.modifiedResources);
}

function mutationResources(exchange: TurnExchangeFacts): string[] {
  const resources = [...(exchange.intent?.resources ?? [])];
  if (resources.length > 0) return [...new Set(resources)];
  return [`(workspace changed by ${exchange.toolName ?? exchange.intent?.kind ?? "tool"})`];
}

function intentKey(intent: TurnIntentFacts): string {
  return `${intent.kind}:${intent.subjectKey}`;
}

function updateSubject(
  runtime: TaskRuntimeV2,
  exchange: TurnExchangeFacts,
  workspaceRevision: number,
  turnSequence: number,
): void {
  const intent = exchange.intent;
  const outcome = exchange.outcome?.outcome;
  if (!intent || !outcome) return;
  const key = intentKey(intent);
  const subject: SubjectState = {
    subjectKey: intent.subjectKey,
    intentKind: intent.kind,
    intentKey: key,
    resources: [...intent.resources],
    ...(exchange.id === undefined ? {} : { exchangeId: exchange.id }),
    outcomeStatus: outcome.status,
    workspaceRevision,
    turnSequence,
  };
  runtime.recentSubjects = [
    subject,
    ...runtime.recentSubjects.filter((current) => current.subjectKey !== subject.subjectKey),
  ].slice(0, TASK_RUNTIME_BOUNDS.recentSubjects);
  runtime.recentIntentKeys = [
    key,
    ...runtime.recentIntentKeys.filter((current) => current !== key),
  ].slice(0, TASK_RUNTIME_BOUNDS.recentIntentKeys);
}

function successfulMutation(exchange: TurnExchangeFacts): boolean {
  return Boolean(exchange.intent?.mutatesWorkspace && exchange.outcome && !exchange.outcome.isError &&
    exchange.outcome.outcome.status !== "failure");
}

function reduceValidation(
  runtime: TaskRuntimeV2,
  exchange: TurnExchangeFacts,
  suite: SuiteIdentity,
  workspaceRevision: number,
  turnSequence: number,
): void {
  const outcome = exchange.outcome?.outcome;
  if (!outcome || outcome.status === "unknown") return;
  const status = exchange.outcome?.isError ? "failure" : outcome.status;
  const validation: ValidationState = {
    suite: { ...suite },
    status,
    summary: validationSummary(suite, outcome),
    ...(outcome.testTotal === null ? {} : { total: outcome.testTotal }),
    requirementsRevision: runtime.requirementsRevision,
    workspaceRevision,
    turnSequence,
  };
  runtime.validations = upsertValidation(runtime.validations, validation);
  updateDefaultGate(runtime, validation, exchange.intent!);
  if (status === "success") {
    runtime.activeDiagnostics = clearDiagnosticsForSuccess(runtime.activeDiagnostics, suite);
  } else {
    runtime.activeDiagnostics = addDiagnostics(
      runtime.activeDiagnostics,
      failureDiagnostics(exchange, suite, workspaceRevision),
    );
  }
}

/**
 * Commit one completed tool batch in source order. The input snapshot is never
 * mutated. Parallel validations observe the base workspace revision; sequential
 * validations observe all earlier successful mutations in the batch.
 */
export function reduceTurn(
  runtime: TaskRuntimeV2,
  exchanges: readonly TurnExchangeFacts[],
  options: ReduceTurnOptions,
): ReduceTurnResult {
  const next = cloneTaskRuntime(runtime);
  const turnSequence = runtime.turnSequence + 1;
  next.turnSequence = turnSequence;
  const ordered = exchanges
    .map((exchange, index) => ({ exchange, index }))
    .filter(({ exchange }) => exchange.completed !== false && exchange.intent && exchange.outcome)
    .sort((left, right) => (left.exchange.sourceOrder ?? left.index) - (right.exchange.sourceOrder ?? right.index))
    .map(({ exchange }) => exchange);
  const classify = options.classifyValidation ?? defaultValidation;
  const exchangeRevisions: ExchangeRevision[] = [];

  if (options.toolExecution === "parallel") {
    const baseRevision = runtime.workspaceRevision;
    let mutated = false;
    const mutations: TurnExchangeFacts[] = [];
    for (const exchange of ordered) {
      updateSubject(next, exchange, successfulMutation(exchange) ? baseRevision + 1 : baseRevision, turnSequence);
      const suite = classify(exchange);
      if (suite) reduceValidation(next, exchange, suite, baseRevision, turnSequence);
      if (successfulMutation(exchange)) {
        mutated = true;
        mutations.push(exchange);
      }
      if (exchange.toolCallId) {
        exchangeRevisions.push({
          toolCallId: exchange.toolCallId,
          workspaceRevisionAtStart: baseRevision,
          workspaceRevisionAtResult: baseRevision,
        });
      }
    }
    if (mutated) {
      next.workspaceRevision = baseRevision + 1;
      next.activeDiagnostics = awaitRerun(next.activeDiagnostics);
      for (const exchange of mutations) {
        for (const path of mutationResources(exchange)) {
          next.modifiedResources = upsertModifiedResource(next.modifiedResources, path, next.workspaceRevision);
        }
      }
    }
  } else {
    let workspaceRevision = runtime.workspaceRevision;
    for (const exchange of ordered) {
      const workspaceRevisionAtStart = workspaceRevision;
      if (successfulMutation(exchange)) {
        workspaceRevision += 1;
        next.workspaceRevision = workspaceRevision;
        next.activeDiagnostics = awaitRerun(next.activeDiagnostics);
        for (const path of mutationResources(exchange)) {
          next.modifiedResources = upsertModifiedResource(next.modifiedResources, path, workspaceRevision);
        }
      }
      updateSubject(next, exchange, workspaceRevision, turnSequence);
      const suite = classify(exchange);
      if (suite) reduceValidation(next, exchange, suite, workspaceRevision, turnSequence);
      if (exchange.toolCallId) {
        exchangeRevisions.push({
          toolCallId: exchange.toolCallId,
          workspaceRevisionAtStart,
          workspaceRevisionAtResult: workspaceRevision,
        });
      }
    }
  }

  const bounded = boundTaskRuntime(next);
  return {
    runtime: bounded,
    readiness: deriveReadiness(bounded),
    changed: true,
    exchangeRevisions,
  };
}

export function isRequirementsLockDeclaration(text: string): boolean {
  return /^\s*REQUIREMENTS LOCKED(?:[.!:]|$)/i.test(text);
}

export type {
  ActiveDiagnostic,
  SubjectState,
  TaskRuntimeV2,
  ValidationGate,
  ValidationState,
};
