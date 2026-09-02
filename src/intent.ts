import { basename, isAbsolute, normalize, relative, resolve } from "node:path";
import { analyzeOutcome, truncateUtf8, utf8Bytes, type OutcomeSummary } from "./capsule.js";

export type IntentKind =
  | "read"
  | "search"
  | "edit"
  | "test"
  | "build"
  | "lint"
  | "run"
  | "status"
  | "install"
  | "delegate"
  | "unknown";

export type SuiteScope = "focused" | "package" | "broad";

export interface SuiteIdentity {
  family: string;
  target: string;
  scope: SuiteScope;
}

export interface ToolIntentFacts {
  [key: string]: number | string | string[] | undefined;
}

export interface ToolIntent {
  exchangeId: string;
  toolCallId: string;
  toolName: string;
  kind: IntentKind;
  resources: string[];
  command?: string;
  effectiveCwd?: string;
  subjectKey: string;
  suite?: SuiteIdentity;
  mutatesWorkspace: boolean;
  modelInputBytes: number;
  executedInputBytes: number;
  facts?: ToolIntentFacts;
}

export interface AdaptToolIntentOptions {
  exchangeId: string;
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
  cwd: string;
  modelInputBytes: number;
  toolSchema?: unknown;
  details?: unknown;
  resultText?: string;
  isError?: boolean;
}

interface ShellToken {
  value: string;
  quoted: boolean;
  fullyQuoted: boolean;
  escaped?: boolean;
  escapedOffsets?: readonly number[];
}

interface ShellClassification {
  kind: IntentKind;
  resources: string[];
  subjectKey: string;
  suite?: SuiteIdentity;
  mutatesWorkspace: boolean;
  effectiveCwd?: string;
  normalizedExecutable?: string;
}

const SHELL_OPERATORS = new Set(["&&", "||", ";", "|", "&"]);
const IDENTITY_FIELDS = ["path", "file", "files", "directory", "cwd", "query", "pattern", "glob", "url", "command", "name", "id"];

export function jsonBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value) ?? "", "utf8");
  } catch {
    return 0;
  }
}

function unique(values: readonly string[], limit = 32): string[] {
  return [...new Set(values.filter(Boolean))].slice(0, limit);
}

function allUnique(values: readonly string[]): string[] {
  return unique(values, Number.POSITIVE_INFINITY);
}

function textLines(value: string): number {
  return value.length === 0 ? 0 : value.split("\n").length;
}

function literalPath(value: unknown, cwd: string): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  if (/[\0\n\r*?\[\]{}$`]/.test(value) || value.startsWith("~") || /\([^()]*\)$/.test(value)) return undefined;
  return normalize(isAbsolute(value) ? value : resolve(cwd, value));
}

interface HeredocOpener {
  delimiter: string;
  stripTabs: boolean;
}

function heredocOpeners(line: string): HeredocOpener[] {
  const openers: HeredocOpener[] = [];
  let quote: "'" | '"' | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quote) {
      if (char === quote) quote = null;
      else if (char === "\\" && quote === '"') index += 1;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (line.slice(index, index + 2) !== "<<" || line[index + 2] === "<") continue;

    let cursor = index + 2;
    const stripTabs = line[cursor] === "-";
    if (stripTabs) cursor += 1;
    while (/\s/.test(line[cursor] ?? "")) cursor += 1;
    let delimiter = "";
    const delimiterQuote = line[cursor];
    if (delimiterQuote === "'" || delimiterQuote === '"') {
      cursor += 1;
      while (cursor < line.length && line[cursor] !== delimiterQuote) {
        if (line[cursor] === "\\" && delimiterQuote === '"' && cursor + 1 < line.length) cursor += 1;
        delimiter += line[cursor];
        cursor += 1;
      }
      if (line[cursor] === delimiterQuote) cursor += 1;
    } else {
      while (cursor < line.length && !/[\s;&|<>]/.test(line[cursor])) {
        if (line[cursor] === "\\" && cursor + 1 < line.length) cursor += 1;
        delimiter += line[cursor];
        cursor += 1;
      }
    }
    if (delimiter) openers.push({ delimiter, stripTabs });
    index = Math.max(index, cursor - 1);
  }
  return openers;
}

function stripHeredocBodies(command: string): string {
  const kept: string[] = [];
  const pending: HeredocOpener[] = [];
  for (const line of command.split("\n")) {
    const active = pending[0];
    if (active) {
      const candidate = active.stripTabs ? line.replace(/^\t+/, "") : line;
      if (candidate === active.delimiter) pending.shift();
      continue;
    }
    kept.push(line);
    pending.push(...heredocOpeners(line));
  }
  return kept.join("\n");
}

function shellTokens(command: string): ShellToken[] | null {
  const source = stripHeredocBodies(command);
  const tokens: ShellToken[] = [];
  let value = "";
  let quote: "'" | '"' | null = null;
  let quoted = false;
  let escaped = false;
  let escapedOffsets: number[] = [];
  let unquotedContent = false;
  const flush = () => {
    if (value.length > 0 || quoted) tokens.push({ value, quoted, fullyQuoted: quoted && !unquotedContent, escaped,
      ...(escapedOffsets.length > 0 ? { escapedOffsets: [...escapedOffsets] } : {}) });
    value = "";
    quoted = false;
    escaped = false;
    escapedOffsets = [];
    unquotedContent = false;
  };
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote) {
        quote = null;
        quoted = true;
      } else if (char === "\\" && quote === '"' && index + 1 < source.length) {
        if (source[index + 1] === "\n" || source[index + 1] === "\r") {
          if (source[index + 1] === "\r" && source[index + 2] === "\n") index += 1;
          index += 1;
        } else {
          const escapedChar = source[index + 1];
          escapedOffsets.push(value.length);
          value += ["$", "`", '"', "\\"].includes(escapedChar) ? escapedChar : `\\${escapedChar}`;
          escaped = true;
          index += 1;
        }
      } else {
        value += char;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      quoted = true;
      continue;
    }
    if (char === "\\" && index + 1 < source.length) {
      if (source[index + 1] === "\n" || source[index + 1] === "\r") {
        if (source[index + 1] === "\r" && source[index + 2] === "\n") index += 1;
        index += 1;
        continue;
      }
      escapedOffsets.push(value.length);
      value += source[index + 1];
      escaped = true;
      unquotedContent = true;
      index += 1;
      continue;
    }
    if (char === "#" && value.length === 0 && !quoted) {
      while (index + 1 < source.length && source[index + 1] !== "\n" && source[index + 1] !== "\r") index += 1;
      continue;
    }
    if (char === "\n" || char === "\r") {
      flush();
      tokens.push({ value: ";", quoted: false, fullyQuoted: false });
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      continue;
    }
    if (/\s/.test(char)) {
      flush();
      continue;
    }
    const pair = source.slice(index, index + 2);
    const redirection = /^(?:\d*)(?:<<<|<<-|<<|&>>|&>|>>|>\||>&|<&|<>|>|<)/.exec(source.slice(index));
    if (["&&", "||"].includes(pair)) {
      flush();
      tokens.push({ value: pair, quoted: false, fullyQuoted: false });
      index += 1;
      continue;
    }
    if (redirection) {
      flush();
      tokens.push({ value: redirection[0], quoted: false, fullyQuoted: false });
      index += redirection[0].length - 1;
      continue;
    }
    if ([";", "|", "&"].includes(char)) {
      flush();
      tokens.push({ value: char, quoted: false, fullyQuoted: false });
      continue;
    }
    value += char;
    unquotedContent = true;
  }
  if (quote) return null;
  flush();
  return tokens;
}

function scopeForTarget(target: string): SuiteScope {
  if (/^(?:\.|\.\/)?(?:src|test|tests|packages?)\//.test(target) || /(?::|#|\[|\b-k\b|--filter)/.test(target)) return "focused";
  if (target && target !== "." && target !== "all") return "package";
  return "broad";
}

function hasZshQualifierSyntax(command: string): boolean {
  const tokens = shellTokens(command);
  if (!tokens) return false;
  return tokens.some((token) => {
    const open = token.value.lastIndexOf("(");
    const close = token.value.length - 1;
    const escaped = new Set(token.escapedOffsets ?? []);
    return !token.fullyQuoted && open > 0 && token.value.endsWith(")") && !escaped.has(open) && !escaped.has(close);
  });
}

function hasZshDynamicGlobSyntax(command: string): boolean {
  const tokens = shellTokens(command);
  if (!tokens) return false;
  const dynamic = tokens.filter((token) => !token.fullyQuoted);
  return dynamic.some((token) => token.value.startsWith("^")) || /<\d+-\d+>/.test(dynamic.map((token) => token.value).join(""));
}

function dockerBuildIdentity(values: readonly string[]): { family: string; args: string[] } | undefined {
  const selectors: string[] = [];
  const canonicalOption = (option: string): string => ({
    "-c": "--context", "-H": "--host", "-l": "--log-level", "-f": "--file", "-p": "--project-name", "-D": "--debug",
  }[option] ?? option);
  const skipOptions = (start: number, withValues: ReadonlySet<string>): number => {
    let index = start;
    while (values[index]?.startsWith("-")) {
      const option = values[index];
      if (option === "--") return index + 1;
      const equals = option.match(/^(--[^=]+)=(.*)$/);
      const attachedShort = !equals && option.length > 2 && withValues.has(option.slice(0, 2))
        ? [option.slice(0, 2), option.slice(2)] as const : undefined;
      const key = equals?.[1] ?? attachedShort?.[0] ?? option;
      const attachedValue = equals?.[2] ?? attachedShort?.[1];
      if (withValues.has(key) && (attachedValue !== undefined || values[index + 1] !== undefined)) {
        selectors.push(`${canonicalOption(key)}=${attachedValue ?? values[index + 1]}`);
        index += attachedValue === undefined ? 2 : 1;
      } else {
        selectors.push(canonicalOption(option));
        index += 1;
      }
    }
    return index;
  };
  const globalOptions = new Set(["--context", "-c", "--host", "-H", "--config", "--log-level", "-l",
    "--tlscacert", "--tlscert", "--tlskey"]);
  let index = skipOptions(0, globalOptions);
  if (values[index] === "build") return { family: "docker-build", args: [...selectors, ...values.slice(index + 1)] };
  if (values[index] === "buildx") {
    index = skipOptions(index + 1, new Set(["--builder"]));
    return values[index] === "build"
      ? { family: "docker-buildx-build", args: [...selectors, ...values.slice(index + 1)] }
      : undefined;
  }
  if (values[index] === "compose") {
    index = skipOptions(index + 1, new Set([
      "-f", "--file", "-p", "--project-name", "--profile", "--env-file", "--project-directory", "--ansi", "--parallel", "--progress",
    ]));
    return values[index] === "build"
      ? { family: "docker-compose-build", args: [...selectors, ...values.slice(index + 1)] }
      : undefined;
  }
  return undefined;
}

function normalizedSuiteArgs(family: string, args: readonly string[]): string[] {
  let values = [...args];
  if (family.startsWith("docker-")) {
    const aliases: Record<string, string> = { "-t": "--tag", "-f": "--file", "-o": "--output", "-c": "--cpu-shares", "-H": "--host", "-D": "--debug" };
    const valueOptions = new Set(["--tag", "--file", "--output", "--context", "--host", "--target", "--build-arg",
      "--platform", "--builder", "--cache-from", "--cache-to", "--iidfile", "--metadata-file", "--project-directory",
      "--progress", "--secret", "--ssh", "--env-file", "--add-host", "--memory", "--cpu-shares"]);
    const normalized: string[] = [];
    for (let index = 0; index < values.length; index += 1) {
      const raw = values[index];
      const shortAttached = /^-[tfocH].+/.test(raw) ? [raw.slice(0, 2), raw.slice(2)] as const : undefined;
      const equals = raw.match(/^(--[^=]+)=(.*)$/);
      const key = aliases[equals?.[1] ?? shortAttached?.[0] ?? raw] ?? (equals?.[1] ?? shortAttached?.[0] ?? raw);
      const attached = equals?.[2] ?? shortAttached?.[1];
      if (valueOptions.has(key) && (attached !== undefined || values[index + 1] !== undefined)) {
        normalized.push(`${key}=${attached ?? values[++index]}`);
      } else normalized.push(attached !== undefined ? `${key}=${attached}` : key);
    }
    values = [...normalized.filter((value) => value.startsWith("-")).sort(),
      ...normalized.filter((value) => !value.startsWith("-"))];
  }
  if (["vitest", "jest", "mocha"].includes(family)) values = values.filter((value) => value !== "run" && value !== "--run");
  if (["pytest", "vitest", "jest"].includes(family)) {
    const optionValues = new Set(["-k", "-m", "-t", "--filter", "--testNamePattern", "--config", "--dir", "--project"]);
    if (family === "pytest") optionValues.add("--color");
    const options: string[] = [];
    const paths: string[] = [];
    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];
      const equals = value.match(/^(--[^=]+)=(.*)$/);
      const key = equals?.[1] ?? value;
      if (optionValues.has(key) && (equals || values[index + 1] !== undefined)) {
        options.push(`${key}=${equals?.[2] ?? values[++index]}`);
      } else if (value.startsWith("-")) options.push(value);
      else paths.push(value);
    }
    values = [...options.sort(), ...paths];
  }
  if (/^(?:npm|pnpm|yarn|bun)-test$/.test(family) && /^(?:test|test:.+)$/.test(values[0] ?? "")) {
    values = values.slice(1);
  }
  return values.filter((arg) => arg && arg !== "--" &&
    !/^(?:-q|-v+|--quiet|--verbose|--watch|--runInBand|--color(?:=.+)?)$/.test(arg))
    .map((arg) => arg.startsWith("./") ? arg.slice(2) : arg);
}

