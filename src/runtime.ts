const STEERING_PATH_MAX_BYTES = 1024;

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

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function messageRole(entry: RuntimeBranchEntry): string | undefined {
  return record(entry.message)?.role as string | undefined;
}

function entryId(entry: RuntimeBranchEntry, index: number): string {
  return entry.id ?? entry.entryId ?? `user:${index}`;
}

/** Select the active goal, or the root user entry of the current task. */
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

  const rootIndex = branch.findIndex((entry) => entry.type === "message" && messageRole(entry) === "user");
  if (rootIndex < 0) return undefined;
  const rootUserEntryId = entryId(branch[rootIndex], rootIndex);
  return { taskKey: rootUserEntryId, rootUserEntryId, source: "user" };
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
  return Buffer.byteLength(normalized, "utf8") <= STEERING_PATH_MAX_BYTES ? normalized : undefined;
}

/** Extract only path-shaped literals explicitly present in user steering. */
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
