import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import {
  loadSkillsFromDir,
  parseFrontmatter,
  type ResourceDiagnostic,
  type SkillFrontmatter,
} from "@earendil-works/pi-coding-agent";

export const SKILL_BOUNDS = {
  maxPairs: 24,
  maxSelected: 2,
  maxTriggersPerSkill: 6,
  maxPatternTokens: 800,
  maxSkillBodyTokens: 350,
} as const;

const SKILL_NAME = /^(?!.*--)[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const MAX_TRIGGER_CHARACTERS = 120;
const MAX_REQUIRED_TOOLS = 16;
const MAX_TOOL_NAME_CHARACTERS = 128;

export interface SkillCatalogEntry {
  name: string;
  description: string;
  triggers: readonly string[];
  requiredTools: readonly string[];
  body: string;
  estimatedTokens: number;
  filePath: string;
}

export interface SkillLibrarySnapshot {
  revision: number;
  entries: readonly SkillCatalogEntry[];
}

export interface SkillLibraryLoadOptions {
  libraryPath: string;
  revision?: number;
  source?: string;
}

export interface SkillLibraryLoadResult {
  snapshot: SkillLibrarySnapshot;
  diagnostics: readonly ResourceDiagnostic[];
}

export interface RankedSkillMatch {
  entry: SkillCatalogEntry;
  explicit: boolean;
  matchedTriggers: readonly string[];
  matchedSpecificTriggers: readonly string[];
  triggerSpecificity: number;
  descriptionOverlap: number;
}

export interface SkillSelectionInput {
  taskText: string;
  installedToolNames: Iterable<string>;
  skillBudgetTokens: number;
  explicitSkillNames?: readonly string[];
}

export interface SkillSelection {
  selectedEntries: readonly SkillCatalogEntry[];
  selectedNames: readonly string[];
  rankedMatches: readonly RankedSkillMatch[];
  highConfidence: boolean;
  packet: string;
}

export interface CurrentSkillPair {
  name: string;
  patternMarkdown: string;
  skillMarkdown: string;
  patternPath: string;
  skillPath: string;
}

export interface CurrentSkillPairInput {
  name: string;
  patternMarkdown: string;
  skillMarkdown: string;
}

interface ParsedSkillMarkdown {
  name: string;
  description: string;
  triggers: string[];
  requiredTools: string[];
  body: string;
  estimatedTokens: number;
}

export function estimateSkillTokens(text: string): number {
  return Math.ceil(Buffer.byteLength(text, "utf8") / 4);
}

export function resolveSkillLibraryPath(cwd: string, libraryPath: string): string {
  return isAbsolute(libraryPath) ? resolve(libraryPath) : resolve(cwd, libraryPath);
}

export function isValidSkillName(name: string): boolean {
  return SKILL_NAME.test(name);
}

function compareStableNames(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function asStringList(value: unknown, field: string, maxItems?: number): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    throw new Error(`${field} must be an array of non-empty strings`);
  }
  if (maxItems !== undefined && value.length > maxItems) {
    throw new Error(`${field} must contain at most ${maxItems} values`);
  }
  const values = value.map((item) => (item as string).trim());
  if (new Set(values).size !== values.length) throw new Error(`${field} must not contain duplicates`);
  return values;
}