function scopedSuiteTarget(exactTarget: string, cwd: string): string {
  const normalizedCwd = normalize(isAbsolute(cwd) ? cwd : resolve(cwd));
  const boundedTarget = utf8Bytes(exactTarget) <= 896
    ? exactTarget
    : `${truncateUtf8(exactTarget, 832)} [truncated target; bytes=${utf8Bytes(exactTarget)}]`;
  return JSON.stringify({ target: boundedTarget, cwd: normalizedCwd });
}

function suite(family: string, args: readonly string[], cwd: string): SuiteIdentity {
  const exactTarget = normalizedSuiteArgs(family, args).join(" ") || "all";
  return { family, target: scopedSuiteTarget(exactTarget, cwd), scope: scopeForTarget(exactTarget) };
}

function suitePathResources(args: readonly string[], cwd: string, family?: string): string[] {
  return unique(args.filter((value) => !value.startsWith("-") &&
    !["run", "test", "check", "build"].includes(value) &&
    (/^(?:\.{0,2}\/|\/)/.test(value) || /[\/]/.test(value) || /\.[A-Za-z0-9]+(?::.*)?$/.test(value) ||
      (family === "pytest" && ["test", "tests"].includes(value))))
    .map((value) => literalPath(value, cwd))
    .filter((value): value is string => Boolean(value)));
}

function pythonTestScriptSuite(
  executable: string,
  args: readonly string[],
  cwd: string,
): SuiteIdentity | undefined {
  if (!["python", "python3"].includes(commandBase(executable)) || !args[0] ||
    !/(?:^|[_-])(?:run[_-]?)?tests?(?:\.|[_-]|$)/i.test(basename(args[0]))) return undefined;
  return {
    family: "python-test-script",
    target: scopedSuiteTarget(literalPath(args[0], cwd) ?? args[0], cwd),
    scope: "broad",
  };
}

function commandBase(value: string): string {
  const name = basename(value).toLowerCase();
  if (["gsed", "ggrep", "gfind", "gpatch"].includes(name)) return name.slice(1);
  return name;
}

interface LeadingShellInvocation {
  executable: string;
  args: ShellToken[];
  effectiveCwd: string;
}

function leadingShellInvocation(tokens: ShellToken[], cwd: string): LeadingShellInvocation | undefined {
  let offset = 0;
  let effectiveCwd = cwd;
  if (tokens[0]?.value === "cd") {
    const pathIndex = tokens[1]?.value === "--" ? 2 : 1;
    const conjunctionIndex = pathIndex + 1;
    if (tokens[pathIndex] && tokens[conjunctionIndex]?.value === "&&") {
      const changed = literalPath(tokens[pathIndex].value, cwd);
      if (!changed) return undefined;
      effectiveCwd = changed;
      offset = conjunctionIndex + 1;
      while (tokens[offset]?.value === ";") offset += 1;
    }
  }
  while (tokens[offset] && /^[A-Za-z_][A-Za-z0-9_]*=.*/.test(tokens[offset].value)) offset += 1;
  const modifiers = new Set(["command", "builtin", "exec", "time", "noglob", "nocorrect"]);
  const consumeModifiers = (): void => {
    while (tokens[offset] && modifiers.has(tokens[offset].value)) {
      const modifier = tokens[offset++].value;
      if (modifier === "time") {
        while (tokens[offset]?.value.startsWith("-")) {
          const option = tokens[offset++].value;
          if (["-f", "--format", "-o", "--output"].includes(option) && tokens[offset]) offset += 1;
        }
      }
    }
  };
  consumeModifiers();
  if (tokens[offset]?.value === "env") {
    offset += 1;
    while (tokens[offset]) {
      const value = tokens[offset].value;
      if (/^[A-Za-z_][A-Za-z0-9_]*=.*/.test(value) || ["-i", "--ignore-environment", "-0", "--null"].includes(value)) {
        offset += 1;
        continue;
      }
      if (["-u", "--unset", "--argv0"].includes(value) && tokens[offset + 1]) {
        offset += 2;
        continue;
      }
      if (value.startsWith("--unset=") || value.startsWith("--argv0=")) {
        offset += 1;
        continue;
      }
      if (["-C", "--chdir"].includes(value) && tokens[offset + 1]) {
        effectiveCwd = literalPath(tokens[offset + 1].value, effectiveCwd) ?? effectiveCwd;
        offset += 2;
        continue;
      }
      if (value.startsWith("--chdir=")) {
        effectiveCwd = literalPath(value.slice(8), effectiveCwd) ?? effectiveCwd;
        offset += 1;
        continue;
      }
      if (value === "--") { offset += 1; }
      break;
    }
  }
  consumeModifiers();
  const pairs = [["uv", "run"], ["poetry", "run"], ["pipenv", "run"], ["pnpm", "exec"]];
  for (const [first, second] of pairs) {
    if (tokens[offset]?.value === first && tokens[offset + 1]?.value === second) {
      offset += 2;
      if (first === "uv") {
        const valueOptions = new Set(["--project", "--directory", "--python", "--with", "--env-file", "--config-file",
          "--index", "--default-index", "--package", "--extra"]);
        while (tokens[offset]?.value.startsWith("-")) {
          const option = tokens[offset].value;
          if (option === "--") { offset += 1; break; }
          const equals = option.match(/^(--[^=]+)=(.*)$/);
          const key = equals?.[1] ?? option;
          const optionValue = equals?.[2] ?? tokens[offset + 1]?.value;
          if (valueOptions.has(key) && optionValue !== undefined) {
            if (key === "--directory") effectiveCwd = literalPath(optionValue, effectiveCwd) ?? effectiveCwd;
            offset += equals ? 1 : 2;
          } else offset += 1;
        }
      }
    }
  }
  if (["npx", "bunx"].includes(tokens[offset]?.value ?? "")) offset += 1;
  const executableToken = tokens[offset];
  if (!executableToken) return undefined;
  return {
    executable: commandBase(executableToken.value),
    args: tokens.slice(offset + 1),
    effectiveCwd,
  };
}

function hasRuntimeShellExpansion(command: string): boolean {
  let quote: "'" | '"' | null = null;
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (quote === "'") {
      if (char === "'") quote = null;
      continue;
    }
    if (quote === '"') {
      if (char === '"') quote = null;
      else if (char === "$" || char === "`") return true;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "$" || char === "`" || char === "*" || char === "?" || char === "~") return true;
    if ((char === "<" || char === ">") && command[index + 1] === "(") return true;
    if (char === "{" && /,[^}]*}/.test(command.slice(index + 1))) return true;
  }
  return false;
}

function literalNestedShellBody(token: ShellToken | undefined): string | undefined {
  return token?.fullyQuoted && !hasRuntimeShellExpansion(token.value) ? token.value : undefined;
}

function normalizedShellExecutable(tokens: ShellToken[], cwd: string, depth = 0): string | undefined {
  const invocation = leadingShellInvocation(tokens, cwd);
  if (!invocation) return undefined;
  const body = literalNestedShellBody(invocation.args[1]);
  if (depth === 0 && ["bash", "zsh", "sh"].includes(invocation.executable) &&
    ["-c", "-lc"].includes(invocation.args[0]?.value ?? "") && body !== undefined) {
    const inner = shellTokens(body);
    if (inner) return normalizedShellExecutable(inner, invocation.effectiveCwd, 1) ?? invocation.executable;
  }
  return invocation.executable;
}

const OUTPUT_REDIRECTION = /^(?:\d*)(?:&>>|&>|>>|>\||>&|<>|>)$/;
const ANY_REDIRECTION = /^(?:\d*)(?:<<<|<<-|<<|&>>|&>|>>|>\||>&|<&|<>|>|<)$/;

function literalWorkspacePath(value: unknown, cwd: string, workspaceRoot: string): string | undefined {
  const candidate = literalPath(value, cwd);
  if (!candidate) return undefined;
  const root = normalize(isAbsolute(workspaceRoot) ? workspaceRoot : resolve(workspaceRoot));
  const relation = relative(root, candidate);
  return relation === "" || (!isAbsolute(relation) && relation !== ".." && !relation.startsWith(`..${pathSeparator()}`))
    ? candidate
    : undefined;
}

function globWorkspaceRoot(value: string, cwd: string, workspaceRoot: string): string | undefined {
  const marker = value.search(/[?*\[]/);
  if (marker < 0) return undefined;
  const prefix = value.slice(0, marker).replace(/[^/]*$/, "") || ".";
  return quotedWorkspacePath(prefix, cwd, workspaceRoot);
}

function quotedWorkspacePath(value: string, cwd: string, workspaceRoot: string): string | undefined {
  const candidate = normalize(isAbsolute(value) ? value : resolve(cwd, value));
  const root = normalize(isAbsolute(workspaceRoot) ? workspaceRoot : resolve(workspaceRoot));
  const relation = relative(root, candidate);
  return relation === "" || (!isAbsolute(relation) && relation !== ".." && !relation.startsWith(`..${pathSeparator()}`))
    ? candidate
    : undefined;
}

function pathSeparator(): string {
  return process.platform === "win32" ? "\\" : "/";
}

function shellArguments(
  args: readonly ShellToken[],
  cwd: string,
  workspaceRoot: string,
): { tokens: ShellToken[]; outputResources: string[] } {
  const tokens: ShellToken[] = [];
  const outputResources: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!ANY_REDIRECTION.test(token.value)) {
      tokens.push(token);
      continue;
    }
    const destination = args[index + 1];
    if (OUTPUT_REDIRECTION.test(token.value) && destination &&
      !(token.value.endsWith(">&") && /^(?:-?\d+|-)$/.test(destination.value))) {
      const resource = literalWorkspacePath(destination.value, cwd, workspaceRoot);
      if (resource) outputResources.push(resource);
    }
    if (destination) index += 1;
  }
  return { tokens, outputResources: unique(outputResources) };
}

