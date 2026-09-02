import { structuredPatch } from "diff";
import { analyzeOutcome, escapeXml, truncateUtf8, utf8Bytes, type OutcomeSummary } from "./capsule.js";

const FULL_ANALYZER_BYTES = 1024 * 1024;

// Only the resident repeat baseline is compacted. The archive receives and
// persists the full current outcome returned by observe().
function boundedOutcome(outcome: OutcomeSummary): OutcomeSummary {
  return {
    ...outcome,
    testSummary: outcome.testSummary === null ? null : truncateUtf8(outcome.testSummary, 512),
    failingTests: outcome.failingTests.slice(0, 32).map((item) => truncateUtf8(item, 512)),
    exceptions: outcome.exceptions.slice(0, 12).map((item) => truncateUtf8(item, 512)),
    sourceLocations: outcome.sourceLocations.slice(0, 12).map((item) => truncateUtf8(item, 512)),
    exitStatuses: outcome.exitStatuses.slice(0, 8).map((item) => truncateUtf8(item, 512)),
    commandFailures: outcome.commandFailures.slice(0, 8).map((item) => truncateUtf8(item, 512)),
    signature: outcome.signature === null || utf8Bytes(outcome.signature) > 2048
      ? null
      : outcome.signature,
  };
}

export type BrokerDecisionKind = "pass" | "structured" | "delta";
export type DeltaReason = "exact" | "content";

export interface BrokerDecision {
  kind: BrokerDecisionKind;
  reason?: DeltaReason;
  outcome: OutcomeSummary;
  previousOutcome?: OutcomeSummary;
  changedLines?: string[];
}

export interface ResourceSketch {
  subjectKey: string;
  textBytes: number;
  lineCount: number;
  outcomeSignature?: string;
  representativeLines: string[];
  smallText?: string;
}

export interface BrokerObservation {
  subjectKey?: string;
  textBytes: number;
  lineCount: number;
  representativeLines: string[];
  outcome?: OutcomeSummary;
  exactRepeat?: boolean;
}

interface RecentAnalyzerText {
  subjectKey: string;
  text?: string;
}

export interface UtilityCounters {
  archived: number;
  recovered: number;
  usefulRecoveries: number;
  repeatedReadWithoutMutation: number;
  sourceBytes: number;
  projectedBytes: number;
}

export interface AggregateMetrics {
  sourceBytesArchived: number;
  callArgumentBytesProjectedOut: number;
  resultBytesProjectedOut: number;
  typedMediaBytesProjectedOut: number;
  recoveryBytesExposed: number;
  streamingBytesProcessed: number;
  inspectRecallHits: number;
  branchRuntimeReloadCount: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  uncachedInputTokens: number;
}

export interface BrokerPersistentState {
  utility: Array<{ key: string; counters: UtilityCounters }>;
  metrics: AggregateMetrics;
}

export interface BrokerStats {
  observedResults: number;
  passedThrough: number;
  structuredCapsules: number;
  deltaCapsules: number;
  turnsAfterCleanSuccess: number;
  utilityBucketCount: number;
  metrics: AggregateMetrics;
}

export interface BrokerContextState {
  latestOutcome: OutcomeSummary | null;
  knownFailingTests: string[];
  cleanSuccessSeen: boolean;
}

export interface DeltaMetadata {
  id: string;
  toolName: string;
  textBytes: number;
  lineCount: number;
  source: string;
}


function emptyUtilityCounters(): UtilityCounters {
  return {
    archived: 0,
    recovered: 0,
    usefulRecoveries: 0,
    repeatedReadWithoutMutation: 0,
    sourceBytes: 0,
    projectedBytes: 0,
  };
}

function emptyAggregateMetrics(): AggregateMetrics {
  return {
    sourceBytesArchived: 0,
    callArgumentBytesProjectedOut: 0,
    resultBytesProjectedOut: 0,
    typedMediaBytesProjectedOut: 0,
    recoveryBytesExposed: 0,
    streamingBytesProcessed: 0,
    inspectRecallHits: 0,
    branchRuntimeReloadCount: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    uncachedInputTokens: 0,
  };
}

