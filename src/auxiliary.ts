import { completeSimple } from "@earendil-works/pi-ai";
import type {
  Api,
  AssistantMessage,
  Context,
  Model,
  SimpleStreamOptions,
  Usage,
} from "@earendil-works/pi-ai";
import { truncateUtf8, utf8Bytes } from "./capsule.js";

export type AuxiliaryKind =
  | "semantic-distill"
  | "task-scout"
  | "stall-recovery"
  | "knowledge-compile";

export const AUXILIARY_BOUNDS = {
  minBenefitRatio: 1.5,
  maxBlockingCallsPerTurn: 1,
  maxBlockingCallsPerTask: 3,
  maxScoutCallsPerTask: 1,
  maxStallCallsPerTask: 1,
  maxDistillCallsPerTurn: 1,
  maxDistillCallsPerTask: 3,
  maxInputTokens: 12_000,
  scoutOutputTokens: 350,
  distillOutputTokens: 700,
  stallOutputTokens: 220,
  learnOutputTokens: 2_000,
} as const;

export const DEFAULT_AUXILIARY_TIMEOUT_MS = 45_000;

export interface CompactTaskPacket {
  objective?: string;
  explicitConstraints: readonly string[];
  focus?: string;
  openItems: readonly string[];
  decisiveObservations: readonly string[];
}

export interface RecoveryCoordinate {
  ref: string;
  part: string;
  range?: string;
}

export interface CompactSkillCatalogEntry {
  name: string;
  description: string;
  triggers: readonly string[];
  requiredTools: readonly string[];
}

export interface SemanticDistillInput {
  task: CompactTaskPacket;
  tool: string;
  subject: string;
  deterministicCapsule: string;
  rawResult: string;
  availableRecovery: readonly RecoveryCoordinate[];
}

export interface SemanticCapsuleOutput {
  decisiveFacts: string[];
  relationships: string[];
  unresolvedOrAmbiguous: string[];
  sourceAnchors: string[];
}

export interface TaskScoutInput {
  task: CompactTaskPacket;
  availableTools: readonly string[];
  skillCatalog: readonly CompactSkillCatalogEntry[];
  libraryRevision?: string;
}

export interface TaskScoutOutput {
  selectedSkillNames: string[];
  initialStrategy: string[];
  attentionPoints: string[];
}

export interface StallRecoveryInput {
  task: CompactTaskPacket;
  selectedSkills: readonly string[];
  availableTools: readonly string[];
  recentAttempts: readonly {
    action: string;
    decisiveObservation: string;
  }[];
}

export interface StallRecoveryOutput {
  diagnosis: string;
  nextAction: string;
  assumptionToDrop?: string;
}

export type TaskOutcome = "success" | "failure" | "unknown";

export interface KnowledgeEpisodePacket {
  task: string;
  taskOutcome: TaskOutcome;
  evidence: string;
}

export interface ExistingKnowledgePairPacket {
  name: string;
  patternMarkdown: string;
  skillMarkdown: string;
}

export interface KnowledgeCompileInput {
  topic: string;
  automatic: boolean;
  episodes: readonly KnowledgeEpisodePacket[];
  existingPairs: readonly ExistingKnowledgePairPacket[];
}

export type KnowledgeCompilation =
  | { action: "none" }
  | {
      action: "upsert";
      name: string;
      patternMarkdown: string;
      skillMarkdown: string;
    };

export interface AuxiliaryPlan {
  kind: AuxiliaryKind;
  model: Model<Api>;
  blocking: boolean;
  estimatedInputTokens: number;
  maxOutputTokens: number;
  estimatedPromptTokensSaved: number;
  estimatedMainTurnsAvoided: number;
  estimatedToolCallsAvoided: number;
  completionRisk: "low" | "medium" | "high";
  estimatedCriticalPathMsSaved: number;
  estimatedAuxiliaryLatencyMs: number;
  /** Optional factual override when the caller has a better recent estimate. */
  estimatedAuxiliaryCost?: number;
}

export interface AuxiliaryDecision {
  run: boolean;
  reason: string;
  estimatedCost?: number;
  estimatedBenefit?: number;
}

export interface AuxiliaryEconomics {
  /** Provider price in currency units per million input tokens. */
  currentMainInputUnitCost?: number;
  /** Provider price in currency units per million output tokens. */
  currentMainOutputUnitCost?: number;
  recentMeanSolverCallCost?: number;
  recentMeanToolCost?: number;
  recentMeanSolverLatencyMs?: number;
  recentMeanToolLatencyMs?: number;
  latestProviderInputTokens?: number;
  conservativeMainOutputTokens?: number;
}

export interface AuxiliaryKindAccounting {
  callsAttempted: number;
  callsCompleted: number;
  callsFailed: number;
  malformedOutputs: number;
  timedOut: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cost: number;
  latencyMs: number;
}

export interface AuxiliaryAccounting {
  byKind: Record<AuxiliaryKind, AuxiliaryKindAccounting>;
  zeroCallTasks: number;
}

export interface AuxiliaryTaskState {
  taskKey?: string;
  turnKey?: string;
  scoutCalls: number;
  stallCalls: number;
  distillCalls: number;
  knowledgeCalls: number;
  blockingCalls: number;
  turnBlockingCalls: number;
  turnDistillCalls: number;
  callsAttempted: number;
  inFlight?: AuxiliaryKind;
  taskFinalized: boolean;
}

export interface AuxiliaryRuntime {
  enabled: boolean;
  task: AuxiliaryTaskState;
  economics: AuxiliaryEconomics;
  accounting: AuxiliaryAccounting;
}

export interface AuxiliaryPrompt {
  kind: AuxiliaryKind;
  systemPrompt: string;
  userPrompt: string;
  context: Context;
  maxOutputTokens: number;
  estimatedInputTokens: number;
}