function withRedirections(
  classified: ShellClassification,
  outputResources: readonly string[],
): ShellClassification {
  if (outputResources.length === 0) return classified;
  const standaloneMutation = classified.suite === undefined;
  return {
    ...classified,
    kind: standaloneMutation ? "run" : classified.kind,
    resources: unique([...classified.resources, ...outputResources]),
    subjectKey: standaloneMutation ? outputResources[0] : classified.subjectKey,
    mutatesWorkspace: true,
  };
}

function normalizeCommandGrouping(tokens: ShellToken[]): ShellToken[] {
  const normalized = tokens.flatMap((token) => {
    if (token.quoted || token.escaped || SHELL_OPERATORS.has(token.value)) return [token];
    const value = token.value.replace(/^[({]+/, "").replace(/[)}]+$/, "");
    return value && !["fi", "done", "esac"].includes(value) ? [{ ...token, value }] : [];
  });
  while (["then", "do", "else", "elif"].includes(normalized[0]?.value ?? "")) normalized.shift();
  return normalized;
}

function sedWriteTargets(values: readonly string[]): string[] {
  const scripts: string[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (["-e", "--expression"].includes(value) && values[index + 1]) {
      scripts.push(values[++index]);
    } else if (value.startsWith("--expression=")) {
      scripts.push(value.slice(13));
    } else if (value.startsWith("-e") && value.length > 2) {
      scripts.push(value.slice(2));
    } else if (!value.startsWith("-") && scripts.length === 0) {
      scripts.push(value);
    }
  }
  return scripts.flatMap((script) => [...script.matchAll(/(?:^|[;\/\s])(?:[0-9,$]+)?w\s+([^;\s]+)/g)]
    .map((match) => match[1]));
}

function hasSedInPlaceOption(values: readonly string[]): boolean {
  return values.some((value) => value === "-i" || value.startsWith("-i") || value === "--in-place" ||
    value.startsWith("--in-place=") || /^-[A-Za-z]*i[A-Za-z]*$/.test(value));
}