function emptyStats(): Omit<BrokerStats, "utilityBucketCount" | "metrics"> {
  return {
    observedResults: 0,
    passedThrough: 0,
    structuredCapsules: 0,
    deltaCapsules: 0,
    turnsAfterCleanSuccess: 0,
  };
}

function boundedAdd(current: number, value: number): number {
  if (!Number.isFinite(value) || value <= 0) return current;
  return Math.min(Number.MAX_SAFE_INTEGER, current + Math.floor(value));
}

function boundedLineDiff(previous: string, current: string): string[] | null {
  const patch = structuredPatch("previous", "current", previous, current, "", "", { context: 2 });
  if (patch.hunks.length === 0 || patch.hunks.length > 4) return null;
  const lines = patch.hunks.flatMap((hunk) => [
    `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
    ...hunk.lines,
  ]);
  if (!lines.some((line) => line.startsWith("+") || line.startsWith("-"))) return null;
  const bytes = utf8Bytes(lines.join("\n"));
  if (bytes > 2 * 1024 || bytes > utf8Bytes(current) * 0.30) return null;
  return lines;
}

function repeatedSectionsDelta(current: string, recent: readonly string[]): string[] | null {
  let reduced = current;
  let removed = 0;
  const candidates = [...new Set(recent)]
    .filter((value) => utf8Bytes(value) >= 512 && value !== current && current.includes(value))
    .sort((left, right) => utf8Bytes(right) - utf8Bytes(left));
  for (const candidate of candidates) {
    if (!reduced.includes(candidate)) continue;
    const bytes = utf8Bytes(candidate);
    reduced = reduced.replace(candidate, `\n[Unchanged prior section: ${bytes} bytes]\n`);
    removed += bytes;
  }
  if (removed === 0 || utf8Bytes(reduced) > utf8Bytes(current) * 0.30) return null;
  const lines = reduced.split("\n");
  return [
    `Composite delta: ${removed} bytes match prior observations.`,
    ...lines.slice(0, 60),
    ...(lines.length > 60 ? [`... ${lines.length - 60} additional novel lines archived.`] : []),
  ];
}

function outcomeLines(outcome: OutcomeSummary): string[] {
  return [
    ...(outcome.status === "success" ? ["Command or validation succeeded."] : []),
    ...(outcome.testSummary ? [`Tests: ${outcome.testSummary}`] : []),
    ...outcome.failingTests.map((id) => `Failing test: ${id}`),
    ...outcome.exceptions.map((value) => `Exception: ${value}`),
    ...outcome.sourceLocations.map((value) => `Source: ${value}`),
    ...outcome.exitStatuses.map((value) => `Command: ${value}`),
    ...outcome.commandFailures.map((value) => `Failure: ${value}`),
  ];
}

export class ObservationBroker {
  private recentSketches: ResourceSketch[] = [];
  private recentAnalyzerTexts: RecentAnalyzerText[] = [];
  private outcomesBySubject = new Map<string, OutcomeSummary>();
  private documentsBySubject = new Map<string, string>();
  private latestOutcome: OutcomeSummary | null = null;
  private cleanSuccessSeen = false;
  private stats = emptyStats();
  private utilityBuckets = new Map<string, UtilityCounters>([["*", emptyUtilityCounters()]]);
  private metrics = emptyAggregateMetrics();
  private lastReadOnlyIntent?: {
    subjectKey: string;
    requirementsRevision: number;
    workspaceRevision: number;
  };

  observe(
    toolName: string,
    text: string,
    isError: boolean,
    observation?: BrokerObservation,
  ): BrokerDecision {
    this.stats.observedResults = boundedAdd(this.stats.observedResults, 1);
    const stateKey = truncateUtf8(observation?.subjectKey ?? `tool:${toolName}`, 1024);
    const textBytes = observation?.textBytes ?? utf8Bytes(text);
    const lineCount = observation?.lineCount ?? (text.length === 0 ? 0 : text.split("\n").length);
    const outcome = observation?.outcome ?? analyzeOutcome(text, isError);
    const retainedOutcome = boundedOutcome(outcome);
    const previousOutcome = this.outcomesBySubject.get(stateKey);
    const exactRepeat = observation?.exactRepeat ?? (
      textBytes >= 256 && textBytes <= FULL_ANALYZER_BYTES &&
      this.recentAnalyzerTexts.some((value) => value.subjectKey === stateKey && value.text === text)
    );
    const sameSubjectTexts = this.recentAnalyzerTexts
      .filter((value): value is RecentAnalyzerText & { text: string } =>
        value.subjectKey === stateKey && value.text !== undefined)
      .map((value) => value.text);
    let changedLines = outcome.status === "unknown" && textBytes <= FULL_ANALYZER_BYTES
      ? repeatedSectionsDelta(text, sameSubjectTexts) ?? undefined
      : undefined;
    let documentRepeat = false;
    if (outcome.status === "unknown" && textBytes >= 512 && textBytes <= 24576) {
      const previous = this.documentsBySubject.get(stateKey);
      documentRepeat = previous === text;
      if (previous && previous !== text && !changedLines) {
        changedLines = boundedLineDiff(previous, text) ?? undefined;
      }
      this.documentsBySubject.delete(stateKey);
      this.documentsBySubject.set(stateKey, text);
      while (this.documentsBySubject.size > 32) {
        this.documentsBySubject.delete(this.documentsBySubject.keys().next().value!);
      }
    }

    this.recentAnalyzerTexts.push({
      subjectKey: stateKey,
      ...(textBytes <= FULL_ANALYZER_BYTES ? { text } : {}),
    });
    if (this.recentAnalyzerTexts.length > 16) this.recentAnalyzerTexts.shift();
    this.recentSketches.push({
      subjectKey: stateKey,
      textBytes,
      lineCount,
      ...(outcome.signature === null || utf8Bytes(outcome.signature) > 2048
        ? {}
        : { outcomeSignature: outcome.signature }),
      representativeLines: observation?.representativeLines.slice(0, 64) ?? text.split("\n").slice(0, 64),
      ...(textBytes <= 64 * 1024 ? { smallText: text } : {}),
    });
    if (this.recentSketches.length > 16) this.recentSketches.shift();
    if (outcome.signature !== null) {
      this.outcomesBySubject.delete(stateKey);
      this.outcomesBySubject.set(stateKey, retainedOutcome);
      while (this.outcomesBySubject.size > 32) {
        this.outcomesBySubject.delete(this.outcomesBySubject.keys().next().value!);
      }
    }
    if (outcome.status !== "unknown") this.latestOutcome = retainedOutcome;
    if (outcome.status === "success") this.cleanSuccessSeen = true;

    if (exactRepeat || documentRepeat) return { kind: "delta", reason: "exact", outcome, previousOutcome };
    if (changedLines) return { kind: "delta", reason: "content", outcome, changedLines };
    return { kind: "structured", outcome };
  }

  renderDelta(decision: BrokerDecision, metadata: DeltaMetadata, maxBytes: number): string {
    const prefix = `<prime_context_delta id="${escapeXml(metadata.id)}" tool="${escapeXml(metadata.toolName)}" ` +
      `bytes="${metadata.textBytes}" lines="${metadata.lineCount}" source="${escapeXml(metadata.source)}">\n`;
    const suffix = "\n</prime_context_delta>";
    const headline = decision.reason === "exact"
      ? "Unchanged since previous observation."
      : "Content changed since previous observation.";
    const candidates = [
      headline,
      ...(decision.reason === "content"
        ? decision.changedLines ?? []
        : outcomeLines(decision.outcome)),
    ];
    const budget = Math.max(0, maxBytes - utf8Bytes(prefix) - utf8Bytes(suffix));
    const packed: string[] = [];
    let used = 0;
    for (const candidate of candidates) {
      const line = escapeXml(candidate);
      const bytes = utf8Bytes(line) + (packed.length > 0 ? 1 : 0);
      if (used + bytes > budget) continue;
      packed.push(line);
      used += bytes;
    }
    return prefix + packed.join("\n") + suffix;
  }

  private utilityBucket(subjectKey?: string): UtilityCounters {
    const requested = truncateUtf8(`subject:${subjectKey ?? "unknown"}`, 256);
    const existing = this.utilityBuckets.get(requested);
    if (existing) return existing;
    if (this.utilityBuckets.size >= 64) return this.utilityBuckets.get("*")!;
    const created = emptyUtilityCounters();
    this.utilityBuckets.set(requested, created);
    return created;
  }

  recordPassThrough(): void {
    this.stats.passedThrough = boundedAdd(this.stats.passedThrough, 1);
  }

  recordCapsule(delta: boolean): void {
    if (delta) this.stats.deltaCapsules = boundedAdd(this.stats.deltaCapsules, 1);
    else this.stats.structuredCapsules = boundedAdd(this.stats.structuredCapsules, 1);
  }

  recordArchive(options: {
    subjectKey: string;
    sourceBytes: number;
    projectedBytes: number;
    streamingBytes?: number;
  }): void {
    const bucket = this.utilityBucket(options.subjectKey);
    bucket.archived = boundedAdd(bucket.archived, 1);
    bucket.sourceBytes = boundedAdd(bucket.sourceBytes, options.sourceBytes);
    bucket.projectedBytes = boundedAdd(bucket.projectedBytes, options.projectedBytes);
    this.recordArchivedBytes(options.sourceBytes, options.streamingBytes ?? 0);
  }

  recordArchivedBytes(sourceBytes: number, streamingBytes = 0): void {
    this.metrics.sourceBytesArchived = boundedAdd(this.metrics.sourceBytesArchived, sourceBytes);
    this.metrics.streamingBytesProcessed = boundedAdd(this.metrics.streamingBytesProcessed, streamingBytes);
  }

  utilityCapsuleMaxBytes(
    subjectKey: string,
    status: OutcomeSummary["status"],
    baseline: number,
    pressureCeiling: number,
  ): number {
    const bucket = this.utilityBucket(subjectKey);
    if (status === "failure" && bucket.usefulRecoveries >= 2) {
      return Math.min(pressureCeiling, baseline + 512);
    }
    if (status === "unknown" && bucket.archived >= 4 && bucket.recovered === 0) {
      return Math.max(512, baseline - 512);
    }
    return Math.min(baseline, pressureCeiling);
  }

  noteReadOnlyIntent(options: {
    subjectKey: string;
    intentKind: string;
    mutatesWorkspace: boolean;
    requirementsRevision: number;
    workspaceRevision: number;
  }): number {
    if (options.mutatesWorkspace || !["read", "search", "status"].includes(options.intentKind)) {
      if (options.mutatesWorkspace) this.lastReadOnlyIntent = undefined;
      return 512;
    }
    const boundedSubjectKey = truncateUtf8(options.subjectKey, 1024);
    const repeated = this.lastReadOnlyIntent?.subjectKey === boundedSubjectKey &&
      this.lastReadOnlyIntent.requirementsRevision === options.requirementsRevision &&
      this.lastReadOnlyIntent.workspaceRevision === options.workspaceRevision;
    const bucket = this.utilityBucket(options.subjectKey);
    if (repeated) {
      bucket.repeatedReadWithoutMutation = boundedAdd(bucket.repeatedReadWithoutMutation, 1);
    }
    this.lastReadOnlyIntent = {
      subjectKey: boundedSubjectKey,
      requirementsRevision: options.requirementsRevision,
      workspaceRevision: options.workspaceRevision,
    };
    return bucket.repeatedReadWithoutMutation >= 2 ? 768 : 512;
  }

  recordRecovery(options: {
    recovered?: boolean;
    useful: boolean;
    subjectKeys?: readonly string[];
    exposedBytes?: number;
    inspectRecallHit?: boolean;
  }): void {
    const recovered = options.recovered ?? options.useful;
    const subjects = [...new Set(options.subjectKeys?.length ? options.subjectKeys : [undefined])];
    for (const subject of subjects) {
      const bucket = this.utilityBucket(subject);
      if (recovered) bucket.recovered = boundedAdd(bucket.recovered, 1);
      if (options.useful) bucket.usefulRecoveries = boundedAdd(bucket.usefulRecoveries, 1);
    }
    if (recovered) {
      this.metrics.recoveryBytesExposed = boundedAdd(this.metrics.recoveryBytesExposed, options.exposedBytes ?? 0);
      if (options.inspectRecallHit) {
        this.metrics.inspectRecallHits = boundedAdd(this.metrics.inspectRecallHits, 1);
      }
    }
  }

  recordProjection(options: {
    callArgumentBytesProjectedOut?: number;
    resultBytesProjectedOut?: number;
    typedMediaBytesProjectedOut?: number;
  }): void {
    this.metrics.callArgumentBytesProjectedOut = boundedAdd(
      this.metrics.callArgumentBytesProjectedOut,
      options.callArgumentBytesProjectedOut ?? 0,
    );
    this.metrics.resultBytesProjectedOut = boundedAdd(
      this.metrics.resultBytesProjectedOut,
      options.resultBytesProjectedOut ?? 0,
    );
    this.metrics.typedMediaBytesProjectedOut = boundedAdd(
      this.metrics.typedMediaBytesProjectedOut,
      options.typedMediaBytesProjectedOut ?? 0,
    );
  }

  recordBranchRuntimeReload(): void {
    this.metrics.branchRuntimeReloadCount = boundedAdd(this.metrics.branchRuntimeReloadCount, 1);
  }

  recordUsage(usage: { input?: number; cacheRead?: number; cacheWrite?: number }): void {
    this.metrics.uncachedInputTokens = boundedAdd(this.metrics.uncachedInputTokens, usage.input ?? 0);
    this.metrics.cacheReadTokens = boundedAdd(this.metrics.cacheReadTokens, usage.cacheRead ?? 0);
    this.metrics.cacheWriteTokens = boundedAdd(this.metrics.cacheWriteTokens, usage.cacheWrite ?? 0);
  }

  persistentState(): BrokerPersistentState {
    return {
      utility: [...this.utilityBuckets].map(([key, counters]) => ({ key, counters: { ...counters } })),
      metrics: { ...this.metrics },
    };
  }

  restorePersistentState(state?: Partial<BrokerPersistentState>): void {
    const utility = new Map<string, UtilityCounters>([["*", emptyUtilityCounters()]]);
    for (const entry of state?.utility ?? []) {
      if (!entry || typeof entry.key !== "string" || utility.size >= 64) continue;
      const key = truncateUtf8(entry.key, 256);
      const counters = emptyUtilityCounters();
      for (const field of Object.keys(counters) as Array<keyof UtilityCounters>) {
        const value = entry.counters?.[field];
        if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
          counters[field] = Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value));
        }
      }
      utility.set(key, counters);
    }
    if (!utility.has("*")) utility.set("*", emptyUtilityCounters());
    this.utilityBuckets = utility;
    const metrics = emptyAggregateMetrics();
    for (const field of Object.keys(metrics) as Array<keyof AggregateMetrics>) {
      const value = state?.metrics?.[field];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        metrics[field] = Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value));
      }
    }
    this.metrics = metrics;
  }

  noteContextTurn(goalActive: boolean): void {
    if (goalActive && this.cleanSuccessSeen) {
      this.stats.turnsAfterCleanSuccess = boundedAdd(this.stats.turnsAfterCleanSuccess, 1);
    }
  }

  contextState(): BrokerContextState {
    return {
      latestOutcome: this.latestOutcome,
      knownFailingTests: this.latestOutcome?.status === "failure" ? [...this.latestOutcome.failingTests] : [],
      cleanSuccessSeen: this.cleanSuccessSeen,
    };
  }

  statistics(): BrokerStats {
    return {
      ...this.stats,
      utilityBucketCount: this.utilityBuckets.size,
      metrics: { ...this.metrics },
    };
  }

  resetBranchState(): void {
    this.recentSketches = [];
    this.recentAnalyzerTexts = [];
    this.outcomesBySubject.clear();
    this.documentsBySubject.clear();
    this.latestOutcome = null;
    this.cleanSuccessSeen = false;
    this.lastReadOnlyIntent = undefined;
  }

  reset(): void {
    this.resetBranchState();
    this.stats = emptyStats();
    this.utilityBuckets = new Map([["*", emptyUtilityCounters()]]);
    this.metrics = emptyAggregateMetrics();
  }

}