export interface AuxiliaryRequestAuth {
  apiKey?: string;
  headers?: Record<string, string>;
}

export interface ResolvedAuxiliaryModel extends AuxiliaryRequestAuth {
  model: Model<Api>;
  source: "configured" | "current";
  selector?: string;
}

export interface AuxiliaryModelConfig {
  auxiliaryModel: string | null;
  learningModel?: string | null;
}

export interface AuxiliaryModelResolutionHooks {
  currentModel(): Model<Api> | undefined;
  resolveModel(selector: string): Model<Api> | undefined | Promise<Model<Api> | undefined>;
  resolveAuth(model: Model<Api>): Promise<AuxiliaryRequestAuth | undefined>;
}

export interface ModelRegistryLike {
  find(provider: string, modelId: string): Model<Api> | undefined;
  getAll(): Model<Api>[];
  getApiKeyAndHeaders(model: Model<Api>): Promise<
    | { ok: true; apiKey?: string; headers?: Record<string, string> }
    | { ok: false; error: string }
  >;
}

export interface AuxiliaryExecutionUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: number;
}

export type AuxiliaryExecutionStatus =
  | "success"
  | "rejected"
  | "failure"
  | "timeout"
  | "malformed";

export interface AuxiliaryExecutionResult<T> {
  status: AuxiliaryExecutionStatus;
  decision: AuxiliaryDecision;
  output?: T;
  usage?: AuxiliaryExecutionUsage;
  latencyMs?: number;
  /** Direct signal to keep the deterministic artifact. No helper transcript is returned. */
  fallback: boolean;
  reason: string;
}

export type AuxiliaryCompletion = (
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
) => Promise<AssistantMessage>;

export interface ExecuteAuxiliaryOnceInput<T> {
  plan: AuxiliaryPlan;
  runtime: AuxiliaryRuntime;
  prompt: AuxiliaryPrompt;
  auth?: AuxiliaryRequestAuth;
  parseOutput(text: string): T | undefined;
  /** Explicit user-requested knowledge compilation can bypass only the utility gate. */
  force?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  completion?: AuxiliaryCompletion;
}

const AUXILIARY_KIND_ORDER: Record<AuxiliaryKind, number> = {
  "stall-recovery": 0,
  "task-scout": 1,
  "semantic-distill": 2,
  "knowledge-compile": 3,
};

const SEMANTIC_SYSTEM_PROMPT = `You distill one bounded tool result for direct reuse by a solving model.
Return exactly one JSON object with fields in this order:
{"decisiveFacts":string[],"relationships":string[],"unresolvedOrAmbiguous":string[],"sourceAnchors":string[]}
Limits: at most 6 facts, 4 relationships, 3 ambiguities, and 6 anchors. Each item is one short sentence. Copy exact values, labels, units, paths, errors, and locations. Keep uncertainty explicit. Anchors must map to supplied content or recovery coordinates. Do not give general advice or narrative.`;

const SCOUT_SYSTEM_PREFIX = `You provide one bounded initial task orientation and skill selection.
Return exactly one JSON object with fields in this order:
{"selectedSkillNames":string[],"initialStrategy":string[],"attentionPoints":string[]}
Select 0..2 names only from the eligible catalog. Give 0..3 concise strategy moves and 0..4 easy-to-miss details. Each item is one short line. Strategy is advisory, not a completion gate or persistent plan.`;

const STALL_SYSTEM_PROMPT = `You provide one bounded recovery hint after deterministic evidence of repeated unproductive work.
Return exactly one JSON object with fields in this order:
{"diagnosis":string,"nextAction":string,"assumptionToDrop":string?}
Use only the supplied task and at most four recent attempts. Recommend one concrete next action. Do not review the eventual answer, add completion gates, or claim the task is complete.`;

const KNOWLEDGE_SYSTEM_PROMPT = `You compile supplied outcome-grounded episodes into at most one current reusable pattern/skill pair.
Return exactly one JSON object: either {"action":"none"} or fields in this order:
{"action":"upsert","name":string,"patternMarkdown":string,"skillMarkdown":string}
Derive a reusable distinction from actions and feedback, not a copied answer or surface error. Prefer updating a relevant existing pair over a near-duplicate. Parameterize task-specific IDs, paths, filenames, artifacts, and model quirks. The pattern must state applicability, distinction, better approach, and exceptions. The skill must be the smallest complete actionable procedure and include disable-model-invocation: true. Do not add review stages, proof steps, unsupported rules, nonexistent tools, or diagnostic boilerplate. Do not grade or score the result.`;

function emptyKindAccounting(): AuxiliaryKindAccounting {
  return {
    callsAttempted: 0,
    callsCompleted: 0,
    callsFailed: 0,
    malformedOutputs: 0,
    timedOut: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    cost: 0,
    latencyMs: 0,
  };
}

export function createAuxiliaryAccounting(): AuxiliaryAccounting {
  return {
    byKind: {
      "semantic-distill": emptyKindAccounting(),
      "task-scout": emptyKindAccounting(),
      "stall-recovery": emptyKindAccounting(),
      "knowledge-compile": emptyKindAccounting(),
    },
    zeroCallTasks: 0,
  };
}

export function createAuxiliaryTaskState(taskKey?: string): AuxiliaryTaskState {
  return {
    ...(taskKey === undefined ? {} : { taskKey }),
    scoutCalls: 0,
    stallCalls: 0,
    distillCalls: 0,
    knowledgeCalls: 0,
    blockingCalls: 0,
    turnBlockingCalls: 0,
    turnDistillCalls: 0,
    callsAttempted: 0,
    taskFinalized: false,
  };
}