function classifyExecutable(tokens: ShellToken[], cwd: string, depth = 0, workspaceRoot = cwd): ShellClassification {
  tokens = normalizeCommandGrouping(tokens);
  let prefix = 0;
  while (["command", "builtin", "exec", "time", "noglob", "nocorrect"].includes(tokens[prefix]?.value ?? "")) prefix += 1;
  if (OUTPUT_REDIRECTION.test(tokens[prefix]?.value ?? "")) {
    tokens = [...tokens.slice(0, prefix), { value: ":", quoted: false, fullyQuoted: false }, ...tokens.slice(prefix)];
  }
  const invocation = leadingShellInvocation(tokens, cwd);
  if (!invocation) return unknownShell(cwd);
  const { executable, args, effectiveCwd } = invocation;
  if (OUTPUT_REDIRECTION.test(executable)) {
    return classifyExecutable([
      { value: ":", quoted: false, fullyQuoted: false },
      { value: executable, quoted: false, fullyQuoted: false },
      ...args,
    ], effectiveCwd, depth + 1, workspaceRoot);
  }
  const shellArgs = shellArguments(args, effectiveCwd, workspaceRoot);
  const finish = (classified: ShellClassification) => withRedirections(classified, shellArgs.outputResources);
  const operatorIndex = args.findIndex((token) => SHELL_OPERATORS.has(token.value));
  if (operatorIndex >= 0) {
    const segments: Array<{ tokens: ShellToken[]; operatorAfter?: string }> = [];
    let segment: ShellToken[] = [{ value: executable, quoted: false, fullyQuoted: false }];
    for (const token of args) {
      if (SHELL_OPERATORS.has(token.value)) {
        if (segment.length > 0) segments.push({ tokens: segment, operatorAfter: token.value });
        segment = [];
      } else {
        segment.push(token);
      }
    }
    if (segment.length > 0) segments.push({ tokens: segment });
    const mutations: ShellClassification[] = [];
    let segmentCwd = effectiveCwd;
    for (let index = 0; index < segments.length; index += 1) {
      const current = segments[index];
      const classified = classifyExecutable(current.tokens, segmentCwd, depth + 1, workspaceRoot);
      if (classified.mutatesWorkspace) mutations.push(classified);
      if (current.tokens[0]?.value === "cd") {
        const pathIndex = current.tokens[1]?.value === "--" ? 2 : 1;
        if (current.tokens[pathIndex] && current.tokens.length === pathIndex + 1) {
          const changed = literalPath(current.tokens[pathIndex].value, segmentCwd);
          const guardedExit = current.operatorAfter === "||" &&
            commandBase(segments[index + 1]?.tokens[0]?.value ?? "") === "exit";
          const conditionallyReached = index > 0 && ["&&", "||"].includes(segments[index - 1].operatorAfter ?? "");
          if (changed && !conditionallyReached && (["&&", ";", undefined].includes(current.operatorAfter) || guardedExit)) {
            segmentCwd = changed;
          }
        }
      }
    }
    const resources = unique(mutations.flatMap((classified) => classified.resources));
    return mutations.length > 0 ? {
      ...unknownShell(segmentCwd),
      resources,
      subjectKey: resources[0] ?? mutations[0].subjectKey,
      mutatesWorkspace: true,
    } : unknownShell(segmentCwd);
  }
  if (depth < 2 && ["bash", "zsh", "sh"].includes(executable) && ["-c", "-lc"].includes(shellArgs.tokens[0]?.value ?? "")) {
    const body = literalNestedShellBody(shellArgs.tokens[1]);
    if (body === undefined || hasZshQualifierSyntax(body) || hasZshDynamicGlobSyntax(body)) {
      return finish(unknownShell(effectiveCwd));
    }
    const inner = shellTokens(body);
    return finish(inner ? classifyExecutable(inner, effectiveCwd, depth + 1, workspaceRoot) : unknownShell(effectiveCwd));
  }

  let actual = executable;
  let values = shellArgs.tokens.map((token) => token.value);
  if (["python", "python3"].includes(actual) && values[0] === "-m" && values[1]) {
    actual = values[1].toLowerCase();
    values = values.slice(2);
  }
  const packageManager = ["npm", "pnpm", "yarn", "bun"].includes(actual);
  if (packageManager && values[0] === "run") values = values.slice(1);

  let identifiedSuite: SuiteIdentity | undefined = pythonTestScriptSuite(actual, values, effectiveCwd);
  if (!identifiedSuite && ["pytest", "py.test"].includes(actual)) identifiedSuite = suite("pytest", values, effectiveCwd);
  else if (actual === "unittest") identifiedSuite = suite("unittest", values, effectiveCwd);
  else if (["vitest", "jest", "mocha"].includes(actual)) identifiedSuite = suite(actual, values, effectiveCwd);
  else if (actual === "cargo" && values[0] === "test") identifiedSuite = suite("cargo-test", values.slice(1), effectiveCwd);
  else if (actual === "go" && values[0] === "test") identifiedSuite = suite("go-test", values.slice(1), effectiveCwd);
  else if (actual === "ctest") identifiedSuite = suite("ctest", values, effectiveCwd);
  else if (actual === "dotnet" && values[0] === "test") identifiedSuite = suite("dotnet-test", values.slice(1), effectiveCwd);
  else if (["mvn", "mvnw"].includes(actual) && values.some((arg) => arg === "test")) identifiedSuite = suite("maven-test", values, effectiveCwd);
  else if (["gradle", "gradlew"].includes(actual) && values.some((arg) => /test/i.test(arg))) identifiedSuite = suite("gradle-test", values, effectiveCwd);
  else if (actual === "mix" && values[0] === "test") identifiedSuite = suite("mix-test", values.slice(1), effectiveCwd);
  else if (actual === "swift" && values[0] === "test") identifiedSuite = suite("swift-test", values.slice(1), effectiveCwd);
  else if (packageManager && /^(?:test|test:.+)$/.test(values[0] ?? "")) identifiedSuite = suite(`${actual}-test`, values, effectiveCwd);
  if (identifiedSuite) {
    return finish({
      kind: "test",
      resources: suitePathResources(values, effectiveCwd, identifiedSuite.family),
      subjectKey: `suite:${identifiedSuite.family}:${identifiedSuite.target}`,
      suite: identifiedSuite,
      mutatesWorkspace: false,
      effectiveCwd,
    });
  }

  let commandCwd = effectiveCwd;
  if (actual === "git") {
    while (values.length > 0) {
      if (values[0] === "-C") {
        const changed = values[1] ? literalPath(values[1], commandCwd) : undefined;
        if (!changed) return finish(unknownShell(commandCwd));
        commandCwd = changed;
        values = values.slice(2);
        continue;
      }
      if (values[0].startsWith("-C") && values[0].length > 2) {
        const changed = literalPath(values[0].slice(2), commandCwd);
        if (!changed) return finish(unknownShell(commandCwd));
        commandCwd = changed;
        values = values.slice(1);
        continue;
      }
      if (["--no-pager", "--paginate", "--literal-pathspecs", "--no-optional-locks", "--no-replace-objects"].includes(values[0])) {
        values = values.slice(1);
        continue;
      }
      if (/^--(?:git-dir|namespace|config-env)=/.test(values[0])) {
        values = values.slice(1);
        continue;
      }
      if (values[0].startsWith("--work-tree=")) {
        const changed = literalPath(values[0].slice(12), commandCwd);
        if (!changed) return finish(unknownShell(commandCwd));
        commandCwd = changed;
        values = values.slice(1);
        continue;
      }
      if (["--git-dir", "--namespace", "--config-env"].includes(values[0]) && values[1]) {
        values = values.slice(2);
        continue;
      }
      if (values[0] === "--work-tree" && values[1]) {
        const changed = literalPath(values[1], commandCwd);
        if (!changed) return finish(unknownShell(commandCwd));
        commandCwd = changed;
        values = values.slice(2);
        continue;
      }
      if (values[0] === "-c" && values[1]) {
        values = values.slice(2);
        continue;
      }
      break;
    }
  }
  const script = values[0] ?? "";
  if (actual === "tsc") return finish(validationShell("build", "tsc", values, effectiveCwd));
  if (actual === "cargo" && ["check", "build"].includes(script)) {
    return finish(validationShell("build", `cargo-${script}`, values.slice(1), effectiveCwd));
  }
  if (actual === "go" && script === "build") {
    return finish(validationShell("build", "go-build", values.slice(1), effectiveCwd));
  }
  const dockerBuild = actual === "docker"
    ? dockerBuildIdentity(values)
    : actual === "docker-compose" ? dockerBuildIdentity(["compose", ...values]) : undefined;
  if (dockerBuild) {
    const outputResources: string[] = [];
    const inputResources: string[] = [];
    const optionValues = new Set(["-t", "--tag", "-f", "--file", "--progress", "-o", "--output",
      "--target", "--build-arg", "--platform", "--builder", "--cache-from", "--cache-to", "--secret", "--ssh",
      "--iidfile", "--metadata-file", "--project-directory", "--label", "--network", "--add-host", "--memory",
      "--cpu-shares", "-c"]);
    const outputOption = (option: string, value: string): void => {
      const destination = ["--iidfile", "--metadata-file"].includes(option) ? value
        : /(?:^|,)dest=([^,]+)/.exec(value)?.[1] ?? (!value.includes(",") && !value.includes("=") ? value : undefined);
      const localOutput = option !== "--cache-to" || /(?:^|,)type=local(?:,|$)/.test(value);
      const resource = destination && destination !== "-" && localOutput
        ? literalWorkspacePath(destination, effectiveCwd, workspaceRoot)
        : undefined;
      if (resource) outputResources.push(resource);
    };
    const positional: string[] = [];
    for (let index = 0; index < dockerBuild.args.length; index += 1) {
      const value = dockerBuild.args[index];
      const equals = value.match(/^(--[^=]+)=(.*)$/);
      const shortOutput = value.startsWith("-o=") ? ["--output", value.slice(3)] as const : undefined;
      const option = equals?.[1] ?? shortOutput?.[0] ?? value;
      const attached = equals?.[2] ?? shortOutput?.[1];
      if (optionValues.has(option)) {
        const optionValue = attached ?? dockerBuild.args[index + 1];
        if (optionValue !== undefined) {
          if (["-o", "--output", "--iidfile", "--metadata-file", "--cache-to"].includes(option)) {
            outputOption(option === "-o" ? "--output" : option, optionValue);
          }
          if (dockerBuild.family === "docker-compose-build" && ["-f", "--file", "--project-directory", "--env-file"].includes(option)) {
            const resource = literalWorkspacePath(optionValue, effectiveCwd, workspaceRoot);
            if (resource) inputResources.push(resource);
          }
          if (attached === undefined) index += 1;
        }
        continue;
      }
      if (!value.startsWith("-")) positional.push(value);
    }
    for (const selector of dockerBuild.args) {
      const match = selector.match(/^--(file|project-directory|env-file)=(.+)$/);
      if (dockerBuild.family === "docker-compose-build" && match) {
        const resource = literalWorkspacePath(match[2], effectiveCwd, workspaceRoot);
        if (resource) inputResources.push(resource);
      }
    }
    const contextResources = dockerBuild.family === "docker-compose-build" ? inputResources : positional.slice(-1)
      .filter((value) => !/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(value) && value !== "-")
      .map((value) => literalWorkspacePath(value, effectiveCwd, workspaceRoot))
      .filter((value): value is string => Boolean(value));
    const identified = suite(dockerBuild.family, dockerBuild.args, effectiveCwd);
    const resources = unique([...contextResources, ...outputResources]);
    return finish({
      kind: "build",
      resources,
      subjectKey: `suite:${identified.family}:${identified.target}`,
      suite: identified,
      mutatesWorkspace: outputResources.length > 0,
      effectiveCwd,
    });
  }
  if (packageManager && /^(?:build|typecheck|type-check)$/.test(script)) {
    return finish(validationShell("build", `${actual}-${script}`, values.slice(1), effectiveCwd));
  }
  const lint = ["eslint", "ruff", "clippy", "biome", "prettier", "black"].includes(actual) ||
    (actual === "cargo" && script === "clippy") || (packageManager && /^(?:lint|format|fmt)$/.test(script));
  const lintWrites = (actual === "eslint" && values.includes("--fix")) ||
    (actual === "ruff" && (values.includes("--fix") || (values[0] === "format" && !values.includes("--check")))) ||
    (actual === "biome" && (values.includes("--write") || values.includes("--fix"))) ||
    (actual === "prettier" && (values.includes("--write") || values.includes("-w"))) ||
    (actual === "black" && !values.includes("--check")) ||
    (packageManager && /^(?:format|fmt)$/.test(script));
  if (lint) {
    const family = actual === "cargo" ? "cargo-clippy" : packageManager ? `${actual}-${script}` : actual;
    const target = actual === "cargo" || packageManager ? values.slice(1) : values;
    const classified = validationShell("lint", family, target, effectiveCwd);
    const optionValues = new Set([
      "--config", "--ignore-path", "--plugin", "--parser", "--print-width", "--tab-width",
      "--cache-location", "--output-file", "--log-level", "--end-of-line", "--config-precedence",
      "--embedded-language-formatting", "--prose-wrap", "--quote-props", "--trailing-comma", "--stdin-filepath",
      "--range-start", "--range-end",
    ]);
    const pathArgs: string[] = [];
    for (let index = 0; index < target.length; index += 1) {
      const value = target[index];
      if (optionValues.has(value)) {
        index += 1;
        continue;
      }
      if (!value.startsWith("-") && !["check", "format", "lint"].includes(value)) pathArgs.push(value);
    }
    const workspaceResources = unique(pathArgs.map((value) =>
      literalWorkspacePath(value, effectiveCwd, workspaceRoot) ?? globWorkspaceRoot(value, effectiveCwd, workspaceRoot)
    ).filter((value): value is string => Boolean(value)));
    const hasRelativePattern = pathArgs.some((value) => !isAbsolute(value) && /[*?{}[\]]/.test(value));
    const implicitWorkspaceResource = pathArgs.length === 0 || (hasRelativePattern && workspaceResources.length === 0)
      ? literalWorkspacePath(".", effectiveCwd, workspaceRoot)
      : undefined;
    const writeResources = unique([
      ...workspaceResources,
      ...(implicitWorkspaceResource ? [implicitWorkspaceResource] : []),
    ]);
    return finish({
      ...classified,
      resources: writeResources,
      mutatesWorkspace: lintWrites && writeResources.length > 0,
    });
  }
  if (actual === "git" && script === "apply") {
    const applyArgs = values.slice(1);
    if (!applyArgs.includes("--apply") &&
      applyArgs.some((value) => ["--check", "--stat", "--numstat", "--summary"].includes(value))) {
      return finish(statusShell("git-apply-check", applyArgs, commandCwd));
    }
    const workspace = literalWorkspacePath(".", commandCwd, workspaceRoot);
    return finish({
      kind: "edit",
      resources: workspace ? [workspace] : [],
      subjectKey: workspace ?? "command:git-apply",
      mutatesWorkspace: workspace !== undefined,
      effectiveCwd: commandCwd,
    });
  }
  if (actual === "git" && ["status", "diff", "log"].includes(script)) {
    return finish(statusShell(`git-${script}`, values.slice(1), commandCwd));
  }
  if (actual === "git" && ["restore", "checkout", "clean"].includes(script)) {
    const commandArgs = values.slice(1);
    let candidates: string[] = [];
    if (script === "restore") {
      const valueOptions = new Set(["--source", "-s", "--pathspec-from-file"]);
      for (let index = 0; index < commandArgs.length; index += 1) {
        const value = commandArgs[index];
        if (valueOptions.has(value)) { index += 1; continue; }
        if (value.startsWith("--source=") || value.startsWith("--pathspec-from-file=") || value === "--" || value.startsWith("-")) continue;
        candidates.push(value);
      }
    } else if (script === "checkout") {
      const separator = commandArgs.indexOf("--");
      candidates = separator >= 0 ? commandArgs.slice(separator + 1) : ["."];
    } else candidates = ["."];
    if (candidates.length === 0) candidates = ["."];
    const resources = unique(candidates.map((value) =>
      literalWorkspacePath(value, commandCwd, workspaceRoot) ?? globWorkspaceRoot(value, commandCwd, workspaceRoot)
    ).filter((value): value is string => Boolean(value)));
    return finish({ kind: "edit", resources, subjectKey: resources[0] ?? `command:git-${script}`,
      mutatesWorkspace: resources.length > 0, effectiveCwd: commandCwd });
  }
  if (["rg", "grep"].includes(actual)) return finish(searchShell(actual, values, effectiveCwd));
  const sedWrites = actual === "sed" ? sedWriteTargets(values) : [];
  if (sedWrites.length > 0 && !hasSedInPlaceOption(values)) {
    const resources = unique(sedWrites.map((value) => literalWorkspacePath(value, effectiveCwd, workspaceRoot))
      .filter((value): value is string => Boolean(value)));
    return finish({ kind: "edit", resources, subjectKey: resources[0] ?? "command:sed-write",
      mutatesWorkspace: resources.length > 0, effectiveCwd });
  }
  if (["cat", "head", "tail"].includes(actual) || (actual === "sed" && !hasSedInPlaceOption(values))) {
    return finish(basicShell("read", actual, values, effectiveCwd));
  }
  if (actual === "find" && !values.includes("-delete")) return finish(searchShell(actual, values, effectiveCwd));
  const codeGeneration = (packageManager && /^(?:generate|codegen|gen)(?::.+)?$/.test(script)) ||
    ["graphql-codegen", "openapi-generator", "protoc"].includes(actual) ||
    (actual === "prisma" && script === "generate");
  if (codeGeneration) {
    const generationRoot = literalWorkspacePath(".", effectiveCwd, workspaceRoot);
    return finish({
      kind: "edit",
      resources: generationRoot ? [generationRoot] : [],
      subjectKey: generationRoot ?? `command:${actual}`,
      mutatesWorkspace: generationRoot !== undefined,
      effectiveCwd,
    });
  }
  const install = (["install", "add"].includes(script) && packageManager) ||
    (["pip", "pip3"].includes(actual) && script === "install");
  if (install) return finish(basicShell("install", actual, values, effectiveCwd, true));
  if (["patch", "gpatch", "apply_patch"].includes(actual) && values.includes("--dry-run")) {
    return finish(statusShell(`${actual}-dry-run`, values, effectiveCwd));
  }
  const mutating = ["rm", "mv", "cp", "mkdir", "patch", "gpatch", "apply_patch"].includes(actual) ||
    (actual === "find" && values.includes("-delete")) ||
    (actual === "sed" && hasSedInPlaceOption(values)) ||
    (actual === "tee") || ["prettier", "black"].includes(actual);
  if (mutating) {
    const positional = values.filter((value) => !value.startsWith("-"));
    let targets: string[];
    if (["cp", "mv"].includes(actual)) {
      let targetDirectory: string | undefined;
      const operands: string[] = [];
      let options = true;
      for (let index = 0; index < values.length; index += 1) {
        const value = values[index];
        if (options && value === "--") {
          options = false;
          continue;
        }
        if (options && ["-t", "--target-directory"].includes(value)) {
          targetDirectory = values[index + 1];
          index += 1;
          continue;
        }
        if (options && (value === "-S" || value === "--suffix")) {
          index += 1;
          continue;
        }
        if (options && value.startsWith("--target-directory=")) {
          targetDirectory = value.slice(19);
          continue;
        }
        const clusteredTarget = options ? value.match(/^-([A-Za-z]*?)t(.+)$/) : undefined;
        if (clusteredTarget) {
          targetDirectory = clusteredTarget[2];
          continue;
        }
        if (options && /^-[A-Za-z]*t$/.test(value)) {
          targetDirectory = values[index + 1];
          index += 1;
          continue;
        }
        if (options && (value.startsWith("--suffix=") || value.startsWith("-"))) continue;
        operands.push(value);
      }
      const destinations = targetDirectory
        ? [targetDirectory]
        : operands.length > 1 ? [operands.at(-1)!] : [];
      const sources = targetDirectory ? operands : operands.slice(0, -1);
      targets = actual === "mv" ? [...sources, ...destinations] : destinations;
    } else if (actual === "tee") {
      targets = positional;
    } else if (actual === "find") {
      const expression = positional.findIndex((value) => ["!", "(", ")"].includes(value));
      targets = expression < 0 ? positional.slice(0, 1) : positional.slice(0, expression);
    } else if (actual === "sed") {
      const looksLikeSedScript = (value: string): boolean =>
        /^(?:[0-9,$]+)?(?:s|y)(.).+\1[gpImw]*$/.test(value) ||
        /^(?:[0-9,$]+)?[acdiqprw=]/.test(value);
      targets = [];
      let scriptSupplied = false;
      for (let index = 0; index < values.length; index += 1) {
        const value = values[index];
        if (value === "-i" || value === "--in-place") {
          const candidate = values[index + 1];
          const following = values[index + 2];
          const detachedSuffix = value === "-i" && candidate !== undefined && candidate !== "--" &&
            (candidate === "" || candidate.startsWith(".") || (!candidate.startsWith("-") && following !== undefined &&
              (scriptSupplied || looksLikeSedScript(following))));
          if (detachedSuffix) index += 1;
          continue;
        }
        if (value.startsWith("-i") || value.startsWith("--in-place=") || hasSedInPlaceOption([value])) continue;
        if (["-e", "--expression", "-f", "--file"].includes(value)) {
          scriptSupplied = true;
          index += 1;
          continue;
        }
        if (value.startsWith("--expression=") || value.startsWith("--file=") ||
          (/^-[ef].+/.test(value) && value !== "-e" && value !== "-f")) {
          scriptSupplied = true;
          continue;
        }
        if (value === "--") {
          const remaining = values.slice(index + 1);
          targets.push(...(scriptSupplied ? remaining : remaining.slice(1)));
          break;
        }
        if (value.startsWith("-")) continue;
        if (!scriptSupplied) {
          scriptSupplied = true;
          continue;
        }
        targets.push(value);
      }
      targets.push(...sedWrites);
    } else if (["patch", "gpatch", "apply_patch"].includes(actual)) {
      const directoryIndex = values.findIndex((value) => value === "-d" || value === "--directory");
      const patchDirectory = values.find((value) => value.startsWith("--directory="))?.slice(12) ??
        values.find((value) => /^-d.+/.test(value) && !value.startsWith("--"))?.slice(2) ??
        (directoryIndex < 0 ? effectiveCwd : values[directoryIndex + 1]);
      const outputIndex = values.findIndex((value) => value === "-o" || value === "--output");
      const output = values.find((value) => value.startsWith("--output="))?.slice(9) ??
        values.find((value) => /^-o.+/.test(value) && !value.startsWith("--"))?.slice(2) ??
        (outputIndex < 0 ? undefined : values[outputIndex + 1]);
      const resolvedPatchDirectory = patchDirectory
        ? literalPath(patchDirectory, effectiveCwd) ?? patchDirectory
        : effectiveCwd;
      targets = [resolvedPatchDirectory,
        ...(output ? [literalPath(output, resolvedPatchDirectory) ?? output] : [])];
    } else {
      targets = positional;
    }
    const quotedValues = new Set(shellArgs.tokens.filter((token) => token.fullyQuoted || token.escaped).map((token) => token.value));
    const resources = unique(targets.map((value) => quotedValues.has(value)
      ? quotedWorkspacePath(value, effectiveCwd, workspaceRoot)
      : literalWorkspacePath(value, effectiveCwd, workspaceRoot) ?? globWorkspaceRoot(value, effectiveCwd, workspaceRoot)
    ).filter((value): value is string => Boolean(value)));
    return finish({
      kind: "run",
      resources,
      subjectKey: resources[0] ?? `command:${actual}`,
      mutatesWorkspace: resources.length > 0,
      effectiveCwd,
    });
  }
  return finish(basicShell("unknown", actual, values, effectiveCwd));
}

