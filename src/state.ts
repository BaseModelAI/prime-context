import { randomUUID } from "node:crypto";
import { TASK_RUNTIME_BOUNDS, type TaskRuntimeV2 } from "./runtime.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const SNAPSHOT_ENTRY_TYPE = "prime-context.task-snapshot";
export const RUNTIME_STATE_ENTRY_TYPE = "prime-context.runtime-state";
export const PRIME_CONTEXT_ANCHOR_TYPE = "prime_context_anchor";
export const PRIME_CONTEXT_STATE_TYPE = "prime_context_state";
export const PRIME_CONTEXT_FOLD_TYPE = "prime_context_fold";
export const PRIME_CONTEXT_ANCHOR_SCHEMA = "prime_context_anchor/v1" as const;
export const PRIME_CONTEXT_STATE_SCHEMA = "prime_context_state/v1" as const;
export const PRIME_CONTEXT_FOLD_SCHEMA = "prime_context_fold/v1" as const;

export type PrimeContextMode = "on" | "off";

export interface PrimeContextConfigV1 {
  enabled?: boolean;
  minTextBytes?: number;
  capsuleMaxBytes?: number;
  readMaxBytes?: number;
}

export interface ResolvedPrimeContextConfig {
  enabled: boolean;
  minTextBytes: number;
  capsuleMaxBytes: number;
  readMaxBytes: number;
}

export const DEFAULT_CONFIG: ResolvedPrimeContextConfig = {
  enabled: true,
  minTextBytes: 24576,
  capsuleMaxBytes: 6144,
  readMaxBytes: 65536,
};

export interface TaskSnapshotV1 {
  schema: "prime-context.task-snapshot/v1";
  focus?: string;
  openItems: Array<{ id: string; text: string }>;
  pinnedObservationIds: string[];
  updatedAt: string;
}

export interface SnapshotChanges {
  focus?: string | null;
  addItems?: string[];
  completeItemIds?: string[];
  pinObservationIds?: string[];
  unpinObservationIds?: string[];
}

export type SnapshotUpdateResult =
  | { ok: true; changed: boolean; snapshot: TaskSnapshotV1 }
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
  objectiveVersion: number;
  requirementsRevision: number;
}

export interface PrimeContextStateDetails {
  schema: typeof PRIME_CONTEXT_STATE_SCHEMA;
  taskKey: string;
  requirementsRevision: number;
  workspaceRevision: number;
}

export interface PrimeContextFoldDetails {
  schema: typeof PRIME_CONTEXT_FOLD_SCHEMA;
  taskKey: string;
  generation: number;
  throughEntryId: string;
}

export interface PersistedControlMessage {
  customType: typeof PRIME_CONTEXT_ANCHOR_TYPE | typeof PRIME_CONTEXT_STATE_TYPE | typeof PRIME_CONTEXT_FOLD_TYPE;
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
  if (customType !== PRIME_CONTEXT_ANCHOR_TYPE && customType !== PRIME_CONTEXT_STATE_TYPE &&
    customType !== PRIME_CONTEXT_FOLD_TYPE) return undefined;
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

function isSnapshot(value: unknown): value is TaskSnapshotV1 {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TaskSnapshotV1>;
  return (
    candidate.schema === "prime-context.task-snapshot/v1" &&
    Array.isArray(candidate.openItems) &&
    Array.isArray(candidate.pinnedObservationIds) &&
    typeof candidate.updatedAt === "string"
  );
}

export function emptySnapshot(now = new Date().toISOString()): TaskSnapshotV1 {
  return {
    schema: "prime-context.task-snapshot/v1",
    openItems: [],
    pinnedObservationIds: [],
    updatedAt: now,
  };
}

function cloneSnapshot(snapshot: TaskSnapshotV1): TaskSnapshotV1 {
  return {
    schema: "prime-context.task-snapshot/v1",
    ...(snapshot.focus === undefined ? {} : { focus: snapshot.focus }),
    openItems: snapshot.openItems.map((item) => ({ ...item })),
    pinnedObservationIds: [...snapshot.pinnedObservationIds],
    updatedAt: snapshot.updatedAt,
  };
}

export function loadLatestSnapshot(branch: readonly BranchEntryLike[]): TaskSnapshotV1 {
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    const entry = branch[index];
    if (entry.type === "custom" && entry.customType === SNAPSHOT_ENTRY_TYPE && isSnapshot(entry.data)) {
      return cloneSnapshot(entry.data);
    }
  }
  return emptySnapshot();
}