export function createAuxiliaryRuntime(input: {
  enabled?: boolean;
  taskKey?: string;
  economics?: AuxiliaryEconomics;
} = {}): AuxiliaryRuntime {
  return {
    enabled: input.enabled ?? true,
    task: createAuxiliaryTaskState(input.taskKey),
    economics: { ...input.economics },
    accounting: createAuxiliaryAccounting(),
  };
}

function resetTaskState(state: AuxiliaryTaskState, taskKey?: string): void {
  const next = createAuxiliaryTaskState(taskKey);
  for (const key of Object.keys(state) as Array<keyof AuxiliaryTaskState>) {
    delete state[key];
  }
  Object.assign(state, next);
}

export function beginAuxiliaryTask(runtime: AuxiliaryRuntime, taskKey?: string): void {
  if (runtime.task.taskKey === taskKey && !runtime.task.taskFinalized) return;
  if (runtime.task.taskKey !== undefined || runtime.task.callsAttempted > 0) {
    finalizeAuxiliaryTask(runtime);
  }
  resetTaskState(runtime.task, taskKey);
}

export function beginAuxiliaryTurn(runtime: AuxiliaryRuntime, turnKey?: string): void {
  if (runtime.task.turnKey === turnKey && turnKey !== undefined) return;
  runtime.task.turnKey = turnKey;
  runtime.task.turnBlockingCalls = 0;
  runtime.task.turnDistillCalls = 0;
}

export function finalizeAuxiliaryTask(runtime: AuxiliaryRuntime): void {
  if (runtime.task.taskFinalized) return;
  if (runtime.task.callsAttempted === 0) runtime.accounting.zeroCallTasks += 1;
  runtime.task.taskFinalized = true;
}

