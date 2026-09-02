import type { AgentMessage } from "@earendil-works/pi-agent-core";
import {
  estimateSkillTokens,
  rankSkillMatches,
  readCurrentSkillPair,
  upsertCurrentSkillPair,
  type CurrentSkillPair,
  type SkillLibrarySnapshot,
} from "./skills.js";

export type TaskOutcome = "success" | "failure" | "unknown";

export interface LearningEpisode {
  task: string;
  taskOutcome: TaskOutcome;
  messages: readonly AgentMessage[];
}

export interface LearnRequest {
  topic: string;
  episodes: readonly LearningEpisode[];
  library: SkillLibrarySnapshot;
  automatic: boolean;
}

export type Compilation =
  | { action: "none" }
  | {
      action: "upsert";
      name: string;
      patternMarkdown: string;
      skillMarkdown: string;
    };

export const LEARNING_BOUNDS = {
  maxEpisodes: 6,
  maxPairs: 2,
  maxInputTokens: 12_000,
  maxEpisodeTokens: 1_200,
  maxOutputTokens: 2_000,
} as const;

export interface KnowledgeCompilerCall {
  kind: "knowledge-compile";
  systemPrompt: string;
  prompt: string;
  maxOutputTokens: number;
  automatic: boolean;
  signal?: AbortSignal;
}

export interface KnowledgeCompilerCompletion {
  text: string;
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number | string | null;
}

/** One injected, broker-owned completion. The compiler never retries it. */
export type KnowledgeCompilerComplete = (
  call: KnowledgeCompilerCall,
) => Promise<KnowledgeCompilerCompletion>;

export interface LearningAccounting {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number | string | null;
}

export type LearnResult =
  | {
      action: "none";
      accounting: LearningAccounting;
      message: string;
    }
  | {
      action: "upsert";
      name: string;
      accounting: LearningAccounting;
      activationRequired: true;
      message: string;
    }
  | {
      action: "error";
      error: string;
      accounting?: LearningAccounting;
      message: string;
    };

export interface RunKnowledgeCompilerOptions {
  libraryPath: string;
  complete: KnowledgeCompilerComplete;
  signal?: AbortSignal;
}

export interface PackedLearningRequest {
  topic: string;
  episodes: readonly string[];
  pairs: readonly CurrentSkillPair[];
  prompt: string;
  estimatedInputTokens: number;
}

export const KNOWLEDGE_COMPILER_SYSTEM_PROMPT = `You compile current reusable Prime Context knowledge from bounded completed episodes.
Return exactly one JSON object and no surrounding prose:
{"action":"none"}
or
{"action":"upsert","name":"lowercase-hyphen-name","patternMarkdown":"...","skillMarkdown":"..."}

Create an upsert only when the supplied actions and authoritative feedback support a reusable distinction. Preserve economical successful behavior as well as corrections. Update a relevant existing pair instead of making a near-duplicate. The pattern must explain applicability, the easy-to-miss distinction, the better approach, and exceptions. The skill must be the smallest complete actionable procedure. Parameterize task-specific answers, IDs, paths, filenames, benchmark artifacts, and model quirks. Do not invent unconditional rules, nonexistent tools, mandatory diagnostics, review stages, proof steps, or new completion conditions. Do not grade, prove, or score the proposal.

The skill must be a native SKILL.md with a matching legal name and directory name, a description, disable-model-invocation: true, at most six short pc_triggers, pc_tools containing only required installed tool names, and a body of at most 350 estimated tokens. The pattern must be at most 800 estimated tokens. If the evidence is insufficient or the 24-pair library is full and no existing name should be updated, return {"action":"none"}.`;

const DECISIVE_TEXT = /\b(?:error|fail(?:ed|ure)?|pass(?:ed)?|success|correct(?:ed|ion)?|instead|recover(?:ed|y)?|retry|fixed?|result|outcome)\b/iu;
const MAX_VALUE_DEPTH = 6;
const MAX_VALUE_ITEMS = 32;
const MAX_FIELD_BYTES = 4_096;
const MAX_MESSAGE_BYTES = 2_800;

function oneLine(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function truncateUtf8(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value, "utf8") <= maxBytes) return value;
  const marker = "\n<...bounded omission...>\n";
  const markerBytes = Buffer.byteLength(marker, "utf8");
  const side = Math.max(0, Math.floor((maxBytes - markerBytes) / 2));
  const bytes = Buffer.from(value, "utf8");
  const head = bytes.subarray(0, side).toString("utf8").replace(/\uFFFD$/u, "");
  const tail = bytes.subarray(Math.max(0, bytes.length - side)).toString("utf8").replace(/^\uFFFD/u, "");
  return `${head}${marker}${tail}`;
}

