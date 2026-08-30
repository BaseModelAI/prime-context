#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SUPPORTED_VERSION = "0.8.1";
const root = resolve(
  process.argv[2] ?? process.env.PRIME_AGENT_ROOT ?? "/usr/local/lib/node_modules/prime-agent",
);
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
assert.equal(packageJson.name, "prime-agent");
assert.equal(packageJson.version, SUPPORTED_VERSION);

const importFile = (relativePath) => import(pathToFileURL(join(root, relativePath)).href);

function findBundledRuntimeChunk() {
  const bundleRoot = join(root, "dist/bundle");
  const cli = readFileSync(join(bundleRoot, "cli.js"), "utf8");
  const cliMainMatch = cli.match(/import\("\.\/(cli-main-[^"/]+\.js)"\)/);
  assert.ok(cliMainMatch, "bundled CLI main import was not found");
  const cliMain = readFileSync(join(bundleRoot, cliMainMatch[1]), "utf8");
  const imports = [...cliMain.matchAll(/["']\.\/([^"'/]+\.js)["']/g)].map(
    (match) => match[1],
  );
  const candidates = [...new Set(imports)].filter((file) => {
    const text = readFileSync(join(bundleRoot, file), "utf8");
    return (
      text.includes("async function executeToolCalls(currentContext, assistantMessage, config, signal, emit)") &&
      text.includes("turnIndex: this._turnIndex")
    );
  });
  assert.equal(candidates.length, 1, "expected one bundled agent runtime chunk");
  return `dist/bundle/${candidates[0]}`;
}

function findBundledProviderChunk() {
  const bundleRoot = join(root, "dist/bundle");
  const cli = readFileSync(join(bundleRoot, "cli.js"), "utf8");
  const cliMainMatch = cli.match(/import\("\.\/(cli-main-[^"/]+\.js)"\)/);
  assert.ok(cliMainMatch, "bundled CLI main import was not found");
  const pending = [cliMainMatch[1]];
  const visited = new Set();
  const candidates = [];
  while (pending.length > 0) {
    const file = pending.pop();
    if (visited.has(file)) continue;
    visited.add(file);
    const text = readFileSync(join(bundleRoot, file), "utf8");
    if (
      text.includes("async function createAgentSession(options = {})") &&
      text.includes("convertToLlm: convertToLlmWithBlockImages")
    ) {
      candidates.push(file);
    }
    for (const match of text.matchAll(/["']\.\/([^"'/]+\.js)["']/g)) {
      if (existsSync(join(bundleRoot, match[1]))) {
        pending.push(match[1]);
      }
    }
  }
  assert.equal(candidates.length, 1, "expected one active bundled SDK provider chunk");
  return `dist/bundle/${candidates[0]}`;
}

const bundledRuntimeChunk = findBundledRuntimeChunk();
const bundledProviderChunk = findBundledProviderChunk();
const [{ Type }, nonBundled, bundled] = await Promise.all([
  importFile("node_modules/typebox/build/index.mjs"),
  Promise.all([
    importFile("node_modules/@earendil-works/pi-agent-core/dist/agent.js"),
    importFile("dist/core/extensions/runner.js"),
    importFile("dist/core/agent-session.js"),
    importFile("dist/core/compaction/compaction.js"),
    importFile("dist/core/compaction/branch-summarization.js"),
    importFile("dist/core/sdk.js"),
    importFile("dist/core/session-manager.js"),
  ]).then(([agent, runner, session, compaction, branchSummarization, sdk, sessionManager]) => ({
    Agent: agent.Agent,
    ExtensionRunner: runner.ExtensionRunner,
    AgentSession: session.AgentSession,
    findCutPoint: compaction.findCutPoint,
    prepareBranchEntries: branchSummarization.prepareBranchEntries,
    createAgentSession: sdk.createAgentSession,
    SessionManager: sessionManager.SessionManager,
  })),
  Promise.all([importFile(bundledRuntimeChunk), importFile(bundledProviderChunk)]).then(
    ([runtime, provider]) => ({
      ...runtime,
      createAgentSession: provider.createAgentSession,
    }),
  ),
]);

const usage = {
  input: 1,
  output: 1,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 2,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};
const model = {
  id: "host-smoke",
  name: "host-smoke",
  api: "host-smoke",
  provider: "host-smoke",
  baseUrl: "",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 10_000,
  maxTokens: 1_000,
};

function assistant(content, stopReason = "stop", errorMessage) {
  return {
    role: "assistant",
    content,
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage,
    stopReason,
    errorMessage,
    timestamp: Date.now(),
  };
}

function response(message) {
  return {
    async *[Symbol.asyncIterator]() {
      yield { type: "done", reason: message.stopReason, message };
    },
    async result() {
      return message;
    },
  };
}

function customMessage(customType, content, display = false) {
  return { role: "custom", customType, content, display, timestamp: Date.now() };
}

function toolResult(toolCallId, text, details = { cold: "x".repeat(20_000) }) {
  return {
    role: "toolResult",
    toolCallId,
    toolName: "echo",
    content: [{ type: "text", text }],
    details,
    isError: false,
    timestamp: Date.now(),
  };
}

function sessionEntries(prefix, messages) {
  let parentId = null;
  return messages.map((message, index) => {
    const id = `${prefix}-${index}`;
    const entry = {
      type: "message",
      id,
      parentId,
      timestamp: new Date(1_700_000_000_000 + index).toISOString(),
      message,
    };
    parentId = id;
    return entry;
  });
}

function entryRefs(entries) {
  return entries.map((entry, messageIndex) => ({ messageIndex, entryId: entry.id }));
}

function textOf(message) {
  return Array.isArray(message.content)
    ? message.content.find((part) => part.type === "text")?.text
    : message.content;
}