function finiteNonNegative(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function perMillion(tokens: number, rate: number): number {
  return Math.max(0, tokens) * Math.max(0, rate) / 1_000_000;
}

export function estimateAuxiliaryCost(plan: AuxiliaryPlan): number | undefined {
  const override = finiteNonNegative(plan.estimatedAuxiliaryCost);
  if (override !== undefined) return override;
  const inputRate = finiteNonNegative(plan.model.cost?.input);
  const outputRate = finiteNonNegative(plan.model.cost?.output);
  if (inputRate === undefined || outputRate === undefined) return undefined;
  return perMillion(plan.estimatedInputTokens, inputRate) + perMillion(plan.maxOutputTokens, outputRate);
}

function scheduleBlockReason(kind: AuxiliaryKind, blocking: boolean, runtime: Readonly<AuxiliaryRuntime>): string | undefined {
  const state = runtime.task;
  if (!runtime.enabled) return "auxiliary mode is off";
  if (state.taskFinalized) return "task is already finalized";
  if (state.inFlight !== undefined) return `auxiliary call already in flight: ${state.inFlight}`;
  if (blocking && state.turnBlockingCalls >= AUXILIARY_BOUNDS.maxBlockingCallsPerTurn) {
    return "blocking call limit reached for turn";
  }
  if (blocking && state.blockingCalls >= AUXILIARY_BOUNDS.maxBlockingCallsPerTask) {
    return "blocking call limit reached for task";
  }
  if (kind === "task-scout" && state.scoutCalls >= AUXILIARY_BOUNDS.maxScoutCallsPerTask) {
    return "task scout limit reached";
  }
  if (kind === "stall-recovery" && state.stallCalls >= AUXILIARY_BOUNDS.maxStallCallsPerTask) {
    return "stall recovery limit reached";
  }
  if (kind === "semantic-distill" && state.turnDistillCalls >= AUXILIARY_BOUNDS.maxDistillCallsPerTurn) {
    return "semantic distill limit reached for turn";
  }
  if (kind === "semantic-distill" && state.distillCalls >= AUXILIARY_BOUNDS.maxDistillCallsPerTask) {
    return "semantic distill limit reached for task";
  }
  if (kind === "knowledge-compile" && state.knowledgeCalls >= 1) {
    return "knowledge compile limit reached for task";
  }
  return undefined;
}

export function canScheduleAuxiliary(
  kind: AuxiliaryKind,
  blocking: boolean,
  runtime: Readonly<AuxiliaryRuntime>,
): AuxiliaryDecision {
  const reason = scheduleBlockReason(kind, blocking, runtime);
  return reason ? { run: false, reason } : { run: true, reason: "hard bounds available" };
}

function ordinaryTurnTokenEstimate(economics: Readonly<AuxiliaryEconomics>): number | undefined {
  const input = finiteNonNegative(economics.latestProviderInputTokens);
  if (input === undefined) return undefined;
  return input + (finiteNonNegative(economics.conservativeMainOutputTokens) ?? 512);
}

export function decideAuxiliaryCall(
  plan: AuxiliaryPlan,
  runtime: Readonly<AuxiliaryRuntime>,
): AuxiliaryDecision {
  const bounded = canScheduleAuxiliary(plan.kind, plan.blocking, runtime);
  if (!bounded.run) return bounded;
  if (!Number.isFinite(plan.estimatedInputTokens) || plan.estimatedInputTokens < 0 ||
      plan.estimatedInputTokens > AUXILIARY_BOUNDS.maxInputTokens) {
    return { run: false, reason: "auxiliary input exceeds fixed bound" };
  }
  if (!Number.isFinite(plan.maxOutputTokens) || plan.maxOutputTokens <= 0) {
    return { run: false, reason: "invalid auxiliary output bound" };
  }

  const economics = runtime.economics;
  const estimatedCost = estimateAuxiliaryCost(plan);
  const inputUnitCost = finiteNonNegative(economics.currentMainInputUnitCost);
  const recentSolverCost = finiteNonNegative(economics.recentMeanSolverCallCost);
  const recentToolCost = finiteNonNegative(economics.recentMeanToolCost);
  const ordinaryTokens = ordinaryTurnTokenEstimate(economics);

  let estimatedBenefit = 0;
  let monetaryBenefitCredible = false;
  let ordinaryTurnCost: number | undefined = recentSolverCost;
  if (inputUnitCost !== undefined) {
    estimatedBenefit += perMillion(plan.estimatedPromptTokensSaved, inputUnitCost);
    monetaryBenefitCredible ||= plan.estimatedPromptTokensSaved > 0 && inputUnitCost > 0;
  }
  if (recentSolverCost !== undefined) {
    estimatedBenefit += Math.max(0, plan.estimatedMainTurnsAvoided) * recentSolverCost;
    monetaryBenefitCredible ||= plan.estimatedMainTurnsAvoided > 0 && recentSolverCost > 0;
  } else if (ordinaryTokens !== undefined && inputUnitCost !== undefined) {
    const outputRate = finiteNonNegative(economics.currentMainOutputUnitCost) ?? inputUnitCost;
    const outputTokens = finiteNonNegative(economics.conservativeMainOutputTokens) ?? 512;
    const estimatedTurnCost = perMillion(Math.max(0, ordinaryTokens - outputTokens), inputUnitCost) +
      perMillion(outputTokens, outputRate);
    ordinaryTurnCost = estimatedTurnCost;
    estimatedBenefit += Math.max(0, plan.estimatedMainTurnsAvoided) * estimatedTurnCost;
    monetaryBenefitCredible ||= plan.estimatedMainTurnsAvoided > 0 && estimatedTurnCost > 0;
  }
  if (recentToolCost !== undefined) {
    estimatedBenefit += Math.max(0, plan.estimatedToolCallsAvoided) * recentToolCost;
    monetaryBenefitCredible ||= plan.estimatedToolCallsAvoided > 0 && recentToolCost > 0;
  }

  const latencyPass = !plan.blocking ||
    plan.estimatedCriticalPathMsSaved >= plan.estimatedAuxiliaryLatencyMs * 1.2;
  const monetaryCostCredible = estimatedCost !== undefined && estimatedCost > 0;
  const normalMonetaryPass = monetaryCostCredible && monetaryBenefitCredible &&
    estimatedBenefit >= estimatedCost * AUXILIARY_BOUNDS.minBenefitRatio && latencyPass;

  const tokenBenefit = Math.max(0, plan.estimatedPromptTokensSaved) +
    Math.max(0, plan.estimatedMainTurnsAvoided) * (ordinaryTokens ?? 0);
  const tokenCost = Math.max(0, plan.estimatedInputTokens) + Math.max(0, plan.maxOutputTokens);
  const tokenEstimateCredible = tokenBenefit > 0 && tokenCost > 0 && ordinaryTokens !== undefined;
  const normalTokenPass = !monetaryCostCredible && tokenEstimateCredible &&
    tokenBenefit >= tokenCost * AUXILIARY_BOUNDS.minBenefitRatio && latencyPass;

  const rescueCostPass = plan.completionRisk === "high" && (
    monetaryCostCredible && ordinaryTurnCost !== undefined
      ? estimatedCost <= ordinaryTurnCost
      : tokenEstimateCredible && tokenCost <= (ordinaryTokens ?? 0)
  );

  if (normalMonetaryPass || normalTokenPass) {
    return {
      run: true,
      reason: normalMonetaryPass ? "estimated benefit clears monetary utility gate" : "token-equivalent benefit clears utility gate",
      ...(estimatedCost === undefined ? {} : { estimatedCost }),
      ...(monetaryBenefitCredible ? { estimatedBenefit } : {}),
    };
  }
  if (rescueCostPass) {
    return {
      run: true,
      reason: "high completion risk clears bounded rescue exception",
      ...(estimatedCost === undefined ? {} : { estimatedCost }),
      ...(monetaryBenefitCredible ? { estimatedBenefit } : {}),
    };
  }
  if (!monetaryCostCredible && !tokenEstimateCredible) {
    return { run: false, reason: "no credible cost or token-equivalent estimate" };
  }
  if (!latencyPass) {
    return {
      run: false,
      reason: "blocking call is not expected to save critical-path time",
      ...(estimatedCost === undefined ? {} : { estimatedCost }),
      ...(monetaryBenefitCredible ? { estimatedBenefit } : {}),
    };
  }
  return {
    run: false,
    reason: "estimated benefit does not clear utility gate",
    ...(estimatedCost === undefined ? {} : { estimatedCost }),
    ...(monetaryBenefitCredible ? { estimatedBenefit } : {}),
  };
}

export interface ArbitratedAuxiliaryPlan {
  plan: AuxiliaryPlan;
  decision: AuxiliaryDecision;
}

export function arbitrateAuxiliaryPlans(
  plans: readonly AuxiliaryPlan[],
  runtime: Readonly<AuxiliaryRuntime>,
): ArbitratedAuxiliaryPlan | undefined {
  const runnable = plans.flatMap((plan) => {
    const decision = decideAuxiliaryCall(plan, runtime);
    return decision.run ? [{ plan, decision }] : [];
  });
  runnable.sort((left, right) => {
    const priority = AUXILIARY_KIND_ORDER[left.plan.kind] - AUXILIARY_KIND_ORDER[right.plan.kind];
    if (priority !== 0) return priority;
    const leftNet = (left.decision.estimatedBenefit ?? 0) - (left.decision.estimatedCost ?? 0);
    const rightNet = (right.decision.estimatedBenefit ?? 0) - (right.decision.estimatedCost ?? 0);
    return rightNet - leftNet;
  });
  return runnable[0];
}

function reserveAuxiliaryCall(plan: AuxiliaryPlan, runtime: AuxiliaryRuntime): boolean {
  if (!canScheduleAuxiliary(plan.kind, plan.blocking, runtime).run) return false;
  const state = runtime.task;
  state.inFlight = plan.kind;
  state.callsAttempted += 1;
  if (plan.blocking) {
    state.blockingCalls += 1;
    state.turnBlockingCalls += 1;
  }
  if (plan.kind === "task-scout") state.scoutCalls += 1;
  if (plan.kind === "stall-recovery") state.stallCalls += 1;
  if (plan.kind === "semantic-distill") {
    state.distillCalls += 1;
    state.turnDistillCalls += 1;
  }
  if (plan.kind === "knowledge-compile") state.knowledgeCalls += 1;
  runtime.accounting.byKind[plan.kind].callsAttempted += 1;
  return true;
}

function releaseAuxiliaryCall(kind: AuxiliaryKind, runtime: AuxiliaryRuntime): void {
  if (runtime.task.inFlight === kind) delete runtime.task.inFlight;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}

export function estimateAuxiliaryTokens(text: string): number {
  return Math.ceil(utf8Bytes(text) / 4);
}

function boundedText(value: string, maxBytes: number): string {
  return truncateUtf8(value, maxBytes);
}

function tailUtf8(value: string, maxBytes: number): string {
  if (maxBytes <= 0 || utf8Bytes(value) <= maxBytes) return maxBytes <= 0 ? "" : value;
  const bytes = Buffer.from(value, "utf8");
  let start = Math.max(0, bytes.length - maxBytes);
  while (start < bytes.length && (bytes[start] & 0xc0) === 0x80) start += 1;
  return bytes.subarray(start).toString("utf8");
}

function boundedHeadTail(value: string, maxBytes: number): string {
  if (utf8Bytes(value) <= maxBytes) return value;
  const marker = "\n...[middle omitted at fixed auxiliary bound]...\n";
  const available = Math.max(0, maxBytes - utf8Bytes(marker));
  const headBytes = Math.ceil(available / 2);
  return `${truncateUtf8(value, headBytes)}${marker}${tailUtf8(value, available - headBytes)}`;
}

function boundedPrompt(
  kind: AuxiliaryKind,
  systemPrompt: string,
  variablePacket: unknown,
  maxOutputTokens: number,
): AuxiliaryPrompt {
  const separator = "\n--- variable suffix ---\n";
  const serialized = stableJson(variablePacket);
  const maxBytes = AUXILIARY_BOUNDS.maxInputTokens * 3;
  const fixedBytes = utf8Bytes(systemPrompt) + utf8Bytes(separator);
  const marker = "\n[packet truncated at fixed auxiliary input bound]";
  const available = Math.max(0, maxBytes - fixedBytes);
  const userPrompt = utf8Bytes(serialized) <= available
    ? serialized
    : `${truncateUtf8(serialized, Math.max(0, available - utf8Bytes(marker)))}${marker}`;
  const context: Context = {
    systemPrompt,
    messages: [{ role: "user", content: `${separator}${userPrompt}`, timestamp: 0 }],
  };
  return {
    kind,
    systemPrompt,
    userPrompt,
    context,
    maxOutputTokens,
    estimatedInputTokens: Math.ceil((utf8Bytes(systemPrompt) + utf8Bytes(separator) + utf8Bytes(userPrompt)) / 3),
  };
}

function compactTask(task: CompactTaskPacket): CompactTaskPacket {
  const boundedItems = (items: readonly string[]) => items.slice(0, 12).map((item) => boundedText(item, 768));
  return {
    ...(task.objective === undefined ? {} : { objective: boundedText(task.objective, 2_048) }),
    explicitConstraints: boundedItems(task.explicitConstraints),
    ...(task.focus === undefined ? {} : { focus: boundedText(task.focus, 1_024) }),
    openItems: boundedItems(task.openItems),
    decisiveObservations: boundedItems(task.decisiveObservations),
  };
}

export function buildSemanticDistillPrompt(input: SemanticDistillInput): AuxiliaryPrompt {
  return boundedPrompt("semantic-distill", SEMANTIC_SYSTEM_PROMPT, {
    task: compactTask(input.task),
    tool: boundedText(input.tool, 512),
    subject: boundedText(input.subject, 1_024),
    deterministicCapsule: boundedHeadTail(input.deterministicCapsule, 4_096),
    rawResult: boundedHeadTail(input.rawResult, 24_000),
    availableRecovery: input.availableRecovery.slice(0, 12).map((coordinate) => ({
      ref: boundedText(coordinate.ref, 256),
      part: boundedText(coordinate.part, 128),
      ...(coordinate.range === undefined ? {} : { range: boundedText(coordinate.range, 128) }),
    })),
  }, AUXILIARY_BOUNDS.distillOutputTokens);
}

export function buildTaskScoutPrompt(input: TaskScoutInput): AuxiliaryPrompt {
  const catalog = input.skillCatalog.slice(0, 24).map((entry) => ({
    name: boundedText(entry.name, 256),
    description: boundedText(entry.description, 768),
    triggers: entry.triggers.slice(0, 12).map((trigger) => boundedText(trigger, 256)),
    requiredTools: entry.requiredTools.slice(0, 12).map((tool) => boundedText(tool, 128)),
  }));
  const serializedCatalog = stableJson({
    libraryRevision: input.libraryRevision ?? "current",
    skillCatalog: catalog,
  });
  const catalogMaxBytes = 16_000;
  const catalogMarker = "\n[catalog truncated at fixed scout prefix bound]";
  const stableCatalog = utf8Bytes(serializedCatalog) <= catalogMaxBytes
    ? serializedCatalog
    : `${truncateUtf8(serializedCatalog, catalogMaxBytes - utf8Bytes(catalogMarker))}${catalogMarker}`;
  return boundedPrompt("task-scout", `${SCOUT_SYSTEM_PREFIX}\n--- frozen eligible catalog ---\n${stableCatalog}`, {
    task: compactTask(input.task),
    availableTools: input.availableTools.slice(0, 64).map((tool) => boundedText(tool, 128)),
  }, AUXILIARY_BOUNDS.scoutOutputTokens);
}

export function buildStallRecoveryPrompt(input: StallRecoveryInput): AuxiliaryPrompt {
  return boundedPrompt("stall-recovery", STALL_SYSTEM_PROMPT, {
    task: compactTask(input.task),
    selectedSkills: input.selectedSkills.slice(0, 2).map((skill) => boundedText(skill, 256)),
    availableTools: input.availableTools.slice(0, 64).map((tool) => boundedText(tool, 128)),
    recentAttempts: input.recentAttempts.slice(-4).map((attempt) => ({
      action: boundedText(attempt.action, 768),
      decisiveObservation: boundedText(attempt.decisiveObservation, 1_024),
    })),
  }, AUXILIARY_BOUNDS.stallOutputTokens);
}

export function buildKnowledgeCompilePrompt(input: KnowledgeCompileInput): AuxiliaryPrompt {
  return boundedPrompt("knowledge-compile", KNOWLEDGE_SYSTEM_PROMPT, {
    topic: boundedText(input.topic, 1_024),
    automatic: input.automatic,
    episodes: input.episodes.slice(0, 6).map((episode) => ({
      task: boundedText(episode.task, 1_024),
      taskOutcome: episode.taskOutcome,
      evidence: boundedHeadTail(episode.evidence, 3_600),
    })),
    existingPairs: input.existingPairs.slice(0, 2).map((pair) => ({
      name: boundedText(pair.name, 128),
      patternMarkdown: boundedHeadTail(pair.patternMarkdown, 4_000),
      skillMarkdown: boundedHeadTail(pair.skillMarkdown, 4_000),
    })),
  }, AUXILIARY_BOUNDS.learnOutputTokens);
}

function assistantText(message: AssistantMessage): string {
  return message.content.flatMap((block) => block.type === "text" ? [block.text] : []).join("\n").trim();
}

function parsedJsonObject(text: string): Record<string, unknown> | undefined {
  let candidate = text.trim();
  const fenced = candidate.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
  if (fenced) candidate = fenced[1].trim();
  try {
    const value: unknown = JSON.parse(candidate);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function hasExactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key));
}

