import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import type { ToolResultEvent } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it } from "vitest";
import { ObservationArchive, resolveArchiveText } from "../src/archive.js";
import { ObservationBroker } from "../src/broker.js";
import { summarizePartSource } from "../src/envelope.js";
import { boundedResultTextStats } from "../src/exchange.js";
import { typedObservationParts } from "../src/index.js";
import { adaptToolIntent } from "../src/intent.js";
import {
  adaptiveCapsuleMaxBytes,
  adaptiveMinTextBytes,
  analyzeOutcome,
  hasTerminalOutcome,
  isRepetitiveOutput,
  renderBoundedCapsule,
  renderCapsule,
  selectCapsuleLines,
  utf8Bytes,
} from "../src/capsule.js";

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("observation archive", () => {
  it("archives a large multiline result, returns one capsule, and preserves exact text", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-archive-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "session-happy");
    const original = Array.from({ length: 180 }, (_, index) => `line ${index + 1}${index === 80 ? " ERROR decisive" : ""}`).join("\n");

    const archived = await archive.archiveVisibleContent(
      [{ type: "text", text: original }],
      "ipython",
      false,
      100,
      1024,
      undefined,
      undefined,
      undefined,
      {
        exchangeId: "o1",
        toolCallId: "call-1",
        intentKind: "edit",
        subjectKey: "/repo/src/main.ts",
        resources: ["/repo/src/main.ts"],
        mutatesWorkspace: true,
        facts: { editCount: 1, firstChangedLine: 8, diffBytes: 42 },
        modelInputBytes: 12,
        executedInputBytes: 12,
        suite: { family: "pytest", target: "tests/", scope: "broad" as const },
        workspaceRevisionAtResult: 4,
        outcome: {
          ...analyzeOutcome(original, false),
          status: "failure" as const,
          failingTests: ["tests/test_api.py::typed_failure"],
          signature: "failure|tests/test_api.py::typed_failure",
        },
      },
    );

    expect(archived).not.toBeNull();
    expect(archived?.content).toHaveLength(1);
    expect(archived?.content[0]).toMatchObject({ type: "text" });
    expect((archived?.content[0] as { text: string }).text).toContain("<prime_context_output");
    expect((archived?.content[0] as { text: string }).text).toContain("Failing test: tests/test_api.py::typed_failure");
    expect((archived?.content[0] as { text: string }).text).toContain("Suite: pytest:tests/ [broad].");
    expect((archived?.content[0] as { text: string }).text).toContain("Workspace at execution: w4.");
    expect((archived?.content[0] as { text: string }).text).toContain("Resource: /repo/src/main.ts.");
    expect((archived?.content[0] as { text: string }).text).toContain("Diff: o1:diff (42 bytes).");
    expect(utf8Bytes((archived?.content[0] as { text: string }).text)).toBeLessThanOrEqual(1024);
    expect(await archive.readExactText(archived!.observation.id)).toBe(original);
    expect(archive.brokerStatistics().metrics.sourceBytesArchived).toBe(Buffer.byteLength(original));
    const reopened = new ObservationArchive(root, "session-happy");
    await reopened.count();
    expect(reopened.brokerStatistics().metrics.sourceBytesArchived).toBe(Buffer.byteLength(original));
    expect(archived?.observation.exchange).toMatchObject({
      exchangeId: "o1",
      toolCallId: "call-1",
      subjectKey: "/repo/src/main.ts",
    });
  });

  it("ranks fixed part text and recovers explicit parent/project sources with origin identity", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-recall-scopes-"));
    temporaryPaths.push(root);
    const ranked = new ObservationArchive(root, "ranked-session");
    const metadata = (exchangeId: string, subjectKey: string) => ({
      exchangeId,
      toolCallId: `call-${exchangeId}`,
      intentKind: "read" as const,
      subjectKey,
      resources: [],
      mutatesWorkspace: false,
      modelInputBytes: 1,
      executedInputBytes: 1,
      taskKey: "task-current",
      requirementsRevision: 3,
      workspaceRevisionAtResult: 7,
      outcome: analyzeOutcome("ok", false),
    });
    await ranked.archiveVisibleContent(
      [{ type: "text", text: "older exact rare body needle" }],
      "Read", false, 1, 1024, undefined, undefined, undefined,
      metadata("o1", "path:older"),
    );
    await ranked.archiveVisibleContent(
      [{ type: "text", text: "newer unrelated body" }],
      "Read", false, 1, 1024, undefined, undefined, undefined,
      metadata("o2", "prefix rare body needle suffix"),
    );
    const rankedRecall = await ranked.recall({ query: "rare body needle", scope: "task" });
    expect(rankedRecall.matches[0]).toMatchObject({ ref: "o1:result" });
    expect(rankedRecall.content[0]).toMatchObject({ type: "text", text: expect.stringContaining("older exact rare body needle") });

    const current = new ObservationArchive(root, "child-session");
    const parentDate = "2026-08-29T10:00:00.000Z";
    const parentRecall = await current.recall(
      { query: "rare body needle", scope: "parent" },
      12 * 1024,
      { taskKey: "task-current", requirementsRevision: 3, workspaceRevision: 7 },
      undefined,
      [{ archive: ranked, scope: "parent", sessionId: "ranked-session", sessionDate: parentDate }],
    );
    expect(parentRecall.matches[0]).toMatchObject({
      ref: "o1:result", scope: "parent", sessionId: "ranked-session", sessionDate: parentDate,
      currentWorkspace: true, currentRequirements: true,
    });
    expect(parentRecall.content[0]).toMatchObject({
      type: "text", text: expect.stringContaining("session=ranked-session"),
    });
    expect((await current.recall(
      { query: "rare body needle", scope: "project" }, 12 * 1024, undefined, undefined,
      [{ archive: ranked, scope: "parent", sessionId: "ranked-session", sessionDate: parentDate }],
    )).matches).toEqual([]);

    const other = new ObservationArchive(root, "other-session");
    await other.archiveVisibleContent(
      [{ type: "text", text: "other session o1 body" }],
      "Read", false, 1, 1024, undefined, undefined, undefined,
      metadata("o1", "path:other"),
    );
    const qualified = await current.recall(
      { id: "ranked-session:o1:result", scope: "project" }, 12 * 1024, undefined, undefined,
      [
        { archive: ranked, scope: "project", sessionId: "ranked-session", sessionDate: parentDate },
        { archive: other, scope: "project", sessionId: "other-session", sessionDate: "2026-08-30T10:00:00.000Z" },
      ],
    );
    expect(qualified.matches).toHaveLength(1);
    expect(qualified.matches[0]).toMatchObject({ ref: "o1:result", sessionId: "ranked-session" });
    expect(qualified.content[0]).toMatchObject({
      type: "text", text: expect.stringContaining("older exact rare body needle"),
    });
  });

  it("stores one multipart v2 envelope and finalizes refs in source order", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-v2-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "session-v2");
    const persistedInput = { code: `print(1)\n${"x".repeat(25_000)}` };
    const resultText = Array.from({ length: 80 }, (_, index) => `result ${index}`).join("\n");
    const ipythonEvent = {
      type: "tool_result",
      toolCallId: "call-1",
      toolName: "ipython",
      input: persistedInput,
      content: [
        { type: "text", text: resultText },
        {
          type: "image",
          mimeType: "image/png",
          data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        },
      ],
      isError: true,
      details: {
        status: "error",
        stdout: "typed stdout",
        stderr: "typed stderr",
        result: "typed result",
        diffs: [{ path: "module.py", oldStr: "old", newStr: "new", startLine: 7 }],
        attachments: [{
          mimeType: "application/octet-stream",
          data: Buffer.from("attachment bytes").toString("base64"),
          path: "artifact.bin",
        }, {
          mimeType: "image/png",
          data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          path: "attachment.png",
        }],
        error: {
          ename: "ValueError",
          evalue: "bad value",
          traceback: ["Traceback line", "ValueError: bad value"],
        },
      },
    } satisfies ToolResultEvent;
    const parts = typedObservationParts(ipythonEvent);
    const metadata = {
      exchangeId: "o1",
      toolCallId: "call-1",
      intentKind: "run" as const,
      subjectKey: "ipython:run",
      resources: [],
      mutatesWorkspace: false,
      modelInputBytes: 12,
      executedInputBytes: 12,
      outcome: analyzeOutcome(resultText, true),
      taskKey: "task",
      branchAnchorId: "call-1",
    };
    const finalMetadata = {
      ...metadata,
      modelInputBytes: Buffer.byteLength(JSON.stringify(persistedInput)),
      executedInputBytes: 24,
      turnSequence: 3,
      requirementsRevision: 2,
      workspaceRevisionAtStart: 4,
      workspaceRevisionAtResult: 5,
      suite: { family: "pytest", target: "tests/", scope: "broad" as const },
    };
    const largeObject = Object.fromEntries(
      Array.from({ length: 1_200 }, (_, index) => [`field_${1_199 - index}`, `value-${index}-${"z".repeat(16)}`]),
    );
    const largeCustomInput = { label: "small", payload: largeObject };

    await archive.finalizeExchanges([{
      metadata: {
        ...finalMetadata,
        exchangeId: "o2",
        toolCallId: "call-2",
        taskKey: undefined,
        branchAnchorId: "call-2",
        modelInputBytes: Buffer.byteLength(JSON.stringify(largeCustomInput)),
      },
      toolName: "custom",
      isError: false,
      persistedModelInput: largeCustomInput,
    }]);
    const archived = await archive.archiveVisibleContent(
      ipythonEvent.content, "ipython", true, 1, 1024,
      undefined, undefined, undefined, metadata, parts,
    );
    await archive.finalizeExchanges([{
      metadata: finalMetadata,
      toolName: "ipython",
      isError: true,
      source: "visible-tool-result",
      parts,
      persistedModelInput: persistedInput,
    }]);

    expect((archived?.content[0] as { text: string }).text).toContain('id="o1:result"');
    expect(await archive.readExactText("o1")).toBe(resultText);
    await expect(archive.readExactText("o1:stdout")).rejects.toThrow("Unknown observation ID");
    expect(await archive.searchRecent("typed stdout")).toContain('No matches for "typed stdout"');
    expect(await archive.searchRecent("result 1")).toContain("Observation o1");

    const listed = await archive.list();
    expect(listed.map((entry) => entry.id)).toEqual(["o2", "o1"]);
    expect(listed[0].partRefs).toEqual(["o2:call#/payload"]);
    expect(listed[0].exchange?.taskKey).toBe("session");
    expect(listed[1].partRefs).toEqual([
      "o1:result", "o1:stdout", "o1:stderr", "o1:result-value", "o1:traceback", "o1:error",
      "o1:diff", "o1:attachment:1", "o1:attachment:2", "o1:image:1", "o1:call#/code",
    ]);
    expect(listed[1].exchange).toMatchObject({
      modelInputBytes: finalMetadata.modelInputBytes,
      executedInputBytes: 24,
      turnSequence: 3,
      requirementsRevision: 2,
      workspaceRevisionAtStart: 4,
      workspaceRevisionAtResult: 5,
    });
    expect(listed[1].exchange?.modelInputBytes).not.toBe(metadata.modelInputBytes);

    await expect(readFile(archive.indexPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    const session = JSON.parse(await readFile(join(archive.sessionPath, "session.json"), "utf8"));
    expect(session).toMatchObject({ nextSequence: 3, observationCount: 2 });
    const sidecar = JSON.parse(await readFile(join(archive.observationsPath, "o1.meta.json"), "utf8"));
    expect(sidecar).toMatchObject({
      schema: "prime-context.exchange/v2",
      id: "o1",
      modelInputBytes: finalMetadata.modelInputBytes,
      resultCapsule: expect.stringContaining("o1:result"),
    });
    expect(sidecar.parts.filter((part: { textBytes?: number }) => part.textBytes !== undefined)
      .map((part: { chunks: Array<{ relativeFile: string }> }) => part.chunks[0].relativeFile)).toEqual([
        join("observations", "o1.result.0001.txt.gz"),
        join("observations", "o1.stdout.0001.txt.gz"),
        join("observations", "o1.stderr.0001.txt.gz"),
        join("observations", "o1.result-value.0001.txt.gz"),
        join("observations", "o1.traceback.0001.txt.gz"),
        join("observations", "o1.error.0001.txt.gz"),
        join("observations", "o1.diff.0001.txt.gz"),
        join("observations", "o1.call-field-1.0001.txt.gz"),
      ]);
    expect(sidecar.parts.filter((part: { binaryBytes?: number }) => part.binaryBytes !== undefined)
      .map((part: { chunks: Array<{ relativeFile: string }> }) => part.chunks[0].relativeFile)).toEqual([
        join("observations", "o1.attachment-1.bin"),
        join("observations", "o1.attachment-2.bin"),
        join("observations", "o1.image-1.bin"),
      ]);
    const storedText = async (part: { chunks: Array<{ relativeFile: string }> }) =>
      gunzipSync(await readFile(join(archive.sessionPath, part.chunks[0].relativeFile))).toString("utf8");
    const partNamed = (name: string) => sidecar.parts.find((part: { name: string }) => part.name === name);
    expect(await storedText(partNamed("stdout"))).toBe("typed stdout");
    expect(await storedText(partNamed("result-value"))).toBe("typed result");
    expect(await storedText(partNamed("traceback"))).toContain("ValueError: bad value");
    expect(await storedText(partNamed("diff"))).toContain('"path": "module.py"');
    expect(await storedText(sidecar.parts.find(
      (part: { kind: string; pointer?: string }) => part.kind === "call-field" && part.pointer === "/code",
    ))).toBe(persistedInput.code);
    expect(await readFile(join(
      archive.sessionPath,
      partNamed("attachment:1").chunks[0].relativeFile,
    ))).toEqual(Buffer.from("attachment bytes"));

    const current = { taskKey: "task", requirementsRevision: 2, workspaceRevision: 5 };
    const inspectedCall = await archive.inspect("o1:call#/code", {
      current, maxBytes: Buffer.byteLength(persistedInput.code),
    });
    expect(inspectedCall.content).toEqual([{ type: "text", text: persistedInput.code }]);
    expect(inspectedCall.details).toMatchObject({
      ref: "o1:call#/code",
      pointer: "/code",
      partKind: "call-field",
      currentWorkspace: true,
      currentRequirements: true,
    });
    expect((await archive.inspect("o1:stderr", { current })).content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("typed stderr"),
    });
    expect((await archive.inspect("o1:traceback", {
      query: "ValueError: bad value",
      contextLines: 0,
      current,
    })).content[0]).toMatchObject({ type: "text", text: expect.stringContaining("ValueError: bad value") });
    expect((await archive.inspect("o1:diff", { current })).content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining('"path": "module.py"'),
    });
    const inspectedImage = await archive.inspect("o1:image:1", { current });
    expect(inspectedImage.content).toEqual([
      { type: "text", text: "Image o1:image:1 | image/png | 68 bytes | 1x1" },
      { type: "image", mimeType: "image/png", data: ipythonEvent.content[1].data },
    ]);
    expect(inspectedImage.details).toMatchObject({
      ref: "o1:image:1",
      partKind: "image",
      mediaType: "image/png",
      binaryBytes: 68,
      width: 1,
      height: 1,
    });
    const inspectedImageAttachment = await archive.inspect("o1:attachment:2", { current });
    expect(inspectedImageAttachment.content).toContainEqual({
      type: "image",
      mimeType: "image/png",
      data: ipythonEvent.content[1].data,
    });
    expect(inspectedImageAttachment.details).toMatchObject({
      ref: "o1:attachment:2", partKind: "attachment", mediaType: "image/png", binaryBytes: 68,
    });
    const recalled = await archive.recall({
      query: "ValueError: bad value",
      kind: "diagnostic",
      scope: "task",
      contextLines: 0,
    }, 12 * 1024, current);
    expect(recalled.matches).toHaveLength(1);
    expect(recalled.matches[0]).toMatchObject({
      ref: "o1:traceback", partKind: "traceback", scope: "task", startLine: 2, endLine: 2,
    });
    expect(recalled.content[0]).toMatchObject({ type: "text", text: expect.stringContaining("ValueError: bad value") });
    expect((await archive.recall({
      query: "ValueError: bad value",
      kind: "diagnostic",
      scope: "task",
      contextLines: 0,
    }, 12 * 1024, current)).content).toEqual(recalled.content);
    const recalledSuite = await archive.recall({ query: "pytest", kind: "result", scope: "task" }, 12 * 1024, current);
    expect(recalledSuite.matches[0]).toMatchObject({ ref: "o1:result", partKind: "result" });
    expect(recalledSuite.content[0]).toMatchObject({ type: "text", text: expect.stringContaining("result 0") });
    const recalledImage = await archive.recall({ id: "o1:image:1", kind: "image", scope: "task" }, 12 * 1024, current);
    expect(recalledImage.matches).toHaveLength(1);
    expect(recalledImage.content).toContainEqual({
      type: "image",
      mimeType: "image/png",
      data: ipythonEvent.content[1].data,
    });
    archive.setBranchScope("new-task", []);
    const olderTaskRecall = await archive.recall({
      query: "ValueError: bad value", kind: "diagnostic", scope: "session", contextLines: 0,
    }, 12 * 1024, { taskKey: "new-task", requirementsRevision: 1, workspaceRevision: 1 });
    expect(olderTaskRecall.content[0]).toMatchObject({ type: "text", text: expect.stringContaining("ValueError: bad value") });
    expect(olderTaskRecall.matches[0]).toMatchObject({
      ref: "o1:traceback", scope: "session", sessionId: "session-v2",
      currentWorkspace: false, currentRequirements: false,
    });
    const repeatedOlderTask = await archive.recall({
      id: "session-v2:o1:traceback", scope: "session",
    }, 12 * 1024, { taskKey: "new-task", requirementsRevision: 1, workspaceRevision: 1 });
    expect(repeatedOlderTask.matches[0]).toMatchObject({ ref: "o1:traceback", sessionId: "session-v2" });
    archive.setBranchScope("task", ["call-1", "call-2"]);

    const o2Sidecar = JSON.parse(await readFile(join(archive.observationsPath, "o2.meta.json"), "utf8"));
    const payloadPart = o2Sidecar.parts.find(
      (part: { kind: string; pointer?: string }) => part.kind === "call-field" && part.pointer === "/payload",
    );
    expect(await storedText(payloadPart)).toMatch(/^\{"field_0":/);

    const fork = new ObservationArchive(root, "session-v2-fork");
    expect(await fork.importFrom(archive, ["o1:stdout"])).toBe(1);
    expect(await fork.readExactText("o1")).toBe(resultText);
    expect((await fork.inspect("o1:stdout")).content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("typed stdout"),
    });
    expect((await fork.list())[0].partRefs).toEqual(listed[1].partRefs);
  });

  it("keeps mixed oversized and aggregate call markers within the fixed call budget", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-call-budget-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "call-budget");
    const persistedModelInput = { [`long_${"k".repeat(1495)}`]: "H".repeat(9001), aggregate: "a".repeat(5400), ok: 1 };
    await archive.finalizeExchanges([{
      metadata: {
        exchangeId: "o1", toolCallId: "call-1", intentKind: "run", subjectKey: "custom",
        resources: [], mutatesWorkspace: false,
        modelInputBytes: Buffer.byteLength(JSON.stringify(persistedModelInput)), executedInputBytes: 1,
        outcome: analyzeOutcome("ok", false),
      },
      toolName: "custom", isError: false, persistedModelInput,
      source: "visible-tool-result", parts: [{ name: "result", kind: "result", mediaType: "text/plain", text: "ok" }],
      resultText: "ok", largeResult: true,
    }], undefined, { budgetBytes: 8192, capsuleMaxBytes: 1024 });
    const [view] = await archive.loadFixedExchangeViews();
    expect(Buffer.byteLength(JSON.stringify(view.callArguments), "utf8")).toBeLessThanOrEqual(8192);
    expect(view.callArguments).toMatchObject({ ok: 1 });
  });

  it("freezes one aggregate edit batch and rehydrates fixed views through a fork", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-fixed-batch-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "session-fixed-batch");
    const editInput = (label: string) => ({
      path: `${label}.ts`,
      edits: [{
        oldText: `old ${label} sentinel\n${"o".repeat(5200)}`,
        newText: `new ${label} sentinel\n${"n".repeat(5200)}`,
      }],
    });
    const resultA = "applied alpha change\n".repeat(700);
    const resultB = "persisted beta tail\n".repeat(700);
    const recoveredResultB = "full beta artifact\n".repeat(900);
    const metadata = (id: string, callId: string, text: string) => ({
      exchangeId: id,
      toolCallId: callId,
      intentKind: "edit" as const,
      subjectKey: `${callId}.ts`,
      resources: [`${callId}.ts`],
      effectiveCwd: "/workspace&root",
      suite: { family: "vitest", target: callId, scope: "focused" as const },
      mutatesWorkspace: true,
      modelInputBytes: 10_500,
      executedInputBytes: 10_500,
      outcome: analyzeOutcome(text, false),
      taskKey: "task",
      branchAnchorId: callId,
    });
    const diffPart = {
      name: "diff",
      kind: "diff" as const,
      mediaType: "text/plain; charset=utf-8",
      text: "@@ -1 +1 @@\n-old\n+new",
    };
    const finalDiffPart = {
      ...diffPart,
      text: "@@ -1 +1 @@\n-old\n+final middleware diff",
    };
    const rawCall = (id: string, input: Record<string, unknown>) => ({
      type: "toolCall",
      id,
      name: "edit",
      arguments: input,
      providerState: { replayFloor: `provider-${id}` },
    });
    const admitted = await archive.archiveVisibleContent(
      [{ type: "text", text: resultA }],
      "edit",
      false,
      1,
      1024,
      undefined,
      { text: resultA, source: "visible-tool-result" },
      undefined,
      metadata("o1", "call-a", resultA),
      [diffPart],
    );
    const admittedCapsule = admitted?.observation.envelope?.resultCapsule;
    expect(admittedCapsule).toContain('id="o1:result"');
    const alphaInput = editInput("alpha");
    const betaInput = editInput("beta");
    const alphaRawCall = rawCall("call-a", alphaInput);
    const betaRawCall = rawCall("call-b", betaInput);

    const batchBudget = 1800;
    await archive.finalizeExchanges([
      {
        metadata: metadata("o2", "call-b", resultB),
        toolName: "edit",
        isError: false,
        source: "visible-tool-result",
        parts: [diffPart],
        persistedModelInput: betaInput,
        persistedRawCall: betaRawCall,
        persistedRawResult: {
          content: [{ type: "text", text: resultB }],
        },
        resultText: recoveredResultB,
        sourceOrder: 1,
      },
      {
        metadata: metadata("o1", "call-a", resultA),
        toolName: "edit",
        isError: false,
        source: "visible-tool-result",
        parts: [finalDiffPart],
        persistedModelInput: alphaInput,
        persistedRawCall: alphaRawCall,
        resultChangedAfterHook: true,
        canonicalResultChangedAfterHook: false,
        resultText: resultA,
        admittedCapsule,
        sourceOrder: 0,
      },
      {
        metadata: {
          ...metadata("o4", "call-prime", "recovery output"),
          intentKind: "read" as const,
          subjectKey: "prime_context:read",
          resources: [],
          mutatesWorkspace: false,
        },
        toolName: "prime_context",
        isError: false,
        source: "visible-tool-result",
        persistedModelInput: { action: "read", id: "o1" },
        persistedRawCall: {
          type: "toolCall", id: "call-prime", name: "prime_context",
          arguments: { action: "read", id: "o1" },
        },
        resultText: "recovery output must stay raw\n".repeat(1000),
        sourceOrder: 2,
      },
    ], undefined, { budgetBytes: batchBudget, capsuleMaxBytes: 1024 });

    const fixed = await archive.loadFixedExchangeViews();
    expect(fixed.map((view) => view.toolCallId)).toEqual(["call-a", "call-b"]);
    expect(fixed.reduce((total, view) => total + view.visibleBytes, 0)).toBeLessThanOrEqual(batchBudget);
    const rawCalls = new Map([["call-a", alphaRawCall], ["call-b", betaRawCall]]);
    const rawResults = new Map([["call-a", resultA], ["call-b", resultB]]);
    for (const view of fixed) {
      const raw = rawCalls.get(view.toolCallId)!;
      const projectedCall = view.callArguments ? { ...raw, arguments: view.callArguments } : raw;
      const selectedResult = view.result.kind === "capsule"
        ? view.result.text
        : rawResults.get(view.toolCallId)!;
      expect(view.visibleBytes).toBe(
        Buffer.byteLength(JSON.stringify(projectedCall)) + Buffer.byteLength(selectedResult),
      );
    }
    expect(fixed[0].result).toMatchObject({ kind: "capsule", text: expect.stringContaining("o1:result") });
    expect(Buffer.byteLength((fixed[0].result as { text: string }).text)).toBeLessThan(
      Buffer.byteLength(admittedCapsule as string),
    );
    expect(fixed[1].result).toMatchObject({ kind: "capsule", text: expect.stringContaining("o2:result") });
    const alphaArgs = fixed[0].callArguments as {
      path: string;
      edits: Array<{ oldText: string; newText: string }>;
    };
    expect(alphaArgs.path).toBe("alpha.ts");
    expect(alphaArgs.edits[0].oldText).toContain('ref="o1:call#/edits/0/oldText"');
    expect(alphaArgs.edits[0].oldText).toContain('bytes="');
    expect(alphaArgs.edits[0].oldText).toContain('lines="2"');
    expect(alphaArgs.edits[0].oldText).toContain(
      'context="intent=edit; subject=call-a.ts; cwd=/workspace&amp;root; resources=call-a.ts; suite=vitest:call-a:focused"',
    );
    expect(alphaArgs.edits[0].oldText).toContain('diff-ref="o1:diff"');
    expect(alphaArgs.edits[0].oldText).toContain("old alpha sentinel");

    const o1 = await archive.findObservation("o1");
    const o2 = await archive.findObservation("o2");
    const prime = await archive.findObservation("o4");
    expect(o1.envelope?.resultCapsule).toBe((fixed[0].result as { text: string }).text);
    const finalDiff = o1.envelope?.parts.find((part) => part.name === "diff");
    expect(gunzipSync(await readFile(join(
      archive.sessionPath, finalDiff!.chunks[0].relativeFile,
    ))).toString("utf8")).toBe(finalDiffPart.text);
    expect(await archive.readExactText("o1")).toBe(resultA);
    expect(o2.partRefs).toContain("o2:result");
    expect(prime.envelope?.fixedView).toBeUndefined();
    expect(prime.envelope?.resultCapsule).toBe("");
    expect(prime.partRefs).not.toContain("o4:result");
    expect(await archive.readExactText("o2")).toBe(resultB);
    const oldField = o2.envelope?.parts.find((part) => part.pointer === "/edits/0/oldText");
    const storedOld = gunzipSync(await readFile(join(
      archive.sessionPath,
      oldField!.chunks[0].relativeFile,
    ))).toString("utf8");
    expect(storedOld).toBe(editInput("beta").edits[0].oldText);

    await archive.finalizeExchanges([{
      metadata: metadata("o3", "call-c", "ok"),
      toolName: "edit",
      isError: false,
      source: "visible-tool-result",
      persistedModelInput: { path: "small.ts", edits: [] },
      resultText: "ok",
      sourceOrder: 0,
    }], undefined, { budgetBytes: 24 * 1024, capsuleMaxBytes: 1024 });
    const literal = (await archive.loadFixedExchangeViews(undefined, ["o3"]))[0];
    expect(literal.result).toEqual({ kind: "literal" });
    expect((await archive.findObservation("o3")).partRefs).not.toContain("o3:result");

    const shellCommand = `cat <<'EOF' > generated.txt\n${"payload line\n".repeat(2_000)}EOF`;
    const shellInput = { command: shellCommand };
    const shellIntent = adaptToolIntent({
      exchangeId: "o5", toolCallId: "call-shell", toolName: "bash",
      input: shellInput, cwd: "/workspace", modelInputBytes: Buffer.byteLength(JSON.stringify(shellInput)),
    });
    expect(shellIntent.subjectKey).toBe("/workspace/generated.txt");
    expect(shellIntent.facts?.normalizedExecutable).toBe("cat");
    await archive.finalizeExchanges([{
      metadata: {
        exchangeId: "o5",
        toolCallId: "call-shell",
        intentKind: shellIntent.kind,
        subjectKey: shellIntent.subjectKey,
        resources: shellIntent.resources,
        effectiveCwd: shellIntent.effectiveCwd,
        mutatesWorkspace: shellIntent.mutatesWorkspace,
        modelInputBytes: shellIntent.modelInputBytes,
        executedInputBytes: shellIntent.executedInputBytes,
        facts: shellIntent.facts,
        outcome: analyzeOutcome("wrote generated file", false),
      },
      toolName: "bash",
      isError: false,
      source: "visible-tool-result",
      persistedModelInput: shellInput,
      persistedRawCall: {
        type: "toolCall", id: "call-shell", name: "bash", arguments: shellInput,
      },
      resultText: "wrote generated file",
      sourceOrder: 0,
    }], undefined, { budgetBytes: 24 * 1024, capsuleMaxBytes: 1024 });
    const shellView = (await archive.loadFixedExchangeViews(undefined, ["o5"]))[0];
    const shellMarker = (shellView.callArguments as { command: string }).command;
    expect(shellMarker).toContain("subject=/workspace/generated.txt; executable=cat");
    expect(shellMarker).toContain("cat &lt;&lt;&apos;EOF&apos; &gt; generated.txt");
    expect(shellMarker).not.toContain("cat <<'EOF' > generated.txt");

    const signedResult = "signed raw result\n".repeat(800);
    const signedInput = { command: "echo signed" };
    const signedRawCall = {
      type: "toolCall", id: "call-signed-result", name: "bash", arguments: signedInput,
      providerState: { keep: true },
    };
    const signedMetadata = {
      exchangeId: "o6",
      toolCallId: "call-signed-result",
      intentKind: "run" as const,
      subjectKey: "command:echo:signed",
      resources: [],
      effectiveCwd: "/workspace",
      mutatesWorkspace: false,
      modelInputBytes: Buffer.byteLength(JSON.stringify(signedInput)),
      executedInputBytes: Buffer.byteLength(JSON.stringify(signedInput)),
      outcome: analyzeOutcome(signedResult, false),
    };
    const signedAdmission = await archive.archiveVisibleContent(
      [{ type: "text", text: signedResult, textSignature: "opaque-result-signature" }],
      "bash", false, 1, 1024, undefined,
      { text: signedResult, source: "visible-tool-result" },
      undefined,
      signedMetadata,
    );
    expect(signedAdmission?.observation.envelope?.resultCapsule).toContain("o6:result");
    await archive.finalizeExchanges([{
      metadata: signedMetadata,
      toolName: "bash",
      isError: false,
      source: "visible-tool-result",
      persistedModelInput: signedInput,
      persistedRawCall: signedRawCall,
      persistedRawResult: {
        content: [{ type: "text", text: signedResult, textSignature: "opaque-result-signature" }],
      },
      resultText: signedResult,
      admittedCapsule: signedAdmission?.observation.envelope?.resultCapsule,
      sourceOrder: 0,
    }], undefined, { budgetBytes: 1024, capsuleMaxBytes: 1024 });
    const signedView = (await archive.loadFixedExchangeViews(undefined, ["o6"]))[0];
    expect(signedView.result).toEqual({ kind: "literal" });
    expect(signedView.visibleBytes).toBe(
      Buffer.byteLength(JSON.stringify(signedRawCall)) + Buffer.byteLength(signedResult),
    );
    expect(signedView.visibleBytes).toBeGreaterThan(1024);

    const staleResult = "stale middleware body\n".repeat(500);
    const finalResult = "FINAL_PERSISTED_FAILURE late middleware body\n".repeat(500);
    const changedMetadata = {
      ...signedMetadata,
      exchangeId: "o7",
      toolCallId: "call-changed-result",
      outcome: analyzeOutcome(finalResult, true),
    };
    const staleAdmission = await archive.archiveVisibleContent(
      [{ type: "text", text: staleResult }],
      "bash", false, 1, 1024, undefined,
      { text: staleResult, source: "visible-tool-result" },
      undefined,
      changedMetadata,
      [
        { name: "stdout", kind: "stdout", text: "stale stdout" },
        { name: "diff", kind: "diff", text: "stale diff" },
      ],
    );
    await archive.finalizeExchanges([{
      metadata: changedMetadata,
      toolName: "bash",
      isError: true,
      source: "visible-tool-result",
      parts: [
        { name: "stdout", kind: "stdout", text: "final stdout" },
        { name: "diff", kind: "diff", text: "final diff" },
      ],
      persistedModelInput: { command: "late middleware" },
      persistedRawCall: {
        type: "toolCall", id: "call-changed-result", name: "bash",
        arguments: { command: "late middleware" },
      },
      persistedRawResult: {
        content: [{ type: "text", text: finalResult }],
        details: { error: "late middleware" },
        isError: true,
      },
      resultChangedAfterHook: true,
      canonicalResultChangedAfterHook: true,
      resultText: staleResult,
      admittedCapsule: staleAdmission?.observation.envelope?.resultCapsule,
      sourceOrder: 0,
    }], undefined, { budgetBytes: 24 * 1024, capsuleMaxBytes: 1024 });
    const changedView = (await archive.loadFixedExchangeViews(undefined, ["o7"]))[0];
    expect(changedView.result).toMatchObject({
      kind: "capsule", text: expect.stringContaining("FINAL_PERSISTED_FAILURE"),
    });
    expect((changedView.result as { text: string }).text)
      .not.toBe(staleAdmission?.observation.envelope?.resultCapsule);
    expect(await archive.readExactText("o7")).toBe(finalResult);
    const changedObservation = await archive.findObservation("o7");
    expect(changedObservation.isError).toBe(true);
    const changedStdout = changedObservation.envelope?.parts.find((part) => part.name === "stdout");
    const changedDiff = changedObservation.envelope?.parts.find((part) => part.name === "diff");
    expect(gunzipSync(await readFile(join(
      archive.sessionPath, changedStdout!.chunks[0].relativeFile,
    ))).toString("utf8")).toBe("final stdout");
    expect(gunzipSync(await readFile(join(
      archive.sessionPath, changedDiff!.chunks[0].relativeFile,
    ))).toString("utf8")).toBe("final diff");

    const resumed = new ObservationArchive(root, "session-fixed-batch");
    expect(await resumed.loadFixedExchangeViews()).toEqual(await archive.loadFixedExchangeViews());
    const fork = new ObservationArchive(root, "session-fixed-fork");
    expect(await fork.importFrom(archive, ["o1", "o2", "o3", "o5", "o6", "o7"])).toBe(6);
    expect(await fork.loadFixedExchangeViews()).toEqual(await archive.loadFixedExchangeViews());
  });

  it("reads a legacy v1 whole-gzip observation unchanged", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-v1-edge-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "session-v1-edge");
    const text = "legacy first\nlegacy exact tail\n";
    const relativeFile = join("observations", "obs_legacy.txt.gz");
    await mkdir(archive.observationsPath, { recursive: true });
    await writeFile(join(archive.sessionPath, relativeFile), gzipSync(Buffer.from(text, "utf8")));
    await writeFile(archive.indexPath, `${JSON.stringify({
      schema: "prime-context.observation-index/v1",
      observations: [{
        id: "obs_legacy",
        relativeFile,
        toolName: "bash",
        isError: false,
        textBytes: Buffer.byteLength(text),
        lineCount: 3,
        createdAt: "2026-01-01T00:00:00.000Z",
      }],
    }, null, 2)}\n`);

    expect(await archive.readExactText("obs_legacy")).toBe(text);
    expect(await archive.search("obs_legacy", "exact tail")).toContain("legacy exact tail");
    expect((await archive.list())[0]).toMatchObject({ id: "obs_legacy", relativeFile });
  });

  it("archives exact medium repeats only within the same tool subject", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-medium-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "session-medium");
    const medium = Array.from({ length: 120 }, (_, index) => `source line ${index} ${"x".repeat(70)}`).join("\n");

    const first = await archive.archiveVisibleContent([{ type: "text", text: medium }], "ipython", false, 24576, 6144);
    const second = await archive.archiveVisibleContent([{ type: "text", text: medium }], "ipython", false, 24576, 6144);
    const third = await archive.archiveVisibleContent([{ type: "text", text: medium }], "ipython", false, 24576, 6144);
    const otherTool = await archive.archiveVisibleContent([{ type: "text", text: medium }], "bash", false, 24576, 6144);

    expect(first).toBeNull();
    expect(second).not.toBeNull();
    expect(third).not.toBeNull();
    expect(utf8Bytes((second?.content[0] as { text: string }).text)).toBeLessThanOrEqual(1536);
    expect(otherTool).toBeNull();

    const distinct = new ObservationArchive(root, "session-distinct-medium");
    expect(await distinct.archiveVisibleContent([{ type: "text", text: medium }], "ipython", false, 24576, 6144)).toBeNull();
    const changed = await distinct.archiveVisibleContent(
      [{ type: "text", text: `${medium} changed` }], "ipython", false, 24576, 6144,
    );
    expect((changed?.content[0] as { text: string }).text).toContain("Content changed since previous observation.");
    expect((changed?.content[0] as { text: string }).text).toContain("Unchanged prior section");
    expect((changed?.content[0] as { text: string }).text).toContain("changed");

    const compositeArchive = new ObservationArchive(root, "session-composite");
    const knownSection = Array.from(
      { length: 80 }, (_, index) => `module line ${index} ${"content ".repeat(10)}`,
    ).join("\n");
    expect(await compositeArchive.archiveVisibleContent(
      [{ type: "text", text: knownSection }], "ipython", false, 24576, 6144,
    )).toBeNull();
    const composite = `audit header\n${knownSection}\nnovel conclusion`;
    const compositeDelta = await compositeArchive.archiveVisibleContent(
      [{ type: "text", text: composite }], "ipython", false, 24576, 6144,
    );
    expect((compositeDelta?.content[0] as { text: string }).text).toContain("Composite delta:");
    expect((compositeDelta?.content[0] as { text: string }).text).toContain("novel conclusion");
  });

  it("scopes semantic deltas by subject and renders at most four bounded line hunks", () => {
    const broker = new ObservationBroker();
    const successful = `TEST_RESULT PASS 3/3\n${"stable ".repeat(80)}`;
    const outcome = analyzeOutcome(successful, false);
    expect(broker.observe("bash", successful, false, {
      subjectKey: "suite:pytest:tests/a",
      textBytes: utf8Bytes(successful),
      lineCount: 2,
      representativeLines: successful.split("\n"),
      outcome,
    }).kind).toBe("structured");
    expect(broker.observe("bash", `${successful} other`, false, {
      subjectKey: "suite:pytest:tests/b",
      textBytes: utf8Bytes(`${successful} other`),
      lineCount: 2,
      representativeLines: successful.split("\n"),
      outcome,
    }).kind).toBe("structured");
    expect(broker.observe("zsh", `${successful} rerun`, false, {
      subjectKey: "suite:pytest:tests/a",
      textBytes: utf8Bytes(`${successful} rerun`),
      lineCount: 2,
      representativeLines: successful.split("\n"),
      outcome,
    })).toMatchObject({ kind: "structured" });

    const exact = new ObservationBroker();
    expect(exact.observe("bash", successful, false, {
      subjectKey: "path:/a",
      textBytes: utf8Bytes(successful),
      lineCount: 2,
      representativeLines: [],
    }).kind).toBe("structured");
    expect(exact.observe("ipython", successful, false, {
      subjectKey: "path:/b",
      textBytes: utf8Bytes(successful),
      lineCount: 2,
      representativeLines: [],
    })).toMatchObject({ kind: "structured" });

    const base = Array.from({ length: 100 }, (_, index) =>
      `line ${index.toString().padStart(3, "0")} ${"content ".repeat(5)}`);
    const changed = [...base];
    for (const index of [10, 30, 50, 70]) changed[index] = `${changed[index]} changed`;
    const content = new ObservationBroker();
    const first = base.join("\n");
    const second = changed.join("\n");
    expect(content.observe("read", first, false, {
      subjectKey: "path:/repo/file.txt",
      textBytes: utf8Bytes(first),
      lineCount: base.length,
      representativeLines: base.slice(0, 64),
    }).kind).toBe("structured");
    const decision = content.observe("read", second, false, {
      subjectKey: "path:/repo/file.txt",
      textBytes: utf8Bytes(second),
      lineCount: changed.length,
      representativeLines: changed.slice(0, 64),
    });
    expect(decision).toMatchObject({ kind: "delta", reason: "content" });
    expect(decision.changedLines?.filter((line) => line.startsWith("@@"))).toHaveLength(4);
    expect(utf8Bytes(decision.changedLines?.join("\n") ?? "")).toBeLessThanOrEqual(2048);

    const many = new ObservationBroker();
    const tooMany = [...base];
    for (const index of [5, 20, 35, 50, 65]) tooMany[index] = `${tooMany[index]} changed`;
    many.observe("read", first, false, {
      subjectKey: "path:/repo/many.txt",
      textBytes: utf8Bytes(first),
      lineCount: base.length,
      representativeLines: [],
    });
    expect(many.observe("read", tooMany.join("\n"), false, {
      subjectKey: "path:/repo/many.txt",
      textBytes: utf8Bytes(tooMany.join("\n")),
      lineCount: tooMany.length,
      representativeLines: [],
    }).kind).toBe("structured");
  });

  it("bounds utility adaptation and persists aggregate counters without event history", () => {
    const broker = new ObservationBroker();
    broker.recordArchive({
      subjectKey: "suite:pytest:tests",
      sourceBytes: 10_000,
      projectedBytes: 1024,
      streamingBytes: 10_000,
    });
    expect(broker.utilityCapsuleMaxBytes("suite:pytest:tests", "failure", 1024, 2048)).toBe(1024);
    broker.recordRecovery({
      useful: true,
      subjectKeys: ["suite:pytest:tests"],
      exposedBytes: 400,
      inspectRecallHit: true,
    });
    broker.recordRecovery({
      useful: true,
      subjectKeys: ["suite:pytest:tests"],
      exposedBytes: 500,
      inspectRecallHit: true,
    });
    expect(broker.utilityCapsuleMaxBytes("suite:pytest:tests", "failure", 1024, 2048)).toBe(1536);

    for (let index = 0; index < 4; index += 1) {
      broker.recordArchive({ subjectKey: "trace:heartbeat", sourceBytes: 2000, projectedBytes: 1536 });
    }
    broker.recordRecovery({ useful: false, subjectKeys: ["trace:heartbeat"] });
    expect(broker.utilityCapsuleMaxBytes("trace:heartbeat", "unknown", 1536, 1536)).toBe(1024);

    const read = {
      subjectKey: "path:/repo/file.ts",
      intentKind: "read",
      mutatesWorkspace: false,
      requirementsRevision: 2,
      workspaceRevision: 3,
    };
    expect(broker.noteReadOnlyIntent(read)).toBe(512);
    expect(broker.noteReadOnlyIntent(read)).toBe(512);
    expect(broker.noteReadOnlyIntent(read)).toBe(768);
    broker.recordRecovery({
      recovered: true,
      useful: false,
      subjectKeys: ["result:read-only-recovery"],
    });
    expect(broker.persistentState().utility.find((entry) => entry.key === "subject:result:read-only-recovery")?.counters)
      .toMatchObject({ recovered: 1, usefulRecoveries: 0 });

    for (let index = 0; index < 70; index += 1) {
      broker.recordArchive({ subjectKey: `subject-${index}`, sourceBytes: 1, projectedBytes: 1 });
    }
    broker.recordProjection({
      callArgumentBytesProjectedOut: 100,
      resultBytesProjectedOut: 200,
      typedMediaBytesProjectedOut: 300,
    });
    broker.recordBranchRuntimeReload();
    broker.recordUsage({ input: 11, cacheRead: 12, cacheWrite: 13 });
    const snapshot = broker.persistentState();
    const restored = new ObservationBroker();
    restored.restorePersistentState(snapshot);
    expect(restored.statistics()).toMatchObject({
      utilityBucketCount: 64,
      metrics: {
        sourceBytesArchived: 18_070,
        recoveryBytesExposed: 900,
        streamingBytesProcessed: 10_000,
        inspectRecallHits: 2,
        callArgumentBytesProjectedOut: 100,
        resultBytesProjectedOut: 200,
        typedMediaBytesProjectedOut: 300,
        branchRuntimeReloadCount: 1,
        uncachedInputTokens: 11,
        cacheReadTokens: 12,
        cacheWriteTokens: 13,
      },
    });
  });

  it("preserves exact repeat detection above the sketch text cap", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-medium-repeat-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "medium-repeat-session");
    const text = `${Array.from({ length: 1700 }, (_, index) =>
      `medium line ${index.toString().padStart(4, "0")} ${"x".repeat(24)}`
    ).join("\n")}\n${"z".repeat(16)}`;
    expect(Buffer.byteLength(text, "utf8")).toBeGreaterThan(65536);
    const content = [{ type: "text" as const, text }];
    expect(await archive.archiveVisibleContent(content, "bash", false, 128 * 1024, 1024)).toBeNull();
    const repeated = await archive.archiveVisibleContent(content, "bash", false, 128 * 1024, 1024);
    expect(repeated).not.toBeNull();
    expect(await archive.readExactText(repeated!.observation.id)).toBe(text);
  });

  it("archives verbose command usage below the normal threshold", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-usage-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "session-usage");
    const usage = [
      "fatal: invalid invocation",
      "usage: example [options]",
      ...Array.from({ length: 15 }, (_, index) => `  --option-${index} ${"description ".repeat(24)}`),
    ].join("\n");

    const archived = await archive.archiveVisibleContent(
      [{ type: "text", text: usage }], "bash", false, 24576, 6144,
    );
    expect(utf8Bytes(usage)).toBeGreaterThanOrEqual(4096);
    expect(archived).not.toBeNull();
    expect((archived?.content[0] as { text: string }).text).toContain("fatal: invalid invocation");
  });

  it("keeps novel 8-24 KiB results literal until actual context pressure", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-medium-pressure-"));
    temporaryPaths.push(root);
    const usage = [
      "fatal: invalid invocation",
      "usage: example [options]",
      ...Array.from({ length: 36 }, (_, index) => `  --option-${index} ${"description ".repeat(24)}`),
    ].join("\n");
    expect(utf8Bytes(usage)).toBeGreaterThan(8192);
    expect(utf8Bytes(usage)).toBeLessThanOrEqual(24576);

    const noPressure = new ObservationArchive(root, "session-medium-no-pressure");
    expect(await noPressure.archiveVisibleContent(
      [{ type: "text", text: usage }], "bash", false, 24576, 6144,
    )).toBeNull();

    const pressured = new ObservationArchive(root, "session-medium-pressure");
    const archived = await pressured.archiveVisibleContent(
      [{ type: "text", text: usage }],
      "bash",
      false,
      24576,
      6144,
      undefined,
      undefined,
      { tokens: 600, contextWindow: 1000 },
    );
    expect(archived).not.toBeNull();
    expect((archived?.content[0] as { text: string }).text).toContain("fatal: invalid invocation");
  });

  it("leaves a small result unchanged", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-small-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "session-small");
    const content = [{ type: "text" as const, text: "small output" }];

    expect(await archive.archiveVisibleContent(content, "bash", false, 24576, 6144)).toBeNull();
    expect(content).toEqual([{ type: "text", text: "small output" }]);

    const sourceMention = [
      "import unittest",
      "from lockresolve import resolve, ResolutionError",
      "class Tests(unittest.TestCase):",
      "  def test_invalid(self):",
      "    with self.assertRaises(ResolutionError):",
      '      resolve({"a": {}}, {"a": ">=2"})',
      `# ${"source context ".repeat(18)}`,
    ].join("\n");
    expect(analyzeOutcome(sourceMention).status).toBe("unknown");
    expect(analyzeOutcome("TEST_RESULT PASS 3/9").testTotal).toBe(9);
    expect(analyzeOutcome("Ran 7 tests in 0.01s\n\nOK").testTotal).toBe(7);
    expect(analyzeOutcome("Return 0 succeeded, 1 failed/cancelled, and 2 pending.").status).toBe("unknown");
    const sourceResultLiterals = [
      'print("TEST_RESULT PASS 9/9")',
      'message = "build failed"',
      'print("Ran 9 tests in 0.01s")',
    ].join("\n");
    expect(analyzeOutcome(sourceResultLiterals).status).toBe("unknown");
    expect(analyzeOutcome(sourceResultLiterals).testTotal).toBeNull();
    const pytestFailure = analyzeOutcome("================ 1 failed, 8 passed in 0.10s ================");
    expect(pytestFailure.status).toBe("failure");
    expect(pytestFailure.testTotal).toBe(9);
    expect(await archive.archiveVisibleContent(
      [{ type: "text", text: sourceMention }], "ipython-source", false, 24576, 6144,
    )).toBeNull();
    expect(await archive.archiveVisibleContent(
      [{ type: "text", text: sourceMention }], "ipython-source", false, 24576, 6144,
    )).toBeNull();

    const usefulShortFailure = [
      "TEST_RESULT FAIL 3/6",
      "FAIL test_one AssertionError: first mismatch",
      "FAIL test_two ValueError: invalid tier",
      "FAIL test_three TypeError: wrong value",
      ...Array.from({ length: 8 }, (_, index) => `TRACE worker=0 line=${index} ${"x".repeat(130)}`),
    ].join("\n");
    expect(utf8Bytes(usefulShortFailure)).toBeGreaterThan(1024);
    expect(await archive.archiveVisibleContent(
      [{ type: "text", text: usefulShortFailure }], "ipython-short", false, 24576, 6144,
    )).toBeNull();

    const sampledTerminal = [
      "exit 0",
      "TEST_RESULT PASS 6/6",
      ...Array.from({ length: 12 }, (_, index) => `TRACE worker=0 line=${index} ${"x".repeat(180)}`),
    ].join("\n");
    const archived = await archive.archiveVisibleContent(
      [{ type: "text", text: sampledTerminal }],
      "ipython",
      false,
      24576,
      6144,
    );
    expect(archived).not.toBeNull();
    expect((archived?.content[0] as { text: string }).text).toContain("TEST_RESULT PASS 6/6");
    expect((archived?.content[0] as { text: string }).text).not.toContain("requirements remain open");
    expect((archived?.content[0] as { text: string }).text).not.toContain("TRACE worker");

    const repeated = await archive.archiveVisibleContent(
      [{ type: "text", text: sampledTerminal }],
      "ipython",
      false,
      24576,
      6144,
    );
    expect((repeated?.content[0] as { text: string }).text)
      .toContain("TEST_RESULT PASS 6/6");
    expect((repeated?.content[0] as { text: string }).text)
      .toContain("Command or validation succeeded.");
    expect((repeated?.content[0] as { text: string }).text)
      .not.toContain("requirements remain open");
    expect((repeated?.content[0] as { text: string }).text).not.toContain("Read:");

    const equivalentSuccess = sampledTerminal.replace("exit 0", "wrapper rc=0").replaceAll("worker=0", "worker=1");
    const equivalent = await archive.archiveVisibleContent(
      [{ type: "text", text: equivalentSuccess }],
      "ipython",
      false,
      24576,
      6144,
    );
    expect((equivalent?.content[0] as { text: string }).text)
      .toContain("TEST_RESULT PASS 6/6");
    expect((equivalent?.content[0] as { text: string }).text)
      .not.toContain("Semantic outcome unchanged since previous observation.");

    const finalTerminal = sampledTerminal.replace("PASS 6/6", "PASS 9/9");
    const ready = await archive.archiveVisibleContent(
      [{ type: "text", text: finalTerminal }], "ipython", false, 24576, 6144,
    );
    expect((ready?.content[0] as { text: string }).text).toContain("TEST_RESULT PASS 9/9");
    expect((ready?.content[0] as { text: string }).text).not.toContain("goal.complete");
    expect(archive.brokerContext()).not.toHaveProperty("workflow");

    const traceOnly = Array.from(
      { length: 12 },
      (_, index) => `TRACE worker=7 line=${index} ${"payload ".repeat(28)}`,
    ).join("\n");
    const sampledTrace = await archive.archiveVisibleContent(
      [{ type: "text", text: traceOnly }],
      "bash",
      false,
      24576,
      6144,
    );
    expect(utf8Bytes(traceOnly)).toBeGreaterThanOrEqual(2048);
    expect(sampledTrace).not.toBeNull();
    const sampledTraceText = (sampledTrace?.content[0] as { text: string }).text;
    expect(utf8Bytes(sampledTraceText)).toBeLessThan(2048);
    expect(sampledTraceText).toContain("low-signal trace summarized; no decisive diagnostic found");
    expect(sampledTraceText).not.toContain("Read:");
    expect(sampledTraceText).not.toContain("Search:");
  });
});

