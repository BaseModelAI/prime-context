import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const SNAPSHOT_ENTRY_TYPE = "prime-context.task-snapshot";
export const PRIME_CONTEXT_ANCHOR_TYPE = "prime_context_anchor";
export const PRIME_CONTEXT_UPDATE_TYPE = "prime_context_update";
export const PRIME_CONTEXT_ANCHOR_SCHEMA = "prime_context_anchor/v1" as const;

export type PrimeContextMode = "on" | "off";

export interface PrimeContextConfigV1 {
  enabled?: boolean;
  minTextBytes?: number;
  capsuleMaxBytes?: number;
  readMaxBytes?: number;
  auxiliaryMode?: "off" | "utility-gated";
  auxiliaryModel?: string | null;
  libraryPath?: string;
  skillBudgetTokens?: number;
  learningModel?: string | null;
  autoLearn?: "off" | "utility-gated";
}

export interface ResolvedPrimeContextConfig {
  enabled: boolean;
  minTextBytes: number;
  capsuleMaxBytes: number;
  readMaxBytes: number;
  auxiliaryMode: "off" | "utility-gated";
  auxiliaryModel: string | null;
  libraryPath: string;
  skillBudgetTokens: number;
  learningModel: string | null;
  autoLearn: "off" | "utility-gated";
}

export const DEFAULT_CONFIG: ResolvedPrimeContextConfig = {
  enabled: true,
  minTextBytes: 24576,
  capsuleMaxBytes: 6144,
  readMaxBytes: 65536,
  auxiliaryMode: "utility-gated",
  auxiliaryModel: null,
  libraryPath: ".prime/agent/prime-context/knowledge",
  skillBudgetTokens: 800,
  learningModel: null,
  autoLearn: "utility-gated",
};


export const TASK_STATE_BOUNDS = Object.freeze({
  constraints: 12,
  openItems: 12,
  pins: 8,
  actionableObservations: 6,
  artifacts: 12,
  renderedTokens: 700,
} as const);

export interface ExplicitConstraint {
  id: string;
  text: string;
  sourceEntryId: string;
  supersededBy?: string;
}

export interface TaskOpenItem {
  id: string;
  text: string;
}

export interface TaskActionableObservation {
  text: string;
  observationRef?: string;
  resource?: string;
  sourceToolCallId?: string;
}

export interface TaskArtifact {
  pathOrId: string;
  description?: string;
  sourceToolCallId?: string;
}

/** One bounded, descriptive object for the current task only. */
export interface TaskSnapshotV2 {
  schema: "prime-context.task-snapshot/v2";
  taskKey: string;
  objective?: string;
  objectiveSourceEntryId?: string;
  explicitConstraints: ExplicitConstraint[];
  focus?: string;
  openItems: TaskOpenItem[];
  pinnedObservationIds: string[];
  actionableObservations: TaskActionableObservation[];
  artifacts: TaskArtifact[];
}

export interface ExplicitConstraintInput {
  id: string;
  text: string;
  sourceEntryId: string;
  supersedes?: readonly string[];
}

export interface SnapshotChanges {
  focus?: string | null;
  addItems?: string[];
  completeItemIds?: string[];
  pinObservationIds?: string[];
  unpinObservationIds?: string[];
}

export type SnapshotUpdateResult =
  | { ok: true; changed: boolean; snapshot: TaskSnapshotV2 }
  | { ok: false; error: string };

export interface BranchEntryLike {
  type: string;
  id?: string;
  parentId?: string | null;
  customType?: string;
  data?: unknown;
  message?: unknown;
  content?: unknown;
  display?: boolean;
  details?: unknown;
  timestamp?: string | number;
  firstKeptEntryId?: string;
  summary?: string;
  fromId?: string;
}

export interface PrimeContextAnchorDetails {
  schema: typeof PRIME_CONTEXT_ANCHOR_SCHEMA;
  taskKey?: string;
}

export interface PersistedControlMessage {
  customType: typeof PRIME_CONTEXT_ANCHOR_TYPE;
  content: string;
  details?: Record<string, unknown>;
}