function parseSkillMarkdown(markdown: string, expectedName?: string): ParsedSkillMarkdown {
  const { frontmatter, body } = parseFrontmatter<SkillFrontmatter>(markdown);
  const name = frontmatter.name;
  if (typeof name !== "string" || !isValidSkillName(name)) {
    throw new Error("skill frontmatter must contain a valid lowercase-hyphen name");
  }
  if (expectedName !== undefined && name !== expectedName) {
    throw new Error(`skill frontmatter name "${name}" does not match "${expectedName}"`);
  }
  const description = frontmatter.description;
  if (typeof description !== "string" || description.trim().length === 0 || description.length > 1024) {
    throw new Error("skill frontmatter must contain a native description of at most 1024 characters");
  }
  if (frontmatter["disable-model-invocation"] !== true) {
    throw new Error("skill frontmatter must set disable-model-invocation: true");
  }
  const triggers = asStringList(frontmatter.pc_triggers, "pc_triggers", SKILL_BOUNDS.maxTriggersPerSkill);
  if (triggers.some((trigger) => [...trigger].length > MAX_TRIGGER_CHARACTERS)) {
    throw new Error(`pc_triggers values must be at most ${MAX_TRIGGER_CHARACTERS} characters`);
  }
  const requiredTools = asStringList(frontmatter.pc_tools, "pc_tools", MAX_REQUIRED_TOOLS);
  if (requiredTools.some((tool) => [...tool].length > MAX_TOOL_NAME_CHARACTERS || /\s/u.test(tool))) {
    throw new Error(`pc_tools values must be whitespace-free and at most ${MAX_TOOL_NAME_CHARACTERS} characters`);
  }
  const trimmedBody = body.trim();
  if (trimmedBody.length === 0) throw new Error("skill body must not be empty");
  const estimatedTokens = estimateSkillTokens(trimmedBody);
  if (estimatedTokens > SKILL_BOUNDS.maxSkillBodyTokens) {
    throw new Error(`skill body exceeds ${SKILL_BOUNDS.maxSkillBodyTokens} estimated tokens`);
  }
  return {
    name,
    description: description.trim(),
    triggers,
    requiredTools,
    body: trimmedBody,
    estimatedTokens,
  };
}

function diagnostic(message: string, path?: string): ResourceDiagnostic {
  return { type: "warning", message, ...(path === undefined ? {} : { path }) };
}

function emptySnapshot(revision: number): SkillLibrarySnapshot {
  return Object.freeze({ revision, entries: Object.freeze([]) });
}

/** Load one bounded native skill/pattern library without creating or merging directories. */
export function loadSkillLibrary(options: SkillLibraryLoadOptions): SkillLibraryLoadResult {
  const revision = options.revision ?? 1;
  const skillsDir = join(options.libraryPath, "skills");
  if (!existsSync(skillsDir)) return { snapshot: emptySnapshot(revision), diagnostics: [] };
  try {
    if (!statSync(skillsDir).isDirectory()) {
      return {
        snapshot: emptySnapshot(revision),
        diagnostics: [diagnostic("Prime Context skill path is not a directory", skillsDir)],
      };
    }
  } catch (error) {
    return {
      snapshot: emptySnapshot(revision),
      diagnostics: [diagnostic(`Prime Context skill path could not be read: ${(error as Error).message}`, skillsDir)],
    };
  }

  const native = loadSkillsFromDir({ dir: skillsDir, source: options.source ?? "prime-context" });
  const diagnostics: ResourceDiagnostic[] = [...native.diagnostics];
  const entries: SkillCatalogEntry[] = [];
  const seen = new Set<string>();
  const skills = [...native.skills].sort((left, right) => compareStableNames(left.name, right.name));

  for (const skill of skills) {
    if (entries.length >= SKILL_BOUNDS.maxPairs) {
      diagnostics.push(diagnostic(`Skill library is limited to ${SKILL_BOUNDS.maxPairs} current pairs`, skillsDir));
      break;
    }
    if (skill.kind !== "markdown" || basename(skill.filePath) !== "SKILL.md") {
      diagnostics.push(diagnostic("Prime Context libraries accept only native Markdown SKILL.md files", skill.filePath));
      continue;
    }
    if (seen.has(skill.name)) {
      diagnostics.push(diagnostic(`Duplicate skill name "${skill.name}" was ignored`, skill.filePath));
      continue;
    }
    try {
      if (basename(dirname(skill.filePath)) !== skill.name) {
        throw new Error(`skill directory must match name "${skill.name}"`);
      }
      const parsed = parseSkillMarkdown(readFileSync(skill.filePath, "utf8"), skill.name);
      const patternPath = join(options.libraryPath, "patterns", `${parsed.name}.md`);
      if (!existsSync(patternPath) || !statSync(patternPath).isFile()) {
        throw new Error(`matching pattern page is missing: ${patternPath}`);
      }
      const patternMarkdown = readFileSync(patternPath, "utf8");
      if (patternMarkdown.trim().length === 0) throw new Error("matching pattern page is empty");
      if (estimateSkillTokens(patternMarkdown) > SKILL_BOUNDS.maxPatternTokens) {
        throw new Error(`pattern page exceeds ${SKILL_BOUNDS.maxPatternTokens} estimated tokens`);
      }
      seen.add(parsed.name);
      entries.push(Object.freeze({
        name: parsed.name,
        description: parsed.description,
        triggers: Object.freeze(parsed.triggers),
        requiredTools: Object.freeze(parsed.requiredTools),
        body: parsed.body,
        estimatedTokens: parsed.estimatedTokens,
        filePath: skill.filePath,
      }));
    } catch (error) {
      diagnostics.push(diagnostic(`Invalid Prime Context skill pair: ${(error as Error).message}`, skill.filePath));
    }
  }

  return {
    snapshot: Object.freeze({ revision, entries: Object.freeze(entries) }),
    diagnostics: Object.freeze(diagnostics),
  };
}

