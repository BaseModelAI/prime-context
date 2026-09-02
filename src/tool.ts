import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import type { ImageContent, TextContent } from "@earendil-works/pi-ai";
import { normalizeObservationRef } from "./archive.js";
import type {
  ObservationArchive,
  ObservationRecoveryDetails,
  RecallArchiveSource,
  RecallScope,
} from "./archive.js";
import type {
  PrimeContextMode,
  SnapshotChanges,
  SnapshotUpdateResult,
  TaskSnapshotV2,
} from "./state.js";

export interface PrimeContextParams extends SnapshotChanges {
  action: "read" | "search" | "inspect" | "recall" | "list" | "status" | "update";
  id?: string;
  ref?: string;
  query?: string;
  path?: string;
  kind?: "call" | "result" | "diff" | "diagnostic" | "image";
  tool?: string;
  status?: "success" | "failure" | "error";
  scope?: "task" | "session" | "parent" | "project";
  startLine?: number;
  endLine?: number;
  startByte?: number;
  endByte?: number;
  limit?: number;
  contextLines?: number;
  matchOffset?: number;
  maxMatches?: number;
}

export const MODEL_RECOVERY_MAX_BYTES = 12 * 1024;
export const MODEL_READ_DEFAULT_LINES = 80;
export const MODEL_SEARCH_DEFAULT_MATCHES = 10;
export const MODEL_LIST_MAX_OBSERVATIONS = 20;

export interface PrimeContextActions {
  getMode(): PrimeContextMode;
  setMode(mode: PrimeContextMode): void;
  getArchive(): ObservationArchive | undefined;
  getSnapshot(): TaskSnapshotV2;
  updateSnapshot(changes: SnapshotChanges): SnapshotUpdateResult;
  getReadMaxBytes(): number;
  consumeConfigWarnings(): string[];
  hooksLoaded(): boolean;
  clearFixedViews(): void;
  resolveRecallSources(scope: RecallScope, signal?: AbortSignal): Promise<RecallArchiveSource[]>;
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }], details: {} };
}

export async function formatStatus(actions: PrimeContextActions, signal?: AbortSignal): Promise<string> {
  const archive = actions.getArchive();
  if (!archive) return "Prime Context session is not ready.";
  const snapshot = actions.getSnapshot();
  const archiveCount = await archive.count(signal);
  const broker = archive.brokerStatistics();
  const metrics = broker.metrics;
  const lines = [
    `Mode: ${actions.getMode()}`,
    `Focus: ${snapshot.focus ?? "(none)"}`,
    "Open items:",
    ...(
      snapshot.openItems.length === 0
        ? ["- (none)"]
        : snapshot.openItems.map((item) => `- [${item.id}] ${item.text}`)
    ),
    "Pinned observations:",
    ...(snapshot.pinnedObservationIds.length === 0
      ? ["- (none)"]
      : snapshot.pinnedObservationIds.map((id) => `- ${id}`)),
    `Archive count: ${archiveCount}`,
    `Broker decisions: ${broker.passedThrough} pass-through | ${broker.structuredCapsules} structured | ${broker.deltaCapsules} delta`,
    `Utility buckets: ${broker.utilityBucketCount}`,
    `Source bytes archived: ${metrics.sourceBytesArchived}`,
    `Call-argument bytes projected out: ${metrics.callArgumentBytesProjectedOut}`,
    `Result bytes projected out: ${metrics.resultBytesProjectedOut}`,
    `Typed/media bytes projected out: ${metrics.typedMediaBytesProjectedOut}`,
    `Recovery bytes exposed: ${metrics.recoveryBytesExposed}`,
    `Streaming bytes processed: ${metrics.streamingBytesProcessed}`,
    `Inspect/recall hits: ${metrics.inspectRecallHits}`,
    `Branch runtime reloads: ${metrics.branchRuntimeReloadCount}`,
    `Usage tokens: uncached input ${metrics.uncachedInputTokens} | cache read ${metrics.cacheReadTokens} | cache write ${metrics.cacheWriteTokens}`,
    `Storage path: ${archive.sessionPath}`,
  ];
  return lines.join("\n");
}