function shortString(value: unknown, maxBytes = 768): string | undefined {
  return typeof value === "string" && value.trim().length > 0 && utf8Bytes(value) <= maxBytes
    ? value.trim()
    : undefined;
}

function stringArray(value: unknown, maxItems: number, maxItemBytes = 768): string[] | undefined {
  if (!Array.isArray(value) || value.length > maxItems) return undefined;
  const items = value.map((item) => shortString(item, maxItemBytes));
  return items.every((item): item is string => item !== undefined) ? items : undefined;
}

export function renderSemanticCapsule(output: SemanticCapsuleOutput, maxBytes: number): string | undefined {
  const sections = [
    ["Decisive facts", output.decisiveFacts],
    ["Relationships", output.relationships],
    ["Unresolved or ambiguous", output.unresolvedOrAmbiguous],
    ["Source anchors", output.sourceAnchors],
  ] as const;
  const text = sections.flatMap(([heading, items]) => items.length === 0
    ? []
    : [`${heading}:`, ...items.map((item) => `- ${item}`)]).join("\n");
  return text.length > 0 && utf8Bytes(text) <= maxBytes ? text : undefined;
}

export function parseSemanticCapsuleOutput(
  text: string,
  options: { capsuleMaxBytes: number; allowedSourceAnchors?: ReadonlySet<string> },
): SemanticCapsuleOutput | undefined {
  const value = parsedJsonObject(text);
  if (!value || !hasExactKeys(value, [
    "decisiveFacts",
    "relationships",
    "unresolvedOrAmbiguous",
    "sourceAnchors",
  ])) return undefined;
  const decisiveFacts = stringArray(value.decisiveFacts, 6);
  const relationships = stringArray(value.relationships, 4);
  const unresolvedOrAmbiguous = stringArray(value.unresolvedOrAmbiguous, 3);
  const sourceAnchors = stringArray(value.sourceAnchors, 6);
  if (!decisiveFacts || !relationships || !unresolvedOrAmbiguous || !sourceAnchors) return undefined;
  if (options.allowedSourceAnchors && sourceAnchors.some((anchor) => !options.allowedSourceAnchors!.has(anchor))) {
    return undefined;
  }
  const output = { decisiveFacts, relationships, unresolvedOrAmbiguous, sourceAnchors };
  return renderSemanticCapsule(output, options.capsuleMaxBytes) === undefined ? undefined : output;
}