function compactValue(value: unknown, seen: WeakSet<object>, depth = 0): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return truncateUtf8(value, MAX_FIELD_BYTES);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") return undefined;
  if (value instanceof Uint8Array) return `<binary ${value.byteLength} bytes omitted>`;
  if (depth >= MAX_VALUE_DEPTH) return "<nested value omitted>";
  if (seen.has(value as object)) return "<circular value omitted>";
  seen.add(value as object);
  if (Array.isArray(value)) {
    const result = value.slice(0, MAX_VALUE_ITEMS)
      .map((item) => compactValue(item, seen, depth + 1))
      .filter((item) => item !== undefined);
    if (value.length > MAX_VALUE_ITEMS) result.push(`<${value.length - MAX_VALUE_ITEMS} items omitted>`);
    return result;
  }
  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort().slice(0, MAX_VALUE_ITEMS)) {
    const item = compactValue(record[key], seen, depth + 1);
    if (item !== undefined) result[key] = item;
  }
  if (Object.keys(record).length > MAX_VALUE_ITEMS) result._omittedKeys = Object.keys(record).length - MAX_VALUE_ITEMS;
  return result;
}

function compactMessage(message: AgentMessage): string {
  const compacted = compactValue(message, new WeakSet());
  return truncateUtf8(JSON.stringify(compacted), MAX_MESSAGE_BYTES);
}

function searchableMessageText(message: AgentMessage): string {
  return compactMessage(message).slice(0, 8_000);
}

function lexicalTokens(value: string): Set<string> {
  const normalized = value.normalize("NFKC").toLowerCase().replace(/[\p{P}\p{S}]+/gu, " ");
  return new Set(normalized.split(/\s+/u).filter(Boolean));
}

function overlap(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  let count = 0;
  for (const token of left) if (right.has(token)) count += 1;
  return count;
}

export function deriveLearningTopic(
  explicitTopic: string | undefined,
  episodes: readonly LearningEpisode[],
): string | undefined {
  const explicit = explicitTopic?.trim();
  if (explicit) return oneLine(explicit);
  for (let index = episodes.length - 1; index >= 0; index -= 1) {
    const task = oneLine(episodes[index].task);
    if (task) return truncateUtf8(task, 512);
  }
  return undefined;
}

interface RankedEpisode {
  episode: LearningEpisode;
  index: number;
  score: number;
  topicScore: number;
}

function rankEpisodes(topic: string, episodes: readonly LearningEpisode[]): RankedEpisode[] {
  const topicTokens = lexicalTokens(topic);
  return episodes.map((episode, index) => {
    const taskTokens = lexicalTokens(episode.task);
    const messageText = episode.messages.map(searchableMessageText).join("\n");
    const messageTokens = lexicalTokens(messageText);
    const decisive = DECISIVE_TEXT.test(messageText) ? 2 : 0;
    const labelled = episode.taskOutcome === "unknown" ? 0 : 1;
    const topicScore = overlap(topicTokens, taskTokens) * 20 + overlap(topicTokens, messageTokens) * 4;
    return {
      episode,
      index,
      topicScore,
      score: topicScore + decisive + labelled,
    };
  }).sort((left, right) => right.score - left.score || left.index - right.index);
}

/** Select at most six topic-relevant episodes, preserving a real success/failure contrast when available. */
export function selectLearningEpisodes(
  topic: string,
  episodes: readonly LearningEpisode[],
): Array<{ episode: LearningEpisode; index: number }> {
  const rankedAll = rankEpisodes(topic, episodes);
  const ranked = rankedAll.some((candidate) => candidate.topicScore > 0)
    ? rankedAll.filter((candidate) => candidate.topicScore > 0)
    : rankedAll;
  const selected: RankedEpisode[] = [];
  const selectedIndices = new Set<number>();
  const add = (candidate: RankedEpisode | undefined): void => {
    if (!candidate || selectedIndices.has(candidate.index) || selected.length >= LEARNING_BOUNDS.maxEpisodes) return;
    selected.push(candidate);
    selectedIndices.add(candidate.index);
  };

  const bestSuccess = ranked.find((candidate) => candidate.episode.taskOutcome === "success");
  const bestFailure = ranked.find((candidate) => candidate.episode.taskOutcome === "failure");
  if (bestSuccess && bestFailure) {
    if (bestSuccess.score > bestFailure.score || bestSuccess.score === bestFailure.score && bestSuccess.index < bestFailure.index) {
      add(bestSuccess);
      add(bestFailure);
    } else {
      add(bestFailure);
      add(bestSuccess);
    }
  }
  for (const candidate of ranked) add(candidate);
  return selected.sort((left, right) => left.index - right.index)
    .map(({ episode, index }) => ({ episode, index }));
}

