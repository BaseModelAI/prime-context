// src/index.ts
import { open as openFile } from "fs/promises";
import { dirname as dirname2, resolve as resolve2 } from "path";

// src/capsule.ts
var DECISIVE_FAILURE_SIGNAL = /\b(?:[a-z_]*error|exceptions?|traceback)\b|\bassertion(?:error|failed|failure)?\b|^\s*assert\b|\bfail(?:ed|ure)?\b/i;
var SUCCESS_SIGNAL = /\b(?:pass(?:ed)?|success(?:ful)?)\b/i;
var WARNING_SIGNAL = /warning/i;
var TERMINAL_OUTCOME_SIGNAL = /^\s*(?:test_result\s+(?:pass|fail)(?:\s+\d+\/\d+)?|ok|failed\s*\([^)]*\)|build\s+(?:success|failed))\s*$/i;
var TERMINAL_SUCCESS_SIGNAL = /^\s*(?:test_result\s+pass(?:\s+\d+\/\d+)?|ok|build\s+success)\s*$/i;
var TERMINAL_FAILURE_SIGNAL = /^\s*(?:test_result\s+fail(?:\s+\d+\/\d+)?|failed\s*\([^)]*\)|build\s+failed)\s*$/i;
var COMMAND_STATUS_SIGNAL = /^\s*(?:exit|rc|status)\s*[:=]?\s*-?\d+\s*$/i;
var LOW_SIGNAL_TRACE_LINE = /^\s*(?:trace|debug|progress)\b/i;
var MARKDOWN_BULLET_LINE = /^\s*[-*]\s+/;
function normalizedLineShape(line) {
  return line.trim().toLowerCase().replaceAll(/\b(?:0x[0-9a-f]+|\d+(?:\.\d+)?|[0-9a-f]{8,}(?:-[0-9a-f-]{4,})*)\b/gi, "#");
}
function countedTestSummaryLine(line) {
  const cleaned = line.trim().replace(/^=+\s*/, "").replace(/\s*=+$/, "");
  return /^(?:tests?\s*:?\s*)?\d+\s+(?:passed|failed)(?:\s*,\s*\d+\s+(?:passed|failed|skipped|xfailed|xpassed|deselected|warnings?))*(?:\s+in\s+\d+(?:\.\d+)?s)?$/i.test(cleaned) ? cleaned : null;
}
function explicitTestSummaryLine(line) {
  const cleaned = line.trim();
  return /^TEST_RESULT\s+(?:PASS|FAIL)\s+\d+\/\d+$/i.test(cleaned) ? cleaned : null;
}
function hasTerminalOutcome(text) {
  return splitVisibleLines(text).some((line) => TERMINAL_OUTCOME_SIGNAL.test(line) || countedTestSummaryLine(line) !== null);
}
function hasTerminalSuccess(text) {
  return splitVisibleLines(text).some(
    (line) => TERMINAL_SUCCESS_SIGNAL.test(line) || /\b\d+\s+passed\b/i.test(countedTestSummaryLine(line) ?? "")
  );
}
function terminalSuccessSignature(text) {
  if (hasTerminalFailure(text)) return null;
  const lines = splitVisibleLines(text);
  const explicit = lines.map(explicitTestSummaryLine).find((line) => line !== null);
  if (explicit) return explicit.toUpperCase().replaceAll(/\s+/g, " ");
  const counted = lines.map(countedTestSummaryLine).find((line) => line !== null);
  return counted ? counted.toUpperCase().replaceAll(/\s+/g, " ") : null;
}
function hasTerminalFailure(text) {
  return splitVisibleLines(text).some(
    (line) => TERMINAL_FAILURE_SIGNAL.test(line) || /\b\d+\s+failed\b/i.test(countedTestSummaryLine(line) ?? "")
  );
}
function uniqueStrings(values, limit = 32) {
  return [...new Set(values.filter(Boolean))].slice(0, limit);
}
function analyzeOutcome(text, isError = false) {
  const lines = splitVisibleLines(text);
  const explicitLine = [...lines].reverse().map(explicitTestSummaryLine).find((line) => line !== null) ?? null;
  const explicit = explicitLine?.match(/^TEST_RESULT\s+(?:PASS|FAIL)\s+(\d+)\/(\d+)$/i) ?? null;
  const countedLine = [...lines].reverse().map(countedTestSummaryLine).find((line) => line !== null) ?? null;
  const countedTotal = countedLine ? [...countedLine.matchAll(/\b(\d+)\s+(?:passed|failed)\b/gi)].reduce((sum, match) => sum + Number(match[1]), 0) : 0;
  const ran = [...lines].reverse().map((line) => /^\s*Ran\s+(\d+)\s+tests?(?:\s+in\s+\d+(?:\.\d+)?s)?\s*$/i.exec(line)).find((match) => match !== null) ?? null;
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
  const commandFailures = uniqueStrings(lines.map((line) => line.trim()).filter((line) => /^(?:fatal:|error:|failed:)|\bcommand\b.*\bfailed\b/i.test(line)), 8);
  const status = hasTerminalSuccess(text) && !hasTerminalFailure(text) && !isError ? "success" : hasTerminalFailure(text) || isError || failingTests.length > 0 || exceptions.length > 0 || commandFailures.length > 0 ? "failure" : "unknown";
  const meaningfulExceptions = exceptions.filter((value) => !/^CalledProcessError\b/.test(value));
  const signature = status === "success" ? terminalSuccessSignature(text) : status === "failure" && failingTests.length > 0 ? `FAIL_TESTS;${[...failingTests].sort().join(",")}` : status === "failure" && (meaningfulExceptions.length > 0 || commandFailures.length > 0) ? [
    "FAILURE",
    [...meaningfulExceptions].sort().join("|"),
    [...commandFailures].sort().join("|"),
    [...exitStatuses].sort().join(",")
  ].join(";") : null;
  return {
    status,
    testSummary,
    testTotal,
    failingTests,
    exceptions,
    sourceLocations,
    exitStatuses,
    commandFailures,
    signature
  };
}
function isLowSignalTraceOutput(text) {
  const lines = splitVisibleLines(text).filter((line) => line.trim().length > 0);
  if (lines.length < 6) return false;
  const traceLines = lines.filter((line) => LOW_SIGNAL_TRACE_LINE.test(line)).length;
  return traceLines >= 6 && traceLines / lines.length >= 0.8;
}
function isRepetitiveOutput(text) {
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
function adaptiveMinTextBytes(configuredMinBytes, usage) {
  if (!usage || usage.contextWindow <= 0 || usage.tokens === null) return configuredMinBytes;
  const percent = usage.tokens / usage.contextWindow;
  if (percent >= 0.8) return Math.min(configuredMinBytes, 8192);
  if (percent >= 0.6) return Math.min(configuredMinBytes, 12288);
  if (percent >= 0.4) return Math.min(configuredMinBytes, 16384);
  return configuredMinBytes;
}
function adaptiveCapsuleMaxBytes(text, configuredMaxBytes, usage) {
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
function utf8Bytes(value) {
  return Buffer.byteLength(value, "utf8");
}
function truncateUtf8(value, maxBytes) {
  if (maxBytes <= 0) return "";
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length <= maxBytes) return value;
  let end = Math.min(maxBytes, bytes.length);
  while (end > 0 && end < bytes.length && (bytes[end] & 192) === 128) {
    end -= 1;
  }
  return bytes.subarray(0, end).toString("utf8");
}
function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
function splitVisibleLines(text) {
  return text.length === 0 ? [] : text.split("\n");
}
function selectCapsuleLineRecords(text, compact = isRepetitiveOutput(text)) {
  const lines = splitVisibleLines(text).map((rawText, index) => ({
    lineNumber: index + 1,
    rawText,
    displayedText: utf8Bytes(rawText) <= 384 ? rawText : `${truncateUtf8(rawText, 381)}...`
  }));
  const edgeSignals = (matches, limit) => {
    if (matches.length <= limit) return matches;
    const firstCount = Math.ceil(limit / 2);
    return [...matches.slice(0, firstCount), ...matches.slice(-(limit - firstCount))];
  };
  const byShape = (candidates) => {
    const shapes = /* @__PURE__ */ new Set();
    return candidates.filter((line) => {
      const shape = normalizedLineShape(line.rawText);
      if (shapes.has(shape)) return false;
      shapes.add(shape);
      return true;
    });
  };
  const unique3 = (selected) => {
    const seen = /* @__PURE__ */ new Set();
    return selected.filter((line) => {
      if (seen.has(line.rawText)) return false;
      seen.add(line.rawText);
      return true;
    });
  };
  const informativeCompactHead = () => byShape(lines.filter(
    (line) => line.rawText.trim().length > 0 && !LOW_SIGNAL_TRACE_LINE.test(line.rawText) && !TERMINAL_OUTCOME_SIGNAL.test(line.rawText)
  )).slice(0, 8);
  if (compact && hasTerminalSuccess(text) && !hasTerminalFailure(text)) {
    return unique3([
      ...edgeSignals(byShape(lines.filter((line) => TERMINAL_SUCCESS_SIGNAL.test(line.rawText))), 4),
      ...informativeCompactHead()
    ]);
  }
  if (compact && hasTerminalFailure(text)) {
    const failingTests = lines.filter((line) => /^\s*FAIL\s+\S+/i.test(line.rawText));
    const exceptions = lines.filter(
      (line) => /\b[A-Z][A-Za-z0-9_]*(?:Error|Exception)(?::|\s*$)/.test(line.rawText)
    );
    const sourceLocations = lines.filter(
      (line) => /File "[^"]+", line \d+/.test(line.rawText) || /[A-Za-z0-9_./-]+\.(?:py|ts|tsx|js|mjs|cjs|java|rs|go):\d+/.test(line.rawText)
    );
    return unique3([
      ...edgeSignals(byShape(lines.filter((line) => TERMINAL_FAILURE_SIGNAL.test(line.rawText))), 4),
      ...failingTests,
      ...byShape(exceptions),
      ...byShape(sourceLocations),
      ...edgeSignals(byShape(lines.filter((line) => COMMAND_STATUS_SIGNAL.test(line.rawText))), 4),
      ...edgeSignals(byShape(lines.filter(
        (line) => DECISIVE_FAILURE_SIGNAL.test(line.rawText) && !LOW_SIGNAL_TRACE_LINE.test(line.rawText) && !MARKDOWN_BULLET_LINE.test(line.rawText)
      )), 8),
      ...informativeCompactHead()
    ]);
  }
  const decisiveIndexes = lines.map((line, index) => DECISIVE_FAILURE_SIGNAL.test(line.rawText) ? index : -1).filter((index) => index >= 0);
  const terminalOutcomes = edgeSignals(
    lines.filter((line) => TERMINAL_OUTCOME_SIGNAL.test(line.rawText)),
    compact ? 4 : 10
  );
  const decisiveMatches = decisiveIndexes.map((index) => lines[index]);
  const decisiveFailures = edgeSignals(compact ? byShape(decisiveMatches) : decisiveMatches, compact ? 8 : 20);
  const decisiveNeighbors = edgeSignals(
    decisiveIndexes.flatMap((index) => [lines[index - 1], lines[index + 1]]).filter((line) => line !== void 0),
    compact ? 4 : 10
  );
  const successMatches = lines.filter(
    (line) => SUCCESS_SIGNAL.test(line.rawText) && !DECISIVE_FAILURE_SIGNAL.test(line.rawText)
  );
  const successes = edgeSignals(successMatches, compact ? 4 : 10);
  const warningSlots = 20 - decisiveFailures.length;
  const warningMatches = lines.filter(
    (line) => WARNING_SIGNAL.test(line.rawText) && !DECISIVE_FAILURE_SIGNAL.test(line.rawText)
  );
  const warnings = (compact ? byShape(warningMatches) : warningMatches).slice(0, warningSlots);
  const head = lines.slice(0, compact ? 8 : 20);
  const tail = lines.slice(Math.max(0, lines.length - (compact ? 8 : 40)));
  return unique3([
    ...terminalOutcomes,
    ...decisiveFailures,
    ...decisiveNeighbors,
    ...successes,
    ...compact ? byShape(head) : head,
    ...warnings,
    ...compact ? byShape(tail) : tail
  ]);
}
function recoverySearchHint(text) {
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
function renderCapsule(text, metadata, maxBytes, repeatedTerminalSuccess = false) {
  const id = escapeXml(metadata.id);
  const toolName = escapeXml(metadata.toolName);
  const source = metadata.source ?? "visible-tool-result";
  const cleanTerminalSuccess = hasTerminalSuccess(text) && !hasTerminalFailure(text);
  const lowSignalTrace = !cleanTerminalSuccess && analyzeOutcome(text, false).status === "unknown" && isLowSignalTraceOutput(text);
  if (cleanTerminalSuccess && repeatedTerminalSuccess) {
    return `<prime_context_output id="${id}" tool="${toolName}" bytes="${metadata.textBytes}" lines="${metadata.lineCount}" source="${source}">
Archived; repeated clean command success unchanged.
</prime_context_output>`;
  }
  const prefix = `<prime_context_output id="${id}" tool="${toolName}" bytes="${metadata.textBytes}" lines="${metadata.lineCount}" source="${source}">
` + (cleanTerminalSuccess ? "Archived; clean command success summarized.\n" : lowSignalTrace ? "Archived; low-signal trace summarized; no decisive diagnostic found.\n" : "Archived; excerpt incomplete.\n");
  const selectedLines = selectCapsuleLineRecords(text);
  const focusLine = selectedLines[0]?.lineNumber ?? 1;
  const readStart = Math.max(1, focusLine - 20);
  const readEnd = Math.max(readStart, Math.min(metadata.lineCount, focusLine + 10));
  const readAction = `Read: prime_context action=read id=${id} startLine=${readStart} endLine=${readEnd}`;
  const searchHint = cleanTerminalSuccess ? null : recoverySearchHint(text);
  const suffix = cleanTerminalSuccess ? "\n</prime_context_output>" : lowSignalTrace ? "\n...\nNo diagnostic recovery hint.\n</prime_context_output>" : `
...
${readAction}` + (searchHint === null ? "" : `
Search: prime_context action=search id=${id} query="${searchHint}"`) + "\n</prime_context_output>";
  const fixedBytes = utf8Bytes(prefix) + utf8Bytes(suffix);
  if (fixedBytes >= maxBytes) {
    if (lowSignalTrace) {
      return `<prime_context_output id="${id}">
Archived; low-signal trace; no diagnostic recovery hint.
</prime_context_output>`;
    }
    const compact = `<prime_context_output id="${id}">
Archived; excerpt omitted.
${readAction}
</prime_context_output>`;
    return compact;
  }
  const budget = maxBytes - fixedBytes;
  const escapedLines = [
    ...(metadata.factualLines ?? []).map((line) => escapeXml(line)),
    ...selectedLines.map((line) => escapeXml(`L${line.lineNumber}: ${line.displayedText}`))
  ];
  const packed = [];
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
function selectBoundedCapsuleLines(records, cleanTerminalSuccess, terminalFailure) {
  const lines = records.map((record4) => ({
    lineNumber: record4.lineNumber,
    rawText: record4.text,
    displayedText: utf8Bytes(record4.text) <= 384 ? record4.text : `${truncateUtf8(record4.text, 381)}...`
  }));
  const unique3 = (selected) => {
    const seen = /* @__PURE__ */ new Set();
    return selected.filter((line) => {
      if (seen.has(line.lineNumber)) return false;
      seen.add(line.lineNumber);
      return true;
    });
  };
  const edge = (selected, limit) => {
    if (selected.length <= limit) return [...selected];
    const first = Math.ceil(limit / 2);
    return [...selected.slice(0, first), ...selected.slice(-(limit - first))];
  };
  const informativeHead = lines.filter(
    (line) => line.rawText.trim().length > 0 && !LOW_SIGNAL_TRACE_LINE.test(line.rawText) && !TERMINAL_OUTCOME_SIGNAL.test(line.rawText)
  ).slice(0, 8);
  const tail = lines.slice(-8);
  if (cleanTerminalSuccess) {
    return unique3([
      ...edge(lines.filter((line) => TERMINAL_SUCCESS_SIGNAL.test(line.rawText)), 4),
      ...informativeHead,
      ...tail
    ]);
  }
  if (terminalFailure) {
    return unique3([
      ...edge(lines.filter((line) => TERMINAL_FAILURE_SIGNAL.test(line.rawText)), 4),
      ...lines.filter((line) => /^\s*FAIL\s+\S+/i.test(line.rawText)),
      ...lines.filter((line) => /\b[A-Z][A-Za-z0-9_]*(?:Error|Exception)(?::|\s*$)/.test(line.rawText)),
      ...lines.filter((line) => /File "[^"]+", line \d+/.test(line.rawText) || /[A-Za-z0-9_./-]+\.(?:py|ts|tsx|js|mjs|cjs|java|rs|go):\d+/.test(line.rawText)),
      ...edge(lines.filter((line) => COMMAND_STATUS_SIGNAL.test(line.rawText)), 4),
      ...edge(lines.filter((line) => DECISIVE_FAILURE_SIGNAL.test(line.rawText) && !LOW_SIGNAL_TRACE_LINE.test(line.rawText) && !MARKDOWN_BULLET_LINE.test(line.rawText)), 8),
      ...informativeHead,
      ...tail
    ]);
  }
  return unique3([
    ...edge(lines.filter((line) => TERMINAL_OUTCOME_SIGNAL.test(line.rawText)), 6),
    ...edge(lines.filter((line) => DECISIVE_FAILURE_SIGNAL.test(line.rawText)), 12),
    ...edge(lines.filter((line) => SUCCESS_SIGNAL.test(line.rawText) && !DECISIVE_FAILURE_SIGNAL.test(line.rawText)), 6),
    ...informativeHead,
    ...lines.filter((line) => WARNING_SIGNAL.test(line.rawText)).slice(0, 6),
    ...tail
  ]);
}
function renderBoundedCapsule(records, signals, metadata, maxBytes, repeatedTerminalSuccess = false) {
  const id = escapeXml(metadata.id);
  const toolName = escapeXml(metadata.toolName);
  const source = metadata.source ?? "visible-tool-result";
  const cleanTerminalSuccess = hasTerminalSuccess(signals.outcomeText) && !hasTerminalFailure(signals.outcomeText);
  const terminalFailure = hasTerminalFailure(signals.outcomeText) || analyzeOutcome(signals.outcomeText, false).status === "failure";
  const lowSignalTrace = !cleanTerminalSuccess && !terminalFailure && signals.nonEmptyLineCount >= 6 && signals.traceLineCount / signals.nonEmptyLineCount >= 0.8;
  if (cleanTerminalSuccess && repeatedTerminalSuccess) {
    return `<prime_context_output id="${id}" tool="${toolName}" bytes="${metadata.textBytes}" lines="${metadata.lineCount}" source="${source}">
Archived; repeated clean command success unchanged.
</prime_context_output>`;
  }
  const prefix = `<prime_context_output id="${id}" tool="${toolName}" bytes="${metadata.textBytes}" lines="${metadata.lineCount}" source="${source}">
` + (cleanTerminalSuccess ? "Archived; clean command success summarized.\n" : lowSignalTrace ? "Archived; low-signal trace summarized; no decisive diagnostic found.\n" : "Archived; excerpt incomplete.\n");
  const selectedLines = selectBoundedCapsuleLines(records, cleanTerminalSuccess, terminalFailure);
  const focusLine = selectedLines[0]?.lineNumber ?? records[0]?.lineNumber ?? 1;
  const readStart = Math.max(1, focusLine - 20);
  const readEnd = Math.max(readStart, Math.min(metadata.lineCount, focusLine + 10));
  const readAction = `Read: prime_context action=read id=${id} startLine=${readStart} endLine=${readEnd}`;
  const searchHint = cleanTerminalSuccess ? null : recoverySearchHint(signals.outcomeText);
  const suffix = cleanTerminalSuccess ? "\n</prime_context_output>" : lowSignalTrace ? "\n...\nNo diagnostic recovery hint.\n</prime_context_output>" : `
...
${readAction}` + (searchHint === null ? "" : `
Search: prime_context action=search id=${id} query="${searchHint}"`) + "\n</prime_context_output>";
  const fixedBytes = utf8Bytes(prefix) + utf8Bytes(suffix);
  if (fixedBytes >= maxBytes) {
    if (lowSignalTrace) {
      return `<prime_context_output id="${id}">
Archived; low-signal trace; no diagnostic recovery hint.
</prime_context_output>`;
    }
    return `<prime_context_output id="${id}">
Archived; excerpt omitted.
${readAction}
</prime_context_output>`;
  }
  const budget = maxBytes - fixedBytes;
  const packed = [];
  let usedBytes = 0;
  const pack = (line) => {
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
  for (const record4 of remainingRecords) pack(`L${record4.lineNumber}: ${record4.displayedText}`);
  return prefix + packed.join("\n") + suffix;
}

// src/index.ts
import {
  isBashToolResult,
  isEditToolResult,
  isIpythonToolResult,
  SessionManager
} from "@earendil-works/pi-coding-agent";

// src/archive.ts
import { randomUUID as randomUUID2 } from "crypto";
import { createReadStream as createReadStream2 } from "fs";
import { copyFile, mkdir, readFile, readdir, rename as rename2, rm as rm2, writeFile } from "fs/promises";
import { join as join2 } from "path";
import { StringDecoder as StringDecoder2 } from "string_decoder";
import { promisify } from "util";
import { createGunzip, gunzip } from "zlib";

// node_modules/diff/libesm/diff/base.js
var Diff = class {
  diff(oldStr, newStr, options = {}) {
    let callback;
    if (typeof options === "function") {
      callback = options;
      options = {};
    } else if ("callback" in options) {
      callback = options.callback;
    }
    const oldString = this.castInput(oldStr, options);
    const newString = this.castInput(newStr, options);
    const oldTokens = this.removeEmpty(this.tokenize(oldString, options));
    const newTokens = this.removeEmpty(this.tokenize(newString, options));
    return this.diffWithOptionsObj(oldTokens, newTokens, options, callback);
  }
  diffWithOptionsObj(oldTokens, newTokens, options, callback) {
    var _a;
    const done = (value) => {
      value = this.postProcess(value, options);
      if (callback) {
        setTimeout(function() {
          callback(value);
        }, 0);
        return void 0;
      } else {
        return value;
      }
    };
    const newLen = newTokens.length, oldLen = oldTokens.length;
    let editLength = 1;
    let maxEditLength = newLen + oldLen;
    if (options.maxEditLength != null) {
      maxEditLength = Math.min(maxEditLength, options.maxEditLength);
    }
    const maxExecutionTime = (_a = options.timeout) !== null && _a !== void 0 ? _a : Infinity;
    const abortAfterTimestamp = Date.now() + maxExecutionTime;
    const bestPath = [{ oldPos: -1, lastComponent: void 0 }];
    let newPos = this.extractCommon(bestPath[0], newTokens, oldTokens, 0, options);
    if (bestPath[0].oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
      return done(this.buildValues(bestPath[0].lastComponent, newTokens, oldTokens));
    }
    let minDiagonalToConsider = -Infinity, maxDiagonalToConsider = Infinity;
    const execEditLength = () => {
      for (let diagonalPath = Math.max(minDiagonalToConsider, -editLength); diagonalPath <= Math.min(maxDiagonalToConsider, editLength); diagonalPath += 2) {
        let basePath;
        const removePath = bestPath[diagonalPath - 1], addPath = bestPath[diagonalPath + 1];
        if (removePath) {
          bestPath[diagonalPath - 1] = void 0;
        }
        let canAdd = false;
        if (addPath) {
          const addPathNewPos = addPath.oldPos - diagonalPath;
          canAdd = addPath && 0 <= addPathNewPos && addPathNewPos < newLen;
        }
        const canRemove = removePath && removePath.oldPos + 1 < oldLen;
        if (!canAdd && !canRemove) {
          bestPath[diagonalPath] = void 0;
          continue;
        }
        if (!canRemove || canAdd && removePath.oldPos < addPath.oldPos) {
          basePath = this.addToPath(addPath, true, false, 0, options);
        } else {
          basePath = this.addToPath(removePath, false, true, 1, options);
        }
        newPos = this.extractCommon(basePath, newTokens, oldTokens, diagonalPath, options);
        if (basePath.oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
          return done(this.buildValues(basePath.lastComponent, newTokens, oldTokens)) || true;
        } else {
          bestPath[diagonalPath] = basePath;
          if (basePath.oldPos + 1 >= oldLen) {
            maxDiagonalToConsider = Math.min(maxDiagonalToConsider, diagonalPath - 1);
          }
          if (newPos + 1 >= newLen) {
            minDiagonalToConsider = Math.max(minDiagonalToConsider, diagonalPath + 1);
          }
        }
      }
      editLength++;
    };
    if (callback) {
      (function exec() {
        setTimeout(function() {
          if (editLength > maxEditLength || Date.now() > abortAfterTimestamp) {
            return callback(void 0);
          }
          if (!execEditLength()) {
            exec();
          }
        }, 0);
      })();
    } else {
      while (editLength <= maxEditLength && Date.now() <= abortAfterTimestamp) {
        const ret = execEditLength();
        if (ret) {
          return ret;
        }
      }
    }
  }
  addToPath(path, added, removed, oldPosInc, options) {
    const last = path.lastComponent;
    if (last && !options.oneChangePerToken && last.added === added && last.removed === removed) {
      return {
        oldPos: path.oldPos + oldPosInc,
        lastComponent: { count: last.count + 1, added, removed, previousComponent: last.previousComponent }
      };
    } else {
      return {
        oldPos: path.oldPos + oldPosInc,
        lastComponent: { count: 1, added, removed, previousComponent: last }
      };
    }
  }
  extractCommon(basePath, newTokens, oldTokens, diagonalPath, options) {
    const newLen = newTokens.length, oldLen = oldTokens.length;
    let oldPos = basePath.oldPos, newPos = oldPos - diagonalPath, commonCount = 0;
    while (newPos + 1 < newLen && oldPos + 1 < oldLen && this.equals(oldTokens[oldPos + 1], newTokens[newPos + 1], options)) {
      newPos++;
      oldPos++;
      commonCount++;
      if (options.oneChangePerToken) {
        basePath.lastComponent = { count: 1, previousComponent: basePath.lastComponent, added: false, removed: false };
      }
    }
    if (commonCount && !options.oneChangePerToken) {
      basePath.lastComponent = { count: commonCount, previousComponent: basePath.lastComponent, added: false, removed: false };
    }
    basePath.oldPos = oldPos;
    return newPos;
  }
  equals(left, right, options) {
    if (options.comparator) {
      return options.comparator(left, right);
    } else {
      return left === right || !!options.ignoreCase && left.toLowerCase() === right.toLowerCase();
    }
  }
  removeEmpty(array) {
    const ret = [];
    for (let i = 0; i < array.length; i++) {
      if (array[i]) {
        ret.push(array[i]);
      }
    }
    return ret;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  castInput(value, options) {
    return value;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tokenize(value, options) {
    return Array.from(value);
  }
  join(chars) {
    return chars.join("");
  }
  postProcess(changeObjects, options) {
    return changeObjects;
  }
  get useLongestToken() {
    return false;
  }
  buildValues(lastComponent, newTokens, oldTokens) {
    const components = [];
    let nextComponent;
    while (lastComponent) {
      components.push(lastComponent);
      nextComponent = lastComponent.previousComponent;
      delete lastComponent.previousComponent;
      lastComponent = nextComponent;
    }
    components.reverse();
    const componentLen = components.length;
    let componentPos = 0, newPos = 0, oldPos = 0;
    for (; componentPos < componentLen; componentPos++) {
      const component = components[componentPos];
      if (!component.removed) {
        if (!component.added && this.useLongestToken) {
          let value = newTokens.slice(newPos, newPos + component.count);
          value = value.map(function(value2, i) {
            const oldValue = oldTokens[oldPos + i];
            return oldValue.length > value2.length ? oldValue : value2;
          });
          component.value = this.join(value);
        } else {
          component.value = this.join(newTokens.slice(newPos, newPos + component.count));
        }
        newPos += component.count;
        if (!component.added) {
          oldPos += component.count;
        }
      } else {
        component.value = this.join(oldTokens.slice(oldPos, oldPos + component.count));
        oldPos += component.count;
      }
    }
    return components;
  }
};

// node_modules/diff/libesm/diff/line.js
var LineDiff = class extends Diff {
  constructor() {
    super(...arguments);
    this.tokenize = tokenize;
  }
  equals(left, right, options) {
    if (options.ignoreWhitespace) {
      if (!options.newlineIsToken || !left.includes("\n")) {
        left = left.trim();
      }
      if (!options.newlineIsToken || !right.includes("\n")) {
        right = right.trim();
      }
    } else if (options.ignoreNewlineAtEof && !options.newlineIsToken) {
      if (left.endsWith("\n")) {
        left = left.slice(0, -1);
      }
      if (right.endsWith("\n")) {
        right = right.slice(0, -1);
      }
    }
    return super.equals(left, right, options);
  }
};
var lineDiff = new LineDiff();
function diffLines(oldStr, newStr, options) {
  return lineDiff.diff(oldStr, newStr, options);
}
function tokenize(value, options) {
  if (options.stripTrailingCr) {
    value = value.replace(/\r\n/g, "\n");
  }
  const retLines = [], linesAndNewlines = value.split(/(\n|\r\n)/);
  if (!linesAndNewlines[linesAndNewlines.length - 1]) {
    linesAndNewlines.pop();
  }
  for (let i = 0; i < linesAndNewlines.length; i++) {
    const line = linesAndNewlines[i];
    if (i % 2 && !options.newlineIsToken) {
      retLines[retLines.length - 1] += line;
    } else {
      retLines.push(line);
    }
  }
  return retLines;
}

// node_modules/diff/libesm/patch/create.js
function structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
  let optionsObj;
  if (!options) {
    optionsObj = {};
  } else if (typeof options === "function") {
    optionsObj = { callback: options };
  } else {
    optionsObj = options;
  }
  if (typeof optionsObj.context === "undefined") {
    optionsObj.context = 4;
  }
  const context = optionsObj.context;
  if (optionsObj.newlineIsToken) {
    throw new Error("newlineIsToken may not be used with patch-generation functions, only with diffing functions");
  }
  if (!optionsObj.callback) {
    return diffLinesResultToPatch(diffLines(oldStr, newStr, optionsObj));
  } else {
    const { callback } = optionsObj;
    diffLines(oldStr, newStr, Object.assign(Object.assign({}, optionsObj), { callback: (diff) => {
      const patch = diffLinesResultToPatch(diff);
      callback(patch);
    } }));
  }
  function diffLinesResultToPatch(diff) {
    if (!diff) {
      return;
    }
    diff.push({ value: "", lines: [] });
    function contextLines(lines) {
      return lines.map(function(entry) {
        return " " + entry;
      });
    }
    const hunks = [];
    let oldRangeStart = 0, newRangeStart = 0, curRange = [], oldLine = 1, newLine = 1;
    for (let i = 0; i < diff.length; i++) {
      const current = diff[i], lines = current.lines || splitLines(current.value);
      current.lines = lines;
      if (current.added || current.removed) {
        if (!oldRangeStart) {
          const prev = diff[i - 1];
          oldRangeStart = oldLine;
          newRangeStart = newLine;
          if (prev) {
            curRange = context > 0 ? contextLines(prev.lines.slice(-context)) : [];
            oldRangeStart -= curRange.length;
            newRangeStart -= curRange.length;
          }
        }
        for (const line of lines) {
          curRange.push((current.added ? "+" : "-") + line);
        }
        if (current.added) {
          newLine += lines.length;
        } else {
          oldLine += lines.length;
        }
      } else {
        if (oldRangeStart) {
          if (lines.length <= context * 2 && i < diff.length - 2) {
            for (const line of contextLines(lines)) {
              curRange.push(line);
            }
          } else {
            const contextSize = Math.min(lines.length, context);
            for (const line of contextLines(lines.slice(0, contextSize))) {
              curRange.push(line);
            }
            const hunk = {
              oldStart: oldRangeStart,
              oldLines: oldLine - oldRangeStart + contextSize,
              newStart: newRangeStart,
              newLines: newLine - newRangeStart + contextSize,
              lines: curRange
            };
            hunks.push(hunk);
            oldRangeStart = 0;
            newRangeStart = 0;
            curRange = [];
          }
        }
        oldLine += lines.length;
        newLine += lines.length;
      }
    }
    for (const hunk of hunks) {
      for (let i = 0; i < hunk.lines.length; i++) {
        if (hunk.lines[i].endsWith("\n")) {
          hunk.lines[i] = hunk.lines[i].slice(0, -1);
        } else {
          hunk.lines.splice(i + 1, 0, "\\ No newline at end of file");
          i++;
        }
      }
    }
    return {
      oldFileName,
      newFileName,
      oldHeader,
      newHeader,
      hunks
    };
  }
}
function splitLines(text) {
  const hasTrailingNl = text.endsWith("\n");
  const result = text.split("\n").map((line) => line + "\n");
  if (hasTrailingNl) {
    result.pop();
  } else {
    result.push(result.pop().slice(0, -1));
  }
  return result;
}

// src/broker.ts
var FULL_ANALYZER_BYTES = 1024 * 1024;
function boundedOutcome(outcome) {
  return {
    ...outcome,
    testSummary: outcome.testSummary === null ? null : truncateUtf8(outcome.testSummary, 512),
    failingTests: outcome.failingTests.slice(0, 32).map((item) => truncateUtf8(item, 512)),
    exceptions: outcome.exceptions.slice(0, 12).map((item) => truncateUtf8(item, 512)),
    sourceLocations: outcome.sourceLocations.slice(0, 12).map((item) => truncateUtf8(item, 512)),
    exitStatuses: outcome.exitStatuses.slice(0, 8).map((item) => truncateUtf8(item, 512)),
    commandFailures: outcome.commandFailures.slice(0, 8).map((item) => truncateUtf8(item, 512)),
    signature: outcome.signature === null || utf8Bytes(outcome.signature) > 2048 ? null : outcome.signature
  };
}
function emptyWorkflowState() {
  return {
    requirementsRevision: 0,
    locked: false,
    latestTestRevision: null,
    latestTestResult: null,
    cumulativeSuite: null,
    goalReady: false,
    readiness: "NOT_READY"
  };
}
function emptyUtilityCounters() {
  return {
    archived: 0,
    recovered: 0,
    usefulRecoveries: 0,
    repeatedReadWithoutMutation: 0,
    sourceBytes: 0,
    projectedBytes: 0
  };
}
function emptyAggregateMetrics() {
  return {
    sourceBytesArchived: 0,
    callArgumentBytesProjectedOut: 0,
    resultBytesProjectedOut: 0,
    typedMediaBytesProjectedOut: 0,
    recoveryBytesExposed: 0,
    currentProjectedModelViewBytes: 0,
    streamingBytesProcessed: 0,
    inspectRecallHits: 0,
    foldGenerationCount: 0,
    branchRuntimeReloadCount: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    uncachedInputTokens: 0,
    stableProjectionExtensionTurns: 0
  };
}
function emptyStats() {
  return {
    observedResults: 0,
    passedThrough: 0,
    structuredCapsules: 0,
    deltaCapsules: 0,
    turnsAfterCleanSuccess: 0
  };
}
function boundedAdd(current, value) {
  if (!Number.isFinite(value) || value <= 0) return current;
  return Math.min(Number.MAX_SAFE_INTEGER, current + Math.floor(value));
}
function boundedLineDiff(previous, current) {
  const patch = structuredPatch("previous", "current", previous, current, "", "", { context: 2 });
  if (patch.hunks.length === 0 || patch.hunks.length > 4) return null;
  const lines = patch.hunks.flatMap((hunk) => [
    `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
    ...hunk.lines
  ]);
  if (!lines.some((line) => line.startsWith("+") || line.startsWith("-"))) return null;
  const bytes = utf8Bytes(lines.join("\n"));
  if (bytes > 2 * 1024 || bytes > utf8Bytes(current) * 0.3) return null;
  return lines;
}
function repeatedSectionsDelta(current, recent) {
  let reduced = current;
  let removed = 0;
  const candidates = [...new Set(recent)].filter((value) => utf8Bytes(value) >= 512 && value !== current && current.includes(value)).sort((left, right) => utf8Bytes(right) - utf8Bytes(left));
  for (const candidate of candidates) {
    if (!reduced.includes(candidate)) continue;
    const bytes = utf8Bytes(candidate);
    reduced = reduced.replace(candidate, `
[Unchanged prior section: ${bytes} bytes]
`);
    removed += bytes;
  }
  if (removed === 0 || utf8Bytes(reduced) > utf8Bytes(current) * 0.3) return null;
  const lines = reduced.split("\n");
  return [
    `Composite delta: ${removed} bytes match prior observations.`,
    ...lines.slice(0, 60),
    ...lines.length > 60 ? [`... ${lines.length - 60} additional novel lines archived.`] : []
  ];
}
function outcomeLines(outcome) {
  return [
    ...outcome.status === "success" ? ["Command or validation succeeded."] : [],
    ...outcome.testSummary ? [`Tests: ${outcome.testSummary}`] : [],
    ...outcome.failingTests.map((id) => `Failing test: ${id}`),
    ...outcome.exceptions.map((value) => `Exception: ${value}`),
    ...outcome.sourceLocations.map((value) => `Source: ${value}`),
    ...outcome.exitStatuses.map((value) => `Command: ${value}`),
    ...outcome.commandFailures.map((value) => `Failure: ${value}`)
  ];
}
var ObservationBroker = class {
  recentSketches = [];
  recentAnalyzerTexts = [];
  outcomesBySubject = /* @__PURE__ */ new Map();
  documentsBySubject = /* @__PURE__ */ new Map();
  latestOutcome = null;
  cleanSuccessSeen = false;
  stats = emptyStats();
  utilityBuckets = /* @__PURE__ */ new Map([["*", emptyUtilityCounters()]]);
  metrics = emptyAggregateMetrics();
  lastReadOnlyIntent;
  observe(toolName, text, isError, observation) {
    this.stats.observedResults = boundedAdd(this.stats.observedResults, 1);
    const stateKey = truncateUtf8(observation?.subjectKey ?? `tool:${toolName}`, 1024);
    const textBytes = observation?.textBytes ?? utf8Bytes(text);
    const lineCount = observation?.lineCount ?? (text.length === 0 ? 0 : text.split("\n").length);
    const outcome = observation?.outcome ?? analyzeOutcome(text, isError);
    const retainedOutcome = boundedOutcome(outcome);
    const previousOutcome = this.outcomesBySubject.get(stateKey);
    const exactRepeat = observation?.exactRepeat ?? (textBytes >= 256 && textBytes <= FULL_ANALYZER_BYTES && this.recentAnalyzerTexts.some((value) => value.text === text));
    const semanticRepeat = textBytes >= 256 && retainedOutcome.signature !== null && previousOutcome?.signature === retainedOutcome.signature;
    const sameSubjectTexts = this.recentAnalyzerTexts.filter((value) => value.subjectKey === stateKey && value.text !== void 0).map((value) => value.text);
    let changedLines = outcome.status === "unknown" && textBytes <= FULL_ANALYZER_BYTES ? repeatedSectionsDelta(text, sameSubjectTexts) ?? void 0 : void 0;
    let documentRepeat = false;
    if (outcome.status === "unknown" && textBytes >= 512 && textBytes <= 24576) {
      const previous = this.documentsBySubject.get(stateKey);
      documentRepeat = previous === text;
      if (previous && previous !== text && !changedLines) {
        changedLines = boundedLineDiff(previous, text) ?? void 0;
      }
      this.documentsBySubject.delete(stateKey);
      this.documentsBySubject.set(stateKey, text);
      while (this.documentsBySubject.size > 32) {
        this.documentsBySubject.delete(this.documentsBySubject.keys().next().value);
      }
    }
    this.recentAnalyzerTexts.push({
      subjectKey: stateKey,
      ...textBytes <= FULL_ANALYZER_BYTES ? { text } : {}
    });
    if (this.recentAnalyzerTexts.length > 16) this.recentAnalyzerTexts.shift();
    this.recentSketches.push({
      subjectKey: stateKey,
      textBytes,
      lineCount,
      ...outcome.signature === null || utf8Bytes(outcome.signature) > 2048 ? {} : { outcomeSignature: outcome.signature },
      representativeLines: observation?.representativeLines.slice(0, 64) ?? text.split("\n").slice(0, 64),
      ...textBytes <= 64 * 1024 ? { smallText: text } : {}
    });
    if (this.recentSketches.length > 16) this.recentSketches.shift();
    if (outcome.signature !== null) {
      this.outcomesBySubject.delete(stateKey);
      this.outcomesBySubject.set(stateKey, retainedOutcome);
      while (this.outcomesBySubject.size > 32) {
        this.outcomesBySubject.delete(this.outcomesBySubject.keys().next().value);
      }
    }
    if (outcome.status !== "unknown") this.latestOutcome = retainedOutcome;
    if (outcome.status === "success") this.cleanSuccessSeen = true;
    if (exactRepeat || documentRepeat) return { kind: "delta", reason: "exact", outcome, previousOutcome };
    if (semanticRepeat) return { kind: "delta", reason: "outcome", outcome, previousOutcome };
    if (changedLines) return { kind: "delta", reason: "content", outcome, changedLines };
    return { kind: "structured", outcome };
  }
  renderDelta(decision, metadata, maxBytes) {
    const prefix = `<prime_context_delta id="${escapeXml(metadata.id)}" tool="${escapeXml(metadata.toolName)}" bytes="${metadata.textBytes}" lines="${metadata.lineCount}" source="${escapeXml(metadata.source)}">
`;
    const suffix = "\n</prime_context_delta>";
    const headline = decision.reason === "exact" ? "Unchanged since previous observation." : decision.reason === "outcome" ? "Semantic outcome unchanged since previous observation." : "Content changed since previous observation.";
    const candidates = [
      headline,
      ...decision.reason === "content" ? decision.changedLines ?? [] : outcomeLines(decision.outcome)
    ];
    const budget = Math.max(0, maxBytes - utf8Bytes(prefix) - utf8Bytes(suffix));
    const packed = [];
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
  utilityBucket(subjectKey) {
    const requested = truncateUtf8(`subject:${subjectKey ?? "unknown"}`, 256);
    const existing = this.utilityBuckets.get(requested);
    if (existing) return existing;
    if (this.utilityBuckets.size >= 64) return this.utilityBuckets.get("*");
    const created = emptyUtilityCounters();
    this.utilityBuckets.set(requested, created);
    return created;
  }
  recordPassThrough() {
    this.stats.passedThrough = boundedAdd(this.stats.passedThrough, 1);
  }
  recordCapsule(delta) {
    if (delta) this.stats.deltaCapsules = boundedAdd(this.stats.deltaCapsules, 1);
    else this.stats.structuredCapsules = boundedAdd(this.stats.structuredCapsules, 1);
  }
  recordArchive(options) {
    const bucket = this.utilityBucket(options.subjectKey);
    bucket.archived = boundedAdd(bucket.archived, 1);
    bucket.sourceBytes = boundedAdd(bucket.sourceBytes, options.sourceBytes);
    bucket.projectedBytes = boundedAdd(bucket.projectedBytes, options.projectedBytes);
    this.recordArchivedBytes(options.sourceBytes, options.streamingBytes ?? 0);
  }
  recordArchivedBytes(sourceBytes2, streamingBytes = 0) {
    this.metrics.sourceBytesArchived = boundedAdd(this.metrics.sourceBytesArchived, sourceBytes2);
    this.metrics.streamingBytesProcessed = boundedAdd(this.metrics.streamingBytesProcessed, streamingBytes);
  }
  utilityCapsuleMaxBytes(subjectKey, status, baseline, pressureCeiling) {
    const bucket = this.utilityBucket(subjectKey);
    if (status === "failure" && bucket.usefulRecoveries >= 2) {
      return Math.min(pressureCeiling, baseline + 512);
    }
    if (status === "unknown" && bucket.archived >= 4 && bucket.recovered === 0) {
      return Math.max(512, baseline - 512);
    }
    return Math.min(baseline, pressureCeiling);
  }
  noteReadOnlyIntent(options) {
    if (options.mutatesWorkspace || !["read", "search", "status"].includes(options.intentKind)) {
      if (options.mutatesWorkspace) this.lastReadOnlyIntent = void 0;
      return 512;
    }
    const boundedSubjectKey = truncateUtf8(options.subjectKey, 1024);
    const repeated = this.lastReadOnlyIntent?.subjectKey === boundedSubjectKey && this.lastReadOnlyIntent.requirementsRevision === options.requirementsRevision && this.lastReadOnlyIntent.workspaceRevision === options.workspaceRevision;
    const bucket = this.utilityBucket(options.subjectKey);
    if (repeated) {
      bucket.repeatedReadWithoutMutation = boundedAdd(bucket.repeatedReadWithoutMutation, 1);
    }
    this.lastReadOnlyIntent = {
      subjectKey: boundedSubjectKey,
      requirementsRevision: options.requirementsRevision,
      workspaceRevision: options.workspaceRevision
    };
    return bucket.repeatedReadWithoutMutation >= 2 ? 768 : 512;
  }
  recordRecovery(options) {
    const recovered = options.recovered ?? options.useful;
    const subjects = [...new Set(options.subjectKeys?.length ? options.subjectKeys : [void 0])];
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
  recordProjection(options) {
    this.metrics.callArgumentBytesProjectedOut = boundedAdd(
      this.metrics.callArgumentBytesProjectedOut,
      options.callArgumentBytesProjectedOut ?? 0
    );
    this.metrics.resultBytesProjectedOut = boundedAdd(
      this.metrics.resultBytesProjectedOut,
      options.resultBytesProjectedOut ?? 0
    );
    this.metrics.typedMediaBytesProjectedOut = boundedAdd(
      this.metrics.typedMediaBytesProjectedOut,
      options.typedMediaBytesProjectedOut ?? 0
    );
  }
  recordProviderProjection(bytes, extendedStableGeneration) {
    if (Number.isFinite(bytes) && bytes >= 0) {
      this.metrics.currentProjectedModelViewBytes = Math.min(Number.MAX_SAFE_INTEGER, Math.floor(bytes));
    }
    if (extendedStableGeneration) {
      this.metrics.stableProjectionExtensionTurns = boundedAdd(this.metrics.stableProjectionExtensionTurns, 1);
    }
  }
  recordFoldGeneration() {
    this.metrics.foldGenerationCount = boundedAdd(this.metrics.foldGenerationCount, 1);
  }
  recordBranchRuntimeReload() {
    this.metrics.branchRuntimeReloadCount = boundedAdd(this.metrics.branchRuntimeReloadCount, 1);
  }
  recordUsage(usage) {
    this.metrics.uncachedInputTokens = boundedAdd(this.metrics.uncachedInputTokens, usage.input ?? 0);
    this.metrics.cacheReadTokens = boundedAdd(this.metrics.cacheReadTokens, usage.cacheRead ?? 0);
    this.metrics.cacheWriteTokens = boundedAdd(this.metrics.cacheWriteTokens, usage.cacheWrite ?? 0);
  }
  persistentState() {
    return {
      utility: [...this.utilityBuckets].map(([key, counters]) => ({ key, counters: { ...counters } })),
      metrics: { ...this.metrics }
    };
  }
  restorePersistentState(state) {
    const utility = /* @__PURE__ */ new Map([["*", emptyUtilityCounters()]]);
    for (const entry of state?.utility ?? []) {
      if (!entry || typeof entry.key !== "string" || utility.size >= 64) continue;
      const key = truncateUtf8(entry.key, 256);
      const counters = emptyUtilityCounters();
      for (const field of Object.keys(counters)) {
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
    for (const field of Object.keys(metrics)) {
      const value = state?.metrics?.[field];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        metrics[field] = Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value));
      }
    }
    this.metrics = metrics;
  }
  noteContextTurn(goalActive) {
    if (goalActive && this.cleanSuccessSeen) {
      this.stats.turnsAfterCleanSuccess = boundedAdd(this.stats.turnsAfterCleanSuccess, 1);
    }
  }
  contextState() {
    return {
      latestOutcome: this.latestOutcome,
      knownFailingTests: this.latestOutcome?.status === "failure" ? [...this.latestOutcome.failingTests] : [],
      cleanSuccessSeen: this.cleanSuccessSeen,
      workflow: emptyWorkflowState()
    };
  }
  statistics() {
    return {
      ...this.stats,
      utilityBucketCount: this.utilityBuckets.size,
      metrics: { ...this.metrics }
    };
  }
  resetBranchState() {
    this.recentSketches = [];
    this.recentAnalyzerTexts = [];
    this.outcomesBySubject.clear();
    this.documentsBySubject.clear();
    this.latestOutcome = null;
    this.cleanSuccessSeen = false;
    this.lastReadOnlyIntent = void 0;
  }
  reset() {
    this.resetBranchState();
    this.stats = emptyStats();
    this.utilityBuckets = /* @__PURE__ */ new Map([["*", emptyUtilityCounters()]]);
    this.metrics = emptyAggregateMetrics();
  }
};

// src/intent.ts
import { basename, isAbsolute, normalize, relative, resolve } from "path";
var SHELL_OPERATORS = /* @__PURE__ */ new Set(["&&", "||", ";", "|", "&"]);
var IDENTITY_FIELDS = ["path", "file", "files", "directory", "cwd", "query", "pattern", "glob", "url", "command", "name", "id"];
function jsonBytes(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value) ?? "", "utf8");
  } catch {
    return 0;
  }
}
function unique(values, limit = 32) {
  return [...new Set(values.filter(Boolean))].slice(0, limit);
}
function allUnique(values) {
  return unique(values, Number.POSITIVE_INFINITY);
}
function textLines(value) {
  return value.length === 0 ? 0 : value.split("\n").length;
}
function literalPath(value, cwd) {
  if (typeof value !== "string" || value.length === 0) return void 0;
  if (/[\0\n\r*?\[\]{}$`]/.test(value) || value.startsWith("~") || /\([^()]*\)$/.test(value)) return void 0;
  return normalize(isAbsolute(value) ? value : resolve(cwd, value));
}
function heredocOpeners(line) {
  const openers = [];
  let quote = null;
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
function stripHeredocBodies(command) {
  const kept = [];
  const pending = [];
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
function shellTokens(command) {
  const source = stripHeredocBodies(command);
  const tokens = [];
  let value = "";
  let quote = null;
  let quoted2 = false;
  let escaped = false;
  let escapedOffsets = [];
  let unquotedContent = false;
  const flush = () => {
    if (value.length > 0 || quoted2) tokens.push({
      value,
      quoted: quoted2,
      fullyQuoted: quoted2 && !unquotedContent,
      escaped,
      ...escapedOffsets.length > 0 ? { escapedOffsets: [...escapedOffsets] } : {}
    });
    value = "";
    quoted2 = false;
    escaped = false;
    escapedOffsets = [];
    unquotedContent = false;
  };
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote) {
        quote = null;
        quoted2 = true;
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
      quoted2 = true;
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
    if (char === "#" && value.length === 0 && !quoted2) {
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
function scopeForTarget(target) {
  if (/^(?:\.|\.\/)?(?:src|test|tests|packages?)\//.test(target) || /(?::|#|\[|\b-k\b|--filter)/.test(target)) return "focused";
  if (target && target !== "." && target !== "all") return "package";
  return "broad";
}
function hasZshQualifierSyntax(command) {
  const tokens = shellTokens(command);
  if (!tokens) return false;
  return tokens.some((token) => {
    const open = token.value.lastIndexOf("(");
    const close = token.value.length - 1;
    const escaped = new Set(token.escapedOffsets ?? []);
    return !token.fullyQuoted && open > 0 && token.value.endsWith(")") && !escaped.has(open) && !escaped.has(close);
  });
}
function hasZshDynamicGlobSyntax(command) {
  const tokens = shellTokens(command);
  if (!tokens) return false;
  const dynamic = tokens.filter((token) => !token.fullyQuoted);
  return dynamic.some((token) => token.value.startsWith("^")) || /<\d+-\d+>/.test(dynamic.map((token) => token.value).join(""));
}
function dockerBuildIdentity(values) {
  const selectors = [];
  const canonicalOption = (option) => ({
    "-c": "--context",
    "-H": "--host",
    "-l": "--log-level",
    "-f": "--file",
    "-p": "--project-name",
    "-D": "--debug"
  })[option] ?? option;
  const skipOptions = (start, withValues) => {
    let index2 = start;
    while (values[index2]?.startsWith("-")) {
      const option = values[index2];
      if (option === "--") return index2 + 1;
      const equals = option.match(/^(--[^=]+)=(.*)$/);
      const attachedShort = !equals && option.length > 2 && withValues.has(option.slice(0, 2)) ? [option.slice(0, 2), option.slice(2)] : void 0;
      const key = equals?.[1] ?? attachedShort?.[0] ?? option;
      const attachedValue = equals?.[2] ?? attachedShort?.[1];
      if (withValues.has(key) && (attachedValue !== void 0 || values[index2 + 1] !== void 0)) {
        selectors.push(`${canonicalOption(key)}=${attachedValue ?? values[index2 + 1]}`);
        index2 += attachedValue === void 0 ? 2 : 1;
      } else {
        selectors.push(canonicalOption(option));
        index2 += 1;
      }
    }
    return index2;
  };
  const globalOptions = /* @__PURE__ */ new Set([
    "--context",
    "-c",
    "--host",
    "-H",
    "--config",
    "--log-level",
    "-l",
    "--tlscacert",
    "--tlscert",
    "--tlskey"
  ]);
  let index = skipOptions(0, globalOptions);
  if (values[index] === "build") return { family: "docker-build", args: [...selectors, ...values.slice(index + 1)] };
  if (values[index] === "buildx") {
    index = skipOptions(index + 1, /* @__PURE__ */ new Set(["--builder"]));
    return values[index] === "build" ? { family: "docker-buildx-build", args: [...selectors, ...values.slice(index + 1)] } : void 0;
  }
  if (values[index] === "compose") {
    index = skipOptions(index + 1, /* @__PURE__ */ new Set([
      "-f",
      "--file",
      "-p",
      "--project-name",
      "--profile",
      "--env-file",
      "--project-directory",
      "--ansi",
      "--parallel",
      "--progress"
    ]));
    return values[index] === "build" ? { family: "docker-compose-build", args: [...selectors, ...values.slice(index + 1)] } : void 0;
  }
  return void 0;
}
function normalizedSuiteArgs(family, args) {
  let values = [...args];
  if (family.startsWith("docker-")) {
    const aliases = { "-t": "--tag", "-f": "--file", "-o": "--output", "-c": "--cpu-shares", "-H": "--host", "-D": "--debug" };
    const valueOptions = /* @__PURE__ */ new Set([
      "--tag",
      "--file",
      "--output",
      "--context",
      "--host",
      "--target",
      "--build-arg",
      "--platform",
      "--builder",
      "--cache-from",
      "--cache-to",
      "--iidfile",
      "--metadata-file",
      "--project-directory",
      "--progress",
      "--secret",
      "--ssh",
      "--env-file",
      "--add-host",
      "--memory",
      "--cpu-shares"
    ]);
    const normalized = [];
    for (let index = 0; index < values.length; index += 1) {
      const raw = values[index];
      const shortAttached = /^-[tfocH].+/.test(raw) ? [raw.slice(0, 2), raw.slice(2)] : void 0;
      const equals = raw.match(/^(--[^=]+)=(.*)$/);
      const key = aliases[equals?.[1] ?? shortAttached?.[0] ?? raw] ?? (equals?.[1] ?? shortAttached?.[0] ?? raw);
      const attached = equals?.[2] ?? shortAttached?.[1];
      if (valueOptions.has(key) && (attached !== void 0 || values[index + 1] !== void 0)) {
        normalized.push(`${key}=${attached ?? values[++index]}`);
      } else normalized.push(attached !== void 0 ? `${key}=${attached}` : key);
    }
    values = [
      ...normalized.filter((value) => value.startsWith("-")).sort(),
      ...normalized.filter((value) => !value.startsWith("-"))
    ];
  }
  if (["vitest", "jest", "mocha"].includes(family)) values = values.filter((value) => value !== "run" && value !== "--run");
  if (["pytest", "vitest", "jest"].includes(family)) {
    const optionValues = /* @__PURE__ */ new Set(["-k", "-m", "-t", "--filter", "--testNamePattern", "--config", "--dir", "--project"]);
    if (family === "pytest") optionValues.add("--color");
    const options = [];
    const paths = [];
    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];
      const equals = value.match(/^(--[^=]+)=(.*)$/);
      const key = equals?.[1] ?? value;
      if (optionValues.has(key) && (equals || values[index + 1] !== void 0)) {
        options.push(`${key}=${equals?.[2] ?? values[++index]}`);
      } else if (value.startsWith("-")) options.push(value);
      else paths.push(value);
    }
    values = [...options.sort(), ...paths];
  }
  if (/^(?:npm|pnpm|yarn|bun)-test$/.test(family) && /^(?:test|test:.+)$/.test(values[0] ?? "")) {
    values = values.slice(1);
  }
  return values.filter((arg) => arg && arg !== "--" && !/^(?:-q|-v+|--quiet|--verbose|--watch|--runInBand|--color(?:=.+)?)$/.test(arg)).map((arg) => arg.startsWith("./") ? arg.slice(2) : arg);
}
function scopedSuiteTarget(exactTarget, cwd) {
  const normalizedCwd = normalize(isAbsolute(cwd) ? cwd : resolve(cwd));
  const boundedTarget = utf8Bytes(exactTarget) <= 896 ? exactTarget : `${truncateUtf8(exactTarget, 832)} [truncated target; bytes=${utf8Bytes(exactTarget)}]`;
  return JSON.stringify({ target: boundedTarget, cwd: normalizedCwd });
}
function suite(family, args, cwd) {
  const exactTarget = normalizedSuiteArgs(family, args).join(" ") || "all";
  return { family, target: scopedSuiteTarget(exactTarget, cwd), scope: scopeForTarget(exactTarget) };
}
function suitePathResources(args, cwd, family) {
  return unique(args.filter((value) => !value.startsWith("-") && !["run", "test", "check", "build"].includes(value) && (/^(?:\.{0,2}\/|\/)/.test(value) || /[\/]/.test(value) || /\.[A-Za-z0-9]+(?::.*)?$/.test(value) || family === "pytest" && ["test", "tests"].includes(value))).map((value) => literalPath(value, cwd)).filter((value) => Boolean(value)));
}
function pythonTestScriptSuite(executable, args, cwd) {
  if (!["python", "python3"].includes(commandBase(executable)) || !args[0] || !/(?:^|[_-])(?:run[_-]?)?tests?(?:\.|[_-]|$)/i.test(basename(args[0]))) return void 0;
  return {
    family: "python-test-script",
    target: scopedSuiteTarget(literalPath(args[0], cwd) ?? args[0], cwd),
    scope: "broad"
  };
}
function commandBase(value) {
  const name = basename(value).toLowerCase();
  if (["gsed", "ggrep", "gfind", "gpatch"].includes(name)) return name.slice(1);
  return name;
}
function leadingShellInvocation(tokens, cwd) {
  let offset = 0;
  let effectiveCwd = cwd;
  if (tokens[0]?.value === "cd") {
    const pathIndex = tokens[1]?.value === "--" ? 2 : 1;
    const conjunctionIndex = pathIndex + 1;
    if (tokens[pathIndex] && tokens[conjunctionIndex]?.value === "&&") {
      const changed = literalPath(tokens[pathIndex].value, cwd);
      if (!changed) return void 0;
      effectiveCwd = changed;
      offset = conjunctionIndex + 1;
      while (tokens[offset]?.value === ";") offset += 1;
    }
  }
  while (tokens[offset] && /^[A-Za-z_][A-Za-z0-9_]*=.*/.test(tokens[offset].value)) offset += 1;
  const modifiers = /* @__PURE__ */ new Set(["command", "builtin", "exec", "time", "noglob", "nocorrect"]);
  const consumeModifiers = () => {
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
      if (value === "--") {
        offset += 1;
      }
      break;
    }
  }
  consumeModifiers();
  const pairs = [["uv", "run"], ["poetry", "run"], ["pipenv", "run"], ["pnpm", "exec"]];
  for (const [first, second] of pairs) {
    if (tokens[offset]?.value === first && tokens[offset + 1]?.value === second) {
      offset += 2;
      if (first === "uv") {
        const valueOptions = /* @__PURE__ */ new Set([
          "--project",
          "--directory",
          "--python",
          "--with",
          "--env-file",
          "--config-file",
          "--index",
          "--default-index",
          "--package",
          "--extra"
        ]);
        while (tokens[offset]?.value.startsWith("-")) {
          const option = tokens[offset].value;
          if (option === "--") {
            offset += 1;
            break;
          }
          const equals = option.match(/^(--[^=]+)=(.*)$/);
          const key = equals?.[1] ?? option;
          const optionValue = equals?.[2] ?? tokens[offset + 1]?.value;
          if (valueOptions.has(key) && optionValue !== void 0) {
            if (key === "--directory") effectiveCwd = literalPath(optionValue, effectiveCwd) ?? effectiveCwd;
            offset += equals ? 1 : 2;
          } else offset += 1;
        }
      }
    }
  }
  if (["npx", "bunx"].includes(tokens[offset]?.value ?? "")) offset += 1;
  const executableToken = tokens[offset];
  if (!executableToken) return void 0;
  return {
    executable: commandBase(executableToken.value),
    args: tokens.slice(offset + 1),
    effectiveCwd
  };
}
function hasRuntimeShellExpansion(command) {
  let quote = null;
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
function literalNestedShellBody(token) {
  return token?.fullyQuoted && !hasRuntimeShellExpansion(token.value) ? token.value : void 0;
}
function normalizedShellExecutable(tokens, cwd, depth = 0) {
  const invocation = leadingShellInvocation(tokens, cwd);
  if (!invocation) return void 0;
  const body = literalNestedShellBody(invocation.args[1]);
  if (depth === 0 && ["bash", "zsh", "sh"].includes(invocation.executable) && ["-c", "-lc"].includes(invocation.args[0]?.value ?? "") && body !== void 0) {
    const inner = shellTokens(body);
    if (inner) return normalizedShellExecutable(inner, invocation.effectiveCwd, 1) ?? invocation.executable;
  }
  return invocation.executable;
}
var OUTPUT_REDIRECTION = /^(?:\d*)(?:&>>|&>|>>|>\||>&|<>|>)$/;
var ANY_REDIRECTION = /^(?:\d*)(?:<<<|<<-|<<|&>>|&>|>>|>\||>&|<&|<>|>|<)$/;
function literalWorkspacePath(value, cwd, workspaceRoot) {
  const candidate = literalPath(value, cwd);
  if (!candidate) return void 0;
  const root = normalize(isAbsolute(workspaceRoot) ? workspaceRoot : resolve(workspaceRoot));
  const relation = relative(root, candidate);
  return relation === "" || !isAbsolute(relation) && relation !== ".." && !relation.startsWith(`..${pathSeparator()}`) ? candidate : void 0;
}
function globWorkspaceRoot(value, cwd, workspaceRoot) {
  const marker = value.search(/[?*\[]/);
  if (marker < 0) return void 0;
  const prefix = value.slice(0, marker).replace(/[^/]*$/, "") || ".";
  return quotedWorkspacePath(prefix, cwd, workspaceRoot);
}
function quotedWorkspacePath(value, cwd, workspaceRoot) {
  const candidate = normalize(isAbsolute(value) ? value : resolve(cwd, value));
  const root = normalize(isAbsolute(workspaceRoot) ? workspaceRoot : resolve(workspaceRoot));
  const relation = relative(root, candidate);
  return relation === "" || !isAbsolute(relation) && relation !== ".." && !relation.startsWith(`..${pathSeparator()}`) ? candidate : void 0;
}
function pathSeparator() {
  return process.platform === "win32" ? "\\" : "/";
}
function shellArguments(args, cwd, workspaceRoot) {
  const tokens = [];
  const outputResources = [];
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!ANY_REDIRECTION.test(token.value)) {
      tokens.push(token);
      continue;
    }
    const destination = args[index + 1];
    if (OUTPUT_REDIRECTION.test(token.value) && destination && !(token.value.endsWith(">&") && /^(?:-?\d+|-)$/.test(destination.value))) {
      const resource = literalWorkspacePath(destination.value, cwd, workspaceRoot);
      if (resource) outputResources.push(resource);
    }
    if (destination) index += 1;
  }
  return { tokens, outputResources: unique(outputResources) };
}
function withRedirections(classified, outputResources) {
  if (outputResources.length === 0) return classified;
  const standaloneMutation = classified.suite === void 0;
  return {
    ...classified,
    kind: standaloneMutation ? "run" : classified.kind,
    resources: unique([...classified.resources, ...outputResources]),
    subjectKey: standaloneMutation ? outputResources[0] : classified.subjectKey,
    mutatesWorkspace: true
  };
}
function normalizeCommandGrouping(tokens) {
  const normalized = tokens.flatMap((token) => {
    if (token.quoted || token.escaped || SHELL_OPERATORS.has(token.value)) return [token];
    const value = token.value.replace(/^[({]+/, "").replace(/[)}]+$/, "");
    return value && !["fi", "done", "esac"].includes(value) ? [{ ...token, value }] : [];
  });
  while (["then", "do", "else", "elif"].includes(normalized[0]?.value ?? "")) normalized.shift();
  return normalized;
}
function sedWriteTargets(values) {
  const scripts = [];
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
  return scripts.flatMap((script) => [...script.matchAll(/(?:^|[;\/\s])(?:[0-9,$]+)?w\s+([^;\s]+)/g)].map((match) => match[1]));
}
function hasSedInPlaceOption(values) {
  return values.some((value) => value === "-i" || value.startsWith("-i") || value === "--in-place" || value.startsWith("--in-place=") || /^-[A-Za-z]*i[A-Za-z]*$/.test(value));
}
function classifyExecutable(tokens, cwd, depth = 0, workspaceRoot = cwd) {
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
      ...args
    ], effectiveCwd, depth + 1, workspaceRoot);
  }
  const shellArgs = shellArguments(args, effectiveCwd, workspaceRoot);
  const finish = (classified) => withRedirections(classified, shellArgs.outputResources);
  const operatorIndex = args.findIndex((token) => SHELL_OPERATORS.has(token.value));
  if (operatorIndex >= 0) {
    const segments = [];
    let segment = [{ value: executable, quoted: false, fullyQuoted: false }];
    for (const token of args) {
      if (SHELL_OPERATORS.has(token.value)) {
        if (segment.length > 0) segments.push({ tokens: segment, operatorAfter: token.value });
        segment = [];
      } else {
        segment.push(token);
      }
    }
    if (segment.length > 0) segments.push({ tokens: segment });
    const mutations = [];
    let segmentCwd = effectiveCwd;
    for (let index = 0; index < segments.length; index += 1) {
      const current = segments[index];
      const classified = classifyExecutable(current.tokens, segmentCwd, depth + 1, workspaceRoot);
      if (classified.mutatesWorkspace) mutations.push(classified);
      if (current.tokens[0]?.value === "cd") {
        const pathIndex = current.tokens[1]?.value === "--" ? 2 : 1;
        if (current.tokens[pathIndex] && current.tokens.length === pathIndex + 1) {
          const changed = literalPath(current.tokens[pathIndex].value, segmentCwd);
          const guardedExit = current.operatorAfter === "||" && commandBase(segments[index + 1]?.tokens[0]?.value ?? "") === "exit";
          const conditionallyReached = index > 0 && ["&&", "||"].includes(segments[index - 1].operatorAfter ?? "");
          if (changed && !conditionallyReached && (["&&", ";", void 0].includes(current.operatorAfter) || guardedExit)) {
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
      mutatesWorkspace: true
    } : unknownShell(segmentCwd);
  }
  if (depth < 2 && ["bash", "zsh", "sh"].includes(executable) && ["-c", "-lc"].includes(shellArgs.tokens[0]?.value ?? "")) {
    const body = literalNestedShellBody(shellArgs.tokens[1]);
    if (body === void 0 || hasZshQualifierSyntax(body) || hasZshDynamicGlobSyntax(body)) {
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
  let identifiedSuite = pythonTestScriptSuite(actual, values, effectiveCwd);
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
      effectiveCwd
    });
  }
  let commandCwd = effectiveCwd;
  if (actual === "git") {
    while (values.length > 0) {
      if (values[0] === "-C") {
        const changed = values[1] ? literalPath(values[1], commandCwd) : void 0;
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
  const dockerBuild = actual === "docker" ? dockerBuildIdentity(values) : actual === "docker-compose" ? dockerBuildIdentity(["compose", ...values]) : void 0;
  if (dockerBuild) {
    const outputResources = [];
    const inputResources = [];
    const optionValues = /* @__PURE__ */ new Set([
      "-t",
      "--tag",
      "-f",
      "--file",
      "--progress",
      "-o",
      "--output",
      "--target",
      "--build-arg",
      "--platform",
      "--builder",
      "--cache-from",
      "--cache-to",
      "--secret",
      "--ssh",
      "--iidfile",
      "--metadata-file",
      "--project-directory",
      "--label",
      "--network",
      "--add-host",
      "--memory",
      "--cpu-shares",
      "-c"
    ]);
    const outputOption = (option, value) => {
      const destination = ["--iidfile", "--metadata-file"].includes(option) ? value : /(?:^|,)dest=([^,]+)/.exec(value)?.[1] ?? (!value.includes(",") && !value.includes("=") ? value : void 0);
      const localOutput = option !== "--cache-to" || /(?:^|,)type=local(?:,|$)/.test(value);
      const resource = destination && destination !== "-" && localOutput ? literalWorkspacePath(destination, effectiveCwd, workspaceRoot) : void 0;
      if (resource) outputResources.push(resource);
    };
    const positional = [];
    for (let index = 0; index < dockerBuild.args.length; index += 1) {
      const value = dockerBuild.args[index];
      const equals = value.match(/^(--[^=]+)=(.*)$/);
      const shortOutput = value.startsWith("-o=") ? ["--output", value.slice(3)] : void 0;
      const option = equals?.[1] ?? shortOutput?.[0] ?? value;
      const attached = equals?.[2] ?? shortOutput?.[1];
      if (optionValues.has(option)) {
        const optionValue = attached ?? dockerBuild.args[index + 1];
        if (optionValue !== void 0) {
          if (["-o", "--output", "--iidfile", "--metadata-file", "--cache-to"].includes(option)) {
            outputOption(option === "-o" ? "--output" : option, optionValue);
          }
          if (dockerBuild.family === "docker-compose-build" && ["-f", "--file", "--project-directory", "--env-file"].includes(option)) {
            const resource = literalWorkspacePath(optionValue, effectiveCwd, workspaceRoot);
            if (resource) inputResources.push(resource);
          }
          if (attached === void 0) index += 1;
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
    const contextResources = dockerBuild.family === "docker-compose-build" ? inputResources : positional.slice(-1).filter((value) => !/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(value) && value !== "-").map((value) => literalWorkspacePath(value, effectiveCwd, workspaceRoot)).filter((value) => Boolean(value));
    const identified = suite(dockerBuild.family, dockerBuild.args, effectiveCwd);
    const resources = unique([...contextResources, ...outputResources]);
    return finish({
      kind: "build",
      resources,
      subjectKey: `suite:${identified.family}:${identified.target}`,
      suite: identified,
      mutatesWorkspace: outputResources.length > 0,
      effectiveCwd
    });
  }
  if (packageManager && /^(?:build|typecheck|type-check)$/.test(script)) {
    return finish(validationShell("build", `${actual}-${script}`, values.slice(1), effectiveCwd));
  }
  const lint = ["eslint", "ruff", "clippy", "biome", "prettier", "black"].includes(actual) || actual === "cargo" && script === "clippy" || packageManager && /^(?:lint|format|fmt)$/.test(script);
  const lintWrites = actual === "eslint" && values.includes("--fix") || actual === "ruff" && (values.includes("--fix") || values[0] === "format" && !values.includes("--check")) || actual === "biome" && (values.includes("--write") || values.includes("--fix")) || actual === "prettier" && (values.includes("--write") || values.includes("-w")) || actual === "black" && !values.includes("--check") || packageManager && /^(?:format|fmt)$/.test(script);
  if (lint) {
    const family = actual === "cargo" ? "cargo-clippy" : packageManager ? `${actual}-${script}` : actual;
    const target = actual === "cargo" || packageManager ? values.slice(1) : values;
    const classified = validationShell("lint", family, target, effectiveCwd);
    const optionValues = /* @__PURE__ */ new Set([
      "--config",
      "--ignore-path",
      "--plugin",
      "--parser",
      "--print-width",
      "--tab-width",
      "--cache-location",
      "--output-file",
      "--log-level",
      "--end-of-line",
      "--config-precedence",
      "--embedded-language-formatting",
      "--prose-wrap",
      "--quote-props",
      "--trailing-comma",
      "--stdin-filepath",
      "--range-start",
      "--range-end"
    ]);
    const pathArgs = [];
    for (let index = 0; index < target.length; index += 1) {
      const value = target[index];
      if (optionValues.has(value)) {
        index += 1;
        continue;
      }
      if (!value.startsWith("-") && !["check", "format", "lint"].includes(value)) pathArgs.push(value);
    }
    const workspaceResources = unique(pathArgs.map(
      (value) => literalWorkspacePath(value, effectiveCwd, workspaceRoot) ?? globWorkspaceRoot(value, effectiveCwd, workspaceRoot)
    ).filter((value) => Boolean(value)));
    const hasRelativePattern = pathArgs.some((value) => !isAbsolute(value) && /[*?{}[\]]/.test(value));
    const implicitWorkspaceResource = pathArgs.length === 0 || hasRelativePattern && workspaceResources.length === 0 ? literalWorkspacePath(".", effectiveCwd, workspaceRoot) : void 0;
    const writeResources = unique([
      ...workspaceResources,
      ...implicitWorkspaceResource ? [implicitWorkspaceResource] : []
    ]);
    return finish({
      ...classified,
      resources: writeResources,
      mutatesWorkspace: lintWrites && writeResources.length > 0
    });
  }
  if (actual === "git" && script === "apply") {
    const applyArgs = values.slice(1);
    if (!applyArgs.includes("--apply") && applyArgs.some((value) => ["--check", "--stat", "--numstat", "--summary"].includes(value))) {
      return finish(statusShell("git-apply-check", applyArgs, commandCwd));
    }
    const workspace = literalWorkspacePath(".", commandCwd, workspaceRoot);
    return finish({
      kind: "edit",
      resources: workspace ? [workspace] : [],
      subjectKey: workspace ?? "command:git-apply",
      mutatesWorkspace: workspace !== void 0,
      effectiveCwd: commandCwd
    });
  }
  if (actual === "git" && ["status", "diff", "log"].includes(script)) {
    return finish(statusShell(`git-${script}`, values.slice(1), commandCwd));
  }
  if (actual === "git" && ["restore", "checkout", "clean"].includes(script)) {
    const commandArgs = values.slice(1);
    let candidates = [];
    if (script === "restore") {
      const valueOptions = /* @__PURE__ */ new Set(["--source", "-s", "--pathspec-from-file"]);
      for (let index = 0; index < commandArgs.length; index += 1) {
        const value = commandArgs[index];
        if (valueOptions.has(value)) {
          index += 1;
          continue;
        }
        if (value.startsWith("--source=") || value.startsWith("--pathspec-from-file=") || value === "--" || value.startsWith("-")) continue;
        candidates.push(value);
      }
    } else if (script === "checkout") {
      const separator = commandArgs.indexOf("--");
      candidates = separator >= 0 ? commandArgs.slice(separator + 1) : ["."];
    } else candidates = ["."];
    if (candidates.length === 0) candidates = ["."];
    const resources = unique(candidates.map(
      (value) => literalWorkspacePath(value, commandCwd, workspaceRoot) ?? globWorkspaceRoot(value, commandCwd, workspaceRoot)
    ).filter((value) => Boolean(value)));
    return finish({
      kind: "edit",
      resources,
      subjectKey: resources[0] ?? `command:git-${script}`,
      mutatesWorkspace: resources.length > 0,
      effectiveCwd: commandCwd
    });
  }
  if (["rg", "grep"].includes(actual)) return finish(searchShell(actual, values, effectiveCwd));
  const sedWrites = actual === "sed" ? sedWriteTargets(values) : [];
  if (sedWrites.length > 0 && !hasSedInPlaceOption(values)) {
    const resources = unique(sedWrites.map((value) => literalWorkspacePath(value, effectiveCwd, workspaceRoot)).filter((value) => Boolean(value)));
    return finish({
      kind: "edit",
      resources,
      subjectKey: resources[0] ?? "command:sed-write",
      mutatesWorkspace: resources.length > 0,
      effectiveCwd
    });
  }
  if (["cat", "head", "tail"].includes(actual) || actual === "sed" && !hasSedInPlaceOption(values)) {
    return finish(basicShell("read", actual, values, effectiveCwd));
  }
  if (actual === "find" && !values.includes("-delete")) return finish(searchShell(actual, values, effectiveCwd));
  const codeGeneration = packageManager && /^(?:generate|codegen|gen)(?::.+)?$/.test(script) || ["graphql-codegen", "openapi-generator", "protoc"].includes(actual) || actual === "prisma" && script === "generate";
  if (codeGeneration) {
    const generationRoot = literalWorkspacePath(".", effectiveCwd, workspaceRoot);
    return finish({
      kind: "edit",
      resources: generationRoot ? [generationRoot] : [],
      subjectKey: generationRoot ?? `command:${actual}`,
      mutatesWorkspace: generationRoot !== void 0,
      effectiveCwd
    });
  }
  const install = ["install", "add"].includes(script) && packageManager || ["pip", "pip3"].includes(actual) && script === "install";
  if (install) return finish(basicShell("install", actual, values, effectiveCwd, true));
  if (["patch", "gpatch", "apply_patch"].includes(actual) && values.includes("--dry-run")) {
    return finish(statusShell(`${actual}-dry-run`, values, effectiveCwd));
  }
  const mutating = ["rm", "mv", "cp", "mkdir", "patch", "gpatch", "apply_patch"].includes(actual) || actual === "find" && values.includes("-delete") || actual === "sed" && hasSedInPlaceOption(values) || actual === "tee" || ["prettier", "black"].includes(actual);
  if (mutating) {
    const positional = values.filter((value) => !value.startsWith("-"));
    let targets;
    if (["cp", "mv"].includes(actual)) {
      let targetDirectory;
      const operands = [];
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
        const clusteredTarget = options ? value.match(/^-([A-Za-z]*?)t(.+)$/) : void 0;
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
      const destinations = targetDirectory ? [targetDirectory] : operands.length > 1 ? [operands.at(-1)] : [];
      const sources = targetDirectory ? operands : operands.slice(0, -1);
      targets = actual === "mv" ? [...sources, ...destinations] : destinations;
    } else if (actual === "tee") {
      targets = positional;
    } else if (actual === "find") {
      const expression = positional.findIndex((value) => ["!", "(", ")"].includes(value));
      targets = expression < 0 ? positional.slice(0, 1) : positional.slice(0, expression);
    } else if (actual === "sed") {
      const looksLikeSedScript = (value) => /^(?:[0-9,$]+)?(?:s|y)(.).+\1[gpImw]*$/.test(value) || /^(?:[0-9,$]+)?[acdiqprw=]/.test(value);
      targets = [];
      let scriptSupplied = false;
      for (let index = 0; index < values.length; index += 1) {
        const value = values[index];
        if (value === "-i" || value === "--in-place") {
          const candidate = values[index + 1];
          const following = values[index + 2];
          const detachedSuffix = value === "-i" && candidate !== void 0 && candidate !== "--" && (candidate === "" || candidate.startsWith(".") || !candidate.startsWith("-") && following !== void 0 && (scriptSupplied || looksLikeSedScript(following)));
          if (detachedSuffix) index += 1;
          continue;
        }
        if (value.startsWith("-i") || value.startsWith("--in-place=") || hasSedInPlaceOption([value])) continue;
        if (["-e", "--expression", "-f", "--file"].includes(value)) {
          scriptSupplied = true;
          index += 1;
          continue;
        }
        if (value.startsWith("--expression=") || value.startsWith("--file=") || /^-[ef].+/.test(value) && value !== "-e" && value !== "-f") {
          scriptSupplied = true;
          continue;
        }
        if (value === "--") {
          const remaining = values.slice(index + 1);
          targets.push(...scriptSupplied ? remaining : remaining.slice(1));
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
      const patchDirectory = values.find((value) => value.startsWith("--directory="))?.slice(12) ?? values.find((value) => /^-d.+/.test(value) && !value.startsWith("--"))?.slice(2) ?? (directoryIndex < 0 ? effectiveCwd : values[directoryIndex + 1]);
      const outputIndex = values.findIndex((value) => value === "-o" || value === "--output");
      const output = values.find((value) => value.startsWith("--output="))?.slice(9) ?? values.find((value) => /^-o.+/.test(value) && !value.startsWith("--"))?.slice(2) ?? (outputIndex < 0 ? void 0 : values[outputIndex + 1]);
      const resolvedPatchDirectory = patchDirectory ? literalPath(patchDirectory, effectiveCwd) ?? patchDirectory : effectiveCwd;
      targets = [
        resolvedPatchDirectory,
        ...output ? [literalPath(output, resolvedPatchDirectory) ?? output] : []
      ];
    } else {
      targets = positional;
    }
    const quotedValues = new Set(shellArgs.tokens.filter((token) => token.fullyQuoted || token.escaped).map((token) => token.value));
    const resources = unique(targets.map(
      (value) => quotedValues.has(value) ? quotedWorkspacePath(value, effectiveCwd, workspaceRoot) : literalWorkspacePath(value, effectiveCwd, workspaceRoot) ?? globWorkspaceRoot(value, effectiveCwd, workspaceRoot)
    ).filter((value) => Boolean(value)));
    return finish({
      kind: "run",
      resources,
      subjectKey: resources[0] ?? `command:${actual}`,
      mutatesWorkspace: resources.length > 0,
      effectiveCwd
    });
  }
  return finish(basicShell("unknown", actual, values, effectiveCwd));
}
function unknownShell(cwd) {
  return { kind: "unknown", resources: [], subjectKey: "command:unknown", mutatesWorkspace: false, effectiveCwd: cwd };
}
function validationShell(kind, family, args, cwd, mutatesWorkspace = false) {
  const identifiedSuite = suite(family, args, cwd);
  return {
    kind,
    resources: unique(args.map((value) => literalPath(value, cwd)).filter((value) => Boolean(value))),
    subjectKey: `suite:${identifiedSuite.family}:${identifiedSuite.target}`,
    suite: identifiedSuite,
    mutatesWorkspace,
    effectiveCwd: cwd
  };
}
function commandSubject(family, args) {
  return `command:${family}:${JSON.stringify(args)}`;
}
function searchShell(family, args, cwd) {
  let queryTokens;
  let rootTokens;
  const semanticModifiers = [];
  if (family === "find") {
    const expressionIndex = args.findIndex((arg) => arg.startsWith("-") || ["!", "(", ")"].includes(arg));
    rootTokens = [...expressionIndex < 0 ? args : args.slice(0, expressionIndex)];
    queryTokens = expressionIndex < 0 ? [] : args.slice(expressionIndex);
  } else {
    const explicitQueries = [];
    const positional = [];
    const optionsWithValues = /* @__PURE__ */ new Set([
      "-A",
      "-B",
      "-C",
      "-f",
      "-g",
      "-m",
      "-t",
      "--after-context",
      "--before-context",
      "--context",
      "--encoding",
      "--engine",
      "--file",
      "--glob",
      "--iglob",
      "--ignore-file",
      "--max-count",
      "--regexp",
      "--sort",
      "--sortr",
      "--type",
      "--type-add",
      "--type-not"
    ]);
    let options = true;
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      if (options && arg === "--") {
        options = false;
        continue;
      }
      if (options && ["-e", "--regexp"].includes(arg)) {
        if (args[index + 1] !== void 0) explicitQueries.push(args[index + 1]);
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
        if (args[index + 1] !== void 0) semanticModifiers.push(`${arg}=${args[index + 1]}`);
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
    subjectKey: `search:${JSON.stringify({
      family,
      query: queryTokens,
      roots: normalizedRoots,
      modifiers: [...semanticModifiers].sort()
    })}`,
    mutatesWorkspace: false,
    effectiveCwd: cwd
  };
}
function statusShell(family, args, cwd) {
  const separator = args.indexOf("--");
  const targetArgs = separator >= 0 ? args.slice(separator + 1) : [];
  return {
    kind: "status",
    resources: unique(targetArgs.map((value) => literalPath(value, cwd)).filter((value) => Boolean(value))),
    subjectKey: `command:${JSON.stringify({ family, args, cwd })}`,
    mutatesWorkspace: false,
    effectiveCwd: cwd
  };
}
function readResourceArguments(family, args) {
  const resources = [];
  const optionsWithValues = /* @__PURE__ */ new Set([
    "-c",
    "--bytes",
    "-n",
    "--lines",
    "--pid",
    "-s",
    "--sleep-interval"
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
function basicShell(kind, family, args, cwd, mutatesWorkspace = false) {
  const resourceBearing = ["read", "build", "lint"].includes(kind);
  const resourceArgs = kind === "read" ? readResourceArguments(family, args) : args;
  const resources = resourceBearing ? unique(resourceArgs.map((value) => literalPath(value, cwd)).filter((value) => Boolean(value))) : [];
  return {
    kind,
    resources,
    subjectKey: kind === "read" && resources[0] ? resources[0] : commandSubject(family, args),
    mutatesWorkspace,
    effectiveCwd: cwd
  };
}
function classifyShell(command, cwd) {
  let source = command.trim();
  const leadingSubshell = source.match(/^\(([\s\S]*)\)\s*;\s*([\s\S]+)$/);
  if (leadingSubshell) {
    const left = classifyShell(leadingSubshell[1], cwd);
    const right = classifyShell(leadingSubshell[2], cwd);
    const resources = unique([...left.mutatesWorkspace ? left.resources : [], ...right.mutatesWorkspace ? right.resources : []]);
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
  const classified = shellSpecificPathSyntax || /[`]|\$\(|<\(|>\(/.test(source) || /^\s*(?:eval|source|\.)\s/.test(source) ? unknownShell(cwd) : classifyExecutable(tokens, cwd);
  return normalizedExecutable ? { ...classified, normalizedExecutable } : classified;
}
function withoutPythonStringsAndComments(code) {
  return code.replace(/'''[\s\S]*?'''|"""[\s\S]*?"""/g, " ").replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, " ").replace(/#.*$/gm, " ");
}
function maskPythonStringsAndComments(code) {
  let masked = "";
  let index = 0;
  let state = "code";
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
        const triple2 = code.slice(index, index + 3) === char.repeat(3);
        masked += " ".repeat(triple2 ? 3 : 1);
        state = triple2 ? char === "'" ? "triple-single" : "triple-double" : char === "'" ? "single" : "double";
        index += triple2 ? 3 : 1;
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
function matchingPythonDelimiter(masked, start) {
  const opening = masked[start];
  const closing = opening === "[" ? "]" : opening === "(" ? ")" : void 0;
  if (!closing) return void 0;
  let depth = 0;
  for (let index = start; index < masked.length; index += 1) {
    if (masked[index] === opening) depth += 1;
    else if (masked[index] === closing) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return void 0;
}
function pythonStringLiterals(value) {
  const literals = [...value.matchAll(/(["'])((?:\\.|(?!\1).)*)\1/g)];
  if (literals.length === 0) return void 0;
  let cursor = 0;
  for (let index = 0; index < literals.length; index += 1) {
    const separator = value.slice(cursor, literals[index].index).trim();
    if (index === 0 && separator !== "" || index > 0 && separator !== ",") return void 0;
    cursor = (literals[index].index ?? 0) + literals[index][0].length;
  }
  if (!/^(?:,\s*)?$/.test(value.slice(cursor))) return void 0;
  return literals.map((match) => match[2].replace(/\\([\\"'])/g, "$1").replace(/\\n/g, "\n").replace(/\\t/g, "	"));
}
function pythonSubprocessArgv(value) {
  const literals = pythonStringLiterals(value);
  if (literals) return literals;
  const pathValue = /^\s*(["'])(python3?)\1\s*,\s*str\(\s*[A-Za-z_][A-Za-z0-9_]*\s*\/\s*(["'])([^"']+)\3\s*\)\s*,?\s*$/.exec(value);
  return pathValue ? [pathValue[2], pathValue[4]] : void 0;
}
function ipythonSubprocessValidation(code, cwd) {
  const masked = maskPythonStringsAndComments(code);
  const call = /^\s*(?:[A-Za-z_][A-Za-z0-9_]*\s*=\s*)?subprocess\.(?:run|check_call|check_output)\s*\(\s*[\[(]/gm;
  for (const match of masked.matchAll(call)) {
    const start = (match.index ?? 0) + match[0].length - 1;
    const end = matchingPythonDelimiter(masked, start);
    if (end === void 0) continue;
    const argv = pythonSubprocessArgv(code.slice(start + 1, end));
    if (!argv || argv.length === 0) continue;
    const classified = classifyExecutable(argv.map((value) => ({ value, quoted: true, fullyQuoted: true })), cwd);
    if (classified.suite && ["test", "build", "lint"].includes(classified.kind)) return classified;
  }
  return void 0;
}
function ipythonShellMagicValidation(code, cwd) {
  const magic = /^\s*%%(?:bash|sh|zsh)(?:[^\r\n]*)?\r?\n([\s\S]*)$/.exec(code);
  if (!magic) return void 0;
  let effectiveCwd = cwd;
  for (const line of stripHeredocBodies(magic[1]).split(/\r?\n/)) {
    const tokens = shellTokens(line);
    if (!tokens || tokens.length === 0) continue;
    if (tokens[0].value === "cd" && tokens.length === 2) {
      effectiveCwd = literalPath(tokens[1].value, effectiveCwd) ?? effectiveCwd;
      continue;
    }
    const classified = classifyShell(line, effectiveCwd);
    if (classified.suite && ["test", "build", "lint"].includes(classified.kind)) return classified;
  }
  return void 0;
}
function customResources(input, cwd, toolSchema) {
  const values = [];
  const visit = (value, schema, depth) => {
    if (!value || typeof value !== "object" || Array.isArray(value) || depth > 4) return;
    const object = value;
    const schemaObject = schema && typeof schema === "object" ? schema : void 0;
    const properties = schemaObject?.properties && typeof schemaObject.properties === "object" ? schemaObject.properties : void 0;
    const fields = depth === 0 ? unique([...IDENTITY_FIELDS, ...Object.keys(properties ?? {}).sort()], Number.POSITIVE_INFINITY) : Object.keys(properties ?? {}).sort();
    for (const field of fields) {
      if (!(field in object)) continue;
      const fieldValue = object[field];
      if (IDENTITY_FIELDS.includes(field)) {
        const entries = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
        for (const entry of entries) {
          if (typeof entry !== "string") continue;
          const path = ["path", "file", "files", "directory", "cwd"].includes(field) ? literalPath(entry, cwd) : void 0;
          values.push(path ?? `${field}:${entry}`);
        }
      }
      const childSchema = properties?.[field];
      const schemaType = childSchema && typeof childSchema === "object" ? childSchema.type : void 0;
      const lowRiskScalar = !IDENTITY_FIELDS.includes(field) && !/(?:secret|token|password|credential|authorization|api[_-]?key|code|content|body|data)/i.test(field) && ["string", "number", "integer", "boolean"].includes(String(schemaType)) && (typeof fieldValue === "number" || typeof fieldValue === "boolean" || typeof fieldValue === "string" && utf8Bytes(fieldValue) <= 256);
      if (lowRiskScalar) values.push(`${field}:${String(fieldValue)}`);
      if (Array.isArray(fieldValue)) {
        const itemSchema = childSchema && typeof childSchema === "object" ? childSchema.items : void 0;
        for (const item of fieldValue) visit(item, itemSchema, depth + 1);
      } else {
        visit(fieldValue, childSchema, depth + 1);
      }
    }
  };
  visit(input, toolSchema, 0);
  return unique(values);
}
function ipythonWriteResources(code, cwd) {
  const resources = [];
  const literalPathWrite = /(?:pathlib\s*\.\s*)?Path\(\s*(["'])([^"']+)\1\s*\)\s*\.\s*write_(?:text|bytes)\s*\(/g;
  for (const match of code.matchAll(literalPathWrite)) {
    const path = literalPath(match[2], cwd);
    if (path) resources.push(path);
  }
  return unique(resources);
}
function ipythonDiffResources(details, cwd) {
  if (!details || typeof details !== "object") return [];
  const diffs = details.diffs;
  if (!Array.isArray(diffs)) return [];
  return unique(diffs.flatMap((diff) => {
    if (!diff || typeof diff !== "object") return [];
    const object = diff;
    const path = literalPath(object.path ?? object.file, cwd);
    return path ? [path] : [];
  }));
}
function adaptToolIntent(options) {
  const { exchangeId, toolCallId, toolName, input, cwd, modelInputBytes, toolSchema, details, resultText, isError } = options;
  const base = {
    exchangeId,
    toolCallId,
    toolName,
    modelInputBytes,
    executedInputBytes: jsonBytes(input),
    effectiveCwd: cwd
  };
  if (toolName === "edit") {
    const resource = literalPath(input.path, cwd);
    const edits = Array.isArray(input.edits) ? input.edits.filter((edit) => Boolean(edit) && typeof edit === "object") : [];
    const oldTexts = edits.map((edit) => typeof edit.oldText === "string" ? edit.oldText : "");
    const newTexts = edits.map((edit) => typeof edit.newText === "string" ? edit.newText : "");
    const detailObject = details && typeof details === "object" ? details : {};
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
        diffBytes: typeof detailObject.diff === "string" ? Buffer.byteLength(detailObject.diff, "utf8") : void 0,
        firstChangedLine: typeof detailObject.firstChangedLine === "number" ? detailObject.firstChangedLine : void 0
      }
    };
  }
  if (toolName === "bash") {
    const command = typeof input.command === "string" ? input.command : "";
    const { normalizedExecutable, ...classified } = classifyShell(command, cwd);
    const detailObject = details && typeof details === "object" ? details : {};
    const truncation = detailObject.truncation && typeof detailObject.truncation === "object" ? detailObject.truncation : void 0;
    const facts = {
      ...normalizedExecutable ? { normalizedExecutable } : {},
      ...truncation?.truncated === true ? {
        truncation: typeof truncation.truncatedBy === "string" ? truncation.truncatedBy : "yes"
      } : {},
      ...typeof truncation?.totalBytes === "number" ? { sourceBytes: truncation.totalBytes } : {},
      ...typeof truncation?.outputBytes === "number" ? { visibleBytes: truncation.outputBytes } : {}
    };
    return {
      ...base,
      ...classified,
      command,
      ...Object.keys(facts).length > 0 ? { facts } : {}
    };
  }
  if (toolName === "ipython") {
    const code = typeof input.code === "string" ? input.code : "";
    const executable = withoutPythonStringsAndComments(code);
    const detailObject = details && typeof details === "object" ? details : {};
    const mutationResources2 = unique([
      ...ipythonDiffResources(details, cwd),
      ...ipythonWriteResources(code, cwd)
    ]);
    const directFileMutation = /\.(?:write_text|write_bytes)\s*\(/.test(executable);
    const sentAgentMessages = Array.isArray(detailObject.sentAgentMessages) ? detailObject.sentAgentMessages.length : 0;
    const delegates = sentAgentMessages > 0 || /\b(?:await\s+)?rlm\s*\(/.test(executable);
    const directTests = /\bpytest\.main\s*\(|\bunittest\.(?:main|TextTestRunner)\s*\(/.test(executable);
    const executableValidation = ipythonSubprocessValidation(code, cwd) ?? ipythonShellMagicValidation(code, cwd);
    const identifiedSuite2 = executableValidation?.suite ?? (directTests ? suite(/pytest/.test(executable) ? "pytest" : "unittest", [], cwd) : void 0);
    const resources2 = unique([...mutationResources2, ...executableValidation?.resources ?? []]);
    return {
      ...base,
      kind: delegates ? "delegate" : identifiedSuite2 ? executableValidation?.kind ?? "test" : "run",
      resources: resources2,
      subjectKey: identifiedSuite2 ? `suite:${identifiedSuite2.family}:${identifiedSuite2.target}` : resources2[0] ?? "ipython:run",
      suite: identifiedSuite2,
      mutatesWorkspace: mutationResources2.length > 0 || directFileMutation,
      facts: {
        ...typeof detailObject.status === "string" ? { kernelStatus: detailObject.status } : {},
        ...typeof detailObject.durationMs === "number" ? { durationMs: detailObject.durationMs } : {},
        ...detailObject.kernelRestarted === true ? { kernelRestarted: "true" } : {},
        ...sentAgentMessages > 0 ? { sentAgentMessages } : {}
      }
    };
  }
  if (toolName === "prime_context") {
    const action = typeof input.action === "string" ? input.action : "unknown";
    const resources2 = customResources(input, cwd, toolSchema);
    const kind = ["search", "recall"].includes(action) ? "search" : "read";
    return { ...base, kind, resources: resources2, subjectKey: `prime_context:${action}:${resources2[0] ?? "current"}`, mutatesWorkspace: false };
  }
  const resources = customResources(input, cwd, toolSchema);
  const mutationName = /(?:^|[_-])(write|edit|patch|delete|rename|move)(?:$|[_-])/i.test(toolName);
  const testName = /(?:^|[_-])(?:test|tests)(?:$|[_-])/i.test(toolName);
  const parsed = resultText === void 0 ? void 0 : analyzeOutcome(resultText, isError);
  const identifiedSuite = testName && parsed?.testTotal !== null ? suite(`custom:${toolName}`, [], cwd) : void 0;
  return {
    ...base,
    kind: identifiedSuite ? "test" : mutationName ? "edit" : "unknown",
    resources,
    subjectKey: identifiedSuite ? `suite:${identifiedSuite.family}:${identifiedSuite.target}` : mutationName && resources[0] ? resources[0] : resources.length > 0 ? `tool:${toolName}:${truncateUtf8(JSON.stringify(resources), 1024)}` : `tool:${toolName}`,
    suite: identifiedSuite,
    mutatesWorkspace: mutationName
  };
}
function classifyValidationCommand(command, cwd) {
  const intent = adaptToolIntent({
    exchangeId: "classification",
    toolCallId: "classification",
    toolName: "bash",
    input: { command },
    cwd,
    modelInputBytes: Buffer.byteLength(JSON.stringify({ command }), "utf8")
  });
  if (!intent.suite || !["test", "build", "lint"].includes(intent.kind)) return void 0;
  return {
    kind: intent.kind,
    command,
    suite: { ...intent.suite },
    subjectKey: intent.subjectKey,
    resources: [...intent.resources]
  };
}
function strings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function outcomeLines2(text) {
  return text.split(/\r?\n/).map((line) => line.replaceAll(/\x1b\[[0-?]*[ -/]*[@-~]/g, ""));
}
function outcomeSummary(value) {
  return value.trim().replace(/^=+\s*/, "").replace(/\s*=+$/, "").replaceAll(/\s+/g, " ").toUpperCase();
}
function countBefore(label, value) {
  const match = new RegExp(`(\\d+)\\s+${label}`, "i").exec(value);
  return match ? Number(match[1]) : 0;
}
function directOutcomeFacts(intent, text) {
  const family = intent.suite?.family;
  if (!family) return void 0;
  const lines = outcomeLines2(text);
  if (["pytest", "unittest"].includes(family)) {
    const pytestSummary = [...lines].reverse().find(
      (line) => /(?:^|\s)\d+\s+(?:passed|failed)(?:\s*,|\s+in\s+|\s*$)/i.test(line.replace(/^=+\s*/, "").replace(/\s*=+$/, ""))
    );
    const ran = [...lines].reverse().map((line) => /^\s*Ran\s+(\d+)\s+tests?/i.exec(line)).find(Boolean);
    const unittestResult = [...lines].reverse().find((line) => /^\s*(?:OK|FAILED\s*\([^)]*\))\s*$/i.test(line));
    const failingTests = allUnique(lines.flatMap((line) => {
      const pytest = family === "pytest" ? /^\s*FAILED\s+(.+?)(?:\s+-\s+|$)/i.exec(line) : null;
      if (pytest) return [pytest[1].trim()];
      const unittest = /^\s*(?:FAIL|ERROR):\s+(.+?)(?:\s+\(|$)/i.exec(line);
      return unittest ? [unittest[1].trim()] : [];
    }));
    const summary = pytestSummary ?? unittestResult ?? (ran ? ran[0] : void 0);
    const passed = pytestSummary ? countBefore("passed", pytestSummary) : 0;
    const failed = pytestSummary ? countBefore("failed", pytestSummary) : 0;
    const terminalFailure = Boolean(unittestResult && /^\s*FAILED/i.test(unittestResult));
    const terminalSuccess = Boolean(unittestResult && /^\s*OK\s*$/i.test(unittestResult));
    return {
      status: failed > 0 || terminalFailure || failingTests.length > 0 ? "failure" : passed > 0 || terminalSuccess ? "success" : void 0,
      testSummary: summary ? outcomeSummary(summary) : void 0,
      testTotal: ran ? Number(ran[1]) : pytestSummary ? passed + failed : void 0,
      failingTests
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
      const match = family === "vitest" ? /^\s*FAIL\s+(.+?)(?:\s+\[|$)/i.exec(line) : /^\s*FAIL\s+(\S+)/i.exec(line);
      const jestCase = family === "jest" ? /^\s*●\s+(.+)/.exec(line) : null;
      return match ? [match[1].trim()] : jestCase ? [jestCase[1].trim()] : [];
    }));
    return {
      status: failed > 0 || failingTests.length > 0 ? "failure" : passed > 0 ? "success" : void 0,
      testSummary: summary ? outcomeSummary(summary) : void 0,
      testTotal: totalMatch ? Number(totalMatch[1]) : passed + failed || void 0,
      failingTests
    };
  }
  if (family === "tsc") {
    const errors = lines.filter((line) => /\berror\s+TS\d+\s*:/i.test(line));
    const found = [...lines].reverse().map((line) => /Found\s+(\d+)\s+errors?/i.exec(line)).find(Boolean);
    const sourceLocations = unique(errors.flatMap((line) => {
      const match = /([^\s:][^()\n]*\.(?:ts|tsx))\((\d+),\d+\)/i.exec(line) ?? /([^\s:][^:\n]*\.(?:ts|tsx)):(\d+):\d+/i.exec(line);
      return match ? [`${match[1]}:${match[2]}`] : [];
    }));
    return {
      status: errors.length > 0 || found && Number(found[1]) > 0 ? "failure" : found ? "success" : void 0,
      sourceLocations,
      commandFailures: unique(errors.map((line) => line.trim()), 8)
    };
  }
  if (family === "eslint") {
    const problemSummary = [...lines].reverse().find((line) => /\b\d+\s+problems?\s*\([^)]*\b\d+\s+errors?/i.test(line));
    const errors = problemSummary ? countBefore("errors?", problemSummary) : 0;
    const sourceLocations = [];
    const commandFailures = [];
    let currentFile;
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
      status: errors > 0 || commandFailures.length > 0 ? "failure" : problemSummary ? "success" : void 0,
      sourceLocations: unique(sourceLocations),
      commandFailures: unique(commandFailures, 8)
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
      status: failed > 0 || failedTests.length > 0 || errors.length > 0 ? "failure" : testSummary || family === "cargo-check" && finished ? "success" : void 0,
      testSummary: testSummary ? outcomeSummary(testSummary) : void 0,
      testTotal: testSummary ? passed + failed : void 0,
      failingTests: failedTests,
      sourceLocations,
      commandFailures: unique(errors.map((line) => line.trim()), 8)
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
      status: packageFailure || failingTests.length > 0 ? "failure" : packageSuccess ? "success" : void 0,
      testSummary: cases.length > 0 ? outcomeSummary(`${cases.length} tests, ${failingTests.length} failed`) : void 0,
      testTotal: cases.length || void 0,
      failingTests,
      sourceLocations
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
    const failures = mavenSummary ? Number(mavenFailures?.[1] ?? 0) + Number(mavenErrors?.[1] ?? 0) : gradleSummary ? countBefore("failed", gradleSummary) : 0;
    const buildFailure = lines.some((line) => /\bBUILD (?:FAILURE|FAILED)\b/i.test(line));
    const buildSuccess = lines.some((line) => /\bBUILD SUCCESS(?:FUL)?\b/i.test(line));
    const failingTests = allUnique(lines.flatMap((line) => {
      const gradle = family === "gradle-test" ? /^\s*(.+?)\s+>\s+(.+?)\s+FAILED\s*$/i.exec(line) : null;
      if (gradle) return [`${gradle[1].trim()} > ${gradle[2].trim()}`];
      const maven = family === "maven-test" ? /^\s*(?:\[ERROR\]\s*)?(?!Tests run:)(\S+)\s+--.+<<<\s+(?:FAILURE|ERROR)!/i.exec(line) : null;
      return maven ? [maven[1]] : [];
    }));
    return {
      status: failures > 0 || buildFailure || failingTests.length > 0 ? "failure" : buildSuccess || Boolean(summary) ? "success" : void 0,
      testSummary: summary ? outcomeSummary(summary) : void 0,
      testTotal: mavenTotal || gradleTotal ? Number((mavenTotal ?? gradleTotal)?.[1]) : void 0,
      failingTests,
      commandFailures: buildFailure ? unique(lines.filter((line) => /\bBUILD (?:FAILURE|FAILED)\b/i.test(line)).map((line) => line.trim())) : []
    };
  }
  return void 0;
}
function typedExitFacts(object) {
  const codes = unique([object.exitCode, object.code, object.status].flatMap((value) => {
    if (typeof value === "number" && Number.isFinite(value)) return [String(value)];
    if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return [String(Number(value))];
    return [];
  })).map(Number);
  return { statuses: codes.map((code) => `exit ${code}`), codes };
}
function recomputeOutcomeSignature(outcome) {
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
    outcome.testSummary ?? ""
  ].join(";");
}
function collectFactualOutcome(intent, text, isError, details) {
  const parsed = analyzeOutcome(text, isError);
  const direct = directOutcomeFacts(intent, text);
  const object = details && typeof details === "object" ? details : {};
  const typedError = object.error && typeof object.error === "object" ? object.error : void 0;
  const exceptions = unique([
    ...parsed.exceptions,
    ...typeof object.errorEname === "string" ? [object.errorEname] : [],
    ...typeof typedError?.ename === "string" ? [`${typedError.ename}${typeof typedError.evalue === "string" ? `: ${typedError.evalue}` : ""}`] : []
  ], 12);
  const sourceLocations = unique([
    ...parsed.sourceLocations,
    ...direct?.sourceLocations ?? [],
    ...strings(object.diffs).slice(0, 8)
  ]);
  const exit = typedExitFacts(object);
  const exitStatuses = unique([...parsed.exitStatuses, ...exit.statuses], 8);
  const commandFailures = unique([...parsed.commandFailures, ...direct?.commandFailures ?? []], 8);
  const directFailureIdFamilies = /* @__PURE__ */ new Set(["pytest", "unittest", "jest", "vitest", "go-test"]);
  const genericFailingTests = directFailureIdFamilies.has(intent.suite?.family ?? "") ? [] : parsed.failingTests;
  const failingTests = intent.suite ? unique([...genericFailingTests, ...direct?.failingTests ?? []], Number.POSITIVE_INFINITY) : [];
  const statusValue = typeof object.status === "string" ? object.status.toLowerCase() : void 0;
  const typedFailure = ["error", "failed", "failure"].includes(statusValue ?? "") || Boolean(typedError) || exit.codes.some((code) => code !== 0);
  const typedSuccess = ["ok", "success"].includes(statusValue ?? "") || ["test", "build", "lint", "edit"].includes(intent.kind) && exit.codes.length > 0 && exit.codes.every((code) => code === 0);
  const fallbackFailure = direct?.status === void 0 && parsed.status === "failure";
  const factualFailure = isError || typedFailure || direct?.status === "failure" || fallbackFailure;
  const quietBashValidation = intent.toolName === "bash" && intent.suite !== void 0 && ["test", "build", "lint"].includes(intent.kind) && !isError;
  const recognizedSuccess = !factualFailure && (direct?.status === "success" || typedSuccess || parsed.status === "success" || quietBashValidation);
  const withoutSignature = {
    status: factualFailure ? "failure" : recognizedSuccess ? "success" : "unknown",
    testSummary: intent.suite ? direct?.testSummary ?? parsed.testSummary : null,
    testTotal: intent.suite ? direct?.testTotal ?? parsed.testTotal : null,
    failingTests,
    exceptions,
    sourceLocations,
    exitStatuses,
    commandFailures
  };
  return { ...withoutSignature, signature: recomputeOutcomeSignature(withoutSignature) };
}

// src/runtime.ts
var TASK_RUNTIME_SCHEMA = "prime-context.runtime/v2";
var TASK_RUNTIME_BOUNDS = Object.freeze({
  validationGates: 8,
  validations: 16,
  activeDiagnostics: 12,
  modifiedResources: 32,
  recentSubjects: 32,
  recentIntentKeys: 16,
  steeringResources: 32,
  steeringResourcePathBytes: 1024,
  steeringResourcesBytes: 8192,
  foldRetainedEntryIds: 256,
  foldRenderedBytes: 4096,
  steeringDeltaBytes: 8192,
  suiteFamilyBytes: 128,
  suiteTargetBytes: 1024,
  identityBytes: 1024,
  summaryBytes: 2048,
  resourcePathBytes: 1024
});
function record(value) {
  return value && typeof value === "object" ? value : void 0;
}
function messageRole(entry) {
  return record(entry.message)?.role;
}
function entryId(entry, index) {
  return entry.id ?? entry.entryId ?? `user:${index}`;
}
function isCompletedAssistant(entry) {
  const message = record(entry.message);
  return entry.type === "message" && message?.role === "assistant" && message.stopReason === "stop";
}
function deriveTaskSelection(branch, activeGoal) {
  if (activeGoal?.goalId && activeGoal.status !== "completed" && activeGoal.status !== "cancelled") {
    return {
      taskKey: activeGoal.goalId,
      goalId: activeGoal.goalId,
      ...activeGoal.objective === void 0 ? {} : { objective: activeGoal.objective },
      source: "goal"
    };
  }
  let rootIndex = branch.findIndex((entry) => entry.type === "message" && messageRole(entry) === "user");
  if (rootIndex < 0) return void 0;
  for (let index = 0; index < branch.length; index += 1) {
    if (!isCompletedAssistant(branch[index])) continue;
    const nextUser = branch.findIndex((entry, candidate) => candidate > index && entry.type === "message" && messageRole(entry) === "user");
    if (nextUser >= 0) rootIndex = nextUser;
  }
  const rootUserEntryId = entryId(branch[rootIndex], rootIndex);
  return {
    taskKey: rootUserEntryId,
    rootUserEntryId,
    source: "user"
  };
}
function createTaskRuntime(selection) {
  return {
    schema: TASK_RUNTIME_SCHEMA,
    taskKey: selection.taskKey,
    ...selection.goalId === void 0 ? {} : { goalId: selection.goalId },
    ...selection.objective === void 0 ? {} : { objective: selection.objective },
    objectiveVersion: selection.objective === void 0 ? 0 : 1,
    requirementsRevision: 0,
    requirementsLocked: false,
    workspaceRevision: 0,
    turnSequence: 0,
    validationGates: [],
    validations: [],
    activeDiagnostics: [],
    modifiedResources: [],
    recentSubjects: [],
    recentIntentKeys: [],
    steeringDeltas: [],
    steeringResources: []
  };
}
function suiteGateKey(suite2) {
  return `suite:${suite2.family}:${suite2.target}`;
}
function isSuiteIdentity(value) {
  return "family" in value && "scope" in value;
}
function normalizeGate(candidate) {
  if (isSuiteIdentity(candidate)) {
    if (!candidate.family || !candidate.target) return void 0;
    return {
      key: suiteGateKey(candidate),
      suiteFamily: candidate.family,
      target: candidate.target,
      source: "explicit-user-command"
    };
  }
  if (!candidate.key) return void 0;
  return {
    key: candidate.key,
    ...candidate.suiteFamily === void 0 ? {} : { suiteFamily: candidate.suiteFamily },
    ...candidate.target === void 0 ? {} : { target: candidate.target },
    source: "explicit-user-command"
  };
}
function sameGate(left, right) {
  return left.key === right.key && left.suiteFamily === right.suiteFamily && left.target === right.target && left.source === right.source;
}
function normalizedExplicitGates(candidates) {
  const gates = [];
  for (const candidate of candidates) {
    const gate = normalizeGate(candidate);
    if (!gate || gates.some((current) => current.key === gate.key)) continue;
    gates.push(gate);
  }
  return gates.slice(0, TASK_RUNTIME_BOUNDS.validationGates);
}
function equalGates(left, right) {
  return left.length === right.length && left.every((gate, index) => sameGate(gate, right[index]));
}
function isRequirementsLockDeclaration(text) {
  return /^\s*REQUIREMENTS LOCKED(?:[.!:]|$)/i.test(text);
}
function isMaterialSteering(text) {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return false;
  if (isRequirementsLockDeclaration(normalized)) return true;
  if (/^(?:ok(?:ay)?|thanks?|thank you|got it|sounds good|great|yes|no)[.!]*$/i.test(normalized)) return false;
  if (/^(?:continue|proceed|go on|keep going|resume)[.!]*$/i.test(normalized)) return false;
  if (/^(?:status|status update|any update|what(?:'s| is) the status|how is it going)\??$/i.test(normalized)) return false;
  if (/^(?:no (?:change|changes) to (?:the )?requirements|requirements (?:are )?unchanged|same requirements)[.!]*$/i.test(normalized)) return false;
  const question = /^(?:what|which|how|where|when|why|is|are|do|does|did|can|could|would|will)\b.*\?$/i.test(normalized);
  const contractChange = /\b(?:add|change|remove|drop|replace|implement|support|preserve|reject|require|required|must|only|protect|acceptance|constraint|API|path|file)\b/i.test(normalized);
  if (question && !contractChange) return false;
  return true;
}
function normalizeSteeringPath(value) {
  const trimmed = value.trim().replace(/^[`'"(<]+|[`'">),;:.]+$/g, "").replace(/:\d+(?::\d+)?$/, "");
  if (!trimmed || /^(?:https?|file):\/\//i.test(trimmed) || /\s/.test(trimmed)) return void 0;
  const pathLike = trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../") || trimmed.includes("/") || /(?:^|\.)[A-Za-z0-9_-]+\.[A-Za-z0-9*?_-]+$/.test(trimmed) || /^(?:README|Dockerfile|Makefile|LICENSE)(?:\.[A-Za-z0-9_-]+)?$/i.test(trimmed);
  if (!pathLike || !/[A-Za-z0-9*?]/.test(trimmed)) return void 0;
  const normalized = trimmed.startsWith("./") ? trimmed.slice(2) : trimmed;
  return Buffer.byteLength(normalized, "utf8") <= TASK_RUNTIME_BOUNDS.steeringResourcePathBytes ? normalized : void 0;
}
function explicitSteeringPaths(text) {
  const candidates = [
    ...[...text.matchAll(/[`'"]([^`'"\n]+)[`'"]/g)].map((match) => match[1]),
    ...text.split(/\s+/)
  ];
  const paths = [];
  for (const candidate of candidates) {
    const normalized = normalizeSteeringPath(candidate);
    if (!normalized || paths.includes(normalized)) continue;
    paths.push(normalized);
  }
  return paths;
}
function cloneSuite(suite2) {
  return { family: suite2.family, target: suite2.target, scope: suite2.scope };
}
function cloneTaskRuntime(runtime) {
  return {
    ...runtime,
    validationGates: runtime.validationGates.map((gate) => ({ ...gate })),
    validations: runtime.validations.map((validation) => ({ ...validation, suite: cloneSuite(validation.suite) })),
    activeDiagnostics: runtime.activeDiagnostics.map((diagnostic) => ({
      ...diagnostic,
      resources: [...diagnostic.resources ?? []]
    })),
    modifiedResources: runtime.modifiedResources.map((resource) => ({ ...resource })),
    recentSubjects: runtime.recentSubjects.map((subject) => ({ ...subject, resources: [...subject.resources] })),
    recentIntentKeys: [...runtime.recentIntentKeys],
    steeringDeltas: [...runtime.steeringDeltas],
    steeringResources: (runtime.steeringResources ?? []).map((resource) => ({ ...resource })),
    ...runtime.fold === void 0 ? {} : {
      fold: {
        ...runtime.fold,
        retainedEntryIds: [...runtime.fold.retainedEntryIds]
      }
    }
  };
}
function boundedSteering(deltas, budgetBytes) {
  const budget = Math.max(0, Math.floor(budgetBytes));
  const kept = [];
  let bytes = 0;
  for (let index = deltas.length - 1; index >= 0; index -= 1) {
    const delta = deltas[index];
    const size = Buffer.byteLength(delta, "utf8");
    if (size > budget || bytes + size > budget) continue;
    kept.push(delta);
    bytes += size;
  }
  return kept.reverse();
}
function boundedSteeringResources(resources, budgetBytes) {
  const budget = Math.max(0, Math.min(TASK_RUNTIME_BOUNDS.steeringResourcesBytes, Math.floor(budgetBytes)));
  const kept = [];
  let bytes = 0;
  for (const resource of resources) {
    const size = Buffer.byteLength(resource.path, "utf8");
    if (size === 0 || size > TASK_RUNTIME_BOUNDS.steeringResourcePathBytes || bytes + size > budget) continue;
    kept.push({ ...resource });
    bytes += size;
    if (kept.length >= TASK_RUNTIME_BOUNDS.steeringResources) break;
  }
  return kept;
}
function boundedValidationGate(gate) {
  const suiteFamily = gate.suiteFamily === void 0 ? void 0 : truncateUtf8(gate.suiteFamily, TASK_RUNTIME_BOUNDS.suiteFamilyBytes);
  const target = gate.target === void 0 ? void 0 : truncateUtf8(gate.target, TASK_RUNTIME_BOUNDS.suiteTargetBytes);
  return {
    ...gate,
    key: suiteFamily && target ? `suite:${suiteFamily}:${target}` : truncateUtf8(gate.key, TASK_RUNTIME_BOUNDS.suiteFamilyBytes + TASK_RUNTIME_BOUNDS.suiteTargetBytes + 16),
    ...suiteFamily === void 0 ? {} : { suiteFamily },
    ...target === void 0 ? {} : { target }
  };
}
function boundedSuiteIdentity(suite2) {
  return {
    ...suite2,
    family: truncateUtf8(suite2.family, TASK_RUNTIME_BOUNDS.suiteFamilyBytes),
    target: truncateUtf8(suite2.target, TASK_RUNTIME_BOUNDS.suiteTargetBytes)
  };
}
function boundTaskRuntime(runtime, steeringBudgetBytes = TASK_RUNTIME_BOUNDS.steeringDeltaBytes) {
  const bounded = cloneTaskRuntime(runtime);
  bounded.validationGates = bounded.validationGates.slice(0, TASK_RUNTIME_BOUNDS.validationGates).map(boundedValidationGate);
  bounded.validations = bounded.validations.slice(0, TASK_RUNTIME_BOUNDS.validations).map((validation) => ({
    ...validation,
    suite: boundedSuiteIdentity(validation.suite),
    summary: truncateUtf8(validation.summary, TASK_RUNTIME_BOUNDS.summaryBytes)
  }));
  bounded.activeDiagnostics = bounded.activeDiagnostics.slice(0, TASK_RUNTIME_BOUNDS.activeDiagnostics).map((diagnostic) => ({
    ...diagnostic,
    id: truncateUtf8(diagnostic.id, TASK_RUNTIME_BOUNDS.identityBytes),
    summary: truncateUtf8(diagnostic.summary, TASK_RUNTIME_BOUNDS.summaryBytes),
    ...diagnostic.suiteFamily === void 0 ? {} : {
      suiteFamily: truncateUtf8(diagnostic.suiteFamily, TASK_RUNTIME_BOUNDS.suiteFamilyBytes)
    },
    ...diagnostic.subjectKey === void 0 ? {} : {
      subjectKey: truncateUtf8(diagnostic.subjectKey, TASK_RUNTIME_BOUNDS.identityBytes)
    },
    resources: diagnostic.resources.slice(0, TASK_RUNTIME_BOUNDS.modifiedResources).map((resource) => truncateUtf8(resource, TASK_RUNTIME_BOUNDS.resourcePathBytes))
  }));
  bounded.modifiedResources = bounded.modifiedResources.slice(0, TASK_RUNTIME_BOUNDS.modifiedResources).map((resource) => ({
    ...resource,
    path: truncateUtf8(resource.path, TASK_RUNTIME_BOUNDS.resourcePathBytes)
  }));
  bounded.recentSubjects = bounded.recentSubjects.slice(0, TASK_RUNTIME_BOUNDS.recentSubjects).map((subject) => ({
    ...subject,
    subjectKey: truncateUtf8(subject.subjectKey, TASK_RUNTIME_BOUNDS.identityBytes),
    intentKey: truncateUtf8(subject.intentKey, TASK_RUNTIME_BOUNDS.identityBytes),
    resources: subject.resources.slice(0, TASK_RUNTIME_BOUNDS.modifiedResources).map((resource) => truncateUtf8(resource, TASK_RUNTIME_BOUNDS.resourcePathBytes))
  }));
  bounded.recentIntentKeys = bounded.recentIntentKeys.slice(0, TASK_RUNTIME_BOUNDS.recentIntentKeys).map((key) => truncateUtf8(key, TASK_RUNTIME_BOUNDS.identityBytes));
  bounded.steeringResources = boundedSteeringResources(bounded.steeringResources, steeringBudgetBytes);
  bounded.steeringDeltas = boundedSteering(bounded.steeringDeltas, steeringBudgetBytes);
  return bounded;
}
function applyRequirementDeltas(runtime, deltas, steeringBudgetBytes = TASK_RUNTIME_BOUNDS.steeringDeltaBytes) {
  const next = cloneTaskRuntime(runtime);
  let changed = false;
  let materialDeltaCount = 0;
  let acceptanceGatesChanged = false;
  for (const delta of deltas) {
    if (next.lastProcessedUserEntryId === delta.id) continue;
    const material = delta.material ?? isMaterialSteering(delta.text);
    const lockDeclared = delta.lockDeclared ?? isRequirementsLockDeclaration(delta.text);
    if (material) {
      next.requirementsRevision += 1;
      next.steeringDeltas.push(delta.text);
      for (const path of explicitSteeringPaths(delta.text)) {
        next.steeringResources = [
          { path, userEntryId: delta.id, requirementsRevision: next.requirementsRevision },
          ...next.steeringResources.filter((resource) => resource.path !== path)
        ].slice(0, TASK_RUNTIME_BOUNDS.steeringResources);
      }
      materialDeltaCount += 1;
      changed = true;
    }
    if (lockDeclared && !next.requirementsLocked) {
      next.requirementsLocked = true;
      changed = true;
    }
    if (delta.acceptanceGates !== void 0 && delta.replaceExplicitGates !== false) {
      const replacement = normalizedExplicitGates(delta.acceptanceGates);
      if (!equalGates(next.validationGates, replacement)) {
        next.validationGates = replacement;
        acceptanceGatesChanged = true;
        changed = true;
      }
    } else if (delta.acceptanceGates !== void 0) {
      const additions = normalizedExplicitGates(delta.acceptanceGates);
      const merged = [
        ...next.validationGates.filter((gate) => gate.source === "explicit-user-command"),
        ...additions
      ].filter((gate, index, all) => all.findIndex((candidate) => candidate.key === gate.key) === index).slice(0, TASK_RUNTIME_BOUNDS.validationGates);
      if (!equalGates(next.validationGates, merged)) {
        next.validationGates = merged;
        acceptanceGatesChanged = true;
        changed = true;
      }
    }
    next.lastProcessedUserEntryId = delta.id;
    changed = true;
  }
  return {
    runtime: boundTaskRuntime(next, steeringBudgetBytes),
    changed,
    materialDeltaCount,
    acceptanceGatesChanged
  };
}
function previewTaskContract(runtime, text, classifyAcceptanceGates) {
  const next = cloneTaskRuntime(runtime);
  let changed = false;
  let materialDeltaCount = 0;
  let acceptanceGatesChanged = false;
  if (isMaterialSteering(text)) {
    next.requirementsRevision += 1;
    next.steeringDeltas.push(text);
    changed = true;
    materialDeltaCount = 1;
  }
  if (isRequirementsLockDeclaration(text) && !next.requirementsLocked) {
    next.requirementsLocked = true;
    changed = true;
  }
  const classified = classifyAcceptanceGates?.(
    text,
    next.validationGates.filter((gate) => gate.source === "explicit-user-command")
  );
  if (classified !== void 0) {
    const replacement = normalizedExplicitGates(classified);
    if (!equalGates(next.validationGates, replacement)) {
      next.validationGates = replacement;
      acceptanceGatesChanged = true;
      changed = true;
    }
  }
  return {
    runtime: boundTaskRuntime(next),
    changed,
    materialDeltaCount,
    acceptanceGatesChanged
  };
}
function updateTaskContract(runtime, update, classifyAcceptanceGates) {
  let next = cloneTaskRuntime(runtime);
  let changed = false;
  let materialDeltaCount = 0;
  let acceptanceGatesChanged = false;
  if (update.objective !== void 0 && update.objective !== next.objective) {
    next.objective = update.objective;
    next.objectiveVersion += 1;
    next.requirementsRevision += 1;
    changed = true;
    materialDeltaCount += 1;
  }
  const entries = update.userEntries ?? [];
  let start = 0;
  if (next.lastProcessedUserEntryId !== void 0) {
    const cursor = entries.findIndex((entry) => entry.id === next.lastProcessedUserEntryId);
    if (cursor >= 0) start = cursor + 1;
  }
  const deltas = [];
  for (const entry of entries.slice(start)) {
    const classified = classifyAcceptanceGates?.(
      entry.text,
      next.validationGates.filter((gate) => gate.source === "explicit-user-command")
    );
    deltas.push({
      ...entry,
      ...classified === void 0 ? {} : {
        acceptanceGates: classified,
        replaceExplicitGates: true
      }
    });
  }
  if (deltas.length > 0) {
    const result = applyRequirementDeltas(next, deltas, update.steeringBudgetBytes);
    next = result.runtime;
    changed ||= result.changed;
    materialDeltaCount += result.materialDeltaCount;
    acceptanceGatesChanged ||= result.acceptanceGatesChanged;
  }
  return {
    runtime: boundTaskRuntime(next, update.steeringBudgetBytes),
    changed,
    materialDeltaCount,
    acceptanceGatesChanged
  };
}

// src/workflow.ts
var SCOPE_RANK = {
  focused: 0,
  package: 1,
  broad: 2
};
function sameSuite(left, right) {
  return left.family === right.family && left.target === right.target && left.scope === right.scope;
}
function validationMatchesGate(validation, gate) {
  if (gate.suiteFamily !== void 0 && validation.suite.family !== gate.suiteFamily) return false;
  if (gate.target !== void 0 && validation.suite.target !== gate.target) return false;
  if (gate.suiteFamily !== void 0 || gate.target !== void 0) return true;
  return gate.key === suiteGateKey(validation.suite);
}
function currentValidation(runtime, validation) {
  return validation.requirementsRevision === runtime.requirementsRevision && validation.workspaceRevision === runtime.workspaceRevision;
}
function gateIsClean(runtime, gate) {
  const matching = runtime.validations.filter((validation) => currentValidation(runtime, validation) && validationMatchesGate(validation, gate)).sort((left, right) => right.turnSequence - left.turnSequence);
  const success = matching.find((validation) => validation.status === "success");
  if (!success) return false;
  return !matching.some((validation) => validation.status === "failure" && validation.turnSequence > success.turnSequence);
}
function deriveReadiness(runtime) {
  const gatesClean = runtime.validationGates.length > 0 && runtime.validationGates.every((gate) => gateIsClean(runtime, gate));
  if (gatesClean) return runtime.requirementsLocked ? "GOAL_READY" : "STAGE_CLEAN";
  const latestCurrentCommand = runtime.validations.filter((validation) => currentValidation(runtime, validation)).sort((left, right) => right.turnSequence - left.turnSequence)[0];
  return latestCurrentCommand?.status === "success" ? "COMMAND_CLEAN" : "NOT_READY";
}
function defaultValidation(exchange) {
  const intent = exchange.intent;
  if (!intent) return void 0;
  if (intent.suite) return { ...intent.suite };
  if (intent.kind === "build" || intent.kind === "lint") {
    return {
      family: intent.kind,
      target: intent.subjectKey,
      scope: "broad"
    };
  }
  return void 0;
}
function validationSummary(suite2, outcome) {
  return outcome.testSummary ?? outcome.commandFailures[0] ?? outcome.exitStatuses[0] ?? outcome.signature ?? `${suite2.family} ${outcome.status}`;
}
function upsertValidation(validations, validation) {
  return [
    validation,
    ...validations.filter((current) => !sameSuite(current.suite, validation.suite))
  ].slice(0, TASK_RUNTIME_BOUNDS.validations);
}
function gateSuite(runtime, gate) {
  return runtime.validations.find((validation) => validationMatchesGate(validation, gate))?.suite;
}
function shouldReplaceDefaultGate(runtime, candidate) {
  const currentGate = runtime.validationGates.find((gate) => gate.source === "default-cumulative");
  if (!currentGate) return true;
  const currentSuite = gateSuite(runtime, currentGate);
  if (!currentSuite) return true;
  const current = runtime.validations.find((validation) => sameSuite(validation.suite, currentSuite));
  if (!current) return true;
  if (candidate.requirementsRevision !== current.requirementsRevision) {
    return candidate.requirementsRevision > current.requirementsRevision;
  }
  if (candidate.workspaceRevision !== current.workspaceRevision) {
    return candidate.workspaceRevision > current.workspaceRevision;
  }
  const scopeDifference = SCOPE_RANK[candidate.suite.scope] - SCOPE_RANK[currentSuite.scope];
  if (scopeDifference !== 0) return scopeDifference > 0;
  if (candidate.suite.family === currentSuite.family && candidate.suite.target === currentSuite.target && candidate.total !== void 0 && current.total !== void 0 && candidate.total !== current.total) {
    return candidate.total > current.total;
  }
  return candidate.turnSequence >= current.turnSequence;
}
function updateDefaultGate(runtime, validation, intent) {
  if (intent.kind !== "test" || runtime.validationGates.some((gate) => gate.source === "explicit-user-command")) return;
  if (!shouldReplaceDefaultGate(runtime, validation)) return;
  runtime.validationGates = [{
    key: suiteGateKey(validation.suite),
    suiteFamily: validation.suite.family,
    target: validation.suite.target,
    source: "default-cumulative"
  }];
}
function diagnosticSource(suite2) {
  return `suite:${suite2.family}:${suite2.scope}:${suite2.target}`;
}
function diagnosticId(suite2, kind, summary) {
  return `${suite2.family}:${kind}:${summary}`.slice(0, 320);
}
function failureDiagnostics(exchange, suite2, workspaceRevision) {
  const outcome = exchange.outcome?.outcome;
  if (!outcome) return [];
  const source = diagnosticSource(suite2);
  const locations = outcome.sourceLocations.map((location) => location.trim().replace(/:\d+(?::\d+)?(?:\s.*)?$/, "")).filter((location) => location.length > 0);
  const common = {
    suiteFamily: suite2.family,
    subjectKey: exchange.intent?.subjectKey,
    source,
    resources: [.../* @__PURE__ */ new Set([...locations, ...exchange.intent?.resources ?? []])],
    ...exchange.id === void 0 ? {} : { exchangeId: exchange.id },
    workspaceRevision,
    state: "active"
  };
  const diagnostics = [
    ...outcome.failingTests.map((summary) => ({
      id: diagnosticId(suite2, "test", summary),
      summary,
      ...common
    })),
    ...outcome.exceptions.map((summary) => ({
      id: diagnosticId(suite2, "exception", summary),
      summary,
      ...common
    })),
    ...outcome.sourceLocations.map((summary) => ({
      id: diagnosticId(suite2, "location", summary),
      summary,
      ...common
    }))
  ];
  if (diagnostics.length === 0) {
    const summary = validationSummary(suite2, outcome);
    diagnostics.push({ id: diagnosticId(suite2, "failure", summary), summary, ...common });
  }
  return diagnostics;
}
function addDiagnostics(current, additions) {
  const next = [...current];
  for (const diagnostic of additions) {
    const existing = next.findIndex((candidate) => candidate.id === diagnostic.id);
    if (existing >= 0) next.splice(existing, 1);
    next.unshift(diagnostic);
  }
  return next.slice(0, TASK_RUNTIME_BOUNDS.activeDiagnostics);
}
function diagnosticSuite(source) {
  if (!source?.startsWith("suite:")) return void 0;
  const [, family, scope, ...target] = source.split(":");
  if (!family || !["focused", "package", "broad"].includes(scope) || target.length === 0) return void 0;
  return { family, scope, target: target.join(":") };
}
function suiteCovers(success, failed) {
  if (success.family !== failed.family) return false;
  if (success.scope === "broad") return true;
  if (SCOPE_RANK[success.scope] < SCOPE_RANK[failed.scope]) return false;
  if (success.target === "all" || success.target === failed.target) return true;
  return failed.target.split("|").some(
    (target) => target === success.target || target.startsWith(`${success.target}/`)
  );
}
function clearDiagnosticsForSuccess(current, suite2) {
  return current.filter((diagnostic) => {
    const failedSuite = diagnosticSuite(diagnostic.source);
    return !failedSuite || !suiteCovers(suite2, failedSuite);
  });
}
function awaitRerun(diagnostics) {
  return diagnostics.map((diagnostic) => ({ ...diagnostic, state: "awaiting-rerun" }));
}
function upsertModifiedResource(resources, path, revision) {
  return [
    { path, revision },
    ...resources.filter((resource) => resource.path !== path)
  ].slice(0, TASK_RUNTIME_BOUNDS.modifiedResources);
}
function mutationResources(exchange) {
  const resources = [...exchange.intent?.resources ?? []];
  if (resources.length > 0) return [...new Set(resources)];
  return [`(workspace changed by ${exchange.toolName ?? exchange.intent?.kind ?? "tool"})`];
}
function intentKey(intent) {
  return `${intent.kind}:${intent.subjectKey}`;
}
function updateSubject(runtime, exchange, workspaceRevision, turnSequence) {
  const intent = exchange.intent;
  const outcome = exchange.outcome?.outcome;
  if (!intent || !outcome) return;
  const key = intentKey(intent);
  const subject = {
    subjectKey: intent.subjectKey,
    intentKind: intent.kind,
    intentKey: key,
    resources: [...intent.resources],
    ...exchange.id === void 0 ? {} : { exchangeId: exchange.id },
    outcomeStatus: outcome.status,
    workspaceRevision,
    turnSequence
  };
  runtime.recentSubjects = [
    subject,
    ...runtime.recentSubjects.filter((current) => current.subjectKey !== subject.subjectKey)
  ].slice(0, TASK_RUNTIME_BOUNDS.recentSubjects);
  runtime.recentIntentKeys = [
    key,
    ...runtime.recentIntentKeys.filter((current) => current !== key)
  ].slice(0, TASK_RUNTIME_BOUNDS.recentIntentKeys);
}
function successfulMutation(exchange) {
  return Boolean(exchange.intent?.mutatesWorkspace && exchange.outcome && !exchange.outcome.isError && exchange.outcome.outcome.status !== "failure");
}
function reduceValidation(runtime, exchange, suite2, workspaceRevision, turnSequence) {
  const outcome = exchange.outcome?.outcome;
  if (!outcome || outcome.status === "unknown") return;
  const status = exchange.outcome?.isError ? "failure" : outcome.status;
  const validation = {
    suite: { ...suite2 },
    status,
    summary: validationSummary(suite2, outcome),
    ...outcome.testTotal === null ? {} : { total: outcome.testTotal },
    requirementsRevision: runtime.requirementsRevision,
    workspaceRevision,
    turnSequence
  };
  runtime.validations = upsertValidation(runtime.validations, validation);
  updateDefaultGate(runtime, validation, exchange.intent);
  if (status === "success") {
    runtime.activeDiagnostics = clearDiagnosticsForSuccess(runtime.activeDiagnostics, suite2);
  } else {
    runtime.activeDiagnostics = addDiagnostics(
      runtime.activeDiagnostics,
      failureDiagnostics(exchange, suite2, workspaceRevision)
    );
  }
}
function reduceTurn(runtime, exchanges, options) {
  const next = cloneTaskRuntime(runtime);
  const turnSequence = runtime.turnSequence + 1;
  next.turnSequence = turnSequence;
  const ordered = exchanges.map((exchange, index) => ({ exchange, index })).filter(({ exchange }) => exchange.completed !== false && exchange.intent && exchange.outcome).sort((left, right) => (left.exchange.sourceOrder ?? left.index) - (right.exchange.sourceOrder ?? right.index)).map(({ exchange }) => exchange);
  const classify = options.classifyValidation ?? defaultValidation;
  const exchangeRevisions = [];
  if (options.toolExecution === "parallel") {
    const baseRevision = runtime.workspaceRevision;
    let mutated = false;
    const mutations = [];
    for (const exchange of ordered) {
      updateSubject(next, exchange, successfulMutation(exchange) ? baseRevision + 1 : baseRevision, turnSequence);
      const suite2 = classify(exchange);
      if (suite2) reduceValidation(next, exchange, suite2, baseRevision, turnSequence);
      if (successfulMutation(exchange)) {
        mutated = true;
        mutations.push(exchange);
      }
      if (exchange.toolCallId) {
        exchangeRevisions.push({
          toolCallId: exchange.toolCallId,
          workspaceRevisionAtStart: baseRevision,
          workspaceRevisionAtResult: baseRevision
        });
      }
    }
    if (mutated) {
      next.workspaceRevision = baseRevision + 1;
      next.activeDiagnostics = awaitRerun(next.activeDiagnostics);
      for (const exchange of mutations) {
        for (const path of mutationResources(exchange)) {
          next.modifiedResources = upsertModifiedResource(next.modifiedResources, path, next.workspaceRevision);
        }
      }
    }
  } else {
    let workspaceRevision = runtime.workspaceRevision;
    for (const exchange of ordered) {
      const workspaceRevisionAtStart = workspaceRevision;
      if (successfulMutation(exchange)) {
        workspaceRevision += 1;
        next.workspaceRevision = workspaceRevision;
        next.activeDiagnostics = awaitRerun(next.activeDiagnostics);
        for (const path of mutationResources(exchange)) {
          next.modifiedResources = upsertModifiedResource(next.modifiedResources, path, workspaceRevision);
        }
      }
      updateSubject(next, exchange, workspaceRevision, turnSequence);
      const suite2 = classify(exchange);
      if (suite2) reduceValidation(next, exchange, suite2, workspaceRevision, turnSequence);
      if (exchange.toolCallId) {
        exchangeRevisions.push({
          toolCallId: exchange.toolCallId,
          workspaceRevisionAtStart,
          workspaceRevisionAtResult: workspaceRevision
        });
      }
    }
  }
  const bounded = boundTaskRuntime(next);
  return {
    runtime: bounded,
    readiness: deriveReadiness(bounded),
    changed: true,
    exchangeRevisions
  };
}

// src/state.ts
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
var SNAPSHOT_ENTRY_TYPE = "prime-context.task-snapshot";
var RUNTIME_STATE_ENTRY_TYPE = "prime-context.runtime-state";
var PRIME_CONTEXT_ANCHOR_TYPE = "prime_context_anchor";
var PRIME_CONTEXT_STATE_TYPE = "prime_context_state";
var PRIME_CONTEXT_FOLD_TYPE = "prime_context_fold";
var PRIME_CONTEXT_ANCHOR_SCHEMA = "prime_context_anchor/v1";
var PRIME_CONTEXT_STATE_SCHEMA = "prime_context_state/v1";
var PRIME_CONTEXT_FOLD_SCHEMA = "prime_context_fold/v1";
var DEFAULT_CONFIG = {
  enabled: true,
  minTextBytes: 24576,
  capsuleMaxBytes: 6144,
  readMaxBytes: 65536
};
function asRecord(value) {
  return value !== null && typeof value === "object" ? value : void 0;
}
function controlMessage(entry) {
  const raw = entry.type === "custom_message" ? asRecord(entry) : entry.type === "message" ? asRecord(entry.message) : void 0;
  if (!raw || raw.role !== void 0 && raw.role !== "custom") return void 0;
  const customType = raw.customType;
  if (customType !== PRIME_CONTEXT_ANCHOR_TYPE && customType !== PRIME_CONTEXT_STATE_TYPE && customType !== PRIME_CONTEXT_FOLD_TYPE) return void 0;
  if (typeof raw.content !== "string") return void 0;
  return {
    customType,
    content: raw.content,
    ...asRecord(raw.details) === void 0 ? {} : { details: asRecord(raw.details) }
  };
}
function providerVisibleBranchEntries(branch) {
  let compactionIndex = -1;
  for (let index = 0; index < branch.length; index += 1) {
    if (branch[index].type === "compaction") compactionIndex = index;
  }
  if (compactionIndex < 0) return branch;
  const firstKeptId = branch[compactionIndex].firstKeptEntryId;
  const firstKeptIndex = typeof firstKeptId === "string" ? branch.findIndex((entry, index) => index < compactionIndex && entry.id === firstKeptId) : -1;
  return [
    ...firstKeptIndex < 0 ? [] : branch.slice(firstKeptIndex, compactionIndex),
    ...branch.slice(compactionIndex + 1)
  ];
}
function latestProviderVisibleControlMessage(branch, customType, taskKey, unscoped) {
  const visible = providerVisibleBranchEntries(branch);
  for (let index = visible.length - 1; index >= 0; index -= 1) {
    const message = controlMessage(visible[index]);
    if (taskKey !== void 0 && message?.customType === customType && message.details?.taskKey === taskKey) return message;
  }
  if (!unscoped) return void 0;
  const rootIndex = branch.findIndex((entry) => entry.id === unscoped.afterEntryId);
  if (rootIndex < 0) return void 0;
  const visibleEntries = new Set(visible);
  for (let index = branch.length - 1; index > rootIndex; index -= 1) {
    if (!visibleEntries.has(branch[index])) continue;
    const message = controlMessage(branch[index]);
    if (message?.customType !== customType || message.content !== unscoped.content) continue;
    if (message.details?.taskKey === void 0) return message;
  }
  return void 0;
}
function isSnapshot(value) {
  if (!value || typeof value !== "object") return false;
  const candidate = value;
  return candidate.schema === "prime-context.task-snapshot/v1" && Array.isArray(candidate.openItems) && Array.isArray(candidate.pinnedObservationIds) && typeof candidate.updatedAt === "string";
}
function emptySnapshot(now = (/* @__PURE__ */ new Date()).toISOString()) {
  return {
    schema: "prime-context.task-snapshot/v1",
    openItems: [],
    pinnedObservationIds: [],
    updatedAt: now
  };
}
function cloneSnapshot(snapshot) {
  return {
    schema: "prime-context.task-snapshot/v1",
    ...snapshot.focus === void 0 ? {} : { focus: snapshot.focus },
    openItems: snapshot.openItems.map((item) => ({ ...item })),
    pinnedObservationIds: [...snapshot.pinnedObservationIds],
    updatedAt: snapshot.updatedAt
  };
}
function loadLatestSnapshot(branch) {
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    const entry = branch[index];
    if (entry.type === "custom" && entry.customType === SNAPSHOT_ENTRY_TYPE && isSnapshot(entry.data)) {
      return cloneSnapshot(entry.data);
    }
  }
  return emptySnapshot();
}
function isTaskRuntimeV2(value) {
  if (!value || typeof value !== "object") return false;
  const runtime = value;
  return runtime.schema === "prime-context.runtime/v2" && typeof runtime.taskKey === "string" && runtime.taskKey.length > 0 && typeof runtime.objectiveVersion === "number" && typeof runtime.requirementsRevision === "number" && typeof runtime.requirementsLocked === "boolean" && typeof runtime.workspaceRevision === "number" && typeof runtime.turnSequence === "number" && Array.isArray(runtime.validationGates) && Array.isArray(runtime.validations) && Array.isArray(runtime.activeDiagnostics) && Array.isArray(runtime.modifiedResources) && Array.isArray(runtime.recentSubjects) && Array.isArray(runtime.recentIntentKeys) && Array.isArray(runtime.steeringDeltas);
}
function cloneTaskRuntime2(runtime) {
  return structuredClone(runtime);
}
function normalizedLoadedRuntime(runtime) {
  const cloned = cloneTaskRuntime2(runtime);
  const steeringCandidates = Array.isArray(cloned.steeringResources) ? cloned.steeringResources : [];
  cloned.steeringResources = [];
  let steeringBytes = 0;
  for (const resource of steeringCandidates) {
    if (!resource || typeof resource.path !== "string" || typeof resource.userEntryId !== "string" || typeof resource.requirementsRevision !== "number") continue;
    const size = Buffer.byteLength(resource.path, "utf8");
    if (size === 0 || size > TASK_RUNTIME_BOUNDS.steeringResourcePathBytes || steeringBytes + size > TASK_RUNTIME_BOUNDS.steeringResourcesBytes) continue;
    cloned.steeringResources.push({ ...resource });
    steeringBytes += size;
    if (cloned.steeringResources.length >= TASK_RUNTIME_BOUNDS.steeringResources) break;
  }
  cloned.activeDiagnostics = cloned.activeDiagnostics.map((diagnostic) => ({
    ...diagnostic,
    resources: Array.isArray(diagnostic.resources) ? diagnostic.resources.filter((resource) => typeof resource === "string") : []
  }));
  const fold = cloned.fold;
  if (fold && (!Number.isSafeInteger(fold.generation) || fold.generation < 1 || typeof fold.throughEntryId !== "string" || !fold.throughEntryId || !Array.isArray(fold.retainedEntryIds) || fold.retainedEntryIds.length > TASK_RUNTIME_BOUNDS.foldRetainedEntryIds || !fold.retainedEntryIds.every((id) => typeof id === "string" && id.length > 0) || typeof fold.renderedMessage !== "string" || Buffer.byteLength(fold.renderedMessage, "utf8") > TASK_RUNTIME_BOUNDS.foldRenderedBytes)) delete cloned.fold;
  return cloned;
}
function loadLatestRuntime(branch, taskKey) {
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    const entry = branch[index];
    if (entry.type !== "custom" || entry.customType !== RUNTIME_STATE_ENTRY_TYPE || !isTaskRuntimeV2(entry.data)) {
      continue;
    }
    if (entry.data.taskKey === taskKey) return normalizedLoadedRuntime(entry.data);
  }
  return void 0;
}
function applySnapshotChanges(current, changes, now = (/* @__PURE__ */ new Date()).toISOString()) {
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
    const focus = changes.focus === null ? void 0 : changes.focus?.trim();
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
function readConfigFile(path, label, warnings) {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      warnings.push(`${label} config must be a JSON object; defaults were used.`);
      return {};
    }
    return parsed;
  } catch (error) {
    if (error.code === "ENOENT") return {};
    warnings.push(`${label} config could not be read; defaults were used.`);
    return {};
  }
}
function resolveField(key, globalConfig, projectConfig, warnings) {
  const source = Object.hasOwn(projectConfig, key) ? projectConfig : globalConfig;
  if (!Object.hasOwn(source, key)) return DEFAULT_CONFIG[key];
  const value = source[key];
  const valid = key === "enabled" ? typeof value === "boolean" : typeof value === "number" && Number.isSafeInteger(value) && (key === "minTextBytes" ? value >= 0 : key === "capsuleMaxBytes" ? value >= 512 : value > 0);
  if (!valid) {
    warnings.push(`Invalid ${key} configuration value; default ${DEFAULT_CONFIG[key]} was used.`);
    return DEFAULT_CONFIG[key];
  }
  return value;
}
function loadPrimeContextConfig(cwd) {
  const warnings = [];
  const globalConfig = readConfigFile(join(homedir(), ".prime", "agent", "prime-context.json"), "Global", warnings);
  const projectConfig = readConfigFile(join(cwd, ".prime", "agent", "prime-context.json"), "Project", warnings);
  return {
    config: {
      enabled: resolveField("enabled", globalConfig, projectConfig, warnings),
      minTextBytes: resolveField("minTextBytes", globalConfig, projectConfig, warnings),
      capsuleMaxBytes: resolveField("capsuleMaxBytes", globalConfig, projectConfig, warnings),
      readMaxBytes: resolveField("readMaxBytes", globalConfig, projectConfig, warnings)
    },
    warnings
  };
}
function storageRoot() {
  return process.env.PRIME_CONTEXT_HOME ?? join(homedir(), ".prime", "agent", "prime-context");
}

// src/context.ts
var GOAL_CONTEXT_TYPE = "goal_context";
var IPYTHON_STATE_TYPES = /* @__PURE__ */ new Set(["ipython_state", "ipython_state_restored"]);
function record2(value) {
  return value !== null && typeof value === "object" ? value : void 0;
}
function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.flatMap((part) => {
    const value = record2(part);
    return value?.type === "text" && typeof value.text === "string" ? [value.text] : [];
  }).join("\n");
}
function replaceTextContent(content, text) {
  if (!Array.isArray(content)) return text;
  let replaced = false;
  const next = content.flatMap((part) => {
    const value = record2(part);
    if (value?.type !== "text") return [part];
    if (replaced) return [];
    replaced = true;
    return [{ ...value, text }];
  });
  return replaced ? next : [{ type: "text", text }, ...next];
}
function quoted(value) {
  return escapeXml(JSON.stringify(value));
}
function normalizedText(value) {
  return value.trim().replace(/\s+/g, " ");
}
function unique2(values) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const value of values) {
    const normalized = normalizedText(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value.trim());
  }
  return result;
}
function durableSnapshot(snapshot) {
  return Boolean(snapshot.focus) || snapshot.openItems.length > 0 || snapshot.pinnedObservationIds.length > 0;
}
function explicitProtectedPaths(values) {
  const paths = [];
  for (const value of values) {
    const clauses = value.split(/\n|[.;](?:\s|$)/);
    for (const clause of clauses) {
      if (!/(?:do not|must not|never)\s+(?:edit|modify|touch)|protected paths?/i.test(clause)) continue;
      const tail = clause.replace(/^.*?(?:(?:do not|must not|never)\s+(?:edit|modify|touch)|protected paths?\s*:?)/i, "");
      for (const candidate of tail.split(/,|\band\b/i)) {
        const cleaned = candidate.trim().replace(/^[`'"]|[`'"]$/g, "");
        if (/^(?:[A-Za-z0-9_.-]+\/|\.\/|\/|README\b|[^ ]+\.\w+|[^ ]+\/\*\*)/.test(cleaned)) paths.push(cleaned);
      }
    }
  }
  return unique2(paths);
}
function normalizedGate(gate) {
  if (gate.suiteFamily && gate.target) return `${gate.suiteFamily}:${gate.target}`;
  return gate.key;
}
function renderPrimeContextAnchor(input) {
  const objective = input.objective.trim();
  const constraints = unique2(input.runtime.steeringDeltas).filter((value) => normalizedText(value) !== normalizedText(objective));
  const protectedPaths = explicitProtectedPaths([objective, ...constraints]);
  const lines = [
    "<prime_context_anchor>",
    `objective: ${quoted(objective)}`,
    `requirements_revision: r${input.runtime.requirementsRevision}`
  ];
  if (constraints.length > 0) {
    lines.push("constraints:", ...constraints.map((value) => `- ${quoted(value)}`));
  }
  if (input.runtime.validationGates.length > 0) {
    lines.push("required_gates:", ...input.runtime.validationGates.map((gate) => `- ${escapeXml(boundedDisplay(normalizedGate(gate)))}`));
  }
  if (protectedPaths.length > 0) {
    lines.push("protected_paths:", ...protectedPaths.map((path) => `- ${escapeXml(boundedDisplay(path))}`));
  }
  if (input.snapshot.focus) lines.push(`durable_focus: ${quoted(boundedDisplay(input.snapshot.focus, 256))}`);
  if (input.snapshot.openItems.length > 0) {
    lines.push("open_items:", ...input.snapshot.openItems.map((item) => `- [${escapeXml(boundedDisplay(item.id, 96))}] ${escapeXml(boundedDisplay(item.text, 256))}`));
  }
  if (input.snapshot.pinnedObservationIds.length > 0) {
    lines.push("pinned_outputs:", ...input.snapshot.pinnedObservationIds.map((id) => `- ${escapeXml(boundedDisplay(id, 128))}`));
  }
  if (input.child) {
    const parentRefs = unique2(input.child.parentRefs).slice(0, 8);
    const relevantPaths = unique2(input.child.relevantPaths).slice(0, 8);
    const childConstraints = unique2(input.child.constraints).slice(0, 6);
    lines.push("child_context:", `- parent_session: ${escapeXml(boundedDisplay(input.child.parentSessionId, 128))}`);
    if (parentRefs.length > 0) {
      lines.push("- parent_refs:", ...parentRefs.map((ref) => `  - ${escapeXml(boundedDisplay(ref, 128))}`));
    }
    if (relevantPaths.length > 0) {
      lines.push("- relevant_paths:", ...relevantPaths.map((path) => `  - ${escapeXml(boundedDisplay(path, 192))}`));
    }
    if (childConstraints.length > 0) {
      lines.push("- inherited_constraints:", ...childConstraints.map((value) => `  - ${quoted(boundedDisplay(value, 256))}`));
    }
    lines.push('- parent_lookup: "prime_context action=recall scope=parent id=<parent_ref>"');
    lines.push('- reply_contract: "Return touched paths, current validation facts, and child refs; do not copy large diagnostics."');
  }
  lines.push("</prime_context_anchor>");
  return {
    content: lines.join("\n"),
    details: {
      schema: PRIME_CONTEXT_ANCHOR_SCHEMA,
      ...input.taskKey === void 0 ? {} : { taskKey: input.taskKey },
      objectiveVersion: input.runtime.objectiveVersion,
      requirementsRevision: input.runtime.requirementsRevision
    }
  };
}
function taskAnchorHasDurableState(input, visiblePrompt) {
  if (input.child || input.runtime.goalId || durableSnapshot(input.snapshot)) return true;
  if (input.runtime.validations.length > 0 || input.runtime.activeDiagnostics.length > 0 || input.runtime.modifiedResources.length > 0) return true;
  const prompt = normalizedText(visiblePrompt);
  const otherSteering = input.runtime.steeringDeltas.some((value) => normalizedText(value) !== prompt);
  if (otherSteering) return true;
  const objectiveVisible = normalizedText(input.objective) === prompt;
  return !objectiveVisible;
}
function latestGateValidation(runtime, gate) {
  return runtime.validations.find((validation) => {
    if (gate.suiteFamily && validation.suite.family !== gate.suiteFamily) return false;
    if (gate.target && validation.suite.target !== gate.target) return false;
    return gate.suiteFamily !== void 0 || gate.target !== void 0 || `suite:${validation.suite.family}:${validation.suite.target}` === gate.key;
  });
}
function boundedDisplay(value, maxBytes = 160) {
  const display = value.trim().replace(/[\r\n\t]+/g, " ");
  if (utf8Bytes(display) <= maxBytes) return display;
  return `${truncateUtf8(display, Math.max(0, maxBytes - 3))}\u2026`;
}
function short(value, maxBytes = 88) {
  return boundedDisplay(value, maxBytes);
}
function boundedList(values, limit = 4, itemBytes = 160) {
  const shown = values.slice(0, limit).map((value) => boundedDisplay(value, itemBytes));
  const omitted = values.length - shown.length;
  return `${shown.join(", ")}${omitted > 0 ? `, +${omitted}` : ""}`;
}
function modifiedResourcesSinceGate(runtime, gate) {
  const validation = latestGateValidation(runtime, gate);
  const revision = validation?.workspaceRevision ?? -1;
  return runtime.modifiedResources.filter((resource) => resource.revision > revision).map((resource) => resource.path);
}
function subjectPath(subject) {
  return subject.startsWith("path:") ? subject.slice(5) : void 0;
}
function rankWorkingSet(runtime, snapshot, limit = 12) {
  const ranked = [];
  const add = (value) => {
    const normalized = value?.trim();
    if (normalized && !ranked.includes(normalized)) ranked.push(normalized);
  };
  for (const diagnostic of runtime.activeDiagnostics) {
    for (const resource of diagnostic.resources ?? []) add(resource);
    add(subjectPath(diagnostic.subjectKey ?? ""));
  }
  for (const resource of runtime.modifiedResources) add(resource.path);
  const latestSteeringRevision = runtime.steeringResources.reduce(
    (latest, resource) => Math.max(latest, resource.requirementsRevision),
    -1
  );
  for (const resource of runtime.steeringResources) {
    if (resource.requirementsRevision === latestSteeringRevision) add(resource.path);
  }
  for (const gate of runtime.validationGates) {
    const subjects = runtime.recentSubjects.filter((subject) => subject.intentKind === "test" || subject.intentKind === "build" || subject.intentKind === "lint");
    for (const subject of subjects) {
      if (gate.target && subject.subjectKey.includes(gate.target) || gate.suiteFamily && subject.subjectKey.includes(gate.suiteFamily)) {
        for (const resource of subject.resources) add(resource);
      }
    }
    if (gate.target?.includes("/") || gate.target?.includes(".")) add(gate.target);
  }
  for (const subject of runtime.recentSubjects) {
    if (subject.intentKind !== "read" && subject.intentKind !== "search") continue;
    for (const resource of subject.resources) add(resource);
    add(subjectPath(subject.subjectKey));
  }
  const bounded = ranked.slice(0, Math.max(0, limit));
  const override = (value) => {
    if (value && !bounded.includes(value)) bounded.push(value);
  };
  override(snapshot?.focus ? `focus:${short(snapshot.focus, 120)}` : void 0);
  for (const pin of snapshot?.pinnedObservationIds ?? []) override(`pin:${pin}`);
  return bounded;
}
function renderPrimeContextState(runtime, snapshot) {
  const gateFacts = runtime.validationGates.map((gate) => {
    const validation = latestGateValidation(runtime, gate);
    const modified = modifiedResourcesSinceGate(runtime, gate);
    const modifiedFact = boundedList(modified.length > 0 ? modified : ["none"]);
    if (!validation) return `${boundedDisplay(normalizedGate(gate))}=not-run modified=${modifiedFact}`;
    const current = validation.requirementsRevision === runtime.requirementsRevision && validation.workspaceRevision === runtime.workspaceRevision;
    const status = validation.status === "success" ? "pass" : "fail";
    return `${boundedDisplay(normalizedGate(gate))}=${status}${current ? "" : "-stale"}@r${validation.requirementsRevision}/w${validation.workspaceRevision} modified=${modifiedFact}`;
  });
  const diagnostics = runtime.activeDiagnostics.map((diagnostic) => {
    const resources = diagnostic.resources?.length ? ` resources=${boundedList(diagnostic.resources)}` : "";
    const ref = diagnostic.exchangeId ? ` ref=${boundedDisplay(diagnostic.exchangeId, 96)}:result` : "";
    return `${boundedDisplay(diagnostic.summary, 160)} [${diagnostic.state}]${resources}${ref}`;
  });
  const actions = runtime.recentSubjects.slice(0, 6).map((subject) => {
    const resources = subject.resources.length > 0 ? ` ${boundedList(subject.resources)}` : "";
    const ref = subject.exchangeId ? ` ref=${boundedDisplay(subject.exchangeId, 96)}` : "";
    return `${subject.intentKind} ${boundedDisplay(subject.subjectKey, 160)}${resources}${ref}`;
  });
  const firstUnmetGate = runtime.validationGates.find((gate) => {
    const validation = latestGateValidation(runtime, gate);
    return !validation || validation.status !== "success" || validation.requirementsRevision !== runtime.requirementsRevision || validation.workspaceRevision !== runtime.workspaceRevision;
  });
  const firstDiagnostic = runtime.activeDiagnostics[0];
  const nextObligation = firstDiagnostic?.state === "active" ? `resolve ${short(firstDiagnostic.summary)}` : firstDiagnostic ? `rerun current ${boundedDisplay(firstDiagnostic.suiteFamily ?? "validation")} gate` : firstUnmetGate ? `run current gate ${boundedDisplay(normalizedGate(firstUnmetGate))}` : snapshot?.openItems[0] ? `complete open item ${boundedDisplay(snapshot.openItems[0].id, 96)}` : "none";
  const lines = [
    "<prime_context_state>",
    `objective: ${quoted(runtime.objective ?? runtime.taskKey)} v${runtime.objectiveVersion}`,
    `requirements: r${runtime.requirementsRevision} ${runtime.requirementsLocked ? "locked" : "open"}`,
    `workspace: w${runtime.workspaceRevision}`,
    `readiness: ${deriveReadiness(runtime)}`
  ];
  if (gateFacts.length > 0) lines.push("validation_gates:", ...gateFacts.map((fact) => `- ${escapeXml(fact)}`));
  if (diagnostics.length > 0) lines.push("active_diagnostics:", ...diagnostics.map((fact) => `- ${escapeXml(fact)}`));
  if (actions.length > 0) lines.push("recent_actions:", ...actions.map((fact) => `- ${escapeXml(fact)}`));
  const hot = rankWorkingSet(runtime, snapshot);
  if (hot.length > 0) lines.push("hot:", ...hot.map((value) => `- ${escapeXml(boundedDisplay(value))}`));
  if (snapshot?.openItems.length) lines.push(`open_items: ${snapshot.openItems.length}`);
  lines.push(`next_obligation: ${escapeXml(nextObligation)}`, "</prime_context_state>");
  return {
    content: lines.join("\n"),
    details: {
      schema: PRIME_CONTEXT_STATE_SCHEMA,
      taskKey: runtime.taskKey,
      requirementsRevision: runtime.requirementsRevision,
      workspaceRevision: runtime.workspaceRevision
    }
  };
}
function renderPrimeContextFold(runtime, snapshot, generation, throughEntryId) {
  const lines = [`<prime_context_fold generation="${generation}">`];
  const subjects = rankWorkingSet(runtime, void 0, 8).slice(0, 8);
  if (subjects.length > 0) {
    lines.push("current_subjects:");
    for (const value of subjects) {
      const subject = runtime.recentSubjects.find((candidate) => candidate.resources.includes(value) || subjectPath(candidate.subjectKey) === value);
      lines.push(`- ${escapeXml(boundedDisplay(value, 160))}${subject?.exchangeId ? ` last_action=${escapeXml(boundedDisplay(subject.exchangeId, 96))}` : ""}`);
    }
  }
  if (runtime.activeDiagnostics.length > 0) {
    lines.push("unresolved:");
    for (const diagnostic of runtime.activeDiagnostics.slice(0, 8)) {
      lines.push(`- ${escapeXml(boundedDisplay(diagnostic.summary, 160))}${diagnostic.exchangeId ? ` ref=${escapeXml(boundedDisplay(diagnostic.exchangeId, 96))}:result` : ""}`);
    }
  }
  if (runtime.validationGates.length > 0) {
    lines.push("validation:");
    for (const gate of runtime.validationGates) {
      const validation = latestGateValidation(runtime, gate);
      const current = validation && validation.requirementsRevision === runtime.requirementsRevision && validation.workspaceRevision === runtime.workspaceRevision;
      const status = validation ? `${validation.status === "success" ? "pass" : "fail"}${current ? "" : "-stale"}@w${validation.workspaceRevision}` : "not-run";
      const modified = modifiedResourcesSinceGate(runtime, gate);
      lines.push(`- ${escapeXml(boundedDisplay(normalizedGate(gate)))} ${status} modified=${escapeXml(boundedList(modified.length ? modified : ["none"]))}`);
    }
  }
  if (snapshot.pinnedObservationIds.length > 0) {
    lines.push("pinned:", ...snapshot.pinnedObservationIds.map((id) => `- ${escapeXml(boundedDisplay(id, 128))}`));
  }
  lines.push("</prime_context_fold>");
  return {
    content: lines.join("\n"),
    details: {
      schema: PRIME_CONTEXT_FOLD_SCHEMA,
      taskKey: runtime.taskKey,
      generation,
      throughEntryId
    }
  };
}
function goalObjective(message) {
  const details = record2(message.details);
  if (typeof details?.objective === "string" && details.objective.trim()) return details.objective;
  const text = contentText(message.content);
  const match = text.match(/<(?:untrusted_)?objective>\s*([\s\S]*?)\s*<\/(?:untrusted_)?objective>/i);
  return match?.[1]?.trim();
}
function goalRemaining(message) {
  const details = record2(message.details);
  const direct = details?.remainingTokens ?? details?.remaining_tokens;
  if (typeof direct === "number" || direct === "string") return String(direct);
  if (typeof details?.tokenBudget === "number" && typeof details.tokensUsed === "number") {
    return String(Math.max(0, details.tokenBudget - details.tokensUsed));
  }
  const text = contentText(message.content);
  return text.match(/\bremaining_tokens="([^"]+)"/i)?.[1] ?? text.match(/(?:^|[-•]\s*)remaining[_ ]tokens:\s*(unbounded|\d+)/im)?.[1];
}
function attribute(name, value) {
  return value === void 0 ? "" : ` ${name}="${escapeXml(String(value))}"`;
}
function mapGoalMessage(message, states) {
  const details = record2(message.details);
  const objective = goalObjective(message);
  if (!objective) return message;
  const goalId = typeof details?.goalId === "string" ? details.goalId : "goal";
  const status = typeof details?.status === "string" ? details.status : void 0;
  const remaining = goalRemaining(message);
  const previous = states.get(goalId);
  const objectiveChanged = !previous || previous.objective !== objective;
  const version = objectiveChanged ? (previous?.version ?? 0) + 1 : previous.version;
  const occurrences = (previous?.occurrences ?? 0) + 1;
  let text;
  if (objectiveChanged) {
    text = [
      `<goal_objective${attribute("id", goalId)}${attribute("version", version)}>`,
      `objective: ${quoted(objective)}`,
      ...status !== previous?.status ? [`status: ${escapeXml(status ?? "unknown")}`] : [],
      ...remaining !== previous?.remaining ? [`remaining_tokens: ${escapeXml(remaining ?? "unknown")}`] : [],
      "</goal_objective>"
    ].join("\n");
  } else {
    const continuation = typeof details?.continuationsUsed === "number" ? details.continuationsUsed : occurrences - 1;
    text = `<goal_tick${attribute("id", goalId)}${attribute("continuation", continuation)}${status !== previous.status ? attribute("status", status) : ""}${remaining !== previous.remaining ? attribute("remaining_tokens", remaining) : ""} />`;
  }
  states.set(goalId, { objective, version, status, remaining, occurrences });
  return { ...message, content: replaceTextContent(message.content, text) };
}
function listedNames(text, marker) {
  const match = text.match(marker);
  if (!match) return void 0;
  const names = match[1].trim().replace(/\.$/, "");
  return names ? names.split(/,\s*/).filter(Boolean) : [];
}
function mapIpythonMessage(message) {
  const customType = message.customType ?? "";
  if (!IPYTHON_STATE_TYPES.has(customType)) return message;
  const text = contentText(message.content);
  if (/^<ipython_inventory\b/i.test(text.trim())) return message;
  const available = listedNames(text, /(?:These names are still defined|These names are available again):\s*([^\n<]+)/i);
  const failed = listedNames(text, /These could not be restored[^:]*:\s*([^\n<]+)/i) ?? [];
  const pruned = listedNames(text, /Variables above[^:]*were removed:\s*(.*?)(?=\. These names are|[\n<]|$)/i) ?? [];
  const availableCount = available?.length ?? (/starting fresh|not defined any names/i.test(text) ? 0 : void 0);
  const kind = customType === "ipython_state_restored" ? "restored" : "persisted";
  const summary = [
    `<ipython_inventory kind="${kind}" available="${availableCount ?? "unknown"}" failed="${failed.length}" pruned="${pruned.length}">`,
    "Use `name in globals()` or filter `globals()` to locate a specific value.",
    "</ipython_inventory>"
  ].join("\n");
  return { ...message, content: replaceTextContent(message.content, summary) };
}
function mapStableControlMessages(messages) {
  const goals = /* @__PURE__ */ new Map();
  let changed = false;
  const mapped = messages.map((message) => {
    let next = message;
    if (message.role === "custom" && message.customType === GOAL_CONTEXT_TYPE) {
      next = mapGoalMessage(message, goals);
    } else if (message.role === "custom" && IPYTHON_STATE_TYPES.has(message.customType ?? "")) {
      next = mapIpythonMessage(message);
    }
    changed ||= next !== message;
    return next;
  });
  return changed ? mapped : messages;
}
function persistentControlMessage(customType, rendered, timestamp = Date.now()) {
  return {
    role: "custom",
    customType,
    content: rendered.content,
    display: false,
    details: rendered.details,
    timestamp
  };
}

// src/projection.ts
var FIXED_EXCHANGE_VIEW_SCHEMA = "prime-context.fixed-exchange-view/v1";
var FIXED_EXCHANGE_VIEW_GENERATION = 0;
function fixedExchangeBudgetBytes(usage) {
  if (!usage || usage.tokens === null || usage.contextWindow <= 0) return 24 * 1024;
  const pressure = usage.tokens / usage.contextWindow;
  if (pressure >= 0.8) return 8 * 1024;
  if (pressure >= 0.6) return 16 * 1024;
  return 24 * 1024;
}
function decodePointer(pointer) {
  if (pointer === "") return [];
  if (pointer[0] !== "/") return void 0;
  const tokens = pointer.slice(1).split("/");
  if (tokens.some((token) => /~(?![01])/u.test(token))) return void 0;
  return tokens.map((token) => token.replaceAll("~1", "/").replaceAll("~0", "~"));
}
function sourceLines(text) {
  return text.split("\n").filter((line) => line.trim().length > 0);
}
function boundedPreview(toolName, source) {
  if (!source || !["edit", "ipython", "bash"].includes(toolName)) return "";
  const lines = sourceLines(source);
  if (lines.length === 0) return "";
  let selected;
  if (toolName === "edit") {
    selected = lines.slice(0, 1);
  } else if (toolName === "ipython") {
    selected = lines.slice(0, 2);
    const last = lines.at(-1);
    if (last !== void 0 && !selected.includes(last)) selected.push(last);
  } else {
    selected = lines.slice(0, 1);
    const last = lines.at(-1);
    if (last !== void 0 && last !== selected[0]) selected.push(last);
  }
  const preview = selected.join("\n");
  return utf8Bytes(preview) <= 384 ? preview : `${truncateUtf8(preview, 381)}...`;
}
function boundedContext(context) {
  if (!context) return "";
  const values = [
    `intent=${context.intentKind}`,
    `subject=${context.subjectKey}`,
    ...context.normalizedExecutable ? [`executable=${context.normalizedExecutable}`] : [],
    ...context.effectiveCwd ? [`cwd=${context.effectiveCwd}`] : [],
    ...context.resources?.length ? [`resources=${context.resources.join(",")}`] : [],
    ...context.suite ? [`suite=${context.suite.family}:${context.suite.target}:${context.suite.scope}`] : []
  ];
  const summary = values.join("; ");
  const maxBytes = Math.max(512, Math.min(768, context.identityMaxBytes ?? 512));
  return utf8Bytes(summary) <= maxBytes ? summary : `${truncateUtf8(summary, maxBytes - 3)}...`;
}
function archivedCallMarker(exchangeId, toolName, field, context) {
  const ref = `${exchangeId}:call#${field.pointer}`;
  const summary = boundedContext(context);
  const attributes = [
    `ref="${escapeXml(ref)}"`,
    `bytes="${field.textBytes}"`,
    `lines="${field.lineCount}"`,
    ...summary ? [`context="${escapeXml(summary)}"`] : [],
    ...context?.diffRef ? [`diff-ref="${escapeXml(context.diffRef)}"`] : []
  ].join(" ");
  const preview = boundedPreview(toolName, field.text);
  return preview ? `<archived-call ${attributes}>
${escapeXml(preview)}
</archived-call>` : `<archived-call ${attributes} />`;
}
function cloneArguments(value) {
  try {
    return structuredClone(value);
  } catch {
    return { ...value };
  }
}
function valueAtPointer(root, tokens) {
  let value = root;
  for (const token of tokens) {
    if (!value || typeof value !== "object") return void 0;
    value = value[token];
  }
  return value;
}
function replaceAtPointer(root, tokens, replacement) {
  if (tokens.length === 0) return false;
  let parent = root;
  for (const token of tokens.slice(0, -1)) {
    if (!parent || typeof parent !== "object") return false;
    parent = parent[token];
  }
  if (!parent || typeof parent !== "object") return false;
  const key = tokens.at(-1);
  if (!Object.prototype.hasOwnProperty.call(parent, key)) return false;
  parent[key] = replacement;
  return true;
}
function compactArchivedCallArguments(exchangeId, toolName, argumentsValue, fields, context) {
  const usable = fields.map((field) => ({ field, tokens: decodePointer(field.pointer) })).filter(
    (entry) => entry.tokens !== void 0 && entry.field.textBytes > 0
  );
  if (usable.length === 0) return void 0;
  const root = usable.find((entry) => entry.tokens.length === 0);
  if (root) {
    const archived = archivedCallMarker(exchangeId, toolName, root.field, context);
    const compact2 = { archived };
    for (const [key, value] of Object.entries(argumentsValue)) {
      const scalar = value === null || typeof value === "number" || typeof value === "boolean" || typeof value === "string" && utf8Bytes(value) <= 192;
      if (!scalar || key === "archived") continue;
      const candidate = { ...compact2, [key]: value };
      if (jsonBytes2(candidate) > 4096) break;
      compact2[key] = value;
    }
    return compact2;
  }
  const compact = cloneArguments(argumentsValue);
  let replacements = 0;
  for (const { field, tokens } of usable) {
    const sourceValue = valueAtPointer(argumentsValue, tokens);
    const source = field.text ?? (typeof sourceValue === "string" ? sourceValue : void 0);
    const marker = archivedCallMarker(exchangeId, toolName, { ...field, text: source }, context);
    if (replaceAtPointer(compact, tokens, marker)) replacements += 1;
  }
  return replacements > 0 ? compact : void 0;
}
function jsonBytes2(value) {
  try {
    return utf8Bytes(JSON.stringify(value));
  } catch {
    return utf8Bytes(String(value));
  }
}
function literalPriority(candidate, novel) {
  if (candidate.isError || candidate.hasUniqueDiagnostic && novel) return 0;
  if (novel && utf8Bytes(candidate.resultText) < 8192) return 1;
  if (candidate.changesWorkspace) return 3;
  return 4;
}
function selectFixedExchangeViews(input, budgetBytes, capsuleMaxBytes) {
  const candidates = input.map((candidate, inputOrder) => ({ candidate, inputOrder })).sort(
    (left, right) => left.candidate.sourceOrder - right.candidate.sourceOrder || left.inputOrder - right.inputOrder
  ).map(({ candidate }) => candidate);
  const baselineCapsules = /* @__PURE__ */ new Map();
  for (const candidate of candidates) {
    if (candidate.forceLiteral) continue;
    if (candidate.fixedCapsule !== void 0) baselineCapsules.set(candidate, candidate.fixedCapsule);
    else if (candidate.requiresCapsule) baselineCapsules.set(candidate, candidate.capsule(capsuleMaxBytes));
  }
  const baselineTotal = candidates.reduce((total, candidate) => total + jsonBytes2(candidate.renderedToolCall) + utf8Bytes(
    candidate.forceLiteral ? candidate.resultText : baselineCapsules.get(candidate) ?? candidate.resultText
  ), 0);
  const overBudget = baselineTotal > budgetBytes;
  const seenResults = /* @__PURE__ */ new Set();
  const novel = /* @__PURE__ */ new Map();
  for (const candidate of candidates) {
    const isNovel = !seenResults.has(candidate.resultText);
    novel.set(candidate, isNovel);
    seenResults.add(candidate.resultText);
  }
  const passThrough = candidates.filter(
    (candidate) => candidate.fixedCapsule === void 0 && !candidate.requiresCapsule
  );
  const adjustable = candidates.filter((candidate) => !candidate.forceLiteral);
  const callAndForcedBytes = candidates.reduce((total, candidate) => total + jsonBytes2(candidate.renderedToolCall) + (candidate.forceLiteral ? utf8Bytes(candidate.resultText) : 0), 0);
  const share = adjustable.length === 0 ? capsuleMaxBytes : Math.max(0, Math.floor(Math.max(0, budgetBytes - callAndForcedBytes) / adjustable.length));
  const capsules = new Map(baselineCapsules);
  if (overBudget) {
    for (const candidate of adjustable) {
      const maxBytes = candidate.isError ? capsuleMaxBytes : Math.min(capsuleMaxBytes, share);
      const admitted = baselineCapsules.get(candidate);
      capsules.set(
        candidate,
        admitted !== void 0 && utf8Bytes(admitted) <= maxBytes ? admitted : candidate.capsule(maxBytes)
      );
    }
  }
  const literal = new Set(
    candidates.filter((candidate) => candidate.forceLiteral)
  );
  if (!overBudget) {
    for (const candidate of passThrough) literal.add(candidate);
  } else {
    let selectedBytes = candidates.reduce((total, candidate) => total + jsonBytes2(candidate.renderedToolCall) + utf8Bytes(
      candidate.forceLiteral ? candidate.resultText : capsules.get(candidate) ?? ""
    ), 0);
    const optional = passThrough.filter((candidate) => !candidate.forceLiteral).map((candidate, sourceOrder) => ({
      candidate,
      sourceOrder,
      priority: literalPriority(candidate, novel.get(candidate) ?? false)
    })).sort((left, right) => left.priority - right.priority || left.sourceOrder - right.sourceOrder);
    for (const { candidate, priority } of optional) {
      const capsule = capsules.get(candidate) ?? "";
      const delta = utf8Bytes(candidate.resultText) - utf8Bytes(capsule);
      if (delta <= 0) {
        literal.add(candidate);
        selectedBytes += delta;
        continue;
      }
      const failureAllowance = priority === 0 && utf8Bytes(candidate.resultText) <= capsuleMaxBytes ? capsuleMaxBytes : 0;
      if (selectedBytes + delta <= budgetBytes + failureAllowance) {
        literal.add(candidate);
        selectedBytes += delta;
      }
    }
  }
  return candidates.map((candidate) => {
    const result = candidate.forceLiteral ? { kind: "literal" } : !overBudget && baselineCapsules.has(candidate) ? { kind: "capsule", text: baselineCapsules.get(candidate) } : literal.has(candidate) ? { kind: "literal" } : { kind: "capsule", text: capsules.get(candidate) };
    const selectedResultText = result.kind === "literal" ? candidate.resultText : result.text;
    return {
      view: {
        schema: FIXED_EXCHANGE_VIEW_SCHEMA,
        generation: FIXED_EXCHANGE_VIEW_GENERATION,
        exchangeId: candidate.exchangeId,
        toolCallId: candidate.toolCallId,
        ...candidate.compactCallArguments === void 0 ? {} : { callArguments: candidate.compactCallArguments },
        result,
        visibleBytes: jsonBytes2(candidate.renderedToolCall) + utf8Bytes(selectedResultText),
        ...candidate.replayOriginKey === void 0 ? {} : { replayOriginKey: candidate.replayOriginKey }
      },
      foldedResult: candidate.fixedCapsule === void 0 && result.kind === "capsule",
      ...result.kind === "capsule" ? { capsule: result.text } : {}
    };
  });
}
function toolCall(block) {
  if (!block || typeof block !== "object") return false;
  const value = block;
  return value.type === "toolCall" && typeof value.id === "string" && Boolean(value.arguments) && typeof value.arguments === "object" && !Array.isArray(value.arguments);
}
function hasOpaqueReplayMetadata(block) {
  const carriesOpaqueField = (value, depth) => {
    if (!value || typeof value !== "object" || depth > 3) return false;
    return Object.entries(value).some(
      ([key, child]) => /(?:signature|signed|encrypted|opaque)/iu.test(key) && child !== void 0 && child !== null || carriesOpaqueField(child, depth + 1)
    );
  };
  return Object.entries(block).some(
    ([key, value]) => !["type", "id", "name", "arguments"].includes(key) && (/(?:signature|signed|encrypted|opaque)/iu.test(key) || carriesOpaqueField(value, 1)) && value !== void 0 && value !== null
  );
}
function hasOpaqueResultContent(content) {
  return Array.isArray(content) && content.some((block) => block && typeof block === "object" && hasOpaqueReplayMetadata(block));
}
function sameJson(left, right) {
  if (left === right) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}
function projectResultContent(content, text) {
  if (!Array.isArray(content)) return content;
  let wroteText = false;
  let changed = false;
  const projected = [];
  for (const block of content) {
    if (!block || typeof block !== "object" || block.type !== "text" || hasOpaqueReplayMetadata(block)) {
      projected.push(block);
      continue;
    }
    if (wroteText) {
      changed = true;
      continue;
    }
    wroteText = true;
    const original = block;
    if (original.text === text) projected.push(block);
    else {
      changed = true;
      projected.push({ ...original, text });
    }
  }
  return wroteText && changed ? projected : content;
}
function viewMap(views) {
  return Array.isArray(views) ? new Map(views.map((view) => [view.toolCallId, view])) : views;
}
function projectFixedExchangeViews(messages, viewsInput, activeModelKey) {
  const views = viewMap(viewsInput);
  if (views.size === 0) return messages;
  const callIds = /* @__PURE__ */ new Set();
  const resultIds = /* @__PURE__ */ new Set();
  for (const message of messages) {
    if (message.role === "assistant" && Array.isArray(message.content)) {
      for (const block of message.content) if (toolCall(block)) callIds.add(block.id);
    }
    if (message.role === "toolResult" && typeof message.toolCallId === "string") {
      resultIds.add(message.toolCallId);
    }
  }
  const complete = new Set([...callIds].filter((id) => resultIds.has(id) && views.has(id)));
  if (complete.size === 0) return messages;
  let anyChanged = false;
  const projected = messages.map((message) => {
    if (message.role === "assistant" && Array.isArray(message.content)) {
      let contentChanged = false;
      const content = message.content.map((block) => {
        if (!toolCall(block) || !complete.has(block.id)) return block;
        const view = views.get(block.id);
        const sameReplayOrigin = view.replayOriginKey !== void 0 && (activeModelKey === void 0 || activeModelKey === view.replayOriginKey);
        if (view.callArguments === void 0 || sameReplayOrigin || hasOpaqueReplayMetadata(block) || sameJson(block.arguments, view.callArguments)) return block;
        contentChanged = true;
        return { ...block, arguments: view.callArguments };
      });
      if (!contentChanged) return message;
      anyChanged = true;
      return { ...message, content };
    }
    if (message.role === "toolResult" && typeof message.toolCallId === "string" && complete.has(message.toolCallId)) {
      const view = views.get(message.toolCallId);
      if (view.result.kind === "literal") return message;
      const content = projectResultContent(message.content, view.result.text);
      if (content === message.content) return message;
      anyChanged = true;
      return { ...message, content };
    }
    return message;
  });
  return anyChanged ? projected : messages;
}
function foldProjection(messages, entryRefs, fold, foldMessageEntryId, foldPrefixEntryIds) {
  if (!fold || !entryRefs || !foldMessageEntryId || !foldPrefixEntryIds || !foldPrefixEntryIds.has(fold.throughEntryId) || foldPrefixEntryIds.has(foldMessageEntryId) || new Set(fold.retainedEntryIds).size !== fold.retainedEntryIds.length || fold.retainedEntryIds.some((id) => !foldPrefixEntryIds.has(id))) {
    return { messages, ...entryRefs === void 0 ? {} : { entryRefs: entryRefs.map((ref) => ({ ...ref })) } };
  }
  const indices = /* @__PURE__ */ new Set();
  const ids = /* @__PURE__ */ new Set();
  for (const ref of entryRefs) {
    if (ref.messageIndex < 0 || ref.messageIndex >= messages.length || indices.has(ref.messageIndex) || ids.has(ref.entryId)) {
      return { messages, entryRefs: entryRefs.map((item) => ({ ...item })) };
    }
    indices.add(ref.messageIndex);
    ids.add(ref.entryId);
  }
  const retained = new Set(fold.retainedEntryIds);
  const refByIndex = new Map(entryRefs.map((ref) => [ref.messageIndex, ref.entryId]));
  const keptIndices = [];
  for (let index = 0; index < messages.length; index += 1) {
    const id = refByIndex.get(index);
    if (id === void 0 || !foldPrefixEntryIds.has(id) || retained.has(id)) keptIndices.push(index);
  }
  if (keptIndices.length === messages.length) return { messages, entryRefs: entryRefs.map((ref) => ({ ...ref })) };
  const rebased = new Map(keptIndices.map((source, target) => [source, target]));
  return {
    messages: keptIndices.map((index) => messages[index]),
    entryRefs: entryRefs.flatMap((ref) => {
      const messageIndex = rebased.get(ref.messageIndex);
      return messageIndex === void 0 ? [] : [{ messageIndex, entryId: ref.entryId }];
    })
  };
}
function stripModelDetails(messages) {
  let changed = false;
  const projected = messages.map((message) => {
    if (!("details" in message) || message.details === void 0) return message;
    changed = true;
    const { details: _details, ...visible } = message;
    return visible;
  });
  return changed ? projected : messages;
}
function stableModelControls(messages, entryRefs, sources) {
  if (!entryRefs || !sources || sources.size === 0) return messages;
  const sourceByIndex = new Map(entryRefs.flatMap((ref) => {
    const source = sources.get(ref.entryId);
    return source ? [[ref.messageIndex, source]] : [];
  }));
  if (sourceByIndex.size === 0) return messages;
  const controls = messages.map((message, index) => sourceByIndex.get(index) ?? message);
  const mapped = mapStableControlMessages(controls);
  let changed = false;
  const projected = messages.map((message, index) => {
    const source = sourceByIndex.get(index);
    if (!source || mapped[index] === source) return message;
    changed = true;
    return { ...message, content: mapped[index].content };
  });
  return changed ? projected : messages;
}
function appendProviderTextMessage(messages, text) {
  return [...messages, {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: 0
  }];
}
function imagePlaceholder(image) {
  const dimensions = image.width && image.height ? `${image.width}x${image.height}` : "unknown";
  return {
    type: "text",
    text: `<prime_context_image ref="${escapeXml(image.ref)}" mime="${escapeXml(image.mimeType)}" bytes="${image.bytes}" dimensions="${dimensions}">
Tool-generated image was shown once. Inspect this ref to view it again.
</prime_context_image>`
  };
}
var PROVIDER_IMAGE_MIME_TYPES = /* @__PURE__ */ new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
var PROVIDER_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
var PROVIDER_IMAGE_TOTAL_BYTES = 16 * 1024 * 1024;
function projectLeasedContent(messages, input) {
  const shownRecoveryToolCallIds = [];
  const shownImageRefs = [];
  let projectedImageBytes = 0;
  const provider = input.purpose === "provider";
  const images = /* @__PURE__ */ new Map();
  const freshImageRefs = /* @__PURE__ */ new Set();
  for (const [toolCallId, view] of viewMap(input.fixedViews)) {
    if (view.images?.length) images.set(toolCallId, view.images);
  }
  for (const [toolCallId, refs] of input.pendingImages ?? []) {
    if (!images.has(toolCallId)) images.set(toolCallId, refs);
    for (const image of refs) freshImageRefs.add(image.ref);
  }
  let changed = false;
  const projected = messages.map((message) => {
    if (message.role !== "toolResult" || typeof message.toolCallId !== "string" || !Array.isArray(message.content)) {
      return message;
    }
    const lease = provider ? input.recoveryLeases?.get(message.toolCallId) : void 0;
    if (lease) {
      shownRecoveryToolCallIds.push(message.toolCallId);
      changed = true;
      return { ...message, content: lease.content.map((block) => ({ ...block })) };
    }
    const descriptors = images.get(message.toolCallId);
    if (descriptors === void 0) return message;
    let imageIndex = 0;
    let contentChanged = false;
    const content = message.content.map((block) => {
      if (!block || typeof block !== "object" || block.type !== "image") return block;
      const descriptor = descriptors[imageIndex++];
      const opaque = hasOpaqueReplayMetadata(block);
      if (!descriptor) {
        if (opaque) return block;
        contentChanged = true;
        return {
          type: "text",
          text: `<prime_context_image tool_call="${escapeXml(String(message.toolCallId))}" index="${imageIndex}">
Image descriptor omitted by the bounded pending-media budget. Inspect the archived tool result to recover it.
</prime_context_image>`
        };
      }
      if (opaque) {
        if (provider && !input.consumedImageRefs?.has(descriptor.ref)) shownImageRefs.push(descriptor.ref);
        return block;
      }
      if (provider && PROVIDER_IMAGE_MIME_TYPES.has(descriptor.mimeType.toLowerCase()) && descriptor.bytes <= PROVIDER_IMAGE_MAX_BYTES && projectedImageBytes + descriptor.bytes <= PROVIDER_IMAGE_TOTAL_BYTES && freshImageRefs.has(descriptor.ref) && !input.consumedImageRefs?.has(descriptor.ref)) {
        shownImageRefs.push(descriptor.ref);
        projectedImageBytes += descriptor.bytes;
        return block;
      }
      contentChanged = true;
      return imagePlaceholder(descriptor);
    });
    if (!contentChanged) return message;
    changed = true;
    return { ...message, content };
  });
  return {
    messages: changed ? projected : messages,
    shownRecoveryToolCallIds,
    shownImageRefs
  };
}
function projectBashExecutionViews(messages, entryRefs, sourceMessages, views) {
  if (!entryRefs || !sourceMessages) return messages;
  const byIndex = new Map(entryRefs.map((ref) => [ref.messageIndex, ref.entryId]));
  const fixed = viewMap(views);
  let changed = false;
  const projected = messages.map((message, messageIndex) => {
    const entryId2 = byIndex.get(messageIndex);
    const source = entryId2 ? sourceMessages.get(entryId2) : void 0;
    const view = entryId2 ? fixed.get(entryId2) : void 0;
    if (source?.role !== "bashExecution" || !view) return message;
    const compactCommand = typeof view.callArguments?.command === "string" ? view.callArguments.command : source.command;
    const compactOutput = view.result.kind === "capsule" ? view.result.text : source.output;
    if (compactCommand === source.command && compactOutput === source.output) return message;
    const { fullOutputPath: _fullOutputPath, ...rest } = source;
    changed = true;
    return providerMessageFromSource({
      ...rest,
      command: compactCommand,
      output: compactOutput,
      truncated: false
    });
  });
  return changed ? projected : messages;
}
function projectModelContext(input) {
  const stable = stableModelControls(input.messages, input.entryRefs, input.sourceMessages);
  const folded = foldProjection(
    stable,
    input.entryRefs,
    input.fold,
    input.foldMessageEntryId,
    input.foldPrefixEntryIds
  );
  let messages = projectFixedExchangeViews(
    folded.messages,
    input.fixedViews,
    input.activeModelKey
  );
  messages = projectBashExecutionViews(
    messages,
    folded.entryRefs,
    input.sourceMessages,
    input.fixedViews
  );
  const leased = projectLeasedContent(messages, input);
  messages = stripModelDetails(leased.messages);
  return {
    messages,
    ...folded.entryRefs === void 0 ? {} : { entryRefs: folded.entryRefs },
    ...leased.shownRecoveryToolCallIds.length === 0 ? {} : {
      shownRecoveryToolCallIds: leased.shownRecoveryToolCallIds
    },
    ...leased.shownImageRefs.length === 0 ? {} : { shownImageRefs: leased.shownImageRefs }
  };
}
function bashExecutionText(message) {
  const output = typeof message.output === "string" ? message.output : "";
  let rendered;
  if (output) {
    let longest = 0;
    for (const match of output.matchAll(/`+/g)) longest = Math.max(longest, match[0].length);
    const fence = "`".repeat(Math.max(3, longest + 1));
    rendered = `${fence}
${output}
${fence}`;
  } else rendered = "(no output)";
  if (message.cancelled === true) rendered += "\n\n(command cancelled)";
  else if (typeof message.exitCode === "number" && message.exitCode !== 0) {
    rendered += `

Command exited with code ${message.exitCode}`;
  }
  if (message.truncated === true) {
    rendered += typeof message.fullOutputPath === "string" ? `

[Output truncated. Full output: ${message.fullOutputPath}]` : "\n\n[Output truncated.]";
  }
  return `Ran \`${typeof message.command === "string" ? message.command : ""}\`
${rendered}`;
}
function providerMessageFromSource(message) {
  if (message.role === "custom") {
    return {
      role: "user",
      content: typeof message.content === "string" ? [{ type: "text", text: message.content }] : message.content,
      timestamp: typeof message.timestamp === "number" ? message.timestamp : 0
    };
  }
  if (message.role === "bashExecution") {
    return {
      role: "user",
      content: [{ type: "text", text: bashExecutionText(message) }],
      timestamp: typeof message.timestamp === "number" ? message.timestamp : 0
    };
  }
  return message;
}
function projectFoldCandidateMessages(entries, views, purpose = "provider", fold, foldMessageEntryId, foldPrefixEntryIds) {
  const sourceMessages = new Map(entries.map((entry) => [entry.entryId, entry.message]));
  const entryRefs = entries.map((entry, messageIndex) => ({ messageIndex, entryId: entry.entryId }));
  const messages = entries.map((entry) => providerMessageFromSource(entry.message));
  const projected = projectModelContext({
    purpose,
    messages,
    entryRefs,
    fixedViews: views,
    fold,
    foldMessageEntryId,
    foldPrefixEntryIds,
    sourceMessages
  });
  return {
    messages: projected.messages,
    entryRefs: projected.entryRefs ?? entryRefs,
    sourceMessages,
    shownImageRefs: projected.shownImageRefs
  };
}
function messageBlocks(message) {
  return Array.isArray(message.content) ? message.content.filter((part) => Boolean(part) && typeof part === "object") : [];
}
function hasMedia(message) {
  return messageBlocks(message).some((part) => part.type === "image" || part.type === "audio" || part.type === "file");
}
function safeFoldIndices(entries, eligibleEntryIds, views) {
  const safe = /* @__PURE__ */ new Set();
  const resultIndex = /* @__PURE__ */ new Map();
  const duplicateResults = /* @__PURE__ */ new Set();
  const callCounts = /* @__PURE__ */ new Map();
  const allResultIds = /* @__PURE__ */ new Set();
  for (let index = 0; index < entries.length; index += 1) {
    const message = entries[index].message;
    if (message.role === "toolResult" && typeof message.toolCallId === "string") {
      if (allResultIds.has(message.toolCallId)) duplicateResults.add(message.toolCallId);
      allResultIds.add(message.toolCallId);
      if (eligibleEntryIds.has(entries[index].entryId)) resultIndex.set(message.toolCallId, index);
    }
    if (message.role === "assistant") {
      for (const call of messageBlocks(message).filter(toolCall)) {
        callCounts.set(call.id, (callCounts.get(call.id) ?? 0) + 1);
      }
    }
  }
  const latestControl = /* @__PURE__ */ new Map();
  for (let index = 0; index < entries.length; index += 1) {
    const type = entries[index].message.customType;
    if (type === PRIME_CONTEXT_ANCHOR_TYPE || type === PRIME_CONTEXT_STATE_TYPE || type === PRIME_CONTEXT_FOLD_TYPE) {
      latestControl.set(type, index);
    }
  }
  for (let index = 0; index < entries.length; index += 1) {
    if (!eligibleEntryIds.has(entries[index].entryId)) continue;
    const message = entries[index].message;
    if (message.role === "assistant") {
      const blocks = messageBlocks(message);
      const calls = blocks.filter(toolCall);
      if (calls.length === 0 || calls.length !== blocks.length || calls.some(hasOpaqueReplayMetadata) || calls.some((call) => callCounts.get(call.id) !== 1 || duplicateResults.has(call.id))) continue;
      const results = calls.map((call) => resultIndex.get(call.id));
      if (results.some((result) => result === void 0) || calls.some((call) => !views.has(call.id))) continue;
      if (results.some((result) => hasOpaqueResultContent(entries[result].message.content) || hasMedia(entries[result].message))) continue;
      safe.add(index);
      for (const result of results) safe.add(result);
      continue;
    }
    if (message.role === "custom") {
      if (hasMedia(message)) continue;
      const type = message.customType ?? "";
      const supersededControl = type === PRIME_CONTEXT_FOLD_TYPE || (type === PRIME_CONTEXT_ANCHOR_TYPE || type === PRIME_CONTEXT_STATE_TYPE) && (latestControl.get(type) ?? index) > index;
      const fixedControl = /(?:capsule|delta|receipt|compact_tick|goal_tick|ipython_(?:state|state_restored))/i.test(type);
      if (supersededControl || fixedControl) safe.add(index);
    }
  }
  return safe;
}
function asViewMap(views) {
  return Array.isArray(views) ? new Map(views.map((view) => [view.toolCallId, view])) : views;
}
function selectFoldGeneration(entries, viewsInput, pressure, current, render, rawOrder) {
  if (!pressure || pressure.tokens === null || pressure.contextWindow <= 0 || pressure.tokens / pressure.contextWindow <= 0.65) return void 0;
  const turnStarts = entries.flatMap((entry, index) => entry.message.role === "user" || entry.message.role === "assistant" || entry.message.role === "bashExecution" ? [index] : []);
  if (turnStarts.length <= 4) return void 0;
  const cutoffExclusive = turnStarts[turnStarts.length - 4];
  if (cutoffExclusive <= 0) return void 0;
  const throughEntryId = entries[cutoffExclusive - 1]?.entryId;
  if (!throughEntryId) return void 0;
  const rawEntryIds = rawOrder?.entryIds ?? entries.map((entry) => entry.entryId);
  const rawIndex = new Map(rawEntryIds.map((id, index) => [id, index]));
  const entryIndex = new Map(entries.map((entry, index) => [entry.entryId, index]));
  if (rawEntryIds.some((id) => !id) || rawIndex.size !== rawEntryIds.length || entries.some((entry) => !rawIndex.has(entry.entryId)) || entryIndex.size !== entries.length) {
    return void 0;
  }
  const candidateRawCutoff = rawIndex.get(throughEntryId);
  if (candidateRawCutoff === void 0) return void 0;
  const candidateRawIds = rawEntryIds.slice(0, candidateRawCutoff + 1);
  const candidatePrefix = new Set(candidateRawIds);
  const previousRetained = new Set(current?.retainedEntryIds ?? []);
  if (current && (previousRetained.size !== current.retainedEntryIds.length || previousRetained.size > 256)) {
    return void 0;
  }
  const currentPrefix = /* @__PURE__ */ new Set();
  let currentRawCutoff = -1;
  if (current) {
    currentRawCutoff = rawIndex.get(current.throughEntryId) ?? -1;
    const foldMessageIndex = rawOrder?.currentFoldMessageEntryId ? rawIndex.get(rawOrder.currentFoldMessageEntryId) ?? -1 : -1;
    if (currentRawCutoff < 0 || candidateRawCutoff <= currentRawCutoff || foldMessageIndex <= currentRawCutoff || candidateRawCutoff <= foldMessageIndex) {
      return void 0;
    }
    for (let index = 0; index <= currentRawCutoff; index += 1) currentPrefix.add(rawEntryIds[index]);
    if ([...previousRetained].some((id) => !currentPrefix.has(id))) return void 0;
  }
  const oldHidden = /* @__PURE__ */ new Set();
  for (const id of currentPrefix) {
    if (!previousRetained.has(id)) oldHidden.add(id);
  }
  const views = asViewMap(viewsInput);
  const safe = safeFoldIndices(entries, candidatePrefix, views);
  const unsafeVisible = new Set(entries.flatMap((entry, index) => candidatePrefix.has(entry.entryId) && !oldHidden.has(entry.entryId) && !safe.has(index) ? [entry.entryId] : []));
  const retainedEntryIds = candidateRawIds.filter((id) => unsafeVisible.has(id));
  if (retainedEntryIds.length > 256) return void 0;
  const retained = new Set(retainedEntryIds);
  const projected = projectFoldCandidateMessages(entries, views).messages;
  let incrementalBytes = 0;
  let hiddenCount = 0;
  for (let raw = currentRawCutoff + 1; raw <= candidateRawCutoff; raw += 1) {
    const id = rawEntryIds[raw];
    const modelIndex = entryIndex.get(id);
    if (modelIndex === void 0 || retained.has(id)) continue;
    incrementalBytes += utf8Bytes(JSON.stringify(projected[modelIndex]));
    hiddenCount += 1;
  }
  const savedTokens = Math.floor(incrementalBytes / 4);
  if (hiddenCount === 0 || savedTokens < 8e3 && savedTokens < pressure.tokens * 0.15) return void 0;
  const generation = (current?.generation ?? 0) + 1;
  const renderedMessage = render(generation, throughEntryId);
  if (utf8Bytes(renderedMessage) > 4096) return void 0;
  return { generation, throughEntryId, retainedEntryIds, renderedMessage };
}
function smallVisibleText(message, maxBytes = 2048) {
  if (hasMedia(message)) return void 0;
  if (typeof message.content === "string") return utf8Bytes(message.content) <= maxBytes ? message.content : void 0;
  if (!Array.isArray(message.content)) return "";
  const blocks = messageBlocks(message);
  if (blocks.some((part) => part.type === "thinking" || part.type === "toolCall")) return void 0;
  if (blocks.some((part) => part.type !== "text")) return void 0;
  const text = blocks.map((part) => typeof part.text === "string" ? part.text : "").join("\n");
  return utf8Bytes(text) <= maxBytes ? text : void 0;
}
function deterministicFastSummary(input) {
  const refs = new Map(input.entryRefs.map((ref) => [ref.messageIndex, ref.entryId]));
  if (input.messages.some((_message, index) => !refs.has(index))) return void 0;
  const views = asViewMap(input.fixedViews);
  const resultIndex = /* @__PURE__ */ new Map();
  const duplicateResults = /* @__PURE__ */ new Set();
  for (let index = 0; index < input.messages.length; index += 1) {
    const message = input.messages[index];
    if (message.role !== "toolResult" || typeof message.toolCallId !== "string") continue;
    if (resultIndex.has(message.toolCallId)) duplicateResults.add(message.toolCallId);
    resultIndex.set(message.toolCallId, index);
  }
  if (duplicateResults.size > 0) return void 0;
  const consumed = /* @__PURE__ */ new Set();
  const tape = [];
  for (let index = 0; index < input.messages.length; index += 1) {
    if (consumed.has(index)) continue;
    const message = input.messages[index];
    const ref = refs.get(index);
    const source = input.sourceMessages?.get(ref);
    if (source?.role === "custom") {
      if (hasMedia(source) || !/(?:capsule|delta|fold|receipt|compact_tick|goal_(?:context|tick)|ipython_(?:state|state_restored)|prime_context_(?:anchor|state))/i.test(source.customType ?? "")) {
        return void 0;
      }
      const text = smallVisibleText(message, 8192);
      if (text === void 0) return void 0;
      tape.push(`- ref=${escapeXml(ref)} control=${escapeXml(source.customType ?? "custom")} content=${escapeXml(JSON.stringify(text))}`);
      continue;
    }
    if (message.role === "assistant") {
      const blocks = messageBlocks(message);
      const calls = blocks.filter(toolCall);
      if (calls.length > 0) {
        if (calls.length !== blocks.length || calls.some(hasOpaqueReplayMetadata) || new Set(calls.map((call) => call.id)).size !== calls.length) return void 0;
        const results = calls.map((call) => resultIndex.get(call.id));
        if (results.some((result) => result === void 0) || calls.some((call) => !views.has(call.id))) return void 0;
        for (let offset = 0; offset < calls.length; offset += 1) {
          const result = results[offset];
          if (result < index || consumed.has(result) || hasMedia(input.messages[result]) || hasOpaqueResultContent(input.messages[result].content)) return void 0;
          const view = views.get(calls[offset].id);
          tape.push(`- ref=${escapeXml(ref)} exchange=${escapeXml(view.exchangeId)} tool=${escapeXml(String(calls[offset].name ?? "tool"))}`);
          consumed.add(result);
        }
        consumed.add(index);
        continue;
      }
      const text = smallVisibleText(message);
      if (text === void 0) return void 0;
      tape.push(`- ref=${escapeXml(ref)} assistant=${escapeXml(JSON.stringify(text))}`);
      continue;
    }
    if (message.role === "toolResult") return void 0;
    if (message.role === "user" || message.role === "bashExecution") {
      const text = smallVisibleText(message);
      if (text === void 0) return void 0;
      tape.push(`- ref=${escapeXml(ref)} user=${escapeXml(JSON.stringify(text))}`);
      continue;
    }
    if (message.role === "custom") {
      if (hasMedia(message)) return void 0;
      const type = message.customType ?? "";
      if (!/(?:capsule|delta|fold|receipt|compact_tick|goal_(?:context|tick)|ipython_(?:state|state_restored)|prime_context_(?:anchor|state))/i.test(type)) return void 0;
      const text = smallVisibleText(message, 8192);
      if (text === void 0) return void 0;
      tape.push(`- ref=${escapeXml(ref)} control=${escapeXml(type)} content=${escapeXml(JSON.stringify(text))}`);
      continue;
    }
    return void 0;
  }
  const read = input.fileOps?.readFiles ?? input.fileOps?.read ?? [];
  const modified = input.fileOps?.modifiedFiles ?? input.fileOps?.modified ?? [];
  const lines = ["<prime_context_compaction>"];
  if (input.previousSummary !== void 0) lines.push("previous_summary:", input.previousSummary);
  if (input.anchor) lines.push("current_anchor:", input.anchor);
  if (input.state) lines.push("current_state:", input.state);
  if (input.hiddenSteering?.length) {
    lines.push("hidden_steering:", ...input.hiddenSteering.map((text) => `- ${escapeXml(JSON.stringify(text))}`));
  }
  lines.push("file_operations:", `- read: ${escapeXml(read.join(", ") || "none")}`, `- modified: ${escapeXml(modified.join(", ") || "none")}`);
  if (tape.length) lines.push("chronological:", ...tape);
  lines.push("</prime_context_compaction>");
  return lines.join("\n");
}

// src/exchange.ts
function restorePersistedCommand(exchange) {
  if (exchange.persistedCall && exchange.toolName === "bash" && exchange.intent) {
    exchange.intent.command = typeof exchange.modelInput.command === "string" ? exchange.modelInput.command : "";
  }
}
function cloneRecord(value) {
  try {
    return structuredClone(value);
  } catch {
    return { ...value };
  }
}
function cloneUnknown(value) {
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
}
function boundedResultTextStats(content, maxBytes = Number.POSITIVE_INFINITY) {
  if (!Array.isArray(content)) {
    return { text: "", textBytes: 0, truncated: false, tail: "", samples: ["0", "", "", "", "", ""] };
  }
  let totalChars = 0;
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const candidate = block;
    if (candidate.type !== "text" || typeof candidate.text !== "string" || candidate.text.length === 0) continue;
    totalChars += candidate.text.length;
  }
  const centers = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.floor(totalChars * ratio));
  const windows = centers.map((center) => ({
    start: Math.max(0, center - 64),
    end: Math.min(totalChars, center + 64)
  }));
  const aggregateSamples = windows.map(() => "");
  const tailStart = Math.max(0, totalChars - 4096);
  const keptChunks = [];
  let pendingKept = [];
  let keptBytes = 0;
  let textBytes = 0;
  let tail = "";
  let charOffset = 0;
  const flushKept = () => {
    if (pendingKept.length === 0) return;
    keptChunks.push(pendingKept.join(""));
    pendingKept = [];
  };
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const candidate = block;
    if (candidate.type !== "text" || typeof candidate.text !== "string" || candidate.text.length === 0) continue;
    const value = candidate.text;
    const blockStart = charOffset;
    const blockEnd = blockStart + value.length;
    for (const [index, window] of windows.entries()) {
      const overlapStart = Math.max(blockStart, window.start);
      const overlapEnd = Math.min(blockEnd, window.end);
      if (overlapStart < overlapEnd) {
        aggregateSamples[index] += value.slice(overlapStart - blockStart, overlapEnd - blockStart);
      }
    }
    if (blockEnd > tailStart) {
      tail += value.slice(Math.max(0, tailStart - blockStart));
    }
    charOffset = blockEnd;
    const bytes = Buffer.byteLength(value, "utf8");
    textBytes += bytes;
    if (keptBytes >= maxBytes) continue;
    if (keptBytes + bytes <= maxBytes) {
      pendingKept.push(value);
      keptBytes += bytes;
      if (pendingKept.length >= 1024) flushKept();
      continue;
    }
    const remaining = Math.max(0, maxBytes - keptBytes);
    let low = 0;
    let high = Math.min(value.length, remaining);
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (Buffer.byteLength(value.slice(0, middle), "utf8") <= remaining) low = middle;
      else high = middle - 1;
    }
    if (low > 0) {
      const code = value.charCodeAt(low - 1);
      if (code >= 55296 && code <= 56319) low -= 1;
    }
    const prefix = value.slice(0, low);
    pendingKept.push(prefix);
    keptBytes += Buffer.byteLength(prefix, "utf8");
    flushKept();
  }
  flushKept();
  return {
    text: keptChunks.join(""),
    textBytes,
    truncated: textBytes > keptBytes,
    tail,
    samples: [String(totalChars), ...aggregateSamples]
  };
}
var joinedResultText = boundedResultTextStats;
var AGGREGATE_CALL_BYTES = 8 * 1024;
var AGGREGATE_FIELD_MARKER_BYTES = 768;
function jsonPointerToken(value) {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}
function aggregateFieldText(value) {
  if (typeof value === "string") {
    return { text: value, mediaType: "text/plain; charset=utf-8" };
  }
  try {
    const text = JSON.stringify(value);
    return text === void 0 ? void 0 : { text, mediaType: "application/json" };
  } catch {
    return void 0;
  }
}
function aggregateGenericCallParts(toolName, input, maxBytes = AGGREGATE_CALL_BYTES, preArchived = []) {
  const preArchivedSavings = preArchived.reduce((total, part) => total + Math.max(
    0,
    Buffer.byteLength(part.text ?? "", "utf8") - 1024
  ), 0);
  if (["edit", "ipython", "bash"].includes(toolName) || jsonBytes(input) - preArchivedSavings <= maxBytes) return [];
  const candidates = Object.entries(input).flatMap(([key, value]) => {
    const serialized = aggregateFieldText(value);
    if (!serialized) return [];
    const textBytes = Buffer.byteLength(serialized.text, "utf8");
    if (textBytes <= AGGREGATE_FIELD_MARKER_BYTES || textBytes > maxBytes) return [];
    return [{
      key,
      textBytes,
      part: {
        name: "call",
        kind: "call-field",
        pointer: `/${jsonPointerToken(key)}`,
        mediaType: serialized.mediaType,
        text: serialized.text
      }
    }];
  }).sort((left, right) => right.textBytes - left.textBytes || left.key.localeCompare(right.key));
  let projectedBytes = jsonBytes(input) - preArchivedSavings;
  const selected = [];
  for (const candidate of candidates) {
    selected.push(candidate.part);
    projectedBytes -= candidate.textBytes - AGGREGATE_FIELD_MARKER_BYTES;
    if (projectedBytes <= maxBytes) break;
  }
  if (projectedBytes <= maxBytes) return selected;
  const root = aggregateFieldText(input);
  return root ? [{
    name: "call",
    kind: "call-field",
    pointer: "",
    mediaType: "application/json",
    text: root.text
  }] : selected;
}
var SEMANTIC_DETAIL_KEYS = [
  "fullOutputPath",
  "status",
  "error",
  "errorEname",
  "diffs",
  "resources",
  "exitCode",
  "code",
  "signal",
  "firstChangedLine",
  "middlewareTag",
  "stdout",
  "stderr",
  "result",
  "traceback"
];
function semanticDetailsSnapshot(value, depth = 0) {
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    const textBytes = Buffer.byteLength(value, "utf8");
    if (textBytes <= 2048) return value;
    const samples = [];
    for (const ratio of [0.25, 0.5, 0.75]) {
      const center = Math.floor(value.length * ratio);
      samples.push(value.slice(Math.max(0, center - 64), Math.min(value.length, center + 64)));
    }
    return { textBytes, head: value.slice(0, 512), tail: value.slice(-512), samples };
  }
  if (Array.isArray(value)) {
    return {
      length: value.length,
      values: value.slice(0, 32).map((item) => semanticDetailsSnapshot(item, depth + 1))
    };
  }
  if (!value || typeof value !== "object" || depth >= 4) return typeof value;
  const object = value;
  const keys = [...Object.keys(object)].sort((left, right) => {
    const leftPriority = SEMANTIC_DETAIL_KEYS.indexOf(left);
    const rightPriority = SEMANTIC_DETAIL_KEYS.indexOf(right);
    const leftRank = leftPriority < 0 ? SEMANTIC_DETAIL_KEYS.length : leftPriority;
    const rightRank = rightPriority < 0 ? SEMANTIC_DETAIL_KEYS.length : rightPriority;
    return leftRank - rightRank || left.localeCompare(right);
  }).slice(0, 32);
  return Object.fromEntries(keys.map((key) => [key, semanticDetailsSnapshot(object[key], depth + 1)]));
}
function sameJson2(left, right) {
  if (left === right) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}
function fullOutputPath(details) {
  if (!details || typeof details !== "object") return void 0;
  const path = details.fullOutputPath;
  return typeof path === "string" ? path : void 0;
}
function persistedToolCalls(message) {
  if (message.role !== "assistant" || !Array.isArray(message.content)) return [];
  return message.content.filter((block) => {
    if (!block || typeof block !== "object") return false;
    const candidate = block;
    return candidate.type === "toolCall" && typeof candidate.id === "string" && typeof candidate.name === "string" && Boolean(candidate.arguments) && typeof candidate.arguments === "object";
  });
}
var ExchangeTracker = class {
  constructor(maxPending = 256) {
    this.maxPending = maxPending;
  }
  maxPending;
  pending = /* @__PURE__ */ new Map();
  sequence = 0;
  resetSession() {
    this.pending.clear();
    this.sequence = 0;
  }
  clearPending() {
    this.pending.clear();
  }
  setMinimumSequence(sequence) {
    if (Number.isSafeInteger(sequence) && sequence > this.sequence) this.sequence = sequence;
  }
  reset() {
    this.resetSession();
  }
  start(event) {
    const existing = this.pending.get(event.toolCallId);
    if (existing) return existing;
    this.makeRoom();
    this.sequence += 1;
    const modelInput = cloneRecord(event.args);
    const exchange = {
      id: `o${this.sequence}`,
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      sourceOrder: this.sequence,
      modelInput,
      persistedCall: false,
      rawCall: {
        type: "toolCall",
        id: event.toolCallId,
        name: event.toolName,
        arguments: modelInput
      },
      completed: false
    };
    this.pending.set(event.toolCallId, exchange);
    return exchange;
  }
  noteCall(event, cwd, toolSchema) {
    const exchange = this.pending.get(event.toolCallId) ?? this.start({
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      args: event.input
    });
    exchange.executedInput = cloneRecord(event.input);
    exchange.toolSchema = toolSchema;
    exchange.cwd = cwd;
    exchange.intent = adaptToolIntent({
      exchangeId: exchange.id,
      toolCallId: exchange.toolCallId,
      toolName: event.toolName,
      input: exchange.executedInput,
      cwd,
      modelInputBytes: jsonBytes(exchange.modelInput),
      toolSchema: exchange.toolSchema
    });
    restorePersistedCommand(exchange);
    return exchange;
  }
  noteResult(event, cwd, resultText, archive) {
    const exchange = this.pending.get(event.toolCallId) ?? this.start({
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      args: event.input
    });
    exchange.executedInput = cloneRecord(event.input);
    exchange.cwd = cwd;
    exchange.intent = adaptToolIntent({
      exchangeId: exchange.id,
      toolCallId: exchange.toolCallId,
      toolName: event.toolName,
      input: exchange.executedInput,
      cwd,
      modelInputBytes: jsonBytes(exchange.modelInput),
      toolSchema: exchange.toolSchema,
      details: event.details,
      resultText: archive?.outcomeText ?? resultText,
      isError: event.isError
    });
    restorePersistedCommand(exchange);
    exchange.outcome = {
      isError: event.isError,
      outcome: collectFactualOutcome(exchange.intent, archive?.outcomeText ?? resultText, event.isError, event.details)
    };
    exchange.archiveSource = archive?.source;
    exchange.largeResult = archive?.large === true;
    exchange.resultSummary = archive?.resultSummary;
    exchange.archiveParts = archive?.parts?.map((part) => ({ ...part }));
    const observedResultText = archive?.visibleResultText ?? resultText;
    const observedBounded = joinedResultText([{ type: "text", text: observedResultText }], 1024 * 1024);
    exchange.observedResultBytes = archive?.visibleResultBytes ?? observedBounded.textBytes;
    exchange.observedResultPreview = observedBounded.text;
    exchange.observedResultTail = archive?.visibleResultTail ?? observedBounded.tail;
    exchange.observedResultSamples = archive?.visibleResultSamples ?? observedBounded.samples;
    exchange.observedResultTruncated = archive?.visibleResultTruncated === true || observedBounded.truncated;
    if (!exchange.observedResultTruncated && exchange.observedResultBytes <= 1024 * 1024) {
      exchange.observedResultText = observedResultText;
    } else {
      delete exchange.observedResultText;
    }
    exchange.observedFullOutputPath = fullOutputPath(event.details);
    exchange.observedSemanticDetails = semanticDetailsSnapshot(event.details);
    exchange.observedDetailsComparable = archive?.large !== true && exchange.observedResultBytes <= 1024 * 1024;
    if (exchange.observedDetailsComparable) exchange.observedResultDetails = cloneUnknown(event.details);
    else delete exchange.observedResultDetails;
    exchange.observedResultIsError = event.isError;
    if (archive?.retainResultText === false) delete exchange.resultText;
    else exchange.resultText = resultText;
    exchange.completed = true;
    return exchange;
  }
  noteFinalDetails(exchange, isError, details) {
    if (!exchange.intent) return;
    const outcomeText = exchange.resultSummary?.outcomeText ?? exchange.resultText ?? "";
    exchange.intent = adaptToolIntent({
      exchangeId: exchange.id,
      toolCallId: exchange.toolCallId,
      toolName: exchange.toolName,
      input: exchange.executedInput ?? exchange.modelInput,
      cwd: exchange.cwd ?? exchange.intent.effectiveCwd ?? "",
      modelInputBytes: jsonBytes(exchange.modelInput),
      toolSchema: exchange.toolSchema,
      details,
      resultText: outcomeText,
      isError
    });
    restorePersistedCommand(exchange);
    exchange.outcome = {
      isError,
      outcome: collectFactualOutcome(exchange.intent, outcomeText, isError, details)
    };
  }
  noteCanonicalResult(exchange, resolved, isError, details, parts) {
    exchange.archiveSource = resolved.source;
    exchange.archiveParts = parts.map((part) => ({ ...part }));
    exchange.resultText = resolved.text;
    exchange.largeResult = resolved.large === true;
    exchange.resultSummary = resolved;
    delete exchange.admittedCapsule;
    if (!exchange.intent) return;
    exchange.intent = adaptToolIntent({
      exchangeId: exchange.id,
      toolCallId: exchange.toolCallId,
      toolName: exchange.toolName,
      input: exchange.executedInput ?? exchange.modelInput,
      cwd: exchange.cwd ?? exchange.intent.effectiveCwd ?? "",
      modelInputBytes: jsonBytes(exchange.modelInput),
      toolSchema: exchange.toolSchema,
      details,
      resultText: resolved.outcomeText ?? resolved.text,
      isError
    });
    restorePersistedCommand(exchange);
    exchange.outcome = {
      isError,
      outcome: collectFactualOutcome(
        exchange.intent,
        resolved.outcomeText ?? resolved.text,
        isError,
        details
      )
    };
  }
  get(toolCallId) {
    return this.pending.get(toolCallId);
  }
  noteAdmittedCapsule(toolCallId, capsule) {
    const exchange = this.pending.get(toolCallId);
    if (exchange && capsule) exchange.admittedCapsule = capsule;
  }
  finishTurn(message, toolResults) {
    const order = /* @__PURE__ */ new Map();
    for (const [index, call] of persistedToolCalls(message).entries()) {
      order.set(call.id, index);
      const exchange = this.pending.get(call.id);
      if (exchange) {
        exchange.sourceOrder = index;
        exchange.rawCall = call;
        exchange.replayProtected = hasOpaqueReplayMetadata(call);
        exchange.persistedCall = true;
        exchange.modelInput = cloneRecord(call.arguments);
        if (exchange.intent) {
          exchange.intent.modelInputBytes = jsonBytes(call.arguments);
          if (exchange.toolName === "bash") {
            exchange.intent.command = typeof call.arguments.command === "string" ? call.arguments.command : "";
          }
        }
      }
    }
    const exactResults = toolResults === void 0 ? void 0 : new Map(toolResults.map((result) => [result.toolCallId, result]));
    const completed = [...this.pending.values()].filter((exchange) => exchange.completed && (exactResults === void 0 || exchange.persistedCall && exactResults.has(exchange.toolCallId))).sort((left, right) => {
      const leftOrder = order.get(left.toolCallId) ?? left.sourceOrder;
      const rightOrder = order.get(right.toolCallId) ?? right.sourceOrder;
      return leftOrder - rightOrder;
    });
    for (const exchange of completed) {
      const rawResult = exactResults?.get(exchange.toolCallId);
      exchange.rawResult = rawResult;
      if (!rawResult) continue;
      const persisted = joinedResultText(rawResult.content, exchange.largeResult ? 64 * 1024 : Number.POSITIVE_INFINITY);
      const persistedText = persisted.text;
      const persistedIsError = rawResult.isError ?? exchange.observedResultIsError ?? exchange.outcome?.isError ?? false;
      const textChanged = persisted.textBytes !== (exchange.observedResultBytes ?? 0) || (exchange.observedResultText !== void 0 && !persisted.truncated ? persistedText !== exchange.observedResultText : persistedText !== (exchange.observedResultPreview ?? "") || persisted.tail !== (exchange.observedResultTail ?? "") || !sameJson2(persisted.samples, exchange.observedResultSamples ?? []));
      const errorChanged = persistedIsError !== exchange.observedResultIsError;
      const finalSemanticDetails = semanticDetailsSnapshot(rawResult.details);
      const semanticDetailsChanged = !sameJson2(finalSemanticDetails, exchange.observedSemanticDetails);
      const detailsChanged = exchange.observedDetailsComparable === false ? semanticDetailsChanged : !sameJson2(rawResult.details, exchange.observedResultDetails);
      const pathChanged = fullOutputPath(rawResult.details) !== exchange.observedFullOutputPath;
      exchange.persistedResultChanged = textChanged || errorChanged || detailsChanged;
      exchange.persistedTextChanged = textChanged;
      exchange.persistedPathChanged = pathChanged;
      exchange.persistedCanonicalResultChanged = textChanged || errorChanged || pathChanged || exchange.toolName !== "bash" && semanticDetailsChanged;
      if (exchange.persistedResultChanged && exchange.intent) {
        const outcomeText = textChanged ? persistedText : exchange.resultSummary?.outcomeText ?? exchange.resultText ?? persistedText;
        exchange.intent = adaptToolIntent({
          exchangeId: exchange.id,
          toolCallId: exchange.toolCallId,
          toolName: exchange.toolName,
          input: exchange.executedInput ?? exchange.modelInput,
          cwd: exchange.cwd ?? exchange.intent.effectiveCwd ?? "",
          modelInputBytes: jsonBytes(exchange.modelInput),
          toolSchema: exchange.toolSchema,
          details: rawResult.details,
          resultText: outcomeText,
          isError: persistedIsError
        });
        if (exchange.toolName === "bash") {
          exchange.intent.command = typeof exchange.modelInput.command === "string" ? exchange.modelInput.command : "";
        }
        exchange.outcome = {
          isError: persistedIsError,
          outcome: collectFactualOutcome(exchange.intent, outcomeText, persistedIsError, rawResult.details)
        };
      }
    }
    for (const exchange of [...this.pending.values()].filter((candidate) => candidate.completed)) {
      this.pending.delete(exchange.toolCallId);
    }
    return completed;
  }
  toObservationMetadata(exchange, semantic = {}) {
    if (!exchange.intent || !exchange.outcome) return void 0;
    return {
      exchangeId: exchange.id,
      toolCallId: exchange.toolCallId,
      intentKind: exchange.intent.kind,
      subjectKey: exchange.intent.subjectKey,
      resources: [...exchange.intent.resources],
      suite: exchange.intent.suite ? { ...exchange.intent.suite } : void 0,
      effectiveCwd: exchange.intent.effectiveCwd,
      mutatesWorkspace: exchange.intent.mutatesWorkspace,
      modelInputBytes: exchange.intent.modelInputBytes,
      executedInputBytes: exchange.intent.executedInputBytes,
      facts: exchange.intent.facts ? { ...exchange.intent.facts } : void 0,
      outcome: exchange.outcome.outcome,
      ...semantic
    };
  }
  makeRoom() {
    if (this.pending.size < this.maxPending) return;
    const completed = [...this.pending.entries()].find(([, exchange]) => exchange.completed);
    this.pending.delete(completed?.[0] ?? this.pending.keys().next().value);
  }
};

// src/envelope.ts
import { createReadStream, createWriteStream } from "fs";
import { rename, rm } from "fs/promises";
import { once } from "events";
import { PassThrough } from "stream";
import { pipeline } from "stream/promises";
import { StringDecoder } from "string_decoder";
import { createGzip } from "zlib";
var LARGE_TEXT_BYTES = 1024 * 1024;
var TEXT_CHUNK_BYTES = 256 * 1024;
var SOURCE_READ_BYTES = 64 * 1024;
var KEPT_LINE_BYTES = 2048;
function safeTextSlices(text) {
  return {
    *[Symbol.iterator]() {
      let offset = 0;
      while (offset < text.length) {
        let end = Math.min(text.length, offset + SOURCE_READ_BYTES);
        if (end < text.length) {
          const code = text.charCodeAt(end - 1);
          if (code >= 55296 && code <= 56319) end -= 1;
        }
        yield Buffer.from(text.slice(offset, end), "utf8");
        offset = end;
      }
    }
  };
}
async function* sourceBytes(source, signal) {
  signal?.throwIfAborted();
  if (source.kind === "path") {
    const stream = createReadStream(source.path, { highWaterMark: SOURCE_READ_BYTES, signal });
    for await (const value of stream) {
      signal?.throwIfAborted();
      yield Buffer.isBuffer(value) ? value : Buffer.from(value);
    }
    return;
  }
  if (source.kind === "texts") {
    let trailingHighSurrogate = "";
    for (const text of source.texts()) {
      signal?.throwIfAborted();
      if (text.length === 0) continue;
      let value = trailingHighSurrogate + text;
      trailingHighSurrogate = "";
      const finalCode = value.charCodeAt(value.length - 1);
      if (finalCode >= 55296 && finalCode <= 56319) {
        trailingHighSurrogate = value.slice(-1);
        value = value.slice(0, -1);
      }
      for (const bytes of safeTextSlices(value)) {
        signal?.throwIfAborted();
        yield bytes;
      }
    }
    if (trailingHighSurrogate) yield Buffer.from(trailingHighSurrogate, "utf8");
    return;
  }
  if (source.kind === "bytes") {
    for (let offset = 0; offset < source.bytes.byteLength; offset += SOURCE_READ_BYTES) {
      signal?.throwIfAborted();
      yield Buffer.from(
        source.bytes.buffer,
        source.bytes.byteOffset + offset,
        Math.min(SOURCE_READ_BYTES, source.bytes.byteLength - offset)
      );
    }
    return;
  }
  for (const value of safeTextSlices(source.text)) {
    signal?.throwIfAborted();
    yield value;
  }
}
function truncateLine(value) {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.byteLength <= KEPT_LINE_BYTES) return value;
  let end = KEPT_LINE_BYTES - 3;
  while (end > 0 && (bytes[end] & 192) === 128) end -= 1;
  return `${bytes.subarray(0, end).toString("utf8")}...`;
}
function lineShape(value) {
  return value.trim().toLowerCase().replaceAll(/\b(?:0x[0-9a-f]+|\d+(?:\.\d+)?|[0-9a-f]{8,}(?:-[0-9a-f-]{4,})*)\b/gi, "#").slice(0, 160);
}
var TEST_SUMMARY_LINE = /TEST_RESULT|\b\d+\s+(?:passed|failed|skipped|xfailed|xpassed|deselected|warnings?)\b|\bTests run:\s*\d+,\s*Failures:|\b\d+\s+tests? completed\b|^\s*Ran\s+\d+\s+tests?(?:\s+in\b.*)?$|^\s*(?:Tests?:|Test Suites?:|Test Files|test result:)\s+.+$|^\s*(?:Found\s+\d+\s+errors?|Finished\s+(?:dev|test|release)\b|ok\s+\S+|FAIL\s+\S+|(?:\[[A-Z]+\]\s*)?build\s+(?:success(?:ful)?|fail(?:ed|ure)))\b.*$|^\s*(?:ok|failed\s*\([^)]*\))\s*$/i;
var FAILING_TEST_LINE = /^\s*(?:FAIL(?:ED)?\s+\S+|(?:FAIL|ERROR):\s+\S+|---\s+FAIL:\s+\S+|test\s+.+?\s+\.\.\.\s+FAILED|.+?\s+>\s+.+?\s+FAILED|●\s+\S+|(?:\[ERROR\]\s*)?\S+\s+--.+<<<\s+(?:FAILURE|ERROR)!)/i;
var EXCEPTION_LINE = /(?:Error|Exception)(?::|\s*$)/;
var SOURCE_LOCATION_LINE = /File "[^"]+", line \d+|[A-Za-z0-9_./-]+\.(?:py|ts|tsx|js|mjs|cjs|java|rs|go):\d+|[^\s]+\.(?:ts|tsx)\(\d+,\d+\)|-->\s+[^\s]+\.rs:\d+:\d+|[^\s]+\.java:\[\d+,\d+\]|^\s*[A-Za-z0-9_./\-]+\.(?:js|jsx|ts|tsx|mjs|cjs)\s*$/;
var COMMAND_STATUS_LINE = /(?:returned non-zero exit status|exit(?: code| status)?[:= ]+|^\s*(?:exit|rc|status)\s*[:=]?)\s*-?\d+/i;
var COMMAND_FAILURE_LINE = /^(?:\[[A-Z]+\]\s*)?(?:fatal:|error(?:\[[A-Z0-9]+\])?:|failed:)|\bcommand\b.*\bfailed\b|\bBUILD (?:FAILURE|FAILED)\b/i;
var DECISIVE_LINE = /\b(?:error|exception|traceback|assertion|failed|failure|fatal)\b/i;
var TRACE_LINE = /^\s*(?:trace|debug|progress)\b/i;
async function summarizePartSource(source, signal) {
  const decoder = new StringDecoder("utf8");
  const exact = [];
  const head = [];
  const tail = [];
  const signalSlots = {
    testSummaries: [],
    failingTests: [],
    exceptions: [],
    sourceLocations: [],
    commandStatuses: [],
    commandFailures: [],
    decisive: []
  };
  const shapes = /* @__PURE__ */ new Map();
  let traceShapeOverflow = 0;
  let traceLineCount = 0;
  let nonEmptyLineCount = 0;
  let textBytes = 0;
  let lineNumber = 1;
  let sawText = false;
  let linePrefix = "";
  let lineSuffix = "";
  let lineChars = 0;
  const consumeLineText = (value) => {
    lineChars += value.length;
    if (linePrefix.length < KEPT_LINE_BYTES) linePrefix += value.slice(0, KEPT_LINE_BYTES - linePrefix.length);
    lineSuffix = (lineSuffix + value).slice(-KEPT_LINE_BYTES);
  };
  const keepSignal = (slot, record4, limit) => {
    if (slot.some((value) => value.lineNumber === record4.lineNumber)) return;
    if (slot.length < limit) {
      slot.push(record4);
      return;
    }
    slot.splice(Math.floor(limit / 2), 1);
    slot.push(record4);
  };
  const finishLine = () => {
    const raw = lineChars <= KEPT_LINE_BYTES ? linePrefix : `${truncateLine(linePrefix)} ... ${truncateLine(lineSuffix)}`;
    const record4 = { lineNumber, text: raw };
    if (raw.trim().length > 0) nonEmptyLineCount += 1;
    if (head.length < 20) head.push(record4);
    tail.push(record4);
    if (tail.length > 40) tail.shift();
    if (TEST_SUMMARY_LINE.test(raw)) keepSignal(signalSlots.testSummaries, record4, 16);
    if (FAILING_TEST_LINE.test(raw)) keepSignal(signalSlots.failingTests, record4, 24);
    if (EXCEPTION_LINE.test(raw)) keepSignal(signalSlots.exceptions, record4, 12);
    if (SOURCE_LOCATION_LINE.test(raw)) keepSignal(signalSlots.sourceLocations, record4, 12);
    if (COMMAND_STATUS_LINE.test(raw)) keepSignal(signalSlots.commandStatuses, record4, 8);
    if (COMMAND_FAILURE_LINE.test(raw)) keepSignal(signalSlots.commandFailures, record4, 12);
    if (DECISIVE_LINE.test(raw)) keepSignal(signalSlots.decisive, record4, 16);
    if (TRACE_LINE.test(raw)) {
      traceLineCount += 1;
      const shape = lineShape(raw);
      if (shape) {
        const count = shapes.get(shape);
        if (count !== void 0) shapes.set(shape, count + 1);
        else if (shapes.size < 64) shapes.set(shape, 1);
        else traceShapeOverflow += 1;
      }
    }
    lineNumber += 1;
    linePrefix = "";
    lineSuffix = "";
    lineChars = 0;
  };
  const consumeDecoded = (value) => {
    if (!value) return;
    let offset = 0;
    for (; ; ) {
      const newline = value.indexOf("\n", offset);
      if (newline < 0) {
        consumeLineText(value.slice(offset));
        break;
      }
      consumeLineText(value.slice(offset, newline));
      finishLine();
      offset = newline + 1;
    }
  };
  for await (const bytes of sourceBytes(source, signal)) {
    if (bytes.byteLength === 0) continue;
    sawText = true;
    textBytes += bytes.byteLength;
    if (textBytes <= LARGE_TEXT_BYTES) exact.push(bytes.toString("binary"));
    consumeDecoded(decoder.write(bytes));
  }
  consumeDecoded(decoder.end());
  if (sawText) finishLine();
  const lineCount = sawText ? lineNumber - 1 : 0;
  let exactText;
  if (textBytes <= LARGE_TEXT_BYTES) {
    const raw = Buffer.concat(exact.map((value) => Buffer.from(value, "binary")), textBytes);
    exactText = raw.toString("utf8");
  }
  if (exactText !== void 0) {
    return {
      source,
      textBytes,
      lineCount,
      large: false,
      exactText,
      sourceRecords: [],
      traceShapeCount: shapes.size,
      traceShapeOverflow,
      traceLineCount,
      nonEmptyLineCount,
      summaryLines: [],
      capsuleText: exactText,
      outcomeText: exactText,
      representativeLines: exactText.split("\n").slice(0, 64),
      head: exactText.split("\n").slice(0, 20),
      tail: exactText.split("\n").slice(-40)
    };
  }
  const signals = [
    ...signalSlots.testSummaries,
    ...signalSlots.failingTests,
    ...signalSlots.exceptions,
    ...signalSlots.sourceLocations,
    ...signalSlots.commandStatuses,
    ...signalSlots.commandFailures,
    ...signalSlots.decisive
  ];
  const outcomeSignals = signals.map((record4) => record4.text);
  const numbered = /* @__PURE__ */ new Map();
  for (const record4 of [...head, ...signals, ...tail]) numbered.set(record4.lineNumber, record4.text);
  const sourceRecords = [...numbered].sort(([left], [right]) => left - right).map(([lineNumber2, text]) => ({ lineNumber: lineNumber2, text }));
  const summaryLines = sourceRecords.map((record4) => record4.text);
  const traceShapes = [...shapes].filter(([, count]) => count > 1).sort((left, right) => right[1] - left[1]).slice(0, 12).map(([shape, count]) => `Trace shape x${count}: ${shape}`);
  const boundedSummaryLines = [
    ...traceShapes,
    ...traceShapeOverflow > 0 ? [`Additional trace lines with untracked shapes: ${traceShapeOverflow}.`] : []
  ];
  const capsuleText = [
    ...summaryLines,
    `Large output summary: ${textBytes} UTF-8 bytes, ${lineCount} lines.`,
    ...boundedSummaryLines
  ].join("\n");
  const representativeLines = [...head, ...tail].map((record4) => record4.text).filter((value, index, values) => values.indexOf(value) === index).slice(0, 64);
  return {
    source,
    textBytes,
    lineCount,
    large: true,
    sourceRecords,
    traceShapeCount: shapes.size,
    traceShapeOverflow,
    traceLineCount,
    nonEmptyLineCount,
    summaryLines: boundedSummaryLines,
    capsuleText,
    outcomeText: [...outcomeSignals, ...head.map((record4) => record4.text), ...tail.map((record4) => record4.text)].join("\n"),
    representativeLines,
    head: head.map((record4) => record4.text),
    tail: tail.map((record4) => record4.text)
  };
}
async function writeTextChunks(source, sessionPath, relativePrefix, signal) {
  const chunks = [];
  const published = [];
  const staged = [];
  let active;
  let nextFirstLine = 1;
  let chunkNumber = 0;
  let pendingLine = [];
  let pendingBytes = 0;
  let oversized = false;
  let totalBytes = 0;
  let finalByte;
  const openChunk = () => {
    chunkNumber += 1;
    const relativeFile = `${relativePrefix}.${String(chunkNumber).padStart(4, "0")}.txt.gz`;
    const finalPath = `${sessionPath}/${relativeFile}`;
    const temporaryPath = `${finalPath}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
    staged.push(temporaryPath);
    const input = new PassThrough();
    const completed = pipeline(input, createGzip(), createWriteStream(temporaryPath, { signal }));
    return { relativeFile, finalPath, temporaryPath, input, completed, textBytes: 0, lineCount: 0 };
  };
  const writeActive = async (bytes) => {
    if (bytes.byteLength === 0) return;
    active ??= openChunk();
    active.textBytes += bytes.byteLength;
    totalBytes += bytes.byteLength;
    finalByte = bytes[bytes.byteLength - 1];
    if (!active.input.write(bytes)) await once(active.input, "drain");
  };
  const finishChunk = async () => {
    if (!active) return;
    const current = active;
    active = void 0;
    current.input.end();
    await current.completed;
    signal?.throwIfAborted();
    await rename(current.temporaryPath, current.finalPath);
    staged.splice(staged.indexOf(current.temporaryPath), 1);
    published.push(current.finalPath);
    chunks.push({
      relativeFile: current.relativeFile,
      firstLine: nextFirstLine,
      lineCount: current.lineCount,
      textBytes: current.textBytes
    });
    nextFirstLine += current.lineCount;
  };
  const flushPending = async () => {
    for (const value of pendingLine) await writeActive(value);
    pendingLine = [];
    pendingBytes = 0;
  };
  const consumeSegment = async (segment, endsLine) => {
    if (oversized) {
      await writeActive(segment);
      if (endsLine) {
        active.lineCount += 1;
        await finishChunk();
        oversized = false;
      }
      return;
    }
    pendingLine.push(segment);
    pendingBytes += segment.byteLength;
    if (pendingBytes > TEXT_CHUNK_BYTES && !endsLine) {
      await finishChunk();
      oversized = true;
      await flushPending();
      return;
    }
    if (!endsLine) return;
    if (active && active.textBytes > 0 && active.textBytes + pendingBytes > TEXT_CHUNK_BYTES) await finishChunk();
    await flushPending();
    active.lineCount += 1;
    if (active.textBytes >= TEXT_CHUNK_BYTES) await finishChunk();
  };
  try {
    for await (const bytes of sourceBytes(source, signal)) {
      let offset = 0;
      while (offset < bytes.byteLength) {
        const newline = bytes.indexOf(10, offset);
        const end = newline < 0 ? bytes.byteLength : newline + 1;
        await consumeSegment(bytes.subarray(offset, end), newline >= 0);
        offset = end;
      }
    }
    if (pendingBytes > 0) {
      if (active && active.textBytes > 0 && active.textBytes + pendingBytes > TEXT_CHUNK_BYTES) await finishChunk();
      await flushPending();
    }
    if (active) {
      if (finalByte !== 10 && totalBytes > 0) active.lineCount += 1;
      await finishChunk();
    }
    if (totalBytes > 0 && finalByte === 10 && chunks.length > 0) chunks[chunks.length - 1].lineCount += 1;
    return chunks;
  } catch (error) {
    if (active) {
      active.input.destroy();
      await active.completed.catch(() => void 0);
      await rm(active.temporaryPath, { force: true }).catch(() => void 0);
    }
    await Promise.all([...staged, ...published].map((path) => rm(path, { force: true }).catch(() => void 0)));
    throw error;
  }
}

// src/archive.ts
var gunzipAsync = promisify(gunzip);
var RECOVERY_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
function capsuleFactualLines(exchange, outcome) {
  if (!exchange) return [];
  const facts = exchange.facts;
  return [
    ...outcome.status === "unknown" ? [] : [`Outcome: ${outcome.status}.`],
    ...exchange?.suite ? [`Suite: ${exchange.suite.family}:${exchange.suite.target} [${exchange.suite.scope}].`] : [],
    ...exchange?.workspaceRevisionAtResult === void 0 ? [] : [`Workspace at execution: w${exchange.workspaceRevisionAtResult}.`],
    ...outcome.testSummary ? [`Tests: ${outcome.testSummary}.`] : [],
    ...outcome.failingTests.map((value) => `Failing test: ${value}`),
    ...outcome.exceptions.map((value) => `Exception: ${value}`),
    ...outcome.sourceLocations.map((value) => `Source: ${value}`),
    ...outcome.exitStatuses.map((value) => `Command: ${value}`),
    ...outcome.commandFailures.map((value) => `Failure: ${value}`),
    ...exchange.intentKind === "edit" && exchange.resources[0] ? [`Resource: ${exchange.resources[0]}.`] : [],
    ...typeof facts?.editCount === "number" ? [`Edit count: ${facts.editCount}.`] : [],
    ...typeof facts?.firstChangedLine === "number" ? [`First changed line: ${facts.firstChangedLine}.`] : [],
    ...exchange.intentKind === "edit" && typeof facts?.diffBytes === "number" ? [`Diff: ${exchange.exchangeId}:diff (${facts.diffBytes} bytes).`] : [],
    ...typeof facts?.truncation === "string" ? [`Output truncation: ${facts.truncation}.`] : [],
    ...facts?.kernelRestarted === "true" ? ["Kernel restarted: true."] : [],
    ...typeof facts?.durationMs === "number" ? [`Kernel duration: ${facts.durationMs} ms.`] : []
  ];
}
function emptyIndex() {
  return { schema: "prime-context.observation-index/v1", observations: [] };
}
async function mapBounded(values, limit, operation) {
  const results = new Array(values.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    for (; ; ) {
      const index = next;
      next += 1;
      if (index >= values.length) return;
      results[index] = await operation(values[index]);
    }
  }));
  return results;
}
function isTextBlock(block) {
  return block?.type === "text" && typeof block.text === "string";
}
function visibleTextSource(content) {
  const texts = content.flatMap((block) => isTextBlock(block) && block.text.length > 0 ? [block.text] : []);
  if (texts.length <= 1) return { kind: "text", text: texts[0] ?? "" };
  return { kind: "texts", texts: () => texts.values() };
}
function rawResultText(result) {
  if (!Array.isArray(result?.content)) return void 0;
  const chunks = [];
  let pending = [];
  for (const block of result.content) {
    if (!block || typeof block !== "object") continue;
    const value = block;
    if (value.type !== "text" || typeof value.text !== "string" || value.text.length === 0) continue;
    pending.push(value.text);
    if (pending.length >= 1024) {
      chunks.push(pending.join(""));
      pending = [];
    }
  }
  if (pending.length > 0) chunks.push(pending.join(""));
  return chunks.join("");
}
function isEnvelopeIndexRef(entry) {
  return "schema" in entry && entry.schema === "prime-context.exchange/v2";
}
function parseObservationRef(ref) {
  const short2 = /^([^:]+)(?::(.+))?$/.exec(ref);
  if (!short2) return { id: ref };
  if (!short2[2]) return { id: short2[1], partName: "result" };
  if (short2[2].startsWith("call#")) {
    const pointer = short2[2].slice("call#".length);
    if (pointer !== "" && !pointer.startsWith("/")) return { id: ref };
    return { id: short2[1], partName: "call", pointer };
  }
  return { id: short2[1], partName: short2[2] };
}
function normalizeObservationRef(ref) {
  return parseObservationRef(ref).id;
}
function partReference(envelopeId, part) {
  return part.kind === "call-field" ? `${envelopeId}:call#${part.pointer ?? ""}` : `${envelopeId}:${part.name}`;
}
function imageRefsForEnvelope(envelope) {
  return envelope.parts.flatMap((part) => part.kind === "image" && part.binaryBytes !== void 0 ? [{
    ref: partReference(envelope.id, part),
    mimeType: part.mediaType ?? "application/octet-stream",
    bytes: part.binaryBytes,
    ...part.width === void 0 ? {} : { width: part.width },
    ...part.height === void 0 ? {} : { height: part.height }
  }] : []);
}
function sanitizedStorageName(name) {
  return name.toLowerCase().replaceAll(/[^a-z0-9_-]+/g, "-").replaceAll(/^-+|-+$/g, "") || "part";
}
function jsonPointerToken2(value) {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}
function imageDimensions(bytes, mediaType) {
  const mime = mediaType?.toLowerCase();
  if ((mime === "image/png" || bytes.subarray(1, 4).toString("ascii") === "PNG") && bytes.length >= 24 && bytes.subarray(12, 16).toString("ascii") === "IHDR") {
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    return width > 0 && height > 0 ? { width, height } : void 0;
  }
  if (mime === "image/jpeg" || mime === "image/jpg" || bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 255) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 216 || marker === 217) {
        offset += 2;
        continue;
      }
      const size = bytes.readUInt16BE(offset + 2);
      if (size < 2 || offset + 2 + size > bytes.length) break;
      if (marker >= 192 && marker <= 195 || marker >= 197 && marker <= 199 || marker >= 201 && marker <= 203 || marker >= 205 && marker <= 207) {
        const height = bytes.readUInt16BE(offset + 5);
        const width = bytes.readUInt16BE(offset + 7);
        return width > 0 && height > 0 ? { width, height } : void 0;
      }
      offset += 2 + size;
    }
  }
  return void 0;
}
function deterministicJson(value) {
  const canonical = (item) => {
    if (Array.isArray(item)) return item.map(canonical);
    if (item && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, child]) => [key, canonical(child)])
      );
    }
    return item;
  };
  return JSON.stringify(canonical(value)) ?? String(value);
}
function callField(pointer, text, mediaType = "text/plain; charset=utf-8") {
  return { name: "call", kind: "call-field", pointer, mediaType, text };
}
function collectOversizedCallFields(toolName, input) {
  if (toolName === "edit") {
    const edits = Array.isArray(input.edits) ? input.edits : [];
    const fields = [];
    let total = 0;
    for (const [index, value] of edits.entries()) {
      if (!value || typeof value !== "object") continue;
      const edit = value;
      for (const key of ["oldText", "newText"]) {
        if (typeof edit[key] !== "string") continue;
        const text = edit[key];
        total += utf8Bytes(text);
        fields.push({ pointer: `/edits/${index}/${key}`, text });
      }
    }
    return total > 4096 ? fields.map(({ pointer, text }) => callField(pointer, text)) : [];
  }
  if (toolName === "ipython") {
    return typeof input.code === "string" && utf8Bytes(input.code) > 8192 ? [callField("/code", input.code)] : [];
  }
  if (toolName === "bash") {
    return typeof input.command === "string" && utf8Bytes(input.command) > 8192 ? [callField("/command", input.command)] : [];
  }
  const rootJson = deterministicJson(input);
  if (utf8Bytes(rootJson) <= 8192) return [];
  const parts = [];
  const visit = (value, pointer) => {
    if (typeof value === "string") {
      if (utf8Bytes(value) > 8192) parts.push(callField(pointer, value));
      return;
    }
    if (!value || typeof value !== "object") return;
    const before = parts.length;
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${pointer}/${index}`));
    } else {
      for (const key of Object.keys(value).sort()) {
        visit(value[key], `${pointer}/${jsonPointerToken2(key)}`);
      }
    }
    const json = deterministicJson(value);
    if (pointer && parts.length === before && utf8Bytes(json) > 8192) {
      parts.push(callField(pointer, json, "application/json"));
    }
  };
  visit(input, "");
  return parts;
}
function resolvedArchiveText(summary, source) {
  const value = { text: summary.exactText ?? summary.capsuleText, source };
  const { source: partSource, ...details } = summary;
  Object.defineProperties(value, Object.fromEntries(
    Object.entries({ ...details, partSource }).map(([key, detail]) => [key, {
      value: detail,
      enumerable: false,
      configurable: false,
      writable: false
    }])
  ));
  return value;
}
async function resolveArchiveText(content, publicCompleteOutputPath, signal) {
  if (publicCompleteOutputPath) {
    try {
      const summary2 = await summarizePartSource({ kind: "path", path: publicCompleteOutputPath }, signal);
      return resolvedArchiveText(summary2, "public-complete-output");
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }
  const summary = await summarizePartSource(visibleTextSource(content), signal);
  return resolvedArchiveText(summary, "visible-tool-result");
}
function replaceVisibleText(content, capsule) {
  let inserted = false;
  const output = [];
  for (const block of content) {
    if (isTextBlock(block)) {
      if (!inserted) {
        output.push({ type: "text", text: capsule });
        inserted = true;
      }
      continue;
    }
    output.push(block);
  }
  return output;
}
function validateLineRange(startLine, endLine) {
  if (!Number.isSafeInteger(startLine) || startLine < 1) {
    throw new Error("startLine must be a positive integer.");
  }
  if (!Number.isSafeInteger(endLine) || endLine < startLine) {
    throw new Error("endLine must be an integer greater than or equal to startLine.");
  }
}
function validateContextLines(contextLines) {
  if (!Number.isSafeInteger(contextLines) || contextLines < 0 || contextLines > 20) {
    throw new Error("contextLines must be an integer from 0 to 20.");
  }
}
function validateMatchOffset(matchOffset) {
  if (!Number.isSafeInteger(matchOffset) || matchOffset < 0 || matchOffset > 1e4) {
    throw new Error("matchOffset must be an integer from 0 to 10000.");
  }
}
function validateMaxMatches(maxMatches) {
  if (!Number.isSafeInteger(maxMatches) || maxMatches < 1 || maxMatches > 50) {
    throw new Error("maxMatches must be an integer from 1 to 50.");
  }
}
function boundedResponse(header, body, maxBytes) {
  const complete = header + body;
  if (utf8Bytes(complete) <= maxBytes) return complete;
  const truncatedHeader = `${header}Response truncated at ${maxBytes} UTF-8 bytes; more content exists.
`;
  if (utf8Bytes(truncatedHeader) >= maxBytes) return truncateUtf8(truncatedHeader, maxBytes);
  return truncatedHeader + truncateUtf8(body, maxBytes - utf8Bytes(truncatedHeader));
}
function findMatchingLines(lines, needle, limit) {
  const matches = [];
  for (let index = 0; index < lines.length && matches.length < limit; index += 1) {
    if (lines[index].toLowerCase().includes(needle)) matches.push(index);
  }
  return matches;
}
function renderMatches(lines, matches, contextLines = 1) {
  if (matches.length === 0) return "";
  const matchedLines = new Set(matches);
  const ranges = [];
  for (const lineIndex of matches) {
    const first = Math.max(0, lineIndex - contextLines);
    const last = Math.min(lines.length - 1, lineIndex + contextLines);
    const current = ranges.at(-1);
    if (current && first <= current.last + 1) {
      current.last = Math.max(current.last, last);
      current.matches.push(lineIndex);
    } else {
      ranges.push({ first, last, matches: [lineIndex] });
    }
  }
  return ranges.map((range) => {
    const heading = range.matches.length === 1 ? `Match at line ${range.matches[0] + 1}:` : `Matches at lines ${range.matches.map((line) => line + 1).join(", ")}:`;
    const context = [heading];
    for (let index = range.first; index <= range.last; index += 1) {
      context.push(`${matchedLines.has(index) ? ">" : " "} ${index + 1}: ${lines[index]}`);
    }
    return context.join("\n");
  }).join("\n\n");
}
var ObservationArchive = class {
  sessionId;
  sessionPath;
  observationsPath;
  indexPath;
  sessionMetadataPath;
  indexQueue = Promise.resolve();
  catalogPromise;
  catalog;
  catalogById = /* @__PURE__ */ new Map();
  sessionMetadata;
  mediumResultCounts = /* @__PURE__ */ new Map();
  lastMediumResults = /* @__PURE__ */ new Map();
  recentLargeParts = [];
  scopeActive = false;
  activeTaskKey;
  activeBranchEntryIds = /* @__PURE__ */ new Set();
  activeCitedObservationIds = /* @__PURE__ */ new Set();
  broker = new ObservationBroker();
  constructor(root, sessionId) {
    this.sessionId = sessionId;
    this.sessionPath = join2(root, "sessions", sessionId);
    this.observationsPath = join2(this.sessionPath, "observations");
    this.indexPath = join2(this.sessionPath, "index.json");
    this.sessionMetadataPath = join2(this.sessionPath, "session.json");
  }
  async freezeTextSource(path, signal) {
    signal?.throwIfAborted();
    const staging = join2(this.sessionPath, "staging");
    await mkdir(staging, { recursive: true });
    const frozenPath = join2(staging, `${randomUUID2()}.txt`);
    await copyFile(path, frozenPath);
    signal?.throwIfAborted();
    return frozenPath;
  }
  async removeFrozenTextSource(path) {
    await rm2(path, { force: true });
  }
  brokerContext() {
    return this.broker.contextState();
  }
  brokerStatistics() {
    return this.broker.statistics();
  }
  recordRecovery(useful, subjectKeys, exposedBytes = 0, inspectRecallHit = false) {
    this.broker.recordRecovery({ recovered: true, useful, subjectKeys, exposedBytes, inspectRecallHit });
  }
  recordProviderProjection(bytes, extendedStableGeneration) {
    this.broker.recordProviderProjection(bytes, extendedStableGeneration);
  }
  recordTypedMediaProjection(bytes) {
    this.broker.recordProjection({ typedMediaBytesProjectedOut: bytes });
  }
  recordFoldGeneration() {
    this.broker.recordFoldGeneration();
  }
  recordBranchRuntimeReload() {
    this.broker.recordBranchRuntimeReload();
  }
  recordUsage(usage) {
    this.broker.recordUsage(usage);
  }
  noteContextTurn(goalActive) {
    this.broker.noteContextTurn(goalActive);
  }
  setBranchScope(taskKey, branchEntryIds, citedObservationIds = []) {
    this.scopeActive = true;
    this.activeTaskKey = taskKey;
    this.activeBranchEntryIds = new Set(branchEntryIds);
    this.activeCitedObservationIds = new Set(citedObservationIds.map(normalizeObservationRef));
  }
  isOnActiveBranch(observation) {
    if (!this.scopeActive) return true;
    if (!this.activeTaskKey || observation.exchange?.taskKey !== this.activeTaskKey) return false;
    const anchor = observation.exchange.branchAnchorId;
    if (observation.exchange.forkImported) return Boolean(anchor && this.activeBranchEntryIds.has(anchor));
    const toolCallId = observation.exchange.toolCallId;
    if (toolCallId) return this.activeBranchEntryIds.has(toolCallId);
    return Boolean(anchor && this.activeBranchEntryIds.has(anchor));
  }
  isInActiveScope(observation) {
    if (this.activeCitedObservationIds.has(observation.id)) return true;
    return this.isOnActiveBranch(observation);
  }
  resetBranchState() {
    this.mediumResultCounts.clear();
    this.lastMediumResults.clear();
    this.recentLargeParts = [];
    this.broker.resetBranchState();
  }
  async withIndexLock(operation) {
    const result = this.indexQueue.then(operation, operation);
    this.indexQueue = result.then(
      () => void 0,
      () => void 0
    );
    return result;
  }
  async readIndex(signal) {
    try {
      const raw = await readFile(this.indexPath, { encoding: "utf8", signal });
      const parsed = JSON.parse(raw);
      if (parsed.schema !== "prime-context.observation-index/v1" || !Array.isArray(parsed.observations)) {
        throw new Error("Invalid Prime Context observation index.");
      }
      return parsed;
    } catch (error) {
      if (error.code === "ENOENT") return emptyIndex();
      throw error;
    }
  }
  async writeIndex(index, signal) {
    await mkdir(this.sessionPath, { recursive: true });
    const temporary = `${this.indexPath}.${randomUUID2()}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify(index, null, 2)}
`, { encoding: "utf8", signal });
      await rename2(temporary, this.indexPath);
    } catch (error) {
      await rm2(temporary, { force: true }).catch(() => void 0);
      throw error;
    }
  }
  async readSessionMetadata(signal) {
    try {
      const parsed = JSON.parse(await readFile(this.sessionMetadataPath, { encoding: "utf8", signal }));
      if (parsed.schema !== "prime-context.archive-session/v1" || !Number.isSafeInteger(parsed.nextSequence) || (parsed.nextSequence ?? 0) < 1 || !Number.isSafeInteger(parsed.observationCount) || (parsed.observationCount ?? -1) < 0) return void 0;
      return parsed;
    } catch (error) {
      if (error.code === "ENOENT") return void 0;
      throw error;
    }
  }
  metadataWithBrokerState(metadata) {
    const state = this.broker.persistentState();
    return { ...metadata, utility: state.utility, metrics: state.metrics };
  }
  async flushSessionState(signal) {
    const records = await this.readCatalog(signal);
    const metadata = this.metadataWithBrokerState(this.nextMetadata(records));
    await this.writeSessionMetadata(metadata, signal);
    this.sessionMetadata = metadata;
  }
  async writeSessionMetadata(metadata, signal) {
    await mkdir(this.sessionPath, { recursive: true });
    const temporary = `${this.sessionMetadataPath}.${randomUUID2()}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify(metadata, null, 2)}
`, { encoding: "utf8", signal });
      signal?.throwIfAborted();
      await rename2(temporary, this.sessionMetadataPath);
    } catch (error) {
      await rm2(temporary, { force: true }).catch(() => void 0);
      throw error;
    }
  }
  async loadCatalog(signal) {
    const [legacy, names, storedSession] = await Promise.all([
      this.readIndex(signal),
      readdir(this.observationsPath).catch((error) => {
        if (error.code === "ENOENT") return [];
        throw error;
      }),
      this.readSessionMetadata(signal)
    ]);
    const refs = /* @__PURE__ */ new Map();
    const orderedIds = [];
    const orderedIdSet = /* @__PURE__ */ new Set();
    const legacyRecords = /* @__PURE__ */ new Map();
    for (const entry of legacy.observations) {
      if (!orderedIdSet.has(entry.id)) {
        orderedIds.push(entry.id);
        orderedIdSet.add(entry.id);
      }
      if (isEnvelopeIndexRef(entry)) refs.set(entry.id, entry);
      else legacyRecords.set(entry.id, entry);
    }
    for (const name of names.filter((value) => value.endsWith(".meta.json")).sort()) {
      const id = name.slice(0, -".meta.json".length);
      refs.set(id, { schema: "prime-context.exchange/v2", id, relativeFile: join2("observations", name) });
    }
    const loaded = await mapBounded(
      [...refs.values()],
      8,
      async (ref) => this.envelopeRecord(ref, await this.readEnvelope(ref, signal))
    );
    const loadedById = new Map(loaded.map((record4) => [record4.id, record4]));
    const standalone = loaded.filter((record4) => !orderedIdSet.has(record4.id)).sort((left, right) => {
      const leftSequence = /^o(\d+)$/.exec(left.id);
      const rightSequence = /^o(\d+)$/.exec(right.id);
      if (leftSequence && rightSequence) return Number(leftSequence[1]) - Number(rightSequence[1]);
      return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
    });
    orderedIds.push(...standalone.map((record4) => record4.id));
    const records = orderedIds.flatMap((id) => {
      const record4 = loadedById.get(id) ?? legacyRecords.get(id);
      return record4 ? [record4] : [];
    });
    const maximum = records.reduce((value, record4) => {
      const match = /^o(\d+)$/.exec(record4.id);
      return match ? Math.max(value, Number(match[1])) : value;
    }, 0);
    this.broker.restorePersistentState(storedSession ? {
      utility: storedSession.utility,
      metrics: storedSession.metrics
    } : void 0);
    this.sessionMetadata = this.metadataWithBrokerState({
      schema: "prime-context.archive-session/v1",
      nextSequence: Math.max(storedSession?.nextSequence ?? 1, maximum + 1),
      observationCount: records.length
    });
    this.catalog = records;
    this.catalogById = new Map(records.map((record4) => [record4.id, record4]));
    return records;
  }
  async readCatalog(signal) {
    if (this.catalog) return this.catalog;
    this.catalogPromise ??= this.loadCatalog(signal);
    try {
      return await this.catalogPromise;
    } catch (error) {
      if (signal?.aborted) this.catalogPromise = void 0;
      throw error;
    }
  }
  nextMetadata(records, addedId) {
    let nextSequence = this.sessionMetadata?.nextSequence ?? 1;
    if (addedId) {
      const match = /^o(\d+)$/.exec(addedId);
      if (match) nextSequence = Math.max(nextSequence, Number(match[1]) + 1);
    }
    return this.metadataWithBrokerState({
      schema: "prime-context.archive-session/v1",
      nextSequence,
      observationCount: records.length + (addedId && !this.catalogById.has(addedId) ? 1 : 0)
    });
  }
  async publishRecord(record4, signal) {
    const records = await this.readCatalog(signal);
    if (this.catalogById.has(record4.id)) {
      this.replaceCatalogRecord(record4);
      return;
    }
    const metadata = this.nextMetadata(records, record4.id);
    await this.writeSessionMetadata(metadata, signal);
    records.push(record4);
    this.catalogById.set(record4.id, record4);
    this.sessionMetadata = metadata;
  }
  replaceCatalogRecord(record4) {
    if (!this.catalog) return;
    const previous = this.catalogById.get(record4.id);
    if (!previous) return;
    const index = this.catalog.indexOf(previous);
    if (index >= 0) this.catalog[index] = record4;
    this.catalogById.set(record4.id, record4);
  }
  async readEnvelope(ref, signal) {
    const raw = await readFile(join2(this.sessionPath, ref.relativeFile), { encoding: "utf8", signal });
    const envelope = JSON.parse(raw);
    if (envelope.schema !== "prime-context.exchange/v2" || envelope.id !== ref.id || !Array.isArray(envelope.parts)) {
      throw new Error(`Invalid Prime Context exchange envelope: ${ref.id}`);
    }
    return envelope;
  }
  async writeEnvelope(relativeFile, envelope, signal) {
    await mkdir(this.observationsPath, { recursive: true });
    const filePath = join2(this.sessionPath, relativeFile);
    const temporary = `${filePath}.${randomUUID2()}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify(envelope, null, 2)}
`, { encoding: "utf8", signal });
      await rename2(temporary, filePath);
    } catch (error) {
      await rm2(temporary, { force: true }).catch(() => void 0);
      throw error;
    }
  }
  async appendPart(envelope, input, signal, generation) {
    await mkdir(this.observationsPath, { recursive: true });
    const storageName = input.kind === "call-field" ? `call-field-${envelope.parts.filter((part) => part.kind === "call-field").length + 1}` : sanitizedStorageName(input.name);
    const textSource = input.source ?? (input.text === void 0 ? void 0 : { kind: "text", text: input.text });
    if (textSource) {
      const relativePrefix = join2(
        "observations",
        `${envelope.id}.${storageName}${generation ? `.${sanitizedStorageName(generation)}` : ""}`
      );
      const chunks = await writeTextChunks(textSource, this.sessionPath, relativePrefix, signal);
      const textBytes = chunks.reduce((sum, chunk) => sum + chunk.textBytes, 0);
      const lineCount = chunks.reduce((sum, chunk) => sum + chunk.lineCount, 0);
      envelope.parts.push({
        name: input.name,
        kind: input.kind,
        ...input.pointer === void 0 ? {} : { pointer: input.pointer },
        ...input.mediaType === void 0 ? {} : { mediaType: input.mediaType },
        textBytes,
        lineCount,
        chunks
      });
      return;
    }
    if (input.binaryBase64 !== void 0) {
      const bytes = Buffer.from(input.binaryBase64, "base64");
      const dimensions = input.width && input.height ? { width: input.width, height: input.height } : imageDimensions(bytes, input.mediaType);
      const relativeFile = join2(
        "observations",
        `${envelope.id}.${storageName}${generation ? `.${sanitizedStorageName(generation)}` : ""}.bin`
      );
      const filePath = join2(this.sessionPath, relativeFile);
      const temporary = `${filePath}.${randomUUID2()}.tmp`;
      try {
        await writeFile(temporary, bytes, { signal });
        signal?.throwIfAborted();
        await rename2(temporary, filePath);
      } catch (error) {
        await rm2(temporary, { force: true }).catch(() => void 0);
        throw error;
      }
      envelope.parts.push({
        name: input.name,
        kind: input.kind,
        ...input.pointer === void 0 ? {} : { pointer: input.pointer },
        ...input.mediaType === void 0 ? {} : { mediaType: input.mediaType },
        binaryBytes: bytes.byteLength,
        ...dimensions ?? {},
        chunks: [{ relativeFile, textBytes: 0 }]
      });
    }
  }
  newEnvelope(metadata, toolName, source, resultCapsule = "", isError = metadata.outcome.status === "failure") {
    return {
      schema: "prime-context.exchange/v2",
      id: metadata.exchangeId,
      toolCallId: metadata.toolCallId,
      toolName,
      intentKind: metadata.intentKind,
      subjectKey: metadata.subjectKey,
      resources: [...metadata.resources],
      ...metadata.suite === void 0 ? {} : { suite: { ...metadata.suite } },
      taskKey: metadata.taskKey ?? "session",
      ...metadata.goalId === void 0 ? {} : { goalId: metadata.goalId },
      branchAnchorId: metadata.branchAnchorId ?? metadata.toolCallId,
      turnSequence: metadata.turnSequence ?? 0,
      requirementsRevision: metadata.requirementsRevision ?? 0,
      workspaceRevisionAtStart: metadata.workspaceRevisionAtStart ?? 0,
      workspaceRevisionAtResult: metadata.workspaceRevisionAtResult ?? metadata.workspaceRevisionAtStart ?? 0,
      isError,
      outcome: metadata.outcome,
      callSummary: `${toolName} ${metadata.subjectKey}`,
      resultCapsule,
      parts: [],
      ...source === void 0 ? {} : { source },
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      ...metadata.effectiveCwd === void 0 ? {} : { effectiveCwd: metadata.effectiveCwd },
      mutatesWorkspace: metadata.mutatesWorkspace,
      modelInputBytes: metadata.modelInputBytes,
      executedInputBytes: metadata.executedInputBytes,
      ...metadata.facts === void 0 ? {} : { facts: { ...metadata.facts } },
      ...metadata.forkImported === void 0 ? {} : { forkImported: metadata.forkImported }
    };
  }
  updateEnvelopeMetadata(envelope, metadata) {
    envelope.toolCallId = metadata.toolCallId;
    envelope.intentKind = metadata.intentKind;
    envelope.subjectKey = metadata.subjectKey;
    envelope.resources = [...metadata.resources];
    if (metadata.suite === void 0) delete envelope.suite;
    else envelope.suite = { ...metadata.suite };
    envelope.taskKey = metadata.taskKey ?? envelope.taskKey;
    if (metadata.goalId === void 0) delete envelope.goalId;
    else envelope.goalId = metadata.goalId;
    envelope.branchAnchorId = metadata.branchAnchorId ?? envelope.branchAnchorId;
    envelope.turnSequence = metadata.turnSequence ?? envelope.turnSequence;
    envelope.requirementsRevision = metadata.requirementsRevision ?? envelope.requirementsRevision;
    envelope.workspaceRevisionAtStart = metadata.workspaceRevisionAtStart ?? envelope.workspaceRevisionAtStart;
    envelope.workspaceRevisionAtResult = metadata.workspaceRevisionAtResult ?? envelope.workspaceRevisionAtResult;
    envelope.outcome = metadata.outcome;
    envelope.callSummary = `${envelope.toolName} ${metadata.subjectKey}`;
    if (metadata.effectiveCwd === void 0) delete envelope.effectiveCwd;
    else envelope.effectiveCwd = metadata.effectiveCwd;
    envelope.mutatesWorkspace = metadata.mutatesWorkspace;
    envelope.modelInputBytes = metadata.modelInputBytes;
    envelope.executedInputBytes = metadata.executedInputBytes;
    if (metadata.facts === void 0) delete envelope.facts;
    else envelope.facts = { ...metadata.facts };
    if (metadata.forkImported !== void 0) envelope.forkImported = metadata.forkImported;
  }
  envelopeRecord(ref, envelope) {
    const result = envelope.parts.find((part) => part.name === "result" && part.kind === "result");
    return {
      id: envelope.id,
      relativeFile: ref.relativeFile,
      toolName: envelope.toolName,
      isError: envelope.isError,
      textBytes: result?.textBytes ?? 0,
      lineCount: result?.lineCount ?? 0,
      createdAt: envelope.createdAt,
      source: envelope.source,
      exchange: {
        exchangeId: envelope.id,
        toolCallId: envelope.toolCallId,
        intentKind: envelope.intentKind,
        subjectKey: envelope.subjectKey,
        resources: [...envelope.resources],
        ...envelope.suite === void 0 ? {} : { suite: { ...envelope.suite } },
        ...envelope.effectiveCwd === void 0 ? {} : { effectiveCwd: envelope.effectiveCwd },
        mutatesWorkspace: envelope.mutatesWorkspace,
        modelInputBytes: envelope.modelInputBytes,
        executedInputBytes: envelope.executedInputBytes,
        ...envelope.facts === void 0 ? {} : { facts: { ...envelope.facts } },
        outcome: envelope.outcome,
        taskKey: envelope.taskKey,
        ...envelope.goalId === void 0 ? {} : { goalId: envelope.goalId },
        branchAnchorId: envelope.branchAnchorId,
        turnSequence: envelope.turnSequence,
        requirementsRevision: envelope.requirementsRevision,
        workspaceRevisionAtStart: envelope.workspaceRevisionAtStart,
        workspaceRevisionAtResult: envelope.workspaceRevisionAtResult,
        ...envelope.forkImported === void 0 ? {} : { forkImported: envelope.forkImported }
      },
      envelope,
      partRefs: envelope.parts.map((part) => partReference(envelope.id, part))
    };
  }
  async archiveVisibleContent(content, toolName, isError, minTextBytes, capsuleMaxBytes, signal, resolvedText, contextUsage, exchange, parts = []) {
    if (toolName === "prime_context") return null;
    const forceMedia = parts.some(
      (part) => part.binaryBase64 !== void 0 && (part.kind === "image" || part.kind === "attachment")
    );
    const textBlocks = content.filter(isTextBlock);
    if (textBlocks.length === 0 && !forceMedia) return null;
    const archiveText = resolvedText ?? await resolveArchiveText(content, void 0, signal);
    const textBytes = archiveText.textBytes ?? utf8Bytes(archiveText.text);
    const lineCount = archiveText.lineCount ?? splitVisibleLines(archiveText.text).length;
    const large = archiveText.large ?? textBytes > LARGE_TEXT_BYTES;
    const partSource = archiveText.partSource ?? { kind: "text", text: archiveText.text };
    const representativeLines = archiveText.representativeLines ?? splitVisibleLines(archiveText.text).slice(0, 64);
    const subjectKey = exchange?.subjectKey ?? `tool:${toolName}`;
    const exactLargeRepeat = large ? await this.isLargeExactRepeat(toolName, subjectKey, archiveText, textBytes, lineCount, partSource, signal) : false;
    const decision = this.broker.observe(toolName, archiveText.text, isError, {
      subjectKey,
      textBytes,
      lineCount,
      representativeLines,
      outcome: exchange?.outcome ?? (large ? analyzeOutcome(archiveText.outcomeText ?? archiveText.text, isError) : void 0),
      ...exactLargeRepeat ? { exactRepeat: true } : {}
    });
    const forceDelta = decision.kind === "delta";
    const belowConfiguredThreshold = !large && textBytes < minTextBytes;
    let repeatedMedium = false;
    if (!forceMedia && !forceDelta && belowConfiguredThreshold) {
      const sampledTerminal = textBytes >= 1024 && hasTerminalOutcome(archiveText.text) && isRepetitiveOutput(archiveText.text);
      const visibleLines = splitVisibleLines(archiveText.text);
      const sampledCommandUsage = textBytes >= 4096 && visibleLines.some((line) => /^usage:/i.test(line.trim())) && visibleLines.filter((line) => /^\s{2,}-{1,2}\S/.test(line)).length >= 10;
      const sampledLowSignalTrace = textBytes >= 2048 && isLowSignalTraceOutput(archiveText.text);
      if (!sampledTerminal && !sampledCommandUsage && !sampledLowSignalTrace && textBytes < 8192) {
        this.broker.recordPassThrough();
        return null;
      }
      if (sampledTerminal || sampledCommandUsage || sampledLowSignalTrace) {
        repeatedMedium = true;
      } else {
        const residentSubjectKey = truncateUtf8(subjectKey, 1024);
        const exactRepeat = textBytes <= LARGE_TEXT_BYTES && this.lastMediumResults.get(residentSubjectKey) === archiveText.text;
        if (textBytes <= LARGE_TEXT_BYTES) {
          this.lastMediumResults.delete(residentSubjectKey);
          this.lastMediumResults.set(residentSubjectKey, archiveText.text);
          while (this.lastMediumResults.size > 16) this.lastMediumResults.delete(this.lastMediumResults.keys().next().value);
        }
        const seen = (this.mediumResultCounts.get(residentSubjectKey) ?? 0) + 1;
        this.mediumResultCounts.delete(residentSubjectKey);
        this.mediumResultCounts.set(residentSubjectKey, seen);
        while (this.mediumResultCounts.size > 64) {
          this.mediumResultCounts.delete(this.mediumResultCounts.keys().next().value);
        }
        if (!exactRepeat && seen <= 2) {
          this.broker.recordPassThrough();
          return null;
        }
        repeatedMedium = true;
      }
    }
    return this.withIndexLock(async () => {
      signal?.throwIfAborted();
      await this.readCatalog(signal);
      const id = exchange?.exchangeId ?? `obs_${randomUUID2()}`;
      const capsuleRef = exchange ? `${id}:result` : id;
      const metadata = {
        id: capsuleRef,
        toolName,
        textBytes,
        lineCount,
        source: archiveText.source,
        factualLines: capsuleFactualLines(exchange, decision.outcome)
      };
      const pressureCeiling = adaptiveCapsuleMaxBytes(archiveText.text, capsuleMaxBytes, contextUsage);
      const failureBaseline = decision.outcome.status === "failure" ? Math.max(512, capsuleMaxBytes - 512) : capsuleMaxBytes;
      const baselineCapsuleMax = adaptiveCapsuleMaxBytes(
        archiveText.text,
        repeatedMedium ? Math.min(failureBaseline, 1536) : failureBaseline,
        contextUsage
      );
      const effectiveCapsuleMax = this.broker.utilityCapsuleMaxBytes(
        subjectKey,
        decision.outcome.status,
        baselineCapsuleMax,
        pressureCeiling
      );
      const renderedCapsule = forceDelta ? this.broker.renderDelta(decision, metadata, effectiveCapsuleMax) : large ? renderBoundedCapsule(archiveText.sourceRecords ?? [], {
        outcomeText: archiveText.outcomeText ?? archiveText.text,
        traceLineCount: archiveText.traceLineCount ?? 0,
        nonEmptyLineCount: archiveText.nonEmptyLineCount ?? lineCount,
        summaryLines: archiveText.summaryLines
      }, metadata, effectiveCapsuleMax) : renderCapsule(archiveText.text, metadata, effectiveCapsuleMax);
      const mediaOnlyAdmission = forceMedia && belowConfiguredThreshold && !forceDelta;
      const capsule = mediaOnlyAdmission ? "" : renderedCapsule;
      const capsuleBytes = utf8Bytes(capsule);
      const poorReturn = capsuleBytes > textBytes * 0.3;
      if (!forceMedia && (forceDelta && poorReturn || belowConfiguredThreshold && decision.outcome.status === "failure" && textBytes < 8192 && poorReturn)) {
        this.broker.recordPassThrough();
        return null;
      }
      await mkdir(this.observationsPath, { recursive: true });
      const relativeFile = join2("observations", `${id}.meta.json`);
      const synthetic = exchange ?? {
        exchangeId: id,
        toolCallId: id,
        intentKind: "unknown",
        subjectKey: `${toolName}:result`,
        resources: [],
        mutatesWorkspace: false,
        modelInputBytes: 0,
        executedInputBytes: 0,
        outcome: decision.outcome
      };
      const envelope = this.newEnvelope(synthetic, toolName, archiveText.source, capsule, isError);
      try {
        await this.appendPart(envelope, {
          name: "result",
          kind: "result",
          mediaType: "text/plain; charset=utf-8",
          source: partSource
        }, signal);
        for (const part of parts) await this.appendPart(envelope, part, signal);
        await this.writeEnvelope(relativeFile, envelope, signal);
        const ref = {
          schema: "prime-context.exchange/v2",
          id,
          relativeFile
        };
        const record4 = this.envelopeRecord(ref, envelope);
        await this.publishRecord(record4, signal);
        this.rememberLargePart(toolName, subjectKey, archiveText, this.resultPart(record4));
        const archivedBytes = envelope.parts.reduce(
          (total, part) => total + (part.textBytes ?? part.binaryBytes ?? 0),
          0
        );
        this.broker.recordArchive({
          subjectKey,
          sourceBytes: archivedBytes,
          projectedBytes: mediaOnlyAdmission ? archivedBytes : capsuleBytes,
          streamingBytes: archivedBytes
        });
        if (mediaOnlyAdmission) this.broker.recordPassThrough();
        else this.broker.recordCapsule(forceDelta);
        await this.flushSessionState(signal).catch(() => void 0);
        return {
          content: mediaOnlyAdmission ? [...content] : replaceVisibleText(content, capsule),
          observation: record4
        };
      } catch (error) {
        await Promise.all(envelope.parts.flatMap((part) => part.chunks).map(
          (chunk) => rm2(join2(this.sessionPath, chunk.relativeFile), { force: true }).catch(() => void 0)
        ));
        await rm2(join2(this.sessionPath, relativeFile), { force: true }).catch(() => void 0);
        throw error;
      }
    });
  }
  async *streamPartBytes(part, signal) {
    for (const chunk of part.chunks) {
      const input = createReadStream2(join2(this.sessionPath, chunk.relativeFile), { signal });
      const output = input.pipe(createGunzip());
      try {
        for await (const value of output) {
          signal?.throwIfAborted();
          yield Buffer.isBuffer(value) ? value : Buffer.from(value);
        }
      } finally {
        input.destroy();
        output.destroy();
      }
    }
  }
  async compareSourceToPart(source, part, signal) {
    const right = this.streamPartBytes(part, signal)[Symbol.asyncIterator]();
    let rightBuffer = Buffer.alloc(0);
    let rightOffset = 0;
    try {
      for await (const leftBuffer of sourceBytes(source, signal)) {
        let leftOffset = 0;
        while (leftOffset < leftBuffer.byteLength) {
          if (rightOffset >= rightBuffer.byteLength) {
            const next = await right.next();
            if (next.done) return false;
            rightBuffer = next.value;
            rightOffset = 0;
          }
          const length = Math.min(leftBuffer.byteLength - leftOffset, rightBuffer.byteLength - rightOffset);
          if (!leftBuffer.subarray(leftOffset, leftOffset + length).equals(rightBuffer.subarray(rightOffset, rightOffset + length))) return false;
          leftOffset += length;
          rightOffset += length;
        }
      }
      if (rightOffset < rightBuffer.byteLength) return false;
      return (await right.next()).done === true;
    } finally {
      await right.return?.(void 0);
    }
  }
  async sourceEqualsPart(observationId, partName, source, signal) {
    await this.readCatalog(signal);
    const observation = this.catalogById.get(normalizeObservationRef(observationId));
    if (!observation) throw new Error(`Unknown observation ID: ${observationId}`);
    const part = observation.envelope?.parts.find(
      (candidate) => candidate.name === partName && candidate.textBytes !== void 0
    );
    if (!part) throw new Error(`Unknown observation part: ${observationId}:${partName}`);
    return this.compareSourceToPart(source, part, signal);
  }
  async isLargeExactRepeat(toolName, subjectKey, archiveText, textBytes, lineCount, source, signal) {
    const head = archiveText.head ?? [];
    const tail = archiveText.tail ?? [];
    const candidates = this.recentLargeParts.filter(
      (candidate) => candidate.toolName === toolName && candidate.subjectKey === subjectKey && candidate.textBytes === textBytes && candidate.lineCount === lineCount && candidate.head.length === head.length && candidate.tail.length === tail.length && candidate.head.every((line, index) => line === head[index]) && candidate.tail.every((line, index) => line === tail[index])
    ).slice(-2);
    for (const candidate of candidates) {
      if (await this.compareSourceToPart(source, candidate.part, signal)) return true;
    }
    return false;
  }
  rememberLargePart(toolName, subjectKey, archiveText, part) {
    if (!part || !archiveText.large) return;
    this.recentLargeParts.push({
      toolName,
      subjectKey,
      textBytes: archiveText.textBytes ?? part.textBytes ?? 0,
      lineCount: archiveText.lineCount ?? part.lineCount ?? 0,
      head: [...archiveText.head ?? []],
      tail: [...archiveText.tail ?? []],
      part
    });
    if (this.recentLargeParts.length > 8) this.recentLargeParts.shift();
  }
  async *streamChunkLines(chunk, maxLineBytes, query, signal) {
    const input = createReadStream2(join2(this.sessionPath, chunk.relativeFile), { signal });
    const output = input.pipe(createGunzip());
    const decoder = new StringDecoder2("utf8");
    const needle = query?.toLowerCase();
    let text = "";
    let textBytes = 0;
    let searchTail = "";
    let matches = false;
    let truncated = false;
    let emitted = 0;
    const consume = (value) => {
      if (needle) {
        const searchable = searchTail + value;
        if (searchable.toLowerCase().includes(needle)) matches = true;
        searchTail = needle.length <= 1 ? "" : searchable.slice(-(needle.length - 1));
      }
      if (textBytes >= maxLineBytes) {
        if (value.length > 0) truncated = true;
        return;
      }
      const remaining = maxLineBytes - textBytes;
      const kept = truncateUtf8(value, remaining);
      text += kept;
      textBytes += utf8Bytes(kept);
      if (kept !== value) truncated = true;
    };
    const finish = () => {
      const record4 = { lineNumber: (chunk.firstLine ?? 1) + emitted, text, matches, truncated };
      emitted += 1;
      text = "";
      textBytes = 0;
      searchTail = "";
      matches = false;
      truncated = false;
      return record4;
    };
    const decodedPieces = async function* () {
      for await (const value of output) {
        signal?.throwIfAborted();
        const decoded = decoder.write(Buffer.isBuffer(value) ? value : Buffer.from(value));
        if (decoded) yield decoded;
      }
      const final = decoder.end();
      if (final) yield final;
    };
    try {
      for await (const decoded of decodedPieces()) {
        let offset = 0;
        for (; ; ) {
          const newline = decoded.indexOf("\n", offset);
          if (newline < 0) {
            consume(decoded.slice(offset));
            break;
          }
          consume(decoded.slice(offset, newline));
          yield finish();
          offset = newline + 1;
        }
      }
      while (emitted < (chunk.lineCount ?? emitted + (text.length > 0 ? 1 : 0))) yield finish();
    } finally {
      input.destroy();
      output.destroy();
    }
  }
  resultPart(record4) {
    return record4.envelope?.parts.find((part) => part.name === "result" && part.kind === "result");
  }
  resolvePart(record4, ref) {
    const parsed = parseObservationRef(ref);
    if (parsed.id !== record4.id || !record4.envelope) {
      const result = parsed.id === record4.id && parsed.partName === "result" ? this.resultPart(record4) : void 0;
      if (result) return result;
      throw new Error(`Unknown observation part: ${ref}`);
    }
    const part = parsed.pointer === void 0 ? record4.envelope.parts.find((candidate) => candidate.name === parsed.partName) : record4.envelope.parts.find(
      (candidate) => candidate.kind === "call-field" && candidate.name === "call" && candidate.pointer === parsed.pointer
    );
    if (!part) throw new Error(`Unknown observation part: ${ref}`);
    return part;
  }
  async readBinaryPart(part, ref, signal) {
    if (part.binaryBytes === void 0 || part.chunks.length !== 1) {
      throw new Error(`Observation part ${ref} is text and cannot be read as an image.`);
    }
    return readFile(join2(this.sessionPath, part.chunks[0].relativeFile), { signal });
  }
  renderStreamMatches(matches, lines, contextLines, totalLines) {
    if (matches.length === 0) return "";
    const matched = new Set(matches);
    const ranges = [];
    for (const line of matches) {
      const first = Math.max(1, line - contextLines);
      const last = Math.min(totalLines, line + contextLines);
      const current = ranges.at(-1);
      if (current && first <= current.last + 1) {
        current.last = Math.max(current.last, last);
        current.matches.push(line);
      } else {
        ranges.push({ first, last, matches: [line] });
      }
    }
    return ranges.map((range) => {
      const heading = range.matches.length === 1 ? `Match at line ${range.matches[0]}:` : `Matches at lines ${range.matches.join(", ")}:`;
      const output = [heading];
      for (let line = range.first; line <= range.last; line += 1) {
        const value = lines.get(line);
        if (value === void 0) continue;
        output.push(`${matched.has(line) ? ">" : " "} ${line}: ${value}`);
      }
      return output.join("\n");
    }).join("\n\n");
  }
  async readTextPart(part, ref, signal) {
    if (part.textBytes === void 0) throw new Error(`Observation part ${ref} is binary and cannot be read as text.`);
    const texts = [];
    for (const chunk of part.chunks) {
      const compressed = await readFile(join2(this.sessionPath, chunk.relativeFile), { signal });
      signal?.throwIfAborted();
      texts.push((await gunzipAsync(compressed)).toString("utf8"));
    }
    return texts.join("");
  }
  async readTextPartPrefix(part, ref, maxBytes, signal) {
    if (part.textBytes === void 0) throw new Error(`Observation part ${ref} is binary and cannot be read as text.`);
    let text = "";
    for (const chunk of part.chunks) {
      const compressed = await readFile(join2(this.sessionPath, chunk.relativeFile), { signal });
      signal?.throwIfAborted();
      text += (await gunzipAsync(compressed)).toString("utf8");
      if (utf8Bytes(text) >= maxBytes) break;
    }
    return truncateUtf8(text, maxBytes);
  }
  async readCompressedChunkBytes(relativeFile, requestedStart, maxBytes, signal) {
    const input = createReadStream2(join2(this.sessionPath, relativeFile), { signal });
    const output = input.pipe(createGunzip());
    const selected = [];
    let offset = 0;
    let captured = 0;
    try {
      for await (const raw of output) {
        signal?.throwIfAborted();
        const body = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
        const bodyEnd = offset + body.byteLength;
        if (bodyEnd > requestedStart && captured < maxBytes) {
          const localStart = Math.max(0, requestedStart - offset);
          const take = Math.min(body.byteLength - localStart, maxBytes - captured);
          if (take > 0) {
            selected.push(body.subarray(localStart, localStart + take));
            captured += take;
          }
        }
        offset = bodyEnd;
        if (captured >= maxBytes) break;
      }
    } finally {
      output.destroy();
      input.destroy();
    }
    return Buffer.concat(selected);
  }
  async readTextPartBytes(part, ref, requestedStart, maxBytes, signal) {
    if (part.textBytes === void 0) throw new Error(`Observation part ${ref} is binary and cannot be read as text.`);
    const totalBytes = part.textBytes;
    if (!Number.isInteger(requestedStart) || requestedStart < 0 || requestedStart >= Math.max(1, totalBytes)) {
      throw new Error(`startByte must be between 0 and ${Math.max(0, totalBytes - 1)} for ${ref}.`);
    }
    const selected = [];
    let absolute = 0;
    let captured = 0;
    const targetBytes = maxBytes + 4;
    for (const chunk of part.chunks) {
      const chunkEnd = absolute + chunk.textBytes;
      if (chunkEnd > requestedStart && captured < targetBytes) {
        const localStart = Math.max(0, requestedStart - absolute);
        const take = Math.min(chunk.textBytes - localStart, targetBytes - captured);
        if (take > 0) {
          const bytes2 = await this.readCompressedChunkBytes(
            chunk.relativeFile,
            localStart,
            take,
            signal
          );
          selected.push(bytes2);
          captured += bytes2.byteLength;
        }
      }
      absolute = chunkEnd;
      if (captured >= targetBytes) break;
    }
    let bytes = Buffer.concat(selected);
    let startByte = requestedStart;
    while (bytes.length > 0 && (bytes[0] & 192) === 128) {
      bytes = bytes.subarray(1);
      startByte += 1;
    }
    const decoder = new StringDecoder2("utf8");
    let consumed = Math.min(bytes.byteLength, maxBytes);
    let text = decoder.write(bytes.subarray(0, consumed));
    while (text.length === 0 && consumed < bytes.byteLength) {
      text += decoder.write(bytes.subarray(consumed, consumed + 1));
      consumed += 1;
    }
    const returnedBytes = utf8Bytes(text);
    const endByte = startByte + returnedBytes;
    return { text, startByte, endByte, totalBytes, hasMore: endByte < totalBytes };
  }
  async readRecordText(record4, signal) {
    if (record4.envelope) {
      const result = record4.envelope.parts.find((part) => part.name === "result" && part.kind === "result");
      if (!result) throw new Error(`Unknown observation part: ${record4.id}:result`);
      return this.readTextPart(result, `${record4.id}:result`, signal);
    }
    const compressed = await readFile(join2(this.sessionPath, record4.relativeFile), { signal });
    signal?.throwIfAborted();
    return (await gunzipAsync(compressed)).toString("utf8");
  }
  async readExactText(ref, signal) {
    const parsed = parseObservationRef(ref);
    if (parsed.id !== ref) throw new Error(`Unknown observation ID: ${ref}`);
    const record4 = await this.findObservation(parsed.id, signal);
    return this.readRecordText(record4, signal);
  }
  async readLines(id, startLine = 1, endLine = startLine + 199, maxBytes = 65536, signal) {
    return this.readPartLines(`${normalizeObservationRef(id)}:result`, startLine, endLine, maxBytes, signal);
  }
  async readPartLines(ref, startLine = 1, endLine = startLine + 199, maxBytes = 65536, signal, includeOutsideTask = false) {
    validateLineRange(startLine, endLine);
    const parsed = parseObservationRef(ref);
    const record4 = await this.findObservation(parsed.id, signal, includeOutsideTask);
    const part = record4.envelope ? this.resolvePart(record4, ref) : void 0;
    const bodyBudget = Math.max(0, maxBytes - Math.min(512, Math.floor(maxBytes / 4)));
    if (!part || part.chunks.some((chunk) => chunk.firstLine === void 0 || chunk.lineCount === void 0)) {
      const text = part ? await this.readTextPart(part, ref, signal) : await this.readRecordText(record4, signal);
      const lines = splitVisibleLines(text);
      if (startLine > lines.length) {
        return truncateUtf8(`Observation part ${ref}: startLine ${startLine} is beyond its ${lines.length} lines.
`, maxBytes);
      }
      const requestedEnd2 = Math.min(endLine, lines.length);
      const selected2 = [];
      let retainedBytes2 = 0;
      for (let lineNumber = startLine; lineNumber <= requestedEnd2; lineNumber += 1) {
        const rendered = `${lineNumber}: ${lines[lineNumber - 1]}`;
        const bytes = utf8Bytes(rendered) + (selected2.length === 0 ? 0 : 1);
        if (retainedBytes2 + bytes > bodyBudget) break;
        selected2.push(rendered);
        retainedBytes2 += bytes;
      }
      const returnedEnd2 = selected2.length === 0 ? startLine - 1 : startLine + selected2.length - 1;
      const header2 = selected2.length === 0 ? `Observation part ${ref}: no complete line fits the ${maxBytes}-byte response budget. More lines exist.
` : `Observation part ${ref}: lines ${startLine}-${returnedEnd2} of ${lines.length}.` + (returnedEnd2 < lines.length ? " More lines exist.\n" : "\n");
      return boundedResponse(header2, selected2.join("\n"), maxBytes);
    }
    const totalLines = part.lineCount ?? 0;
    if (startLine > totalLines) {
      return truncateUtf8(`Observation part ${ref}: startLine ${startLine} is beyond its ${totalLines} lines.
`, maxBytes);
    }
    const requestedEnd = Math.min(endLine, totalLines);
    const selected = [];
    let retainedBytes = 0;
    const chunks = part.chunks.filter((chunk) => {
      const first = chunk.firstLine;
      const last = first + chunk.lineCount - 1;
      return first <= requestedEnd && last >= startLine;
    });
    outer: for (const chunk of chunks) {
      for await (const line of this.streamChunkLines(chunk, Math.max(0, bodyBudget - retainedBytes), void 0, signal)) {
        if (line.lineNumber < startLine) continue;
        if (line.lineNumber > requestedEnd) break outer;
        if (line.truncated) break outer;
        const rendered = `${line.lineNumber}: ${line.text}`;
        const bytes = utf8Bytes(rendered) + (selected.length === 0 ? 0 : 1);
        if (retainedBytes + bytes > bodyBudget) break outer;
        selected.push(rendered);
        retainedBytes += bytes;
      }
    }
    const returnedEnd = selected.length === 0 ? startLine - 1 : Number(/^\d+/.exec(selected.at(-1) ?? "")?.[0]);
    const header = selected.length === 0 ? `Observation part ${ref}: no complete line fits the ${maxBytes}-byte response budget. More lines exist.
` : `Observation part ${ref}: lines ${startLine}-${returnedEnd} of ${totalLines}.` + (returnedEnd < totalLines ? " More lines exist.\n" : "\n");
    return boundedResponse(header, selected.join("\n"), maxBytes);
  }
  async search(id, query, contextLines = 1, matchOffset = 0, maxMatches = 50, maxBytes = 65536, signal) {
    return this.searchPart(
      `${normalizeObservationRef(id)}:result`,
      query,
      contextLines,
      matchOffset,
      maxMatches,
      maxBytes,
      signal
    );
  }
  async searchPart(ref, query, contextLines = 1, matchOffset = 0, maxMatches = 50, maxBytes = 65536, signal, includeOutsideTask = false) {
    if (query.length === 0) throw new Error("query must be a non-empty fixed string.");
    validateContextLines(contextLines);
    validateMatchOffset(matchOffset);
    validateMaxMatches(maxMatches);
    const parsed = parseObservationRef(ref);
    const record4 = await this.findObservation(parsed.id, signal, includeOutsideTask);
    const part = record4.envelope ? this.resolvePart(record4, ref) : void 0;
    if (!part || part.chunks.some((chunk) => chunk.firstLine === void 0 || chunk.lineCount === void 0)) {
      const text = part ? await this.readTextPart(part, ref, signal) : await this.readRecordText(record4, signal);
      const lines = splitVisibleLines(text);
      const matches = findMatchingLines(lines, query.toLowerCase(), matchOffset + maxMatches + 1);
      if (matches.length === 0) return `No matches for "${query}" in ${ref}.`;
      const shown2 = matches.slice(matchOffset, matchOffset + maxMatches);
      if (shown2.length === 0) {
        return `No matches for "${query}" in ${ref} at match offset ${matchOffset}. Earlier matches exist.`;
      }
      const hasMore2 = matches.length > matchOffset + maxMatches;
      const header2 = `Search ${ref} for "${query}" at match offset ${matchOffset}: ${shown2.length} match${shown2.length === 1 ? "" : "es"}.` + (matchOffset > 0 ? " Earlier matches exist." : "") + (hasMore2 ? " More matches exist.\n" : "\n");
      return boundedResponse(header2, renderMatches(lines, shown2, contextLines), maxBytes);
    }
    const shown = [];
    const captured = /* @__PURE__ */ new Map();
    const previous = [];
    let capturedBytes = 0;
    let matchCount = 0;
    let hasMore = false;
    let scanTruncated = false;
    let captureUntil = 0;
    const keep = (line) => {
      if (captured.has(line.lineNumber) || capturedBytes >= maxBytes * 2) return;
      captured.set(line.lineNumber, line.text);
      capturedBytes += utf8Bytes(line.text) + 16;
    };
    outer: for (const chunk of part.chunks) {
      for await (const line of this.streamChunkLines(chunk, maxBytes, query, signal)) {
        if (line.lineNumber <= captureUntil) keep(line);
        if (line.matches) {
          const index = matchCount;
          matchCount += 1;
          if (index >= matchOffset && shown.length < maxMatches) {
            shown.push(line.lineNumber);
            keep(line);
            for (const context of previous) keep(context);
            captureUntil = Math.max(captureUntil, line.lineNumber + contextLines);
          } else if (index >= matchOffset + maxMatches) {
            hasMore = true;
          }
        }
        previous.push({ lineNumber: line.lineNumber, text: line.text });
        if (previous.length > contextLines) previous.shift();
        const contextComplete = line.lineNumber >= captureUntil;
        if (shown.length >= maxMatches && contextComplete) {
          scanTruncated = line.lineNumber < (part.lineCount ?? line.lineNumber);
          break outer;
        }
        const byteBudgetSatisfied = capturedBytes >= maxBytes;
        if ((byteBudgetSatisfied || hasMore) && contextComplete) {
          hasMore ||= line.lineNumber < (part.lineCount ?? line.lineNumber);
          break outer;
        }
      }
    }
    if (matchCount === 0) return `No matches for "${query}" in ${ref}.`;
    if (shown.length === 0) {
      return `No matches for "${query}" in ${ref} at match offset ${matchOffset}. Earlier matches exist.`;
    }
    const header = `Search ${ref} for "${query}" at match offset ${matchOffset}: ${shown.length} match${shown.length === 1 ? "" : "es"}.` + (matchOffset > 0 ? " Earlier matches exist." : "") + (hasMore ? " More matches exist.\n" : scanTruncated ? ` Search stopped at the requested match limit; continue at match offset ${matchOffset + shown.length}.
` : "\n");
    return boundedResponse(
      header,
      this.renderStreamMatches(shown, captured, contextLines, part.lineCount ?? 0),
      maxBytes
    );
  }
  recoveryDetails(record4, ref, part, current) {
    const envelope = record4.envelope;
    const sameTask = envelope !== void 0 && current?.taskKey !== void 0 && envelope.taskKey === current.taskKey;
    return {
      observationId: record4.id,
      ref,
      partKind: part.kind,
      ...part.pointer === void 0 ? {} : { pointer: part.pointer },
      ...part.mediaType === void 0 ? {} : { mediaType: part.mediaType },
      ...part.binaryBytes === void 0 ? {} : { binaryBytes: part.binaryBytes },
      ...part.width === void 0 ? {} : { width: part.width },
      ...part.height === void 0 ? {} : { height: part.height },
      ...envelope?.subjectKey === void 0 ? {} : { subjectKey: envelope.subjectKey },
      ...envelope?.resources === void 0 ? {} : { resources: [...envelope.resources] },
      ...envelope?.suite === void 0 ? {} : { suite: { ...envelope.suite } },
      scope: this.isInActiveScope(record4) ? "task" : "session",
      currentWorkspace: sameTask && current?.workspaceRevision !== void 0 && envelope.workspaceRevisionAtResult === current.workspaceRevision,
      currentRequirements: sameTask && current?.requirementsRevision !== void 0 && envelope.requirementsRevision === current.requirementsRevision
    };
  }
  async inspect(ref, options = {}, signal, includeOutsideTask = false) {
    const parsed = parseObservationRef(ref);
    const record4 = await this.findObservation(parsed.id, signal, includeOutsideTask);
    const part = this.resolvePart(record4, ref);
    const details = this.recoveryDetails(record4, ref, part, options.current);
    if (part.binaryBytes !== void 0) {
      const imagePart = part.kind === "image" || part.kind === "attachment" && part.mediaType?.toLowerCase().startsWith("image/") === true;
      if (!imagePart) throw new Error(`Observation part ${ref} is binary but is not an image.`);
      const mediaType = part.mediaType?.toLowerCase() ?? "application/octet-stream";
      const dimensions = part.width && part.height ? `${part.width}x${part.height}` : "unknown";
      const label = `Image ${ref} | ${mediaType} | ${part.binaryBytes} bytes | ${dimensions}`;
      const providerImage = (/* @__PURE__ */ new Set(["image/png", "image/jpeg", "image/gif", "image/webp"])).has(mediaType);
      if (!providerImage || part.binaryBytes > RECOVERY_IMAGE_MAX_BYTES) {
        const reason = !providerImage ? "this MIME type cannot be displayed by the provider" : `the image exceeds the ${RECOVERY_IMAGE_MAX_BYTES}-byte display limit`;
        return {
          content: [{ type: "text", text: `${label} | exact bytes are archived but ${reason}.` }],
          details
        };
      }
      const bytes = await this.readBinaryPart(part, ref, signal);
      return {
        content: [
          { type: "text", text: label },
          { type: "image", data: bytes.toString("base64"), mimeType: mediaType }
        ],
        details
      };
    }
    const maxBytes = Math.max(1, options.maxBytes ?? 12 * 1024);
    let text;
    let truncatedByBytes = false;
    let startLine;
    let endLine;
    let bytePage;
    if (options.query !== void 0) {
      text = await this.searchPart(
        ref,
        options.query,
        options.contextLines ?? 1,
        options.matchOffset ?? 0,
        options.maxMatches ?? 10,
        maxBytes,
        signal,
        includeOutsideTask
      );
      const lines = [...text.matchAll(/^[ >]\s+(\d+):/gm)].map((match) => Number(match[1]));
      if (lines.length > 0) {
        startLine = Math.min(...lines);
        endLine = Math.max(...lines);
      }
    } else if (options.startByte !== void 0 || part.kind === "call-field" && options.startLine === void 0 && options.endLine === void 0) {
      const requestedStart = options.startByte ?? 0;
      const requestedBytes = options.endByte === void 0 ? maxBytes : Math.min(maxBytes, Math.max(1, options.endByte - requestedStart));
      const page = await this.readTextPartBytes(part, ref, requestedStart, requestedBytes, signal);
      text = page.text;
      bytePage = page;
    } else {
      const requestedStart = options.startLine ?? 1;
      const requestedEnd = options.endLine ?? requestedStart + 79;
      text = await this.readPartLines(
        ref,
        requestedStart,
        Math.min(requestedEnd, requestedStart + 79, part.lineCount ?? requestedEnd),
        maxBytes,
        signal,
        includeOutsideTask
      );
      const returned = [...text.matchAll(/^(\d+):/gm)].map((match) => Number(match[1]));
      if (returned.length > 0) {
        startLine = returned[0];
        endLine = returned.at(-1);
      }
    }
    return {
      content: [{ type: "text", text }],
      details: {
        ...details,
        ...startLine === void 0 ? {} : { startLine },
        ...endLine === void 0 ? {} : { endLine },
        ...part.lineCount === void 0 ? {} : { totalLines: part.lineCount },
        ...bytePage === void 0 ? {} : {
          startByte: bytePage.startByte,
          endByte: bytePage.endByte,
          totalBytes: bytePage.totalBytes
        },
        hasMore: bytePage?.hasMore ?? (truncatedByBytes || endLine === void 0 || endLine < (part.lineCount ?? endLine ?? 0))
      }
    };
  }
  async recall(options, maxBytes = 12 * 1024, current, signal, externalSources = []) {
    validateContextLines(options.contextLines ?? 1);
    const requestedScope = options.scope ?? "task";
    const availableSources = requestedScope === "task" || requestedScope === "session" ? [{ archive: this, scope: requestedScope, sessionId: this.sessionId }] : externalSources.filter((source) => source.scope === requestedScope).map((source) => ({ ...source }));
    let exactInput = options.id;
    let sources = availableSources;
    if (exactInput && requestedScope !== "task") {
      const qualified = [...availableSources].sort((left, right) => right.sessionId.length - left.sessionId.length).find((source) => exactInput.startsWith(`${source.sessionId}:`));
      if (qualified) {
        exactInput = exactInput.slice(qualified.sessionId.length + 1);
        sources = [qualified];
      }
    }
    const exact = exactInput ? parseObservationRef(exactInput) : void 0;
    const query = options.query?.toLowerCase();
    const path = options.path;
    const activeDiagnosticIds = new Set(current?.activeDiagnosticExchangeIds ?? []);
    const activeDiagnosticSignals = new Set(current?.activeDiagnosticSignals ?? []);
    const kindMatches = (part) => {
      if (!options.kind) return true;
      if (options.kind === "call") return part.kind === "call" || part.kind === "call-field";
      if (options.kind === "diagnostic") return part.kind === "stderr" || part.kind === "traceback";
      if (options.kind === "image") {
        return part.kind === "image" || part.kind === "attachment" && part.mediaType?.toLowerCase().startsWith("image/") === true;
      }
      return part.kind === options.kind;
    };
    const sourceRecords = (await Promise.all(sources.map(async (source) => ({
      source,
      records: [...await source.archive.readCatalog(signal)].filter(
        (record4) => source.scope !== "task" || source.archive.isInActiveScope(record4)
      )
    })))).flatMap(({ source, records }) => records.map((record4, catalogRecency) => ({
      source,
      record: record4,
      catalogRecency
    })));
    const seeds = sourceRecords.flatMap(({ source, record: record4, catalogRecency }) => {
      const envelope = record4.envelope;
      if (!envelope) return [];
      if (exact && exact.id !== record4.id) return [];
      if (options.tool && envelope.toolName !== options.tool) return [];
      if (options.status === "error" && !record4.isError) return [];
      if (options.status === "failure" && envelope.outcome.status !== "failure") return [];
      if (options.status === "success" && (record4.isError || envelope.outcome.status !== "success")) return [];
      const parts = envelope.parts.filter(kindMatches);
      if (parts.length === 0) return [];
      const subjectSignals = [envelope.subjectKey, ...envelope.resources];
      const foldedSubjectSignals = subjectSignals.map((value) => value.toLowerCase());
      const suiteSignals = [envelope.suite?.family, envelope.suite?.target].filter((value) => typeof value === "string");
      const diagnosticSignals = [
        ...envelope.outcome.commandFailures,
        ...envelope.outcome.exceptions,
        ...envelope.outcome.failingTests,
        ...envelope.outcome.sourceLocations,
        ...envelope.outcome.exitStatuses,
        envelope.outcome.testSummary,
        envelope.outcome.signature
      ].filter((value) => typeof value === "string");
      const foldedSuiteSignals = suiteSignals.map((value) => value.toLowerCase());
      const foldedOutcomeSignals = diagnosticSignals.map((value) => value.toLowerCase());
      const exactPathSubject = Boolean(
        path && subjectSignals.includes(path) || options.query && subjectSignals.includes(options.query)
      );
      const pathMatch = !path || subjectSignals.some((value) => value === path || value.includes(path));
      if (!pathMatch) return [];
      const sameTask = envelope.taskKey === current?.taskKey;
      const currentBranch = source.archive === this && source.archive.isOnActiveBranch(record4);
      const activeDiagnostic = Boolean(
        source.archive === this && sameTask && (activeDiagnosticIds.has(record4.id) || diagnosticSignals.some((value) => activeDiagnosticSignals.has(value))) || options.query && envelope.outcome.failingTests.includes(options.query)
      );
      const suiteMatch = Boolean(query && foldedSuiteSignals.includes(query));
      const metadataQueryMatch = Boolean(query && [
        ...foldedSubjectSignals,
        ...foldedSuiteSignals,
        ...foldedOutcomeSignals
      ].some((value) => value === query || value.includes(query)));
      const storedSignalMatch = Boolean(query && [envelope.callSummary, envelope.resultCapsule].some((value) => value.toLowerCase().includes(query)));
      return [{
        source,
        record: record4,
        catalogRecency,
        envelope,
        parts,
        exactPathSubject,
        activeDiagnostic,
        suiteMatch,
        metadataQueryMatch,
        storedSignalMatch,
        currentBranch,
        sameTask
      }];
    });
    const candidates = await mapBounded(seeds, 4, async (seed) => {
      let fixedStringMatch = false;
      let matchedPartRef;
      if (query) {
        for (const part of seed.parts) {
          if (part.binaryBytes !== void 0) continue;
          const ref = partReference(seed.record.id, part);
          try {
            const found = await seed.source.archive.searchPart(
              ref,
              options.query,
              0,
              0,
              1,
              256,
              signal,
              true
            );
            if (!found.startsWith("No matches for")) {
              fixedStringMatch = true;
              matchedPartRef = ref;
              break;
            }
          } catch (error) {
            if (signal?.aborted) throw error;
            continue;
          }
        }
      }
      const exactPartMatch = fixedStringMatch;
      fixedStringMatch ||= seed.storedSignalMatch;
      const rank = [
        exact ? 1 : 0,
        seed.exactPathSubject ? 1 : 0,
        seed.activeDiagnostic ? 1 : 0,
        seed.suiteMatch ? 1 : 0,
        fixedStringMatch ? 1 : 0,
        exactPartMatch ? 1 : 0,
        seed.currentBranch ? 1 : 0,
        seed.sameTask ? 1 : 0,
        seed.sameTask && seed.envelope.workspaceRevisionAtResult === current?.workspaceRevision ? 1 : 0,
        seed.sameTask && seed.envelope.requirementsRevision === current?.requirementsRevision ? 1 : 0,
        Date.parse(seed.record.createdAt) || 0,
        seed.catalogRecency
      ];
      return { ...seed, fixedStringMatch, exactPartMatch, matchedPartRef, rank };
    });
    candidates.sort((left, right) => {
      for (let index = 0; index < left.rank.length; index += 1) {
        if (left.rank[index] !== right.rank[index]) return right.rank[index] - left.rank[index];
      }
      const sessionOrder = right.source.sessionId.localeCompare(left.source.sessionId);
      return sessionOrder || right.record.id.localeCompare(left.record.id);
    });
    const content = [];
    const sections = [];
    const matches = [];
    let remaining = maxBytes;
    for (const candidate of candidates) {
      if (matches.length >= 3 || remaining <= 256) break;
      const exactRef = exact?.id === candidate.record.id && exactInput?.includes(":") ? exactInput : void 0;
      const orderedParts = exactRef ? candidate.parts.filter((part) => partReference(candidate.record.id, part) === exactRef) : candidate.matchedPartRef ? [...candidate.parts].sort(
        (left, right) => Number(partReference(candidate.record.id, right) === candidate.matchedPartRef) - Number(partReference(candidate.record.id, left) === candidate.matchedPartRef)
      ) : candidate.parts;
      let selected;
      let partMatched = false;
      if (query && candidate.exactPartMatch) {
        for (const part of orderedParts) {
          if (part.binaryBytes !== void 0) continue;
          const ref = partReference(candidate.record.id, part);
          try {
            const attempt = await candidate.source.archive.inspect(ref, {
              query: options.query,
              contextLines: options.contextLines ?? 1,
              maxBytes: Math.max(1, remaining - 240),
              current
            }, signal, true);
            const body = attempt.content.find((block) => block.type === "text")?.text ?? "";
            if (body.startsWith("No matches for")) continue;
            selected = attempt;
            partMatched = true;
            break;
          } catch (error) {
            if (signal?.aborted) throw error;
            continue;
          }
        }
      }
      const structuredMatch = Boolean(
        exact || path || candidate.metadataQueryMatch || candidate.storedSignalMatch || !query
      );
      if (!selected && structuredMatch) {
        for (const part of orderedParts) {
          const ref = partReference(candidate.record.id, part);
          try {
            selected = await candidate.source.archive.inspect(ref, {
              ...part.binaryBytes === void 0 ? { startLine: 1, endLine: 20 } : {},
              maxBytes: Math.max(1, remaining - 240),
              current
            }, signal, true);
            break;
          } catch (error) {
            if (signal?.aborted) throw error;
            continue;
          }
        }
      }
      if (!selected || query && !partMatched && !structuredMatch) continue;
      const external = candidate.source.archive !== this;
      const details = {
        ...selected.details,
        scope: candidate.source.scope,
        ...candidate.source.scope !== "task" || external ? {
          sessionId: candidate.source.sessionId,
          sessionDate: candidate.source.sessionDate ?? candidate.record.createdAt
        } : {},
        currentWorkspace: candidate.sameTask && current?.workspaceRevision !== void 0 && candidate.envelope.workspaceRevisionAtResult === current.workspaceRevision,
        currentRequirements: candidate.sameTask && current?.requirementsRevision !== void 0 && candidate.envelope.requirementsRevision === current.requirementsRevision
      };
      const label = selected.content.find((block) => block.type === "text")?.text ?? "";
      const heading = [
        `Recall ${details.ref} | ${details.partKind} | scope=${details.scope}`,
        details.sessionId ? `session=${details.sessionId}` : "",
        details.sessionDate ? `date=${details.sessionDate}` : "",
        `subject=${candidate.envelope.subjectKey}`,
        candidate.envelope.resources.length > 0 ? `resources=${candidate.envelope.resources.join(",")}` : "",
        candidate.envelope.suite ? `suite=${candidate.envelope.suite.family}:${candidate.envelope.suite.target}` : "",
        `workspace=${details.currentWorkspace ? "current" : "historical"}`,
        `requirements=${details.currentRequirements ? "current" : "historical"}`
      ].filter(Boolean).join(" | ");
      const section = truncateUtf8(`${heading}
${label}`, remaining);
      sections.push(section);
      remaining -= utf8Bytes(section) + 2;
      matches.push(details);
      const image = selected.content.find((block) => block.type === "image");
      if (image) {
        content.push({ type: "text", text: sections.join("\n\n") }, image);
        sections.length = 0;
        break;
      }
    }
    if (sections.length > 0) content.push({ type: "text", text: sections.join("\n\n") });
    if (content.length === 0) content.push({ type: "text", text: "No recall matches found." });
    return { content, matches };
  }
  async scanRecordMatches(record4, query, contextLines, matchOffset, maxMatches, maxBytes, signal) {
    const part = this.resultPart(record4);
    if (record4.envelope && !part) {
      return { matchCount: 0, shown: [], captured: /* @__PURE__ */ new Map(), hasMore: false, scanTruncated: false, totalLines: 0 };
    }
    if (!part || part.chunks.some((chunk) => chunk.firstLine === void 0 || chunk.lineCount === void 0)) {
      const lines = splitVisibleLines(await this.readRecordText(record4, signal));
      const matches = findMatchingLines(lines, query.toLowerCase(), matchOffset + maxMatches + 1);
      const shown2 = matches.slice(matchOffset, matchOffset + maxMatches).map((line) => line + 1);
      const captured2 = /* @__PURE__ */ new Map();
      for (const line of shown2) {
        for (let context = Math.max(1, line - contextLines); context <= Math.min(lines.length, line + contextLines); context += 1) {
          captured2.set(context, lines[context - 1]);
        }
      }
      return {
        matchCount: matches.length,
        shown: shown2,
        captured: captured2,
        hasMore: matches.length > matchOffset + maxMatches,
        scanTruncated: false,
        totalLines: lines.length
      };
    }
    const shown = [];
    const captured = /* @__PURE__ */ new Map();
    const previous = [];
    let capturedBytes = 0;
    let matchCount = 0;
    let hasMore = false;
    let scanTruncated = false;
    let captureUntil = 0;
    const keep = (line) => {
      if (captured.has(line.lineNumber) || capturedBytes >= maxBytes * 2) return;
      captured.set(line.lineNumber, line.text);
      capturedBytes += utf8Bytes(line.text) + 16;
    };
    outer: for (const chunk of part.chunks) {
      for await (const line of this.streamChunkLines(chunk, maxBytes, query, signal)) {
        if (line.lineNumber <= captureUntil) keep(line);
        if (line.matches) {
          const index = matchCount;
          matchCount += 1;
          if (index >= matchOffset && shown.length < maxMatches) {
            shown.push(line.lineNumber);
            keep(line);
            for (const context of previous) keep(context);
            captureUntil = Math.max(captureUntil, line.lineNumber + contextLines);
          } else if (index >= matchOffset + maxMatches) {
            hasMore = true;
          }
        }
        previous.push({ lineNumber: line.lineNumber, text: line.text });
        if (previous.length > contextLines) previous.shift();
        const contextComplete = line.lineNumber >= captureUntil;
        if (shown.length >= maxMatches && contextComplete) {
          scanTruncated = line.lineNumber < (part.lineCount ?? line.lineNumber);
          break outer;
        }
        const byteBudgetSatisfied = capturedBytes >= maxBytes;
        if ((byteBudgetSatisfied || hasMore) && contextComplete) {
          hasMore ||= line.lineNumber < (part.lineCount ?? line.lineNumber);
          break outer;
        }
      }
    }
    return { matchCount, shown, captured, hasMore, scanTruncated, totalLines: part.lineCount ?? 0 };
  }
  async searchRecent(query, observationLimit = 20, contextLines = 1, matchOffset = 0, maxMatches = 50, maxBytes = 65536, signal) {
    if (query.length === 0) throw new Error("query must be a non-empty fixed string.");
    validateContextLines(contextLines);
    validateMatchOffset(matchOffset);
    validateMaxMatches(maxMatches);
    const observations = await this.list(observationLimit, signal);
    if (observations.length === 0) return "No archived observations in this session.";
    const sections = [];
    let shownCount = 0;
    let skip = matchOffset;
    let sawAnyMatch = false;
    let hasMore = false;
    let scanTruncated = false;
    for (const observation of observations) {
      signal?.throwIfAborted();
      const remaining = maxMatches - shownCount;
      const result = await this.scanRecordMatches(
        observation,
        query,
        contextLines,
        remaining > 0 ? skip : 0,
        remaining > 0 ? remaining : 1,
        maxBytes,
        signal
      );
      if (result.matchCount > 0) sawAnyMatch = true;
      if (remaining <= 0) {
        if (result.matchCount > 0) {
          hasMore = true;
          break;
        }
        continue;
      }
      if (result.shown.length > 0) {
        sections.push(
          `Observation ${observation.id} (${observation.toolName}, ${observation.createdAt}):
` + this.renderStreamMatches(result.shown, result.captured, contextLines, result.totalLines)
        );
        shownCount += result.shown.length;
      }
      if (shownCount >= maxMatches) {
        scanTruncated = result.scanTruncated || observation !== observations.at(-1);
        hasMore ||= result.hasMore;
        break;
      }
      if (result.hasMore) {
        hasMore = true;
        break;
      }
      if (result.scanTruncated) {
        scanTruncated = true;
        break;
      }
      if (result.matchCount <= skip) skip -= result.matchCount;
      else skip = 0;
    }
    if (shownCount === 0) {
      return sawAnyMatch ? `No matches for "${query}" at match offset ${matchOffset} in the ${observations.length} most recent observations. Earlier matches exist.` : `No matches for "${query}" in the ${observations.length} most recent observations.`;
    }
    const header = `Search the ${observations.length} most recent observations for "${query}" at match offset ${matchOffset}: ${shownCount} match${shownCount === 1 ? "" : "es"} in ${sections.length} observation part${sections.length === 1 ? "" : "s"}.` + (matchOffset > 0 ? " Earlier matches exist." : "") + (hasMore ? " More matches exist.\n" : scanTruncated ? ` Search stopped at the requested match limit; continue at match offset ${matchOffset + shownCount}.
` : "\n");
    return boundedResponse(header, sections.join("\n\n"), maxBytes);
  }
  async findObservation(ref, signal, includeOutsideTask = false) {
    const id = normalizeObservationRef(ref);
    await this.readCatalog(signal);
    const record4 = this.catalogById.get(id);
    if (!record4 || !includeOutsideTask && !this.isInActiveScope(record4)) {
      throw new Error(`Unknown observation ID: ${ref}`);
    }
    return record4;
  }
  async importFrom(source, observationIds, signal, forkScope) {
    const requested = [...new Set(observationIds.map(normalizeObservationRef))];
    if (requested.length === 0) return 0;
    return this.withIndexLock(async () => {
      const sourceRecords = await source.readCatalog(signal);
      const targetRecords = await this.readCatalog(signal);
      const existing = new Set(targetRecords.map((observation) => observation.id));
      const copiedFiles = [];
      const imported = [];
      await mkdir(this.observationsPath, { recursive: true });
      try {
        for (const id of requested) {
          if (existing.has(id)) continue;
          const sourceRecord = source.catalogById.get(id);
          if (!sourceRecord) continue;
          signal?.throwIfAborted();
          const observationFiles = [];
          try {
            if (sourceRecord.envelope) {
              const envelope = structuredClone(sourceRecord.envelope);
              for (const chunk of envelope.parts.flatMap((part) => part.chunks)) {
                const targetFile = join2(this.sessionPath, chunk.relativeFile);
                const temporary = `${targetFile}.${randomUUID2()}.tmp`;
                copiedFiles.push(temporary);
                observationFiles.push(temporary);
                await copyFile(join2(source.sessionPath, chunk.relativeFile), temporary);
                signal?.throwIfAborted();
                await rename2(temporary, targetFile);
                copiedFiles.push(targetFile);
                observationFiles.push(targetFile);
              }
              if (forkScope?.taskKey !== void 0) envelope.taskKey = forkScope.taskKey;
              if (forkScope?.branchAnchorId !== void 0) envelope.branchAnchorId = forkScope.branchAnchorId;
              if (forkScope) envelope.forkImported = true;
              const relativeFile = join2("observations", `${envelope.id}.meta.json`);
              await this.writeEnvelope(relativeFile, envelope, signal);
              copiedFiles.push(join2(this.sessionPath, relativeFile));
              observationFiles.push(join2(this.sessionPath, relativeFile));
              imported.push(this.envelopeRecord({
                schema: "prime-context.exchange/v2",
                id: envelope.id,
                relativeFile
              }, envelope));
            } else {
              const targetFile = join2(this.sessionPath, sourceRecord.relativeFile);
              const temporary = `${targetFile}.${randomUUID2()}.tmp`;
              copiedFiles.push(temporary);
              observationFiles.push(temporary);
              await copyFile(join2(source.sessionPath, sourceRecord.relativeFile), temporary);
              signal?.throwIfAborted();
              await rename2(temporary, targetFile);
              copiedFiles.push(targetFile);
              observationFiles.push(targetFile);
              imported.push({
                ...sourceRecord,
                ...forkScope && sourceRecord.exchange ? {
                  exchange: {
                    ...sourceRecord.exchange,
                    ...forkScope.taskKey === void 0 ? {} : { taskKey: forkScope.taskKey },
                    ...forkScope.branchAnchorId === void 0 ? {} : { branchAnchorId: forkScope.branchAnchorId },
                    forkImported: true
                  }
                } : {}
              });
            }
            existing.add(id);
          } catch (error) {
            if (signal?.aborted) throw error;
            await Promise.all(observationFiles.map((path) => rm2(path, { force: true }).catch(() => void 0)));
          }
        }
        if (imported.length === 0) return 0;
        const combined = [...targetRecords, ...imported];
        const legacy = combined.filter((record4) => !record4.envelope);
        if (legacy.length > 0) await this.writeIndex({
          schema: "prime-context.observation-index/v1",
          observations: legacy
        }, signal);
        let nextSequence = this.sessionMetadata?.nextSequence ?? 1;
        for (const record4 of imported) {
          const match = /^o(\d+)$/.exec(record4.id);
          if (match) nextSequence = Math.max(nextSequence, Number(match[1]) + 1);
        }
        const metadata = this.metadataWithBrokerState({
          schema: "prime-context.archive-session/v1",
          nextSequence,
          observationCount: combined.length
        });
        await this.writeSessionMetadata(metadata, signal);
        targetRecords.push(...imported);
        for (const record4 of imported) this.catalogById.set(record4.id, record4);
        this.sessionMetadata = metadata;
        await Promise.all(copiedFiles.filter((path) => path.endsWith(".tmp")).map((path) => rm2(path, { force: true }).catch(() => void 0)));
        return imported.length;
      } catch (error) {
        await Promise.all(copiedFiles.map((path) => rm2(path, { force: true }).catch(() => void 0)));
        throw error;
      }
    });
  }
  async loadFixedExchangeViews(signal, exchangeIds) {
    const requested = exchangeIds ? new Set(exchangeIds) : void 0;
    const views = [];
    for (const record4 of await this.readCatalog(signal)) {
      if (requested && !requested.has(record4.id)) continue;
      const envelope = record4.envelope;
      const view = envelope?.fixedView;
      if (envelope && envelope.toolName !== "prime_context" && view?.schema === "prime-context.fixed-exchange-view/v1" && view.generation === 0 && typeof view.toolCallId === "string" && Number.isSafeInteger(view.visibleBytes) && view.visibleBytes >= 0) {
        const images = imageRefsForEnvelope(envelope);
        views.push(images.length === 0 ? view : { ...view, images });
      }
    }
    return views;
  }
  async finalizeExchanges(exchanges, signal, fixedViewOptions) {
    if (exchanges.length === 0) return 0;
    return this.withIndexLock(async () => {
      const records = await this.readCatalog(signal);
      const brokerStateBefore = this.broker.persistentState();
      const viewOptions = fixedViewOptions ?? { budgetBytes: 24 * 1024, capsuleMaxBytes: 6144 };
      const ordered = exchanges.map((completed, inputOrder) => ({ completed, inputOrder })).sort(
        (left, right) => (left.completed.sourceOrder ?? left.inputOrder) - (right.completed.sourceOrder ?? right.inputOrder) || left.inputOrder - right.inputOrder
      ).map(({ completed }) => completed);
      const prepared = [];
      const createdChunks = /* @__PURE__ */ new Set();
      const committed = [];
      const generation = `g-${randomUUID2()}`;
      const appendPreparedPart = async (item, input, replacement = false) => {
        const before = item.envelope.parts.length;
        await this.appendPart(item.envelope, input, signal, replacement ? generation : void 0);
        for (const part of item.envelope.parts.slice(before)) {
          for (const chunk of part.chunks) createdChunks.add(chunk.relativeFile);
        }
      };
      try {
        for (const completed of ordered) {
          const id = completed.metadata.exchangeId;
          const existing = this.catalogById.get(id);
          const entry = {
            schema: "prime-context.exchange/v2",
            id,
            relativeFile: join2("observations", `${id}.meta.json`)
          };
          let envelope;
          if (existing?.envelope) {
            envelope = structuredClone(existing.envelope);
          } else if (!existing) {
            envelope = this.newEnvelope(
              completed.metadata,
              completed.toolName,
              completed.source,
              completed.toolName === "prime_context" ? "" : completed.admittedCapsule ?? "",
              completed.isError
            );
          } else {
            continue;
          }
          const item = { completed, entry, envelope, existing, obsoleteChunks: /* @__PURE__ */ new Set() };
          if (!existing && !completed.resultChangedAfterHook) {
            for (const part of completed.parts ?? []) {
              if (completed.toolName !== "prime_context" || part.kind !== "result") {
                await appendPreparedPart(item, part);
              }
            }
          }
          envelope.toolName = completed.toolName;
          this.updateEnvelopeMetadata(envelope, completed.metadata);
          envelope.isError = completed.isError;
          if (completed.source !== void 0) envelope.source = completed.source;
          if (completed.toolName === "prime_context") {
            envelope.resultCapsule = "";
            delete envelope.fixedView;
          } else {
            if (!completed.canonicalResultChangedAfterHook && !envelope.resultCapsule && completed.admittedCapsule) {
              envelope.resultCapsule = completed.admittedCapsule;
            }
            if (!envelope.fixedView && completed.fixedView) envelope.fixedView = completed.fixedView;
          }
          if (completed.resultChangedAfterHook) {
            const keepPart = (part) => part.kind === "call" || part.kind === "call-field" || !completed.canonicalResultChangedAfterHook && part.kind === "result" && part.name === "result";
            const staleParts = envelope.parts.filter((part) => !keepPart(part));
            for (const part of staleParts) {
              for (const chunk of part.chunks) item.obsoleteChunks.add(chunk.relativeFile);
            }
            envelope.parts = envelope.parts.filter(keepPart);
            if (completed.toolName !== "prime_context") {
              for (const part of completed.parts ?? []) await appendPreparedPart(item, part, true);
            }
            if (completed.canonicalResultChangedAfterHook) {
              envelope.resultCapsule = "";
              delete envelope.fixedView;
            }
          }
          if (completed.persistedModelInput) {
            const existingPointers = new Set(
              envelope.parts.filter((part) => part.kind === "call-field").map((part) => part.pointer)
            );
            const oversizedCallParts = collectOversizedCallFields(
              completed.toolName,
              completed.persistedModelInput
            );
            const callParts = [
              ...oversizedCallParts,
              ...aggregateGenericCallParts(completed.toolName, completed.persistedModelInput, void 0, oversizedCallParts)
            ];
            for (const part of callParts) {
              if (!existingPointers.has(part.pointer)) {
                await appendPreparedPart(item, part);
                existingPointers.add(part.pointer);
              }
            }
          }
          prepared.push(item);
        }
        {
          const candidates = [];
          const persistedResultTexts = /* @__PURE__ */ new Map();
          let immutableBytes = 0;
          for (const item of prepared) {
            const { completed, envelope } = item;
            const rawResultContent = completed.persistedRawResult?.content;
            const hasPageableText = Array.isArray(rawResultContent) && rawResultContent.some(
              (block) => block !== null && typeof block === "object" && block.type === "text" && !hasOpaqueReplayMetadata(block)
            );
            const resultReplayProtected = hasOpaqueResultContent(rawResultContent) && !hasPageableText;
            const persistedResultText = completed.largeResult && !resultReplayProtected ? completed.resultText : rawResultText(completed.persistedRawResult) ?? completed.resultText;
            if (completed.toolName === "prime_context" || persistedResultText === void 0 || !completed.persistedModelInput) continue;
            const hasCanonicalResult = envelope.parts.some((part) => part.name === "result" && part.kind === "result");
            if (completed.largeResult && !resultReplayProtected && !hasCanonicalResult) continue;
            const resultText = persistedResultText;
            if (!completed.largeResult || resultReplayProtected) {
              persistedResultTexts.set(envelope.id, persistedResultText);
            }
            if (resultReplayProtected) delete envelope.fixedView;
            let fields = envelope.parts.flatMap(
              (part) => part.kind === "call-field" && part.pointer !== void 0 && (part.textBytes ?? 0) > 0 ? [{ pointer: part.pointer, textBytes: part.textBytes, lineCount: part.lineCount ?? 0 }] : []
            );
            const rawCall = completed.persistedRawCall ?? {
              type: "toolCall",
              id: envelope.toolCallId,
              name: completed.toolName,
              arguments: completed.persistedModelInput
            };
            const replayProtected = completed.replayProtected || hasOpaqueReplayMetadata(rawCall);
            const diffRef = envelope.parts.some((part) => part.kind === "diff") ? `${envelope.id}:diff` : void 0;
            const identityMaxBytes = envelope.fixedView ? 512 : this.broker.noteReadOnlyIntent({
              subjectKey: completed.metadata.subjectKey,
              intentKind: completed.metadata.intentKind,
              mutatesWorkspace: completed.metadata.mutatesWorkspace,
              requirementsRevision: completed.metadata.requirementsRevision ?? 0,
              workspaceRevision: completed.metadata.workspaceRevisionAtResult ?? 0
            });
            const callContext = {
              intentKind: completed.metadata.intentKind,
              subjectKey: completed.metadata.subjectKey,
              normalizedExecutable: typeof completed.metadata.facts?.normalizedExecutable === "string" ? completed.metadata.facts.normalizedExecutable : void 0,
              effectiveCwd: completed.metadata.effectiveCwd,
              resources: completed.metadata.resources,
              suite: completed.metadata.suite,
              diffRef,
              identityMaxBytes
            };
            let compact = compactArchivedCallArguments(
              envelope.id,
              completed.toolName,
              completed.persistedModelInput,
              fields,
              callContext
            );
            if (compact && utf8Bytes(JSON.stringify(compact)) > 8192 && !fields.some((field) => field.pointer === "")) {
              const rootPart = aggregateGenericCallParts(completed.toolName, completed.persistedModelInput, 1)[0];
              if (rootPart?.pointer === "") {
                await appendPreparedPart(item, rootPart);
                const root = envelope.parts.find((part) => part.kind === "call-field" && part.pointer === "");
                if (root?.textBytes) fields = [{ pointer: "", textBytes: root.textBytes, lineCount: root.lineCount ?? 0 }];
                compact = compactArchivedCallArguments(
                  envelope.id,
                  completed.toolName,
                  completed.persistedModelInput,
                  fields,
                  callContext
                );
              }
            }
            const renderedToolCall = compact === void 0 ? rawCall : { ...rawCall, arguments: compact };
            if (envelope.fixedView) {
              const images = imageRefsForEnvelope(envelope);
              const { images: _previousImages, ...baseView } = envelope.fixedView;
              envelope.fixedView = images.length === 0 ? baseView : { ...baseView, images };
              const fixedToolCall = replayProtected || envelope.fixedView.callArguments === void 0 ? rawCall : { ...rawCall, arguments: envelope.fixedView.callArguments };
              const fixedResult = envelope.fixedView.result.kind === "capsule" ? envelope.fixedView.result.text : resultText;
              const calculatedBytes = utf8Bytes(JSON.stringify(fixedToolCall)) + utf8Bytes(fixedResult);
              if (replayProtected) envelope.fixedView = { ...envelope.fixedView, visibleBytes: calculatedBytes };
              immutableBytes += replayProtected || !Number.isSafeInteger(envelope.fixedView.visibleBytes) ? calculatedBytes : envelope.fixedView.visibleBytes;
              continue;
            }
            const outcome = completed.metadata.outcome;
            const hasUniqueDiagnostic = outcome.commandFailures.length > 0 || outcome.exceptions.length > 0 || outcome.failingTests.length > 0 || outcome.sourceLocations.length > 0;
            const capsuleSourceText = !resultReplayProtected && envelope.resultCapsule && completed.resultText !== void 0 ? completed.resultText : resultText;
            candidates.push({
              exchangeId: envelope.id,
              toolCallId: envelope.toolCallId,
              sourceOrder: completed.sourceOrder ?? candidates.length,
              toolName: completed.toolName,
              // Same-origin replay-protected calls remain byte-for-byte raw in
              // the provider view, so budget them at that actual raw size.
              renderedToolCall: replayProtected ? rawCall : renderedToolCall,
              ...compact === void 0 ? {} : { compactCallArguments: compact },
              resultText,
              ...!resultReplayProtected && envelope.resultCapsule ? { fixedCapsule: envelope.resultCapsule } : {},
              requiresCapsule: !resultReplayProtected && Boolean(completed.canonicalResultChangedAfterHook),
              forceLiteral: resultReplayProtected,
              isError: completed.isError || outcome.status === "failure",
              hasUniqueDiagnostic,
              changesWorkspace: completed.metadata.mutatesWorkspace,
              ...replayProtected && completed.replayOriginKey ? { replayOriginKey: completed.replayOriginKey } : {},
              capsule: (maxBytes) => completed.largeResult && completed.resultSummary?.sourceRecords ? renderBoundedCapsule(completed.resultSummary.sourceRecords, {
                outcomeText: completed.resultSummary.outcomeText ?? capsuleSourceText,
                traceLineCount: completed.resultSummary.traceLineCount ?? 0,
                nonEmptyLineCount: completed.resultSummary.nonEmptyLineCount ?? completed.resultSummary.lineCount ?? 0,
                summaryLines: completed.resultSummary.summaryLines
              }, {
                id: `${envelope.id}:result`,
                toolName: completed.toolName,
                textBytes: completed.resultSummary.textBytes ?? utf8Bytes(capsuleSourceText),
                lineCount: completed.resultSummary.lineCount ?? splitVisibleLines(capsuleSourceText).length,
                source: completed.source ?? envelope.source ?? "visible-tool-result"
              }, maxBytes) : renderCapsule(capsuleSourceText, {
                id: `${envelope.id}:result`,
                toolName: completed.toolName,
                textBytes: utf8Bytes(capsuleSourceText),
                lineCount: splitVisibleLines(capsuleSourceText).length,
                source: completed.source ?? envelope.source ?? "visible-tool-result"
              }, maxBytes)
            });
          }
          const selections = selectFixedExchangeViews(
            candidates,
            Math.max(0, viewOptions.budgetBytes - immutableBytes),
            viewOptions.capsuleMaxBytes
          );
          const selectedById = new Map(selections.map((selection) => [selection.view.exchangeId, selection]));
          for (const item of prepared) {
            const { completed, envelope } = item;
            const selection = selectedById.get(envelope.id);
            if (!selection) {
              if (envelope.fixedView) completed.fixedView = envelope.fixedView;
              continue;
            }
            const persistedResultText = persistedResultTexts.get(envelope.id);
            if (selection.foldedResult && persistedResultText !== void 0) {
              const hasCanonicalResult = envelope.parts.some(
                (part) => part.name === "result" && part.kind === "result"
              );
              if (!hasCanonicalResult) {
                await appendPreparedPart(item, {
                  name: "result",
                  kind: "result",
                  mediaType: "text/plain; charset=utf-8",
                  text: persistedResultText
                }, item.obsoleteChunks.size > 0);
              }
            }
            if (selection.capsule !== void 0) envelope.resultCapsule = selection.capsule;
            const images = imageRefsForEnvelope(envelope);
            const view = images.length === 0 ? selection.view : { ...selection.view, images };
            const rawArguments = completed.persistedModelInput ?? {};
            const fixedArguments = view.callArguments ?? rawArguments;
            const rawText = rawResultText(completed.persistedRawResult) ?? completed.resultText ?? "";
            const fixedText = view.result.kind === "capsule" ? view.result.text : rawText;
            this.broker.recordProjection({
              callArgumentBytesProjectedOut: Math.max(
                0,
                utf8Bytes(JSON.stringify(rawArguments)) - utf8Bytes(JSON.stringify(fixedArguments))
              ),
              resultBytesProjectedOut: Math.max(0, utf8Bytes(rawText) - utf8Bytes(fixedText))
            });
            envelope.fixedView = view;
            completed.fixedView = view;
          }
        }
        const newRecords = prepared.filter((item) => !item.existing);
        let newlyArchivedBytes = 0;
        for (const item of prepared) {
          signal?.throwIfAborted();
          await this.writeEnvelope(item.entry.relativeFile, item.envelope, signal);
          committed.push(item);
          const previousParts = new Map((item.existing?.envelope?.parts ?? []).map((part) => [
            `${part.kind}:${part.name}:${part.pointer ?? ""}`,
            part.textBytes ?? part.binaryBytes ?? 0
          ]));
          for (const part of item.envelope.parts) {
            const key = `${part.kind}:${part.name}:${part.pointer ?? ""}`;
            const bytes = part.textBytes ?? part.binaryBytes ?? 0;
            if (previousParts.get(key) !== bytes) newlyArchivedBytes += bytes;
          }
        }
        this.broker.recordArchivedBytes(newlyArchivedBytes);
        let nextSequence = this.sessionMetadata?.nextSequence ?? 1;
        for (const item of newRecords) {
          const match = /^o(\d+)$/.exec(item.envelope.id);
          if (match) nextSequence = Math.max(nextSequence, Number(match[1]) + 1);
        }
        const metadata = this.metadataWithBrokerState({
          schema: "prime-context.archive-session/v1",
          nextSequence,
          observationCount: records.length + newRecords.length
        });
        await this.writeSessionMetadata(metadata, signal);
        for (const item of prepared) {
          const record4 = this.envelopeRecord(item.entry, item.envelope);
          if (item.existing) this.replaceCatalogRecord(record4);
          else {
            records.push(record4);
            this.catalogById.set(record4.id, record4);
          }
        }
        this.sessionMetadata = metadata;
        await Promise.all(prepared.flatMap((item) => [...item.obsoleteChunks]).map(
          (relativeFile) => rm2(join2(this.sessionPath, relativeFile), { force: true }).catch(() => void 0)
        ));
        return prepared.length;
      } catch (error) {
        this.broker.restorePersistentState(brokerStateBefore);
        for (const item of [...committed].reverse()) {
          if (item.existing?.envelope) {
            await this.writeEnvelope(item.entry.relativeFile, item.existing.envelope).catch(() => void 0);
          } else {
            await rm2(join2(this.sessionPath, item.entry.relativeFile), { force: true }).catch(() => void 0);
          }
        }
        await Promise.all([...createdChunks].map(
          (relativeFile) => rm2(join2(this.sessionPath, relativeFile), { force: true }).catch(() => void 0)
        ));
        throw error;
      }
    });
  }
  async updateExchangeRevisions(revisions, signal) {
    if (revisions.length === 0) return 0;
    const byToolCall = new Map(revisions.map((revision) => [revision.toolCallId, revision]));
    return this.withIndexLock(async () => {
      const records = await this.readCatalog(signal);
      let updated = 0;
      let legacyUpdated = false;
      for (const record4 of records) {
        if (record4.envelope) {
          const revision2 = byToolCall.get(record4.envelope.toolCallId);
          if (!revision2) continue;
          record4.envelope.workspaceRevisionAtStart = revision2.workspaceRevisionAtStart;
          record4.envelope.workspaceRevisionAtResult = revision2.workspaceRevisionAtResult;
          await this.writeEnvelope(record4.relativeFile, record4.envelope, signal);
          this.replaceCatalogRecord(this.envelopeRecord({
            schema: "prime-context.exchange/v2",
            id: record4.id,
            relativeFile: record4.relativeFile
          }, record4.envelope));
          updated += 1;
          continue;
        }
        const exchange = record4.exchange;
        if (!exchange) continue;
        const revision = byToolCall.get(exchange.toolCallId);
        if (!revision) continue;
        exchange.workspaceRevisionAtStart = revision.workspaceRevisionAtStart;
        exchange.workspaceRevisionAtResult = revision.workspaceRevisionAtResult;
        updated += 1;
        legacyUpdated = true;
      }
      if (legacyUpdated) await this.writeIndex({
        schema: "prime-context.observation-index/v1",
        observations: records.filter((record4) => !record4.envelope)
      }, signal);
      return updated;
    });
  }
  async maxExchangeSequence(observationIds, signal) {
    const requested = observationIds ? new Set(observationIds.map(normalizeObservationRef)) : void 0;
    const records = await this.readCatalog(signal);
    if (!requested && this.sessionMetadata) return Math.max(0, this.sessionMetadata.nextSequence - 1);
    let maximum = 0;
    for (const observation of records) {
      if (requested && !requested.has(observation.id)) continue;
      const exchangeId = observation.envelope?.id ?? observation.exchange?.exchangeId ?? "";
      const match = /^o(\d+)$/.exec(exchangeId);
      if (match) maximum = Math.max(maximum, Number(match[1]));
    }
    return maximum;
  }
  async list(limit = 20, signal) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("limit must be an integer from 1 to 100.");
    }
    const records = [...await this.readCatalog(signal)];
    const exchangeSequence = (record4) => {
      const id = record4.envelope?.id ?? record4.exchange?.exchangeId;
      const match = id ? /^o(\d+)$/.exec(id) : void 0;
      return match ? Number(match[1]) : void 0;
    };
    const orderedExchanges = records.filter((record4) => exchangeSequence(record4) !== void 0).sort((left, right) => exchangeSequence(left) - exchangeSequence(right));
    let exchangeIndex = 0;
    const ordered = records.map(
      (record4) => exchangeSequence(record4) === void 0 ? record4 : orderedExchanges[exchangeIndex++]
    );
    return ordered.filter((observation) => this.isInActiveScope(observation)).slice(-limit).reverse();
  }
  async clear(signal) {
    return this.withIndexLock(async () => {
      const count = (await this.readCatalog(signal)).length;
      signal?.throwIfAborted();
      await rm2(this.observationsPath, { recursive: true, force: true });
      await rm2(this.indexPath, { force: true });
      await rm2(this.sessionMetadataPath, { force: true });
      signal?.throwIfAborted();
      this.broker.reset();
      const metadata = this.metadataWithBrokerState({
        schema: "prime-context.archive-session/v1",
        nextSequence: 1,
        observationCount: 0
      });
      await this.writeSessionMetadata(metadata, signal);
      this.catalog = [];
      this.catalogById.clear();
      this.catalogPromise = Promise.resolve(this.catalog);
      this.sessionMetadata = metadata;
      this.mediumResultCounts.clear();
      this.lastMediumResults.clear();
      this.recentLargeParts = [];
      return count;
    });
  }
  async count(signal) {
    return (await this.readCatalog(signal)).filter((record4) => this.isInActiveScope(record4)).length;
  }
  async checkIndex(signal) {
    try {
      await this.readCatalog(signal);
      return true;
    } catch {
      return false;
    }
  }
};

// src/commands.ts
import { readFileSync as readFileSync2 } from "fs";
import { dirname, join as join3 } from "path";
import { createRequire } from "module";

// src/tool.ts
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
var MODEL_RECOVERY_MAX_BYTES = 12 * 1024;
var MODEL_READ_DEFAULT_LINES = 80;
var MODEL_SEARCH_DEFAULT_MATCHES = 10;
var MODEL_LIST_MAX_OBSERVATIONS = 20;
function textResult(text) {
  return { content: [{ type: "text", text }], details: {} };
}
function recoveryContentBytes(content) {
  return content.reduce((total, block) => total + (block.type === "text" ? Buffer.byteLength(block.text, "utf8") : Buffer.byteLength(block.data, "base64")), 0);
}
function transientDirectRecoveryBytes(content) {
  return recoveryContentBytes(content);
}
function transientDirectTextBytes(text) {
  return Buffer.byteLength(text, "utf8");
}
function recordRecoveryCandidate(actions, _archive, toolCallId, evidence, subjectKeys, exposedBytes, inspectRecallHit = false) {
  if (evidence) {
    actions.registerRecoveryUtility(toolCallId, subjectKeys, exposedBytes, inspectRecallHit);
  }
}
function recoverySubjectKeys(details) {
  if (!details || typeof details !== "object") return [];
  const object = details;
  const direct = typeof object.subjectKey === "string" ? [object.subjectKey] : [];
  const matches = Array.isArray(object.matches) ? object.matches.flatMap(
    (match) => match && typeof match === "object" && typeof match.subjectKey === "string" ? [match.subjectKey] : []
  ) : [];
  return [.../* @__PURE__ */ new Set([...direct, ...matches])];
}
async function formatStatus(actions, signal) {
  const archive = actions.getArchive();
  if (!archive) return "Prime Context session is not ready.";
  const snapshot = actions.getSnapshot();
  const archiveCount = await archive.count(signal);
  const broker = archive.brokerStatistics();
  const runtime = actions.getTaskRuntime();
  const readiness = actions.getReadiness();
  const latestValidation = runtime?.validations[0];
  const metrics = broker.metrics;
  const lines = [
    `Mode: ${actions.getMode()}`,
    `Focus: ${snapshot.focus ?? "(none)"}`,
    "Open items:",
    ...snapshot.openItems.length === 0 ? ["- (none)"] : snapshot.openItems.map((item) => `- [${item.id}] ${item.text}`),
    "Pinned observations:",
    ...snapshot.pinnedObservationIds.length === 0 ? ["- (none)"] : snapshot.pinnedObservationIds.map((id) => `- ${id}`),
    `Archive count: ${archiveCount}`,
    `Task: ${runtime?.taskKey ?? "(none)"}`,
    `Workflow: revision ${runtime?.requirementsRevision ?? 0} | locked ${runtime?.requirementsLocked ? "yes" : "no"} | workspace revision ${runtime?.workspaceRevision ?? 0} | readiness ${readiness}`,
    `Latest validation: ${latestValidation?.summary ?? "(none)"}`,
    `Validation gates: ${runtime?.validationGates.map((gate) => gate.key).join(", ") || "(none)"}`,
    `Active diagnostics: ${runtime?.activeDiagnostics.length ?? 0}`,
    `Broker decisions: ${broker.passedThrough} pass-through | ${broker.structuredCapsules} structured | ${broker.deltaCapsules} delta`,
    `Utility buckets: ${broker.utilityBucketCount}`,
    `Source bytes archived: ${metrics.sourceBytesArchived}`,
    `Call-argument bytes projected out: ${metrics.callArgumentBytesProjectedOut}`,
    `Result bytes projected out: ${metrics.resultBytesProjectedOut}`,
    `Typed/media bytes projected out: ${metrics.typedMediaBytesProjectedOut}`,
    `Recovery bytes exposed: ${metrics.recoveryBytesExposed}`,
    `Current projected model-view bytes: ${metrics.currentProjectedModelViewBytes}`,
    `Streaming bytes processed: ${metrics.streamingBytesProcessed}`,
    `Inspect/recall hits: ${metrics.inspectRecallHits}`,
    `Fold generations: ${metrics.foldGenerationCount}`,
    `Branch runtime reloads: ${metrics.branchRuntimeReloadCount}`,
    `Usage tokens: uncached input ${metrics.uncachedInputTokens} | cache read ${metrics.cacheReadTokens} | cache write ${metrics.cacheWriteTokens}`,
    `Stable projection extension turns: ${metrics.stableProjectionExtensionTurns}`,
    `Storage path: ${archive.sessionPath}`
  ];
  return lines.join("\n");
}
async function formatObservationList(actions, limit = 20, signal) {
  const archive = actions.getArchive();
  if (!archive) return "Prime Context session is not ready.";
  const observations = await archive.list(limit, signal);
  if (observations.length === 0) return "No archived observations in this session.";
  return [
    `Recent archived observations (${observations.length}):`,
    ...observations.map(
      (observation) => `- ${observation.id} | ${observation.toolName} | ${observation.textBytes} bytes | ${observation.lineCount} lines | ${observation.source ?? "visible-tool-result"} | ${observation.isError ? "error | " : ""}${observation.createdAt}`
    )
  ].join("\n");
}
function formatSnapshotUpdate(result) {
  if (!result.ok) return `Prime Context update error: ${result.error}`;
  if (!result.changed) return "No task snapshot changes.";
  return [
    "Task snapshot updated.",
    `Focus: ${result.snapshot.focus ?? "(none)"}`,
    `Open items: ${result.snapshot.openItems.length}`,
    `Pinned observations: ${result.snapshot.pinnedObservationIds.length}`
  ].join("\n");
}
function recoveryReturnedEvidence(text) {
  return !/^(?:Prime Context error:|Unknown observation ID:|No matches (?:found|for)|No archived observations)/i.test(text.trim());
}
function recoveryReceipt(details) {
  const ref = details.sessionId ? `${details.sessionId}:${details.ref}` : details.ref;
  if (details.partKind === "image" || details.mediaType?.toLowerCase().startsWith("image/") === true) {
    return `Recovered image ${ref} for the preceding model turn. Reinspect the same ref to view it again.`;
  }
  if (details.startByte !== void 0) {
    const end = details.endByte ?? details.startByte;
    const total = details.totalBytes ?? end;
    const next = details.hasMore ? ` Continue with startByte=${end}.` : "";
    return `Recovered ${ref} bytes [${details.startByte},${end}) of ${total} for the preceding model turn.${next}`;
  }
  const range = details.startLine === void 0 ? "" : ` lines ${details.startLine}-${details.endLine ?? details.startLine}`;
  return `Recovered ${ref}${range} for the preceding model turn. Reinspect the same ref for exact text.`;
}
function currentRevisions(runtime) {
  return runtime ? {
    taskKey: runtime.taskKey,
    workspaceRevision: runtime.workspaceRevision,
    requirementsRevision: runtime.requirementsRevision,
    activeDiagnosticExchangeIds: (runtime.activeDiagnostics ?? []).flatMap(
      (diagnostic) => diagnostic.exchangeId ? [diagnostic.exchangeId] : []
    ),
    activeDiagnosticSignals: (runtime.activeDiagnostics ?? []).flatMap((diagnostic) => [
      diagnostic.id,
      diagnostic.summary,
      diagnostic.subjectKey,
      diagnostic.suiteFamily,
      ...diagnostic.resources
    ].filter((value) => typeof value === "string"))
  } : void 0;
}
async function resolveDirectRecoveryTarget(currentArchive, actions, scope, rawRef, signal) {
  if (scope === "task" || scope === "session") {
    const prefix = `${currentArchive.sessionId}:`;
    return {
      archive: currentArchive,
      ref: scope === "session" && rawRef.startsWith(prefix) ? rawRef.slice(prefix.length) : rawRef,
      scope,
      ...scope === "session" ? { sessionId: currentArchive.sessionId } : {},
      includeOutsideTask: scope === "session"
    };
  }
  const sources = await actions.resolveRecallSources(scope, signal);
  const qualified = [...sources].sort((left, right) => right.sessionId.length - left.sessionId.length).find((source2) => rawRef.startsWith(`${source2.sessionId}:`));
  const source = qualified ?? (sources.length === 1 ? sources[0] : void 0);
  if (!source) {
    throw new Error(
      sources.length === 0 ? `No ${scope} recall source is available.` : `${scope} inspect/read/search requires a session-qualified ref from recall.`
    );
  }
  return {
    archive: source.archive,
    ref: qualified ? rawRef.slice(source.sessionId.length + 1) : rawRef,
    scope,
    sessionId: source.sessionId,
    sessionDate: source.sessionDate,
    includeOutsideTask: true
  };
}
function directRecoveryDetails(details, target, recordDate) {
  return {
    ...details,
    scope: target.scope,
    ...target.scope === "task" ? {} : {
      sessionId: target.sessionId ?? target.archive.sessionId,
      sessionDate: target.sessionDate ?? recordDate
    }
  };
}
function directRecoveryResult(actions, toolCallId, content, details, receipt) {
  actions.registerRecoveryLease(toolCallId, [
    ...content,
    { type: "text", text: receipt }
  ]);
  return { content: [{ type: "text", text: receipt }], details };
}
function registerPrimeContextTool(pi, actions) {
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
      "Update only durable focus, open items, or pins; never store secrets, instructions, reasoning, or raw logs."
    ],
    parameters: Type.Object({
      action: StringEnum(["read", "search", "inspect", "recall", "list", "status", "update"]),
      id: Type.Optional(Type.String()),
      ref: Type.Optional(Type.String()),
      query: Type.Optional(Type.String()),
      path: Type.Optional(Type.String()),
      kind: Type.Optional(StringEnum(["call", "result", "diff", "diagnostic", "image"])),
      tool: Type.Optional(Type.String()),
      status: Type.Optional(StringEnum(["success", "failure", "error"])),
      scope: Type.Optional(StringEnum(["task", "session", "parent", "project"])),
      startLine: Type.Optional(Type.Integer({ minimum: 1 })),
      endLine: Type.Optional(Type.Integer({ minimum: 1 })),
      startByte: Type.Optional(Type.Integer({ minimum: 0 })),
      endByte: Type.Optional(Type.Integer({ minimum: 1 })),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: MODEL_LIST_MAX_OBSERVATIONS })),
      contextLines: Type.Optional(Type.Integer({ minimum: 0, maximum: 20 })),
      matchOffset: Type.Optional(Type.Integer({ minimum: 0, maximum: 1e4 })),
      maxMatches: Type.Optional(Type.Integer({ minimum: 1, maximum: MODEL_SEARCH_DEFAULT_MATCHES })),
      focus: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      addItems: Type.Optional(Type.Array(Type.String())),
      completeItemIds: Type.Optional(Type.Array(Type.String())),
      pinObservationIds: Type.Optional(Type.Array(Type.String())),
      unpinObservationIds: Type.Optional(Type.Array(Type.String()))
    }),
    async execute(toolCallId, rawParams, signal) {
      const params = rawParams;
      const archive = actions.getArchive();
      if (!archive) return textResult("Prime Context session is not ready.");
      const recoveryMaxBytes = Math.min(actions.getReadMaxBytes(), MODEL_RECOVERY_MAX_BYTES);
      const maxMatches = Math.min(params.maxMatches ?? MODEL_SEARCH_DEFAULT_MATCHES, MODEL_SEARCH_DEFAULT_MATCHES);
      try {
        switch (params.action) {
          case "read": {
            if (!params.id) return textResult("prime_context read requires an observation id.");
            const scope = params.scope ?? "task";
            const target = await resolveDirectRecoveryTarget(archive, actions, scope, params.id, signal);
            const startLine = params.startLine ?? 1;
            const requestedEndLine = params.endLine ?? startLine + MODEL_READ_DEFAULT_LINES - 1;
            const endLine = Math.min(requestedEndLine, startLine + MODEL_READ_DEFAULT_LINES - 1);
            const record4 = await target.archive.findObservation(
              normalizeObservationRef(target.ref),
              signal,
              target.includeOutsideTask
            );
            if (record4.envelope) {
              const inspected = await target.archive.inspect(`${record4.id}:result`, {
                startLine,
                endLine,
                maxBytes: recoveryMaxBytes,
                current: currentRevisions(actions.getTaskRuntime())
              }, signal, target.includeOutsideTask);
              const details2 = directRecoveryDetails(inspected.details, target, record4.createdAt);
              const result2 = inspected.content[0].text;
              const evidence2 = recoveryReturnedEvidence(result2);
              recordRecoveryCandidate(
                actions,
                archive,
                toolCallId,
                evidence2,
                recoverySubjectKeys(details2),
                evidence2 ? transientDirectRecoveryBytes(inspected.content) : 0
              );
              if (!evidence2) return { content: inspected.content, details: details2 };
              return directRecoveryResult(
                actions,
                toolCallId,
                inspected.content,
                details2,
                recoveryReceipt(details2)
              );
            }
            const result = await target.archive.readPartLines(
              `${record4.id}:result`,
              startLine,
              endLine,
              recoveryMaxBytes,
              signal,
              target.includeOutsideTask
            );
            const evidence = recoveryReturnedEvidence(result);
            recordRecoveryCandidate(
              actions,
              archive,
              toolCallId,
              evidence,
              record4.exchange?.subjectKey ? [record4.exchange.subjectKey] : [],
              evidence ? transientDirectTextBytes(result) : 0
            );
            const returnedLines = [...result.matchAll(/^(\d+):/gm)].map((match) => Number(match[1]));
            const actualStartLine = returnedLines[0] ?? startLine;
            const actualEndLine = returnedLines.at(-1) ?? actualStartLine;
            const details = {
              observationId: record4.id,
              ref: record4.id,
              partKind: "result",
              startLine: actualStartLine,
              endLine: actualEndLine,
              totalLines: record4.lineCount,
              hasMore: actualEndLine < record4.lineCount,
              scope: target.scope,
              ...target.scope === "task" ? {} : {
                sessionId: target.sessionId ?? target.archive.sessionId,
                sessionDate: target.sessionDate ?? record4.createdAt
              },
              currentWorkspace: false,
              currentRequirements: false
            };
            return evidence ? directRecoveryResult(
              actions,
              toolCallId,
              [{ type: "text", text: result }],
              details,
              recoveryReceipt(details)
            ) : { content: [{ type: "text", text: result }], details };
          }
          case "search": {
            if (!params.query) return textResult("prime_context search requires a non-empty fixed string query.");
            const scope = params.scope ?? "task";
            if (!params.id && scope !== "task") {
              return textResult(`prime_context search without id supports task scope; use recall scope=${scope}.`);
            }
            if (params.id) {
              const target = await resolveDirectRecoveryTarget(archive, actions, scope, params.id, signal);
              const record4 = await target.archive.findObservation(
                normalizeObservationRef(target.ref),
                signal,
                target.includeOutsideTask
              );
              if (record4.envelope) {
                const inspected = await target.archive.inspect(`${record4.id}:result`, {
                  query: params.query,
                  contextLines: params.contextLines ?? 1,
                  matchOffset: params.matchOffset ?? 0,
                  maxMatches,
                  maxBytes: recoveryMaxBytes,
                  current: currentRevisions(actions.getTaskRuntime())
                }, signal, target.includeOutsideTask);
                const details3 = directRecoveryDetails(inspected.details, target, record4.createdAt);
                const result3 = inspected.content[0].text;
                const evidence3 = recoveryReturnedEvidence(result3);
                recordRecoveryCandidate(
                  actions,
                  archive,
                  toolCallId,
                  evidence3,
                  recoverySubjectKeys(details3),
                  evidence3 ? transientDirectRecoveryBytes(inspected.content) : 0
                );
                if (!evidence3) return { content: inspected.content, details: details3 };
                return directRecoveryResult(
                  actions,
                  toolCallId,
                  inspected.content,
                  details3,
                  recoveryReceipt(details3)
                );
              }
              const result2 = await target.archive.searchPart(
                `${record4.id}:result`,
                params.query,
                params.contextLines ?? 1,
                params.matchOffset ?? 0,
                maxMatches,
                recoveryMaxBytes,
                signal,
                target.includeOutsideTask
              );
              const evidence2 = recoveryReturnedEvidence(result2);
              recordRecoveryCandidate(
                actions,
                archive,
                toolCallId,
                evidence2,
                record4.exchange?.subjectKey ? [record4.exchange.subjectKey] : [],
                evidence2 ? transientDirectTextBytes(result2) : 0
              );
              const details2 = {
                observationId: record4.id,
                ref: `${record4.id}:result`,
                partKind: "result",
                query: params.query,
                matchOffset: params.matchOffset ?? 0,
                scope: target.scope,
                ...target.scope === "task" ? {} : {
                  sessionId: target.sessionId ?? target.archive.sessionId,
                  sessionDate: target.sessionDate ?? record4.createdAt
                },
                currentWorkspace: false,
                currentRequirements: false
              };
              return evidence2 ? directRecoveryResult(
                actions,
                toolCallId,
                [{ type: "text", text: result2 }],
                details2,
                recoveryReceipt(details2)
              ) : { content: [{ type: "text", text: result2 }], details: details2 };
            }
            const result = await archive.searchRecent(
              params.query,
              params.limit ?? 20,
              params.contextLines ?? 1,
              params.matchOffset ?? 0,
              maxMatches,
              recoveryMaxBytes,
              signal
            );
            const evidence = recoveryReturnedEvidence(result);
            recordRecoveryCandidate(
              actions,
              archive,
              toolCallId,
              evidence,
              [],
              evidence ? transientDirectTextBytes(result) : 0
            );
            const details = {
              query: params.query,
              matchOffset: params.matchOffset ?? 0,
              scope: "task"
            };
            return evidence ? directRecoveryResult(
              actions,
              toolCallId,
              [{ type: "text", text: result }],
              details,
              `Recovered search results for "${params.query}" for the preceding model turn. Search again for exact text.`
            ) : { content: [{ type: "text", text: result }], details };
          }
          case "inspect": {
            const ref = params.ref ?? params.id;
            if (!ref) return textResult("prime_context inspect requires an exact observation part ref.");
            const scope = params.scope ?? "task";
            const target = await resolveDirectRecoveryTarget(archive, actions, scope, ref, signal);
            const record4 = await target.archive.findObservation(
              normalizeObservationRef(target.ref),
              signal,
              target.includeOutsideTask
            );
            const inspected = await target.archive.inspect(target.ref, {
              ...params.startLine === void 0 ? {} : { startLine: params.startLine },
              ...params.endLine === void 0 ? {} : { endLine: params.endLine },
              ...params.startByte === void 0 ? {} : { startByte: params.startByte },
              ...params.endByte === void 0 ? {} : { endByte: params.endByte },
              ...params.query === void 0 ? {} : { query: params.query },
              contextLines: params.contextLines ?? 1,
              maxBytes: recoveryMaxBytes,
              current: currentRevisions(actions.getTaskRuntime())
            }, signal, target.includeOutsideTask);
            const details = directRecoveryDetails(inspected.details, target, record4.createdAt);
            const evidence = inspected.content.some(
              (block) => block.type === "image" || recoveryReturnedEvidence(block.text)
            );
            recordRecoveryCandidate(
              actions,
              archive,
              toolCallId,
              evidence,
              recoverySubjectKeys(details),
              evidence ? recoveryContentBytes(inspected.content) : 0,
              true
            );
            if (!evidence) {
              return { content: inspected.content, details };
            }
            const receipt = recoveryReceipt(details);
            actions.registerRecoveryLease(toolCallId, [
              ...inspected.content,
              { type: "text", text: receipt }
            ]);
            return {
              content: [{ type: "text", text: receipt }],
              details
            };
          }
          case "recall": {
            const scope = params.scope ?? "task";
            const externalSources = scope === "parent" || scope === "project" ? await actions.resolveRecallSources(scope, signal) : [];
            const recalled = await archive.recall({
              ...params.query === void 0 ? {} : { query: params.query },
              ...params.id === void 0 ? {} : { id: params.id },
              ...params.path === void 0 ? {} : { path: params.path },
              ...params.kind === void 0 ? {} : { kind: params.kind },
              ...params.tool === void 0 ? {} : { tool: params.tool },
              ...params.status === void 0 ? {} : { status: params.status },
              scope,
              contextLines: params.contextLines ?? 1
            }, recoveryMaxBytes, currentRevisions(actions.getTaskRuntime()), signal, externalSources);
            const evidence = recalled.matches.length > 0;
            recordRecoveryCandidate(
              actions,
              archive,
              toolCallId,
              evidence,
              recalled.matches.flatMap((match) => match.subjectKey ? [match.subjectKey] : []),
              evidence ? recoveryContentBytes(recalled.content) : 0,
              true
            );
            if (!evidence) return { content: recalled.content, details: { matches: [] } };
            const refs = recalled.matches.map(
              (match) => match.sessionId ? `${match.sessionId}:${match.ref}` : match.ref
            ).join(", ");
            const receipt = `Recovered ${refs} for the preceding model turn. Recall the same evidence again for exact text.`;
            actions.registerRecoveryLease(toolCallId, [
              ...recalled.content,
              { type: "text", text: receipt }
            ]);
            return {
              content: [{
                type: "text",
                text: receipt
              }],
              details: { matches: recalled.matches }
            };
          }
          case "list":
            return textResult(
              await formatObservationList(
                actions,
                Math.min(params.limit ?? MODEL_LIST_MAX_OBSERVATIONS, MODEL_LIST_MAX_OBSERVATIONS),
                signal
              )
            );
          case "status":
            return textResult(await formatStatus(actions, signal));
          case "update":
            return textResult(formatSnapshotUpdate(actions.updateSnapshot(params)));
        }
      } catch (error) {
        return textResult(`Prime Context error: ${error.message}`);
      }
    }
  });
}

// src/commands.ts
var USAGE = [
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
  "/pc doctor"
].join("\n");
function versionFromPath(start) {
  let current = start;
  for (let depth = 0; depth < 8; depth += 1) {
    try {
      const pkg = JSON.parse(readFileSync2(join3(current, "package.json"), "utf8"));
      if ((pkg.name === "prime-agent" || pkg.name === "@earendil-works/pi-coding-agent") && pkg.version) {
        return pkg.version;
      }
    } catch {
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return void 0;
}
function detectPrimeAgentVersion() {
  try {
    const require2 = createRequire(import.meta.url);
    const resolved = versionFromPath(dirname(require2.resolve("@earendil-works/pi-coding-agent")));
    if (resolved) return resolved;
  } catch {
  }
  return process.argv[1] ? versionFromPath(dirname(process.argv[1])) ?? "unknown" : "unknown";
}
function parseRange(value) {
  if (!value) return void 0;
  const match = /^(\d+):(\d+)$/.exec(value);
  if (!match) throw new Error("Line range must use start:end with positive integers.");
  const startLine = Number(match[1]);
  const endLine = Number(match[2]);
  if (!Number.isSafeInteger(startLine) || startLine < 1 || !Number.isSafeInteger(endLine) || endLine < startLine) {
    throw new Error("Line range must use start:end with positive, ascending integers.");
  }
  return { startLine, endLine };
}
function registerPrimeContextCommands(pi, actions) {
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
              ctx.signal
            );
            archive.recordRecovery(!/^(?:Unknown observation ID:|Prime Context error:)/i.test(result.trim()));
            ctx.ui.notify(result, "info");
            return;
          }
          case "search": {
            const target = tokens.shift();
            const query = tokens.join(" ");
            if (!target || !query) throw new Error("Usage: /pc search <observation-id|all> <fixed text>");
            const result = target === "all" ? await archive.searchRecent(query, 20, 1, 0, 50, actions.getReadMaxBytes(), ctx.signal) : await archive.search(target, query, 1, 0, 50, actions.getReadMaxBytes(), ctx.signal);
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
            if (tokens.length !== 1 || tokens[0] !== "on" && tokens[0] !== "off") {
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
              "info"
            );
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
              ...actions.consumeConfigWarnings()
            ];
            ctx.ui.notify(lines.join("\n"), writable ? "info" : "error");
            return;
          }
          default:
            ctx.ui.notify(USAGE, "info");
        }
      } catch (error) {
        ctx.ui.notify(error.message, "error");
      }
    }
  });
}

// src/policy.ts
var PRIME_CONTEXT_GLOBAL_POLICY = `## Absolute Prohibition: No Verification Theater / Proof Boilerplate

You are FORBIDDEN from inventing, adding, or expanding any of the following unless the user explicitly requests them in the current message:

- Proofs of correctness, formal verification, or "proof harnesses"
- Ledgers, audit logs, provenance tracking, or event sourcing "for safety"
- Cryptographic hashes, checksums, integrity checks, or signature schemes
- Review loops, multi-stage validation pipelines, or "ensure this works" rituals
- Extra test suites, property-based tests, or mutation testing that go beyond the minimal happy-path + one edge case
- Over-cautious guardrails, legacy-compatibility layers, or defensive code for failure modes the user did not mention

### Core Rule
**Build the actual thing first.**  
Your job is to ship working, minimal, readable code that solves the stated problem.  
Do **not** turn a simple feature request into a research project on correctness.

### Enforcement
1. If the task is a prototype, MVP, script, or simple project \u2192 write the direct implementation. Stop.
2. Only add verification mechanisms when the user says words like "prove", "formally verify", "add ledger", "hash everything", or "make it bulletproof".
3. If you feel the urge to add any of the banned items, rewrite the plan to remove them before writing any code.
4. Prefer deleting code over adding protective boilerplate.
5. When in doubt: less is more. KISS is mandatory.

Violation of this rule is considered a failure. Re-plan and ship the real feature instead.`;
function appendPrimeContextGlobalPolicy(systemPrompt) {
  if (systemPrompt.replaceAll("\r\n", "\n").includes(PRIME_CONTEXT_GLOBAL_POLICY)) return systemPrompt;
  const separator = systemPrompt.length === 0 ? "" : systemPrompt.endsWith("\n\n") ? "" : systemPrompt.endsWith("\n") ? "\n" : "\n\n";
  return `${systemPrompt}${separator}${PRIME_CONTEXT_GLOBAL_POLICY}`;
}

// src/index.ts
async function readRecallSessionHeader(path) {
  let handle;
  try {
    handle = await openFile(path, "r");
    const buffer = Buffer.alloc(64 * 1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const newline = buffer.indexOf(10, 0);
    if (bytesRead === 0 || newline < 0 || newline > bytesRead) return void 0;
    const value = JSON.parse(buffer.toString("utf8", 0, newline));
    if (value.type !== "session" || typeof value.id !== "string" || !value.id || typeof value.timestamp !== "string" || typeof value.cwd !== "string") return void 0;
    return {
      id: value.id,
      timestamp: value.timestamp,
      cwd: value.cwd,
      ...typeof value.parentSession === "string" ? { parentSession: value.parentSession } : {},
      ...typeof value.rlmDepth === "number" && Number.isInteger(value.rlmDepth) ? { rlmDepth: value.rlmDepth } : {}
    };
  } catch {
    return void 0;
  } finally {
    await handle?.close().catch(() => void 0);
  }
}
var RECOVERY_LEASE_MAX_BYTES = 12 * 1024 * 1024;
var RECOVERY_LEASE_TOTAL_BYTES = 24 * 1024 * 1024;
function recoveryLeaseBytes(content) {
  return content.reduce((total, block) => total + (block.type === "text" && typeof block.text === "string" ? Buffer.byteLength(block.text, "utf8") : block.type === "image" && typeof block.data === "string" ? Buffer.byteLength(block.data, "utf8") : 0), 0);
}
var REQUIRED_HOOKS = /* @__PURE__ */ new Set([
  "session_start",
  "session_compact",
  "session_tree",
  "before_agent_start",
  "agent_start",
  "turn_start",
  "model_select",
  "tool_execution_start",
  "tool_call",
  "tool_result",
  "turn_end",
  "model_context",
  "message_end",
  "session_before_compact",
  "session_before_tree"
]);
var PENDING_IMAGE_RESULT_MAX = 64;
var PENDING_IMAGE_PER_RESULT_MAX = 4096;
var CONSUMED_IMAGE_REF_MAX = PENDING_IMAGE_RESULT_MAX * PENDING_IMAGE_PER_RESULT_MAX;
function clearPendingImages(runtime, toolCallId) {
  const previous = runtime.pendingImages.get(toolCallId) ?? [];
  runtime.pendingImages.delete(toolCallId);
  for (const image of previous) runtime.consumedImageRefs.delete(image.ref);
}
function setPendingImages(runtime, toolCallId, images) {
  clearPendingImages(runtime, toolCallId);
  if (runtime.pendingImages.size >= PENDING_IMAGE_RESULT_MAX) return;
  const admitted = images.filter(
    (image) => PROVIDER_IMAGE_MIME_TYPES2.has(image.mimeType.toLowerCase()) && Number.isFinite(image.bytes) && image.bytes >= 0 && image.bytes <= RECOVERY_IMAGE_MAX_BYTES
  ).slice(0, PENDING_IMAGE_PER_RESULT_MAX);
  runtime.pendingImages.set(toolCallId, admitted);
}
function requiredHooksLoaded(hooks) {
  return [...REQUIRED_HOOKS].every((hook) => hooks.has(hook));
}
function shouldArchiveToolResult(toolName) {
  return toolName !== "prime_context";
}
function visibleToolResultText(content, maxBytes = Number.POSITIVE_INFINITY) {
  return boundedResultTextStats(content, maxBytes);
}
function resultFullOutputPath(details) {
  if (!details || typeof details !== "object") return void 0;
  const path = details.fullOutputPath;
  return typeof path === "string" ? path : void 0;
}
function visiblePartSource(content) {
  const texts = content.flatMap((block) => block.type === "text" && block.text.length > 0 ? [block.text] : []);
  if (texts.length <= 1) return { kind: "text", text: texts[0] ?? "" };
  return { kind: "texts", texts: () => texts.values() };
}
async function resolvedPartSource(source, signal) {
  const summary = await summarizePartSource(source, signal);
  const { source: partSource, ...values } = summary;
  return {
    ...values,
    text: summary.exactText ?? summary.capsuleText,
    source: source.kind === "path" ? "public-complete-output" : "visible-tool-result",
    partSource
  };
}
async function partSourcesEqual(left, right, signal) {
  const leftIterator = sourceBytes(left, signal)[Symbol.asyncIterator]();
  const rightIterator = sourceBytes(right, signal)[Symbol.asyncIterator]();
  let leftChunk = Buffer.alloc(0);
  let rightChunk = Buffer.alloc(0);
  let leftDone = false;
  let rightDone = false;
  for (; ; ) {
    if (leftChunk.length === 0 && !leftDone) {
      const next = await leftIterator.next();
      leftDone = Boolean(next.done);
      leftChunk = next.value ?? Buffer.alloc(0);
    }
    if (rightChunk.length === 0 && !rightDone) {
      const next = await rightIterator.next();
      rightDone = Boolean(next.done);
      rightChunk = next.value ?? Buffer.alloc(0);
    }
    if (leftDone && rightDone && leftChunk.length === 0 && rightChunk.length === 0) return true;
    if ((leftDone && leftChunk.length === 0) !== (rightDone && rightChunk.length === 0)) return false;
    const compared = Math.min(leftChunk.length, rightChunk.length);
    if (!leftChunk.subarray(0, compared).equals(rightChunk.subarray(0, compared))) return false;
    leftChunk = leftChunk.subarray(compared);
    rightChunk = rightChunk.subarray(compared);
  }
}
function textPart(name, kind, text, mediaType = "text/plain; charset=utf-8") {
  return text ? { name, kind, text, mediaType } : void 0;
}
function typedObservationParts(event) {
  if (!shouldArchiveToolResult(event.toolName)) return [];
  const parts = [];
  if (isEditToolResult(event)) {
    const diff = textPart("diff", "diff", event.details?.diff);
    if (diff) parts.push(diff);
  }
  if (isIpythonToolResult(event)) {
    const stdout = textPart("stdout", "stdout", event.details?.stdout);
    const stderr = textPart("stderr", "stderr", event.details?.stderr);
    const result = textPart("result-value", "result", event.details?.result);
    const traceback = textPart("traceback", "traceback", event.details?.error?.traceback.join("\n"));
    if (stdout) parts.push(stdout);
    if (stderr) parts.push(stderr);
    if (result) parts.push(result);
    if (traceback) parts.push(traceback);
    const ipythonDetails = record3(event.details);
    const sentAgentMessages = ipythonDetails?.sentAgentMessages;
    if (Array.isArray(sentAgentMessages) && sentAgentMessages.length > 0) {
      parts.push({
        name: "sent-agent-messages",
        kind: "result",
        mediaType: "application/json",
        text: JSON.stringify(sentAgentMessages, null, 2)
      });
    }
    if (ipythonDetails?.error && typeof ipythonDetails.error === "object") {
      parts.push({
        name: "error",
        kind: "traceback",
        mediaType: "application/json",
        text: JSON.stringify(ipythonDetails.error, null, 2)
      });
    }
    if (event.details?.diffs?.length) {
      parts.push({
        name: "diff",
        kind: "diff",
        mediaType: "application/json",
        text: JSON.stringify(event.details.diffs, null, 2)
      });
    }
    for (const [index, attachment] of (event.details?.attachments ?? []).entries()) {
      parts.push({
        name: `attachment:${index + 1}`,
        kind: "attachment",
        mediaType: attachment.mimeType,
        binaryBase64: attachment.data
      });
    }
  }
  let imageIndex = 0;
  for (const block of event.content) {
    if (block.type !== "image") continue;
    imageIndex += 1;
    parts.push({
      name: `image:${imageIndex}`,
      kind: "image",
      mediaType: block.mimeType,
      binaryBase64: block.data
    });
  }
  return parts;
}
var PROVIDER_IMAGE_MIME_TYPES2 = /* @__PURE__ */ new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
function projectedImageRefs(exchangeId, content) {
  const images = [];
  let imageIndex = 0;
  for (const block of content) {
    if (block.type !== "image") continue;
    imageIndex += 1;
    const bytes = Buffer.from(block.data, "base64");
    const dimensions = imageDimensions(bytes, block.mimeType);
    images.push({
      ref: `${exchangeId}:image:${imageIndex}`,
      mimeType: block.mimeType,
      bytes: bytes.byteLength,
      ...dimensions ?? {}
    });
  }
  return images;
}
function typedObservationPartsEqual(left, right) {
  if (left.length !== right.length) return false;
  return left.every((part, index) => {
    const candidate = right[index];
    if (!candidate || part.name !== candidate.name || part.kind !== candidate.kind || part.pointer !== candidate.pointer || part.mediaType !== candidate.mediaType || part.text !== candidate.text || part.binaryBase64 !== candidate.binaryBase64) return false;
    if (part.source === candidate.source) return true;
    if (!part.source || !candidate.source || part.source.kind !== candidate.source.kind) return false;
    if (part.source.kind === "text" && candidate.source.kind === "text") {
      return part.source.text === candidate.source.text;
    }
    if (part.source.kind === "path" && candidate.source.kind === "path") {
      return part.source.path === candidate.source.path;
    }
    if (part.source.kind === "bytes" && candidate.source.kind === "bytes") {
      return Buffer.from(part.source.bytes).equals(Buffer.from(candidate.source.bytes));
    }
    return false;
  });
}
function record3(value) {
  return value && typeof value === "object" ? value : void 0;
}
function messageText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => record3(part)).filter((part) => Boolean(part) && part?.type === "text").map((part) => typeof part.text === "string" ? part.text : "").join("\n");
}
function activeGoalFromBranch(branch) {
  const seen = /* @__PURE__ */ new Set();
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    if (branch[index].type !== "custom" || branch[index].customType !== "thread_goal_state") continue;
    const data = record3(branch[index].data);
    const goalId = typeof data?.goalId === "string" ? data.goalId : void 0;
    if (!data || !goalId || seen.has(goalId)) continue;
    seen.add(goalId);
    if (data.status !== "active") continue;
    return {
      goalId,
      status: "active",
      ...typeof data.objective === "string" ? { objective: data.objective } : {}
    };
  }
  return void 0;
}
function scopeBranchToGoal(branch, goal) {
  if (!goal) return branch;
  const goalIndex = branch.findIndex((entry) => record3(entry.data)?.goalId === goal.goalId);
  if (goalIndex < 0) return branch;
  for (let index = goalIndex - 1; index >= 0; index -= 1) {
    if (record3(branch[index].message)?.role === "user") return branch.slice(index);
  }
  return branch.slice(goalIndex);
}
function branchUserEntries(branch, selection) {
  const entries = [];
  let selected = selection.source === "goal";
  for (let index = 0; index < branch.length; index += 1) {
    const entry = branch[index];
    const message = record3(entry.message);
    if (entry.type !== "message" || message?.role !== "user") continue;
    const id = entry.id ?? `user:${index}`;
    if (!selected && id === selection.rootUserEntryId) selected = true;
    if (!selected) continue;
    const text = messageText(message.content);
    if (text.trim()) entries.push({ id, text });
  }
  return entries;
}
function taskObjective(branch, selection, fallback = "") {
  if (selection.objective?.trim()) return selection.objective;
  if (selection.rootUserEntryId) {
    const root = branch.find((entry) => entry.id === selection.rootUserEntryId);
    const text = messageText(record3(root?.message)?.content);
    if (text.trim()) return text;
  }
  return fallback;
}
function latestBranchUserText(branch) {
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    const message = record3(branch[index].message);
    if (message?.role === "user") return messageText(message.content);
  }
  return "";
}
function sameAnchor(persisted, anchor, allowPositionallyScopedUnscoped = false) {
  if (persisted?.content !== anchor.content) return false;
  return persisted.details?.taskKey === anchor.details.taskKey || allowPositionallyScopedUnscoped && persisted.details?.taskKey === void 0;
}
function branchAnchorId(branch) {
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    if (branch[index].id) return branch[index].id;
  }
  return void 0;
}
function branchScopeIds(branch) {
  const ids = [];
  for (const entry of branch) {
    if (entry.id) ids.push(entry.id);
    const message = record3(entry.message);
    if (message?.role !== "assistant" || !Array.isArray(message.content)) continue;
    for (const part of message.content) {
      const item = record3(part);
      if (item?.type === "toolCall" && typeof item.id === "string") ids.push(item.id);
    }
  }
  return ids;
}
function observationRefsFromValues(values, limit = Number.POSITIVE_INFINITY) {
  const ids = /* @__PURE__ */ new Set();
  const visit = (value) => {
    if (ids.size >= limit || value === null || value === void 0) return;
    if (typeof value === "string") {
      for (const match of value.matchAll(/\bobs_[A-Za-z0-9-]+\b/g)) {
        ids.add(match[0]);
        if (ids.size >= limit) break;
      }
      for (const match of value.matchAll(/\bo\d+\b/g)) {
        ids.add(normalizeObservationRef(match[0]));
        if (ids.size >= limit) break;
      }
      for (const match of value.matchAll(/\bub_[A-Za-z0-9-]+\b/g)) {
        ids.add(match[0]);
        if (ids.size >= limit) break;
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (typeof value === "object") {
      for (const item of Object.values(value)) visit(item);
    }
  };
  for (const value of values) {
    visit(value);
    if (ids.size >= limit) break;
  }
  return [...ids];
}
function observationRefs(branch, limit = Number.POSITIVE_INFINITY) {
  return observationRefsFromValues(branch, limit);
}
function observationRefsInProjectedMessages(messages) {
  return observationRefsFromValues(messages.map((message) => message.content));
}
function summaryObservationRefs(branch) {
  return observationRefsFromValues(branch.flatMap((entry) => {
    if (entry.type === "compaction" || entry.type === "branch_summary") return [entry.summary];
    if (entry.type === "custom_message" && entry.customType === PRIME_CONTEXT_FOLD_TYPE) return [entry.content];
    return [];
  }));
}
function latestCompactionObservationRefs(branch) {
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    if (branch[index].type === "compaction") return observationRefsFromValues([branch[index].summary]);
  }
  return [];
}
function branchProjectionEntries(branch) {
  return branch.flatMap((entry) => {
    if (!entry.id) return [];
    if (entry.type === "message") {
      const message = record3(entry.message);
      if (message?.role === "bashExecution" && message.excludeFromContext === true) return [];
      return message && typeof message.role === "string" ? [{ entryId: entry.id, message }] : [];
    }
    if (entry.type === "custom_message" && entry.customType && entry.content !== void 0) {
      return [{
        entryId: entry.id,
        message: {
          role: "custom",
          customType: entry.customType,
          content: entry.content,
          display: entry.display,
          details: entry.details
        }
      }];
    }
    if ((entry.type === "compaction" || entry.type === "branch_summary") && typeof entry.summary === "string") {
      return [{ entryId: entry.id, message: { role: "user", content: entry.summary } }];
    }
    return [];
  });
}
function providerModelBranchEntries(branch) {
  let latestCompaction;
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    if (branch[index].type === "compaction") {
      latestCompaction = branch[index];
      break;
    }
  }
  const visible = providerVisibleBranchEntries(branch);
  return latestCompaction ? [latestCompaction, ...visible] : visible;
}
function branchSourceMessages(branch) {
  return new Map(branchProjectionEntries(branch).map((entry) => [entry.entryId, entry.message]));
}
function resolveFoldApplication(branch, fold, taskKey) {
  if (!fold) return void 0;
  const allEntryIds = branch.flatMap((entry) => entry.id ? [entry.id] : []);
  if (allEntryIds.length !== branch.length || new Set(allEntryIds).size !== allEntryIds.length) {
    return void 0;
  }
  const cutoffMatches = branch.flatMap((entry, index) => entry.id === fold.throughEntryId ? [index] : []);
  if (cutoffMatches.length !== 1) return void 0;
  const cutoff = cutoffMatches[0];
  const prefix = branch.slice(0, cutoff + 1);
  if (prefix.some((entry) => !entry.id)) return void 0;
  const prefixEntryIds = new Set(prefix.map((entry) => entry.id));
  if (prefixEntryIds.size !== prefix.length || new Set(fold.retainedEntryIds).size !== fold.retainedEntryIds.length || fold.retainedEntryIds.some((id) => !prefixEntryIds.has(id))) {
    return void 0;
  }
  const matches = branch.flatMap((entry, index) => {
    if (!entry.id) return [];
    const raw = entry.type === "custom_message" ? { customType: entry.customType, content: entry.content, details: entry.details } : record3(entry.message);
    const details = record3(raw?.details);
    return raw?.customType === PRIME_CONTEXT_FOLD_TYPE && raw.content === fold.renderedMessage && details?.taskKey === taskKey && details?.generation === fold.generation && details?.throughEntryId === fold.throughEntryId ? [{ entryId: entry.id, index }] : [];
  });
  if (matches.length !== 1 || matches[0].index <= cutoff) return void 0;
  return { prefixEntryIds, foldMessageEntryId: matches[0].entryId };
}
function filterFoldPrefix(entries, fold, prefixEntryIds) {
  const retained = new Set(fold.retainedEntryIds);
  return entries.filter((entry) => !entry.id || !prefixEntryIds.has(entry.id) || retained.has(entry.id));
}
function foldVisibleBranchEntries(branch, fold, taskKey) {
  if (!fold) return branch;
  const application = resolveFoldApplication(branch, fold, taskKey);
  return application ? filterFoldPrefix(branch, fold, application.prefixEntryIds) : branch;
}
function completeVisibleToolCallIds(branch) {
  const calls = /* @__PURE__ */ new Set();
  const results = /* @__PURE__ */ new Set();
  for (const entry of branch) {
    const message = record3(entry.message);
    if (entry.type !== "message" || !message) continue;
    if (message.role === "bashExecution" && message.excludeFromContext !== true && entry.id) {
      calls.add(entry.id);
      results.add(entry.id);
    } else if (message.role === "assistant" && Array.isArray(message.content)) {
      for (const part of message.content) {
        const block = record3(part);
        if (block?.type === "toolCall" && typeof block.id === "string") calls.add(block.id);
      }
    } else if (message.role === "toolResult" && typeof message.toolCallId === "string") {
      results.add(message.toolCallId);
    }
  }
  return new Set([...calls].filter((id) => results.has(id)));
}
function visibleFixedToolCallIds(branch, fold, taskKey) {
  const modelBranch = providerModelBranchEntries(branch);
  if (!fold) return completeVisibleToolCallIds(modelBranch);
  const application = resolveFoldApplication(branch, fold, taskKey);
  return completeVisibleToolCallIds(application ? filterFoldPrefix(modelBranch, fold, application.prefixEntryIds) : modelBranch);
}
function selectForkVisibleImports(branch, fold, taskKey, pinnedRefs, parentViews) {
  const modelBranch = providerModelBranchEntries(branch);
  const application = resolveFoldApplication(branch, fold, taskKey);
  const visibleBranch = fold && application ? filterFoldPrefix(modelBranch, fold, application.prefixEntryIds) : modelBranch;
  const completeToolCallIds = completeVisibleToolCallIds(visibleBranch);
  const visibleViews = parentViews.filter((view) => completeToolCallIds.has(view.toolCallId));
  const fixedRefs = visibleViews.map((view) => view.exchangeId);
  const projected = projectFoldCandidateMessages(
    branchProjectionEntries(modelBranch),
    visibleViews,
    "provider",
    fold,
    application?.foldMessageEntryId,
    application?.prefixEntryIds
  );
  const required = [.../* @__PURE__ */ new Set([
    ...pinnedRefs.map(normalizeObservationRef),
    ...summaryObservationRefs(visibleBranch),
    ...latestCompactionObservationRefs(branch)
  ])];
  return {
    visibleBranch,
    completeToolCallIds,
    fixedRefs,
    refs: selectForkImportRefs(
      required,
      [],
      [
        ...observationRefsInProjectedMessages(projected.messages),
        ...projected.shownImageRefs ?? []
      ]
    )
  };
}
function fileLists(fileOps) {
  const value = record3(fileOps);
  const values = (key) => {
    const item = value?.[key];
    if (item instanceof Set) return [...item].filter((path) => typeof path === "string");
    return Array.isArray(item) ? item.filter((path) => typeof path === "string") : [];
  };
  const modifiedFiles = [.../* @__PURE__ */ new Set([...values("modifiedFiles"), ...values("modified"), ...values("written"), ...values("edited")])];
  const modified = new Set(modifiedFiles);
  return {
    readFiles: [.../* @__PURE__ */ new Set([...values("readFiles"), ...values("read")])].filter((path) => !modified.has(path)),
    modifiedFiles
  };
}
function treeFixedFileLists(entries, views) {
  const readFiles = /* @__PURE__ */ new Set();
  const modifiedFiles = /* @__PURE__ */ new Set();
  for (const entry of entries) {
    if (entry.message.role !== "assistant" || !Array.isArray(entry.message.content)) continue;
    for (const part of entry.message.content) {
      const call = record3(part);
      if (call?.type !== "toolCall" || typeof call.id !== "string" || typeof call.name !== "string") continue;
      const view = views.get(call.id);
      if (!view) return void 0;
      const args = view.callArguments ?? record3(call.arguments);
      const path = typeof args?.path === "string" ? args.path : typeof args?.file_path === "string" ? args.file_path : void 0;
      if (call.name === "read") {
        if (!path) return void 0;
        readFiles.add(path);
      } else if (call.name === "edit" || call.name === "write") {
        if (!path) return void 0;
        modifiedFiles.add(path);
      } else {
        return void 0;
      }
    }
  }
  for (const path of modifiedFiles) readFiles.delete(path);
  return { readFiles: [...readFiles], modifiedFiles: [...modifiedFiles] };
}
function scopeFixedExchangeViews(views, allowedToolCallIds) {
  return views.filter((view) => allowedToolCallIds.has(view.toolCallId));
}
function selectForkImportRefs(pinnedRefs, fixedRefs, visibleRefs, _target) {
  return [.../* @__PURE__ */ new Set([...pinnedRefs, ...fixedRefs, ...visibleRefs])];
}
function commandCandidates(text) {
  return [...text.matchAll(/`([^`\n]+)`/g)].map((match) => match[1].trim()).filter(Boolean);
}
function literalAcceptanceCommands(text) {
  const executable = /(?:^|\s)((?:\.\/)?(?:python3?|pytest|py\.test|vitest|jest|mocha|npm|pnpm|yarn|bun|cargo|go|ctest|dotnet|mvnw?|gradlew?|mix|swift|tsc|eslint|ruff|clippy|biome|prettier|black))\b/gi;
  const starts = [...text.matchAll(executable)].map((match) => (match.index ?? 0) + match[0].length - match[1].length);
  const commands = [];
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    let end = starts[index + 1] ?? text.length;
    const tail = text.slice(start, end);
    const boundary = tail.search(/(?:\r?\n|[,;.]\s|\s+(?:and|then|before|after|so that|to confirm)\b)/i);
    if (boundary > 0) end = start + boundary;
    const command = text.slice(start, end).trim().replace(/[,:;.]+$/, "").trim();
    if (command) commands.push(command);
  }
  for (const fence of text.matchAll(/```(?:[A-Za-z0-9_-]+)?\s*\n([\s\S]*?)```/g)) {
    commands.push(...fence[1].split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  }
  return [...new Set(commands)];
}
function acceptanceClassifier(cwd) {
  return (text, current) => {
    const explicitRemoval = /(?:remove|drop|no longer require).{0,40}(?:acceptance|validation|test|check)/i.test(text);
    const acceptanceContext = /(?:acceptance|final (?:validation|check)|must (?:run|pass)|required (?:validation|test|check|command)|before (?:completion|completing|goal completion))/i.test(text);
    if (!acceptanceContext && !explicitRemoval) return void 0;
    const suites = [];
    for (const command of [...commandCandidates(text), ...literalAcceptanceCommands(text)]) {
      const classified = classifyValidationCommand(command, cwd);
      if (classified && !suites.some((suite2) => suite2.family === classified.suite.family && suite2.target === classified.suite.target)) {
        suites.push(classified.suite);
      }
    }
    const currentCandidates = current.map(({ key, suiteFamily, target }) => ({ key, suiteFamily, target }));
    if (explicitRemoval) {
      if (suites.length === 0) return [];
      const removed = new Set(suites.map((suite2) => `suite:${suite2.family}:${suite2.target}`));
      return currentCandidates.filter((gate) => !removed.has(gate.key));
    }
    if (suites.length === 0) return void 0;
    const replaces = /(?:replace|instead|only).{0,40}(?:acceptance|validation|test|check)|(?:acceptance|validation) (?:commands?|gates?) (?:is|are|now)/i.test(text);
    return replaces ? suites : [...currentCandidates, ...suites];
  };
}
function primeContext(pi) {
  const runtime = {
    mode: "on",
    config: { ...DEFAULT_CONFIG },
    configWarnings: [],
    snapshot: emptySnapshot(),
    readiness: "NOT_READY",
    exchanges: new ExchangeTracker(),
    fixedViews: /* @__PURE__ */ new Map(),
    projectedRefs: /* @__PURE__ */ new WeakMap(),
    recoveryLeases: /* @__PURE__ */ new Map(),
    recoveryUtilities: /* @__PURE__ */ new Map(),
    pendingImages: /* @__PURE__ */ new Map(),
    consumedImageRefs: /* @__PURE__ */ new Set(),
    projectedRecoveryToolCallIds: /* @__PURE__ */ new Set(),
    projectedImageRefs: /* @__PURE__ */ new Set(),
    control: {
      structuralBoundary: false,
      needsAnchorRefresh: false
    },
    lifecycle: {
      agentRun: 0,
      replayMetadataPagingEligible: false
    }
  };
  const hooks = /* @__PURE__ */ new Set();
  pi.on("before_agent_start", (event) => ({
    systemPrompt: appendPrimeContextGlobalPolicy(event.systemPrompt)
  }));
  const cwdKey = (cwd) => Buffer.from(resolve2(cwd), "utf8").toString("base64url");
  const discoverRecallSources = async (ctx, archiveRoot) => {
    const normalizedCwd = resolve2(ctx.cwd);
    const key = cwdKey(normalizedCwd);
    const getHeader = ctx.sessionManager.getHeader;
    const getSessionDir = ctx.sessionManager.getSessionDir;
    const header = typeof getHeader === "function" ? getHeader.call(ctx.sessionManager) : null;
    const currentSessionId = ctx.sessionManager.getSessionId();
    let parent;
    let isRlmChild = false;
    let projectSessionDir = typeof getSessionDir === "function" ? getSessionDir.call(ctx.sessionManager) : void 0;
    let parentFile = header?.parentSession;
    let direct = true;
    let expectedParentDepth = header?.rlmDepth === void 0 ? void 0 : header.rlmDepth - 1;
    const seen = /* @__PURE__ */ new Set();
    while (parentFile && !seen.has(parentFile)) {
      seen.add(parentFile);
      const parentHeader = await readRecallSessionHeader(parentFile);
      if (!parentHeader) break;
      if (direct) {
        parent = {
          archive: new ObservationArchive(archiveRoot, parentHeader.id),
          scope: "parent",
          sessionId: parentHeader.id,
          sessionDate: parentHeader.timestamp
        };
        isRlmChild = expectedParentDepth !== void 0 && parentHeader.rlmDepth === expectedParentDepth;
        if (!isRlmChild) break;
      } else if (expectedParentDepth === void 0 || parentHeader.rlmDepth !== expectedParentDepth) {
        break;
      }
      projectSessionDir = dirname2(parentFile);
      direct = false;
      if (parentHeader.rlmDepth === 0) break;
      expectedParentDepth = parentHeader.rlmDepth === void 0 ? void 0 : parentHeader.rlmDepth - 1;
      parentFile = parentHeader.parentSession;
    }
    return {
      normalizedCwd,
      cwdKey: key,
      isRlmChild,
      currentSessionId,
      archiveRoot,
      ...projectSessionDir ? { projectSessionDir } : {},
      ...parent ? { parent } : {}
    };
  };
  const installFixedViews = (views, replace = false, allowedToolCallIds) => {
    if (replace) runtime.fixedViews.clear();
    const scoped = allowedToolCallIds ? scopeFixedExchangeViews(views, allowedToolCallIds) : views;
    for (const view of scoped) runtime.fixedViews.set(view.toolCallId, view);
  };
  const clearProjectionLeases = () => {
    runtime.recoveryLeases.clear();
    runtime.recoveryUtilities.clear();
    runtime.pendingImages.clear();
    runtime.consumedImageRefs.clear();
    runtime.projectedRecoveryToolCallIds.clear();
    runtime.projectedImageRefs.clear();
  };
  const registerRecoveryLease = (toolCallId, content) => {
    const cloned = content.map((block) => ({ ...block }));
    const bytes = recoveryLeaseBytes(cloned);
    runtime.recoveryLeases.delete(toolCallId);
    if (bytes > RECOVERY_LEASE_MAX_BYTES) return;
    while (runtime.recoveryLeases.size >= 32 || [...runtime.recoveryLeases.values()].reduce(
      (total, lease) => total + (lease.bytes ?? recoveryLeaseBytes(lease.content)),
      bytes
    ) > RECOVERY_LEASE_TOTAL_BYTES) {
      const oldest = runtime.recoveryLeases.keys().next().value;
      if (oldest === void 0) break;
      runtime.recoveryLeases.delete(oldest);
      runtime.recoveryUtilities.delete(oldest);
    }
    runtime.recoveryLeases.set(toolCallId, { content: cloned, bytes });
  };
  const registerRecoveryUtility = (toolCallId, subjectKeys, exposedBytes, inspectRecallHit) => {
    runtime.recoveryUtilities.delete(toolCallId);
    runtime.recoveryUtilities.set(toolCallId, {
      subjectKeys: [...new Set(subjectKeys)].slice(0, 8),
      exposedBytes: Math.max(0, exposedBytes),
      inspectRecallHit,
      useful: true
    });
    while (runtime.recoveryUtilities.size > 32) {
      const oldest = runtime.recoveryUtilities.keys().next().value;
      if (oldest === void 0) break;
      runtime.recoveryUtilities.delete(oldest);
      runtime.recoveryLeases.delete(oldest);
    }
  };
  const selectTaskRuntime = (branch, goal, reload = false) => {
    const selection = deriveTaskSelection(branch, goal);
    if (!selection) {
      runtime.taskRuntime = void 0;
      runtime.readiness = "NOT_READY";
      runtime.archive?.setBranchScope(void 0, branchScopeIds(branch), [
        ...observationRefs(branch),
        ...runtime.snapshot.pinnedObservationIds
      ]);
      return void 0;
    }
    if (reload || runtime.taskRuntime?.taskKey !== selection.taskKey) {
      runtime.taskRuntime = loadLatestRuntime(branch, selection.taskKey) ?? createTaskRuntime(selection);
      runtime.readiness = deriveReadiness(runtime.taskRuntime);
      runtime.exchanges.clearPending();
      runtime.archive?.resetBranchState();
    }
    runtime.archive?.setBranchScope(selection.taskKey, branchScopeIds(branch), [
      ...observationRefs(branch),
      ...runtime.snapshot.pinnedObservationIds
    ]);
    return selection;
  };
  const refreshTaskContract = (branch, goal, cwd, reload = false) => {
    const selection = selectTaskRuntime(branch, goal, reload);
    if (!selection || !runtime.taskRuntime) return void 0;
    const objective = taskObjective(branch, selection, runtime.taskRuntime.objective ?? "");
    if (runtime.taskRuntime.objective === void 0 && objective.trim()) {
      runtime.taskRuntime = {
        ...runtime.taskRuntime,
        objective,
        objectiveVersion: Math.max(1, runtime.taskRuntime.objectiveVersion)
      };
    }
    const update = updateTaskContract(runtime.taskRuntime, {
      objective,
      userEntries: branchUserEntries(branch, selection)
    }, acceptanceClassifier(cwd));
    runtime.taskRuntime = update.runtime;
    runtime.readiness = deriveReadiness(update.runtime);
    runtime.branchAnchorId = branchAnchorId(branch);
    return selection;
  };
  const childAnchorContext = (prompt) => {
    const recall = runtime.sessionRecall;
    if (!recall?.isRlmChild || !recall.parent) return void 0;
    const refPattern = /(?<![A-Za-z0-9_])(?:(?<session>[A-Za-z0-9_-]+):)?(?<ref>o\d+|obs_[A-Za-z0-9_-]+)(?<part>:[A-Za-z0-9_#/.~-]+)?(?![A-Za-z0-9_])/g;
    const explicitRefs = [...prompt.matchAll(refPattern)].flatMap((match) => {
      const source = match.groups?.session;
      const ref = match.groups?.ref;
      if (!ref || source && source !== recall.parent.sessionId) return [];
      return [`${ref}${match.groups?.part ?? ""}`];
    });
    const parentRefs = [...new Set(explicitRefs)].slice(0, 8);
    const relevantPaths = explicitSteeringPaths(prompt).slice(0, 8);
    const constraints = prompt.split(/(?:\n+|(?<=[.!?])\s+)/).map((value) => value.replace(/^[-*]\s*/, "").trim()).filter((value) => /\b(?:must|do not|don't|never|only|required|without|limit(?:ed)? to)\b/i.test(value)).slice(0, 6);
    return {
      parentSessionId: recall.parent.sessionId,
      parentRefs,
      relevantPaths,
      constraints
    };
  };
  const currentTaskAnchor = (branch, selection, visiblePrompt) => {
    if (!selection || !runtime.taskRuntime) return void 0;
    const objective = taskObjective(branch, selection, visiblePrompt);
    const child = childAnchorContext(objective);
    const input = {
      taskKey: selection.taskKey,
      objective,
      runtime: runtime.taskRuntime,
      snapshot: runtime.snapshot,
      ...child ? { child } : {}
    };
    if (!input.objective.trim() || !taskAnchorHasDurableState(input, visiblePrompt)) return void 0;
    return renderPrimeContextAnchor(input);
  };
  const clearControlState = (structuralBoundary) => {
    runtime.control.expectedAnchor = void 0;
    runtime.control.lastStateContent = void 0;
    runtime.control.structuralBoundary = structuralBoundary;
    runtime.control.needsAnchorRefresh = false;
  };
  const reloadSelectedBranch = (ctx, preserveProjectionLeases = false) => {
    const fullBranch = ctx.sessionManager.getBranch();
    const providerBranch = providerVisibleBranchEntries(fullBranch);
    runtime.exchanges.clearPending();
    runtime.projectedRefs = /* @__PURE__ */ new WeakMap();
    if (!preserveProjectionLeases) clearProjectionLeases();
    runtime.branchAnchorId = void 0;
    runtime.archive?.resetBranchState();
    runtime.snapshot = loadLatestSnapshot(fullBranch);
    const goal = activeGoalFromBranch(fullBranch);
    const branch = scopeBranchToGoal(fullBranch, goal);
    const selection = refreshTaskContract(branch, goal, ctx.cwd, true);
    runtime.control.expectedAnchor = currentTaskAnchor(
      branch,
      selection,
      latestBranchUserText(providerBranch)
    );
    runtime.control.lastStateContent = runtime.taskRuntime ? latestProviderVisibleControlMessage(
      fullBranch,
      PRIME_CONTEXT_STATE_TYPE,
      runtime.taskRuntime.taskKey
    )?.content : void 0;
  };
  const installUserBashViews = async (ctx) => {
    if (!runtime.archive) return;
    const entries = branchProjectionEntries(ctx.sessionManager.getBranch());
    const completed = [];
    const frozenSources = [];
    try {
      for (const [sourceOrder, entry] of entries.entries()) {
        const message = entry.message;
        if (message.role !== "bashExecution" || message.excludeFromContext === true || runtime.fixedViews.has(entry.entryId)) continue;
        const command = typeof message.command === "string" ? message.command : "";
        const output = typeof message.output === "string" ? message.output : "";
        const fullOutputPath2 = typeof message.fullOutputPath === "string" ? message.fullOutputPath : void 0;
        let frozenOutputPath;
        if (fullOutputPath2) {
          try {
            frozenOutputPath = await runtime.archive.freezeTextSource(fullOutputPath2, ctx.signal);
            frozenSources.push(frozenOutputPath);
          } catch {
            ctx.signal?.throwIfAborted();
          }
        }
        const resolved = await resolveArchiveText(
          [{ type: "text", text: output }],
          frozenOutputPath,
          ctx.signal
        );
        const details = {
          ...typeof message.exitCode === "number" ? { exitCode: message.exitCode } : {},
          ...fullOutputPath2 ? { fullOutputPath: fullOutputPath2 } : {}
        };
        const exchangeId = `ub_${entry.entryId}`;
        const modelInput = { command };
        const intent = adaptToolIntent({
          exchangeId,
          toolCallId: entry.entryId,
          toolName: "bash",
          input: modelInput,
          cwd: ctx.cwd,
          modelInputBytes: jsonBytes(modelInput),
          details,
          resultText: resolved.outcomeText ?? resolved.text,
          isError: message.cancelled === true || typeof message.exitCode === "number" && message.exitCode !== 0
        });
        const isError = message.cancelled === true || typeof message.exitCode === "number" && message.exitCode !== 0;
        const outcome = collectFactualOutcome(intent, resolved.outcomeText ?? resolved.text, isError, details);
        completed.push({
          metadata: {
            exchangeId,
            toolCallId: entry.entryId,
            intentKind: intent.kind,
            subjectKey: intent.subjectKey,
            resources: intent.resources,
            ...intent.suite ? { suite: intent.suite } : {},
            effectiveCwd: intent.effectiveCwd,
            mutatesWorkspace: intent.mutatesWorkspace,
            modelInputBytes: intent.modelInputBytes,
            executedInputBytes: intent.executedInputBytes,
            ...intent.facts ? { facts: intent.facts } : {},
            outcome,
            taskKey: runtime.taskRuntime?.taskKey,
            goalId: runtime.taskRuntime?.goalId,
            branchAnchorId: entry.entryId,
            turnSequence: runtime.taskRuntime?.turnSequence,
            requirementsRevision: runtime.taskRuntime?.requirementsRevision,
            workspaceRevisionAtStart: runtime.taskRuntime?.workspaceRevision,
            workspaceRevisionAtResult: runtime.taskRuntime?.workspaceRevision
          },
          toolName: "bash",
          isError,
          source: resolved.source,
          parts: [{
            name: "result",
            kind: "result",
            mediaType: "text/plain; charset=utf-8",
            ...resolved.partSource ? { source: resolved.partSource } : { text: resolved.text }
          }],
          persistedModelInput: modelInput,
          persistedRawCall: { type: "toolCall", id: entry.entryId, name: "bash", arguments: modelInput },
          persistedRawResult: { details, isError },
          resultText: resolved.text,
          largeResult: resolved.large,
          canonicalResultChangedAfterHook: resolved.large,
          resultSummary: resolved,
          sourceOrder
        });
      }
      if (completed.length === 0) return;
      await runtime.archive.finalizeExchanges(completed, ctx.signal, {
        budgetBytes: fixedExchangeBudgetBytes(ctx.getContextUsage()),
        capsuleMaxBytes: runtime.config.capsuleMaxBytes
      });
      installFixedViews(await runtime.archive.loadFixedExchangeViews(
        ctx.signal,
        completed.map((item) => item.metadata.exchangeId)
      ));
    } finally {
      await Promise.all(frozenSources.map(
        (path) => runtime.archive.removeFrozenTextSource(path).catch(() => void 0)
      ));
    }
  };
  pi.on("session_start", async (event, ctx) => {
    const loaded = loadPrimeContextConfig(ctx.cwd);
    runtime.config = loaded.config;
    runtime.configWarnings = loaded.warnings;
    runtime.mode = loaded.config.enabled ? "on" : "off";
    const archiveRoot = storageRoot();
    const currentArchive = new ObservationArchive(archiveRoot, ctx.sessionManager.getSessionId());
    runtime.archive = currentArchive;
    runtime.sessionRecall = await discoverRecallSources(ctx, archiveRoot);
    runtime.exchanges.resetSession();
    runtime.fixedViews.clear();
    runtime.projectedRefs = /* @__PURE__ */ new WeakMap();
    runtime.lastProviderProjection = void 0;
    runtime.taskRuntime = void 0;
    runtime.readiness = "NOT_READY";
    runtime.lifecycle.selectedModelKey = ctx.model ? `${ctx.model.provider}:${ctx.model.id}` : void 0;
    runtime.lifecycle.replayMetadataPagingEligible = false;
    clearControlState(false);
    reloadSelectedBranch(ctx);
    runtime.exchanges.setMinimumSequence(await currentArchive.maxExchangeSequence(void 0, ctx.signal));
    currentArchive.recordBranchRuntimeReload();
    const sessionBranch = ctx.sessionManager.getBranch();
    const selectedRuntime = runtime.taskRuntime;
    installFixedViews(
      await currentArchive.loadFixedExchangeViews(ctx.signal).catch(() => []),
      true,
      visibleFixedToolCallIds(sessionBranch, selectedRuntime?.fold, selectedRuntime?.taskKey)
    );
    if (event.reason === "fork" && runtime.sessionRecall.parent) {
      const parentSessionId = runtime.sessionRecall.parent.sessionId;
      if (parentSessionId && parentSessionId !== ctx.sessionManager.getSessionId()) {
        const branch = ctx.sessionManager.getBranch();
        const parentArchive = runtime.sessionRecall.parent.archive;
        const parentViews = await parentArchive.loadFixedExchangeViews(ctx.signal).catch(() => []);
        const selectedRuntime2 = runtime.taskRuntime;
        const visible = selectForkVisibleImports(
          branch,
          selectedRuntime2?.fold,
          selectedRuntime2?.taskKey,
          runtime.snapshot.pinnedObservationIds,
          parentViews
        );
        const refs = visible.refs;
        await currentArchive.importFrom(
          parentArchive,
          refs,
          ctx.signal,
          {
            taskKey: runtime.taskRuntime?.taskKey,
            branchAnchorId: branchAnchorId(branch)
          }
        ).catch(() => void 0);
        runtime.exchanges.setMinimumSequence(await currentArchive.maxExchangeSequence(refs, ctx.signal));
        installFixedViews(
          await currentArchive.loadFixedExchangeViews(ctx.signal).catch(() => []),
          true,
          visible.completeToolCallIds
        );
      }
    }
    await installUserBashViews(ctx);
  });
  hooks.add("session_start");
  pi.on("before_agent_start", (event, ctx) => {
    if (runtime.mode === "off") return;
    const fullBranch = ctx.sessionManager.getBranch();
    const providerBranch = providerVisibleBranchEntries(fullBranch);
    const goal = activeGoalFromBranch(fullBranch);
    if (!goal) {
      const currentSelection = deriveTaskSelection(fullBranch);
      const incomingSelection = deriveTaskSelection([
        ...fullBranch,
        { type: "message", message: { role: "user", content: event.prompt } }
      ]);
      if (incomingSelection && incomingSelection.taskKey !== currentSelection?.taskKey) {
        const preview2 = previewTaskContract(
          createTaskRuntime({ taskKey: "", objective: event.prompt, source: "user" }),
          event.prompt,
          acceptanceClassifier(ctx.cwd)
        ).runtime;
        const child2 = childAnchorContext(event.prompt);
        const input2 = {
          objective: event.prompt,
          runtime: preview2,
          snapshot: runtime.snapshot,
          ...child2 ? { child: child2 } : {}
        };
        if (!event.prompt.trim() || !taskAnchorHasDurableState(input2, event.prompt)) {
          runtime.control.expectedAnchor = void 0;
          return;
        }
        const anchor2 = renderPrimeContextAnchor(input2);
        runtime.control.expectedAnchor = anchor2;
        return {
          message: {
            customType: PRIME_CONTEXT_ANCHOR_TYPE,
            content: anchor2.content,
            display: false,
            details: anchor2.details
          }
        };
      }
    }
    const branch = scopeBranchToGoal(fullBranch, goal);
    const selection = refreshTaskContract(branch, goal, ctx.cwd);
    if (!selection) {
      runtime.control.expectedAnchor = void 0;
      return;
    }
    const base = runtime.taskRuntime ?? createTaskRuntime(selection);
    const preview = /<goal_context>/i.test(event.prompt) ? base : previewTaskContract(base, event.prompt, acceptanceClassifier(ctx.cwd)).runtime;
    const objective = goal?.objective?.trim() || taskObjective(branch, selection, event.prompt);
    const child = childAnchorContext(event.prompt || objective);
    const input = {
      taskKey: selection.taskKey,
      objective,
      runtime: preview,
      snapshot: runtime.snapshot,
      ...child ? { child } : {}
    };
    const visiblePrompt = latestBranchUserText(providerBranch) || event.prompt;
    if (!input.objective.trim() || !taskAnchorHasDurableState(input, visiblePrompt)) {
      runtime.control.expectedAnchor = void 0;
      return;
    }
    const anchor = renderPrimeContextAnchor(input);
    runtime.control.expectedAnchor = anchor;
    const unscoped = selection.source === "user" && selection.rootUserEntryId ? { content: anchor.content, afterEntryId: selection.rootUserEntryId } : void 0;
    const persisted = latestProviderVisibleControlMessage(
      fullBranch,
      PRIME_CONTEXT_ANCHOR_TYPE,
      anchor.details.taskKey,
      unscoped
    );
    const positionallyScopedUnscoped = unscoped !== void 0 && persisted?.details?.taskKey === void 0;
    if (!runtime.control.needsAnchorRefresh && sameAnchor(persisted, anchor, positionallyScopedUnscoped)) return;
    return {
      message: {
        customType: PRIME_CONTEXT_ANCHOR_TYPE,
        content: anchor.content,
        display: false,
        details: anchor.details
      }
    };
  });
  hooks.add("before_agent_start");
  pi.on("agent_start", async (_event, ctx) => {
    if (runtime.mode === "off") return;
    runtime.lifecycle.agentRun += 1;
    runtime.lifecycle.turnIndex = 0;
    runtime.exchanges.clearPending();
    runtime.projectedRecoveryToolCallIds.clear();
    runtime.projectedImageRefs.clear();
    await installUserBashViews(ctx);
  });
  hooks.add("agent_start");
  pi.on("turn_start", async (event, ctx) => {
    if (runtime.mode === "off") return;
    runtime.lifecycle.turnIndex = event.turnIndex;
    await installUserBashViews(ctx);
  });
  hooks.add("turn_start");
  pi.on("model_select", (event) => {
    if (runtime.mode === "off") return;
    const modelKey = `${event.model.provider}:${event.model.id}`;
    const previousKey = event.previousModel ? `${event.previousModel.provider}:${event.previousModel.id}` : runtime.lifecycle.selectedModelKey;
    runtime.lifecycle.selectedModelKey = modelKey;
    runtime.lifecycle.replayMetadataPagingEligible = previousKey !== void 0 && previousKey !== modelKey;
  });
  hooks.add("model_select");
  pi.on("session_before_compact", async (event, ctx) => {
    if (runtime.mode === "off" || event.customInstructions || event.preparation.isSplitTurn || event.preparation.turnPrefixMessages.length > 0 || !runtime.taskRuntime) return;
    await installUserBashViews(ctx);
    const messages = event.preparation.messagesToSummarize;
    const entryRefs = messages.flatMap((message, messageIndex) => {
      const id = message && typeof message === "object" ? runtime.projectedRefs.get(message) : void 0;
      return id ? [{ messageIndex, entryId: id }] : [];
    });
    if (entryRefs.length !== messages.length) return;
    const compactBranch = event.branchEntries ?? ctx.sessionManager.getBranch() ?? [];
    const compactFold = resolveFoldApplication(
      compactBranch,
      runtime.taskRuntime.fold,
      runtime.taskRuntime.taskKey
    );
    const compactProjection = projectModelContext({
      purpose: "compaction",
      messages,
      entryRefs,
      fixedViews: runtime.fixedViews,
      fold: runtime.taskRuntime.fold,
      foldMessageEntryId: compactFold?.foldMessageEntryId,
      foldPrefixEntryIds: compactFold?.prefixEntryIds,
      sourceMessages: branchSourceMessages(compactBranch),
      activeModelKey: runtime.lifecycle.selectedModelKey
    });
    const files = fileLists(event.preparation.fileOps);
    const state = renderPrimeContextState(runtime.taskRuntime, runtime.snapshot).content;
    const anchor = runtime.control.expectedAnchor?.content ?? renderPrimeContextAnchor({
      taskKey: runtime.taskRuntime.taskKey,
      objective: runtime.taskRuntime.objective ?? runtime.taskRuntime.taskKey,
      runtime: runtime.taskRuntime,
      snapshot: runtime.snapshot
    }).content;
    const summary = deterministicFastSummary({
      messages: compactProjection.messages,
      entryRefs: compactProjection.entryRefs ?? entryRefs,
      fixedViews: runtime.fixedViews,
      previousSummary: event.preparation.previousSummary,
      anchor,
      state,
      hiddenSteering: runtime.taskRuntime.steeringDeltas,
      fileOps: files,
      sourceMessages: branchSourceMessages(compactBranch)
    });
    if (!summary) return;
    return {
      compaction: {
        summary,
        firstKeptEntryId: event.preparation.firstKeptEntryId,
        tokensBefore: event.preparation.tokensBefore,
        details: files
      }
    };
  });
  hooks.add("session_before_compact");
  pi.on("session_before_tree", async (event, ctx) => {
    if (runtime.mode === "off" || !event.preparation.userWantsSummary || event.preparation.customInstructions || !runtime.taskRuntime) return;
    await installUserBashViews(ctx);
    const entries = branchProjectionEntries(event.preparation.entriesToSummarize);
    if (entries.length === 0) return;
    const files = treeFixedFileLists(entries, runtime.fixedViews);
    if (!files) return;
    const foldApplication = resolveFoldApplication(
      ctx.sessionManager.getBranch(),
      runtime.taskRuntime.fold,
      runtime.taskRuntime.taskKey
    );
    const projected = projectFoldCandidateMessages(
      entries,
      runtime.fixedViews,
      "branch-summary",
      runtime.taskRuntime.fold,
      foldApplication?.foldMessageEntryId,
      foldApplication?.prefixEntryIds
    );
    const summary = deterministicFastSummary({
      messages: projected.messages,
      entryRefs: projected.entryRefs,
      fixedViews: runtime.fixedViews,
      anchor: runtime.control.expectedAnchor?.content ?? renderPrimeContextAnchor({
        taskKey: runtime.taskRuntime.taskKey,
        objective: runtime.taskRuntime.objective ?? runtime.taskRuntime.taskKey,
        runtime: runtime.taskRuntime,
        snapshot: runtime.snapshot
      }).content,
      state: renderPrimeContextState(runtime.taskRuntime, runtime.snapshot).content,
      hiddenSteering: runtime.taskRuntime.steeringDeltas,
      fileOps: files,
      sourceMessages: projected.sourceMessages
    });
    if (!summary) return;
    return { summary: { summary, details: files } };
  });
  hooks.add("session_before_tree");
  pi.on("session_compact", async (_event, ctx) => {
    clearControlState(true);
    runtime.fixedViews.clear();
    reloadSelectedBranch(ctx, true);
    runtime.archive?.recordBranchRuntimeReload();
    const branch = ctx.sessionManager.getBranch();
    const allowed = visibleFixedToolCallIds(branch, runtime.taskRuntime?.fold, runtime.taskRuntime?.taskKey);
    installFixedViews(await runtime.archive?.loadFixedExchangeViews(ctx.signal).catch(() => []) ?? [], true, allowed);
  });
  hooks.add("session_compact");
  pi.on("session_tree", async (_event, ctx) => {
    clearControlState(true);
    runtime.fixedViews.clear();
    reloadSelectedBranch(ctx);
    runtime.archive?.recordBranchRuntimeReload();
    const branch = ctx.sessionManager.getBranch();
    const allowed = visibleFixedToolCallIds(branch, runtime.taskRuntime?.fold, runtime.taskRuntime?.taskKey);
    installFixedViews(await runtime.archive?.loadFixedExchangeViews(ctx.signal).catch(() => []) ?? [], true, allowed);
    await installUserBashViews(ctx);
  });
  hooks.add("session_tree");
  pi.on("tool_execution_start", (event) => {
    if (runtime.mode === "off") return;
    const exchange = runtime.exchanges.start(event);
    exchange.replayOriginKey = runtime.lifecycle.selectedModelKey;
  });
  hooks.add("tool_execution_start");
  pi.on("tool_call", (event, ctx) => {
    if (runtime.mode === "off") return;
    const branch = ctx.sessionManager.getBranch();
    runtime.branchAnchorId = branchAnchorId(branch);
    runtime.archive?.setBranchScope(runtime.taskRuntime?.taskKey, branchScopeIds(branch), [
      ...observationRefs(branch),
      ...runtime.snapshot.pinnedObservationIds
    ]);
    const toolSchema = pi.getAllTools?.().find((tool) => tool.name === event.toolName)?.parameters;
    runtime.exchanges.noteCall(event, ctx.cwd, toolSchema);
  });
  hooks.add("tool_call");
  pi.on("tool_result", async (event, ctx) => {
    if (runtime.mode === "off") return;
    try {
      const content = event.content;
      const archiveResult = shouldArchiveToolResult(event.toolName);
      const fullOutputPath2 = isBashToolResult(event) ? event.details?.fullOutputPath : void 0;
      let frozenResultPath;
      if (archiveResult && runtime.archive && typeof fullOutputPath2 === "string") {
        try {
          frozenResultPath = await runtime.archive.freezeTextSource(fullOutputPath2, ctx.signal);
        } catch {
          ctx.signal?.throwIfAborted();
        }
      }
      const resolvedText = await resolveArchiveText(
        content,
        archiveResult && runtime.archive ? frozenResultPath : fullOutputPath2,
        ctx.signal
      );
      const parts = archiveResult ? typedObservationParts(event) : [];
      const visibleResult = visibleToolResultText(content, resolvedText.large ? 64 * 1024 : Number.POSITIVE_INFINITY);
      const exchange = runtime.exchanges.noteResult(
        event,
        ctx.cwd,
        resolvedText.text,
        {
          source: resolvedText.source,
          parts: archiveResult ? parts : [],
          retainResultText: archiveResult,
          visibleResultText: visibleResult.text,
          visibleResultBytes: visibleResult.textBytes,
          visibleResultTruncated: visibleResult.truncated,
          visibleResultTail: visibleResult.tail,
          visibleResultSamples: visibleResult.samples,
          outcomeText: resolvedText.outcomeText,
          resultSummary: resolvedText,
          large: resolvedText.large
        }
      );
      exchange.frozenResultPath = frozenResultPath;
      exchange.frozenVisibleResultSource = visiblePartSource(content);
    } catch {
      return;
    }
  });
  hooks.add("tool_result");
  pi.on("turn_end", async (event, ctx) => {
    if (runtime.mode === "off") return;
    const fullBranch = ctx.sessionManager.getBranch();
    const providerBranch = providerVisibleBranchEntries(fullBranch);
    const goal = activeGoalFromBranch(fullBranch);
    const branch = scopeBranchToGoal(fullBranch, goal);
    const selection = refreshTaskContract(branch, goal, ctx.cwd);
    runtime.control.expectedAnchor = currentTaskAnchor(
      branch,
      selection,
      latestBranchUserText(providerBranch)
    );
    const persistedState = runtime.taskRuntime ? latestProviderVisibleControlMessage(
      fullBranch,
      PRIME_CONTEXT_STATE_TYPE,
      runtime.taskRuntime.taskKey
    )?.content : void 0;
    const stateBefore = persistedState ?? runtime.control.lastStateContent ?? (runtime.taskRuntime ? renderPrimeContextState(runtime.taskRuntime, runtime.snapshot).content : void 0);
    const contextUsage = ctx.getContextUsage();
    const exchanges = runtime.exchanges.finishTurn(event.message, event.toolResults);
    for (const exchange of exchanges) {
      if (!exchange.rawResult) continue;
      const finalEvent = {
        ...exchange.rawResult,
        toolName: exchange.rawResult.toolName ?? exchange.toolName,
        content: Array.isArray(exchange.rawResult.content) ? exchange.rawResult.content : [],
        isError: exchange.rawResult.isError ?? exchange.outcome?.isError ?? false
      };
      const finalContent = finalEvent.content;
      const finalTypedParts = typedObservationParts(finalEvent);
      runtime.exchanges.noteFinalDetails(exchange, finalEvent.isError, finalEvent.details);
      if (!typedObservationPartsEqual(exchange.archiveParts ?? [], finalTypedParts)) {
        exchange.persistedResultChanged = true;
        exchange.archiveParts = finalTypedParts;
      }
      const finalPath = resultFullOutputPath(exchange.rawResult.details);
      if (exchange.persistedResultChanged) exchange.archiveParts = finalTypedParts;
      const finalVisibleSource = visiblePartSource(finalContent);
      if (exchange.frozenVisibleResultSource && !await partSourcesEqual(exchange.frozenVisibleResultSource, finalVisibleSource, ctx.signal)) {
        exchange.persistedTextChanged = true;
        exchange.persistedResultChanged = true;
        exchange.persistedCanonicalResultChanged = true;
      }
      if (!shouldArchiveToolResult(exchange.toolName) || !exchange.persistedCanonicalResultChanged) continue;
      let canonicalFrozenPath;
      if (!exchange.persistedTextChanged && finalPath && runtime.archive) {
        try {
          canonicalFrozenPath = await runtime.archive.freezeTextSource(finalPath, ctx.signal);
        } catch {
          ctx.signal?.throwIfAborted();
        }
      }
      const authoritativeSource = canonicalFrozenPath ? { kind: "path", path: canonicalFrozenPath } : finalVisibleSource;
      const previousSource = exchange.resultSummary?.partSource ?? (exchange.resultSummary ? { kind: "text", text: exchange.resultSummary.text } : void 0);
      const exactUnchanged = !exchange.persistedTextChanged && !exchange.persistedPathChanged && previousSource ? await partSourcesEqual(previousSource, authoritativeSource, ctx.signal) : false;
      let resolved;
      if (exactUnchanged && exchange.resultSummary) {
        resolved = exchange.resultSummary;
        if (canonicalFrozenPath) {
          await runtime.archive?.removeFrozenTextSource(canonicalFrozenPath).catch(() => void 0);
          canonicalFrozenPath = void 0;
        }
      } else {
        resolved = await resolvedPartSource(authoritativeSource, ctx.signal);
        exchange.persistedTextChanged ||= !exactUnchanged;
        if (canonicalFrozenPath) {
          if (exchange.frozenResultPath && exchange.frozenResultPath !== canonicalFrozenPath) {
            await runtime.archive?.removeFrozenTextSource(exchange.frozenResultPath).catch(() => void 0);
          }
          exchange.frozenResultPath = canonicalFrozenPath;
        }
      }
      const canonicalPart = {
        name: "result",
        kind: "result",
        mediaType: "text/plain; charset=utf-8",
        source: resolved.partSource ?? { kind: "text", text: resolved.text }
      };
      runtime.exchanges.noteCanonicalResult(
        exchange,
        resolved,
        finalEvent.isError,
        finalEvent.details,
        [canonicalPart, ...finalTypedParts]
      );
    }
    if (runtime.archive) {
      for (const exchange of exchanges) {
        if (!shouldArchiveToolResult(exchange.toolName) || !exchange.rawResult || !exchange.resultSummary) continue;
        const content = Array.isArray(exchange.rawResult.content) ? exchange.rawResult.content : [];
        const metadata = runtime.exchanges.toObservationMetadata(exchange, {
          taskKey: runtime.taskRuntime?.taskKey,
          goalId: runtime.taskRuntime?.goalId,
          branchAnchorId: runtime.branchAnchorId,
          turnSequence: runtime.taskRuntime === void 0 ? void 0 : runtime.taskRuntime.turnSequence + 1,
          requirementsRevision: runtime.taskRuntime?.requirementsRevision,
          workspaceRevisionAtStart: runtime.taskRuntime?.workspaceRevision
        });
        if (!metadata) continue;
        const archived = await runtime.archive.archiveVisibleContent(
          content,
          exchange.toolName,
          exchange.outcome?.isError ?? false,
          adaptiveMinTextBytes(runtime.config.minTextBytes, contextUsage),
          runtime.config.capsuleMaxBytes,
          ctx.signal,
          exchange.resultSummary,
          contextUsage,
          metadata,
          exchange.archiveParts ?? []
        );
        if (archived?.observation.envelope?.resultCapsule) {
          exchange.admittedCapsule = archived.observation.envelope.resultCapsule;
        }
        if (archived) {
          const images = archived.observation.envelope ? imageRefsForEnvelope(archived.observation.envelope) : projectedImageRefs(archived.observation.id, content);
          if (images.length > 0) setPendingImages(runtime, exchange.toolCallId, images);
        }
      }
    }
    let completedArchives;
    let createdFold;
    if (!runtime.taskRuntime) {
      completedArchives = exchanges.flatMap((exchange) => {
        const metadata = runtime.exchanges.toObservationMetadata(exchange, {
          branchAnchorId: runtime.branchAnchorId
        });
        return metadata ? [{
          metadata,
          toolName: exchange.toolName,
          isError: exchange.outcome?.isError ?? false,
          source: exchange.archiveSource,
          parts: exchange.archiveParts,
          resultText: exchange.resultText,
          largeResult: exchange.largeResult,
          resultSummary: exchange.resultSummary,
          admittedCapsule: exchange.admittedCapsule,
          sourceOrder: exchange.sourceOrder,
          replayProtected: exchange.replayProtected,
          replayOriginKey: exchange.replayProtected ? exchange.replayOriginKey ?? "unknown" : void 0,
          ...exchange.persistedCall ? {
            persistedModelInput: exchange.modelInput,
            persistedRawCall: exchange.rawCall,
            persistedRawResult: exchange.rawResult,
            resultChangedAfterHook: exchange.persistedResultChanged,
            canonicalResultChangedAfterHook: exchange.persistedCanonicalResultChanged
          } : {}
        }] : [];
      });
    } else {
      if (event.toolExecution !== "parallel" && event.toolExecution !== "sequential") {
        throw new Error("Prime Context requires Prime Agent turn_end.toolExecution support.");
      }
      const reduced = reduceTurn(runtime.taskRuntime, exchanges, {
        toolExecution: event.toolExecution
      });
      runtime.taskRuntime = reduced.runtime;
      runtime.readiness = reduced.readiness;
      const currentFold = runtime.taskRuntime.fold;
      const currentFoldApplication = resolveFoldApplication(
        fullBranch,
        currentFold,
        runtime.taskRuntime.taskKey
      );
      const rawEntryIds = fullBranch.flatMap((entry) => entry.id ? [entry.id] : []);
      const exactRawOrder = rawEntryIds.length === fullBranch.length && new Set(rawEntryIds).size === rawEntryIds.length && (!currentFold || currentFoldApplication !== void 0);
      const fold = exactRawOrder ? selectFoldGeneration(
        branchProjectionEntries(providerModelBranchEntries(fullBranch)),
        runtime.fixedViews,
        contextUsage,
        currentFold,
        (generation, throughEntryId) => renderPrimeContextFold(runtime.taskRuntime, runtime.snapshot, generation, throughEntryId).content,
        {
          entryIds: rawEntryIds,
          ...currentFoldApplication ? { currentFoldMessageEntryId: currentFoldApplication.foldMessageEntryId } : {}
        }
      ) : void 0;
      if (fold) {
        if (!currentFold || fold.generation > currentFold.generation) runtime.archive?.recordFoldGeneration();
        runtime.taskRuntime = { ...runtime.taskRuntime, fold };
        createdFold = renderPrimeContextFold(
          runtime.taskRuntime,
          runtime.snapshot,
          fold.generation,
          fold.throughEntryId
        );
      }
      pi.appendEntry(RUNTIME_STATE_ENTRY_TYPE, runtime.taskRuntime);
      const revisions = new Map(reduced.exchangeRevisions.map((revision) => [revision.toolCallId, revision]));
      completedArchives = exchanges.flatMap((exchange) => {
        const revision = revisions.get(exchange.toolCallId);
        const metadata = runtime.exchanges.toObservationMetadata(exchange, {
          taskKey: reduced.runtime.taskKey,
          goalId: reduced.runtime.goalId,
          branchAnchorId: runtime.branchAnchorId,
          turnSequence: reduced.runtime.turnSequence,
          requirementsRevision: reduced.runtime.requirementsRevision,
          workspaceRevisionAtStart: revision?.workspaceRevisionAtStart,
          workspaceRevisionAtResult: revision?.workspaceRevisionAtResult
        });
        return metadata ? [{
          metadata,
          toolName: exchange.toolName,
          isError: exchange.outcome?.isError ?? false,
          source: exchange.archiveSource,
          parts: exchange.archiveParts,
          resultText: exchange.resultText,
          largeResult: exchange.largeResult,
          resultSummary: exchange.resultSummary,
          admittedCapsule: exchange.admittedCapsule,
          sourceOrder: exchange.sourceOrder,
          replayProtected: exchange.replayProtected,
          replayOriginKey: exchange.replayProtected ? exchange.replayOriginKey ?? "unknown" : void 0,
          ...exchange.persistedCall ? {
            persistedModelInput: exchange.modelInput,
            persistedRawCall: exchange.rawCall,
            persistedRawResult: exchange.rawResult,
            resultChangedAfterHook: exchange.persistedResultChanged,
            canonicalResultChangedAfterHook: exchange.persistedCanonicalResultChanged
          } : {}
        }] : [];
      });
    }
    const controlMessages = [];
    if (runtime.control.needsAnchorRefresh && runtime.control.expectedAnchor) {
      controlMessages.push(persistentControlMessage(PRIME_CONTEXT_ANCHOR_TYPE, runtime.control.expectedAnchor));
    }
    if (runtime.taskRuntime) {
      const stateAfter = renderPrimeContextState(runtime.taskRuntime, runtime.snapshot);
      if (stateAfter.content !== stateBefore) {
        controlMessages.push(persistentControlMessage(PRIME_CONTEXT_STATE_TYPE, stateAfter));
        runtime.control.lastStateContent = stateAfter.content;
      }
      if (createdFold) controlMessages.push(persistentControlMessage(PRIME_CONTEXT_FOLD_TYPE, createdFold));
    }
    if (runtime.archive && completedArchives.length > 0) {
      try {
        await runtime.archive.finalizeExchanges(completedArchives, ctx.signal, {
          budgetBytes: fixedExchangeBudgetBytes(contextUsage),
          capsuleMaxBytes: runtime.config.capsuleMaxBytes
        });
        const ids = completedArchives.map((completed) => completed.metadata.exchangeId);
        for (const completed of completedArchives) {
          const record4 = await runtime.archive.findObservation(completed.metadata.exchangeId, ctx.signal, true);
          const images = record4.envelope ? imageRefsForEnvelope(record4.envelope) : [];
          const toolCallId = completed.metadata.toolCallId;
          if (toolCallId && images.length > 0) setPendingImages(runtime, toolCallId, images);
          else if (toolCallId) clearPendingImages(runtime, toolCallId);
        }
        installFixedViews(await runtime.archive.loadFixedExchangeViews(ctx.signal, ids));
      } catch {
      }
    }
    if (runtime.archive) {
      for (const exchange of exchanges) {
        if (!exchange.frozenResultPath) continue;
        await runtime.archive.removeFrozenTextSource(exchange.frozenResultPath).catch(() => void 0);
        exchange.frozenResultPath = void 0;
      }
    }
    for (const [toolCallId, images] of runtime.pendingImages) {
      if (!runtime.fixedViews.get(toolCallId)?.images?.length || !images.every((image) => runtime.consumedImageRefs.has(image.ref) || !PROVIDER_IMAGE_MIME_TYPES2.has(image.mimeType.toLowerCase()))) continue;
      clearPendingImages(runtime, toolCallId);
    }
    return controlMessages.length > 0 ? { messages: controlMessages } : void 0;
  });
  hooks.add("turn_end");
  pi.on("model_context", (event, ctx) => {
    if (runtime.mode === "off") return;
    const purpose = event.purpose;
    const selectedBranch = ctx.sessionManager.getBranch();
    let temporaryAnchorText;
    if (purpose === "provider") {
      const providerBranch = providerVisibleBranchEntries(selectedBranch);
      const goal = activeGoalFromBranch(selectedBranch);
      const branch = scopeBranchToGoal(selectedBranch, goal);
      const selection = refreshTaskContract(branch, goal, ctx.cwd);
      const anchor = currentTaskAnchor(
        branch,
        selection,
        latestBranchUserText(providerBranch)
      );
      runtime.control.expectedAnchor = anchor;
      const unscoped = anchor && selection?.source === "user" && selection.rootUserEntryId ? { content: anchor.content, afterEntryId: selection.rootUserEntryId } : void 0;
      const persisted = anchor ? latestProviderVisibleControlMessage(
        selectedBranch,
        PRIME_CONTEXT_ANCHOR_TYPE,
        anchor.details.taskKey,
        unscoped
      ) : void 0;
      const positionallyScopedUnscoped = unscoped !== void 0 && persisted?.details?.taskKey === void 0;
      if (!anchor || sameAnchor(persisted, anchor, positionallyScopedUnscoped)) {
        runtime.control.structuralBoundary = false;
        runtime.control.needsAnchorRefresh = false;
      } else if (runtime.control.structuralBoundary || runtime.control.needsAnchorRefresh) {
        runtime.control.structuralBoundary = false;
        runtime.control.needsAnchorRefresh = true;
        temporaryAnchorText = anchor.content;
      }
      runtime.archive?.noteContextTurn(goal !== void 0);
    }
    const refs = event.entryRefs;
    const foldApplication = resolveFoldApplication(
      selectedBranch,
      runtime.taskRuntime?.fold,
      runtime.taskRuntime?.taskKey
    );
    const projected = projectModelContext({
      purpose,
      messages: event.messages,
      entryRefs: refs,
      fixedViews: runtime.fixedViews,
      fold: runtime.taskRuntime?.fold,
      foldMessageEntryId: foldApplication?.foldMessageEntryId,
      foldPrefixEntryIds: foldApplication?.prefixEntryIds,
      sourceMessages: branchSourceMessages(selectedBranch),
      recoveryLeases: runtime.recoveryLeases,
      pendingImages: runtime.pendingImages,
      consumedImageRefs: runtime.consumedImageRefs,
      activeModelKey: runtime.lifecycle.selectedModelKey
    });
    if (purpose === "provider") {
      for (const id of projected.shownRecoveryToolCallIds ?? []) runtime.projectedRecoveryToolCallIds.add(id);
      for (const message of projected.messages) {
        if (message.role === "toolResult" && typeof message.toolCallId === "string" && runtime.recoveryUtilities.has(message.toolCallId)) {
          runtime.projectedRecoveryToolCallIds.add(message.toolCallId);
        }
      }
      for (const ref of projected.shownImageRefs ?? []) runtime.projectedImageRefs.add(ref);
    }
    const messages = temporaryAnchorText ? appendProviderTextMessage(projected.messages, temporaryAnchorText) : projected.messages;
    for (const ref of projected.entryRefs ?? []) {
      const message = messages[ref.messageIndex];
      if (message && typeof message === "object") runtime.projectedRefs.set(message, ref.entryId);
    }
    if (purpose === "provider") {
      const effectiveRefs = projected.entryRefs ?? refs ?? [];
      const previous = runtime.lastProviderProjection;
      const foldGeneration = runtime.taskRuntime?.fold?.generation ?? 0;
      const extendedStableGeneration = Boolean(
        previous && previous.foldGeneration === foldGeneration && effectiveRefs.length > previous.entryCount && previous.entryCount > 0 && effectiveRefs[previous.entryCount - 1]?.entryId === previous.lastEntryId
      );
      runtime.archive?.recordProviderProjection(
        utf8Bytes(JSON.stringify(messages)),
        extendedStableGeneration
      );
      runtime.lastProviderProjection = {
        entryCount: effectiveRefs.length,
        ...effectiveRefs.at(-1)?.entryId ? { lastEntryId: effectiveRefs.at(-1).entryId } : {},
        foldGeneration
      };
    }
    const messagesChanged = messages !== event.messages;
    const refsChanged = projected.entryRefs !== void 0 && (refs === void 0 || projected.entryRefs.length !== refs.length || projected.entryRefs.some((ref, index) => ref.messageIndex !== refs[index]?.messageIndex || ref.entryId !== refs[index]?.entryId));
    if (!messagesChanged && !refsChanged) return;
    return {
      messages,
      ...projected.entryRefs === void 0 ? {} : { entryRefs: projected.entryRefs }
    };
  });
  hooks.add("model_context");
  pi.on("message_end", async (event, ctx) => {
    if (runtime.mode === "off" || event.message.role !== "assistant") return;
    runtime.archive?.recordUsage(event.message.usage ?? {});
    const successful = event.message.stopReason !== "error" && event.message.stopReason !== "aborted";
    if (successful) {
      for (const id of runtime.projectedRecoveryToolCallIds) {
        const utility = runtime.recoveryUtilities.get(id);
        if (utility) {
          runtime.archive?.recordRecovery(
            utility.useful,
            utility.subjectKeys,
            utility.exposedBytes,
            utility.inspectRecallHit
          );
          runtime.recoveryUtilities.delete(id);
        }
        runtime.recoveryLeases.delete(id);
      }
      const imageBytes = /* @__PURE__ */ new Map();
      for (const view of runtime.fixedViews.values()) {
        for (const image of view.images ?? []) imageBytes.set(image.ref, image.bytes);
      }
      for (const images of runtime.pendingImages.values()) {
        for (const image of images) imageBytes.set(image.ref, image.bytes);
      }
      let projectedMediaBytes = 0;
      for (const ref of runtime.projectedImageRefs) {
        if (!runtime.consumedImageRefs.has(ref)) projectedMediaBytes += imageBytes.get(ref) ?? 0;
        runtime.consumedImageRefs.add(ref);
      }
      if (projectedMediaBytes > 0) runtime.archive?.recordTypedMediaProjection(projectedMediaBytes);
      while (runtime.consumedImageRefs.size > CONSUMED_IMAGE_REF_MAX) {
        const oldest = runtime.consumedImageRefs.values().next().value;
        if (!oldest) break;
        runtime.consumedImageRefs.delete(oldest);
      }
    }
    runtime.projectedRecoveryToolCallIds.clear();
    runtime.projectedImageRefs.clear();
    if (runtime.archive) await runtime.archive.flushSessionState(ctx.signal).catch(() => void 0);
  });
  hooks.add("message_end");
  const actions = {
    getMode: () => runtime.mode,
    setMode: (mode) => {
      runtime.mode = mode;
    },
    getArchive: () => runtime.archive,
    getSnapshot: () => runtime.snapshot,
    getTaskRuntime: () => runtime.taskRuntime,
    getReadiness: () => runtime.readiness,
    updateSnapshot: (changes) => {
      const result = applySnapshotChanges(runtime.snapshot, changes);
      if (result.ok && result.changed) {
        pi.appendEntry(SNAPSHOT_ENTRY_TYPE, result.snapshot);
        runtime.snapshot = result.snapshot;
      }
      return result;
    },
    getReadMaxBytes: () => runtime.config.readMaxBytes,
    consumeConfigWarnings: () => runtime.configWarnings.splice(0),
    hooksLoaded: () => requiredHooksLoaded(hooks),
    clearFixedViews: () => runtime.fixedViews.clear(),
    registerRecoveryLease,
    registerRecoveryUtility,
    resolveRecallSources: async (scope, signal) => {
      signal?.throwIfAborted();
      const recall = runtime.sessionRecall;
      if (scope === "parent") return recall?.parent ? [recall.parent] : [];
      if (scope !== "project" || !recall?.projectSessionDir) return [];
      const infos = await SessionManager.list(recall.normalizedCwd, recall.projectSessionDir);
      signal?.throwIfAborted();
      return infos.flatMap((info) => {
        if (info.id === recall.currentSessionId || cwdKey(info.cwd) !== recall.cwdKey) return [];
        return [{
          archive: new ObservationArchive(recall.archiveRoot, info.id),
          scope: "project",
          sessionId: info.id,
          sessionDate: info.created.toISOString()
        }];
      });
    }
  };
  registerPrimeContextTool(pi, actions);
  registerPrimeContextCommands(pi, actions);
}
export {
  REQUIRED_HOOKS,
  branchProjectionEntries,
  completeVisibleToolCallIds,
  primeContext as default,
  foldVisibleBranchEntries,
  providerModelBranchEntries,
  requiredHooksLoaded,
  scopeFixedExchangeViews,
  selectForkImportRefs,
  selectForkVisibleImports,
  shouldArchiveToolResult,
  typedObservationParts,
  typedObservationPartsEqual,
  visibleFixedToolCallIds
};