describe("streamed multipart archive", () => {
  it("streams a file-backed result into line-aligned chunks and reopens it from sidecars", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-streamed-"));
    temporaryPaths.push(root);
    const outputPath = join(root, "complete-output.txt");
    const lines = Array.from({ length: 26000 }, (_, index) =>
      `ROW_${index + 1} π🙂 ${"payload".repeat(8)}`
    );
    lines[lines.length - 1] = "TAIL_MARKER π🙂";
    const original = lines.join("\n");
    await writeFile(outputPath, original, "utf8");
    const visible = [{ type: "text" as const, text: "visible tail remains raw" }];
    const resolved = await resolveArchiveText(visible, outputPath);
    expect(resolved.text).toContain("Large output summary:");
    expect(Buffer.byteLength(resolved.text, "utf8")).toBeLessThan(128 * 1024);

    const archive = new ObservationArchive(root, "streamed-session");
    const archived = await archive.archiveVisibleContent(
      visible,
      "bash",
      false,
      1,
      2048,
      undefined,
      resolved,
      undefined,
      {
        exchangeId: "o7",
        toolCallId: "call-7",
        intentKind: "run",
        subjectKey: "bash:stream",
        resources: [],
        mutatesWorkspace: false,
        modelInputBytes: 8,
        executedInputBytes: 8,
        outcome: analyzeOutcome(resolved.outcomeText ?? resolved.text),
      },
    );
    expect(visible).toEqual([{ type: "text", text: "visible tail remains raw" }]);
    const result = archived!.observation.envelope!.parts.find((part) => part.name === "result")!;
    expect(result.chunks.length).toBeGreaterThanOrEqual(2);
    let nextLine = 1;
    const decoded: string[] = [];
    for (const [index, chunk] of result.chunks.entries()) {
      expect(chunk.firstLine).toBe(nextLine);
      nextLine += chunk.lineCount ?? 0;
      const text = gunzipSync(await readFile(join(archive.sessionPath, chunk.relativeFile))).toString("utf8");
      decoded.push(text);
      if (index < result.chunks.length - 1) expect(text.endsWith("\n")).toBe(true);
    }
    expect(decoded.join("")).toBe(original);
    expect(result.textBytes).toBe(Buffer.byteLength(original, "utf8"));
    expect(result.lineCount).toBe(lines.length);
    const persistedCapsule = archived!.observation.envelope!.resultCapsule;
    expect(persistedCapsule.match(new RegExp(`L${lines.length}: TAIL_MARKER π🙂`, "g"))).toHaveLength(1);
    expect(persistedCapsule).not.toMatch(/L\d+: L\d+:/);
    const focusLine = Number(/\nL(\d+):/.exec(persistedCapsule)![1]);
    const recoveryRange = /startLine=(\d+) endLine=(\d+)/.exec(persistedCapsule)!;
    expect(recoveryRange.slice(1).map(Number)).toEqual([
      Math.max(1, focusLine - 20), Math.max(1, Math.min(lines.length, focusLine + 10)),
    ]);

    const boundaryLine = result.chunks[1].firstLine!;
    const ranged = await archive.readLines("o7", boundaryLine - 1, boundaryLine + 1, 12 * 1024);
    expect(ranged).toContain(`${boundaryLine}: ROW_${boundaryLine} π🙂`);
    const searched = await archive.search("o7", `ROW_${boundaryLine} π🙂`, 1, 0, 2, 12 * 1024);
    expect(searched).toContain(`Match at line ${boundaryLine}:`);
    expect(searched).toContain(` ${boundaryLine - 1}: ROW_${boundaryLine - 1} π🙂`);
    expect(await archive.readLines("o7", lines.length, lines.length, 12 * 1024)).toContain("TAIL_MARKER π🙂");
    expect(await archive.search("o7", "tail_marker π🙂", 0, 0, 1, 12 * 1024))
      .toContain(`Match at line ${lines.length}:`);
    await expect(readFile(archive.indexPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });

    const reopened = new ObservationArchive(root, "streamed-session");
    expect(await reopened.count()).toBe(1);
    expect(await reopened.readLines("o7", boundaryLine, boundaryLine, 12 * 1024))
      .toContain(`ROW_${boundaryLine} π🙂`);

    const fork = new ObservationArchive(root, "streamed-fork");
    expect(await fork.importFrom(reopened, ["o7"], undefined, {
      taskKey: "fork-task", branchAnchorId: "fork-anchor",
    })).toBe(1);
    const forked = await fork.findObservation("o7");
    expect(forked.envelope?.parts.find((part) => part.name === "result")?.chunks).toHaveLength(result.chunks.length);
    for (const chunk of result.chunks) {
      expect(await readFile(join(fork.sessionPath, chunk.relativeFile)))
        .toEqual(await readFile(join(archive.sessionPath, chunk.relativeFile)));
    }
    expect(forked.exchange).toMatchObject({
      taskKey: "fork-task", branchAnchorId: "fork-anchor", forkImported: true,
    });
    expect(await fork.maxExchangeSequence()).toBe(7);
    expect(JSON.parse(await readFile(join(fork.sessionPath, "session.json"), "utf8"))).toMatchObject({
      nextSequence: 8, observationCount: 1,
    });
  });

  it("streams multiple visible text blocks without joining the large aggregate", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-multiblock-"));
    temporaryPaths.push(root);
    const first = `head π\n${"a".repeat(400 * 1024)}\n`;
    const second = `${"b".repeat(400 * 1024)}\n`;
    const third = `${"c".repeat(400 * 1024)}\ntail `;
    const highSurrogate = "\ud83d";
    const lowSurrogate = "\ude42";
    const blocks = [
      { type: "text" as const, text: first },
      { type: "text" as const, text: second },
      { type: "text" as const, text: third + highSurrogate },
      { type: "text" as const, text: `${lowSurrogate}\n` },
    ];
    const original = blocks.map((block) => block.text).join("");
    const resolved = await resolveArchiveText(blocks);
    expect(resolved.large).toBe(true);
    expect(resolved.partSource?.kind).toBe("texts");
    const archive = new ObservationArchive(root, "multiblock-session");
    const archived = await archive.archiveVisibleContent(
      blocks, "ipython", false, 1, 1024, undefined, resolved, undefined,
      {
        exchangeId: "o1", toolCallId: "multi", intentKind: "run", subjectKey: "ipython:multi",
        resources: [], mutatesWorkspace: false, modelInputBytes: 1, executedInputBytes: 1,
        outcome: analyzeOutcome(resolved.outcomeText ?? resolved.text),
      },
    );
    expect(archived!.observation.envelope!.parts.find((part) => part.name === "result")!.chunks.length)
      .toBeGreaterThan(2);
    expect(await archive.readExactText("o1")).toBe(original);
    expect(await archive.readLines("o1", 5, 5, 12 * 1024)).toContain("tail 🙂");
  });

  it("keeps an oversized line in its own chunk and preserves a final LF", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-oversized-line-"));
    temporaryPaths.push(root);
    const oversized = `${"x".repeat(1100 * 1024)}NEEDLE_AT_END`;
    const original = `${oversized}\nshort π🙂\n`;
    const archive = new ObservationArchive(root, "oversized-session");
    const archived = await archive.archiveVisibleContent(
      [{ type: "text", text: original }], "bash", false, 1, 1024, undefined, undefined, undefined,
      {
        exchangeId: "o1", toolCallId: "oversized", intentKind: "run", subjectKey: "bash:oversized",
        resources: [], mutatesWorkspace: false, modelInputBytes: 1, executedInputBytes: 1,
        outcome: analyzeOutcome("large output"),
      },
    );
    const part = archived!.observation.envelope!.parts.find((candidate) => candidate.name === "result")!;
    expect(part.chunks).toHaveLength(2);
    expect(part.chunks.map((chunk) => chunk.lineCount)).toEqual([1, 2]);
    expect(gunzipSync(await readFile(join(archive.sessionPath, part.chunks[0].relativeFile))).toString("utf8"))
      .toBe(`${oversized}\n`);
    expect(gunzipSync(await readFile(join(archive.sessionPath, part.chunks[1].relativeFile))).toString("utf8"))
      .toBe("short π🙂\n");
    expect(await archive.readLines("o1", 2, 3, 12 * 1024)).toContain("3: ");
    expect(await archive.search("o1", "needle_at_end", 0, 0, 1, 12 * 1024))
      .toContain("Match at line 1:");
  });

  it("bounds unique streamed trace shapes", async () => {
    const alphabetic = (value: number): string => {
      let result = "";
      for (let index = 0; index < 6; index += 1) {
        result = String.fromCharCode(97 + (value % 26)) + result;
        value = Math.floor(value / 26);
      }
      return result;
    };
    const lines = Array.from({ length: 6000 }, (_, index) =>
      `TRACE shape_${alphabetic(index)} ${"detail".repeat(36)}`
    );
    const summary = await summarizePartSource({ kind: "text", text: lines.join("\n") });
    expect(summary.large).toBe(true);
    expect(summary.traceShapeCount).toBe(64);
    expect(summary.traceShapeOverflow).toBeGreaterThan(0);
    expect(summary.sourceRecords.length).toBeLessThanOrEqual(156);
    expect(summary.capsuleText).not.toMatch(/Trace shape x[2-9]\d*:/);
    expect(summary.summaryLines).toContain(
      `Additional trace lines with untracked shapes: ${summary.traceShapeOverflow}.`,
    );
    const uniqueRendered = renderBoundedCapsule(summary.sourceRecords, {
      outcomeText: summary.outcomeText,
      traceLineCount: summary.traceLineCount,
      nonEmptyLineCount: summary.nonEmptyLineCount,
      summaryLines: summary.summaryLines,
    }, {
      id: "o-unique-trace:result", toolName: "bash", textBytes: summary.textBytes, lineCount: summary.lineCount,
    }, 2048);
    expect(uniqueRendered).toContain(`Additional trace lines with untracked shapes: ${summary.traceShapeOverflow}.`);

    const repeated = await summarizePartSource({
      kind: "text",
      text: Array.from({ length: 6000 }, () => `TRACE worker ${"detail".repeat(36)}`).join("\n"),
    });
    const rendered = renderBoundedCapsule(repeated.sourceRecords, {
      outcomeText: repeated.outcomeText,
      traceLineCount: repeated.traceLineCount,
      nonEmptyLineCount: repeated.nonEmptyLineCount,
      summaryLines: repeated.summaryLines,
    }, {
      id: "o-trace:result", toolName: "bash", textBytes: repeated.textBytes, lineCount: repeated.lineCount,
    }, 2048);
    expect(rendered).toContain("Trace shape x6000:");
    expect(rendered).not.toMatch(/L\d+: Trace shape x6000:/);
  });

  it("retains late decisive signal classes after large warning noise", async () => {
    const noisy = Array.from({ length: 7000 }, (_, index) =>
      `error: warning-like noise ${index} ${"padding".repeat(22)}`
    );
    noisy.push(
      "FAIL suite/test_late.py::test_decisive",
      'File "suite/test_late.py", line 321, in test_decisive',
      "ValueError: late decisive failure",
      "exit status 7",
      "1 failed, 6999 warnings in 12.3s",
    );
    noisy.push(...Array.from({ length: 100 }, (_, index) => `trailing neutral line ${index}`));
    const summary = await summarizePartSource({ kind: "text", text: noisy.join("\n") });
    expect(summary.large).toBe(true);
    const retained = summary.sourceRecords.map((record) => record.text);
    expect(retained).toContain("FAIL suite/test_late.py::test_decisive");
    expect(retained).toContain('File "suite/test_late.py", line 321, in test_decisive');
    expect(retained).toContain("ValueError: late decisive failure");
    expect(retained).toContain("exit status 7");
    expect(retained).toContain("1 failed, 6999 warnings in 12.3s");
    const outcome = analyzeOutcome(summary.outcomeText);
    expect(outcome).toMatchObject({ status: "failure", testSummary: "1 FAILED, 6999 WARNINGS IN 12.3S" });
    expect(outcome.failingTests).toContain("suite/test_late.py::test_decisive");
    expect(outcome.exceptions).toContain("ValueError: late decisive failure");
    expect(outcome.sourceLocations).toContain("suite/test_late.py:321");
    expect(outcome.exitStatuses).toContain("exit 7");
  });

  it("keeps the committed result intact when a canonical rewrite is aborted", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-aborted-rewrite-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "rewrite-session");
    const original = "original exact result";
    const metadata = {
      exchangeId: "o1", toolCallId: "call-1", intentKind: "run" as const, subjectKey: "bash:rewrite",
      resources: [] as string[], mutatesWorkspace: false, modelInputBytes: 1, executedInputBytes: 1,
      outcome: analyzeOutcome(original),
    };
    const archived = await archive.archiveVisibleContent(
      [{ type: "text", text: original }], "bash", false, 1, 1024, undefined, undefined, undefined, metadata,
    );
    const oldChunk = archived!.observation.envelope!.parts.find((part) => part.name === "result")!.chunks[0].relativeFile;
    const controller = new AbortController();
    controller.abort();
    await expect(archive.finalizeExchanges([{
      metadata: { ...metadata, outcome: analyzeOutcome("replacement") },
      toolName: "bash",
      isError: false,
      source: "visible-tool-result",
      parts: [{ name: "result", kind: "result", text: "replacement" }],
      persistedModelInput: { command: "printf replacement" },
      persistedRawResult: { content: [{ type: "text", text: "replacement" }], isError: false },
      resultChangedAfterHook: true,
      canonicalResultChangedAfterHook: true,
      resultText: "replacement",
    }], controller.signal)).rejects.toThrow();
    expect(await archive.readExactText("o1")).toBe(original);
    expect(await readFile(join(archive.sessionPath, oldChunk))).toBeDefined();
    expect(await new ObservationArchive(root, "rewrite-session").readExactText("o1")).toBe(original);
  });

  it("replaces a large initial artifact with the exact small canonical result", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-large-small-"));
    temporaryPaths.push(root);
    const outputPath = join(root, "large-initial.txt");
    await writeFile(outputPath, Array.from({ length: 30000 }, (_, index) =>
      `initial ${index} π🙂 ${"payload".repeat(6)}`
    ).join("\n"));
    const archive = new ObservationArchive(root, "large-small-session");
    const initial = await resolveArchiveText([{ type: "text", text: "initial tail" }], outputPath);
    const metadata = {
      exchangeId: "o1", toolCallId: "call-1", intentKind: "run" as const, subjectKey: "bash:large-small",
      resources: [] as string[], mutatesWorkspace: false, modelInputBytes: 1, executedInputBytes: 1,
      outcome: analyzeOutcome(initial.outcomeText ?? initial.text),
    };
    const archived = await archive.archiveVisibleContent(
      [{ type: "text", text: "initial tail" }], "bash", false, 1, 1024,
      undefined, initial, undefined, metadata,
    );
    const oldChunks = archived!.observation.envelope!.parts.find((part) => part.name === "result")!.chunks;
    const finalText = "final canonical small π🙂\n";
    const final = await resolveArchiveText([{ type: "text", text: finalText }]);
    expect(await archive.finalizeExchanges([{
      metadata: { ...metadata, outcome: analyzeOutcome(finalText) },
      toolName: "bash",
      isError: false,
      source: final.source,
      parts: [{
        name: "result", kind: "result", mediaType: "text/plain; charset=utf-8",
        source: final.partSource,
      }],
      persistedModelInput: { command: "printf final" },
      persistedRawResult: { content: [{ type: "text", text: finalText }], isError: false },
      resultChangedAfterHook: true,
      canonicalResultChangedAfterHook: true,
      resultText: final.text,
      largeResult: final.large,
      resultSummary: final,
    }])).toHaveLength(1);
    expect(await archive.readExactText("o1")).toBe(finalText);
    const current = await archive.findObservation("o1");
    expect(current.envelope?.parts.filter((part) => part.name === "result" && part.kind === "result"))
      .toHaveLength(1);
    for (const chunk of oldChunks) {
      await expect(readFile(join(archive.sessionPath, chunk.relativeFile))).rejects.toMatchObject({ code: "ENOENT" });
    }
  });

  it("rolls back sidecars and replacement chunks when session publication fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-finalize-rollback-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "rollback-session");
    const original = "committed original";
    const existingMetadata = {
      exchangeId: "o1", toolCallId: "call-1", intentKind: "run" as const, subjectKey: "bash:o1",
      resources: [] as string[], mutatesWorkspace: false, modelInputBytes: 1, executedInputBytes: 1,
      outcome: analyzeOutcome(original),
    };
    await archive.archiveVisibleContent(
      [{ type: "text", text: original }], "bash", false, 1, 1024,
      undefined, undefined, undefined, existingMetadata,
    );
    const blockedSessionPath = join(archive.sessionPath, "blocked-session-metadata");
    await mkdir(blockedSessionPath);
    (archive as unknown as { sessionMetadataPath: string }).sessionMetadataPath = blockedSessionPath;
    const replacement = "replacement that must roll back";
    const newResult = "new result that must not publish";
    const newMetadata = {
      ...existingMetadata,
      exchangeId: "o2",
      toolCallId: "call-2",
      subjectKey: "bash:o2",
      outcome: analyzeOutcome(newResult),
    };
    await expect(archive.finalizeExchanges([
      {
        metadata: { ...existingMetadata, outcome: analyzeOutcome(replacement) },
        toolName: "bash", isError: false, source: "visible-tool-result",
        parts: [{ name: "result", kind: "result", text: replacement }],
        persistedModelInput: { command: "replace" },
        persistedRawResult: { content: [{ type: "text", text: replacement }], isError: false },
        resultChangedAfterHook: true, canonicalResultChangedAfterHook: true, resultText: replacement,
      },
      {
        metadata: newMetadata,
        toolName: "bash", isError: false, source: "visible-tool-result",
        parts: [{ name: "result", kind: "result", text: newResult }],
        persistedModelInput: { command: "new" },
        persistedRawResult: { content: [{ type: "text", text: newResult }], isError: false },
        resultText: newResult,
      },
    ])).rejects.toThrow();
    expect(await archive.readExactText("o1")).toBe(original);
    await expect(archive.findObservation("o2")).rejects.toThrow("Unknown observation ID");
    await expect(readFile(join(archive.observationsPath, "o2.meta.json"))).rejects.toMatchObject({ code: "ENOENT" });
    const files = await readdir(archive.observationsPath);
    expect(files.some((name) => name.includes(".g-") || name.startsWith("o2."))).toBe(false);
    const reopened = new ObservationArchive(root, "rollback-session");
    expect(await reopened.readExactText("o1")).toBe(original);
    await expect(reopened.findObservation("o2")).rejects.toThrow("Unknown observation ID");
  });

  it("streams exact large reconciliation beyond bounded sample positions", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-exact-reconcile-"));
    temporaryPaths.push(root);
    const original = `${"a".repeat(1200 * 1024)}\n`;
    const originalPath = join(root, "original.txt");
    await writeFile(originalPath, original);
    const resolved = await resolveArchiveText([{ type: "text", text: "tail" }], originalPath);
    const archive = new ObservationArchive(root, "exact-reconcile-session");
    await archive.archiveVisibleContent(
      [{ type: "text", text: "tail" }], "bash", false, 1, 1024,
      undefined, resolved, undefined,
      {
        exchangeId: "o1", toolCallId: "call-1", intentKind: "run", subjectKey: "bash:exact",
        resources: [], mutatesWorkspace: false, modelInputBytes: 1, executedInputBytes: 1,
        outcome: analyzeOutcome(resolved.outcomeText ?? resolved.text),
      },
    );
    expect(await archive.sourceEqualsPart("o1", "result", { kind: "path", path: originalPath })).toBe(true);
    const mutationOffset = Math.floor(original.length * 0.1);
    const changed = `${original.slice(0, mutationOffset)}X${original.slice(mutationOffset + 1)}`;
    const changedPath = join(root, "changed.txt");
    await writeFile(changedPath, changed);
    expect(changed.length).toBe(original.length);
    expect(boundedResultTextStats([{ type: "text", text: changed }], 64 * 1024).samples)
      .toEqual(boundedResultTextStats([{ type: "text", text: original }], 64 * 1024).samples);
    expect(await archive.sourceEqualsPart("o1", "result", { kind: "path", path: changedPath })).toBe(false);
  });

  it("deduplicates mixed v1, indexed v2, and standalone v2 records on a fresh reopen", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-mixed-catalog-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "mixed-session");
    const standalone = await archive.archiveVisibleContent(
      [{ type: "text", text: "standalone v2" }], "bash", false, 1, 1024, undefined, undefined, undefined,
      {
        exchangeId: "o4", toolCallId: "call-4", intentKind: "run", subjectKey: "bash:o4",
        resources: [], mutatesWorkspace: false, modelInputBytes: 1, executedInputBytes: 1,
        outcome: analyzeOutcome("standalone v2"),
      },
    );
    const template = structuredClone(standalone!.observation.envelope!);
    template.id = "o2";
    template.toolCallId = "call-2";
    template.parts[0].chunks[0].relativeFile = join("observations", "o2.result.0001.txt.gz");
    template.parts[0].textBytes = Buffer.byteLength("indexed v2");
    template.parts[0].lineCount = 1;
    template.parts[0].chunks[0].textBytes = Buffer.byteLength("indexed v2");
    template.parts[0].chunks[0].lineCount = 1;
    await writeFile(join(archive.sessionPath, template.parts[0].chunks[0].relativeFile), gzipSync("indexed v2"));
    await writeFile(join(archive.observationsPath, "o2.meta.json"), `${JSON.stringify(template, null, 2)}\n`);
    const legacyText = "legacy v1";
    await writeFile(join(archive.observationsPath, "legacy.txt.gz"), gzipSync(legacyText));
    await writeFile(archive.indexPath, `${JSON.stringify({
      schema: "prime-context.observation-index/v1",
      observations: [
        {
          id: "legacy", relativeFile: join("observations", "legacy.txt.gz"), toolName: "bash", isError: false,
          textBytes: Buffer.byteLength(legacyText), lineCount: 1, createdAt: new Date(0).toISOString(),
        },
        { schema: "prime-context.exchange/v2", id: "o2", relativeFile: join("observations", "o2.meta.json") },
      ],
    }, null, 2)}\n`);

    const reopened = new ObservationArchive(root, "mixed-session");
    expect((await reopened.list()).map((record) => record.id)).toEqual(["o4", "o2", "legacy"]);
    expect(await reopened.count()).toBe(3);
    expect(await reopened.readExactText("legacy")).toBe(legacyText);
    expect(await reopened.readExactText("o2")).toBe("indexed v2");
    expect(await reopened.readExactText("o4")).toBe("standalone v2");
    expect(await reopened.clear()).toBe(3);
    expect(await reopened.count()).toBe(0);
    await expect(readdir(reopened.observationsPath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(reopened.indexPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("publishes no files when admission is aborted", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-abort-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "abort-session");
    const content = [{ type: "text" as const, text: `${"line\n".repeat(300000)}tail` }];
    const resolved = await resolveArchiveText(content);
    const controller = new AbortController();
    controller.abort();
    await expect(archive.archiveVisibleContent(
      content, "bash", false, 1, 1024, controller.signal, resolved, undefined,
      {
        exchangeId: "o1", toolCallId: "abort", intentKind: "run", subjectKey: "bash:abort",
        resources: [], mutatesWorkspace: false, modelInputBytes: 1, executedInputBytes: 1,
        outcome: analyzeOutcome(resolved.outcomeText ?? resolved.text),
      },
    )).rejects.toThrow();
    expect(content[0].text.endsWith("tail")).toBe(true);
    const reopened = new ObservationArchive(root, "abort-session");
    expect(await reopened.count()).toBe(0);
    await expect(readdir(reopened.observationsPath)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("observation listing", () => {
  it("lists recent observation IDs newest first with a caller-selected limit", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-list-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "session-list");
    const first = await archive.archiveVisibleContent([{ type: "text", text: "first" }], "bash", false, 1, 1024);
    const second = await archive.archiveVisibleContent([{ type: "text", text: "second" }], "ipython", true, 1, 1024);

    const listed = await archive.list(1);

    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(second?.observation.id);
    expect(listed[0].id).not.toBe(first?.observation.id);
    expect(listed[0]).toMatchObject({ toolName: "ipython", isError: true, textBytes: 6 });
  });

  it("reports an empty session without manufacturing observation entries", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-list-empty-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "session-list-empty");

    expect(await archive.list()).toEqual([]);
  });
});