async function runProjectionSurface(
  name,
  { ExtensionRunner, AgentSession, SessionManager, findCutPoint, prepareBranchEntries },
) {
  assert.equal(typeof findCutPoint, "function");
  assert.equal(typeof prepareBranchEntries, "function");
  assert.equal(typeof ExtensionRunner.prototype.projectContext, "function");

  const errors = [];
  const rawPurposes = [];
  const modelPurposes = [];
  const providerRaw = [
    {
      role: "bashExecution",
      command: "secret",
      output: "excluded",
      exitCode: 0,
      cancelled: false,
      truncated: false,
      excludeFromContext: true,
      timestamp: Date.now(),
    },
    {
      role: "bashExecution",
      command: "printf included",
      output: "included",
      exitCode: 0,
      cancelled: false,
      truncated: false,
      timestamp: Date.now(),
    },
    { role: "user", content: [{ type: "text", text: "raw-user" }], timestamp: Date.now() },
    assistant([{ type: "toolCall", id: "provider-call", name: "echo", arguments: {} }]),
    toolResult("provider-call", "provider result"),
    customMessage("provider-visible", "visible custom"),
    customMessage("refinement_outcome", "host-only outcome"),
    { role: "branchSummary", summary: "branch checkpoint", fromId: "branch-from", timestamp: Date.now() },
  ];
  const providerEntries = sessionEntries(`${name}-provider`, providerRaw);
  const providerRefs = entryRefs(providerEntries);
  const providerSnapshot = structuredClone(providerRaw);

  const runner = Object.create(ExtensionRunner.prototype);
  runner.createContext = () => ({});
  runner.emitError = (error) => errors.push(error);
  runner.extensions = [
    {
      path: `${name}-projection-first.mjs`,
      handlers: new Map([
        [
          "context",
          [
            async (event) => {
              rawPurposes.push(event.purpose);
              assert.ok(
                event.entryRefs?.every(
                  (ref) => Number.isInteger(ref.messageIndex) && typeof ref.entryId === "string",
                ),
                `${name} ${event.purpose} raw refs must be exact entry IDs`,
              );
              if (event.purpose === "provider") {
                assert.equal(event.messages[0].role, "bashExecution");
                assert.ok(event.messages[4].details.cold.length > 10_000);
                assert.deepEqual(event.entryRefs, providerRefs);
                event.messages[2].content[0].text = "context-user";
                event.messages[4].details.stage = "raw-context";
                return { messages: event.messages };
              }
              return undefined;
            },
          ],
        ],
        [
          "model_context",
          [
            async (event) => {
              modelPurposes.push(event.purpose);
              assert.ok(
                event.messages.every((message) =>
                  ["user", "assistant", "toolResult"].includes(message.role),
                ),
              );
              assert.ok(
                event.messages
                  .filter((message) => message.role === "toolResult")
                  .every((message) => !Object.hasOwn(message, "details")),
                `${name} ${event.purpose} model context must omit tool details`,
              );

              if (event.purpose === "provider") {
                const removedIndex = event.messages.findIndex(
                  (message) => message.role === "user" && textOf(message) === "visible custom",
                );
                const keep = event.messages.map((_message, index) => index !== removedIndex);
                const messages = event.messages.filter((_message, index) => keep[index]);
                const refs = (event.entryRefs ?? [])
                  .filter((ref) => keep[ref.messageIndex])
                  .map((ref) => ({
                    messageIndex:
                      ref.messageIndex - keep.slice(0, ref.messageIndex).filter((value) => !value).length,
                    entryId: ref.entryId,
                  }));
                return { messages, entryRefs: refs };
              }
              if (event.purpose === "compaction") {
                return {
                  messages: event.messages.map((message, index) => {
                    if (!Array.isArray(message.content)) return message;
                    return {
                      ...message,
                      content: message.content.flatMap((part) => {
                        if (part.type === "text") return [{ ...part, text: `p${index}` }];
                        return part.type === "toolCall" ? [] : [part];
                      }),
                    };
                  }),
                };
              }
              if (event.purpose === "branch-summary") {
                const removedIndex = event.messages.findIndex(
                  (message) => message.role === "toolResult" && message.toolCallId === "orphan-call",
                );
                const messages = event.messages.filter((_message, index) => index !== removedIndex);
                const refs = (event.entryRefs ?? [])
                  .filter((ref) => ref.messageIndex !== removedIndex)
                  .map((ref) => ({
                    messageIndex: ref.messageIndex - Number(ref.messageIndex > removedIndex),
                    entryId: ref.entryId,
                  }));
                return { messages, entryRefs: refs };
              }
              if (event.purpose === "refine") {
                return {
                  messages: event.messages.map((message) =>
                    message.role === "user"
                      ? { ...message, content: [{ type: "text", text: "FROZEN-REFINE" }] }
                      : message,
                  ),
                };
              }
              assert.fail(`unexpected context purpose: ${event.purpose}`);
            },
          ],
        ],
      ]),
    },
    {
      path: `${name}-projection-second.mjs`,
      handlers: new Map([
        [
          "model_context",
          [
            async (event) => {
              if (event.purpose === "provider") {
                assert.deepEqual(event.entryRefs, [
                  { messageIndex: 0, entryId: providerEntries[1].id },
                  { messageIndex: 1, entryId: providerEntries[2].id },
                  { messageIndex: 2, entryId: providerEntries[3].id },
                  { messageIndex: 3, entryId: providerEntries[4].id },
                  { messageIndex: 4, entryId: providerEntries[7].id },
                ]);
                event.messages[1].content[0].text = "model-user";
                return { messages: event.messages };
              }
              return undefined;
            },
          ],
        ],
      ]),
    },
  ];

  const provider = await runner.projectContext(providerRaw, "provider", providerRefs);
  assert.deepEqual(
    provider.messages.map((message) => message.role),
    ["user", "user", "assistant", "toolResult", "user"],
  );
  assert.match(textOf(provider.messages[0]), /printf included/);
  assert.equal(textOf(provider.messages[1]), "model-user");
  assert.deepEqual(provider.entryRefs, [
    { messageIndex: 0, entryId: providerEntries[1].id },
    { messageIndex: 1, entryId: providerEntries[2].id },
    { messageIndex: 2, entryId: providerEntries[3].id },
    { messageIndex: 3, entryId: providerEntries[4].id },
    { messageIndex: 4, entryId: providerEntries[7].id },
  ]);
  assert.deepEqual(providerRaw, providerSnapshot, `${name} provider projection mutated raw context`);

  const dropRunner = Object.create(ExtensionRunner.prototype);
  dropRunner.createContext = () => ({});
  dropRunner.emitError = (error) => errors.push(error);
  dropRunner.extensions = [
    {
      path: `${name}-drop-refs.mjs`,
      handlers: new Map([
        [
          "model_context",
          [async (event) => ({ messages: event.messages.slice(1) })],
        ],
      ]),
    },
  ];
  const dropped = await dropRunner.projectContext(providerRaw, "provider", providerRefs);
  assert.equal(dropped.entryRefs, undefined, "count changes without returned refs must drop refs");

  const positionalRaw = [
    { role: "user", content: [{ type: "text", text: "first" }], timestamp: Date.now() },
    { role: "user", content: [{ type: "text", text: "second" }], timestamp: Date.now() },
  ];
  const positionalEntries = sessionEntries(`${name}-positional`, positionalRaw);
  const positionalRefs = entryRefs(positionalEntries);
  const positionalRunner = Object.create(ExtensionRunner.prototype);
  positionalRunner.createContext = () => ({});
  positionalRunner.emitError = (error) => errors.push(error);
  positionalRunner.extensions = [
    {
      path: `${name}-positional-refs.mjs`,
      handlers: new Map([
        ["model_context", [async (event) => ({ messages: [...event.messages].reverse() })]],
      ]),
    },
  ];
  const reordered = await positionalRunner.projectContext(positionalRaw, "provider", positionalRefs);
  assert.deepEqual(reordered.messages.map(textOf), ["second", "first"]);
  assert.deepEqual(reordered.entryRefs, positionalRefs, "same-count handler results keep positional refs");

  const transformRunner = Object.create(ExtensionRunner.prototype);
  transformRunner.createContext = () => ({});
  transformRunner.emitError = (error) => errors.push(error);
  transformRunner.extensions = [];
  const sameCountTransform = await transformRunner.projectContext(
    positionalRaw,
    "provider",
    positionalRefs,
    (messages) => messages.map((message) => ({ ...message })),
  );
  assert.deepEqual(sameCountTransform.entryRefs, positionalRefs);
  const countChangingTransform = await transformRunner.projectContext(
    positionalRaw,
    "provider",
    positionalRefs,
    (messages) => messages.slice(1),
  );
  assert.equal(countChangingTransform.entryRefs, undefined);

  const thresholdAssistant = {
    ...assistant([{ type: "text", text: "RAW-THRESHOLD".repeat(2_000) }]),
    usage: { ...usage, totalTokens: 9_999 },
  };
  const thresholdRaw = [
    thresholdAssistant,
    toolResult("threshold-call", "raw threshold result", { giant: "x".repeat(100_000) }),
  ];
  const thresholdSnapshot = structuredClone(thresholdRaw);
  assert.ok(thresholdAssistant.usage.totalTokens > 7_000);
  assert.ok(thresholdRaw[1].details.giant.length > 7_000);
  const thresholdEntries = sessionEntries(`${name}-threshold`, thresholdRaw);
  const thresholdRefs = entryRefs(thresholdEntries);
  const thresholdErrors = [];
  let thresholdProjectionText = "tiny";
  let thresholdProjectionCalls = 0;
  const thresholdRunner = Object.create(ExtensionRunner.prototype);
  thresholdRunner.createContext = () => ({});
  thresholdRunner.emitError = (error) => thresholdErrors.push(error);
  thresholdRunner.extensions = [
    {
      path: `${name}-threshold-projection.mjs`,
      handlers: new Map([
        [
          "model_context",
          [
            async (event) => {
              assert.equal(event.purpose, "compaction");
              thresholdProjectionCalls++;
              return {
                messages: [
                  {
                    role: "user",
                    content: [{ type: "text", text: thresholdProjectionText }],
                    timestamp: Date.now(),
                  },
                ],
                entryRefs: [{ messageIndex: 0, entryId: thresholdEntries[0].id }],
              };
            },
          ],
        ],
      ]),
    },
  ];
  const thresholdSurface = {
    agent: { state: { messages: thresholdRaw } },
    sessionManager: {
      getContextEntryRefs(messages) {
        assert.equal(messages, thresholdRaw);
        return thresholdRefs;
      },
      getBranch: () => [],
    },
    async _projectContext(purpose, messages, refs) {
      return thresholdRunner.projectContext(messages, purpose, refs);
    },
    _getThresholdContextTokens: AgentSession.prototype._getThresholdContextTokens,
    settingsManager: {
      getCompactionSettings: () => ({ enabled: true, reserveTokens: 3_000, keepRecentTokens: 2_000 }),
    },
    model: { ...model, contextWindow: 10_000 },
    _queueGoalContinuationForThresholdCompaction: () => false,
    _queueAutonomousContinuationForThresholdCompaction: async () => false,
    _continueAfterThresholdCompaction: false,
  };
  const smallThresholdTokens = await AgentSession.prototype._getThresholdContextTokens.call(
    thresholdSurface,
    thresholdAssistant,
    undefined,
  );
  assert.equal(smallThresholdTokens, 1);
  assert.equal(
    await AgentSession.prototype._thresholdCompactionNeeded.call(thresholdSurface, {
      message: thresholdAssistant,
    }),
    false,
    `${name} projected-small context must not compact`,
  );

  thresholdProjectionText = "L".repeat(32_000);
  const largeThresholdTokens = await AgentSession.prototype._getThresholdContextTokens.call(
    thresholdSurface,
    thresholdAssistant,
    undefined,
  );
  assert.equal(largeThresholdTokens, 8_000);
  assert.equal(
    await AgentSession.prototype._thresholdCompactionNeeded.call(thresholdSurface, {
      message: thresholdAssistant,
    }),
    true,
    `${name} genuinely large projected context must compact`,
  );

  const callsBeforeStaleGuard = thresholdProjectionCalls;
  assert.equal(
    await AgentSession.prototype._getThresholdContextTokens.call(
      thresholdSurface,
      thresholdAssistant,
      thresholdAssistant.timestamp,
    ),
    undefined,
  );
  assert.equal(thresholdProjectionCalls, callsBeforeStaleGuard);
  assert.deepEqual(thresholdRaw, thresholdSnapshot, `${name} threshold projection mutated raw state`);
  assert.deepEqual(thresholdErrors, []);

  const compactionRaw = [
    { role: "user", content: [{ type: "text", text: "old-user" }], timestamp: Date.now() },
    assistant([
      { type: "text", text: "A".repeat(800) },
      {
        type: "toolCall",
        id: "raw-edit-call",
        name: "edit",
        arguments: { path: "/raw-only.txt", oldText: "old", newText: "new" },
      },
    ]),
    { role: "user", content: [{ type: "text", text: "recent-user" }], timestamp: Date.now() },
    {
      ...assistant([{ type: "text", text: "B".repeat(800) }]),
      usage: { ...usage, totalTokens: 9_999 },
    },
    {
      role: "user",
      content: [{ type: "text", text: "LATEST-COLD".repeat(200) }],
      timestamp: Date.now(),
    },
  ];
  const compactionSnapshot = structuredClone(compactionRaw);
  const compactionEntries = sessionEntries(`${name}-compact`, compactionRaw);
  const compactRefs = entryRefs(compactionEntries);
  const compactProjection = await runner.projectContext(
    compactionRaw,
    "compaction",
    compactRefs,
  );
  assert.deepEqual(compactProjection.entryRefs, compactRefs, "same-count compaction replacement keeps refs");
  const rawCut = findCutPoint(compactionEntries, 0, compactionEntries.length, 100);
  const projectedCut = findCutPoint(
    compactionEntries,
    0,
    compactionEntries.length,
    100,
    compactProjection,
  );
  assert.equal(rawCut.firstKeptEntryIndex, 4);
  assert.equal(projectedCut.firstKeptEntryIndex, 0);

  let capturedPreparation;
  const compactionSettings = { enabled: true, reserveTokens: 100, keepRecentTokens: 2 };
  const compactionSurface = {
    sessionManager: {
      getBranch: () => compactionEntries,
      buildSessionContext: () => ({ messages: compactionRaw, entryRefs: compactRefs }),
    },
    settingsManager: { getCompactionSettings: () => compactionSettings },
    async _projectContext(purpose, messages, refs) {
      assert.equal(purpose, "compaction");
      assert.equal(messages, compactionRaw);
      assert.deepEqual(refs, compactRefs);
      return compactProjection;
    },
    _extensionRunner: {
      hasHandlers: (eventType) => eventType === "session_before_compact",
      async emit(event) {
        assert.equal(event.type, "session_before_compact");
        capturedPreparation = event.preparation;
        return { cancel: true };
      },
    },
  };
  await assert.rejects(
    AgentSession.prototype._performCompaction.call(compactionSurface, {
      model,
      apiKey: "",
      headers: {},
      signal: new AbortController().signal,
    }),
    /Compaction cancelled/,
  );
  assert.equal(capturedPreparation.tokensBefore, 5, "projected token count must ignore usage.totalTokens");
  assert.equal(capturedPreparation.firstKeptEntryId, compactionEntries[3].id);
  assert.deepEqual(capturedPreparation.messagesToSummarize.map(textOf), ["p0", "p1"]);
  assert.deepEqual(capturedPreparation.turnPrefixMessages.map(textOf), ["p2"]);
  assert.ok(!JSON.stringify(capturedPreparation.messagesToSummarize).includes("raw-edit-call"));
  assert.deepEqual([...capturedPreparation.fileOps.edited], ["/raw-only.txt"]);

  const refLessProjection = await dropRunner.projectContext(
    compactionRaw,
    "compaction",
    compactRefs,
  );
  assert.equal(refLessProjection.entryRefs, undefined);
  let rawFallbackPreparation;
  const rawFallbackSurface = {
    ...compactionSurface,
    async _projectContext() {
      return refLessProjection;
    },
    _extensionRunner: {
      hasHandlers: (eventType) => eventType === "session_before_compact",
      async emit(event) {
        rawFallbackPreparation = event.preparation;
        return { cancel: true };
      },
    },
  };
  await assert.rejects(
    AgentSession.prototype._performCompaction.call(rawFallbackSurface, {
      model,
      apiKey: "",
      headers: {},
      signal: new AbortController().signal,
    }),
    /Compaction cancelled/,
  );
  assert.equal(rawFallbackPreparation.firstKeptEntryId, compactionEntries[4].id);
  assert.equal(rawFallbackPreparation.tokensBefore, 10_549);
  assert.equal(rawFallbackPreparation.previousSummary, undefined);
  assert.ok(JSON.stringify(rawFallbackPreparation.messagesToSummarize).includes("raw-edit-call"));
  assert.deepEqual([...rawFallbackPreparation.fileOps.edited], ["/raw-only.txt"]);

  const previousSessionManager = SessionManager.inMemory(root);
  previousSessionManager.appendMessage({
    role: "user",
    content: [{ type: "text", text: "old before compaction" }],
    timestamp: Date.now(),
  });
  const retainedEntryId = previousSessionManager.appendMessage(assistant([{ type: "text", text: "retained" }]));
  previousSessionManager.appendCompaction("RAW SECRET", retainedEntryId, 500);
  previousSessionManager.appendMessage({
    role: "user",
    content: [{ type: "text", text: "after one" }],
    timestamp: Date.now(),
  });
  previousSessionManager.appendMessage(assistant([{ type: "text", text: "after two" }]));
  previousSessionManager.appendMessage({
    role: "user",
    content: [{ type: "text", text: "after three" }],
    timestamp: Date.now(),
  });
  const previousBranch = previousSessionManager.getBranch();
  const previousRawContext = previousSessionManager.buildSessionContext();
  const previousProjection = await transformRunner.projectContext(
    previousRawContext.messages,
    "compaction",
    previousRawContext.entryRefs,
  );
  const previousCompactionEntry = previousBranch.find((entry) => entry.type === "compaction");
  assert.ok(previousCompactionEntry);
  const capturePreviousPreparation = async (projection) => {
    let preparation;
    const surface = {
      sessionManager: {
        getBranch: () => previousBranch,
        buildSessionContext: () => previousRawContext,
      },
      settingsManager: {
        getCompactionSettings: () => ({ enabled: true, reserveTokens: 1, keepRecentTokens: 2 }),
      },
      async _projectContext() {
        return projection;
      },
      _extensionRunner: {
        hasHandlers: (eventType) => eventType === "session_before_compact",
        async emit(event) {
          preparation = event.preparation;
          return { cancel: true };
        },
      },
    };
    await assert.rejects(
      AgentSession.prototype._performCompaction.call(surface, {
        model,
        apiKey: "",
        headers: {},
        signal: new AbortController().signal,
      }),
      /Compaction cancelled/,
    );
    return preparation;
  };
  const unchangedPrevious = await capturePreviousPreparation(previousProjection);
  assert.equal(unchangedPrevious.previousSummary, "RAW SECRET");
  const unchangedSerialized = JSON.stringify({
    previousSummary: unchangedPrevious.previousSummary,
    messagesToSummarize: unchangedPrevious.messagesToSummarize,
    turnPrefixMessages: unchangedPrevious.turnPrefixMessages,
  });
  assert.equal(unchangedSerialized.split("RAW SECRET").length - 1, 1);

  const secretMessageIndex = previousProjection.entryRefs.find(
    (ref) => ref.entryId === previousCompactionEntry.id,
  )?.messageIndex;
  assert.notEqual(secretMessageIndex, undefined);
  const redactedPreviousProjection = {
    messages: previousProjection.messages.map((message, index) =>
      index === secretMessageIndex
        ? { ...message, content: [{ type: "text", text: "REDACTED SUMMARY" }] }
        : message,
    ),
    entryRefs: previousProjection.entryRefs,
  };
  const redactedPrevious = await capturePreviousPreparation(redactedPreviousProjection);
  assert.match(redactedPrevious.previousSummary, /REDACTED SUMMARY/);
  assert.ok(!JSON.stringify(redactedPrevious).includes("RAW SECRET"));

  const previousWithoutSecret = {
    messages: previousProjection.messages.filter((_message, index) => index !== secretMessageIndex),
    entryRefs: previousProjection.entryRefs
      .filter((ref) => ref.messageIndex !== secretMessageIndex)
      .map((ref) => ({
        ...ref,
        messageIndex: ref.messageIndex - Number(ref.messageIndex > secretMessageIndex),
      })),
  };
  const removedPrevious = await capturePreviousPreparation(previousWithoutSecret);
  assert.equal(removedPrevious.previousSummary, undefined);
  assert.ok(!JSON.stringify(removedPrevious).includes("RAW SECRET"));

  assert.deepEqual(compactionRaw, compactionSnapshot, `${name} compaction projection mutated raw`);

  const treeRaw = [
    { role: "user", content: [{ type: "text", text: "tree start" }], timestamp: Date.now() },
    assistant([{ type: "toolCall", id: "complete-call", name: "echo", arguments: {} }]),
    toolResult("complete-call", "complete result"),
    assistant([{ type: "toolCall", id: "orphan-call", name: "echo", arguments: {} }]),
    toolResult("orphan-call", "removed result"),
    { role: "user", content: [{ type: "text", text: "tree tail" }], timestamp: Date.now() },
  ];
  const treeSnapshot = structuredClone(treeRaw);
  const treeEntries = sessionEntries(`${name}-tree`, treeRaw);
  const treeProjection = await runner.projectContext(
    treeRaw,
    "branch-summary",
    entryRefs(treeEntries),
  );
  const preparedBranch = prepareBranchEntries(treeEntries, 10_000, treeProjection);
  const preparedCalls = preparedBranch.messages
    .filter((message) => message.role === "assistant")
    .flatMap((message) => message.content.filter((part) => part.type === "toolCall"))
    .map((part) => part.id);
  const preparedResults = preparedBranch.messages
    .filter((message) => message.role === "toolResult")
    .map((message) => message.toolCallId);
  assert.deepEqual(preparedCalls, ["complete-call"]);
  assert.deepEqual(preparedResults, ["complete-call"]);
  assert.deepEqual(treeRaw, treeSnapshot, `${name} tree projection mutated raw`);

  const refineRaw = [
    { role: "user", content: [{ type: "text", text: "COLD-REFINE" }], timestamp: Date.now() },
  ];
  const refineEntries = sessionEntries(`${name}-refine`, refineRaw);
  let snapshotCalls = 0;
  let reviewMessages;
  let planMessages;
  const refineErrors = [];
  const refineSurface = {
    _autoRefineBranchVersion: 7,
    _assistantTurnsSinceAutoRefine: 1,
    _disposed: false,
    _disposing: false,
    async _snapshotRefineContext() {
      snapshotCalls++;
      return runner.projectContext(refineRaw, "refine", entryRefs(refineEntries));
    },
    async _reviewAutoRefine(_context, _signal, messages) {
      reviewMessages = messages;
      refineRaw[0].content[0].text = "MUTATED-AFTER-SNAPSHOT";
      assert.equal(textOf(messages[0]), "FROZEN-REFINE");
      return { shouldRefine: true, rationale: "host smoke" };
    },
    async _runSerializedRefine(_options, trigger, messages) {
      assert.equal(trigger, "auto");
      planMessages = messages;
    },
    _emitRefineFailed(error) {
      refineErrors.push(error);
    },
  };
  await AgentSession.prototype._runSerializedAutoRefineReview.call(
    refineSurface,
    "turn_interval",
    7,
  );
  assert.deepEqual(refineErrors, []);
  assert.equal(snapshotCalls, 1, `${name} refine projection must be snapped once`);
  assert.equal(planMessages, reviewMessages, `${name} refine review and plan must share one snapshot`);
  assert.equal(textOf(planMessages[0]), "FROZEN-REFINE");

  assert.deepEqual(rawPurposes, ["provider", "compaction", "branch-summary", "refine"]);
  assert.deepEqual(modelPurposes, ["provider", "compaction", "branch-summary", "refine"]);
  assert.deepEqual(errors, []);
}

