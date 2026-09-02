import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { PrimeContextActions } from "./tool.js";
import { formatObservationList, formatSnapshotUpdate, formatStatus } from "./tool.js";

const USAGE = [
  "Usage:",
  "/pc status",
  "/pc list [limit]",
  "/pc read <observation-id> [start:end]",
  "/pc search <observation-id|all> <fixed text>",
  "/pc focus <text|clear>",
  "/pc add <text>",
  "/pc done <item-id>",
  "/pc pin <observation-id>",
  "/pc unpin <observation-id>",
  "/pc mode on|off",
  "/pc cleanup current",
  "/pc learn --topic <text> [--from <session-file>]...",
  "/pc doctor",
].join("\n");

function versionFromPath(start: string): string | undefined {
  let current = start;
  for (let depth = 0; depth < 8; depth += 1) {
    try {
      const pkg = JSON.parse(readFileSync(join(current, "package.json"), "utf8")) as {
        name?: string;
        version?: string;
      };
      if ((pkg.name === "prime-agent" || pkg.name === "@earendil-works/pi-coding-agent") && pkg.version) {
        return pkg.version;
      }
    } catch {
      // Keep walking to the package root.
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return undefined;
}

export function detectPrimeAgentVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const resolved = versionFromPath(dirname(require.resolve("@earendil-works/pi-coding-agent")));
    if (resolved) return resolved;
  } catch {
    // Distributed hosts can bundle the public extension packages.
  }
  return process.argv[1] ? (versionFromPath(dirname(process.argv[1])) ?? "unknown") : "unknown";
}

function parseRange(value: string | undefined): { startLine: number; endLine: number } | undefined {
  if (!value) return undefined;
  const match = /^(\d+):(\d+)$/.exec(value);
  if (!match) throw new Error("Line range must use start:end with positive integers.");
  const startLine = Number(match[1]);
  const endLine = Number(match[2]);
  if (!Number.isSafeInteger(startLine) || startLine < 1 || !Number.isSafeInteger(endLine) || endLine < startLine) {
    throw new Error("Line range must use start:end with positive, ascending integers.");
  }
  return { startLine, endLine };
}

export interface LearnCommandRequest {
  topic: string;
  from: readonly string[];
}