function unknownShell(cwd: string): ShellClassification {
  return { kind: "unknown", resources: [], subjectKey: "command:unknown", mutatesWorkspace: false, effectiveCwd: cwd };
}

function validationShell(
  kind: "build" | "lint",
  family: string,
  args: readonly string[],
  cwd: string,
  mutatesWorkspace = false,
): ShellClassification {
  const identifiedSuite = suite(family, args, cwd);
  return {
    kind,
    resources: unique(args.map((value) => literalPath(value, cwd)).filter((value): value is string => Boolean(value))),
    subjectKey: `suite:${identifiedSuite.family}:${identifiedSuite.target}`,
    suite: identifiedSuite,
    mutatesWorkspace,
    effectiveCwd: cwd,
  };
}

function commandSubject(family: string, args: readonly string[]): string {
  return `command:${family}:${JSON.stringify(args)}`;
}

function searchShell(family: string, args: readonly string[], cwd: string): ShellClassification {
  let queryTokens: string[];
  let rootTokens: string[];
  const semanticModifiers: string[] = [];
  if (family === "find") {
    const expressionIndex = args.findIndex((arg) => arg.startsWith("-") || ["!", "(", ")"].includes(arg));
    rootTokens = [...(expressionIndex < 0 ? args : args.slice(0, expressionIndex))];
    queryTokens = expressionIndex < 0 ? [] : args.slice(expressionIndex);
  } else {
    const explicitQueries: string[] = [];
    const positional: string[] = [];
    const optionsWithValues = new Set([
      "-A", "-B", "-C", "-f", "-g", "-m", "-t", "--after-context", "--before-context", "--context",
      "--encoding", "--engine", "--file", "--glob", "--iglob", "--ignore-file", "--max-count", "--regexp",
      "--sort", "--sortr", "--type", "--type-add", "--type-not",
    ]);
    let options = true;
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      if (options && arg === "--") {
        options = false;
        continue;
      }
      if (options && ["-e", "--regexp"].includes(arg)) {
        if (args[index + 1] !== undefined) explicitQueries.push(args[index + 1]);
        index += 1;
        continue;
      }
      if (options && /^-e.+/.test(arg)) {
        explicitQueries.push(arg.slice(2));
        continue;
      }
      if (options && arg.startsWith("--regexp=")) {
        explicitQueries.push(arg.slice("--regexp=".length));
        continue;
      }
      if (options && optionsWithValues.has(arg)) {
        if (args[index + 1] !== undefined) semanticModifiers.push(`${arg}=${args[index + 1]}`);
        index += 1;
        continue;
      }
      if (options) {
        const attached = arg.match(/^(-[ABCfgmt])(.+)$/);
        if (attached && optionsWithValues.has(attached[1])) {
          semanticModifiers.push(`${attached[1]}=${attached[2]}`);
          continue;
        }
      }
      if (options && arg.startsWith("--") && arg.includes("=")) {
        semanticModifiers.push(arg);
        continue;
      }
      if (options && arg.startsWith("-")) {
        semanticModifiers.push(arg);
        continue;
      }
      positional.push(arg);
    }
    queryTokens = explicitQueries.length > 0 ? explicitQueries : positional.slice(0, 1);
    rootTokens = explicitQueries.length > 0 ? positional : positional.slice(1);
  }
  if (rootTokens.length === 0) rootTokens = [cwd];
  const normalizedRoots = rootTokens.map((value) => literalPath(value, cwd) ?? value);
  const resources = unique(normalizedRoots.filter((value) => isAbsolute(value)));
  return {
    kind: "search",
    resources,
    subjectKey: `search:${JSON.stringify({ family, query: queryTokens, roots: normalizedRoots,
      modifiers: [...semanticModifiers].sort() })}`,
    mutatesWorkspace: false,
    effectiveCwd: cwd,
  };
}

function statusShell(family: string, args: readonly string[], cwd: string): ShellClassification {
  const separator = args.indexOf("--");
  const targetArgs = separator >= 0 ? args.slice(separator + 1) : [];
  return {
    kind: "status",
    resources: unique(targetArgs.map((value) => literalPath(value, cwd)).filter((value): value is string => Boolean(value))),
    subjectKey: `command:${JSON.stringify({ family, args, cwd })}`,
    mutatesWorkspace: false,
    effectiveCwd: cwd,
  };
}

function readResourceArguments(family: string, args: readonly string[]): string[] {
  const resources: string[] = [];
  const optionsWithValues = new Set([
    "-c", "--bytes", "-n", "--lines", "--pid", "-s", "--sleep-interval",
  ]);
  let options = true;
  let sedExpressionSeen = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (options && arg === "--") {
      options = false;
      continue;
    }
    if (options && family === "sed" && ["-e", "--expression"].includes(arg)) {
      sedExpressionSeen = true;
      index += 1;
      continue;
    }
    if (options && family === "sed" && ["-f", "--file"].includes(arg)) {
      index += 1;
      continue;
    }
    if (options && family === "sed" && (arg.startsWith("--expression=") || arg.startsWith("--file="))) {
      sedExpressionSeen = true;
      continue;
    }
    if (options && ["head", "tail"].includes(family) && optionsWithValues.has(arg)) {
      index += 1;
      continue;
    }
    if (options && arg.startsWith("-")) continue;
    if (family === "sed" && !sedExpressionSeen) {
      sedExpressionSeen = true;
      continue;
    }
    resources.push(arg);
  }
  return resources;
}

function basicShell(kind: IntentKind, family: string, args: readonly string[], cwd: string, mutatesWorkspace = false): ShellClassification {
  const resourceBearing = ["read", "build", "lint"].includes(kind);
  const resourceArgs = kind === "read" ? readResourceArguments(family, args) : args;
  const resources = resourceBearing
    ? unique(resourceArgs.map((value) => literalPath(value, cwd)).filter((value): value is string => Boolean(value)))
    : [];
  return {
    kind,
    resources,
    subjectKey: kind === "read" && resources[0] ? resources[0] : commandSubject(family, args),
    mutatesWorkspace,
    effectiveCwd: cwd,
  };
}

