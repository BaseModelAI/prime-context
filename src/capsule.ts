const DECISIVE_FAILURE_SIGNAL = /\b(?:[a-z_]*error|exceptions?|traceback)\b|\bassertion(?:error|failed|failure)?\b|^\s*assert\b|\bfail(?:ed|ure)?\b/i;
const SUCCESS_SIGNAL = /\b(?:pass(?:ed)?|success(?:ful)?)\b/i;
const WARNING_SIGNAL = /warning/i;
const TERMINAL_OUTCOME_SIGNAL = /^\s*(?:test_result\s+(?:pass|fail)(?:\s+\d+\/\d+)?|ok|failed\s*\([^)]*\)|build\s+(?:success|failed))\s*$/i;
const TERMINAL_SUCCESS_SIGNAL = /^\s*(?:test_result\s+pass(?:\s+\d+\/\d+)?|ok|build\s+success)\s*$/i;
const TERMINAL_FAILURE_SIGNAL = /^\s*(?:test_result\s+fail(?:\s+\d+\/\d+)?|failed\s*\([^)]*\)|build\s+failed)\s*$/i;
const COMMAND_STATUS_SIGNAL = /^\s*(?:exit|rc|status)\s*[:=]?\s*-?\d+\s*$/i;
const LOW_SIGNAL_TRACE_LINE = /^\s*(?:trace|debug|progress)\b/i;
const MARKDOWN_BULLET_LINE = /^\s*[-*]\s+/;
const LABELED_VALUE_SIGNAL = /(?:^|[,{|]\s*)["']?[A-Za-z][A-Za-z0-9_. /-]{0,48}["']?\s*[:=]\s*(?:["'][^"'\n]{1,160}["']|(?:[-+]?\d+(?:[.,]\d+)?(?:\s*(?:%|ms|s|sec(?:onds?)?|min(?:utes?)?|h(?:ours?)?|B|KiB|MiB|GiB|KB|MB|GB|Hz|kHz|MHz|GHz|px|items?|rows?|cols?))?|true|false|null|none)\b)/i;
const VALUE_WITH_UNIT_SIGNAL = /(?:^|\s)[-+]?\d+(?:[.,]\d+)?\s*(?:%|ms|sec(?:onds?)?|min(?:utes?)?|h(?:ours?)?|KiB|MiB|GiB|KB|MB|GB|Hz|kHz|MHz|GHz|px)\b/i;
const TABLE_VALUE_SIGNAL = /^\s*\|.*\|\s*$|\S+\t+\S+/;
const PATH_OR_LOCATION_SIGNAL = /(?:^|[\s"'`(])(?:\.{0,2}\/|~\/|\/)[^\s"'`),]+|\b[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+(?::\d+(?::\d+)?)?|\b[A-Za-z0-9_.-]+\.(?:csv|json|ya?ml|toml|txt|md|log|xml|html?|pdf|png|jpe?g|gif|webp|py|ts|tsx|js|mjs|cjs|java|rs|go)(?::\d+(?::\d+)?)?\b/i;
const IDENTIFIER_SIGNAL = /\b(?:id|identifier|request|job|task|session|run|artifact|image|page|cell|row|column)\s*(?:id)?\s*[:=]\s*[A-Za-z0-9][A-Za-z0-9_.:/-]{1,127}\b/i;
const STATE_TRANSITION_SIGNAL = /(?:\b[A-Za-z][A-Za-z0-9_.-]*\s*(?:->|→)\s*[A-Za-z][A-Za-z0-9_.-]*\b)|\b(?:created?|wrote|written|saved?|generated|removed?|deleted|enabled|disabled|started|stopped|connected|disconnected|changed|updated|moved|renamed)\b/i;
const RELATIONSHIP_SIGNAL = /\b(?:because|therefore|depends? on|caused? by|results? in|maps? to|correlat(?:es?|ed) with|compared? (?:with|to)|greater than|less than|before|after|while|whereas|but|however)\b|(?:->|→)/i;
const CAPSULE_SIGNAL_COUNT_LIMIT = 64;

export interface CapsuleContextUsage {
  tokens: number | null;
  contextWindow: number;
}

function normalizedLineShape(line: string): string {
  return line
    .trim()
    .toLowerCase()
    .replaceAll(/\b(?:0x[0-9a-f]+|\d+(?:\.\d+)?|[0-9a-f]{8,}(?:-[0-9a-f-]{4,})*)\b/gi, "#");
}

function countedTestSummaryLine(line: string): string | null {
  const cleaned = line.trim().replace(/^=+\s*/, "").replace(/\s*=+$/, "");
  return /^(?:tests?\s*:?\s*)?\d+\s+(?:passed|failed)(?:\s*,\s*\d+\s+(?:passed|failed|skipped|xfailed|xpassed|deselected|warnings?))*(?:\s+in\s+\d+(?:\.\d+)?s)?$/i.test(cleaned)
    ? cleaned
    : null;
}

function explicitTestSummaryLine(line: string): string | null {
  const cleaned = line.trim();
  return /^TEST_RESULT\s+(?:PASS|FAIL)\s+\d+\/\d+$/i.test(cleaned) ? cleaned : null;
}

export function hasTerminalOutcome(text: string): boolean {
  return splitVisibleLines(text).some((line) => TERMINAL_OUTCOME_SIGNAL.test(line) || countedTestSummaryLine(line) !== null);
}

export function hasTerminalSuccess(text: string): boolean {
  return splitVisibleLines(text).some((line) =>
    TERMINAL_SUCCESS_SIGNAL.test(line) || /\b\d+\s+passed\b/i.test(countedTestSummaryLine(line) ?? "")
  );
}

export function terminalSuccessSignature(text: string): string | null {
  if (hasTerminalFailure(text)) return null;
  const lines = splitVisibleLines(text);
  const explicit = lines.map(explicitTestSummaryLine).find((line) => line !== null);
  if (explicit) return explicit.toUpperCase().replaceAll(/\s+/g, " ");
  const counted = lines.map(countedTestSummaryLine).find((line) => line !== null);
  return counted ? counted.toUpperCase().replaceAll(/\s+/g, " ") : null;
}

export function hasTerminalFailure(text: string): boolean {
  return splitVisibleLines(text).some((line) =>
    TERMINAL_FAILURE_SIGNAL.test(line) || /\b\d+\s+failed\b/i.test(countedTestSummaryLine(line) ?? "")
  );
}

export interface OutcomeSummary {
  status: "success" | "failure" | "unknown";
  testSummary: string | null;
  testTotal: number | null;
  failingTests: string[];
  exceptions: string[];
  sourceLocations: string[];
  exitStatuses: string[];
  commandFailures: string[];
  signature: string | null;
}

function uniqueStrings(values: readonly string[], limit = 32): string[] {
  return [...new Set(values.filter(Boolean))].slice(0, limit);
}

export function analyzeOutcome(text: string, isError = false): OutcomeSummary {
  const lines = splitVisibleLines(text);
  const explicitLine = [...lines].reverse().map(explicitTestSummaryLine).find((line) => line !== null) ?? null;
  const explicit = explicitLine?.match(/^TEST_RESULT\s+(?:PASS|FAIL)\s+(\d+)\/(\d+)$/i) ?? null;
  const countedLine = [...lines].reverse().map(countedTestSummaryLine).find((line) => line !== null) ?? null;
  const countedTotal = countedLine
    ? [...countedLine.matchAll(/\b(\d+)\s+(?:passed|failed)\b/gi)]
      .reduce((sum, match) => sum + Number(match[1]), 0)
    : 0;
  const ran = [...lines].reverse()
    .map((line) => /^\s*Ran\s+(\d+)\s+tests?(?:\s+in\s+\d+(?:\.\d+)?s)?\s*$/i.exec(line))
    .find((match) => match !== null) ?? null;
  const testTotal = explicit ? Number(explicit[2]) : countedTotal > 0 ? countedTotal : ran ? Number(ran[1]) : null;
  const testSummary = (explicitLine ?? countedLine)?.toUpperCase().replaceAll(/\s+/g, " ") ?? null;
  const failingTests = uniqueStrings(lines.flatMap((line) => {
    const match = /^\s*FAIL\s+(\S+)/i.exec(line);
    return match ? [match[1]] : [];
  }), Number.POSITIVE_INFINITY);
  const exceptions = uniqueStrings(lines.flatMap((line) => {
    const trimmed = line.trim();
    const detailed = /\b([A-Z][A-Za-z0-9_]*(?:Error|Exception)):\s*([^\n]+)\s*$/.exec(trimmed);
    if (detailed) return [`${detailed[1]}: ${detailed[2].trim()}`];
    const bare = /^([A-Z][A-Za-z0-9_]*(?:Error|Exception))$/.exec(trimmed);
    return bare ? [bare[1]] : [];
  }), 12);
  const sourceLocations = uniqueStrings(lines.flatMap((line) => {
    const python = /File "([^"]+)", line (\d+)/.exec(line);
    if (python) return [`${python[1]}:${python[2]}`];
    const generic = /([A-Za-z0-9_./-]+\.(?:py|ts|tsx|js|mjs|cjs|java|rs|go)):(\d+)/.exec(line);
    return generic ? [`${generic[1]}:${generic[2]}`] : [];
  }), 12);
  const exitStatuses = uniqueStrings(lines.flatMap((line) => {
    if (COMMAND_STATUS_SIGNAL.test(line)) return [line.trim()];
    const match = /(?:returned non-zero exit status|exit(?: code| status)?[:= ]+)\s*(-?\d+)/i.exec(line);
    return match ? [`exit ${match[1]}`] : [];
  }), 8);
  const commandFailures = uniqueStrings(lines
    .map((line) => line.trim())
    .filter((line) => /^(?:fatal:|error:|failed:)|\bcommand\b.*\bfailed\b/i.test(line)), 8);
  const status = hasTerminalSuccess(text) && !hasTerminalFailure(text) && !isError
    ? "success"
    : hasTerminalFailure(text) || isError || failingTests.length > 0 || exceptions.length > 0 || commandFailures.length > 0
      ? "failure"
      : "unknown";
  const meaningfulExceptions = exceptions.filter((value) => !/^CalledProcessError\b/.test(value));
  const signature = status === "success"
    ? terminalSuccessSignature(text)
    : status === "failure" && failingTests.length > 0
      ? `FAIL_TESTS;${[...failingTests].sort().join(",")}`
      : status === "failure" && (meaningfulExceptions.length > 0 || commandFailures.length > 0)
        ? [
            "FAILURE",
            [...meaningfulExceptions].sort().join("|"),
            [...commandFailures].sort().join("|"),
            [...exitStatuses].sort().join(","),
          ].join(";")
        : null;
  return {
    status, testSummary, testTotal, failingTests, exceptions, sourceLocations, exitStatuses, commandFailures, signature,
  };
}

export function isLowSignalTraceOutput(text: string): boolean {
  const lines = splitVisibleLines(text).filter((line) => line.trim().length > 0);
  if (lines.length < 6) return false;
  const traceLines = lines.filter((line) => LOW_SIGNAL_TRACE_LINE.test(line)).length;
  return traceLines >= 6 && traceLines / lines.length >= 0.8;
}

export function isRepetitiveOutput(text: string): boolean {
  const lines = splitVisibleLines(text).filter((line) => line.trim().length > 0);
  if (lines.length < 40) {
    if (isLowSignalTraceOutput(text)) return true;
    if (lines.length < 6 || !lines.some((line) => TERMINAL_OUTCOME_SIGNAL.test(line))) return false;
    const traceLines = lines.filter((line) => LOW_SIGNAL_TRACE_LINE.test(line)).length;
    return traceLines >= 4 && traceLines / lines.length >= 0.5;
  }
  const sampled = lines.length > 400 ? lines.filter((_, index) => index % Math.ceil(lines.length / 400) === 0) : lines;
  const shapes = new Set(sampled.map(normalizedLineShape));
  return shapes.size / sampled.length <= 0.25;
}

export function adaptiveMinTextBytes(
  configuredMinBytes: number,
  usage?: CapsuleContextUsage,
): number {
  if (!usage || usage.contextWindow <= 0 || usage.tokens === null) return configuredMinBytes;
  const percent = usage.tokens / usage.contextWindow;
  if (percent >= 0.8) return Math.min(configuredMinBytes, 8192);
  if (percent >= 0.6) return Math.min(configuredMinBytes, 12288);
  if (percent >= 0.4) return Math.min(configuredMinBytes, 16384);
  return configuredMinBytes;
}

export function adaptiveCapsuleMaxBytes(
  text: string,
  configuredMaxBytes: number,
  usage?: CapsuleContextUsage,
): number {
  let maxBytes = configuredMaxBytes;
  if (isRepetitiveOutput(text)) {
    const terminalBytes = hasTerminalSuccess(text) && !hasTerminalFailure(text) ? 768 : 1024;
    maxBytes = Math.min(maxBytes, hasTerminalOutcome(text) ? terminalBytes : 2048);
  }
  if (usage && usage.contextWindow > 0 && usage.tokens !== null) {
    const projectedPercent = (usage.tokens + Math.ceil(configuredMaxBytes / 4)) / usage.contextWindow;
    if (projectedPercent >= 0.8) maxBytes = Math.min(maxBytes, 1536);
    else if (projectedPercent >= 0.6) maxBytes = Math.min(maxBytes, 2048);
    else if (projectedPercent >= 0.4) maxBytes = Math.min(maxBytes, 3072);
  }
  return Math.min(configuredMaxBytes, Math.max(768, maxBytes));
}

export function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

export function truncateUtf8(value: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length <= maxBytes) return value;

  let end = Math.min(maxBytes, bytes.length);
  while (end > 0 && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
    end -= 1;
  }
  return bytes.subarray(0, end).toString("utf8");
}

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function splitVisibleLines(text: string): string[] {
  return text.length === 0 ? [] : text.split("\n");
}

interface SelectedCapsuleLine {
  lineNumber: number;
  rawText: string;
  displayedText: string;
}

function isGenericFactLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length > 0 && (
    LABELED_VALUE_SIGNAL.test(line) ||
    VALUE_WITH_UNIT_SIGNAL.test(line) ||
    TABLE_VALUE_SIGNAL.test(line) ||
    PATH_OR_LOCATION_SIGNAL.test(line) ||
    IDENTIFIER_SIGNAL.test(line) ||
    STATE_TRANSITION_SIGNAL.test(line) ||
    DECISIVE_FAILURE_SIGNAL.test(line) ||
    TERMINAL_OUTCOME_SIGNAL.test(line) ||
    COMMAND_STATUS_SIGNAL.test(line)
  );
}