/** Unicode case/punctuation/whitespace normalization used by routing and pair matching. */
export function normalizeSkillMatchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function lexicalTokens(value: string): string[] {
  const normalized = normalizeSkillMatchText(value);
  return normalized.length === 0 ? [] : normalized.split(" ").filter(Boolean);
}

function exactSkillNamesInTask(taskText: string, entries: readonly SkillCatalogEntry[]): Set<string> {
  const tokens = taskText.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu) ?? [];
  const tokenSet = new Set(tokens);
  return new Set(entries.flatMap((entry) => tokenSet.has(entry.name) ? [entry.name] : []));
}

function phraseMatches(normalizedTask: string, phrase: string): boolean {
  const normalizedPhrase = normalizeSkillMatchText(phrase);
  return normalizedPhrase.length > 0 && ` ${normalizedTask} `.includes(` ${normalizedPhrase} `);
}

function toolsAvailable(entry: SkillCatalogEntry, installedTools: ReadonlySet<string>): boolean {
  return entry.requiredTools.every((tool) => installedTools.has(tool));
}

function compareMatches(left: RankedSkillMatch, right: RankedSkillMatch): number {
  if (left.explicit !== right.explicit) return left.explicit ? -1 : 1;
  if (left.matchedTriggers.length !== right.matchedTriggers.length) {
    return right.matchedTriggers.length - left.matchedTriggers.length;
  }
  if (left.triggerSpecificity !== right.triggerSpecificity) {
    return right.triggerSpecificity - left.triggerSpecificity;
  }
  if (left.descriptionOverlap !== right.descriptionOverlap) {
    return right.descriptionOverlap - left.descriptionOverlap;
  }
  return compareStableNames(left.entry.name, right.entry.name);
}

export function rankSkillMatches(
  snapshot: SkillLibrarySnapshot,
  input: Omit<SkillSelectionInput, "skillBudgetTokens">,
): RankedSkillMatch[] {
  const normalizedTask = normalizeSkillMatchText(input.taskText);
  const taskTokens = new Set(lexicalTokens(input.taskText));
  const installedTools = new Set(input.installedToolNames);
  const explicit = exactSkillNamesInTask(input.taskText, snapshot.entries);
  for (const name of input.explicitSkillNames ?? []) {
    if (snapshot.entries.some((entry) => entry.name === name)) explicit.add(name);
  }

  return snapshot.entries.flatMap((entry): RankedSkillMatch[] => {
    if (!toolsAvailable(entry, installedTools)) return [];
    const matchedTriggers = entry.triggers.filter((trigger) => phraseMatches(normalizedTask, trigger));
    const matchedSpecificTriggers = matchedTriggers.filter((trigger) => lexicalTokens(trigger).length > 1);
    const descriptionOverlap = new Set(lexicalTokens(entry.description).filter((token) => taskTokens.has(token))).size;
    const isExplicit = explicit.has(entry.name);
    const eligible = isExplicit || matchedSpecificTriggers.length > 0 || matchedTriggers.length >= 2 || descriptionOverlap > 0;
    if (!eligible) return [];
    return [{
      entry,
      explicit: isExplicit,
      matchedTriggers,
      matchedSpecificTriggers,
      triggerSpecificity: matchedTriggers.reduce(
        (total, trigger) => total + lexicalTokens(trigger).length * 100 + [...normalizeSkillMatchText(trigger)].length,
        0,
      ),
      descriptionOverlap,
    }];
  }).sort(compareMatches);
}