async function runSdkProviderSurface(name, { createAgentSession, SessionManager }) {
  assert.equal(typeof createAgentSession, "function");
  assert.equal(typeof SessionManager, "function");
  const sessionManager = SessionManager.inMemory(root);
  const rawMessages = [
    {
      role: "bashExecution",
      command: "printf sdk",
      output: "sdk output",
      exitCode: 0,
      cancelled: false,
      truncated: false,
      timestamp: Date.now(),
    },
    customMessage("refinement_outcome", "sdk host-only outcome"),
    { role: "user", content: [{ type: "text", text: "sdk user" }], timestamp: Date.now() },
    assistant([{ type: "toolCall", id: "sdk-call", name: "echo", arguments: {} }]),
    toolResult("sdk-call", "sdk result"),
    customMessage("sdk-visible", "sdk custom"),
  ];
  const rawEntryIds = rawMessages.map((message) => sessionManager.appendMessage(message));
  const rawSnapshot = structuredClone(rawMessages);
  const agentDir = mkdtempSync(join(tmpdir(), "prime-agent-sdk-smoke-"));
  let session;
  try {
    ({ session } = await createAgentSession({
      cwd: root,
      agentDir,
      sessionManager,
      model,
      noTools: "all",
      includeGoals: false,
      prewarmIpythonKernel: false,
    }));
    const rawContext = session.agent.state.messages;
    const contextSnapshot = structuredClone(rawContext);
    const expectedRawRefs = rawEntryIds.map((entryId, messageIndex) => ({
      messageIndex,
      entryId,
    }));
    const runner = session._extensionRunner;
    const projectContext = runner.projectContext;
    let providerCalls = 0;
    let providerRefs;
    runner.projectContext = async function (messages, purpose, refs, transformModelMessages) {
      providerCalls++;
      assert.equal(purpose, "provider");
      assert.equal(messages, rawContext, `${name} SDK must project the agent context directly`);
      assert.deepEqual(refs, expectedRawRefs);
      assert.ok(messages[4].details.cold.length > 10_000);
      const projected = await projectContext.call(
        this,
        messages,
        purpose,
        refs,
        transformModelMessages,
      );
      providerRefs = projected.entryRefs;
      return projected;
    };

    const converted = await session.agent.convertToLlm(rawContext);
    assert.equal(providerCalls, 1);
    assert.deepEqual(
      converted.map((message) => message.role),
      ["user", "user", "assistant", "toolResult", "user"],
    );
    assert.ok(
      converted
        .filter((message) => message.role === "toolResult")
        .every((message) => !Object.hasOwn(message, "details")),
    );
    assert.deepEqual(providerRefs, [
      { messageIndex: 0, entryId: rawEntryIds[0] },
      { messageIndex: 1, entryId: rawEntryIds[2] },
      { messageIndex: 2, entryId: rawEntryIds[3] },
      { messageIndex: 3, entryId: rawEntryIds[4] },
      { messageIndex: 4, entryId: rawEntryIds[5] },
    ]);
    assert.deepEqual(rawContext, contextSnapshot, `${name} SDK provider conversion mutated context`);
    assert.deepEqual(rawMessages, rawSnapshot, `${name} SDK provider conversion mutated session entries`);
  } finally {
    await session?.dispose();
    rmSync(agentDir, { recursive: true, force: true });
  }
}