function selectCapsuleLineRecords(text: string, compact = isRepetitiveOutput(text)): SelectedCapsuleLine[] {
  const lines = splitVisibleLines(text).map((rawText, index) => ({
    lineNumber: index + 1,
    rawText,
    displayedText: utf8Bytes(rawText) <= 384 ? rawText : `${truncateUtf8(rawText, 381)}...`,
  }));
  const edgeSignals = (matches: SelectedCapsuleLine[], limit: number): SelectedCapsuleLine[] => {
    if (matches.length <= limit) return matches;
    const firstCount = Math.ceil(limit / 2);
    return [...matches.slice(0, firstCount), ...matches.slice(-(limit - firstCount))];
  };
  const byShape = (candidates: SelectedCapsuleLine[]): SelectedCapsuleLine[] => {
    const shapes = new Set<string>();
    return candidates.filter((line) => {
      const shape = normalizedLineShape(line.rawText);
      if (shapes.has(shape)) return false;
      shapes.add(shape);
      return true;
    });
  };
  const unique = (selected: SelectedCapsuleLine[]): SelectedCapsuleLine[] => {
    const seen = new Set<string>();
    return selected.filter((line) => {
      if (seen.has(line.rawText)) return false;
      seen.add(line.rawText);
      return true;
    });
  };

  const informativeCompactHead = () => byShape(lines.filter((line) =>
    line.rawText.trim().length > 0 &&
    !LOW_SIGNAL_TRACE_LINE.test(line.rawText) &&
    !TERMINAL_OUTCOME_SIGNAL.test(line.rawText)
  )).slice(0, 8);
  const genericFacts = edgeSignals(
    lines.filter((line) => isGenericFactLine(line.rawText) &&
      (!compact || !LOW_SIGNAL_TRACE_LINE.test(line.rawText))),
    compact ? 16 : 32,
  );

  if (compact && hasTerminalSuccess(text) && !hasTerminalFailure(text)) {
    return unique([
      ...edgeSignals(byShape(lines.filter((line) => TERMINAL_SUCCESS_SIGNAL.test(line.rawText))), 4),
      ...genericFacts,
      ...informativeCompactHead(),
    ]);
  }

  if (compact && hasTerminalFailure(text)) {
    const failingTests = lines.filter((line) => /^\s*FAIL\s+\S+/i.test(line.rawText));
    const exceptions = lines.filter(
      (line) => /\b[A-Z][A-Za-z0-9_]*(?:Error|Exception)(?::|\s*$)/.test(line.rawText),
    );
    const sourceLocations = lines.filter(
      (line) => /File "[^"]+", line \d+/.test(line.rawText)
        || /[A-Za-z0-9_./-]+\.(?:py|ts|tsx|js|mjs|cjs|java|rs|go):\d+/.test(line.rawText),
    );
    return unique([
      ...edgeSignals(byShape(lines.filter((line) => TERMINAL_FAILURE_SIGNAL.test(line.rawText))), 4),
      ...failingTests,
      ...byShape(exceptions),
      ...byShape(sourceLocations),
      ...genericFacts,
      ...edgeSignals(byShape(lines.filter((line) => COMMAND_STATUS_SIGNAL.test(line.rawText))), 4),
      ...edgeSignals(byShape(lines.filter(
        (line) => DECISIVE_FAILURE_SIGNAL.test(line.rawText)
          && !LOW_SIGNAL_TRACE_LINE.test(line.rawText)
          && !MARKDOWN_BULLET_LINE.test(line.rawText),
      )), 8),
      ...informativeCompactHead(),
    ]);
  }

  const decisiveIndexes = lines
    .map((line, index) => (DECISIVE_FAILURE_SIGNAL.test(line.rawText) ? index : -1))
    .filter((index) => index >= 0);
  const terminalOutcomes = edgeSignals(
    lines.filter((line) => TERMINAL_OUTCOME_SIGNAL.test(line.rawText)),
    compact ? 4 : 10,
  );
  const decisiveMatches = decisiveIndexes.map((index) => lines[index]);
  const decisiveFailures = edgeSignals(compact ? byShape(decisiveMatches) : decisiveMatches, compact ? 8 : 20);
  const decisiveNeighbors = edgeSignals(
    decisiveIndexes.flatMap((index) => [lines[index - 1], lines[index + 1]])
      .filter((line): line is SelectedCapsuleLine => line !== undefined),
    compact ? 4 : 10,
  );
  const successMatches = lines.filter(
    (line) => SUCCESS_SIGNAL.test(line.rawText) && !DECISIVE_FAILURE_SIGNAL.test(line.rawText),
  );
  const successes = edgeSignals(successMatches, compact ? 4 : 10);
  const warningSlots = 20 - decisiveFailures.length;
  const warningMatches = lines.filter(
    (line) => WARNING_SIGNAL.test(line.rawText) && !DECISIVE_FAILURE_SIGNAL.test(line.rawText),
  );
  const warnings = (compact ? byShape(warningMatches) : warningMatches).slice(0, warningSlots);
  const head = lines.slice(0, compact ? 8 : 20);
  const tail = lines.slice(Math.max(0, lines.length - (compact ? 8 : 40)));
  return unique([
    ...terminalOutcomes,
    ...decisiveFailures,
    ...genericFacts,
    ...decisiveNeighbors,
    ...successes,
    ...(compact ? byShape(head) : head),
    ...warnings,
    ...(compact ? byShape(tail) : tail),
  ]);
}