function messagePriority(message: AgentMessage, topicTokens: ReadonlySet<string>, index: number, total: number): number {
  const text = searchableMessageText(message);
  const record = message as unknown as Record<string, unknown>;
  const role = typeof record.role === "string" ? record.role : "";
  return overlap(topicTokens, lexicalTokens(text)) * 20 +
    (DECISIVE_TEXT.test(text) ? 8 : 0) +
    (/tool|result/iu.test(role) ? 5 : 0) +
    (role === "user" ? 3 : 0) +
    (index === total - 1 ? 4 : 0);
}

function renderEpisode(episode: LearningEpisode, sourceIndex: number, topic: string): string {
  const task = truncateUtf8(oneLine(episode.task), 1_600);
  const header = [
    `EPISODE ${sourceIndex + 1}`,
    `task=${JSON.stringify(task)}`,
    `taskOutcome=${episode.taskOutcome}`,
  ];
  const topicTokens = lexicalTokens(topic);
  const priorities = episode.messages.map((message, index) => ({
    index,
    priority: messagePriority(message, topicTokens, index, episode.messages.length),
  })).sort((left, right) => right.priority - left.priority || left.index - right.index);

  const orderedCandidates: number[] = [];
  const queued = new Set<number>();
  for (const candidate of priorities) {
    for (const index of [candidate.index, candidate.index - 1, candidate.index + 1]) {
      if (index < 0 || index >= episode.messages.length || queued.has(index)) continue;
      queued.add(index);
      orderedCandidates.push(index);
    }
  }

  const selected = new Set<number>();
  for (const index of orderedCandidates) {
    const candidate = new Set(selected);
    candidate.add(index);
    const lines = [...candidate].sort((left, right) => left - right)
      .map((messageIndex) => `message[${messageIndex}]=${compactMessage(episode.messages[messageIndex])}`);
    const rendered = [...header, ...lines].join("\n");
    if (estimateSkillTokens(rendered) <= LEARNING_BOUNDS.maxEpisodeTokens) selected.add(index);
  }

  const lines = [...selected].sort((left, right) => left - right)
    .map((index) => `message[${index}]=${compactMessage(episode.messages[index])}`);
  return truncateUtf8(
    [...header, ...lines].join("\n"),
    LEARNING_BOUNDS.maxEpisodeTokens * 4,
  );
}

function renderPair(pair: CurrentSkillPair): string {
  return [
    `CURRENT PAIR ${pair.name}`,
    "PATTERN:",
    pair.patternMarkdown.trim(),
    "SKILL:",
    pair.skillMarkdown.trim(),
  ].join("\n");
}

async function selectCurrentPairs(
  topic: string,
  library: SkillLibrarySnapshot,
  libraryPath: string,
): Promise<CurrentSkillPair[]> {
  const installedForMatching = new Set(library.entries.flatMap((entry) => [...entry.requiredTools]));
  const ranked = rankSkillMatches(library, {
    taskText: topic,
    installedToolNames: installedForMatching,
  });
  const pairs: CurrentSkillPair[] = [];
  for (const match of ranked) {
    if (pairs.length >= LEARNING_BOUNDS.maxPairs) break;
    try {
      const pair = await readCurrentSkillPair(libraryPath, match.entry.name);
      if (pair) pairs.push(pair);
    } catch {
      // An invalid current pair is not compiler input and does not trigger repair work.
    }
  }
  return pairs;
}

function learningPrompt(topic: string, automatic: boolean, episodes: readonly string[], pairs: readonly CurrentSkillPair[]): string {
  return [
    `topic=${JSON.stringify(topic)}`,
    `automatic=${automatic ? "true" : "false"}`,
    "Use only the bounded episodes and current pairs below.",
    "",
    "EPISODES",
    episodes.length === 0 ? "(none)" : episodes.join("\n\n"),
    "",
    "RELEVANT CURRENT PAIRS",
    pairs.length === 0 ? "(none)" : pairs.map(renderPair).join("\n\n"),
  ].join("\n");
}