export function renderTaskScoutSupplement(output: TaskScoutOutput): string {
  return [
    ...output.initialStrategy.map((item) => `Strategy: ${item}`),
    ...output.attentionPoints.map((item) => `Attention: ${item}`),
  ].join("\n");
}

export function parseTaskScoutOutput(
  text: string,
  eligibleSkillNames: ReadonlySet<string>,
): TaskScoutOutput | undefined {
  const value = parsedJsonObject(text);
  if (!value || !hasExactKeys(value, ["selectedSkillNames", "initialStrategy", "attentionPoints"])) {
    return undefined;
  }
  const selectedSkillNames = stringArray(value.selectedSkillNames, 2, 256);
  const initialStrategy = stringArray(value.initialStrategy, 3, 512);
  const attentionPoints = stringArray(value.attentionPoints, 4, 512);
  if (!selectedSkillNames || !initialStrategy || !attentionPoints ||
      selectedSkillNames.some((name) => !eligibleSkillNames.has(name))) return undefined;
  const output = { selectedSkillNames, initialStrategy, attentionPoints };
  return estimateAuxiliaryTokens(renderTaskScoutSupplement(output)) <= 220 ? output : undefined;
}

export function renderStallRecoveryHint(output: StallRecoveryOutput): string {
  return [
    `Diagnosis: ${output.diagnosis}`,
    `Next action: ${output.nextAction}`,
    ...(output.assumptionToDrop ? [`Assumption to drop: ${output.assumptionToDrop}`] : []),
  ].join("\n");
}