export function selectCapsuleLines(text: string, compact = isRepetitiveOutput(text)): string[] {
  return selectCapsuleLineRecords(text, compact).map((line) => line.displayedText);
}

export interface CapsuleQualitySignals {
  extractedFactCount: number;
  retainedFactCount: number;
  representativeExcerptCount: number;
  relationshipSignalCount: number;
  retainedRelationshipCount: number;
  excerptDominated: boolean;
  mayMissRelationships: boolean;
}

/** Bounded signals for deciding whether deterministic extraction is already sufficient. */
export function analyzeCapsuleQuality(text: string): CapsuleQualitySignals {
  const lines = splitVisibleLines(text);
  const selected = selectCapsuleLineRecords(text);
  const factLineNumbers = new Set(lines.flatMap((line, index) =>
    isGenericFactLine(line) ? [index + 1] : []
  ));
  const relationshipLineNumbers = new Set(lines.flatMap((line, index) =>
    RELATIONSHIP_SIGNAL.test(line) ? [index + 1] : []
  ));
  const retainedFactCount = selected.filter((line) => factLineNumbers.has(line.lineNumber)).length;
  const retainedRelationshipCount = selected.filter((line) =>
    relationshipLineNumbers.has(line.lineNumber)
  ).length;
  const representativeExcerptCount = selected.filter((line) =>
    line.rawText.trim().length > 0 && !factLineNumbers.has(line.lineNumber)
  ).length;
  const bounded = (value: number): number => Math.min(CAPSULE_SIGNAL_COUNT_LIMIT, value);
  return {
    extractedFactCount: bounded(factLineNumbers.size),
    retainedFactCount: bounded(retainedFactCount),
    representativeExcerptCount: bounded(representativeExcerptCount),
    relationshipSignalCount: bounded(relationshipLineNumbers.size),
    retainedRelationshipCount: bounded(retainedRelationshipCount),
    excerptDominated: representativeExcerptCount > retainedFactCount,
    mayMissRelationships: relationshipLineNumbers.size > retainedRelationshipCount,
  };
}

