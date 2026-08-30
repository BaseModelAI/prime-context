import { createReadStream, createWriteStream } from "node:fs";
import { rename, rm } from "node:fs/promises";
import { once } from "node:events";
import { PassThrough } from "node:stream";
import { pipeline } from "node:stream/promises";
import { StringDecoder } from "node:string_decoder";
import { createGzip } from "node:zlib";

export const LARGE_TEXT_BYTES = 1024 * 1024;
export const TEXT_CHUNK_BYTES = 256 * 1024;
const SOURCE_READ_BYTES = 64 * 1024;
const KEPT_LINE_BYTES = 2048;

export type PartSource =
  | { kind: "text"; text: string }
  | { kind: "path"; path: string }
  | { kind: "bytes"; bytes: Uint8Array };

export type StreamPartSource = PartSource | { kind: "texts"; texts: () => Iterable<string> };

export interface SourceLineRecord {
  lineNumber: number;
  text: string;
}

export interface TextSourceSummary {
  source: StreamPartSource;
  textBytes: number;
  lineCount: number;
  large: boolean;
  sourceRecords: SourceLineRecord[];
  traceShapeCount: number;
  traceShapeOverflow: number;
  traceLineCount: number;
  nonEmptyLineCount: number;
  summaryLines: string[];
  exactText?: string;
  capsuleText: string;
  outcomeText: string;
  representativeLines: string[];
  head: string[];
  tail: string[];
}

export interface WrittenTextChunk {
  relativeFile: string;
  firstLine: number;
  lineCount: number;
  textBytes: number;
}

function safeTextSlices(text: string): Iterable<Buffer> {
  return {
    *[Symbol.iterator]() {
      let offset = 0;
      while (offset < text.length) {
        let end = Math.min(text.length, offset + SOURCE_READ_BYTES);
        if (end < text.length) {
          const code = text.charCodeAt(end - 1);
          if (code >= 0xd800 && code <= 0xdbff) end -= 1;
        }
        yield Buffer.from(text.slice(offset, end), "utf8");
        offset = end;
      }
    },
  };
}

export async function* sourceBytes(source: StreamPartSource, signal?: AbortSignal): AsyncGenerator<Buffer> {
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
      if (finalCode >= 0xd800 && finalCode <= 0xdbff) {
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
      yield Buffer.from(source.bytes.buffer, source.bytes.byteOffset + offset,
        Math.min(SOURCE_READ_BYTES, source.bytes.byteLength - offset));
    }
    return;
  }
  for (const value of safeTextSlices(source.text)) {
    signal?.throwIfAborted();
    yield value;
  }
}

function truncateLine(value: string): string {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.byteLength <= KEPT_LINE_BYTES) return value;
  let end = KEPT_LINE_BYTES - 3;
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end -= 1;
  return `${bytes.subarray(0, end).toString("utf8")}...`;
}

function lineShape(value: string): string {
  return value.trim().toLowerCase()
    .replaceAll(/\b(?:0x[0-9a-f]+|\d+(?:\.\d+)?|[0-9a-f]{8,}(?:-[0-9a-f-]{4,})*)\b/gi, "#")
    .slice(0, 160);
}

const TEST_SUMMARY_LINE = /TEST_RESULT|\b\d+\s+(?:passed|failed|skipped|xfailed|xpassed|deselected|warnings?)\b|\bTests run:\s*\d+,\s*Failures:|\b\d+\s+tests? completed\b|^\s*Ran\s+\d+\s+tests?(?:\s+in\b.*)?$|^\s*(?:Tests?:|Test Suites?:|Test Files|test result:)\s+.+$|^\s*(?:Found\s+\d+\s+errors?|Finished\s+(?:dev|test|release)\b|ok\s+\S+|FAIL\s+\S+|(?:\[[A-Z]+\]\s*)?build\s+(?:success(?:ful)?|fail(?:ed|ure)))\b.*$|^\s*(?:ok|failed\s*\([^)]*\))\s*$/i;
const FAILING_TEST_LINE = /^\s*(?:FAIL(?:ED)?\s+\S+|(?:FAIL|ERROR):\s+\S+|---\s+FAIL:\s+\S+|test\s+.+?\s+\.\.\.\s+FAILED|.+?\s+>\s+.+?\s+FAILED|●\s+\S+|(?:\[ERROR\]\s*)?\S+\s+--.+<<<\s+(?:FAILURE|ERROR)!)/i;
const EXCEPTION_LINE = /(?:Error|Exception)(?::|\s*$)/;
const SOURCE_LOCATION_LINE = /File "[^"]+", line \d+|[A-Za-z0-9_./-]+\.(?:py|ts|tsx|js|mjs|cjs|java|rs|go):\d+|[^\s]+\.(?:ts|tsx)\(\d+,\d+\)|-->\s+[^\s]+\.rs:\d+:\d+|[^\s]+\.java:\[\d+,\d+\]|^\s*[A-Za-z0-9_./\-]+\.(?:js|jsx|ts|tsx|mjs|cjs)\s*$/;
const COMMAND_STATUS_LINE = /(?:returned non-zero exit status|exit(?: code| status)?[:= ]+|^\s*(?:exit|rc|status)\s*[:=]?)\s*-?\d+/i;
const COMMAND_FAILURE_LINE = /^(?:\[[A-Z]+\]\s*)?(?:fatal:|error(?:\[[A-Z0-9]+\])?:|failed:)|\bcommand\b.*\bfailed\b|\bBUILD (?:FAILURE|FAILED)\b/i;
const DECISIVE_LINE = /\b(?:error|exception|traceback|assertion|failed|failure|fatal)\b/i;
const TRACE_LINE = /^\s*(?:trace|debug|progress)\b/i;