export interface LoadedConfig {
  config: ResolvedPrimeContextConfig;
  warnings: string[];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function controlMessage(entry: BranchEntryLike): PersistedControlMessage | undefined {
  const raw = entry.type === "custom_message"
    ? asRecord(entry)
    : entry.type === "message" ? asRecord(entry.message) : undefined;
  if (!raw || raw.role !== undefined && raw.role !== "custom") return undefined;
  const customType = raw.customType;
  if (customType !== PRIME_CONTEXT_ANCHOR_TYPE) return undefined;
  if (typeof raw.content !== "string") return undefined;
  return {
    customType,
    content: raw.content,
    ...(asRecord(raw.details) === undefined ? {} : { details: asRecord(raw.details) }),
  };
}

/** Match the model context builder: only retained messages survive the newest compaction cut. */
export function providerVisibleBranchEntries(branch: readonly BranchEntryLike[]): readonly BranchEntryLike[] {
  let compactionIndex = -1;
  for (let index = 0; index < branch.length; index += 1) {
    if (branch[index].type === "compaction") compactionIndex = index;
  }
  if (compactionIndex < 0) return branch;

  const firstKeptId = branch[compactionIndex].firstKeptEntryId;
  const firstKeptIndex = typeof firstKeptId === "string"
    ? branch.findIndex((entry, index) => index < compactionIndex && entry.id === firstKeptId)
    : -1;
  return [
    ...(firstKeptIndex < 0 ? [] : branch.slice(firstKeptIndex, compactionIndex)),
    ...branch.slice(compactionIndex + 1),
  ];
}

export function latestProviderVisibleControlMessage(
  branch: readonly BranchEntryLike[],
  customType: PersistedControlMessage["customType"],
  taskKey?: string,
  unscoped?: { content: string; afterEntryId: string },
): PersistedControlMessage | undefined {
  const visible = providerVisibleBranchEntries(branch);
  for (let index = visible.length - 1; index >= 0; index -= 1) {
    const message = controlMessage(visible[index]);
    if (taskKey !== undefined && message?.customType === customType && message.details?.taskKey === taskKey) return message;
  }
  if (!unscoped) return undefined;

  const rootIndex = branch.findIndex((entry) => entry.id === unscoped.afterEntryId);
  if (rootIndex < 0) return undefined;
  const visibleEntries = new Set(visible);
  for (let index = branch.length - 1; index > rootIndex; index -= 1) {
    if (!visibleEntries.has(branch[index])) continue;
    const message = controlMessage(branch[index]);
    if (message?.customType !== customType || message.content !== unscoped.content) continue;
    if (message.details?.taskKey === undefined) return message;
  }
  return undefined;
}


const TASK_TEXT_BYTES = {
  taskKey: 1024,
  objective: 4096,
  constraint: 2048,
  focus: 2048,
  openItem: 2048,
  observation: 2048,
  artifact: 2048,
} as const;

function boundedTaskText(value: unknown, maxBytes: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text) return undefined;
  const bytes = Buffer.from(text, "utf8");
  if (bytes.byteLength <= maxBytes) return text;
  let end = maxBytes;
  while (end > 0 && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
  return bytes.subarray(0, end).toString("utf8").trim() || undefined;
}

function keepLastByKey<T>(values: readonly T[], limit: number, key: (value: T) => string): T[] {
  const seen = new Set<string>();
  const kept: T[] = [];
  for (let index = values.length - 1; index >= 0 && kept.length < limit; index -= 1) {
    const id = key(values[index]);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    kept.unshift(values[index]);
  }
  return kept;
}

/** Normalize counts and strings while retaining only current entries. */
export function boundTaskSnapshotV2(snapshot: TaskSnapshotV2): TaskSnapshotV2 {
  const taskKey = boundedTaskText(snapshot.taskKey, TASK_TEXT_BYTES.taskKey) ?? "";
  const constraints = keepLastByKey(snapshot.explicitConstraints.flatMap((item) => {
    const id = boundedTaskText(item.id, 512);
    const text = boundedTaskText(item.text, TASK_TEXT_BYTES.constraint);
    const sourceEntryId = boundedTaskText(item.sourceEntryId, 1024);
    if (!id || !text || !sourceEntryId) return [];
    const supersededBy = boundedTaskText(item.supersededBy, 512);
    return [{ id, text, sourceEntryId, ...(supersededBy ? { supersededBy } : {}) }];
  }), TASK_STATE_BOUNDS.constraints, (item) => item.id);
  const openItems = keepLastByKey(snapshot.openItems.flatMap((item) => {
    const id = boundedTaskText(item.id, 512);
    const text = boundedTaskText(item.text, TASK_TEXT_BYTES.openItem);
    return id && text ? [{ id, text }] : [];
  }), TASK_STATE_BOUNDS.openItems, (item) => item.id);
  const observations = keepLastByKey(snapshot.actionableObservations.flatMap((item) => {
    const text = boundedTaskText(item.text, TASK_TEXT_BYTES.observation);
    if (!text) return [];
    const observationRef = boundedTaskText(item.observationRef, 1024);
    const resource = boundedTaskText(item.resource, 1024);
    const sourceToolCallId = boundedTaskText(item.sourceToolCallId, 1024);
    return [{ text, ...(observationRef ? { observationRef } : {}), ...(resource ? { resource } : {}),
      ...(sourceToolCallId ? { sourceToolCallId } : {}) }];
  }), TASK_STATE_BOUNDS.actionableObservations, (item) =>
    item.observationRef ? `ref:${item.observationRef}` : item.resource ? `resource:${item.resource}` : `text:${item.text}`);
  const artifacts = keepLastByKey(snapshot.artifacts.flatMap((item) => {
    const pathOrId = boundedTaskText(item.pathOrId, TASK_TEXT_BYTES.artifact);
    if (!pathOrId) return [];
    const description = boundedTaskText(item.description, 2048);
    const sourceToolCallId = boundedTaskText(item.sourceToolCallId, 1024);
    return [{ pathOrId, ...(description ? { description } : {}),
      ...(sourceToolCallId ? { sourceToolCallId } : {}) }];
  }), TASK_STATE_BOUNDS.artifacts, (item) => item.pathOrId);
  const objective = boundedTaskText(snapshot.objective, TASK_TEXT_BYTES.objective);
  const objectiveSourceEntryId = objective ? boundedTaskText(snapshot.objectiveSourceEntryId, 1024) : undefined;
  const focus = boundedTaskText(snapshot.focus, TASK_TEXT_BYTES.focus);
  return {
    schema: "prime-context.task-snapshot/v2",
    taskKey,
    ...(objective ? { objective } : {}),
    ...(objectiveSourceEntryId ? { objectiveSourceEntryId } : {}),
    explicitConstraints: constraints,
    ...(focus ? { focus } : {}),
    openItems,
    pinnedObservationIds: [...new Set(snapshot.pinnedObservationIds.flatMap((id) =>
      boundedTaskText(id, 1024) ?? []))].slice(-TASK_STATE_BOUNDS.pins),
    actionableObservations: observations,
    artifacts,
  };
}

export function createTaskSnapshotV2(
  taskKey: string,
  objective?: string,
  objectiveSourceEntryId?: string,
): TaskSnapshotV2 {
  return boundTaskSnapshotV2({
    schema: "prime-context.task-snapshot/v2",
    taskKey,
    ...(objective ? { objective } : {}),
    ...(objectiveSourceEntryId ? { objectiveSourceEntryId } : {}),
    explicitConstraints: [], openItems: [], pinnedObservationIds: [], actionableObservations: [], artifacts: [],
  });
}

export function cloneTaskSnapshotV2(snapshot: TaskSnapshotV2): TaskSnapshotV2 {
  return boundTaskSnapshotV2(structuredClone(snapshot));
}

export function isTaskSnapshotV2(value: unknown): value is TaskSnapshotV2 {
  const candidate = asRecord(value);
  return candidate?.schema === "prime-context.task-snapshot/v2" &&
    typeof candidate.taskKey === "string" && candidate.taskKey.length > 0 &&
    Array.isArray(candidate.explicitConstraints) && Array.isArray(candidate.openItems) &&
    Array.isArray(candidate.pinnedObservationIds) && Array.isArray(candidate.actionableObservations) &&
    Array.isArray(candidate.artifacts);
}

export function loadLatestTaskSnapshotV2(
  branch: readonly BranchEntryLike[],
  taskKey?: string,
): TaskSnapshotV2 | undefined {
  const visible = providerVisibleBranchEntries(branch);
  for (let index = visible.length - 1; index >= 0; index -= 1) {
    const entry = visible[index];
    if (entry.type !== "custom" || entry.customType !== SNAPSHOT_ENTRY_TYPE || !isTaskSnapshotV2(entry.data)) continue;
    if (taskKey === undefined || entry.data.taskKey === taskKey) return cloneTaskSnapshotV2(entry.data);
  }
  return undefined;
}

/** Set an objective only from the user or another authoritative task input. */
export function setTaskObjective(
  snapshot: TaskSnapshotV2,
  objective: string | undefined,
  sourceEntryId?: string,
): TaskSnapshotV2 {
  return boundTaskSnapshotV2({
    ...snapshot,
    ...(objective === undefined ? { objective: undefined, objectiveSourceEntryId: undefined } : {
      objective,
      ...(sourceEntryId === undefined ? { objectiveSourceEntryId: undefined } : { objectiveSourceEntryId: sourceEntryId }),
    }),
  });
}

/** Add one explicit constraint and mark only caller-identified or exact duplicate constraints as superseded. */
export function applyExplicitConstraint(
  snapshot: TaskSnapshotV2,
  input: ExplicitConstraintInput,
): TaskSnapshotV2 {
  const id = boundedTaskText(input.id, 512);
  const text = boundedTaskText(input.text, TASK_TEXT_BYTES.constraint);
  const sourceEntryId = boundedTaskText(input.sourceEntryId, 1024);
  if (!id || !text || !sourceEntryId) return cloneTaskSnapshotV2(snapshot);
  const supersedes = new Set(input.supersedes ?? []);
  const normalizedText = text.replaceAll(/\s+/g, " ").toLowerCase();
  const explicitConstraints = snapshot.explicitConstraints.flatMap((constraint) => {
    if (constraint.id === id) return [];
    const duplicate = constraint.supersededBy === undefined &&
      constraint.text.replaceAll(/\s+/g, " ").toLowerCase() === normalizedText;
    return [{ ...constraint, ...(supersedes.has(constraint.id) || duplicate ? { supersededBy: id } : {}) }];
  });
  explicitConstraints.push({ id, text, sourceEntryId });
  return boundTaskSnapshotV2({ ...snapshot, explicitConstraints });
}

export function setTaskFocus(snapshot: TaskSnapshotV2, focus: string | undefined): TaskSnapshotV2 {
  return boundTaskSnapshotV2({ ...snapshot, focus });
}

export function upsertTaskOpenItems(
  snapshot: TaskSnapshotV2,
  items: readonly TaskOpenItem[],
): TaskSnapshotV2 {
  return boundTaskSnapshotV2({ ...snapshot, openItems: [...snapshot.openItems, ...items] });
}

export function removeTaskOpenItems(
  snapshot: TaskSnapshotV2,
  itemIds: readonly string[],
): TaskSnapshotV2 {
  const removed = new Set(itemIds);
  return boundTaskSnapshotV2({ ...snapshot, openItems: snapshot.openItems.filter((item) => !removed.has(item.id)) });
}

export function pinTaskObservations(
  snapshot: TaskSnapshotV2,
  observationIds: readonly string[],
): TaskSnapshotV2 {
  return boundTaskSnapshotV2({
    ...snapshot,
    pinnedObservationIds: [...snapshot.pinnedObservationIds, ...observationIds],
  });
}

export function unpinTaskObservations(
  snapshot: TaskSnapshotV2,
  observationIds: readonly string[],
): TaskSnapshotV2 {
  const removed = new Set(observationIds);
  return boundTaskSnapshotV2({
    ...snapshot,
    pinnedObservationIds: snapshot.pinnedObservationIds.filter((id) => !removed.has(id)),
  });
}

export function addActionableObservations(
  snapshot: TaskSnapshotV2,
  observations: readonly TaskActionableObservation[],
): TaskSnapshotV2 {
  return boundTaskSnapshotV2({
    ...snapshot,
    actionableObservations: [...snapshot.actionableObservations, ...observations],
  });
}

export function addTaskArtifacts(
  snapshot: TaskSnapshotV2,
  artifacts: readonly TaskArtifact[],
): TaskSnapshotV2 {
  return boundTaskSnapshotV2({ ...snapshot, artifacts: [...snapshot.artifacts, ...artifacts] });
}


export function applySnapshotChanges(
  current: TaskSnapshotV2,
  changes: SnapshotChanges,
): SnapshotUpdateResult {
  const next = cloneTaskSnapshotV2(current);
  let changed = false;

  const requestedCompletions = [...new Set(changes.completeItemIds ?? [])];
  for (const id of requestedCompletions) {
    if (!next.openItems.some((item) => item.id === id)) {
      return { ok: false, error: `Unknown open item ID: ${id}` };
    }
  }
  if (requestedCompletions.length > 0) {
    const completed = new Set(requestedCompletions);
    next.openItems = next.openItems.filter((item) => !completed.has(item.id));
    changed = true;
  }

  if (Object.hasOwn(changes, "focus")) {
    const focus = changes.focus === null ? undefined : changes.focus?.trim();
    if (focus !== next.focus) {
      if (focus) next.focus = focus;
      else delete next.focus;
      changed = true;
    }
  }

  for (const text of changes.addItems ?? []) {
    const trimmed = text.trim();
    if (!trimmed) continue;
    next.openItems.push({ id: `item_${randomUUID()}`, text: trimmed });
    changed = true;
  }

  const pins = new Set(next.pinnedObservationIds);
  for (const id of changes.unpinObservationIds ?? []) {
    if (pins.delete(id)) changed = true;
  }
  for (const id of changes.pinObservationIds ?? []) {
    const trimmed = id.trim();
    if (trimmed && !pins.has(trimmed)) {
      pins.add(trimmed);
      changed = true;
    }
  }
  next.pinnedObservationIds = [...pins];

  if (next.openItems.length > TASK_STATE_BOUNDS.openItems) {
    return { ok: false, error: `A task snapshot can contain at most ${TASK_STATE_BOUNDS.openItems} open items.` };
  }
  if (next.pinnedObservationIds.length > TASK_STATE_BOUNDS.pins) {
    return { ok: false, error: `A task snapshot can contain at most ${TASK_STATE_BOUNDS.pins} pinned observations.` };
  }

  return { ok: true, changed, snapshot: changed ? boundTaskSnapshotV2(next) : current };
}


function readConfigFile(path: string, label: string, warnings: string[]): PrimeContextConfigV1 {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      warnings.push(`${label} config must be a JSON object; defaults were used.`);
      return {};
    }
    return parsed as PrimeContextConfigV1;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    warnings.push(`${label} config could not be read; defaults were used.`);
    return {};
  }
}