function classifyShell(command: string, cwd: string): ShellClassification {
  let source = command.trim();
  const leadingSubshell = source.match(/^\(([\s\S]*)\)\s*;\s*([\s\S]+)$/);
  if (leadingSubshell) {
    const left = classifyShell(leadingSubshell[1], cwd);
    const right = classifyShell(leadingSubshell[2], cwd);
    const resources = unique([...(left.mutatesWorkspace ? left.resources : []), ...(right.mutatesWorkspace ? right.resources : [])]);
    return resources.length > 0 ? { ...unknownShell(cwd), resources, subjectKey: resources[0], mutatesWorkspace: true } : unknownShell(cwd);
  }
  if (source.startsWith("(") && source.endsWith(")")) source = source.slice(1, -1).trim();
  let tokens = shellTokens(source);
  if (!tokens) return unknownShell(cwd);
  while (tokens[0]?.value === ";") tokens = tokens.slice(1);
  while (tokens.at(-1)?.value === ";") tokens = tokens.slice(0, -1);
  if (OUTPUT_REDIRECTION.test(tokens[0]?.value ?? "")) {
    tokens = [{ value: ":", quoted: false, fullyQuoted: false }, ...tokens];
  }
  const normalizedExecutable = normalizedShellExecutable(tokens, cwd)?.slice(0, 160);
  const shellSpecificPathSyntax = hasZshQualifierSyntax(source) || hasZshDynamicGlobSyntax(source);
  const classified = shellSpecificPathSyntax || /[`]|\$\(|<\(|>\(/.test(source) || /^\s*(?:eval|source|\.)\s/.test(source)
    ? unknownShell(cwd)
    : classifyExecutable(tokens, cwd);
  return normalizedExecutable ? { ...classified, normalizedExecutable } : classified;
}

function withoutPythonStringsAndComments(code: string): string {
  return code
    .replace(/'''[\s\S]*?'''|"""[\s\S]*?"""/g, " ")
    .replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, " ")
    .replace(/#.*$/gm, " ");
}

function maskPythonStringsAndComments(code: string): string {
  let masked = "";
  let index = 0;
  let state: "code" | "comment" | "single" | "double" | "triple-single" | "triple-double" = "code";
  while (index < code.length) {
    const char = code[index];
    if (state === "code") {
      if (char === "#") {
        masked += " ";
        state = "comment";
        index += 1;
        continue;
      }
      if (char === "'" || char === '"') {
        const triple = code.slice(index, index + 3) === char.repeat(3);
        masked += " ".repeat(triple ? 3 : 1);
        state = triple
          ? char === "'" ? "triple-single" : "triple-double"
          : char === "'" ? "single" : "double";
        index += triple ? 3 : 1;
        continue;
      }
      masked += char;
      index += 1;
      continue;
    }
    if (state === "comment") {
      if (char === "\n" || char === "\r") {
        masked += char;
        state = "code";
      } else masked += " ";
      index += 1;
      continue;
    }
    const quote = state === "single" || state === "triple-single" ? "'" : '"';
    const triple = state === "triple-single" || state === "triple-double";
    if (char === "\\") {
      masked += " ";
      index += 1;
      if (index < code.length) {
        masked += code[index] === "\n" || code[index] === "\r" ? code[index] : " ";
        index += 1;
      }
      continue;
    }
    if (triple && code.slice(index, index + 3) === quote.repeat(3)) {
      masked += "   ";
      index += 3;
      state = "code";
      continue;
    }
    if (!triple && char === quote) {
      masked += " ";
      index += 1;
      state = "code";
      continue;
    }
    masked += char === "\n" || char === "\r" ? char : " ";
    index += 1;
  }
  return masked;
}

function matchingPythonDelimiter(masked: string, start: number): number | undefined {
  const opening = masked[start];
  const closing = opening === "[" ? "]" : opening === "(" ? ")" : undefined;
  if (!closing) return undefined;
  let depth = 0;
  for (let index = start; index < masked.length; index += 1) {
    if (masked[index] === opening) depth += 1;
    else if (masked[index] === closing) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return undefined;
}

function decodePythonStringLiteral(value: string): string {
  return value
    .replace(/\\([\\"'])/g, "$1")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t");
}

function pythonLeadingStringLiteral(value: string): string | undefined {
  const source = value.trimStart();
  const triple = /^(?:"""([\s\S]*?)"""|'''([\s\S]*?)''')/.exec(source);
  if (triple) {
    const rest = source.slice(triple[0].length);
    return /^\s*(?:,|$)/.test(rest) ? decodePythonStringLiteral(triple[1] ?? triple[2] ?? "") : undefined;
  }
  const literal = /^(?:(["'])((?:\\.|(?!\1)[\s\S])*)\1)/.exec(source);
  if (!literal || !/^\s*(?:,|$)/.test(source.slice(literal[0].length))) return undefined;
  return decodePythonStringLiteral(literal[2]);
}

function pythonStringLiterals(value: string): string[] | undefined {
  const literals = [...value.matchAll(/(["'])((?:\\.|(?!\1).)*)\1/g)];
  if (literals.length === 0) return undefined;
  let cursor = 0;
  for (let index = 0; index < literals.length; index += 1) {
    const separator = value.slice(cursor, literals[index].index).trim();
    if ((index === 0 && separator !== "") || (index > 0 && separator !== ",")) return undefined;
    cursor = (literals[index].index ?? 0) + literals[index][0].length;
  }
  if (!/^(?:,\s*)?$/.test(value.slice(cursor))) return undefined;
  return literals.map((match) => decodePythonStringLiteral(match[2]));
}

function pythonSubprocessArgv(value: string): string[] | undefined {
  const literals = pythonStringLiterals(value);
  if (literals) return literals;
  const pathValue = /^\s*(["'])(python3?)\1\s*,\s*str\(\s*[A-Za-z_][A-Za-z0-9_]*\s*\/\s*(["'])([^"']+)\3\s*\)\s*,?\s*$/.exec(value);
  return pathValue ? [pathValue[2], pathValue[4]] : undefined;
}

function ipythonSubprocessValidation(code: string, cwd: string): ShellClassification | undefined {
  const masked = maskPythonStringsAndComments(code);
  const call = /^\s*(?:[A-Za-z_][A-Za-z0-9_]*\s*=\s*)?subprocess\.(?:run|check_call|check_output)\s*\(\s*[\[(]/gm;
  for (const match of masked.matchAll(call)) {
    const start = (match.index ?? 0) + match[0].length - 1;
    const end = matchingPythonDelimiter(masked, start);
    if (end === undefined) continue;
    const argv = pythonSubprocessArgv(code.slice(start + 1, end));
    if (!argv || argv.length === 0) continue;
    const classified = classifyExecutable(argv.map((value) => ({ value, quoted: true, fullyQuoted: true })), cwd);
    if (classified.suite && ["test", "build", "lint"].includes(classified.kind)) return classified;
  }
  return undefined;
}

function classifyEmbeddedShell(command: string, cwd: string): ShellClassification[] {
  const classifications: ShellClassification[] = [];
  let effectiveCwd = cwd;
  for (const line of stripHeredocBodies(command).split(/\r?\n/)) {
    const tokens = shellTokens(line);
    if (!tokens || tokens.length === 0) continue;
    if (tokens[0].value === "cd" && tokens.length === 2) {
      effectiveCwd = literalPath(tokens[1].value, effectiveCwd) ?? effectiveCwd;
      continue;
    }
    classifications.push(classifyShell(line, effectiveCwd));
  }
  return classifications;
}

function ipythonBashClassifications(code: string, cwd: string): ShellClassification[] {
  const masked = maskPythonStringsAndComments(code);
  const call = /(?:^|[^\w.])(?:await\s+)?bash\s*\(/gm;
  const classifications: ShellClassification[] = [];
  for (const match of masked.matchAll(call)) {
    const start = (match.index ?? 0) + match[0].lastIndexOf("(");
    const end = matchingPythonDelimiter(masked, start);
    if (end === undefined) continue;
    const argumentsSource = code.slice(start + 1, end);
    const keyword = argumentsSource.match(/^\s*command\s*=\s*/);
    const command = pythonLeadingStringLiteral(keyword ? argumentsSource.slice(keyword[0].length) : argumentsSource);
    if (command === undefined) continue;
    classifications.push(...classifyEmbeddedShell(command, cwd));
  }
  return classifications;
}

function customResources(input: Record<string, unknown>, cwd: string, toolSchema?: unknown): string[] {
  const values: string[] = [];
  const visit = (value: unknown, schema: unknown, depth: number): void => {
    if (!value || typeof value !== "object" || Array.isArray(value) || depth > 4) return;
    const object = value as Record<string, unknown>;
    const schemaObject = schema && typeof schema === "object" ? schema as Record<string, unknown> : undefined;
    const properties = schemaObject?.properties && typeof schemaObject.properties === "object"
      ? schemaObject.properties as Record<string, unknown>
      : undefined;
    const fields = depth === 0
      ? unique([...IDENTITY_FIELDS, ...Object.keys(properties ?? {}).sort()], Number.POSITIVE_INFINITY)
      : Object.keys(properties ?? {}).sort();
    for (const field of fields) {
      if (!(field in object)) continue;
      const fieldValue = object[field];
      if (IDENTITY_FIELDS.includes(field)) {
        const entries = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
        for (const entry of entries) {
          if (typeof entry !== "string") continue;
          const path = ["path", "file", "files", "directory", "cwd"].includes(field)
            ? literalPath(entry, cwd)
            : undefined;
          values.push(path ?? `${field}:${entry}`);
        }
      }
      const childSchema = properties?.[field];
      const schemaType = childSchema && typeof childSchema === "object"
        ? (childSchema as Record<string, unknown>).type
        : undefined;
      const lowRiskScalar = !IDENTITY_FIELDS.includes(field) &&
        !/(?:secret|token|password|credential|authorization|api[_-]?key|code|content|body|data)/i.test(field) &&
        ["string", "number", "integer", "boolean"].includes(String(schemaType)) &&
        (typeof fieldValue === "number" || typeof fieldValue === "boolean" ||
          (typeof fieldValue === "string" && utf8Bytes(fieldValue) <= 256));
      if (lowRiskScalar) values.push(`${field}:${String(fieldValue)}`);
      if (Array.isArray(fieldValue)) {
        const itemSchema = childSchema && typeof childSchema === "object"
          ? (childSchema as Record<string, unknown>).items
          : undefined;
        for (const item of fieldValue) visit(item, itemSchema, depth + 1);
      } else {
        visit(fieldValue, childSchema, depth + 1);
      }
    }
  };
  visit(input, toolSchema, 0);
  return unique(values);
}

function ipythonWriteResources(code: string, cwd: string): string[] {
  const resources: string[] = [];
  const literalPathWrite = /(?:pathlib\s*\.\s*)?Path\(\s*(["'])([^"']+)\1\s*\)\s*\.\s*write_(?:text|bytes)\s*\(/g;
  for (const match of code.matchAll(literalPathWrite)) {
    const path = literalPath(match[2], cwd);
    if (path) resources.push(path);
  }
  return unique(resources);
}

function ipythonDiffResources(details: unknown, cwd: string): string[] {
  if (!details || typeof details !== "object") return [];
  const diffs = (details as { diffs?: unknown }).diffs;
  if (!Array.isArray(diffs)) return [];
  return unique(diffs.flatMap((diff) => {
    if (!diff || typeof diff !== "object") return [];
    const object = diff as Record<string, unknown>;
    const path = literalPath(object.path ?? object.file, cwd);
    return path ? [path] : [];
  }));
}

export function adaptToolIntent(options: AdaptToolIntentOptions): ToolIntent {
  const { exchangeId, toolCallId, toolName, input, cwd, modelInputBytes, toolSchema, details, resultText, isError } = options;
  const base = {
    exchangeId,
    toolCallId,
    toolName,
    modelInputBytes,
    executedInputBytes: jsonBytes(input),
    effectiveCwd: cwd,
  };
  if (toolName === "edit") {
    const resource = literalPath(input.path, cwd);
    const edits = Array.isArray(input.edits)
      ? input.edits.filter((edit): edit is Record<string, unknown> => Boolean(edit) && typeof edit === "object")
      : [];
    const oldTexts = edits.map((edit) => typeof edit.oldText === "string" ? edit.oldText : "");
    const newTexts = edits.map((edit) => typeof edit.newText === "string" ? edit.newText : "");
    const detailObject = details && typeof details === "object" ? details as Record<string, unknown> : {};
    return {
      ...base,
      kind: "edit",
      resources: resource ? [resource] : [],
      subjectKey: resource ?? "edit:unknown",
      mutatesWorkspace: true,
      facts: {
        editCount: edits.length,
        oldTextBytes: oldTexts.reduce((total, value) => total + Buffer.byteLength(value, "utf8"), 0),
        newTextBytes: newTexts.reduce((total, value) => total + Buffer.byteLength(value, "utf8"), 0),
        oldTextLines: oldTexts.reduce((total, value) => total + textLines(value), 0),
        newTextLines: newTexts.reduce((total, value) => total + textLines(value), 0),
        diffBytes: typeof detailObject.diff === "string" ? Buffer.byteLength(detailObject.diff, "utf8") : undefined,
        firstChangedLine: typeof detailObject.firstChangedLine === "number" ? detailObject.firstChangedLine : undefined,
      },
    };
  }
  if (toolName === "bash") {
    const command = typeof input.command === "string" ? input.command : "";
    const { normalizedExecutable, ...classified } = classifyShell(command, cwd);
    const detailObject = details && typeof details === "object" ? details as Record<string, unknown> : {};
    const truncation = detailObject.truncation && typeof detailObject.truncation === "object"
      ? detailObject.truncation as Record<string, unknown>
      : undefined;
    const facts: ToolIntentFacts = {
      ...(normalizedExecutable ? { normalizedExecutable } : {}),
      ...(truncation?.truncated === true ? {
        truncation: typeof truncation.truncatedBy === "string" ? truncation.truncatedBy : "yes",
      } : {}),
      ...(typeof truncation?.totalBytes === "number" ? { sourceBytes: truncation.totalBytes } : {}),
      ...(typeof truncation?.outputBytes === "number" ? { visibleBytes: truncation.outputBytes } : {}),
    };
    return {
      ...base,
      ...classified,
      command,
      ...(Object.keys(facts).length > 0 ? { facts } : {}),
    };
  }
  if (toolName === "ipython") {
    const code = typeof input.code === "string" ? input.code : "";
    const executable = withoutPythonStringsAndComments(code);
    const detailObject = details && typeof details === "object" ? details as Record<string, unknown> : {};
    const bashClassifications = ipythonBashClassifications(code, cwd);
    const bashMutationResources = bashClassifications.flatMap((classified) =>
      classified.mutatesWorkspace ? classified.resources : []);
    const mutationResources = unique([
      ...ipythonDiffResources(details, cwd),
      ...ipythonWriteResources(code, cwd),
      ...bashMutationResources,
    ]);
    const directFileMutation = /\.(?:write_text|write_bytes)\s*\(/.test(executable);
    const sentAgentMessages = Array.isArray(detailObject.sentAgentMessages) ? detailObject.sentAgentMessages.length : 0;
    const delegates = sentAgentMessages > 0 || /\b(?:await\s+)?rlm\s*\(/.test(executable);
    const directTests = /\bpytest\.main\s*\(|\bunittest\.(?:main|TextTestRunner)\s*\(/.test(executable);
    const bashValidation = bashClassifications.find((classified) =>
      classified.suite && ["test", "build", "lint"].includes(classified.kind));
    const executableValidation = ipythonSubprocessValidation(code, cwd) ?? bashValidation;
    const identifiedSuite = executableValidation?.suite ??
      (directTests ? suite(/pytest/.test(executable) ? "pytest" : "unittest", [], cwd) : undefined);
    const resources = unique([...mutationResources, ...(executableValidation?.resources ?? [])]);
    return {
      ...base,
      kind: delegates ? "delegate" : identifiedSuite ? executableValidation?.kind ?? "test" : "run",
      resources,
      subjectKey: identifiedSuite ? `suite:${identifiedSuite.family}:${identifiedSuite.target}` : resources[0] ?? "ipython:run",
      suite: identifiedSuite,
      mutatesWorkspace: mutationResources.length > 0 || directFileMutation ||
        bashClassifications.some((classified) => classified.mutatesWorkspace),
      facts: {
        ...(typeof detailObject.status === "string" ? { kernelStatus: detailObject.status } : {}),
        ...(typeof detailObject.durationMs === "number" ? { durationMs: detailObject.durationMs } : {}),
        ...(detailObject.kernelRestarted === true ? { kernelRestarted: "true" } : {}),
        ...(sentAgentMessages > 0 ? { sentAgentMessages } : {}),
        ...(bashClassifications.length > 0 ? { bashCalls: bashClassifications.length } : {}),
      },
    };
  }
  if (toolName === "prime_context") {
    const action = typeof input.action === "string" ? input.action : "unknown";
    const resources = customResources(input, cwd, toolSchema);
    const kind: IntentKind = ["search", "recall"].includes(action) ? "search" : "read";
    return { ...base, kind, resources, subjectKey: `prime_context:${action}:${resources[0] ?? "current"}`, mutatesWorkspace: false };
  }
  const resources = customResources(input, cwd, toolSchema);
  const mutationName = /(?:^|[_-])(write|edit|patch|delete|rename|move)(?:$|[_-])/i.test(toolName);
  const testName = /(?:^|[_-])(?:test|tests)(?:$|[_-])/i.test(toolName);
  const parsed = resultText === undefined ? undefined : analyzeOutcome(resultText, isError);
  const identifiedSuite = testName && parsed?.testTotal !== null ? suite(`custom:${toolName}`, [], cwd) : undefined;
  return {
    ...base,
    kind: identifiedSuite ? "test" : mutationName ? "edit" : "unknown",
    resources,
    subjectKey: identifiedSuite
      ? `suite:${identifiedSuite.family}:${identifiedSuite.target}`
      : mutationName && resources[0]
        ? resources[0]
        : resources.length > 0
          ? `tool:${toolName}:${truncateUtf8(JSON.stringify(resources), 1024)}`
          : `tool:${toolName}`,
    suite: identifiedSuite,
    mutatesWorkspace: mutationName,
  };
}


/** Deterministically parse the final executed tool intent once for exchange finalization. */
export interface ParseToolIntentInput {
  toolName: string;
  originalInput: unknown;
  executedInput?: unknown;
  nativeDetails?: unknown;
  exchangeId?: string;
  toolCallId?: string;
  cwd?: string;
  toolSchema?: unknown;
}

export function parseToolIntent(input: ParseToolIntentInput): ToolIntent {
  const original = input.originalInput && typeof input.originalInput === "object" && !Array.isArray(input.originalInput)
    ? input.originalInput as Record<string, unknown>
    : {};
  const executed = input.executedInput && typeof input.executedInput === "object" && !Array.isArray(input.executedInput)
    ? input.executedInput as Record<string, unknown>
    : original;
  const parsed = adaptToolIntent({
    exchangeId: input.exchangeId ?? input.toolCallId ?? `tool:${input.toolName}`,
    toolCallId: input.toolCallId ?? input.exchangeId ?? `tool:${input.toolName}`,
    toolName: input.toolName,
    input: executed,
    cwd: input.cwd ?? "/",
    modelInputBytes: jsonBytes(original),
    toolSchema: input.toolSchema,
    details: input.nativeDetails,
  });

  const details = input.nativeDetails && typeof input.nativeDetails === "object" && !Array.isArray(input.nativeDetails)
    ? input.nativeDetails as Record<string, unknown>
    : undefined;
  const native = details?.intent && typeof details.intent === "object" && !Array.isArray(details.intent)
    ? details.intent as Record<string, unknown>
    : details;
  if (!native) return parsed;

  const kind = typeof native.kind === "string" && [
    "read", "search", "edit", "test", "build", "lint", "run", "status", "install", "delegate", "unknown",
  ].includes(native.kind) ? native.kind as IntentKind : parsed.kind;
  const resources = Array.isArray(native.resources)
    ? unique(native.resources.filter((value): value is string => typeof value === "string"), 32)
    : parsed.resources;
  const subjectKey = typeof native.subjectKey === "string" && native.subjectKey.length > 0
    ? truncateUtf8(native.subjectKey, 1024)
    : parsed.subjectKey;
  const mutatesWorkspace = typeof native.mutatesWorkspace === "boolean"
    ? native.mutatesWorkspace
    : parsed.mutatesWorkspace;
  return { ...parsed, kind, resources, subjectKey, mutatesWorkspace };
}

export interface ClassifiedValidationCommand {
  kind: "test" | "build" | "lint";
  command: string;
  suite: SuiteIdentity;
  subjectKey: string;
  resources: string[];
}

export function classifyValidationCommand(
  command: string,
  cwd: string,
): ClassifiedValidationCommand | undefined {
  const intent = adaptToolIntent({
    exchangeId: "classification",
    toolCallId: "classification",
    toolName: "bash",
    input: { command },
    cwd,
    modelInputBytes: Buffer.byteLength(JSON.stringify({ command }), "utf8"),
  });
  if (!intent.suite || !["test", "build", "lint"].includes(intent.kind)) return undefined;
  return {
    kind: intent.kind as "test" | "build" | "lint",
    command,
    suite: { ...intent.suite },
    subjectKey: intent.subjectKey,
    resources: [...intent.resources],
  };
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

interface DirectOutcomeFacts {
  status?: OutcomeSummary["status"];
  testSummary?: string;
  testTotal?: number;
  failingTests?: string[];
  sourceLocations?: string[];
  commandFailures?: string[];
}

function outcomeLines(text: string): string[] {
  return text.split(/\r?\n/)
    .map((line) => line.replaceAll(/\x1b\[[0-?]*[ -/]*[@-~]/g, ""));
}

function outcomeSummary(value: string): string {
  return value.trim().replace(/^=+\s*/, "").replace(/\s*=+$/, "").replaceAll(/\s+/g, " ").toUpperCase();
}

function countBefore(label: string, value: string): number {
  const match = new RegExp(`(\\d+)\\s+${label}`, "i").exec(value);
  return match ? Number(match[1]) : 0;
}

function directOutcomeFacts(intent: ToolIntent, text: string): DirectOutcomeFacts | undefined {
  const family = intent.suite?.family;
  if (!family) return undefined;
  const lines = outcomeLines(text);

  if (["pytest", "unittest"].includes(family)) {
    const pytestSummary = [...lines].reverse().find((line) =>
      /(?:^|\s)\d+\s+(?:passed|failed)(?:\s*,|\s+in\s+|\s*$)/i.test(line.replace(/^=+\s*/, "").replace(/\s*=+$/, ""))
    );
    const ran = [...lines].reverse().map((line) => /^\s*Ran\s+(\d+)\s+tests?/i.exec(line)).find(Boolean);
    const unittestResult = [...lines].reverse().find((line) => /^\s*(?:OK|FAILED\s*\([^)]*\))\s*$/i.test(line));
    const failingTests = allUnique(lines.flatMap((line) => {
      const pytest = family === "pytest" ? /^\s*FAILED\s+(.+?)(?:\s+-\s+|$)/i.exec(line) : null;
      if (pytest) return [pytest[1].trim()];
      const unittest = /^\s*(?:FAIL|ERROR):\s+(.+?)(?:\s+\(|$)/i.exec(line);
      return unittest ? [unittest[1].trim()] : [];
    }));
    const summary = pytestSummary ?? unittestResult ?? (ran ? ran[0] : undefined);
    const passed = pytestSummary ? countBefore("passed", pytestSummary) : 0;
    const failed = pytestSummary ? countBefore("failed", pytestSummary) : 0;
    const terminalFailure = Boolean(unittestResult && /^\s*FAILED/i.test(unittestResult));
    const terminalSuccess = Boolean(unittestResult && /^\s*OK\s*$/i.test(unittestResult));
    return {
      status: failed > 0 || terminalFailure || failingTests.length > 0
        ? "failure"
        : passed > 0 || terminalSuccess ? "success" : undefined,
      testSummary: summary ? outcomeSummary(summary) : undefined,
      testTotal: ran ? Number(ran[1]) : pytestSummary ? passed + failed : undefined,
      failingTests,
    };
  }

  if (["jest", "vitest"].includes(family)) {
    const jestSummary = [...lines].reverse().find((line) => /^\s*Tests:\s+/i.test(line));
    const vitestSummary = [...lines].reverse().find((line) => /^\s*Tests\s+.*\(\d+\)\s*$/i.test(line));
    const summary = jestSummary ?? vitestSummary;
    const totalMatch = summary ? /\b(\d+)\s+total\b/i.exec(summary) ?? /\((\d+)\)\s*$/.exec(summary) : null;
    const failed = summary ? countBefore("failed", summary) : 0;
    const passed = summary ? countBefore("passed", summary) : 0;
    const failingTests = allUnique(lines.flatMap((line) => {
      const match = family === "vitest"
        ? /^\s*FAIL\s+(.+?)(?:\s+\[|$)/i.exec(line)
        : /^\s*FAIL\s+(\S+)/i.exec(line);
      const jestCase = family === "jest" ? /^\s*●\s+(.+)/.exec(line) : null;
      return match ? [match[1].trim()] : jestCase ? [jestCase[1].trim()] : [];
    }));
    return {
      status: failed > 0 || failingTests.length > 0 ? "failure" : passed > 0 ? "success" : undefined,
      testSummary: summary ? outcomeSummary(summary) : undefined,
      testTotal: totalMatch ? Number(totalMatch[1]) : passed + failed || undefined,
      failingTests,
    };
  }

  if (family === "tsc") {
    const errors = lines.filter((line) => /\berror\s+TS\d+\s*:/i.test(line));
    const found = [...lines].reverse().map((line) => /Found\s+(\d+)\s+errors?/i.exec(line)).find(Boolean);
    const sourceLocations = unique(errors.flatMap((line) => {
      const match = /([^\s:][^()\n]*\.(?:ts|tsx))\((\d+),\d+\)/i.exec(line) ??
        /([^\s:][^:\n]*\.(?:ts|tsx)):(\d+):\d+/i.exec(line);
      return match ? [`${match[1]}:${match[2]}`] : [];
    }));
    return {
      status: errors.length > 0 || (found && Number(found[1]) > 0) ? "failure" : found ? "success" : undefined,
      sourceLocations,
      commandFailures: unique(errors.map((line) => line.trim()), 8),
    };
  }

  if (family === "eslint") {
    const problemSummary = [...lines].reverse().find((line) => /\b\d+\s+problems?\s*\([^)]*\b\d+\s+errors?/i.test(line));
    const errors = problemSummary ? countBefore("errors?", problemSummary) : 0;
    const sourceLocations: string[] = [];
    const commandFailures: string[] = [];
    let currentFile: string | undefined;
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^(?:[A-Za-z]:\\|[A-Za-z0-9_./\-])[^\s]*\.(?:js|jsx|ts|tsx|mjs|cjs)$/i.test(trimmed)) currentFile = trimmed;
      const stylish = /^\s*(\d+):(\d+)\s+error\s+/i.exec(line);
      if (stylish) {
        if (currentFile) sourceLocations.push(`${currentFile}:${stylish[1]}`);
        commandFailures.push(trimmed);
      }
      const compact = /^(.+\.(?:js|jsx|ts|tsx|mjs|cjs)):.*\bline\s+(\d+),\s*col\s+\d+,\s*Error\b/i.exec(line);
      if (compact) {
        sourceLocations.push(`${compact[1]}:${compact[2]}`);
        commandFailures.push(trimmed);
      }
    }
    return {
      status: errors > 0 || commandFailures.length > 0 ? "failure" : problemSummary ? "success" : undefined,
      sourceLocations: unique(sourceLocations),
      commandFailures: unique(commandFailures, 8),
    };
  }

  if (["cargo-test", "cargo-check"].includes(family)) {
    const testSummary = [...lines].reverse().find((line) => /^\s*test result:\s*(?:ok|FAILED)\./i.test(line));
    const failedTests = allUnique(lines.flatMap((line) => {
      const match = /^\s*test\s+(.+?)\s+\.\.\.\s+FAILED\s*$/i.exec(line);
      return match ? [match[1].trim()] : [];
    }));
    const errors = lines.filter((line) => /^\s*error(?:\[[A-Z0-9]+\])?:|could not compile/i.test(line));
    const sourceLocations = unique(lines.flatMap((line) => {
      const match = /-->\s+(.+\.(?:rs)):(\d+):\d+/.exec(line);
      return match ? [`${match[1]}:${match[2]}`] : [];
    }));
    const passed = testSummary ? countBefore("passed", testSummary) : 0;
    const failed = testSummary ? countBefore("failed", testSummary) : 0;
    const finished = lines.some((line) => /^\s*Finished\s+(?:dev|test|release)\b/i.test(line));
    return {
      status: failed > 0 || failedTests.length > 0 || errors.length > 0
        ? "failure"
        : testSummary || (family === "cargo-check" && finished) ? "success" : undefined,
      testSummary: testSummary ? outcomeSummary(testSummary) : undefined,
      testTotal: testSummary ? passed + failed : undefined,
      failingTests: failedTests,
      sourceLocations,
      commandFailures: unique(errors.map((line) => line.trim()), 8),
    };
  }

  if (family === "go-test") {
    const failingTests = allUnique(lines.flatMap((line) => {
      const match = /^\s*---\s+FAIL:\s+(\S+)/.exec(line);
      return match ? [match[1]] : [];
    }));
    const cases = lines.filter((line) => /^\s*---\s+(?:PASS|FAIL|SKIP):\s+\S+/.test(line));
    const packageFailure = lines.some((line) => /^\s*FAIL(?:\s|\t|$)/.test(line));
    const packageSuccess = lines.some((line) => /^\s*ok\s+\S+/.test(line));
    const sourceLocations = unique(lines.flatMap((line) => {
      const match = /([^\s:]+\.go):(\d+):/.exec(line);
      return match ? [`${match[1]}:${match[2]}`] : [];
    }));
    return {
      status: packageFailure || failingTests.length > 0 ? "failure" : packageSuccess ? "success" : undefined,
      testSummary: cases.length > 0 ? outcomeSummary(`${cases.length} tests, ${failingTests.length} failed`) : undefined,
      testTotal: cases.length || undefined,
      failingTests,
      sourceLocations,
    };
  }

  if (["maven-test", "gradle-test"].includes(family)) {
    const mavenSummary = [...lines].reverse().find((line) => /Tests run:\s*\d+,\s*Failures:\s*\d+,\s*Errors:\s*\d+/i.test(line));
    const gradleSummary = [...lines].reverse().find((line) => /\b\d+\s+tests? completed(?:,\s*\d+\s+failed)?/i.test(line));
    const summary = mavenSummary ?? gradleSummary;
    const mavenTotal = mavenSummary ? /Tests run:\s*(\d+)/i.exec(mavenSummary) : null;
    const gradleTotal = gradleSummary ? /(\d+)\s+tests? completed/i.exec(gradleSummary) : null;
    const mavenFailures = mavenSummary ? /Failures:\s*(\d+)/i.exec(mavenSummary) : null;
    const mavenErrors = mavenSummary ? /Errors:\s*(\d+)/i.exec(mavenSummary) : null;
    const failures = mavenSummary
      ? Number(mavenFailures?.[1] ?? 0) + Number(mavenErrors?.[1] ?? 0)
      : gradleSummary ? countBefore("failed", gradleSummary) : 0;
    const buildFailure = lines.some((line) => /\bBUILD (?:FAILURE|FAILED)\b/i.test(line));
    const buildSuccess = lines.some((line) => /\bBUILD SUCCESS(?:FUL)?\b/i.test(line));
    const failingTests = allUnique(lines.flatMap((line) => {
      const gradle = family === "gradle-test" ? /^\s*(.+?)\s+>\s+(.+?)\s+FAILED\s*$/i.exec(line) : null;
      if (gradle) return [`${gradle[1].trim()} > ${gradle[2].trim()}`];
      const maven = family === "maven-test"
        ? /^\s*(?:\[ERROR\]\s*)?(?!Tests run:)(\S+)\s+--.+<<<\s+(?:FAILURE|ERROR)!/i.exec(line)
        : null;
      return maven ? [maven[1]] : [];
    }));
    return {
      status: failures > 0 || buildFailure || failingTests.length > 0
        ? "failure"
        : buildSuccess || Boolean(summary) ? "success" : undefined,
      testSummary: summary ? outcomeSummary(summary) : undefined,
      testTotal: mavenTotal || gradleTotal ? Number((mavenTotal ?? gradleTotal)?.[1]) : undefined,
      failingTests,
      commandFailures: buildFailure ? unique(lines.filter((line) => /\bBUILD (?:FAILURE|FAILED)\b/i.test(line)).map((line) => line.trim())) : [],
    };
  }
  return undefined;
}

function typedExitFacts(object: Record<string, unknown>): { statuses: string[]; codes: number[] } {
  const codes = unique([object.exitCode, object.code, object.status].flatMap((value) => {
    if (typeof value === "number" && Number.isFinite(value)) return [String(value)];
    if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return [String(Number(value))];
    return [];
  })).map(Number);
  return { statuses: codes.map((code) => `exit ${code}`), codes };
}

function recomputeOutcomeSignature(outcome: Omit<OutcomeSummary, "signature">): string | null {
  if (outcome.status === "success") return outcome.testSummary ? outcomeSummary(outcome.testSummary) : null;
  if (outcome.status !== "failure") return null;
  if (outcome.failingTests.length > 0) return `FAIL_TESTS;${[...outcome.failingTests].sort().join(",")}`;
  const exceptions = outcome.exceptions.filter((value) => !/^CalledProcessError\b/.test(value));
  if (exceptions.length === 0 && outcome.commandFailures.length === 0 && outcome.exitStatuses.length === 0 && !outcome.testSummary) return null;
  return [
    "FAILURE",
    [...exceptions].sort().join("|"),
    [...outcome.commandFailures].sort().join("|"),
    [...outcome.exitStatuses].sort().join(","),
    outcome.testSummary ?? "",
  ].join(";");
}

const OUTCOME_SCAN_TEXT_CHARS = 256 * 1024;
const OUTCOME_SCAN_EDGE_CHARS = 32 * 1024;
const OUTCOME_SCAN_LINE_CHARS = 8 * 1024;
const OUTCOME_SCAN_EVIDENCE_CHARS = 96 * 1024;
const OUTCOME_MARKERS = [
  "fail", "error", "exception", "passed", "success", "test", "fatal", "traceback", "exit", "signal",
] as const;

/** Keep terminal edges plus bounded diagnostic lines while scanning every large output linearly. */
function boundedOutcomeEvidence(text: string): string {
  if (text.length <= OUTCOME_SCAN_TEXT_CHARS) return text;
  const evidence: string[] = [];
  let evidenceChars = 0;
  let offset = 0;
  while (offset < text.length && evidenceChars < OUTCOME_SCAN_EVIDENCE_CHARS) {
    const newline = text.indexOf("\n", offset);
    const end = newline < 0 ? text.length : newline;
    const length = end - offset;
    if (length <= OUTCOME_SCAN_LINE_CHARS) {
      const line = text.slice(offset, end);
      const lower = line.toLowerCase();
      if (OUTCOME_MARKERS.some((marker) => lower.includes(marker))) {
        evidence.push(line);
        evidenceChars += line.length + 1;
      }
    }
    if (newline < 0) break;
    offset = newline + 1;
  }
  return [
    text.slice(0, OUTCOME_SCAN_EDGE_CHARS),
    ...evidence,
    text.slice(-OUTCOME_SCAN_EDGE_CHARS),
  ].join("\n");
}

export function collectFactualOutcome(
  intent: ToolIntent,
  text: string,
  isError: boolean,
  details?: unknown,
): OutcomeSummary {
  const evidence = boundedOutcomeEvidence(text);
  const parsed = analyzeOutcome(evidence, isError);
  const direct = directOutcomeFacts(intent, evidence);
  const object = details && typeof details === "object" ? details as Record<string, unknown> : {};
  const typedError = object.error && typeof object.error === "object" ? object.error as Record<string, unknown> : undefined;
  const exceptions = unique([
    ...parsed.exceptions,
    ...(typeof object.errorEname === "string" ? [object.errorEname] : []),
    ...(typeof typedError?.ename === "string" ? [`${typedError.ename}${typeof typedError.evalue === "string" ? `: ${typedError.evalue}` : ""}`] : []),
  ], 12);
  const sourceLocations = unique([
    ...parsed.sourceLocations,
    ...(direct?.sourceLocations ?? []),
    ...strings(object.diffs).slice(0, 8),
  ]);
  const exit = typedExitFacts(object);
  const exitStatuses = unique([...parsed.exitStatuses, ...exit.statuses], 8);
  const commandFailures = unique([...parsed.commandFailures, ...(direct?.commandFailures ?? [])], 8);
  const directFailureIdFamilies = new Set(["pytest", "unittest", "jest", "vitest", "go-test"]);
  const genericFailingTests = directFailureIdFamilies.has(intent.suite?.family ?? "") ? [] : parsed.failingTests;
  const failingTests = intent.suite
    ? unique([...genericFailingTests, ...(direct?.failingTests ?? [])], Number.POSITIVE_INFINITY)
    : [];
  const statusValue = typeof object.status === "string" ? object.status.toLowerCase() : undefined;
  const typedFailure = ["error", "failed", "failure"].includes(statusValue ?? "") || Boolean(typedError) ||
    exit.codes.some((code) => code !== 0);
  const typedSuccess = ["ok", "success"].includes(statusValue ?? "") ||
    (["test", "build", "lint", "edit"].includes(intent.kind) &&
      exit.codes.length > 0 && exit.codes.every((code) => code === 0));
  const fallbackFailure = direct?.status === undefined && parsed.status === "failure";
  const factualFailure = isError || typedFailure || direct?.status === "failure" || fallbackFailure;
  const quietBashValidation = intent.toolName === "bash" && intent.suite !== undefined &&
    ["test", "build", "lint"].includes(intent.kind) && !isError;
  const recognizedSuccess = !factualFailure && (
    direct?.status === "success" || typedSuccess || parsed.status === "success" || quietBashValidation
  );
  const withoutSignature: Omit<OutcomeSummary, "signature"> = {
    status: factualFailure ? "failure" : recognizedSuccess ? "success" : "unknown",
    testSummary: intent.suite ? direct?.testSummary ?? parsed.testSummary : null,
    testTotal: intent.suite ? direct?.testTotal ?? parsed.testTotal : null,
    failingTests,
    exceptions,
    sourceLocations,
    exitStatuses,
    commandFailures,
  };
  return { ...withoutSignature, signature: recomputeOutcomeSignature(withoutSignature) };
}