export async function summarizePartSource(source: StreamPartSource, signal?: AbortSignal): Promise<TextSourceSummary> {
  const decoder = new StringDecoder("utf8");
  const exact: string[] = [];
  const head: SourceLineRecord[] = [];
  const tail: SourceLineRecord[] = [];
  const signalSlots = {
    testSummaries: [] as SourceLineRecord[],
    failingTests: [] as SourceLineRecord[],
    exceptions: [] as SourceLineRecord[],
    sourceLocations: [] as SourceLineRecord[],
    commandStatuses: [] as SourceLineRecord[],
    commandFailures: [] as SourceLineRecord[],
    decisive: [] as SourceLineRecord[],
  };
  const shapes = new Map<string, number>();
  let traceShapeOverflow = 0;
  let traceLineCount = 0;
  let nonEmptyLineCount = 0;
  let textBytes = 0;
  let lineNumber = 1;
  let sawText = false;
  let linePrefix = "";
  let lineSuffix = "";
  let lineChars = 0;

  const consumeLineText = (value: string): void => {
    lineChars += value.length;
    if (linePrefix.length < KEPT_LINE_BYTES) linePrefix += value.slice(0, KEPT_LINE_BYTES - linePrefix.length);
    lineSuffix = (lineSuffix + value).slice(-KEPT_LINE_BYTES);
  };
  const keepSignal = (slot: SourceLineRecord[], record: SourceLineRecord, limit: number): void => {
    if (slot.some((value) => value.lineNumber === record.lineNumber)) return;
    if (slot.length < limit) {
      slot.push(record);
      return;
    }
    slot.splice(Math.floor(limit / 2), 1);
    slot.push(record);
  };
  const finishLine = (): void => {
    const raw = lineChars <= KEPT_LINE_BYTES
      ? linePrefix
      : `${truncateLine(linePrefix)} ... ${truncateLine(lineSuffix)}`;
    const record = { lineNumber, text: raw };
    if (raw.trim().length > 0) nonEmptyLineCount += 1;
    if (head.length < 20) head.push(record);
    tail.push(record);
    if (tail.length > 40) tail.shift();
    if (TEST_SUMMARY_LINE.test(raw)) keepSignal(signalSlots.testSummaries, record, 16);
    if (FAILING_TEST_LINE.test(raw)) keepSignal(signalSlots.failingTests, record, 24);
    if (EXCEPTION_LINE.test(raw)) keepSignal(signalSlots.exceptions, record, 12);
    if (SOURCE_LOCATION_LINE.test(raw)) keepSignal(signalSlots.sourceLocations, record, 12);
    if (COMMAND_STATUS_LINE.test(raw)) keepSignal(signalSlots.commandStatuses, record, 8);
    if (COMMAND_FAILURE_LINE.test(raw)) keepSignal(signalSlots.commandFailures, record, 12);
    if (DECISIVE_LINE.test(raw)) keepSignal(signalSlots.decisive, record, 16);
    if (TRACE_LINE.test(raw)) {
      traceLineCount += 1;
      const shape = lineShape(raw);
      if (shape) {
        const count = shapes.get(shape);
        if (count !== undefined) shapes.set(shape, count + 1);
        else if (shapes.size < 64) shapes.set(shape, 1);
        else traceShapeOverflow += 1;
      }
    }
    lineNumber += 1;
    linePrefix = "";
    lineSuffix = "";
    lineChars = 0;
  };
  const consumeDecoded = (value: string): void => {
    if (!value) return;
    let offset = 0;
    for (;;) {
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
  let exactText: string | undefined;
  if (textBytes <= LARGE_TEXT_BYTES) {
    const raw = Buffer.concat(exact.map((value) => Buffer.from(value, "binary")), textBytes);
    exactText = raw.toString("utf8");
  }
  if (exactText !== undefined) {
    return {
      source, textBytes, lineCount, large: false, exactText,
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
      tail: exactText.split("\n").slice(-40),
    };
  }

  const signals = [
    ...signalSlots.testSummaries,
    ...signalSlots.failingTests,
    ...signalSlots.exceptions,
    ...signalSlots.sourceLocations,
    ...signalSlots.commandStatuses,
    ...signalSlots.commandFailures,
    ...signalSlots.decisive,
  ];
  const outcomeSignals = signals.map((record) => record.text);
  const numbered = new Map<number, string>();
  for (const record of [...head, ...signals, ...tail]) numbered.set(record.lineNumber, record.text);
  const sourceRecords = [...numbered]
    .sort(([left], [right]) => left - right)
    .map(([lineNumber, text]) => ({ lineNumber, text }));
  const summaryLines = sourceRecords.map((record) => record.text);
  const traceShapes = [...shapes]
    .filter(([, count]) => count > 1)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([shape, count]) => `Trace shape x${count}: ${shape}`);
  const boundedSummaryLines = [
    ...traceShapes,
    ...(traceShapeOverflow > 0
      ? [`Additional trace lines with untracked shapes: ${traceShapeOverflow}.`]
      : []),
  ];
  const capsuleText = [
    ...summaryLines,
    `Large output summary: ${textBytes} UTF-8 bytes, ${lineCount} lines.`,
    ...boundedSummaryLines,
  ].join("\n");
  const representativeLines = [...head, ...tail]
    .map((record) => record.text)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 64);
  return {
    source, textBytes, lineCount, large: true,
    sourceRecords,
    traceShapeCount: shapes.size,
    traceShapeOverflow,
    traceLineCount,
    nonEmptyLineCount,
    summaryLines: boundedSummaryLines,
    capsuleText,
    outcomeText: [...outcomeSignals, ...head.map((record) => record.text), ...tail.map((record) => record.text)].join("\n"),
    representativeLines,
    head: head.map((record) => record.text),
    tail: tail.map((record) => record.text),
  };
}