export async function formatObservationList(
  actions: PrimeContextActions,
  limit = 20,
  signal?: AbortSignal,
): Promise<string> {
  const archive = actions.getArchive();
  if (!archive) return "Prime Context session is not ready.";
  const observations = await archive.list(limit, signal);
  if (observations.length === 0) return "No archived observations in this session.";
  return [
    `Recent archived observations (${observations.length}):`,
    ...observations.map(
      (observation) =>
        `- ${observation.id} | ${observation.toolName} | ${observation.textBytes} bytes | ` +
        `${observation.lineCount} lines | ${observation.source ?? "visible-tool-result"} | ` +
        `${observation.isError ? "error | " : ""}${observation.createdAt}`,
    ),
  ].join("\n");
}

export function formatSnapshotUpdate(result: SnapshotUpdateResult): string {
  if (!result.ok) return `Prime Context update error: ${result.error}`;
  if (!result.changed) return "No task snapshot changes.";
  return [
    "Task snapshot updated.",
    `Focus: ${result.snapshot.focus ?? "(none)"}`,
    `Open items: ${result.snapshot.openItems.length}`,
    `Pinned observations: ${result.snapshot.pinnedObservationIds.length}`,
  ].join("\n");
}

function recoveryReturnedEvidence(text: string): boolean {
  return !/^(?:Prime Context error:|Unknown observation ID:|No matches (?:found|for)|No archived observations)/i.test(text.trim());
}

function recoveryReceipt(details: ObservationRecoveryDetails): string {
  const ref = details.sessionId ? `${details.sessionId}:${details.ref}` : details.ref;
  if (details.partKind === "image" || details.mediaType?.toLowerCase().startsWith("image/") === true) {
    return `Recovered image ${ref} for the preceding model turn. Reinspect the same ref to view it again.`;
  }
  if (details.startByte !== undefined) {
    const end = details.endByte ?? details.startByte;
    const total = details.totalBytes ?? end;
    const next = details.hasMore ? ` Continue with startByte=${end}.` : "";
    return `Recovered ${ref} bytes [${details.startByte},${end}) of ${total} for the preceding model turn.${next}`;
  }
  const range = details.startLine === undefined
    ? ""
    : ` lines ${details.startLine}-${details.endLine ?? details.startLine}`;
  return `Recovered ${ref}${range} for the preceding model turn. Reinspect the same ref for exact text.`;
}

function currentTaskContext(snapshot: TaskSnapshotV2) {
  return snapshot.taskKey === "session" ? undefined : { taskKey: snapshot.taskKey };
}

interface DirectRecoveryTarget {
  archive: ObservationArchive;
  ref: string;
  scope: RecallScope;
  sessionId?: string;
  sessionDate?: string;
  includeOutsideTask: boolean;
}

async function resolveDirectRecoveryTarget(
  currentArchive: ObservationArchive,
  actions: PrimeContextActions,
  scope: RecallScope,
  rawRef: string,
  signal?: AbortSignal,
): Promise<DirectRecoveryTarget> {
  if (scope === "task" || scope === "session") {
    const prefix = `${currentArchive.sessionId}:`;
    return {
      archive: currentArchive,
      ref: scope === "session" && rawRef.startsWith(prefix) ? rawRef.slice(prefix.length) : rawRef,
      scope,
      ...(scope === "session" ? { sessionId: currentArchive.sessionId } : {}),
      includeOutsideTask: scope === "session",
    };
  }
  const sources = await actions.resolveRecallSources(scope, signal);
  const qualified = [...sources]
    .sort((left, right) => right.sessionId.length - left.sessionId.length)
    .find((source) => rawRef.startsWith(`${source.sessionId}:`));
  const source = qualified ?? (sources.length === 1 ? sources[0] : undefined);
  if (!source) {
    throw new Error(
      sources.length === 0
        ? `No ${scope} recall source is available.`
        : `${scope} inspect/read/search requires a session-qualified ref from recall.`,
    );
  }
  return {
    archive: source.archive,
    ref: qualified ? rawRef.slice(source.sessionId.length + 1) : rawRef,
    scope,
    sessionId: source.sessionId,
    sessionDate: source.sessionDate,
    includeOutsideTask: true,
  };
}