export function parseStallRecoveryOutput(text: string): StallRecoveryOutput | undefined {
  const value = parsedJsonObject(text);
  if (!value || !hasExactKeys(value, ["diagnosis", "nextAction"], ["assumptionToDrop"])) return undefined;
  const diagnosis = shortString(value.diagnosis, 768);
  const nextAction = shortString(value.nextAction, 768);
  const assumptionToDrop = value.assumptionToDrop === undefined
    ? undefined
    : shortString(value.assumptionToDrop, 768);
  if (!diagnosis || !nextAction || (value.assumptionToDrop !== undefined && !assumptionToDrop)) return undefined;
  const output = { diagnosis, nextAction, ...(assumptionToDrop ? { assumptionToDrop } : {}) };
  return estimateAuxiliaryTokens(renderStallRecoveryHint(output)) <= 180 ? output : undefined;
}

export function parseKnowledgeCompilation(
  text: string,
  options: { maxPatternBytes?: number; maxSkillBytes?: number } = {},
): KnowledgeCompilation | undefined {
  const value = parsedJsonObject(text);
  if (!value || (value.action !== "none" && value.action !== "upsert")) return undefined;
  if (value.action === "none") return hasExactKeys(value, ["action"]) ? { action: "none" } : undefined;
  if (!hasExactKeys(value, ["action", "name", "patternMarkdown", "skillMarkdown"])) return undefined;
  const name = shortString(value.name, 128);
  const patternMarkdown = shortString(value.patternMarkdown, options.maxPatternBytes ?? 24_000);
  const skillMarkdown = shortString(value.skillMarkdown, options.maxSkillBytes ?? 24_000);
  if (!name || name.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) ||
      !patternMarkdown || !skillMarkdown || !/disable-model-invocation:\s*true\b/i.test(skillMarkdown)) return undefined;
  return { action: "upsert", name, patternMarkdown, skillMarkdown };
}

function factualUsage(usage: Usage | undefined): AuxiliaryExecutionUsage | undefined {
  if (!usage) return undefined;
  const input = finiteNonNegative(usage.input) ?? 0;
  const output = finiteNonNegative(usage.output) ?? 0;
  const cacheRead = finiteNonNegative(usage.cacheRead) ?? 0;
  const cacheWrite = finiteNonNegative(usage.cacheWrite) ?? 0;
  const totalTokens = finiteNonNegative(usage.totalTokens) ?? input + output + cacheRead + cacheWrite;
  const cost = finiteNonNegative(usage.cost?.total) ?? 0;
  return { input, output, cacheRead, cacheWrite, totalTokens, cost };
}

function addFactualUsage(metric: AuxiliaryKindAccounting, usage: AuxiliaryExecutionUsage | undefined): void {
  if (!usage) return;
  metric.inputTokens += usage.input;
  metric.outputTokens += usage.output;
  metric.cacheReadTokens += usage.cacheRead;
  metric.cacheWriteTokens += usage.cacheWrite;
  metric.cost += usage.cost;
}

function recordResponse(
  kind: AuxiliaryKind,
  runtime: AuxiliaryRuntime,
  usage: AuxiliaryExecutionUsage | undefined,
  latencyMs: number,
): void {
  const metric = runtime.accounting.byKind[kind];
  metric.callsCompleted += 1;
  metric.latencyMs += latencyMs;
  addFactualUsage(metric, usage);
}

function recordFailure(
  kind: AuxiliaryKind,
  runtime: AuxiliaryRuntime,
  usage: AuxiliaryExecutionUsage | undefined,
  latencyMs: number,
  timedOut: boolean,
): void {
  const metric = runtime.accounting.byKind[kind];
  metric.callsFailed += 1;
  metric.latencyMs += latencyMs;
  addFactualUsage(metric, usage);
  if (timedOut) metric.timedOut += 1;
}

function abortSignal(input: AbortSignal | undefined, timeoutMs: number): {
  signal: AbortSignal;
  timedOut(): boolean;
  dispose(): void;
} {
  const controller = new AbortController();
  let timeout = false;
  const onAbort = () => controller.abort(input?.reason);
  if (input?.aborted) controller.abort(input.reason);
  else input?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => {
    timeout = true;
    controller.abort(new Error("auxiliary request timed out"));
  }, timeoutMs);
  timer.unref?.();
  return {
    signal: controller.signal,
    timedOut: () => timeout,
    dispose: () => {
      clearTimeout(timer);
      input?.removeEventListener("abort", onAbort);
    },
  };
}

function outputTokenBound(kind: AuxiliaryKind): number {
  if (kind === "semantic-distill") return AUXILIARY_BOUNDS.distillOutputTokens;
  if (kind === "task-scout") return AUXILIARY_BOUNDS.scoutOutputTokens;
  if (kind === "stall-recovery") return AUXILIARY_BOUNDS.stallOutputTokens;
  return AUXILIARY_BOUNDS.learnOutputTokens;
}