describe("recent observation search", () => {
  it("finds a fixed string across recent observations in one call", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-search-recent-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "session-search-recent");
    const first = await archive.archiveVisibleContent(
      [{ type: "text", text: "before\n[FATAL] first failure\nafter" }],
      "bash",
      true,
      1,
      1024,
    );
    const second = await archive.archiveVisibleContent(
      [{ type: "text", text: "start\n[fatal] second failure\nend" }],
      "ipython",
      true,
      1,
      1024,
    );

    const result = await archive.searchRecent("[fatal]");

    expect(result).toContain(first!.observation.id);
    expect(result).toContain(second!.observation.id);
    expect(result).toContain("first failure");
    expect(result).toContain("second failure");
  });

  it("returns a clear result when the session has no observations", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-search-recent-empty-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "session-search-recent-empty");

    expect(await archive.searchRecent("failure")).toBe("No archived observations in this session.");
  });
});

describe("failure-line selection", () => {
  it("keeps a decisive error after a long run of warnings", () => {
    const text = [
      ...Array.from({ length: 20 }, (_, index) => `setup ${index}`),
      ...Array.from({ length: 30 }, (_, index) => `warning ${index}`),
      "ERROR decisive failure",
      ...Array.from({ length: 60 }, (_, index) => `tail ${index}`),
    ].join("\n");

    expect(selectCapsuleLines(text)).toContain("ERROR decisive failure");
  });

  it("still fills failure slots with warnings when no decisive failure exists", () => {
    const text = [
      ...Array.from({ length: 20 }, (_, index) => `setup ${index}`),
      ...Array.from({ length: 25 }, (_, index) => `warning ${index}`),
      ...Array.from({ length: 60 }, (_, index) => `tail ${index}`),
    ].join("\n");
    const selected = selectCapsuleLines(text, false);

    expect(selected.filter((line) => line.startsWith("warning "))).toHaveLength(20);
  });
});