interface ActiveChunk {
  relativeFile: string;
  finalPath: string;
  temporaryPath: string;
  input: PassThrough;
  completed: Promise<void>;
  textBytes: number;
  lineCount: number;
}

export async function writeTextChunks(
  source: StreamPartSource,
  sessionPath: string,
  relativePrefix: string,
  signal?: AbortSignal,
): Promise<WrittenTextChunk[]> {
  const chunks: WrittenTextChunk[] = [];
  const published: string[] = [];
  const staged: string[] = [];
  let active: ActiveChunk | undefined;
  let nextFirstLine = 1;
  let chunkNumber = 0;
  let pendingLine: Buffer[] = [];
  let pendingBytes = 0;
  let oversized = false;
  let totalBytes = 0;
  let finalByte: number | undefined;

  const openChunk = (): ActiveChunk => {
    chunkNumber += 1;
    const relativeFile = `${relativePrefix}.${String(chunkNumber).padStart(4, "0")}.txt.gz`;
    const finalPath = `${sessionPath}/${relativeFile}`;
    const temporaryPath = `${finalPath}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
    staged.push(temporaryPath);
    const input = new PassThrough();
    const completed = pipeline(input, createGzip(), createWriteStream(temporaryPath, { signal }));
    return { relativeFile, finalPath, temporaryPath, input, completed, textBytes: 0, lineCount: 0 };
  };
  const writeActive = async (bytes: Buffer): Promise<void> => {
    if (bytes.byteLength === 0) return;
    active ??= openChunk();
    active.textBytes += bytes.byteLength;
    totalBytes += bytes.byteLength;
    finalByte = bytes[bytes.byteLength - 1];
    if (!active.input.write(bytes)) await once(active.input, "drain");
  };
  const finishChunk = async (): Promise<void> => {
    if (!active) return;
    const current = active;
    active = undefined;
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
      textBytes: current.textBytes,
    });
    nextFirstLine += current.lineCount;
  };
  const flushPending = async (): Promise<void> => {
    for (const value of pendingLine) await writeActive(value);
    pendingLine = [];
    pendingBytes = 0;
  };
  const consumeSegment = async (segment: Buffer, endsLine: boolean): Promise<void> => {
    if (oversized) {
      await writeActive(segment);
      if (endsLine) {
        active!.lineCount += 1;
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
    active!.lineCount += 1;
    if (active!.textBytes >= TEXT_CHUNK_BYTES) await finishChunk();
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
      await active.completed.catch(() => undefined);
      await rm(active.temporaryPath, { force: true }).catch(() => undefined);
    }
    await Promise.all([...staged, ...published].map((path) => rm(path, { force: true }).catch(() => undefined)));
    throw error;
  }
}