function resolveField<K extends keyof ResolvedPrimeContextConfig>(
  key: K,
  globalConfig: PrimeContextConfigV1,
  projectConfig: PrimeContextConfigV1,
  warnings: string[],
): ResolvedPrimeContextConfig[K] {
  const source = Object.hasOwn(projectConfig, key) ? projectConfig : globalConfig;
  if (!Object.hasOwn(source, key)) return DEFAULT_CONFIG[key];
  const value = source[key];
  const valid = key === "enabled"
    ? typeof value === "boolean"
    : key === "auxiliaryMode"
      ? value === "off" || value === "utility-gated"
      : key === "autoLearn"
        ? value === "off" || value === "utility-gated"
        : key === "auxiliaryModel" || key === "learningModel"
          ? value === null || (typeof value === "string" && value.trim().length > 0 && !value.includes("\0"))
          : key === "libraryPath"
            ? typeof value === "string" && value.trim().length > 0 && !value.includes("\0")
            : typeof value === "number" &&
              Number.isSafeInteger(value) &&
              (key === "minTextBytes" ? value >= 0 : key === "capsuleMaxBytes" ? value >= 512 : value > 0);
  if (!valid) {
    warnings.push(`Invalid ${key} configuration value; default ${DEFAULT_CONFIG[key]} was used.`);
    return DEFAULT_CONFIG[key];
  }
  return (key === "libraryPath" || key === "auxiliaryModel" || key === "learningModel"
    ? typeof value === "string" ? value.trim() : value
    : value) as ResolvedPrimeContextConfig[K];
}