describe("adaptive capsules", () => {
  it("uses a small capsule for repetitive test output and keeps the result line", () => {
    const text = [
      "TEST_RESULT PASS 8/8",
      ...Array.from({ length: 200 }, (_, index) => `TRACE case=1 line=${index} payload-${"x".repeat(80)}`),
    ].join("\n");

    expect(isRepetitiveOutput(text)).toBe(true);
    expect(hasTerminalOutcome(text)).toBe(true);
    expect(adaptiveCapsuleMaxBytes(text, 6144)).toBe(768);
    expect(selectCapsuleLines(text)).toContain("TEST_RESULT PASS 8/8");
    const capsule = renderCapsule(text, {
      id: "obs_test",
      toolName: "ipython",
      textBytes: utf8Bytes(text),
      lineCount: 201,
    }, adaptiveCapsuleMaxBytes(text, 6144));
    expect(capsule).toContain("L1: TEST_RESULT PASS 8/8");
    expect(capsule).not.toContain("TRACE case=1");
    expect(utf8Bytes(capsule)).toBeLessThanOrEqual(768);
    expect(capsule).toContain("Archived; clean command success summarized.");
    expect(capsule).not.toContain("Read:");
    expect(capsule).not.toContain("Search:");
    const failedText = [
      "exit 1",
      "TEST_RESULT FAIL 2/8",
      "  self.assertEqual(actual, expected)",
      "  with self.open(encoding=encoding, errors=errors)",
      "- A failed record operation leaves the league unchanged.",
      "FAIL test_base ModuleNotFoundError: No module named 'stockroom.inventory'",
      "FAIL test_pivot AssertionError: wrong total",
      'File "/tmp/inventory.py", line 42, in run',
      "AssertionError: wrong total",
      ...Array.from({ length: 200 }, (_, index) => `TRACE failure line=${index}`),
    ].join("\n");
    expect(adaptiveCapsuleMaxBytes(failedText, 6144)).toBe(1024);
    const selectedFailureLines = selectCapsuleLines(failedText);
    expect(selectedFailureLines).toEqual(expect.arrayContaining([
      "TEST_RESULT FAIL 2/8",
      "FAIL test_base ModuleNotFoundError: No module named 'stockroom.inventory'",
      "FAIL test_pivot AssertionError: wrong total",
      "AssertionError: wrong total",
      'File "/tmp/inventory.py", line 42, in run',
      "exit 1",
      "  self.assertEqual(actual, expected)",
    ]));
    expect(selectedFailureLines.some((line) => line.startsWith("TRACE"))).toBe(false);
    expect(hasTerminalOutcome("Ran 3 tests in 0.01s\n\nOK\n")).toBe(true);
    expect(hasTerminalOutcome("Ran 3 tests in 0.01s\n\nFAILED (failures=1)\n")).toBe(true);
    const failureContext = selectCapsuleLines("setup fixture\nAssertionError: wrong value\nactual=3\nunrelated");
    expect(failureContext).toContain("setup fixture");
    expect(failureContext).toContain("actual=3");
    expect(selectCapsuleLines("prefix\nOK\n".repeat(30), true)[0]).toBe("OK");
    const shapedFailures = selectCapsuleLines("Error item 1\ncontext a\nneutral\nError item 2\ncontext b", true);
    expect(shapedFailures.filter((line) => line.startsWith("Error item")).length).toBe(2);
    const longFailure = selectCapsuleLines(`AssertionError: ${"x".repeat(2000)}`, true)[0];
    expect(utf8Bytes(longFailure)).toBeLessThanOrEqual(384);
    expect(longFailure.endsWith("...")).toBe(true);
  });

  it("focuses the recovery read around the highest-priority selected line", () => {
    const text = [
      ...Array.from({ length: 50 }, (_, index) => `detail ${index}`),
      "AssertionError: ratio mismatch",
      ...Array.from({ length: 49 }, (_, index) => `tail ${index}`),
    ].join("\n");
    const capsule = renderCapsule(text, {
      id: "obs_focused",
      toolName: "ipython",
      textBytes: utf8Bytes(text),
      lineCount: 100,
    }, 2000);
    expect(capsule).toContain("L51: AssertionError: ratio mismatch");
    expect(capsule).toContain("startLine=31 endLine=61");
  });

  it("keeps exact coordinates when long selected lines share a displayed prefix", () => {
    const shared = "x".repeat(390);
    const text = `${shared} neutral\n${shared} AssertionError: boom`;
    const displayed = selectCapsuleLines(text)[0];
    const capsule = renderCapsule(text, {
      id: "obs_coordinates",
      toolName: "ipython",
      textBytes: utf8Bytes(text),
      lineCount: 2,
    }, 2000);
    expect(capsule.indexOf(`L2: ${displayed}`)).toBeLessThan(capsule.indexOf(`L1: ${displayed}`));
  });

  it("only suggests a fallback search string that exists in the archive", () => {
    const fallbackText = "alpha_token details\n123 !!!";
    const capsule = renderCapsule(fallbackText, {
      id: "obs_fallback",
      toolName: "ipython",
      textBytes: utf8Bytes(fallbackText),
      lineCount: 2,
    }, 1024);
    expect(capsule).toContain('query="alpha_token"');

    const failedTestText = "TEST_RESULT FAIL 3/6\nFAIL test_pivot.PivotTests.test_denied AssertionError";
    const failedTestCapsule = renderCapsule(failedTestText, {
      id: "obs_failed_test",
      toolName: "ipython",
      textBytes: utf8Bytes(failedTestText),
      lineCount: 2,
    }, 1024);
    expect(failedTestCapsule).toContain('query="FAIL test_pivot.PivotTests.test_denied"');

    const punctuationOnly = "123 !!!\n---";
    const noSearch = renderCapsule(punctuationOnly, {
      id: "obs_no_search",
      toolName: "ipython",
      textBytes: utf8Bytes(punctuationOnly),
      lineCount: 2,
    }, 1024);
    expect(noSearch).not.toContain("Search: prime_context");
    expect(noSearch).not.toMatch(/\b(?:rerun|complete|audit|launch)\b/i);
  });

  it("packs only complete escaped lines at a tight capsule boundary", () => {
    const text = `TEST_RESULT FAIL 1/1\nAssertionError: ${"&".repeat(300)}`;
    const capsule = renderCapsule(text, {
      id: "obs_tight",
      toolName: "ipython",
      textBytes: utf8Bytes(text),
      lineCount: 2,
    }, 600);
    expect(utf8Bytes(capsule)).toBeLessThanOrEqual(600);
    expect(capsule).toContain("L1: TEST_RESULT FAIL 1/1");
    expect(capsule).not.toContain("AssertionError");
    expect(capsule.endsWith("</prime_context_output>")).toBe(true);
  });

  it("shrinks a non-repetitive capsule as projected context usage rises", () => {
    const text = Array.from({ length: 20 }, (_, index) => `distinct-${String.fromCharCode(65 + index)} value`).join("\n");

    expect(adaptiveCapsuleMaxBytes(text, 6144, { tokens: 850, contextWindow: 1000 })).toBe(1536);
    expect(adaptiveCapsuleMaxBytes(text, 1024, { tokens: 850, contextWindow: 1000 })).toBe(1024);
    expect(adaptiveMinTextBytes(24576, { tokens: 850, contextWindow: 1000 })).toBe(8192);
    expect(adaptiveMinTextBytes(24576, { tokens: 100, contextWindow: 1000 })).toBe(24576);
    const repetitiveProgress = Array.from({ length: 100 }, (_, index) => `progress ${index}`).join("\n");
    expect(hasTerminalOutcome(repetitiveProgress)).toBe(false);
    expect(adaptiveCapsuleMaxBytes(repetitiveProgress, 6144)).toBe(2048);
  });
});