export interface CapsuleMetadata {
  id: string;
  toolName: string;
  textBytes: number;
  lineCount: number;
  source?: "visible-tool-result" | "public-complete-output";
  factualLines?: readonly string[];
}

function recoverySearchHint(text: string): string | null {
  const failedTest = text.match(/^\s*FAIL\s+([A-Za-z0-9_.:/-]+)/m);
  if (failedTest) return `FAIL ${failedTest[1]}`;
  const explicit = text.match(/\btest_result\s+(?:pass|fail)\b/i);
  if (explicit) return explicit[0].toUpperCase();
  if (/^\s*failed\s*\(/im.test(text)) return "FAILED";
  if (/^\s*ok\s*$/im.test(text)) return "OK";
  if (/\b\d+\s+failed\b/i.test(text)) return "failed";
  if (/\b\d+\s+passed\b/i.test(text)) return "passed";
  if (/error|exception|traceback|assert(?:ion)?/i.test(text)) return "ERROR";
  if (/\bfail(?:ed|ure)?\b/i.test(text)) return "FAIL";
  if (/\bpass(?:ed)?\b/i.test(text)) return "PASS";

  const fallback = text.match(/[A-Za-z_][A-Za-z0-9_.:/-]{3,63}/);
  return fallback?.[0] ?? null;
}

export function renderCapsule(
  text: string,
  metadata: CapsuleMetadata,
  maxBytes: number,
  repeatedTerminalSuccess = false,
): string {
  const id = escapeXml(metadata.id);
  const toolName = escapeXml(metadata.toolName);
  const source = metadata.source ?? "visible-tool-result";
  const cleanTerminalSuccess = hasTerminalSuccess(text) && !hasTerminalFailure(text);
  const lowSignalTrace = !cleanTerminalSuccess
    && analyzeOutcome(text, false).status === "unknown"
    && isLowSignalTraceOutput(text);
  if (cleanTerminalSuccess && repeatedTerminalSuccess) {
    return `<prime_context_output id="${id}" tool="${toolName}" bytes="${metadata.textBytes}" ` +
      `lines="${metadata.lineCount}" source="${source}">\n` +
      "Archived; repeated clean command success unchanged.\n</prime_context_output>";
  }
  const prefix =
    `<prime_context_output id="${id}" tool="${toolName}" bytes="${metadata.textBytes}" ` +
    `lines="${metadata.lineCount}" source="${source}">\n` +
    (cleanTerminalSuccess
      ? "Archived; clean command success summarized.\n"
      : lowSignalTrace
        ? "Archived; low-signal trace summarized; no decisive diagnostic found.\n"
        : "Archived; excerpt incomplete.\n");
  const selectedLines = selectCapsuleLineRecords(text);
  const focusLine = selectedLines[0]?.lineNumber ?? 1;
  const readStart = Math.max(1, focusLine - 20);
  const readEnd = Math.max(readStart, Math.min(metadata.lineCount, focusLine + 10));
  const readAction = `Read: prime_context action=read id=${id} startLine=${readStart} endLine=${readEnd}`;
  const searchHint = cleanTerminalSuccess ? null : recoverySearchHint(text);
  const suffix = cleanTerminalSuccess
    ? "\n</prime_context_output>"
    : lowSignalTrace
      ? "\n...\nNo diagnostic recovery hint.\n</prime_context_output>"
      : `\n...\n${readAction}` +
        (searchHint === null
          ? ""
          : `\nSearch: prime_context action=search id=${id} query="${searchHint}"`) +
        "\n</prime_context_output>";
  const fixedBytes = utf8Bytes(prefix) + utf8Bytes(suffix);

  if (fixedBytes >= maxBytes) {
    if (lowSignalTrace) {
      return `<prime_context_output id="${id}">\nArchived; low-signal trace; no diagnostic recovery hint.\n` +
        "</prime_context_output>";
    }
    const compact =
      `<prime_context_output id="${id}">\nArchived; excerpt omitted.\n` +
      `${readAction}\n` +
      "</prime_context_output>";
    return compact;
  }

  const budget = maxBytes - fixedBytes;
  const escapedLines = [
    ...(metadata.factualLines ?? []).map((line) => escapeXml(line)),
    ...selectedLines.map((line) => escapeXml(`L${line.lineNumber}: ${line.displayedText}`)),
  ];
  const packed: string[] = [];
  let usedBytes = 0;
  for (const line of escapedLines) {
    const separatorBytes = packed.length === 0 ? 0 : 1;
    const lineBytes = utf8Bytes(line);
    if (usedBytes + separatorBytes + lineBytes > budget) continue;
    packed.push(line);
    usedBytes += separatorBytes + lineBytes;
  }

  return prefix + packed.join("\n") + suffix;
}


export interface BoundedCapsuleLine {
  lineNumber: number;
  text: string;
}

export interface BoundedCapsuleSignals {
  outcomeText: string;
  traceLineCount: number;
  nonEmptyLineCount: number;
  summaryLines?: readonly string[];
}

function selectBoundedCapsuleLines(
  records: readonly BoundedCapsuleLine[],
  cleanTerminalSuccess: boolean,
  terminalFailure: boolean,
): SelectedCapsuleLine[] {
  const lines = records.map((record) => ({
    lineNumber: record.lineNumber,
    rawText: record.text,
    displayedText: utf8Bytes(record.text) <= 384 ? record.text : `${truncateUtf8(record.text, 381)}...`,
  }));
  const unique = (selected: readonly SelectedCapsuleLine[]): SelectedCapsuleLine[] => {
    const seen = new Set<number>();
    return selected.filter((line) => {
      if (seen.has(line.lineNumber)) return false;
      seen.add(line.lineNumber);
      return true;
    });
  };
  const edge = (selected: readonly SelectedCapsuleLine[], limit: number): SelectedCapsuleLine[] => {
    if (selected.length <= limit) return [...selected];
    const first = Math.ceil(limit / 2);
    return [...selected.slice(0, first), ...selected.slice(-(limit - first))];
  };
  const informativeHead = lines.filter((line) =>
    line.rawText.trim().length > 0 && !LOW_SIGNAL_TRACE_LINE.test(line.rawText) &&
    !TERMINAL_OUTCOME_SIGNAL.test(line.rawText)
  ).slice(0, 8);
  const tail = lines.slice(-8);
  const genericFacts = edge(lines.filter((line) => isGenericFactLine(line.rawText)), 16);
  if (cleanTerminalSuccess) {
    return unique([
      ...edge(lines.filter((line) => TERMINAL_SUCCESS_SIGNAL.test(line.rawText)), 4),
      ...genericFacts,
      ...informativeHead,
      ...tail,
    ]);
  }
  if (terminalFailure) {
    return unique([
      ...edge(lines.filter((line) => TERMINAL_FAILURE_SIGNAL.test(line.rawText)), 4),
      ...lines.filter((line) => /^\s*FAIL\s+\S+/i.test(line.rawText)),
      ...lines.filter((line) => /\b[A-Z][A-Za-z0-9_]*(?:Error|Exception)(?::|\s*$)/.test(line.rawText)),
      ...lines.filter((line) => /File "[^"]+", line \d+/.test(line.rawText) ||
        /[A-Za-z0-9_./-]+\.(?:py|ts|tsx|js|mjs|cjs|java|rs|go):\d+/.test(line.rawText)),
      ...genericFacts,
      ...edge(lines.filter((line) => COMMAND_STATUS_SIGNAL.test(line.rawText)), 4),
      ...edge(lines.filter((line) => DECISIVE_FAILURE_SIGNAL.test(line.rawText) &&
        !LOW_SIGNAL_TRACE_LINE.test(line.rawText) && !MARKDOWN_BULLET_LINE.test(line.rawText)), 8),
      ...informativeHead,
      ...tail,
    ]);
  }
  return unique([
    ...edge(lines.filter((line) => TERMINAL_OUTCOME_SIGNAL.test(line.rawText)), 6),
    ...edge(lines.filter((line) => DECISIVE_FAILURE_SIGNAL.test(line.rawText)), 12),
    ...genericFacts,
    ...edge(lines.filter((line) => SUCCESS_SIGNAL.test(line.rawText) &&
      !DECISIVE_FAILURE_SIGNAL.test(line.rawText)), 6),
    ...informativeHead,
    ...lines.filter((line) => WARNING_SIGNAL.test(line.rawText)).slice(0, 6),
    ...tail,
  ]);
}