function hasClearMargin(first: RankedSkillMatch, second: RankedSkillMatch | undefined): boolean {
  if (!second) return first.matchedTriggers.length > 0 || first.descriptionOverlap >= 2;
  if (first.matchedTriggers.length > second.matchedTriggers.length) return true;
  if (first.matchedTriggers.length > 0 && first.triggerSpecificity >= second.triggerSpecificity + 100) return true;
  return first.descriptionOverlap >= second.descriptionOverlap + 2;
}

export function skillRoutingConfidence(matches: readonly RankedSkillMatch[]): "high" | "ambiguous" | "none" {
  const first = matches[0];
  if (!first) return "none";
  if (first.explicit) return "high";
  if (first.matchedSpecificTriggers.length > 0 &&
    matches.slice(1).every((match) => match.matchedSpecificTriggers.length === 0)) return "high";
  return hasClearMargin(first, matches[1]) ? "high" : "ambiguous";
}

export function validateSelectedSkillNames(
  names: readonly string[],
  snapshot: SkillLibrarySnapshot,
  installedToolNames: Iterable<string>,
): SkillCatalogEntry[] {
  const installedTools = new Set(installedToolNames);
  const byName = new Map(snapshot.entries.map((entry) => [entry.name, entry]));
  const selected: SkillCatalogEntry[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) continue;
    seen.add(name);
    const entry = byName.get(name);
    if (!entry || !toolsAvailable(entry, installedTools)) continue;
    selected.push(entry);
    if (selected.length === SKILL_BOUNDS.maxSelected) break;
  }
  return selected;
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function renderSelectedSkillsPacket(entries: readonly SkillCatalogEntry[]): string {
  if (entries.length === 0) return "";
  const selected = entries.slice(0, SKILL_BOUNDS.maxSelected);
  return [
    "<prime_context_skills>",
    "The following procedures were selected for this task. They are already loaded; do not spend a tool call reading them first. Apply only when their stated conditions and the available tools fit.",
    "",
    ...selected.flatMap((entry) => [
      `<skill name="${entry.name}">`,
      escapeXml(entry.body),
      "</skill>",
    ]),
    "</prime_context_skills>",
  ].join("\n");
}

export function renderSkillScoutCatalog(
  snapshot: SkillLibrarySnapshot,
  entries: readonly SkillCatalogEntry[] = snapshot.entries,
): string {
  const allowed = new Set(snapshot.entries.map((entry) => entry.name));
  return JSON.stringify({
    skills: entries
      .filter((entry) => allowed.has(entry.name))
      .slice(0, SKILL_BOUNDS.maxPairs)
      .map((entry) => ({
        name: entry.name,
        description: entry.description,
        triggers: [...entry.triggers],
        requiredTools: [...entry.requiredTools],
      })),
  });
}

export function selectSkills(snapshot: SkillLibrarySnapshot, input: SkillSelectionInput): SkillSelection {
  const rankedMatches = rankSkillMatches(snapshot, input);
  const selectedEntries: SkillCatalogEntry[] = [];
  for (const match of rankedMatches) {
    if (selectedEntries.length === SKILL_BOUNDS.maxSelected) break;
    const candidate = [...selectedEntries, match.entry];
    if (estimateSkillTokens(renderSelectedSkillsPacket(candidate)) <= input.skillBudgetTokens) {
      selectedEntries.push(match.entry);
    }
  }
  const packet = renderSelectedSkillsPacket(selectedEntries);
  const selectedTopRanked = selectedEntries[0]?.name === rankedMatches[0]?.entry.name;
  return {
    selectedEntries,
    selectedNames: selectedEntries.map((entry) => entry.name),
    rankedMatches,
    highConfidence: selectedTopRanked && skillRoutingConfidence(rankedMatches) === "high",
    packet,
  };
}