describe("public complete-output adapter", () => {
  it("archives the typed Bash complete-output source instead of its truncated visible text", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-complete-output-"));
    temporaryPaths.push(root);
    const completePath = join(root, "bash-complete.txt");
    const completeText = "complete line\n".repeat(200);
    await writeFile(completePath, completeText, "utf8");
    const visible = [{ type: "text" as const, text: "truncated visible output" }];
    const resolved = await resolveArchiveText(visible, completePath);
    const archive = new ObservationArchive(root, "session-complete-output");

    const archived = await archive.archiveVisibleContent(visible, "bash", false, 100, 1024, undefined, resolved);

    expect(archived?.observation.source).toBe("public-complete-output");
    expect(await archive.readExactText(archived!.observation.id)).toBe(completeText);
    expect((archived?.content[0] as { text: string }).text).toContain('source="public-complete-output"');
  });

  it("opens the complete-output path before touching visible fallback text", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-path-first-"));
    temporaryPaths.push(root);
    const outputPath = join(root, "full.txt");
    await writeFile(outputPath, "streamed first", "utf8");
    const content = [{
      type: "text" as const,
      get text(): string {
        throw new Error("visible fallback should not be read");
      },
    }];
    await expect(resolveArchiveText(content, outputPath)).resolves.toMatchObject({
      text: "streamed first", source: "public-complete-output",
    });
  });

  it("falls back to public visible text when the complete-output file is unavailable", async () => {
    const visible = [{ type: "text" as const, text: "visible fallback" }];

    await expect(resolveArchiveText(visible, "/missing/prime-context-complete-output.txt")).resolves.toEqual({
      text: "visible fallback",
      source: "visible-tool-result",
    });
  });
});