function tokenizeLearnArgs(raw: string): string[] {
  const tokens: string[] = [];
  const pattern = /"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\s]+)/gu;
  let match: RegExpExecArray | null;
  let consumed = 0;
  while ((match = pattern.exec(raw)) !== null) {
    if (raw.slice(consumed, match.index).trim()) throw new Error("Usage: /pc learn --topic <text> [--from <session-file>]...");
    const token = match[1] ?? match[2] ?? match[3] ?? "";
    tokens.push(token.replace(/\\([\\"'])/gu, "$1"));
    consumed = pattern.lastIndex;
  }
  if (raw.slice(consumed).trim()) throw new Error("Usage: /pc learn --topic <text> [--from <session-file>]...");
  return tokens;
}

export function parseLearnCommand(raw: string): LearnCommandRequest {
  const tokens = tokenizeLearnArgs(raw);
  let topic: string | undefined;
  const from: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const flag = tokens[index];
    const value = tokens[index + 1];
    if ((flag !== "--topic" && flag !== "--from") || !value || value.startsWith("--")) {
      throw new Error("Usage: /pc learn --topic <text> [--from <session-file>]...");
    }
    if (flag === "--topic") {
      if (topic !== undefined) throw new Error("/pc learn accepts exactly one --topic value.");
      topic = value.trim();
    } else {
      from.push(value);
    }
    index += 1;
  }
  if (!topic) throw new Error("Usage: /pc learn --topic <text> [--from <session-file>]...");
  return { topic, from };
}

export interface PrimeContextCommandOptions {
  learn?: (request: LearnCommandRequest, ctx: ExtensionCommandContext) => Promise<string>;
}

export function registerPrimeContextCommands(
  pi: ExtensionAPI,
  actions: PrimeContextActions,
  options: PrimeContextCommandOptions = {},
): void {
  pi.registerCommand("pc", {
    description: "Page archived output and maintain the Prime Context task snapshot",
    handler: async (rawArgs, ctx) => {
      const args = rawArgs.trim();
      const [command = "", ...tokens] = args.split(/\s+/);
      const archive = actions.getArchive();
      try {
        if (!archive) throw new Error("Prime Context session is not ready.");
        switch (command) {
          case "status":
            ctx.ui.notify(await formatStatus(actions, ctx.signal), "info");
            return;
          case "list": {
            if (tokens.length > 1) throw new Error("Usage: /pc list [limit]");
            const limit = tokens.length === 0 ? 20 : Number(tokens[0]);
            ctx.ui.notify(await formatObservationList(actions, limit, ctx.signal), "info");
            return;
          }
          case "read": {
            const [id, rangeText, ...extra] = tokens;
            if (!id || extra.length > 0) throw new Error("Usage: /pc read <observation-id> [start:end]");
            const range = parseRange(rangeText);
            const result = await archive.readLines(
              id,
              range?.startLine ?? 1,
              range?.endLine ?? 200,
              actions.getReadMaxBytes(),
              ctx.signal,
            );
            archive.recordRecovery(!/^(?:Unknown observation ID:|Prime Context error:)/i.test(result.trim()));
            ctx.ui.notify(result, "info");
            return;
          }
          case "search": {
            const target = tokens.shift();
            const query = tokens.join(" ");
            if (!target || !query) throw new Error("Usage: /pc search <observation-id|all> <fixed text>");
            const result = target === "all"
              ? await archive.searchRecent(query, 20, 1, 0, 50, actions.getReadMaxBytes(), ctx.signal)
              : await archive.search(target, query, 1, 0, 50, actions.getReadMaxBytes(), ctx.signal);
            archive.recordRecovery(!/^(?:No matches found|Unknown observation ID:|Prime Context error:)/i.test(result.trim()));
            ctx.ui.notify(result, "info");
            return;
          }
          case "focus": {
            const text = tokens.join(" ");
            if (!text) throw new Error("Usage: /pc focus <text|clear>");
            const result = actions.updateSnapshot({ focus: text === "clear" ? null : text });
            ctx.ui.notify(formatSnapshotUpdate(result), result.ok ? "info" : "error");
            return;
          }
          case "add": {
            const text = tokens.join(" ");
            if (!text) throw new Error("Usage: /pc add <text>");
            const result = actions.updateSnapshot({ addItems: [text] });
            ctx.ui.notify(formatSnapshotUpdate(result), result.ok ? "info" : "error");
            return;
          }
          case "done": {
            if (tokens.length !== 1) throw new Error("Usage: /pc done <item-id>");
            const result = actions.updateSnapshot({ completeItemIds: [tokens[0]] });
            ctx.ui.notify(formatSnapshotUpdate(result), result.ok ? "info" : "error");
            return;
          }
          case "pin":
          case "unpin": {
            if (tokens.length !== 1) throw new Error(`Usage: /pc ${command} <observation-id>`);
            const changes = command === "pin" ? { pinObservationIds: [tokens[0]] } : { unpinObservationIds: [tokens[0]] };
            const result = actions.updateSnapshot(changes);
            ctx.ui.notify(formatSnapshotUpdate(result), result.ok ? "info" : "error");
            return;
          }
          case "mode":
            if (tokens.length !== 1 || (tokens[0] !== "on" && tokens[0] !== "off")) {
              throw new Error("Usage: /pc mode on|off");
            }
            actions.setMode(tokens[0]);
            ctx.ui.notify(`Prime Context mode: ${tokens[0]}`, "info");
            return;
          case "cleanup": {
            if (tokens.length !== 1 || tokens[0] !== "current") {
              throw new Error("Usage: /pc cleanup current");
            }
            const removed = await archive.clear(ctx.signal);
            actions.clearFixedViews();
            const pinned = actions.getSnapshot().pinnedObservationIds;
            if (pinned.length > 0) actions.updateSnapshot({ unpinObservationIds: pinned });
            ctx.ui.notify(
              `Removed ${removed} archived observation${removed === 1 ? "" : "s"} from the current session.`,
              "info",
            );
            return;
          }
          case "learn": {
            if (!options.learn) throw new Error("Knowledge compilation is not available.");
            const learnArgs = args.slice(command.length).trim();
            ctx.ui.notify(await options.learn(parseLearnCommand(learnArgs), ctx), "info");
            return;
          }
          case "doctor": {
            const writable = await archive.checkIndex(ctx.signal);
            const lines = [
              `Prime Agent version: ${detectPrimeAgentVersion()}`,
              `Required public hooks: ${actions.hooksLoaded() ? "loaded" : "not loaded"}`,
              `Mode: ${actions.getMode()}`,
              `Storage path: ${archive.sessionPath}`,
              `Session index readable/writable: ${writable ? "yes" : "no"}`,
              ...actions.consumeConfigWarnings(),
            ];
            ctx.ui.notify(lines.join("\n"), writable ? "info" : "error");
            return;
          }
          default:
            ctx.ui.notify(USAGE, "info");
        }
      } catch (error) {
        ctx.ui.notify((error as Error).message, "error");
      }
    },
  });
}