export async function packLearningRequest(
  request: LearnRequest,
  libraryPath: string,
): Promise<PackedLearningRequest> {
  const topic = deriveLearningTopic(request.topic, request.episodes);
  if (!topic) throw new Error("A learning topic is required");

  const episodeBlocks: string[] = [];
  for (const { episode, index } of selectLearningEpisodes(topic, request.episodes)) {
    const block = renderEpisode(episode, index, topic);
    const candidate = learningPrompt(topic, request.automatic, [...episodeBlocks, block], []);
    if (estimateSkillTokens(KNOWLEDGE_COMPILER_SYSTEM_PROMPT) + estimateSkillTokens(candidate) <=
      LEARNING_BOUNDS.maxInputTokens) episodeBlocks.push(block);
  }

  const pairs: CurrentSkillPair[] = [];
  for (const pair of await selectCurrentPairs(topic, request.library, libraryPath)) {
    const candidatePairs = [...pairs, pair];
    const candidate = learningPrompt(topic, request.automatic, episodeBlocks, candidatePairs);
    if (estimateSkillTokens(KNOWLEDGE_COMPILER_SYSTEM_PROMPT) + estimateSkillTokens(candidate) <=
      LEARNING_BOUNDS.maxInputTokens) pairs.push(pair);
  }

  const prompt = learningPrompt(topic, request.automatic, episodeBlocks, pairs);
  const estimatedInputTokens = estimateSkillTokens(KNOWLEDGE_COMPILER_SYSTEM_PROMPT) + estimateSkillTokens(prompt);
  if (estimatedInputTokens > LEARNING_BOUNDS.maxInputTokens) {
    throw new Error(`Learning input exceeds ${LEARNING_BOUNDS.maxInputTokens} estimated tokens`);
  }
  return { topic, episodes: episodeBlocks, pairs, prompt, estimatedInputTokens };
}

function parseCompilation(text: string): Compilation {
  const parsed: unknown = JSON.parse(text.trim());
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Compiler output must be one JSON object");
  }
  const record = parsed as Record<string, unknown>;
  if (record.action === "none") return { action: "none" };
  if (record.action !== "upsert" || typeof record.name !== "string" ||
    typeof record.patternMarkdown !== "string" || typeof record.skillMarkdown !== "string") {
    throw new Error("Compiler output must contain one recognized none or upsert action");
  }
  return {
    action: "upsert",
    name: record.name,
    patternMarkdown: record.patternMarkdown,
    skillMarkdown: record.skillMarkdown,
  };
}

function accountingFor(
  completion: KnowledgeCompilerCompletion,
  estimatedInputTokens: number,
): LearningAccounting {
  return {
    provider: completion.provider ?? "unknown",
    model: completion.model ?? "unknown",
    inputTokens: completion.inputTokens ?? estimatedInputTokens,
    outputTokens: completion.outputTokens ?? estimateSkillTokens(completion.text),
    cost: completion.cost ?? null,
  };
}

function accountingLine(accounting: LearningAccounting): string {
  const model = accounting.provider === "unknown"
    ? accounting.model
    : `${accounting.provider}/${accounting.model}`;
  return `model=${model} input=${accounting.inputTokens} output=${accounting.outputTokens} cost=${accounting.cost ?? "unknown"}`;
}

function errorResult(error: unknown, accounting?: LearningAccounting): LearnResult {
  const detail = oneLine(error instanceof Error ? error.message : String(error));
  return {
    action: "error",
    error: detail,
    ...(accounting === undefined ? {} : { accounting }),
    message: [`learning failed: ${detail}`, ...(accounting === undefined ? [] : [accountingLine(accounting)])].join("\n"),
  };
}

/** Pack, call once, parse once, and directly apply at most one current-pair upsert. */
export async function runKnowledgeCompiler(
  request: LearnRequest,
  options: RunKnowledgeCompilerOptions,
): Promise<LearnResult> {
  let packed: PackedLearningRequest;
  try {
    packed = await packLearningRequest(request, options.libraryPath);
  } catch (error) {
    return errorResult(error);
  }

  let completion: KnowledgeCompilerCompletion;
  try {
    completion = await options.complete({
      kind: "knowledge-compile",
      systemPrompt: KNOWLEDGE_COMPILER_SYSTEM_PROMPT,
      prompt: packed.prompt,
      maxOutputTokens: LEARNING_BOUNDS.maxOutputTokens,
      automatic: request.automatic,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
  } catch (error) {
    return errorResult(error);
  }

  const accounting = accountingFor(completion, packed.estimatedInputTokens);
  let compilation: Compilation;
  try {
    compilation = parseCompilation(completion.text);
  } catch (error) {
    return errorResult(error, accounting);
  }

  if (compilation.action === "none") {
    return {
      action: "none",
      accounting,
      message: ["no reusable skill change", accountingLine(accounting)].join("\n"),
    };
  }

  try {
    await upsertCurrentSkillPair(options.libraryPath, compilation);
  } catch (error) {
    return errorResult(error, accounting);
  }

  return {
    action: "upsert",
    name: compilation.name,
    accounting,
    activationRequired: true,
    message: [
      `upserted ${compilation.name}`,
      accountingLine(accounting),
      "run /reload or start a new session to activate the updated library",
    ].join("\n"),
  };
}