/** Render a large streamed artifact from bounded records without changing its source coordinates. */
export function renderBoundedCapsule(
  records: readonly BoundedCapsuleLine[],
  signals: BoundedCapsuleSignals,
  metadata: CapsuleMetadata,
  maxBytes: number,
  repeatedTerminalSuccess = false,
): string {
  const id = escapeXml(metadata.id);
  const toolName = escapeXml(metadata.toolName);
  const source = metadata.source ?? "visible-tool-result";
  const cleanTerminalSuccess = hasTerminalSuccess(signals.outcomeText) &&
    !hasTerminalFailure(signals.outcomeText);
  const terminalFailure = hasTerminalFailure(signals.outcomeText) ||
    analyzeOutcome(signals.outcomeText, false).status === "failure";
  const lowSignalTrace = !cleanTerminalSuccess && !terminalFailure && signals.nonEmptyLineCount >= 6 &&
    signals.traceLineCount / signals.nonEmptyLineCount >= 0.8;
  if (cleanTerminalSuccess && repeatedTerminalSuccess) {
    return `<prime_context_output id="${id}" tool="${toolName}" bytes="${metadata.textBytes}" ` +
      `lines="${metadata.lineCount}" source="${source}">\n` +
      "Archived; repeated clean command success unchanged.\n</prime_context_output>";
  }
  const prefix =
    `<prime_context_output id="${id}" tool="${toolName}" bytes="${metadata.textBytes}" ` +
    `lines="${metadata.lineCount}" source="${source}">\n` +
    (cleanTerminalSuccess
      ? "Archived; clean command success summarized.\n"
      : lowSignalTrace
        ? "Archived; low-signal trace summarized; no decisive diagnostic found.\n"
        : "Archived; excerpt incomplete.\n");
  const selectedLines = selectBoundedCapsuleLines(records, cleanTerminalSuccess, terminalFailure);
  const focusLine = selectedLines[0]?.lineNumber ?? records[0]?.lineNumber ?? 1;
  const readStart = Math.max(1, focusLine - 20);
  const readEnd = Math.max(readStart, Math.min(metadata.lineCount, focusLine + 10));
  const readAction = `Read: prime_context action=read id=${id} startLine=${readStart} endLine=${readEnd}`;
  const searchHint = cleanTerminalSuccess ? null : recoverySearchHint(signals.outcomeText);
  const suffix = cleanTerminalSuccess
    ? "\n</prime_context_output>"
    : lowSignalTrace
      ? "\n...\nNo diagnostic recovery hint.\n</prime_context_output>"
      : `\n...\n${readAction}` +
        (searchHint === null ? "" : `\nSearch: prime_context action=search id=${id} query="${searchHint}"`) +
        "\n</prime_context_output>";
  const fixedBytes = utf8Bytes(prefix) + utf8Bytes(suffix);
  if (fixedBytes >= maxBytes) {
    if (lowSignalTrace) {
      return `<prime_context_output id="${id}">\nArchived; low-signal trace; no diagnostic recovery hint.\n` +
        "</prime_context_output>";
    }
    return `<prime_context_output id="${id}">\nArchived; excerpt omitted.\n${readAction}\n` +
      "</prime_context_output>";
  }
  const budget = maxBytes - fixedBytes;
  const packed: string[] = [];
  let usedBytes = 0;
  const pack = (line: string): void => {
    const escaped = escapeXml(line);
    const separatorBytes = packed.length === 0 ? 0 : 1;
    const lineBytes = utf8Bytes(escaped);
    if (usedBytes + separatorBytes + lineBytes > budget) return;
    packed.push(escaped);
    usedBytes += separatorBytes + lineBytes;
  };
  const [focusRecord, ...remainingRecords] = selectedLines;
  for (const line of metadata.factualLines ?? []) pack(line);
  if (focusRecord) pack(`L${focusRecord.lineNumber}: ${focusRecord.displayedText}`);
  for (const line of signals.summaryLines ?? []) pack(line);
  for (const record of remainingRecords) pack(`L${record.lineNumber}: ${record.displayedText}`);
  return prefix + packed.join("\n") + suffix;
}