function createSessionSurface(AgentSession, runner, publicEvents, persisted, boundaryOrder) {
  return {
    _extensionRunner: runner,
    _turnEndMessages: new WeakSet(),
    _turnIndex: 0,
    _capturingCancelledAction: () => undefined,
    _addLoginGuidanceToAuthError: () => {},
    _emit: (event) => publicEvents.push(`${event.type}:${event.message?.customType ?? ""}`),
    _emitExtensionEvent: AgentSession.prototype._emitExtensionEvent,
    sessionManager: {
      recordGitStateIfChanged() {},
      appendCustomMessageEntry(customType, content, display, details) {
        persisted.push({ customType, content, display, details });
        boundaryOrder.push(`persist:${customType}`);
      },
    },
  };
}

async function processSessionBoundary(AgentSession, surface, event) {
  const isTurnEndMessage =
    (event.type === "message_start" || event.type === "message_end") &&
    surface._turnEndMessages.has(event.message);
  if (event.type !== "turn_end" && !isTurnEndMessage) return undefined;
  const result = await AgentSession.prototype._processAgentEvent.call(surface, event);
  if (isTurnEndMessage && event.type === "message_end") {
    surface._turnEndMessages.delete(event.message);
  }
  return result;
}

async function runNormalSurface(name, { Agent, ExtensionRunner, AgentSession }) {
  const handlerOrder = [];
  const boundaryOrder = [];
  const errors = [];
  const publicEvents = [];
  const agentEvents = [];
  const boundaryMessageObjects = [];
  const requiredOwnFields = ["role", "customType", "content", "display", "details", "timestamp"];
  const persisted = [];
  const runner = Object.create(ExtensionRunner.prototype);
  runner.createContext = () => ({});
  runner.emitError = (error) => errors.push(error);
  runner.extensions = [
    {
      path: `${name}-first.mjs`,
      handlers: new Map([
        [
          "turn_end",
          [
            async (event) => {
              await Promise.resolve();
              assert.equal(event.toolExecution, "parallel");
              handlerOrder.push(`h1:${event.turnIndex}`);
              const repeated = customMessage(`one-${event.turnIndex}`, [
                { type: "text", text: "one" },
              ]);
              return { messages: [repeated, repeated] };
            },
            async (event) => {
              await Promise.resolve();
              handlerOrder.push(`bad:${event.turnIndex}`);
              if (event.turnIndex !== 0) return undefined;
              const sparseContent = new Array(1);
              const inherited = Object.create({
                role: "custom",
                customType: "inherited-valid",
                content: "inherited",
                display: false,
                details: { source: "prototype" },
                timestamp: Date.now(),
              });
              return {
                messages: [
                  customMessage("visible-invalid", "bad", true),
                  customMessage("sparse-invalid", sparseContent),
                  inherited,
                ],
              };
            },
          ],
        ],
        [
          "message_end",
          [
            async (event) => {
              if (event.message.role === "custom") {
                await Promise.resolve();
                boundaryOrder.push(`lifecycle:${event.message.customType}`);
              }
            },
          ],
        ],
      ]),
    },
    {
      path: `${name}-second.mjs`,
      handlers: new Map([
        [
          "turn_end",
          [
            async (event) => {
              await Promise.resolve();
              handlerOrder.push(`h2:${event.turnIndex}`);
              return { messages: [customMessage(`two-${event.turnIndex}`, "two")] };
            },
          ],
        ],
      ]),
    },
  ];

  const surface = createSessionSurface(
    AgentSession,
    runner,
    publicEvents,
    persisted,
    boundaryOrder,
  );
  const tool = {
    name: "echo",
    label: "Echo",
    description: "host smoke tool",
    parameters: Type.Object({ value: Type.String() }),
    async execute() {
      return {
        content: [{ type: "text", text: "tool-result" }],
        details: { ok: true },
        terminate: true,
      };
    },
  };
  const replies = [
    assistant(
      [{ type: "toolCall", id: "call-1", name: "echo", arguments: { value: "ok" } }],
      "toolUse",
    ),
    assistant([{ type: "text", text: "done" }]),
  ];
  const stopSnapshots = [];
  let providerCalls = 0;
  let steeringAfterStop = false;
  let agent;
  agent = new Agent({
    initialState: { systemPrompt: "", model, tools: [tool] },
    toolExecution: "parallel",
    streamFn: async () => response(replies[providerCalls++]),
    shouldStopAfterTurn: async (context) => {
      stopSnapshots.push(
        context.context.messages.map((message) =>
          message.role === "custom" ? message.customType : message.role,
        ),
      );
      if (stopSnapshots.length === 1) {
        assert.deepEqual(
          persisted.map((entry) => entry.customType),
          ["one-0", "one-0", "inherited-valid", "two-0"],
          "every turn_end message occurrence must be durable before stop logic",
        );
        agent.steer({
          role: "user",
          content: [{ type: "text", text: "steering" }],
          timestamp: Date.now(),
        });
        return false;
      }
      return true;
    },
  });
  let agentEndMessages;
  agent.subscribe(async (event) => {
    agentEvents.push(`${event.type}:${event.message?.customType ?? ""}`);
    if (event.type === "message_start" && event.message.role === "custom") {
      boundaryMessageObjects.push(event.message);
      assert.ok(requiredOwnFields.every((field) => Object.hasOwn(event.message, field)));
    }
    if (
      event.type === "message_start" &&
      event.message.role === "user" &&
      event.message.content[0]?.type === "text" &&
      event.message.content[0].text === "steering"
    ) {
      steeringAfterStop = stopSnapshots.length === 1;
    }
    if (event.type === "agent_end") {
      agentEndMessages = event.messages;
    }
    return processSessionBoundary(AgentSession, surface, event);
  });

  await agent.prompt("start");

  assert.equal(providerCalls, 2);
  assert.deepEqual(handlerOrder, ["h1:0", "bad:0", "h2:0", "h1:1", "bad:1", "h2:1"]);
  assert.deepEqual(
    errors.map(({ extensionPath, event }) => ({ extensionPath, event })),
    [
      { extensionPath: `${name}-first.mjs`, event: "turn_end" },
      { extensionPath: `${name}-first.mjs`, event: "turn_end" },
    ],
  );
  assert.ok(errors.every((error) => /hidden CustomMessage/.test(error.error)));
  assert.equal(persisted.some((entry) => entry.customType === "sparse-invalid"), false);
  assert.equal(steeringAfterStop, true);
  assert.deepEqual(stopSnapshots[0].slice(-5), [
    "toolResult",
    "one-0",
    "one-0",
    "inherited-valid",
    "two-0",
  ]);
  assert.deepEqual(stopSnapshots[1].slice(-4), ["assistant", "one-1", "one-1", "two-1"]);
  assert.deepEqual(
    persisted.map((entry) => entry.customType),
    ["one-0", "one-0", "inherited-valid", "two-0", "one-1", "one-1", "two-1"],
  );
  assert.notEqual(boundaryMessageObjects[0], boundaryMessageObjects[1]);
  const inheritedSnapshot = boundaryMessageObjects.find(
    (message) => message.customType === "inherited-valid",
  );
  assert.ok(inheritedSnapshot);
  assert.ok(requiredOwnFields.every((field) => Object.hasOwn(inheritedSnapshot, field)));
  assert.deepEqual(boundaryOrder.slice(0, 8), [
    "lifecycle:one-0",
    "persist:one-0",
    "lifecycle:one-0",
    "persist:one-0",
    "lifecycle:inherited-valid",
    "persist:inherited-valid",
    "lifecycle:two-0",
    "persist:two-0",
  ]);
  assert.deepEqual(
    agentEvents.filter((entry) => /message_(start|end):(one|two)-/.test(entry)),
    [
      "message_start:one-0",
      "message_end:one-0",
      "message_start:one-0",
      "message_end:one-0",
      "message_start:two-0",
      "message_end:two-0",
      "message_start:one-1",
      "message_end:one-1",
      "message_start:one-1",
      "message_end:one-1",
      "message_start:two-1",
      "message_end:two-1",
    ],
  );
  assert.deepEqual(
    publicEvents.filter((entry) => /message_(start|end):(one|two)-/.test(entry)),
    agentEvents.filter((entry) => /message_(start|end):(one|two)-/.test(entry)),
  );
  assert.deepEqual(
    agentEvents.filter((entry) => entry.endsWith(":inherited-valid")),
    ["message_start:inherited-valid", "message_end:inherited-valid"],
  );
  assert.deepEqual(
    agent.state.messages.slice(-4).map((message) =>
      message.role === "custom" ? message.customType : message.role,
    ),
    ["assistant", "one-1", "one-1", "two-1"],
  );
  assert.deepEqual(
    agentEndMessages.slice(-4).map((message) =>
      message.role === "custom" ? message.customType : message.role,
    ),
    ["assistant", "one-1", "one-1", "two-1"],
  );
}