describe("search context windows", () => {
  it("freezes multi-block visible fallback strings before deferred archival", async () => {
    const content = [
      { type: "text" as const, text: "original one\n" },
      { type: "text" as const, text: "original two" },
    ];
    const resolved = await resolveArchiveText(content);
    content[0].text = "changed one";
    content[1].text = "changed two";
    const summary = await summarizePartSource(resolved.partSource!);
    expect(summary.exactText).toBe("original one\noriginal two");
    expect(summary.textBytes).toBe(Buffer.byteLength("original one\noriginal two", "utf8"));
  });

  it("merges overlapping context for nearby matches without repeating lines", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-search-context-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "session-search-context");
    const archived = await archive.archiveVisibleContent(
      [{ type: "text", text: "before\nneedle one\nneedle two\nafter" }],
      "bash",
      false,
      1,
      1024,
    );

    const result = await archive.search(archived!.observation.id, "needle");

    expect(result).toContain("Matches at lines 2, 3:");
    expect(result.match(/2: needle one/g)).toHaveLength(1);
    expect(result.match(/3: needle two/g)).toHaveLength(1);
  });

  it("supports a caller-selected context radius and rejects oversized radii", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-search-radius-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "session-search-radius");
    const archived = await archive.archiveVisibleContent(
      [{ type: "text", text: "zero\none\ntwo\nneedle\nfour\nfive\nsix" }],
      "bash",
      false,
      1,
      1024,
    );

    const result = await archive.search(archived!.observation.id, "needle", 2);

    expect(result).toContain("2: one");
    expect(result).toContain("6: five");
    expect(result).not.toContain("1: zero");
    expect(result).not.toContain("7: six");
    await expect(archive.search(archived!.observation.id, "needle", 21))
      .rejects.toThrow("contextLines must be an integer from 0 to 20.");
  });

  it("pages observation and recent searches by deterministic match offset", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-search-offset-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "session-search-offset");
    const first = await archive.archiveVisibleContent(
      [{ type: "text", text: Array.from({ length: 60 }, (_, index) => `hit ${index}`).join("\n") }],
      "bash",
      false,
      1,
      1024,
    );
    const second = await archive.archiveVisibleContent(
      [{ type: "text", text: "hit recent 0\nhit recent 1\nhit recent 2" }],
      "ipython",
      false,
      1,
      1024,
    );

    const page = await archive.search(first!.observation.id, "hit", 0, 50);
    expect(page).toContain("> 51: hit 50");
    expect(page).not.toContain("> 50: hit 49");
    expect(page).toContain("Earlier matches exist.");

    const limited = await archive.search(first!.observation.id, "hit", 0, 10, 3);
    expect(limited).toContain("> 11: hit 10");
    expect(limited).toContain("> 13: hit 12");
    expect(limited).not.toContain("> 14: hit 13");
    expect(limited).toContain("Search stopped at the requested match limit; continue at match offset 13.");

    const recentLimited = await archive.searchRecent("hit", 20, 0, 0, 2);
    expect(recentLimited).toContain(second!.observation.id);
    expect(recentLimited).not.toContain(first!.observation.id);
    expect(recentLimited).toContain("Search stopped at the requested match limit; continue at match offset 2.");

    const recentPage = await archive.searchRecent("hit", 20, 0, 3);
    expect(recentPage).toContain(first!.observation.id);
    expect(recentPage).not.toContain(second!.observation.id);
    expect(recentPage).toContain("> 1: hit 0");
    await expect(archive.search(first!.observation.id, "hit", 1, 10001))
      .rejects.toThrow("matchOffset must be an integer from 0 to 10000.");
    await expect(archive.search(first!.observation.id, "hit", 1, 0, 0))
      .rejects.toThrow("maxMatches must be an integer from 1 to 50.");
  });

  it("stops recent search at an exact global match limit before older records", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-search-limit-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "session-search-limit");
    const older = await archive.archiveVisibleContent(
      [{ type: "text", text: Array.from({ length: 5_000 }, (_, index) => `older ${index}`).join("\n") }],
      "ipython", false, 1, 1024,
    );
    const newest = await archive.archiveVisibleContent(
      [{ type: "text", text: "needle one\nneedle two" }],
      "ipython", false, 1, 1024,
    );
    const sidecar = JSON.parse(await readFile(join(archive.observationsPath, `${older!.observation.id}.meta.json`), "utf8"));
    const chunk = sidecar.parts.find((part: { kind: string }) => part.kind === "result").chunks[0].relativeFile as string;
    await rm(join(archive.observationsPath, chunk.split("/").at(-1)!), { force: true });
    const result = await archive.searchRecent("needle", 20, 0, 0, 2);
    expect(result).toContain(newest!.observation.id);
    expect(result).toContain("continue at match offset 2");
  });

  it("keeps separate context blocks for distant matches", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-search-distant-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "session-search-distant");
    const archived = await archive.archiveVisibleContent(
      [{ type: "text", text: "needle first\none\ntwo\nthree\nfour\nneedle second" }],
      "bash",
      false,
      1,
      1024,
    );

    const result = await archive.search(archived!.observation.id, "needle");

    expect(result).toContain("Match at line 1:");
    expect(result).toContain("Match at line 6:");
  });
});