export interface SemanticCapsuleOutput {
  decisiveFacts: readonly string[];
  relationships: readonly string[];
  unresolvedOrAmbiguous: readonly string[];
  sourceAnchors: readonly string[];
}

const SEMANTIC_CAPSULE_LIMITS = {
  decisiveFacts: 6,
  relationships: 4,
  unresolvedOrAmbiguous: 3,
  sourceAnchors: 6,
} as const;
const SEMANTIC_ITEM_MAX_BYTES = 320;

function semanticCapsuleBody(output: SemanticCapsuleOutput): string {
  const sections: Array<[string, readonly string[]]> = [
    ["Decisive facts", output.decisiveFacts],
    ["Relationships", output.relationships],
    ["Unresolved or ambiguous", output.unresolvedOrAmbiguous],
    ["Source anchors", output.sourceAnchors],
  ];
  return sections
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => `${label}:\n${items.map((item) => `- ${escapeXml(item)}`).join("\n")}`)
    .join("\n");
}

/** Return a normalized semantic capsule, or null for empty, malformed, or oversized output. */
export function validateSemanticCapsule(
  value: unknown,
  maxBytes: number,
): SemanticCapsuleOutput | null {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0 || value === null || typeof value !== "object" ||
    Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expectedKeys = Object.keys(SEMANTIC_CAPSULE_LIMITS).sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) return null;

  const normalized: Record<keyof SemanticCapsuleOutput, string[]> = {
    decisiveFacts: [],
    relationships: [],
    unresolvedOrAmbiguous: [],
    sourceAnchors: [],
  };
  for (const key of Object.keys(SEMANTIC_CAPSULE_LIMITS) as Array<keyof SemanticCapsuleOutput>) {
    const items = record[key];
    if (!Array.isArray(items) || items.length > SEMANTIC_CAPSULE_LIMITS[key]) return null;
    for (const item of items) {
      if (typeof item !== "string") return null;
      const trimmed = item.trim();
      if (trimmed.length === 0 || /[\r\n]/.test(trimmed) || utf8Bytes(trimmed) > SEMANTIC_ITEM_MAX_BYTES) {
        return null;
      }
      normalized[key].push(trimmed);
    }
  }
  const output: SemanticCapsuleOutput = normalized;
  const itemCount = Object.values(normalized).reduce((count, items) => count + items.length, 0);
  if (itemCount === 0 || utf8Bytes(semanticCapsuleBody(output)) > maxBytes) return null;
  return output;
}

/** Render one fixed semantic view. Null means the deterministic capsule must be used. */
export function renderSemanticCapsule(
  value: unknown,
  metadata: CapsuleMetadata,
  maxBytes: number,
): string | null {
  const output = validateSemanticCapsule(value, maxBytes);
  if (output === null) return null;
  const id = escapeXml(metadata.id);
  const toolName = escapeXml(metadata.toolName);
  const source = escapeXml(metadata.source ?? "visible-tool-result");
  const rendered = `<prime_context_output id="${id}" tool="${toolName}" bytes="${metadata.textBytes}" ` +
    `lines="${metadata.lineCount}" source="${source}" semantic="true">\n` +
    `${semanticCapsuleBody(output)}\n</prime_context_output>`;
  return utf8Bytes(rendered) <= maxBytes ? rendered : null;
}