export function isTaskRuntimeV2(value: unknown): value is TaskRuntimeV2 {
  if (!value || typeof value !== "object") return false;
  const runtime = value as Partial<TaskRuntimeV2>;
  return runtime.schema === "prime-context.runtime/v2" &&
    typeof runtime.taskKey === "string" && runtime.taskKey.length > 0 &&
    typeof runtime.objectiveVersion === "number" &&
    typeof runtime.requirementsRevision === "number" &&
    typeof runtime.requirementsLocked === "boolean" &&
    typeof runtime.workspaceRevision === "number" &&
    typeof runtime.turnSequence === "number" &&
    Array.isArray(runtime.validationGates) &&
    Array.isArray(runtime.validations) &&
    Array.isArray(runtime.activeDiagnostics) &&
    Array.isArray(runtime.modifiedResources) &&
    Array.isArray(runtime.recentSubjects) &&
    Array.isArray(runtime.recentIntentKeys) &&
    Array.isArray(runtime.steeringDeltas);
}

export function cloneTaskRuntime(runtime: TaskRuntimeV2): TaskRuntimeV2 {
  return structuredClone(runtime);
}

function normalizedLoadedRuntime(runtime: TaskRuntimeV2): TaskRuntimeV2 {
  const cloned = cloneTaskRuntime(runtime);
  const steeringCandidates = Array.isArray(cloned.steeringResources) ? cloned.steeringResources : [];
  cloned.steeringResources = [];
  let steeringBytes = 0;
  for (const resource of steeringCandidates) {
    if (!resource || typeof resource.path !== "string" || typeof resource.userEntryId !== "string" ||
      typeof resource.requirementsRevision !== "number") continue;
    const size = Buffer.byteLength(resource.path, "utf8");
    if (size === 0 || size > TASK_RUNTIME_BOUNDS.steeringResourcePathBytes ||
      steeringBytes + size > TASK_RUNTIME_BOUNDS.steeringResourcesBytes) continue;
    cloned.steeringResources.push({ ...resource });
    steeringBytes += size;
    if (cloned.steeringResources.length >= TASK_RUNTIME_BOUNDS.steeringResources) break;
  }
  cloned.activeDiagnostics = cloned.activeDiagnostics.map((diagnostic) => ({
    ...diagnostic,
    resources: Array.isArray(diagnostic.resources)
      ? diagnostic.resources.filter((resource): resource is string => typeof resource === "string")
      : [],
  }));
  const fold = cloned.fold as unknown as Record<string, unknown> | undefined;
  if (fold && (
    !Number.isSafeInteger(fold.generation) || (fold.generation as number) < 1 ||
    typeof fold.throughEntryId !== "string" || !fold.throughEntryId ||
    !Array.isArray(fold.retainedEntryIds) ||
    fold.retainedEntryIds.length > TASK_RUNTIME_BOUNDS.foldRetainedEntryIds ||
    !fold.retainedEntryIds.every((id) => typeof id === "string" && id.length > 0) ||
    typeof fold.renderedMessage !== "string" ||
    Buffer.byteLength(fold.renderedMessage, "utf8") > TASK_RUNTIME_BOUNDS.foldRenderedBytes
  )) delete cloned.fold;
  return cloned;
}

export function loadLatestRuntime(
  branch: readonly BranchEntryLike[],
  taskKey: string,
): TaskRuntimeV2 | undefined {
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    const entry = branch[index];
    if (entry.type !== "custom" || entry.customType !== RUNTIME_STATE_ENTRY_TYPE || !isTaskRuntimeV2(entry.data)) {
      continue;
    }
    if (entry.data.taskKey === taskKey) return normalizedLoadedRuntime(entry.data);
  }
  return undefined;
}

export function applySnapshotChanges(
  current: TaskSnapshotV1,
  changes: SnapshotChanges,
  now = new Date().toISOString(),
): SnapshotUpdateResult {
  const next = cloneSnapshot(current);
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

  if (next.openItems.length > 32) {
    return { ok: false, error: "A task snapshot can contain at most 32 open items." };
  }
  if (next.pinnedObservationIds.length > 16) {
    return { ok: false, error: "A task snapshot can contain at most 16 pinned observations." };
  }

  if (changed) next.updatedAt = now;
  return { ok: true, changed, snapshot: next };
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
  const valid =
    key === "enabled"
      ? typeof value === "boolean"
      : typeof value === "number" &&
        Number.isSafeInteger(value) &&
        (key === "minTextBytes" ? value >= 0 : key === "capsuleMaxBytes" ? value >= 512 : value > 0);
  if (!valid) {
    warnings.push(`Invalid ${key} configuration value; default ${DEFAULT_CONFIG[key]} was used.`);
    return DEFAULT_CONFIG[key];
  }
  return value as ResolvedPrimeContextConfig[K];
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
    },
    warnings,
  };
}

export function storageRoot(): string {
  return process.env.PRIME_CONTEXT_HOME ?? join(homedir(), ".prime", "agent", "prime-context");
}