async function runErrorSurface(name, { Agent, ExtensionRunner, AgentSession }) {
  const errors = [];
  const persisted = [];
  const boundaryOrder = [];
  const publicEvents = [];
  const runner = Object.create(ExtensionRunner.prototype);
  runner.createContext = () => ({});
  runner.emitError = (error) => errors.push(error);
  runner.extensions = [
    {
      path: `${name}-error.mjs`,
      handlers: new Map([
        [
          "turn_end",
          [
            async (event) => {
              await Promise.resolve();
              assert.equal(event.toolExecution, "parallel");
              return { messages: [customMessage("error-tail", "error tail")] };
            },
          ],
        ],
      ]),
    },
  ];
  const surface = createSessionSurface(
    AgentSession,
    runner,
    publicEvents,
    persisted,
    boundaryOrder,
  );
  let stopCalls = 0;
  let agentEndMessages;
  const failed = assistant([{ type: "text", text: "" }], "error", "expected smoke error");
  const agent = new Agent({
    initialState: { systemPrompt: "", model, tools: [] },
    streamFn: async () => response(failed),
    shouldStopAfterTurn: async () => {
      stopCalls++;
      return true;
    },
  });
  agent.subscribe(async (event) => {
    if (event.type === "agent_end") {
      agentEndMessages = event.messages;
    }
    return processSessionBoundary(AgentSession, surface, event);
  });

  await agent.prompt("fail");

  assert.equal(stopCalls, 0, "error turns must use the direct turn_end/agent_end site");
  assert.deepEqual(errors, []);
  assert.deepEqual(persisted.map((entry) => entry.customType), ["error-tail"]);
  assert.deepEqual(
    agent.state.messages.slice(-2).map((message) =>
      message.role === "custom" ? message.customType : message.stopReason,
    ),
    ["error", "error-tail"],
  );
  assert.deepEqual(
    agentEndMessages.slice(-2).map((message) =>
      message.role === "custom" ? message.customType : message.stopReason,
    ),
    ["error", "error-tail"],
  );
}

for (const [name, runtime] of [
  ["non-bundled", nonBundled],
  ["bundled", bundled],
]) {
  assert.equal(typeof runtime.Agent, "function");
  assert.equal(typeof runtime.ExtensionRunner, "function");
  assert.equal(typeof runtime.AgentSession, "function");
  await runNormalSurface(name, runtime);
  await runErrorSurface(name, runtime);
  await runProjectionSurface(name, runtime);
  await runSdkProviderSurface(name, runtime);
}

console.log(
  `verified prime-agent@${SUPPORTED_VERSION} turn_end and projected context host behavior (non-bundled + bundled)`,
);