export async function executeAuxiliaryOnce<T>(
  input: ExecuteAuxiliaryOnceInput<T>,
): Promise<AuxiliaryExecutionResult<T>> {
  const { plan, runtime, prompt } = input;
  if (prompt.kind !== plan.kind) {
    return {
      status: "rejected",
      decision: { run: false, reason: "prompt kind does not match plan kind" },
      fallback: true,
      reason: "prompt kind does not match plan kind",
    };
  }
  const kindOutputBound = outputTokenBound(plan.kind);
  if (prompt.estimatedInputTokens > AUXILIARY_BOUNDS.maxInputTokens ||
      prompt.maxOutputTokens <= 0 || prompt.maxOutputTokens > kindOutputBound ||
      plan.maxOutputTokens <= 0 || plan.maxOutputTokens > kindOutputBound) {
    const reason = "prompt or output exceeds fixed auxiliary bound";
    return { status: "rejected", decision: { run: false, reason }, fallback: true, reason };
  }
  const effectivePlan: AuxiliaryPlan = {
    ...plan,
    estimatedInputTokens: Math.max(plan.estimatedInputTokens, prompt.estimatedInputTokens),
    maxOutputTokens: Math.min(plan.maxOutputTokens, prompt.maxOutputTokens),
  };
  const decision = input.force
    ? canScheduleAuxiliary(effectivePlan.kind, effectivePlan.blocking, runtime)
    : decideAuxiliaryCall(effectivePlan, runtime);
  if (!decision.run) {
    return { status: "rejected", decision, fallback: true, reason: decision.reason };
  }
  if (!reserveAuxiliaryCall(effectivePlan, runtime)) {
    const rejected = canScheduleAuxiliary(effectivePlan.kind, effectivePlan.blocking, runtime);
    return { status: "rejected", decision: rejected, fallback: true, reason: rejected.reason };
  }

  const timeoutMs = Math.max(1, Math.floor(input.timeoutMs ?? DEFAULT_AUXILIARY_TIMEOUT_MS));
  const controlled = abortSignal(input.signal, timeoutMs);
  const started = Date.now();
  try {
    const completion = input.completion ?? completeSimple;
    const message = await completion(effectivePlan.model, prompt.context, {
      apiKey: input.auth?.apiKey,
      headers: input.auth?.headers,
      maxTokens: effectivePlan.maxOutputTokens,
      reasoning: "off",
      signal: controlled.signal,
      timeoutMs,
      maxRetries: 0,
    });
    const latencyMs = Math.max(0, Date.now() - started);
    const usage = factualUsage(message.usage);
    if (message.stopReason === "error" || message.stopReason === "aborted") {
      recordFailure(plan.kind, runtime, usage, latencyMs, controlled.timedOut());
      return {
        status: controlled.timedOut() ? "timeout" : "failure",
        decision,
        ...(usage ? { usage } : {}),
        latencyMs,
        fallback: true,
        reason: controlled.timedOut() ? "auxiliary request timed out" : "auxiliary provider returned failure",
      };
    }
    recordResponse(plan.kind, runtime, usage, latencyMs);
    let output: T | undefined;
    if (message.stopReason !== "length") {
      try {
        output = input.parseOutput(assistantText(message));
      } catch {
        output = undefined;
      }
    }
    if (output === undefined) {
      runtime.accounting.byKind[plan.kind].malformedOutputs += 1;
      return {
        status: "malformed",
        decision,
        ...(usage ? { usage } : {}),
        latencyMs,
        fallback: true,
        reason: message.stopReason === "length"
          ? "auxiliary output hit its token limit"
          : "auxiliary output was malformed or exceeded its bound",
      };
    }
    return {
      status: "success",
      decision,
      output,
      ...(usage ? { usage } : {}),
      latencyMs,
      fallback: false,
      reason: "auxiliary output accepted",
    };
  } catch {
    const latencyMs = Math.max(0, Date.now() - started);
    const timedOut = controlled.timedOut();
    recordFailure(plan.kind, runtime, undefined, latencyMs, timedOut);
    return {
      status: timedOut ? "timeout" : "failure",
      decision,
      latencyMs,
      fallback: true,
      reason: timedOut ? "auxiliary request timed out" : "auxiliary request failed",
    };
  } finally {
    controlled.dispose();
    releaseAuxiliaryCall(plan.kind, runtime);
  }
}

export function createModelResolutionHooks(input: {
  currentModel: () => Model<Api> | undefined;
  modelRegistry: ModelRegistryLike;
}): AuxiliaryModelResolutionHooks {
  return {
    currentModel: input.currentModel,
    resolveModel: (selector) => {
      const normalized = selector.trim();
      const slash = normalized.indexOf("/");
      if (slash > 0 && slash < normalized.length - 1) {
        const direct = input.modelRegistry.find(normalized.slice(0, slash), normalized.slice(slash + 1));
        if (direct) return direct;
      }
      const matches = input.modelRegistry.getAll().filter((model) =>
        model.id === normalized || `${model.provider}/${model.id}` === normalized);
      return matches.length === 1 ? matches[0] : undefined;
    },
    resolveAuth: async (model) => {
      const auth = await input.modelRegistry.getApiKeyAndHeaders(model);
      return auth.ok ? { apiKey: auth.apiKey, headers: auth.headers } : undefined;
    },
  };
}

export async function resolveAuxiliaryModel(
  kind: AuxiliaryKind,
  config: Readonly<AuxiliaryModelConfig>,
  hooks: AuxiliaryModelResolutionHooks,
): Promise<ResolvedAuxiliaryModel | undefined> {
  const selector = kind === "knowledge-compile"
    ? config.learningModel ?? config.auxiliaryModel
    : config.auxiliaryModel;
  const configured = selector ? await hooks.resolveModel(selector) : undefined;
  if (selector && !configured) return undefined;
  const model = configured ?? hooks.currentModel();
  if (!model) return undefined;
  const auth = await hooks.resolveAuth(model);
  if (!auth) return undefined;
  return {
    model,
    ...auth,
    source: configured ? "configured" : "current",
    ...(selector ? { selector } : {}),
  };
}