describe("forked pinned observations", () => {
  it("copies only pinned observation files into the fork session archive", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-fork-"));
    temporaryPaths.push(root);
    const parent = new ObservationArchive(root, "parent-session");
    const pinnedOutput = "pinned parent output";
    const pinned = await parent.archiveVisibleContent(
      [{ type: "text", text: pinnedOutput }],
      "bash",
      false,
      1,
      1024,
      undefined,
      undefined,
      undefined,
      {
        exchangeId: "o7", toolCallId: "parent-call", intentKind: "run", subjectKey: "bash:pinned",
        resources: [], mutatesWorkspace: false, modelInputBytes: 1, executedInputBytes: 1,
        outcome: analyzeOutcome(pinnedOutput, false), taskKey: "parent-task", branchAnchorId: "parent-entry",
      },
    );
    await parent.archiveVisibleContent([{ type: "text", text: "not pinned" }], "bash", false, 1, 1024);
    const fork = new ObservationArchive(root, "fork-session");

    expect(await fork.importFrom(parent, [pinned!.observation.id], undefined, {
      taskKey: "child-task", branchAnchorId: "child-root",
    })).toBe(1);
    fork.setBranchScope("child-task", ["child-root"]);
    expect(await fork.count()).toBe(1);
    expect(await fork.readExactText(pinned!.observation.id)).toBe("pinned parent output");
    expect((await fork.list())[0].exchange).toMatchObject({
      exchangeId: "o7", taskKey: "child-task", branchAnchorId: "child-root", forkImported: true,
    });
    expect(await fork.maxExchangeSequence()).toBe(7);
  });

  it("ignores a pinned ID whose parent archive entry no longer exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-fork-missing-"));
    temporaryPaths.push(root);
    const parent = new ObservationArchive(root, "parent-session-missing");
    const fork = new ObservationArchive(root, "fork-session-missing");

    expect(await fork.importFrom(parent, ["obs_missing"])).toBe(0);
    expect(await fork.count()).toBe(0);
  });
});