function directRecoveryDetails(
  details: ObservationRecoveryDetails,
  target: DirectRecoveryTarget,
  recordDate: string,
): ObservationRecoveryDetails {
  return {
    ...details,
    scope: target.scope,
    ...(target.scope === "task" ? {} : {
      sessionId: target.sessionId ?? target.archive.sessionId,
      sessionDate: target.sessionDate ?? recordDate,
    }),
  };
}

function directRecoveryResult<T extends object>(
  _actions: PrimeContextActions,
  _toolCallId: string,
  content: readonly (TextContent | ImageContent)[],
  details: T,
  receipt: string,
) {
  return {
    content: [...content, { type: "text" as const, text: receipt }],
    details,
  };
}

export function registerPrimeContextTool(pi: ExtensionAPI, actions: PrimeContextActions): void {
  pi.registerTool({
    name: "prime_context",
    label: "Prime Context",
    description: "Inspect or recall archived output, or update durable task state.",
    promptSnippet: "Inspect or recall archived output, or update task state",
    promptGuidelines: [
      "Use inspect when an exact observation part ref is known; use recall for a known path, suite, test ID, or error string.",
      "Use recall scope=parent with an explicit parent ref; reuse the returned session-qualified ref to page historical evidence.",
      "Search without id scans recent default results; read with id returns exact default-result lines.",
      "Read and inspect return at most 80 lines and search at most 10 matches. Page long single-line fields with the returned startByte.",
      "Rerun work only when archived public evidence genuinely lacks the needed fact.",
      "Set search contextLines from 0 to 20 only when a diagnostic needs wider context.",
      "Update only durable focus, open items, or pins; never store secrets, instructions, reasoning, or raw logs.",
    ],
    parameters: Type.Object({
      action: StringEnum(["read", "search", "inspect", "recall", "list", "status", "update"] as const),
      id: Type.Optional(Type.String()),
      ref: Type.Optional(Type.String()),
      query: Type.Optional(Type.String()),
      path: Type.Optional(Type.String()),
      kind: Type.Optional(StringEnum(["call", "result", "diff", "diagnostic", "image"] as const)),
      tool: Type.Optional(Type.String()),
      status: Type.Optional(StringEnum(["success", "failure", "error"] as const)),
      scope: Type.Optional(StringEnum(["task", "session", "parent", "project"] as const)),
      startLine: Type.Optional(Type.Integer({ minimum: 1 })),
      endLine: Type.Optional(Type.Integer({ minimum: 1 })),
      startByte: Type.Optional(Type.Integer({ minimum: 0 })),
      endByte: Type.Optional(Type.Integer({ minimum: 1 })),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: MODEL_LIST_MAX_OBSERVATIONS })),
      contextLines: Type.Optional(Type.Integer({ minimum: 0, maximum: 20 })),
      matchOffset: Type.Optional(Type.Integer({ minimum: 0, maximum: 10000 })),
      maxMatches: Type.Optional(Type.Integer({ minimum: 1, maximum: MODEL_SEARCH_DEFAULT_MATCHES })),
      focus: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      addItems: Type.Optional(Type.Array(Type.String())),
      completeItemIds: Type.Optional(Type.Array(Type.String())),
      pinObservationIds: Type.Optional(Type.Array(Type.String())),
      unpinObservationIds: Type.Optional(Type.Array(Type.String())),
    }),
    async execute(toolCallId, rawParams, signal) {
      const params = rawParams as PrimeContextParams;
      const archive = actions.getArchive();
      if (!archive) return textResult("Prime Context session is not ready.");
      const recoveryMaxBytes = Math.min(actions.getReadMaxBytes(), MODEL_RECOVERY_MAX_BYTES);
      const maxMatches = Math.min(params.maxMatches ?? MODEL_SEARCH_DEFAULT_MATCHES, MODEL_SEARCH_DEFAULT_MATCHES);
      const externalSearch = params.action === "search" &&
        (params.scope === "parent" || params.scope === "project");
      try {
        switch (externalSearch ? "recall" : params.action) {
          case "read": {
            if (!params.id) return textResult("prime_context read requires an observation id.");
            const scope = params.scope ?? "task";
            const target = await resolveDirectRecoveryTarget(archive, actions, scope, params.id, signal);
            const startLine = params.startLine ?? 1;
            const requestedEndLine = params.endLine ?? startLine + MODEL_READ_DEFAULT_LINES - 1;
            const endLine = Math.min(requestedEndLine, startLine + MODEL_READ_DEFAULT_LINES - 1);
            const record = await target.archive.findObservation(
              normalizeObservationRef(target.ref), signal, target.includeOutsideTask,
            );
            if (record.envelope) {
              const inspected = await target.archive.inspect(`${record.id}:result`, {
                startLine,
                endLine,
                maxBytes: recoveryMaxBytes,
                current: currentTaskContext(actions.getSnapshot()),
              }, signal, target.includeOutsideTask);
              const details = directRecoveryDetails(inspected.details, target, record.createdAt);
              const result = (inspected.content[0] as TextContent).text;
              const evidence = recoveryReturnedEvidence(result);
              archive.recordRecovery(evidence);
              if (!evidence) return { content: inspected.content, details };
              return directRecoveryResult(
                actions,
                toolCallId,
                inspected.content,
                details,
                recoveryReceipt(details),
              );
            }
            const result = await target.archive.readPartLines(
              `${record.id}:result`, startLine, endLine, recoveryMaxBytes, signal, target.includeOutsideTask,
            );
            const evidence = recoveryReturnedEvidence(result);
            archive.recordRecovery(evidence);
            const returnedLines = [...result.matchAll(/^(\d+):/gm)].map((match) => Number(match[1]));
            const actualStartLine = returnedLines[0] ?? startLine;
            const actualEndLine = returnedLines.at(-1) ?? actualStartLine;
            const details = {
              observationId: record.id,
              ref: record.id,
              partKind: "result" as const,
              startLine: actualStartLine,
              endLine: actualEndLine,
              totalLines: record.lineCount,
              hasMore: actualEndLine < record.lineCount,
              scope: target.scope,
              ...(target.scope === "task" ? {} : {
                sessionId: target.sessionId ?? target.archive.sessionId,
                sessionDate: target.sessionDate ?? record.createdAt,
              }),
              currentWorkspace: false,
              currentRequirements: false,
            };
            return evidence
              ? directRecoveryResult(
                  actions, toolCallId, [{ type: "text", text: result }], details,
                  recoveryReceipt(details),
                )
              : { content: [{ type: "text" as const, text: result }], details };
          }
          case "search": {
            if (!params.query) return textResult("prime_context search requires a non-empty fixed string query.");
            const scope = params.scope ?? "task";
            if (params.id) {
              const target = await resolveDirectRecoveryTarget(archive, actions, scope, params.id, signal);
              const record = await target.archive.findObservation(
                normalizeObservationRef(target.ref), signal, target.includeOutsideTask,
              );
              if (record.envelope) {
                const inspected = await target.archive.inspect(`${record.id}:result`, {
                  query: params.query,
                  contextLines: params.contextLines ?? 1,
                  matchOffset: params.matchOffset ?? 0,
                  maxMatches,
                  maxBytes: recoveryMaxBytes,
                  current: currentTaskContext(actions.getSnapshot()),
                }, signal, target.includeOutsideTask);
                const details = directRecoveryDetails(inspected.details, target, record.createdAt);
                const result = (inspected.content[0] as TextContent).text;
                const evidence = recoveryReturnedEvidence(result);
                archive.recordRecovery(evidence);
                if (!evidence) return { content: inspected.content, details };
                return directRecoveryResult(
                  actions,
                  toolCallId,
                  inspected.content,
                  details,
                  recoveryReceipt(details),
                );
              }
              const result = await target.archive.searchPart(
                `${record.id}:result`,
                params.query,
                params.contextLines ?? 1,
                params.matchOffset ?? 0,
                maxMatches,
                recoveryMaxBytes,
                signal,
                target.includeOutsideTask,
              );
              const evidence = recoveryReturnedEvidence(result);
              archive.recordRecovery(evidence);
              const details = {
                observationId: record.id,
                ref: `${record.id}:result`,
                partKind: "result" as const,
                query: params.query,
                matchOffset: params.matchOffset ?? 0,
                scope: target.scope,
                ...(target.scope === "task" ? {} : {
                  sessionId: target.sessionId ?? target.archive.sessionId,
                  sessionDate: target.sessionDate ?? record.createdAt,
                }),
                currentWorkspace: false,
                currentRequirements: false,
              };
              return evidence
                ? directRecoveryResult(
                    actions, toolCallId, [{ type: "text", text: result }], details,
                    recoveryReceipt(details),
                  )
                : { content: [{ type: "text" as const, text: result }], details };
            }
            const result = await archive.searchRecent(
              params.query,
              params.limit ?? 20,
              params.contextLines ?? 1,
              params.matchOffset ?? 0,
              maxMatches,
              recoveryMaxBytes,
              signal,
            );
            const evidence = recoveryReturnedEvidence(result);
            archive.recordRecovery(evidence);
            const details = {
              query: params.query,
              matchOffset: params.matchOffset ?? 0,
              scope: "task" as const,
            };
            return evidence
              ? directRecoveryResult(
                  actions, toolCallId, [{ type: "text", text: result }], details,
                  `Recovered search results for "${params.query}" for the preceding model turn. Search again for exact text.`,
                )
              : { content: [{ type: "text" as const, text: result }], details };
          }
          case "inspect": {
            const ref = params.ref ?? params.id;
            if (!ref) return textResult("prime_context inspect requires an exact observation part ref.");
            const scope = params.scope ?? "task";
            const target = await resolveDirectRecoveryTarget(archive, actions, scope, ref, signal);
            const record = await target.archive.findObservation(
              normalizeObservationRef(target.ref), signal, target.includeOutsideTask,
            );
            const inspected = await target.archive.inspect(target.ref, {
              ...(params.startLine === undefined ? {} : { startLine: params.startLine }),
              ...(params.endLine === undefined ? {} : { endLine: params.endLine }),
              ...(params.startByte === undefined ? {} : { startByte: params.startByte }),
              ...(params.endByte === undefined ? {} : { endByte: params.endByte }),
              ...(params.query === undefined ? {} : { query: params.query }),
              contextLines: params.contextLines ?? 1,
              maxBytes: recoveryMaxBytes,
              current: currentTaskContext(actions.getSnapshot()),
            }, signal, target.includeOutsideTask);
            const details = directRecoveryDetails(inspected.details, target, record.createdAt);
            const evidence = inspected.content.some((block) =>
              block.type === "image" || recoveryReturnedEvidence(block.text)
            );
            archive.recordRecovery(evidence);
            if (!evidence) {
              return { content: inspected.content, details };
            }
            const receipt = recoveryReceipt(details);
            return {
              content: [...inspected.content, { type: "text" as const, text: receipt }],
              details,
            };
          }
          case "recall": {
            const scope = params.scope ?? "task";
            const externalSources = scope === "parent" || scope === "project"
              ? await actions.resolveRecallSources(scope, signal)
              : [];
            const recalled = await archive.recall({
              ...(params.query === undefined ? {} : { query: params.query }),
              ...(params.id === undefined ? {} : { id: params.id }),
              ...(params.path === undefined ? {} : { path: params.path }),
              ...(params.kind === undefined ? {} : { kind: params.kind }),
              ...(params.tool === undefined ? {} : { tool: params.tool }),
              ...(params.status === undefined ? {} : { status: params.status }),
              scope,
              contextLines: params.contextLines ?? 1,
            }, recoveryMaxBytes, currentTaskContext(actions.getSnapshot()), signal, externalSources);
            const evidence = recalled.matches.length > 0;
            archive.recordRecovery(evidence);
            if (!evidence) return { content: recalled.content, details: { matches: [] } };
            const refs = recalled.matches.map((match) =>
              match.sessionId ? `${match.sessionId}:${match.ref}` : match.ref
            ).join(", ");
            const receipt = `[prime-context: sources=${refs}]`;
            return {
              content: [...recalled.content, { type: "text" as const, text: receipt }],
              details: { matches: recalled.matches },
            };
          }
          case "list":
            return textResult(
              await formatObservationList(
                actions,
                Math.min(params.limit ?? MODEL_LIST_MAX_OBSERVATIONS, MODEL_LIST_MAX_OBSERVATIONS),
                signal,
              ),
            );
          case "status":
            return textResult(await formatStatus(actions, signal));
          case "update":
            return textResult(formatSnapshotUpdate(actions.updateSnapshot(params)));
        }
      } catch (error) {
        return textResult(`Prime Context error: ${(error as Error).message}`);
      }
    },
  });
}