export function currentSkillPairPaths(libraryPath: string, name: string): Pick<CurrentSkillPair, "patternPath" | "skillPath"> {
  if (!isValidSkillName(name)) throw new Error(`Invalid skill name: ${name}`);
  return {
    patternPath: join(libraryPath, "patterns", `${name}.md`),
    skillPath: join(libraryPath, "skills", name, "SKILL.md"),
  };
}

export function validateCurrentSkillPair(input: CurrentSkillPairInput): string[] {
  const errors: string[] = [];
  if (!isValidSkillName(input.name)) errors.push("name must be a valid lowercase-hyphen skill name");
  if (input.patternMarkdown.trim().length === 0) errors.push("pattern page must not be empty");
  if (estimateSkillTokens(input.patternMarkdown) > SKILL_BOUNDS.maxPatternTokens) {
    errors.push(`pattern page exceeds ${SKILL_BOUNDS.maxPatternTokens} estimated tokens`);
  }
  try {
    parseSkillMarkdown(input.skillMarkdown, input.name);
  } catch (error) {
    errors.push((error as Error).message);
  }
  return errors;
}

export async function readCurrentSkillPair(libraryPath: string, name: string): Promise<CurrentSkillPair | undefined> {
  const paths = currentSkillPairPaths(libraryPath, name);
  try {
    const [patternMarkdown, skillMarkdown] = await Promise.all([
      readFile(paths.patternPath, "utf8"),
      readFile(paths.skillPath, "utf8"),
    ]);
    const errors = validateCurrentSkillPair({ name, patternMarkdown, skillMarkdown });
    if (errors.length > 0) throw new Error(`Invalid current skill pair "${name}": ${errors.join("; ")}`);
    return { name, patternMarkdown, skillMarkdown, ...paths };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function storedCurrentPairNames(libraryPath: string): Promise<string[]> {
  const patternsDir = join(libraryPath, "patterns");
  const skillsDir = join(libraryPath, "skills");
  try {
    const [patternEntries, skillEntries] = await Promise.all([
      readdir(patternsDir, { withFileTypes: true }),
      readdir(skillsDir, { withFileTypes: true }),
    ]);
    const patterns = new Set(patternEntries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => entry.name.slice(0, -3))
      .filter(isValidSkillName));
    return skillEntries
      .filter((entry) => entry.isDirectory() && isValidSkillName(entry.name) && patterns.has(entry.name) &&
        existsSync(join(skillsDir, entry.name, "SKILL.md")))
      .map((entry) => entry.name)
      .sort(compareStableNames);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function readCurrentSkillPairs(libraryPath: string): Promise<CurrentSkillPair[]> {
  const pairs: CurrentSkillPair[] = [];
  for (const name of await storedCurrentPairNames(libraryPath)) {
    const pair = await readCurrentSkillPair(libraryPath, name);
    if (pair) pairs.push(pair);
  }
  return pairs;
}

/** Directly replace one current pair. New pairs may not exceed the fixed library capacity. */
export async function upsertCurrentSkillPair(
  libraryPath: string,
  input: CurrentSkillPairInput,
): Promise<CurrentSkillPair> {
  const errors = validateCurrentSkillPair(input);
  if (errors.length > 0) throw new Error(`Invalid current skill pair: ${errors.join("; ")}`);
  const names = await storedCurrentPairNames(libraryPath);
  if (!names.includes(input.name) && names.length >= SKILL_BOUNDS.maxPairs) {
    throw new Error(`Skill library already contains ${SKILL_BOUNDS.maxPairs} current pairs`);
  }
  const paths = currentSkillPairPaths(libraryPath, input.name);
  await mkdir(dirname(paths.patternPath), { recursive: true });
  await mkdir(dirname(paths.skillPath), { recursive: true });
  const patternMarkdown = `${input.patternMarkdown.trim()}\n`;
  const skillMarkdown = `${input.skillMarkdown.trim()}\n`;
  await writeFile(paths.patternPath, patternMarkdown, "utf8");
  await writeFile(paths.skillPath, skillMarkdown, "utf8");
  return { name: input.name, patternMarkdown, skillMarkdown, ...paths };
}