describe("branch-scoped archive projection", () => {
  it("lists only observations reachable from the selected task branch", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-scope-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "session-scope");
    const text = (label: string) => Array.from({ length: 20 }, (_, index) => `${label} ${index} ${"x".repeat(20)}`).join("\n");
    const ids = new Map<string, string>();
    for (const [exchangeId, toolCallId] of [["o1", "call-selected"], ["o2", "call-abandoned"]]) {
      const output = text(exchangeId);
      const archived = await archive.archiveVisibleContent(
        [{ type: "text", text: output }], "bash", false, 1, 1024,
        undefined, undefined, undefined,
        {
          exchangeId, toolCallId, intentKind: "run", subjectKey: `bash:${exchangeId}`,
          resources: [], mutatesWorkspace: false, modelInputBytes: 1, executedInputBytes: 1,
          outcome: analyzeOutcome(output, false), taskKey: "task",
        },
      );
      ids.set(exchangeId, archived!.observation.id);
    }

    archive.setBranchScope("task", ["call-selected"]);
    expect((await archive.list()).map((observation) => observation.exchange?.exchangeId)).toEqual(["o1"]);
    expect(await archive.count()).toBe(1);
    await expect(archive.readExactText(ids.get("o2")!)).rejects.toThrow("Unknown observation ID");
    archive.setBranchScope("task", ["call-selected"], [ids.get("o2")!]);
    expect(await archive.readExactText(ids.get("o2")!)).toContain("o2");
    archive.setBranchScope("task", ["call-selected"]);
    expect(await archive.updateExchangeRevisions([{
      toolCallId: "call-selected", workspaceRevisionAtStart: 2, workspaceRevisionAtResult: 3,
    }])).toBe(1);
    expect((await archive.list())[0].exchange).toMatchObject({
      workspaceRevisionAtStart: 2, workspaceRevisionAtResult: 3,
    });
  });
});

describe("current-session cleanup", () => {
  it("removes the current session observation files and resets its index", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-cleanup-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "session-cleanup");
    const archived = await archive.archiveVisibleContent(
      [{ type: "text", text: "output to remove" }],
      "bash",
      false,
      1,
      1024,
    );

    expect(await archive.clear()).toBe(1);
    expect(await archive.count()).toBe(0);
    await expect(archive.readExactText(archived!.observation.id)).rejects.toThrow("Unknown observation ID");
  });

  it("handles cleanup of an empty current session", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-cleanup-empty-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "session-cleanup-empty");

    expect(await archive.clear()).toBe(0);
    expect(await archive.count()).toBe(0);
  });
});