export function loadPrimeContextConfig(cwd: string): LoadedConfig {
  const warnings: string[] = [];
  const globalConfig = readConfigFile(join(homedir(), ".prime", "agent", "prime-context.json"), "Global", warnings);
  const projectConfig = readConfigFile(join(cwd, ".prime", "agent", "prime-context.json"), "Project", warnings);
  return {
    config: {
      enabled: resolveField("enabled", globalConfig, projectConfig, warnings),
      minTextBytes: resolveField("minTextBytes", globalConfig, projectConfig, warnings),
      capsuleMaxBytes: resolveField("capsuleMaxBytes", globalConfig, projectConfig, warnings),
      readMaxBytes: resolveField("readMaxBytes", globalConfig, projectConfig, warnings),
      auxiliaryMode: resolveField("auxiliaryMode", globalConfig, projectConfig, warnings),
      auxiliaryModel: resolveField("auxiliaryModel", globalConfig, projectConfig, warnings),
      libraryPath: resolveField("libraryPath", globalConfig, projectConfig, warnings),
      skillBudgetTokens: resolveField("skillBudgetTokens", globalConfig, projectConfig, warnings),
      learningModel: resolveField("learningModel", globalConfig, projectConfig, warnings),
      autoLearn: resolveField("autoLearn", globalConfig, projectConfig, warnings),
    },
    warnings,
  };
}

export function storageRoot(): string {
  return process.env.PRIME_CONTEXT_HOME ?? join(homedir(), ".prime", "agent", "prime-context");
}
