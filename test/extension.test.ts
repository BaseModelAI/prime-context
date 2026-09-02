import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it } from "vitest";
import { ObservationArchive, resolveArchiveText } from "../src/archive.js";
import { analyzeOutcome } from "../src/capsule.js";
import { registerPrimeContextCommands } from "../src/commands.js";
import { deriveTaskSelection } from "../src/runtime.js";
import { createTaskSnapshotV2 } from "../src/state.js";
import primeContext, {
  REQUIRED_HOOKS,
  explicitUserTaskOutcome,
  requiredHooksLoaded,
  providerModelBranchEntries,
  scopeFixedExchangeViews,
  selectForkImportRefs,
  selectForkVisibleImports,
  shouldArchiveToolResult,
  typedObservationParts,
  typedObservationPartsEqual,
  visibleFixedToolCallIds,
} from "../src/index.js";
import { aggregateGenericCallParts, boundedResultTextStats, buildExchangeFacts, ExchangeTracker } from "../src/exchange.js";
import { summarizePartSource } from "../src/envelope.js";
import { adaptToolIntent, collectFactualOutcome } from "../src/intent.js";
import { PRIME_CONTEXT_GLOBAL_POLICY } from "../src/policy.js";
import {
  buildProviderRepresentation,
  compactArchivedCallArguments,
  fixedExchangeBudgetBytes,
  projectFixedExchangeViews,
  projectModelContext,
  selectFixedExchangeViews,
  type FixedExchangeView,
  type ProviderProjectionCache,
} from "../src/projection.js";
import {
  MODEL_LIST_MAX_OBSERVATIONS,
  MODEL_READ_DEFAULT_LINES,
  MODEL_RECOVERY_MAX_BYTES,
  MODEL_SEARCH_DEFAULT_MATCHES,
  registerPrimeContextTool,
  type PrimeContextActions,
} from "../src/tool.js";

type TestHandler = (event: any, context: any) => any;

function withFinalizedExchanges(event: any): any {
  if (Array.isArray(event?.exchanges)) return event;
  const calls = Array.isArray(event?.message?.content)
    ? event.message.content.filter((part: any) => part?.type === "toolCall")
    : [];
  const byId = new Map(calls.map((call: any, sourceOrder: number) => [call.id, { call, sourceOrder }]));
  const exchanges = (event?.toolResults ?? []).map((result: any, fallbackOrder: number) => {
    const matched = byId.get(result.toolCallId) as { call: any; sourceOrder: number } | undefined;
    return {
      sourceOrder: matched?.sourceOrder ?? fallbackOrder,
      toolCallId: result.toolCallId,
      toolName: matched?.call?.name ?? result.toolName,
      originalInput: matched?.call?.arguments ?? {},
      executedInput: matched?.call?.arguments ?? {},
      result,
    };
  }).sort((left: any, right: any) => left.sourceOrder - right.sourceOrder);
  return { ...event, toolExecution: event?.toolExecution ?? "sequential", exchanges };
}

function registerPatchedHandler(
  handlers: Map<string, TestHandler>,
  name: string,
  handler: TestHandler,
): void {
  handlers.set(name, name === "turn_end"
    ? (event, context) => handler(withFinalizedExchanges(event), context)
    : handler);
}

const temporaryPaths: string[] = [];
afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("extension behavior", () => {
  it("accepts only explicit authoritative task outcomes for automatic learning", () => {
    expect(explicitUserTaskOutcome("pytest passed 42 tests")).toBe("unknown");
    expect(explicitUserTaskOutcome("The assistant stopped normally")).toBe("unknown");
    expect(explicitUserTaskOutcome("Your implementation is correct and works")).toBe("success");
    expect(explicitUserTaskOutcome("This solution is wrong")).toBe("failure");
  });

  it("keeps the task root across assistant stops and continuation prompts", () => {
    const selection = deriveTaskSelection([
      { id: "root-user", type: "message", message: { role: "user", content: "Implement feature X" } },
      { id: "assistant-stop", type: "message", message: { role: "assistant", stopReason: "stop" } },
      { id: "continuation", type: "message", message: { role: "user", content: "Continue and keep constraint C" } },
    ]);
    expect(selection).toMatchObject({ taskKey: "root-user", rootUserEntryId: "root-user", source: "user" });
  });

  it("preserves an image while replacing mixed text/image/text with one capsule", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-mixed-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "session-mixed");
    const image = { type: "image" as const, data: "aGVsbG8=", mimeType: "image/png" };
    const archived = await archive.archiveVisibleContent(
      [
        { type: "text", text: "first text\n".repeat(100) },
        image,
        { type: "text", text: "second text\n".repeat(100) },
      ],
      "custom",
      false,
      10,
      1024,
    );

    expect(archived?.content).toHaveLength(2);
    expect(archived?.content[0].type).toBe("text");
    expect(archived?.content[1]).toBe(image);
  });
});

it("registers the global Prime Context system policy exactly once", () => {
  const beforeAgentStart: Array<(event: any, context: any) => any> = [];
  primeContext({
    on: (name: string, handler: any) => {
      if (name === "before_agent_start") beforeAgentStart.push(handler);
    },
    registerTool: () => undefined,
    registerCommand: () => undefined,
    appendEntry: () => undefined,
    getAllTools: () => [],
  } as unknown as ExtensionAPI);
  expect(beforeAgentStart).toHaveLength(2);

  const appended = beforeAgentStart[0]({ systemPrompt: "base system prompt" }, {}).systemPrompt;
  expect(appended).toBe(`base system prompt\n\n${PRIME_CONTEXT_GLOBAL_POLICY}`);
  expect(beforeAgentStart[0]({ systemPrompt: appended }, {}).systemPrompt).toBe(appended);
});

it("never emits an unsupported archived image MIME to a provider", () => {
  const projected = projectModelContext({
    purpose: "provider",
    messages: [{
      role: "toolResult",
      toolCallId: "svg-call",
      content: [{ type: "image", mimeType: "image/svg+xml", data: "PHN2Zy8+" }],
    }],
    fixedViews: new Map(),
    pendingImages: new Map([["svg-call", [{
      ref: "o1:image:1", mimeType: "image/svg+xml", bytes: 6,
    }]]]),
  });
  expect(projected.messages[0].content[0]).toMatchObject({
    type: "text",
    text: expect.stringContaining('ref="o1:image:1" mime="image/svg+xml"'),
  });
  expect(projected.shownImageRefs).toBeUndefined();
});

it("keeps supported fixed images persistent within each request budget", () => {
  const image = { type: "image", mimeType: "image/png", data: "aGVsbG8=" };
  const descriptors = Array.from({ length: 10 }, (_, index) => ({
    ref: `o1:image:${index + 1}`, mimeType: "image/png", bytes: 5,
  }));
  const projected = projectModelContext({
    purpose: "provider",
    messages: [{ role: "toolResult", toolCallId: "many-images", content: Array.from({ length: 10 }, () => ({ ...image })) }],
    fixedViews: [{
      schema: "prime-context.fixed-exchange-view/v1", generation: 0,
      exchangeId: "o1", toolCallId: "many-images", result: { kind: "literal" },
      visibleBytes: 50, images: descriptors,
    }],
    pendingImages: new Map([["many-images", descriptors.slice(0, 8)]]),
  });
  const blocks = projected.messages[0].content as any[];
  expect(blocks.every((block) => block.type === "image")).toBe(true);
  expect(projected.shownImageRefs).toHaveLength(10);

  const opaque = projectModelContext({
    purpose: "provider",
    messages: [{ role: "toolResult", toolCallId: "opaque-image", content: [{ ...image, imageSignature: "signed" }] }],
    fixedViews: [{
      schema: "prime-context.fixed-exchange-view/v1", generation: 0,
      exchangeId: "o2", toolCallId: "opaque-image", result: { kind: "literal" },
      visibleBytes: 5, images: [{ ref: "o2:image:1", mimeType: "image/png", bytes: 5 }],
    }],
  });
  expect((opaque.messages[0].content as any[])[0].imageSignature).toBe("signed");
  expect(opaque.shownImageRefs).toEqual(["o2:image:1"]);

  const queuedDescriptors = [
    { ref: "o3:image:1", mimeType: "image/png", bytes: 8 * 1024 * 1024 },
    { ref: "o3:image:2", mimeType: "image/png", bytes: 8 * 1024 * 1024 },
    { ref: "o3:image:3", mimeType: "image/png", bytes: 1 },
  ];
  const queuedInput = {
    purpose: "provider" as const,
    messages: [{ role: "toolResult", toolCallId: "queued-images", content: queuedDescriptors.map(() => ({ ...image })) }],
    fixedViews: [{
      schema: "prime-context.fixed-exchange-view/v1" as const, generation: 0 as const,
      exchangeId: "o3", toolCallId: "queued-images", result: { kind: "literal" as const },
      visibleBytes: 1, images: queuedDescriptors,
    }],
    pendingImages: new Map([["queued-images", queuedDescriptors]]),
  };
  const firstPage = projectModelContext(queuedInput);
  expect(firstPage.shownImageRefs).toEqual(["o3:image:1", "o3:image:2"]);
  const repeated = projectModelContext(queuedInput);
  expect(repeated.shownImageRefs).toEqual(firstPage.shownImageRefs);
  const budget = projectModelContext({ ...queuedInput, purpose: "budget" });
  expect(budget.messages).toEqual(firstPage.messages);
});

it("reuses provider entry prefixes while budget projection stays observational", () => {
  const cache: ProviderProjectionCache<any> = {};
  const firstInput = {
    purpose: "provider" as const,
    messages: [{ role: "user", content: [{ type: "text", text: "first" }], details: { private: true } }],
    entryRefs: [{ messageIndex: 0, entryId: "e1" }],
    fixedViews: new Map(),
    epochId: 1,
    modelKey: "provider:model",
    toolSetRevision: 0,
    cache,
  };
  const first = buildProviderRepresentation(firstInput);
  expect(first.projectionIdentity).toBe('[1,"provider:model",0]');
  const secondMessages = [...firstInput.messages, { role: "user", content: [{ type: "text", text: "second" }] }];
  const second = buildProviderRepresentation({
    ...firstInput,
    messages: secondMessages,
    entryRefs: [{ messageIndex: 0, entryId: "e1" }, { messageIndex: 1, entryId: "e2" }],
  });
  expect(second.messages[0]).toBe(first.messages[0]);
  expect(cache.epoch?.inputEntryIds).toEqual(["e1", "e2"]);

  const thirdMessages = [...secondMessages, { role: "user", content: [{ type: "text", text: "third" }] }];
  const thirdRefs = [
    { messageIndex: 0, entryId: "e1" },
    { messageIndex: 1, entryId: "e2" },
    { messageIndex: 2, entryId: "e3" },
  ];
  const budget = buildProviderRepresentation({
    ...firstInput,
    purpose: "budget",
    messages: thirdMessages,
    entryRefs: thirdRefs,
  });
  expect(cache.epoch?.inputEntryIds).toEqual(["e1", "e2"]);
  const provider = buildProviderRepresentation({ ...firstInput, messages: thirdMessages, entryRefs: thirdRefs });
  expect(provider.messages).toEqual(budget.messages);
  expect(provider.messages[0]).toBe(first.messages[0]);
  expect(cache.epoch?.sourceSpans.map((span) => span.entryId)).toEqual(["e1", "e2", "e3"]);

  const rebuilt = buildProviderRepresentation({ ...firstInput, epochId: 2 });
  expect(rebuilt.messages[0]).not.toBe(first.messages[0]);
  expect(rebuilt.projectionIdentity).not.toBe(first.projectionIdentity);

  const changedTools = buildProviderRepresentation({ ...firstInput, toolSetRevision: "[tool-b]" });
  expect(changedTools.messages[0]).not.toBe(first.messages[0]);
  expect(changedTools.projectionIdentity).not.toBe(first.projectionIdentity);
  expect(cache.epoch?.toolSetRevision).toBe("[tool-b]");
});

it("projects a paged user-shell execution by exact entry identity", () => {
  const entryId = "bash-entry-1";
  const source = {
    role: "bashExecution",
    command: "python emit.py",
    output: "x".repeat(20_000),
    exitCode: 0,
    cancelled: false,
    truncated: true,
    fullOutputPath: "/workspace/full-output.txt",
    timestamp: 1,
  };
  const rawProviderMessage = { role: "user", content: [{ type: "text", text: source.output }] };
  const projected = projectModelContext({
    purpose: "provider",
    messages: [rawProviderMessage],
    entryRefs: [{ messageIndex: 0, entryId }],
    sourceMessages: new Map<string, any>([[entryId, source]]),
    fixedViews: new Map([[entryId, {
      schema: "prime-context.fixed-exchange-view/v1",
      generation: 0,
      exchangeId: "ub_bash-entry-1",
      toolCallId: entryId,
      result: { kind: "capsule", text: '<prime_context_output id="ub_bash-entry-1">paged</prime_context_output>' },
      visibleBytes: 96,
    }]]),
  });
  expect(projected.messages[0]).toMatchObject({
    role: "user",
    content: [{ type: "text", text: expect.stringContaining("ub_bash-entry-1") }],
  });
  expect(JSON.stringify(projected.messages[0])).not.toContain("full-output.txt");
  expect(rawProviderMessage.content[0].text).toHaveLength(20_000);
});

describe("Step A exchange metadata", () => {
  const intent = (toolName: string, input: Record<string, unknown>, details?: unknown, resultText?: string) =>
    adaptToolIntent({
      exchangeId: "o1",
      toolCallId: "call-1",
      toolName,
      input,
      cwd: "/workspace",
      modelInputBytes: 10,
      details,
      resultText,
      isError: false,
    });

  it("classifies shared shell forms without changing the raw command", () => {
    const direct = 'cd "project dir" && pytest tests/test_api.py';
    const nested = "zsh -lc 'pytest tests/test_api.py'";
    for (const command of [direct, nested]) {
      const classified = intent("bash", { command });
      expect(classified.command).toBe(command);
      expect(classified.kind).toBe("test");
      expect(classified.suite?.family).toBe("pytest");
      expect(classified.subjectKey).toContain("suite:pytest:");
    }

    const heredoc = "cat <<'EOF' > 'result file.txt'\n9 passed\nEOF";
    const redirected = intent("bash", { command: heredoc });
    expect(redirected.command).toBe(heredoc);
    expect(redirected.mutatesWorkspace).toBe(true);
    expect(redirected.resources).toEqual(["/workspace/result file.txt"]);

    const twoHeredocs = "cat <<'FIRST' <<-SECOND > first.txt >> second.txt\nignored > body-one\nFIRST\n\tignored > body-two\nSECOND";
    expect(intent("bash", { command: twoHeredocs })).toMatchObject({
      mutatesWorkspace: true,
      resources: ["/workspace/first.txt", "/workspace/second.txt"],
    });
    expect(intent("bash", { command: "head -n 20 src/a.ts" })).toMatchObject({
      kind: "read", subjectKey: "/workspace/src/a.ts", resources: ["/workspace/src/a.ts"],
    });
    expect(intent("bash", { command: 'bash -lc "npm test $TARGET"' }).kind).toBe("unknown");
    expect(intent("bash", { command: "rm /tmp/outside-workspace" }).mutatesWorkspace).toBe(false);
    expect(intent("bash", { command: "cp src/input.ts /tmp/output.ts" }).mutatesWorkspace).toBe(false);
    expect(intent("bash", { command: "cp --target-directory=/tmp src/input.ts" }).mutatesWorkspace).toBe(false);
    expect(intent("bash", { command: "mv src/input.ts /tmp/output.ts" })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace/src/input.ts"],
    });
    expect(intent("bash", { command: "mv -t/tmp src/input.ts" })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace/src/input.ts"],
    });
    expect(intent("bash", { command: "cp -tsrc/out src/input.ts" })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace/src/out"],
    });
    expect(intent("bash", { command: "mv -S .bak src/input.ts /tmp/output.ts" })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace/src/input.ts"],
    });
    expect(intent("bash", { command: "cp -at /tmp src/input.ts" }).mutatesWorkspace).toBe(false);
    expect(intent("bash", { command: "tee /tmp/output.ts" }).mutatesWorkspace).toBe(false);
    expect(intent("bash", { command: "tee src/output.ts" }).mutatesWorkspace).toBe(true);
    expect(intent("bash", { command: "sed -i s/old/new/ /tmp/output.ts" }).mutatesWorkspace).toBe(false);
    expect(intent("bash", { command: "sed -i '' s/old/new/ /tmp/output.ts" }).mutatesWorkspace).toBe(false);
    expect(intent("bash", { command: "sed -i .bak s/old/new/ src/output.ts" })).toMatchObject({
      mutatesWorkspace: true,
      resources: ["/workspace/src/output.ts"],
    });
    expect(intent("bash", { command: "sed -i '' -f fix.sed src/a.ts src/b.ts" })).toMatchObject({
      mutatesWorkspace: true,
      resources: ["/workspace/src/a.ts", "/workspace/src/b.ts"],
    });
    expect(intent("bash", { command: "sed -i -e s/a/b/ -e s/c/d/ src/a.ts src/b.ts" })).toMatchObject({
      mutatesWorkspace: true,
      resources: ["/workspace/src/a.ts", "/workspace/src/b.ts"],
    });
    expect(intent("bash", { command: "sed -i -es/a/b/ src/a.ts" })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace/src/a.ts"],
    });
    expect(intent("bash", { command: "sed -e s/a/b/ -i -e s/c/d/ src/a.ts" })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace/src/a.ts"],
    });
    for (const command of [
      "sed --in-place s/a/b/ src/a.ts",
      "sed -ni s/a/b/ src/a.ts",
      "sed -i -- s/a/b/ src/a.ts",
      "sed -e s/a/b/ -i .bak src/a.ts",
      "sed -i.bak s/a/b/ src/a.ts",
      "sed -i~ s/a/b/ src/a.ts",
      "sed -i .bak -E s/a/b/ src/a.ts",
    ]) {
      expect(intent("bash", { command })).toMatchObject({
        mutatesWorkspace: true, resources: ["/workspace/src/a.ts"],
      });
    }
    for (const command of ["eslint --fix src", "ruff format src", "biome check --write src", "prettier -w src"]) {
      expect(intent("bash", { command }).mutatesWorkspace).toBe(true);
    }
    expect(intent("bash", { command: "eslint --fix /tmp/outside.ts" }).mutatesWorkspace).toBe(false);
    expect(intent("bash", { command: "cd /tmp && eslint --fix" }).mutatesWorkspace).toBe(false);
    expect(intent("bash", { command: "echo x > src/generated.ts && pytest" })).toMatchObject({
      mutatesWorkspace: true,
      resources: ["/workspace/src/generated.ts"],
    });
    expect(intent("bash", { command: "rm src/stale.ts && pytest" })).toMatchObject({
      mutatesWorkspace: true,
      resources: ["/workspace/src/stale.ts"],
    });
    expect(intent("bash", { command: "pytest\nrm src/stale.ts" })).toMatchObject({
      mutatesWorkspace: true,
      resources: ["/workspace/src/stale.ts"],
    });
    expect(intent("bash", { command: "cd src\nrm stale.ts" })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace/src/stale.ts"],
    });
    expect(intent("bash", { command: "cd src\necho x > generated.ts" })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace/src/generated.ts"],
    });
    expect(intent("bash", { command: "cd /tmp\nrm stale.ts" }).mutatesWorkspace).toBe(false);
    expect(intent("bash", { command: "cd /definitely/missing || echo x > fallback.txt" })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace/fallback.txt"],
    });
    expect(intent("bash", { command: "cd src | rm stale.ts" })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace/stale.ts"],
    });
    expect(intent("bash", { command: "echo ok # && rm src/commented.ts" }).mutatesWorkspace).toBe(false);
    expect(intent("bash", { command: "true || rm src/maybe.ts" })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace/src/maybe.ts"],
    });
    expect(intent("bash", { command: "\n# comment\ncd src &&\nrm stale.ts" })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace/src/stale.ts"],
    });
    expect(intent("bash", { command: `echo ""#literal && rm src/hit.ts` })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace/src/hit.ts"],
    });
    expect(intent("bash", { command: String.raw`cd src \
&& rm joined.ts` })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace/src/joined.ts"],
    });
    expect(intent("bash", { command: "> src/empty.txt" })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace/src/empty.txt"],
    });
    expect(intent("bash", { command: "(cd src && rm grouped.ts)" })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace/src/grouped.ts"],
    });
    expect(intent("bash", { command: "cd src || exit 1\nrm guarded.ts" })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace/src/guarded.ts"],
    });
    expect(intent("bash", { command: "cd src\n> empty.txt" }).resources).toEqual(["/workspace/src/empty.txt"]);
    expect(intent("bash", { command: "(rm src/a.ts) && true" }).resources).toEqual(["/workspace/src/a.ts"]);
    expect(intent("bash", { command: "rm src/*.ts" })).toMatchObject({ mutatesWorkspace: true, resources: ["/workspace/src"] });
    expect(intent("bash", { command: "cp -- src/a.ts -dest.ts" }).resources).toEqual(["/workspace/-dest.ts"]);
    expect(intent("bash", { command: "if true; then rm src/a.ts; fi" }).resources).toEqual(["/workspace/src/a.ts"]);
    expect(intent("bash", { command: "prettier --write src/a.ts\n# done" }).kind).toBe("lint");
    expect(intent("bash", { command: "cd src && > a.txt" }).resources).toEqual(["/workspace/src/a.txt"]);
    expect(intent("bash", { command: "(cd src; rm a.ts); rm b.ts" }).resources)
      .toEqual(["/workspace/src/a.ts", "/workspace/b.ts"]);
    expect(intent("bash", { command: "false && cd src; rm a.ts" }).resources).toEqual(["/workspace/a.ts"]);
    expect(intent("bash", { command: `rm "src/a\\q.ts"` }).resources).toEqual(["/workspace/src/a\\q.ts"]);
    expect(intent("bash", { command: "pytest\nzsh -lc 'rm src/nested.ts'" })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace/src/nested.ts"],
    });
    expect(intent("bash", { command: "npm run generate" })).toMatchObject({
      kind: "edit", mutatesWorkspace: true,
    });
    expect(intent("bash", { command: "git apply < change.patch" })).toMatchObject({
      kind: "edit", mutatesWorkspace: true, resources: ["/workspace"],
    });
    for (const flag of ["--check", "--stat", "--numstat"]) {
      expect(intent("bash", { command: `git apply ${flag} change.patch` }).mutatesWorkspace).toBe(false);
    }
    expect(intent("bash", { command: "git -C src apply ../change.patch" })).toMatchObject({
      kind: "edit", mutatesWorkspace: true, resources: ["/workspace/src"],
    });
    expect(intent("bash", { command: "git -C src apply --stat --apply ../change.patch" })).toMatchObject({
      kind: "edit", mutatesWorkspace: true, resources: ["/workspace/src"],
    });
    expect(intent("bash", { command: "git --git-dir=.git apply change.patch" })).toMatchObject({
      kind: "edit", mutatesWorkspace: true, resources: ["/workspace"],
    });
    expect(intent("bash", { command: "patch --dry-run -p1 < change.patch" }).mutatesWorkspace).toBe(false);
    expect(intent("bash", { command: "patch -d /tmp -p1 < change.patch" }).mutatesWorkspace).toBe(false);
    expect(intent("bash", { command: "gpatch -d src -p1 < change.patch" })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace/src"],
    });
    expect(intent("bash", { command: `sed -e "w src/out.txt" src/in.txt` }).resources).toEqual(["/workspace/src/out.txt"]);
    expect(intent("bash", { command: `sed -e "s/a/b/w src/out.txt" src/in.txt` }).resources).toEqual(["/workspace/src/out.txt"]);
    expect(intent("bash", { command: `sed -i -e "s/x/y/w src/out.txt" src/in.txt` }).resources)
      .toEqual(["/workspace/src/in.txt", "/workspace/src/out.txt"]);
    expect(intent("bash", { command: "prettier --write --config-precedence prefer-file src/a.ts" }).resources)
      .toEqual(["/workspace/src/a.ts"]);
    expect(intent("bash", { command: "git --no-replace-objects apply change.patch" }).mutatesWorkspace).toBe(true);
    expect(intent("bash", { command: "git restore src/a.ts" }).resources).toEqual(["/workspace/src/a.ts"]);
    expect(intent("bash", { command: "git restore --source HEAD src/a.ts" }).resources).toEqual(["/workspace/src/a.ts"]);
    expect(intent("bash", { command: "git checkout main" }).resources).toEqual(["/workspace"]);
    expect(intent("bash", { command: "patch -d /tmp -o /workspace/out.txt < change.patch" }).resources)
      .toEqual(["/workspace/out.txt"]);
    expect(intent("bash", { command: "patch -dsrc -oout.txt < change.patch" }).resources)
      .toEqual(["/workspace/src", "/workspace/src/out.txt"]);
    expect(intent("bash", { command: "prettier --write 'src/**/*.ts'" })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace/src"],
    });
    expect(intent("bash", { command: "prettier --write --config config.json src/a.ts" }).resources)
      .toEqual(["/workspace/src/a.ts"]);
    expect(intent("bash", { command: "cat file(.N)" }).kind).toBe("unknown");
    expect(intent("bash", { command: "cat file(/)" }).kind).toBe("unknown");
    expect(intent("bash", { command: "zsh -lc 'cat file(/)'" }).kind).toBe("unknown");
    expect(intent("bash", { command: "zsh -lc 'cat file(.N)'" }).kind).toBe("unknown");
    expect(intent("bash", { command: `zsh -lc "rm file(e:'reply=(foo)':)"` }).kind).toBe("unknown");
    expect(intent("bash", { command: `zsh -lc "rm file(e:'reply=(foo bar)':)"` }).kind).toBe("unknown");
    expect(intent("bash", { command: "rm 'src/file(.N)'" })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace/src/file(.N)"],
    });
    expect(intent("bash", { command: "rm src/file\\(.N\\)" })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace/src/file(.N)"],
    });
    expect(intent("bash", { command: "rm '<1-10>.txt'" }).mutatesWorkspace).toBe(true);
    expect(intent("bash", { command: `zsh -lc 'rm <1-10>.txt'` }).kind).toBe("unknown");
    expect(intent("bash", { command: `zsh -lc 'rm /tmp/lit\\(x\\) src/file(.N)'` }).kind).toBe("unknown");
    expect(intent("bash", { command: `zsh -lc 'rm src/lit\\(x\\)/file(.N)'` }).kind).toBe("unknown");
    expect(intent("bash", { command: `zsh -lc 'rm ^keep.txt'` }).kind).toBe("unknown");

    const scriptTest = intent("bash", { command: "python run_tests.py" });
    expect(scriptTest).toMatchObject({
      kind: "test",
      suite: { family: "python-test-script", target: '{"target":"/workspace/run_tests.py","cwd":"/workspace"}', scope: "broad" },
    });

    const dockerBuild = intent("bash", { command: "docker build -t app ." });
    expect(dockerBuild).toMatchObject({
      kind: "build", suite: { family: "docker-build" }, mutatesWorkspace: false,
      resources: ["/workspace"],
    });
    expect(dockerBuild.resources).not.toContain("/workspace/-t");
    const remoteBuild = intent("bash", { command: "docker --context remote build ." });
    expect(remoteBuild).toMatchObject({ kind: "build", suite: { family: "docker-build" } });
    expect(remoteBuild.suite?.target).toContain("--context=remote");
    expect(intent("bash", { command: "docker -D build ." }).suite)
      .toEqual(intent("bash", { command: "docker --debug build ." }).suite);
    expect(intent("bash", { command: "docker build . --progress plain --secret id=x --ssh default" }).suite)
      .toEqual(intent("bash", { command: "docker build --ssh=default --secret=id=x --progress=plain ." }).suite);
    expect(intent("bash", { command: "docker compose --parallel 2 -f compose.yml build service" })).toMatchObject({
      kind: "build", suite: { family: "docker-compose-build", target: expect.stringContaining("--file=compose.yml") },
    });
    expect(intent("bash", { command: "docker-compose build service" })).toMatchObject({
      kind: "build", suite: { family: "docker-compose-build" },
    });
    expect(intent("bash", { command: "docker buildx --builder remote build -o type=local,dest=src/out ." })).toMatchObject({
      kind: "build", suite: { family: "docker-buildx-build", target: expect.stringContaining("--builder=remote") },
      mutatesWorkspace: true, resources: ["/workspace", "/workspace/src/out"],
    });
    expect(intent("bash", { command: "docker build . --target prod" }).resources).toEqual(["/workspace"]);
    expect(intent("bash", { command: "docker build . --add-host x:y --memory 1g" }).resources).toEqual(["/workspace"]);
    expect(intent("bash", { command: "docker build https://example.com/repo.git" }).resources).toEqual([]);
    expect(intent("bash", { command: "docker build --pull . --iidfile src/iid" })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace", "/workspace/src/iid"],
    });
    expect(intent("bash", { command: "docker buildx build . --iidfile src/iid" })).toMatchObject({
      mutatesWorkspace: true, resources: ["/workspace", "/workspace/src/iid"],
    });
    expect(intent("bash", { command: "docker compose -f compose.yml --project-directory . build svc" }).resources)
      .toEqual(["/workspace/compose.yml", "/workspace"]);
    expect(intent("bash", { command: "pytest -q" }).suite)
      .toEqual(intent("bash", { command: "pytest" }).suite);
    expect(intent("bash", { command: "vitest run" }).suite)
      .toEqual(intent("bash", { command: "vitest" }).suite);
    expect(intent("bash", { command: "vitest run tests/a.test.ts" }).suite)
      .toEqual(intent("bash", { command: "vitest --run tests/a.test.ts" }).suite);
    expect(intent("bash", { command: "pytest -k foo tests" }).suite)
      .toEqual(intent("bash", { command: "pytest tests -k foo" }).suite);
    expect(intent("bash", { command: "pytest -vv" }).suite)
      .toEqual(intent("bash", { command: "pytest -v" }).suite);
    expect(intent("bash", { command: "pytest tests" })).toMatchObject({
      resources: ["/workspace/tests"], suite: intent("bash", { command: "pytest ./tests" }).suite,
    });
    expect(intent("bash", { command: "npm test -- --runInBand" }).suite)
      .toEqual(intent("bash", { command: "npm test" }).suite);
    expect(intent("bash", { command: "pytest -q" }).resources).toEqual([]);
    expect(intent("bash", { command: "pytest --color=yes" }).suite)
      .toEqual(intent("bash", { command: "pytest --color yes" }).suite);
    expect(intent("bash", { command: "vitest --color tests/a.test.ts" })).toMatchObject({
      resources: ["/workspace/tests/a.test.ts"], suite: { scope: "focused" },
    });
    expect(intent("bash", { command: "cd pkg-a && pytest" }).suite)
      .not.toEqual(intent("bash", { command: "cd pkg-b && pytest" }).suite);
    for (const command of ["env -u PYTHONPATH pytest", "env --unset=PYTHONPATH pytest", "time -p pytest",
      "env FOO=1 time -p pytest", "uv run --project pkg pytest", "uv run --package pkg pytest", "uv run --extra dev pytest"]) {
      expect(intent("bash", { command })).toMatchObject({ kind: "test", suite: { family: "pytest" } });
    }

    const build = intent("bash", { command: "npm run build" });
    expect(build).toMatchObject({
      kind: "build",
      subjectKey: 'suite:npm-build:{"target":"all","cwd":"/workspace"}',
      suite: { family: "npm-build", target: '{"target":"all","cwd":"/workspace"}', scope: "broad" },
    });
    expect(intent("bash", { command: "cd pkg-a && npm run build" }).subjectKey)
      .not.toBe(intent("bash", { command: "cd pkg-b && npm run build" }).subjectKey);
    expect(intent("bash", { command: "cd -- pkg-a && npm run build" })).toMatchObject({
      kind: "build", effectiveCwd: "/workspace/pkg-a",
    });

    const unsupported = "print -r -- ${(q)workspace}";
    expect(intent("bash", { command: unsupported })).toMatchObject({
      command: unsupported,
      kind: "unknown",
    });
  });

  it("uses exact search, status, and generic identities under Bash and Zsh", () => {
    for (const command of ["rg -F needle src", "zsh -lc 'rg -F needle src'"]) {
      expect(intent("bash", { command })).toMatchObject({
        kind: "search",
        resources: ["/workspace/src"],
        subjectKey: 'search:{"family":"rg","query":["needle"],"roots":["/workspace/src"],"modifiers":["-F"]}',
      });
    }
    expect(intent("bash", { command: "rg needle src" }).subjectKey)
      .not.toBe(intent("bash", { command: "rg -F needle src" }).subjectKey);
    expect(intent("bash", { command: "rg --hidden needle src" }).subjectKey)
      .not.toBe(intent("bash", { command: "rg -m 1 needle src" }).subjectKey);
    expect(intent("bash", { command: "rg -g*.ts needle src" }).subjectKey)
      .toBe(intent("bash", { command: `rg -g '*.ts' needle src` }).subjectKey);
    for (const command of ["git status --short -- src", "zsh -lc 'git status --short -- src'"]) {
      expect(intent("bash", { command })).toMatchObject({
        kind: "status",
        resources: ["/workspace/src"],
        subjectKey: 'command:{"family":"git-status","args":["--short","--","src"],"cwd":"/workspace"}',
      });
    }
    expect(intent("bash", { command: "npm test" }, {
      truncation: { truncated: true, truncatedBy: "bytes", totalBytes: 9000, outputBytes: 4000 },
    })).toMatchObject({ facts: { truncation: "bytes", sourceBytes: 9000, visibleBytes: 4000 } });
    expect(intent("weather", { query: "tomorrow", cwd: "." }).subjectKey)
      .toBe('tool:weather:["/workspace","query:tomorrow"]');
    const citySchema = { type: "object", properties: { city: { type: "string" } } };
    const cityIntent = (city: string) => adaptToolIntent({
      exchangeId: "o-city", toolCallId: "city", toolName: "weather", input: { city }, cwd: "/workspace",
      modelInputBytes: city.length, toolSchema: citySchema,
    });
    expect(cityIntent("Paris").subjectKey).not.toBe(cityIntent("London").subjectKey);
    expect(intent("custom_patch", { path: "src/main.ts" })).toMatchObject({
      kind: "edit", subjectKey: "/workspace/src/main.ts",
    });
    expect(adaptToolIntent({
      exchangeId: "o2",
      toolCallId: "call-2",
      toolName: "custom_patch",
      input: { request: { path: "src/nested.ts" } },
      cwd: "/workspace",
      modelInputBytes: 20,
      toolSchema: {
        type: "object",
        properties: { request: { type: "object", properties: { path: { type: "string" } } } },
      },
    })).toMatchObject({ kind: "edit", subjectKey: "/workspace/src/nested.ts" });
  });

  it("keeps bounded call arguments literal and archives aggregates above admission", () => {
    const bounded = Object.fromEntries(Array.from({ length: 120 }, (_, index) => [
      `field_${index}`,
      `value_${index}_${"x".repeat(80)}`,
    ]));
    expect(aggregateGenericCallParts("custom_tool", bounded)).toEqual([]);
    const input = Object.fromEntries(Array.from({ length: 300 }, (_, index) => [
      `field_${index}`,
      `value_${index}_${"x".repeat(80)}`,
    ]));
    const parts = aggregateGenericCallParts("custom_tool", input);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ pointer: "", kind: "call-field" });
    const compact = compactArchivedCallArguments("o1", "custom_tool", input, [{
      pointer: "", textBytes: Buffer.byteLength(parts[0].text ?? "", "utf8"), lineCount: 1,
    }]);
    expect(compact).toMatchObject({
      archived: expect.stringContaining('<archived-call ref="o1:call#"'),
      field_0: input.field_0,
    });
    expect(compact).not.toHaveProperty("field_119");
    expect(Buffer.byteLength(JSON.stringify(compact), "utf8")).toBeLessThanOrEqual(4096);
  });

  it("uses typed adapters and does not accept unrelated test-like prose", () => {
    const edit = intent("edit", {
      path: "src/main.ts",
      edits: [{ oldText: "old\n", newText: "new value\n" }],
    }, { diff: "@@ -1 +1 @@", firstChangedLine: 1 });
    expect(edit).toMatchObject({
      kind: "edit",
      subjectKey: "/workspace/src/main.ts",
      mutatesWorkspace: true,
      facts: { editCount: 1, firstChangedLine: 1 },
    });
    expect(intent("ipython", { code: "print(1)" }, {
      status: "ok", durationMs: 42, kernelRestarted: true, sentAgentMessages: [{ receiver: "parent" }],
    })).toMatchObject({
      kind: "delegate",
      facts: { kernelStatus: "ok", durationMs: 42, kernelRestarted: "true", sentAgentMessages: 1 },
    });
    expect(intent("ipython", {
      code: "(root / 'record_migrate' / 'engine.py').write_text(engine)",
    })).toMatchObject({ kind: "run", resources: [], mutatesWorkspace: true });
    expect(intent("ipython", {
      code: "Path('generated/output.py').write_text(source)",
    })).toMatchObject({
      kind: "run", resources: ["/workspace/generated/output.py"], mutatesWorkspace: true,
    });

    const subprocessTest = intent("ipython", {
      code: "result = subprocess.run(['python', 'run_tests.py'], cwd=root, text=True, capture_output=True)\nprint(result.stdout)",
    }, undefined, "TEST_RESULT PASS 9/9");
    expect(subprocessTest).toMatchObject({
      kind: "test",
      subjectKey: 'suite:python-test-script:{"target":"/workspace/run_tests.py","cwd":"/workspace"}',
      suite: { family: "python-test-script", target: '{"target":"/workspace/run_tests.py","cwd":"/workspace"}', scope: "broad" },
      mutatesWorkspace: false,
    });
    expect(collectFactualOutcome(subprocessTest, "TEST_RESULT PASS 9/9", false)).toMatchObject({
      status: "success", testTotal: 9,
    });

    const pathSubprocessTest = intent("ipython", {
      code: "result = subprocess.run(['python', str(root / 'run_tests.py')], cwd=root, text=True, capture_output=True)\nprint(result.stdout)",
    }, undefined, "TEST_RESULT PASS 9/9");
    expect(pathSubprocessTest).toMatchObject({
      kind: "test",
      subjectKey: 'suite:python-test-script:{"target":"/workspace/run_tests.py","cwd":"/workspace"}',
    });
    expect(intent("ipython", {
      code: "subprocess.run(['python', str(root / 'worker.py')], cwd=root)",
    }).kind).toBe("run");

    const nativeBashTest = intent("ipython", {
      code: 'result = await bash("cd /workspace\npython run_tests.py", yield_time_ms=1000)',
    }, undefined, "TEST_RESULT PASS 9/9");
    expect(nativeBashTest).toMatchObject({
      kind: "test",
      subjectKey: 'suite:python-test-script:{"target":"/workspace/run_tests.py","cwd":"/workspace"}',
      suite: { family: "python-test-script", target: '{"target":"/workspace/run_tests.py","cwd":"/workspace"}', scope: "broad" },
      mutatesWorkspace: false,
      facts: { bashCalls: 1 },
    });
    expect(collectFactualOutcome(nativeBashTest, "TEST_RESULT FAIL 3/6", false)).toMatchObject({
      status: "failure", testTotal: 6,
    });

    expect(intent("ipython", {
      code: 'await bash("cat inputs/a.txt > generated/report.txt")',
    })).toMatchObject({
      kind: "run", resources: ["/workspace/inputs/a.txt", "/workspace/generated/report.txt"], mutatesWorkspace: true,
      facts: { bashCalls: 1 },
    });
    expect(intent("ipython", {
      code: 'await bash(command="printf done > generated/keyword.txt")',
    })).toMatchObject({
      kind: "run", resources: ["/workspace/generated/keyword.txt"], mutatesWorkspace: true,
      facts: { bashCalls: 1 },
    });
    expect(intent("ipython", { code: "pytest.main()" })).toMatchObject({
      kind: "test", suite: { family: "pytest" },
    });
    expect(intent("ipython", { code: "child = await rlm('check this')" }).kind).toBe("delegate");

    const proseOnly = intent("ipython", { code: 'message = "pytest.main(), subprocess.run([\'python\', \'run_tests.py\']), await bash(\'pytest -q\')"' });
    expect(proseOnly.kind).toBe("run");
    const multilineProse = intent("ipython", {
      code: 'message = """\nsubprocess.run([\'python\', \'run_tests.py\'])\n"""',
    });
    expect(multilineProse.kind).toBe("run");
    const escapedMultilineProse = intent("ipython", {
      code: `message = "prose${String.fromCharCode(92)}\nsubprocess.run(['python', 'run_tests.py'])"`,
    });
    expect(escapedMultilineProse.kind).toBe("run");
    const commentedProse = intent("ipython", {
      code: "# subprocess.run(['python', 'run_tests.py'])",
    });
    expect(commentedProse.kind).toBe("run");
    const unrelated = intent("weather", { query: "tomorrow" }, undefined, "9 passed");
    const outcome = collectFactualOutcome(unrelated, "9 passed", false);
    expect(unrelated.suite).toBeUndefined();
    expect(outcome.testTotal).toBeNull();
  });

  it("parses direct coding outcomes only for their identified adapters", () => {
    const cases = [
      {
        command: "pytest tests/test_api.py",
        text: "FAILED tests/test_api.py::test_bad - AssertionError\n=== 1 failed, 2 passed in 0.12s ===",
        expected: { status: "failure", testTotal: 3, failingTests: ["tests/test_api.py::test_bad"] },
      },
      {
        command: "python -m unittest tests.test_api",
        text: "FAIL: test_bad (tests.TestApi)\nRan 2 tests in 0.01s\nFAILED (failures=1)",
        expected: { status: "failure", testTotal: 2, failingTests: ["test_bad"] },
      },
      {
        command: "npx jest src/api.test.ts",
        text: "FAIL src/api.test.ts\nTests: 1 failed, 2 passed, 3 total",
        expected: { status: "failure", testTotal: 3, failingTests: ["src/api.test.ts"] },
      },
      {
        command: "npx vitest run src/api.test.ts",
        text: "FAIL src/api.test.ts > api > rejects\nTests  1 failed | 1 passed (2)",
        expected: { status: "failure", testTotal: 2, failingTests: ["src/api.test.ts > api > rejects"] },
      },
      {
        command: "tsc --noEmit",
        text: "src/api.ts(12,4): error TS2322: Type 'string' is not assignable\nFound 1 error.",
        expected: { status: "failure", sourceLocations: ["src/api.ts:12"] },
      },
      {
        command: "eslint src/api.ts",
        text: "/workspace/src/api.ts\n  7:3  error  Unexpected any\n✖ 1 problem (1 error, 0 warnings)",
        expected: { status: "failure", sourceLocations: ["/workspace/src/api.ts:7"] },
      },
      {
        command: "cargo test",
        text: "test api::rejects ... FAILED\ntest result: FAILED. 2 passed; 1 failed; 0 ignored",
        expected: { status: "failure", testTotal: 3, failingTests: ["api::rejects"] },
      },
      {
        command: "cargo check",
        text: "error[E0308]: mismatched types\n --> src/main.rs:9:4\nerror: could not compile `demo`",
        expected: { status: "failure", sourceLocations: ["src/main.rs:9"] },
      },
      {
        command: "go test ./...",
        text: "--- FAIL: TestRejects (0.00s)\n    api_test.go:12: wrong value\nFAIL\tdemo/api\t0.01s",
        expected: { status: "failure", testTotal: 1, failingTests: ["TestRejects"], sourceLocations: ["api_test.go:12"] },
      },
      {
        command: "mvn test",
        text: "[ERROR] ApiTest.rejects -- Time elapsed: 0.01 s <<< FAILURE!\n[INFO] Tests run: 3, Failures: 1, Errors: 0, Skipped: 0\n[INFO] BUILD FAILURE",
        expected: { status: "failure", testTotal: 3, failingTests: ["ApiTest.rejects"] },
      },
      {
        command: "./gradlew test",
        text: "ApiTest > rejects FAILED\n3 tests completed, 1 failed\nBUILD FAILED",
        expected: { status: "failure", testTotal: 3, failingTests: ["ApiTest > rejects"] },
      },
    ] as const;

    for (const example of cases) {
      const classified = intent("bash", { command: example.command });
      expect(classified.suite, example.command).toBeDefined();
      expect(collectFactualOutcome(classified, example.text, false), example.command).toMatchObject(example.expected);
    }

    const typedExit = collectFactualOutcome(intent("bash", { command: "tsc --noEmit" }), "", false, { exitCode: 2 });
    expect(typedExit).toMatchObject({ status: "failure", exitStatuses: ["exit 2"] });
    expect(typedExit.signature).toContain("exit 2");
    expect(collectFactualOutcome(intent("bash", { command: "npm test" }), "", false, {})).toMatchObject({
      status: "success",
    });
    const manyFailures = Array.from({ length: 40 }, (_, index) => `FAIL tests/case-${index}.test.ts`).join("\n") +
      "\n40 failed";
    expect(collectFactualOutcome(intent("bash", { command: "npm test" }), manyFailures, false).failingTests)
      .toHaveLength(40);
  });

  it("retains direct-adapter outcome lines from a large file source", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-outcomes-"));
    temporaryPaths.push(root);
    const path = join(root, "outcome.log");
    const decisive = [
      "Tests: 1 failed, 2 passed, 3 total",
      "src/main.ts(12,4): error TS2322: mismatch",
      "test result: FAILED. 2 passed; 1 failed; 0 ignored",
      "[INFO] Tests run: 3, Failures: 1, Errors: 0, Skipped: 0",
      "7 tests completed, 1 failed",
      "--- FAIL: TestThing (0.00s)",
      "Ran 3 tests in 0.02s",
      "Found 0 errors.",
      "Finished dev [unoptimized + debuginfo] target(s) in 0.12s",
      "BUILD SUCCESSFUL in 2s",
    ];
    const noise = "trace heartbeat 123\n".repeat(60_000);
    await writeFile(path, `${noise}${decisive.join("\n")}\n${noise}`, "utf8");

    const summary = await summarizePartSource({ kind: "path", path });
    expect(summary.large).toBe(true);
    for (const line of decisive) expect(summary.outcomeText).toContain(line);
  });

  it("keeps source-order IDs when results finish in reverse order", () => {
    const tracker = new ExchangeTracker();
    tracker.start({ toolCallId: "a", toolName: "bash", args: { command: "original a" } });
    tracker.start({ toolCallId: "b", toolName: "bash", args: { command: "original b" } });
    tracker.noteCall({ toolCallId: "a", toolName: "bash", input: { command: "prepared a" } }, "/workspace");
    tracker.noteCall({ toolCallId: "b", toolName: "bash", input: { command: "prepared b" } }, "/workspace");
    tracker.noteResult({ toolCallId: "b", toolName: "bash", input: { command: "prepared b" }, isError: false }, "/workspace", "done b");
    tracker.noteResult({ toolCallId: "a", toolName: "bash", input: { command: "prepared a" }, isError: false }, "/workspace", "done a");

    const completed = tracker.finishTurn({
      role: "assistant",
      content: [
        {
          type: "toolCall", id: "a", name: "bash", arguments: { command: "original a" },
          thoughtSignature: "opaque-signed-call",
        },
        { type: "toolCall", id: "b", name: "bash", arguments: { command: "original b" } },
        { type: "toolCall", id: "live", name: "bash", arguments: { command: "still running" } },
      ],
    }, [
      { role: "toolResult", toolCallId: "b", toolName: "bash", content: [{ type: "text", text: "done b" }] },
      { role: "toolResult", toolCallId: "orphan", toolName: "bash", content: [{ type: "text", text: "orphan" }] },
      {
        role: "toolResult", toolCallId: "a", toolName: "bash",
        content: [{ type: "text", text: "done a" }], isError: true,
        details: { error: "late middleware failure" },
      },
    ]);
    expect(completed.map((exchange) => exchange.id)).toEqual(["o1", "o2"]);
    expect(completed[0].modelInput).toEqual({ command: "original a" });
    expect(completed[0].executedInput).toEqual({ command: "prepared a" });
    expect(completed[0].intent?.command).toBe("original a");
    expect(completed[0].replayProtected).toBe(true);
    expect(completed.map((exchange) => exchange.rawResult?.toolCallId)).toEqual(["a", "b"]);
    expect(completed[0].persistedResultChanged).toBe(true);
    expect(completed[0].outcome?.isError).toBe(true);
    expect(completed[0].outcome?.outcome.status).toBe("failure");
    expect(tracker.get("a")).toBeUndefined();
    expect(tracker.get("b")).toBeUndefined();

    tracker.resetSession();
    tracker.setMinimumSequence(7);
    expect(tracker.start({ toolCallId: "resumed", toolName: "bash", args: {} }).id).toBe("o8");
  });

  it("preserves a full-output outcome when the persisted visible tail is unchanged", async () => {
    const tracker = new ExchangeTracker();
    tracker.start({ toolCallId: "full", toolName: "bash", args: { command: "run tests" } });
    tracker.noteCall({ toolCallId: "full", toolName: "bash", input: { command: "run tests" } }, "/workspace");
    const full = `${Array.from({ length: 30000 }, (_, index) => `diagnostic ${index} ${"x".repeat(32)}`).join("\n")}\n` +
      "TEST_RESULT FAIL 0/1\nfull diagnostic\npersisted tail";
    const resolved = await resolveArchiveText([{ type: "text", text: full }]);
    tracker.noteResult({
      toolCallId: "full", toolName: "bash", input: { command: "run tests" },
      details: { fullOutputPath: "/tmp/full" }, isError: false,
    }, "/workspace", resolved.text, {
      source: "public-complete-output",
      visibleResultText: "persisted tail",
      visibleResultBytes: Buffer.byteLength("persisted tail"),
      outcomeText: resolved.outcomeText,
      resultSummary: resolved,
      large: true,
    });
    const [completed] = tracker.finishTurn({
      role: "assistant",
      content: [{ type: "toolCall", id: "full", name: "bash", arguments: { command: "run tests" } }],
    }, [{
      role: "toolResult", toolCallId: "full", toolName: "bash",
      content: [{ type: "text", text: "persisted tail" }],
      details: { fullOutputPath: "/tmp/full", middlewareTag: "final" }, isError: false,
    }]);
    expect(completed.persistedResultChanged).toBe(true);
    expect(completed.persistedCanonicalResultChanged).toBe(false);
    expect(completed.outcome?.outcome.status).toBe("failure");
  });

  it("finalizes host exchanges without an early result and rejects a stale full-output capture", () => {
    const tracker = new ExchangeTracker();
    const input = { command: "run" };
    const finalResult = {
      role: "toolResult" as const,
      toolCallId: "final-only",
      toolName: "bash",
      content: [{ type: "text", text: "FINAL authority" }],
      isError: false,
    };
    const finalized = [{
      sourceOrder: 0,
      toolCallId: "final-only",
      toolName: "bash",
      originalInput: input,
      executedInput: input,
      result: finalResult,
    }];
    const completed = tracker.finishTurn({
      role: "assistant",
      content: [{ type: "toolCall", id: "final-only", name: "bash", arguments: input }],
    }, [finalResult], finalized);
    expect(completed).toHaveLength(1);
    expect(completed[0].rawResult).toBe(finalResult);
    expect(tracker.get("final-only")).toBeUndefined();

    const [facts] = buildExchangeFacts({
      exchanges: finalized,
      executionMode: "sequential",
      pendingFullOutputs: [{
        toolCallId: "final-only",
        path: "/tmp/stale",
        text: "STALE failure",
        visibleText: "stale visible",
        visibleBytes: Buffer.byteLength("stale visible"),
        visibleTruncated: false,
        visibleTail: "stale visible",
        visibleSamples: boundedResultTextStats([{ type: "text", text: "stale visible" }]).samples,
        isError: false,
      }],
      cwd: "/workspace",
    });
    expect(facts.text).toBe("FINAL authority");
    expect(facts.fullOutputSnapshotPath).toBeUndefined();
  });

  it("does not promote generic successful output or status wrappers into task facts", () => {
    const input = { command: "printf '{}\n'" };
    const [facts] = buildExchangeFacts({
      exchanges: [{
        sourceOrder: 0,
        toolCallId: "clean-status",
        toolName: "bash",
        originalInput: input,
        executedInput: input,
        result: {
          role: "toolResult",
          toolCallId: "clean-status",
          toolName: "bash",
          content: [{ type: "text", text: "README.txt\nordinary successful output\nProcess exited with code 0" }],
          details: { exitCode: 0 },
          isError: false,
        },
      }],
      executionMode: "sequential",
      cwd: "/workspace",
    });
    expect(facts.progress).toEqual({ kind: "none" });
  });

  it("reclassifies typed IPython resources from final middleware details", () => {
    const tracker = new ExchangeTracker();
    const input = { code: "value = 1" };
    tracker.start({ toolCallId: "typed", toolName: "ipython", args: input });
    tracker.noteCall({ toolCallId: "typed", toolName: "ipython", input }, "/workspace");
    tracker.noteResult({
      toolCallId: "typed", toolName: "ipython", input, isError: false,
      details: { diffs: [{ path: "old.py" }], stdout: "old" },
    }, "/workspace", "old", { visibleResultText: "old" });
    const [completed] = tracker.finishTurn({
      role: "assistant",
      content: [{ type: "toolCall", id: "typed", name: "ipython", arguments: input }],
    }, [{
      role: "toolResult", toolCallId: "typed", toolName: "ipython",
      content: [{ type: "text", text: "final" }], isError: false,
      details: { diffs: [{ path: "new.py" }], stdout: "final stdout" },
    }]);
    expect(completed.persistedResultChanged).toBe(true);
    expect(completed.persistedCanonicalResultChanged).toBe(true);
    expect(completed.intent?.resources).toEqual(["/workspace/new.py"]);
    expect(completed.intent?.mutatesWorkspace).toBe(true);
  });

  it("reconciles bounded large IPython details and typed parts", () => {
    const tracker = new ExchangeTracker();
    const input = { code: "value = 1" };
    const large = `${"a".repeat(1100 * 1024)}TAIL`;
    const samples = (text: string): string[] => {
      const output = [String(text.length)];
      for (const ratio of [0, 0.25, 0.5, 0.75, 1]) {
        const center = Math.floor(text.length * ratio);
        output.push(text.slice(Math.max(0, center - 64), Math.min(text.length, center + 64)));
      }
      return output;
    };
    tracker.start({ toolCallId: "large-typed", toolName: "ipython", args: input });
    tracker.noteCall({ toolCallId: "large-typed", toolName: "ipython", input }, "/workspace");
    const oldDiffs = Array.from({ length: 40 }, (_, index) => ({ path: index === 39 ? "old.py" : "same.py" }));
    const newDiffs = oldDiffs.map((diff, index) => index === 39 ? { path: "new.py" } : diff);
    const initialEvent = {
      toolCallId: "large-typed", toolName: "ipython", input, isError: false,
      details: { diffs: oldDiffs, stdout: large },
    };
    tracker.noteResult(initialEvent, "/workspace", "bounded large summary", {
      large: true,
      visibleResultText: large.slice(0, 64 * 1024),
      visibleResultBytes: Buffer.byteLength(large),
      visibleResultTruncated: true,
      visibleResultTail: large.slice(-4096),
      visibleResultSamples: samples(large),
      outcomeText: "bounded large summary",
    });
    const finalResult = {
      role: "toolResult" as const,
      toolCallId: "large-typed",
      toolName: "ipython",
      content: [{ type: "text", text: large }],
      isError: false,
      details: {
        diffs: newDiffs,
        stdout: large,
        backgroundOutput: "late worker output",
        sentAgentMessages: [{ receiver: "parent", message: "exact child update" }],
        error: { name: "RuntimeError", message: "exact structured error", traceback: ["trace line"] },
      },
    };
    const [completed] = tracker.finishTurn({
      role: "assistant",
      content: [{ type: "toolCall", id: "large-typed", name: "ipython", arguments: input }],
    }, [finalResult]);
    const initialParts = typedObservationParts({
      ...initialEvent, content: [{ type: "text", text: large }],
    } as never);
    const parts = typedObservationParts(finalResult as never);
    expect(typedObservationPartsEqual(initialParts, parts)).toBe(false);
    const [facts] = buildExchangeFacts({
      exchanges: [{
        sourceOrder: 0,
        toolCallId: "large-typed",
        toolName: "ipython",
        originalInput: input,
        executedInput: input,
        result: finalResult,
      }],
      executionMode: "sequential",
      cwd: "/workspace",
    });
    expect(facts.intent.resources).toContain("/workspace/new.py");
    expect(facts.intent.mutatesWorkspace).toBe(true);
    expect(parts.find((part) => part.name === "diff")?.text).toContain("new.py");
    expect(parts.find((part) => part.name === "stdout")?.text).toBe(large);
    expect(parts.find((part) => part.name === "background-output")?.text).toBe("late worker output");
    expect(parts.find((part) => part.name === "sent-agent-messages")?.text).toContain("exact child update");
    expect(parts.find((part) => part.name === "error")?.text).toContain("exact structured error");
    expect(facts.outcome.status).toBe("failure");
  });

  it("archives and recovers REPL background output", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-background-output-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "background-output-session");
    const input = { code: "value = 1" };
    const result = {
      content: [{ type: "text" as const, text: "foreground" }],
      details: { stdout: "foreground", backgroundOutput: "late worker output" },
      isError: false,
    };
    await archive.finalizeExchanges([{
      metadata: exchangeMetadata("o1", "background-output"),
      toolName: "ipython",
      isError: false,
      parts: typedObservationParts({
        toolCallId: "background-output", toolName: "ipython", input, ...result,
      } as never),
      persistedModelInput: input,
      persistedRawCall: { type: "toolCall", id: "background-output", name: "ipython", arguments: input },
      persistedRawResult: result,
      resultText: "foreground",
    }]);
    const recovered = await archive.inspect("o1:background-output");
    expect((recovered.content[0] as { text: string }).text).toContain("late worker output");
    expect(recovered.details).toMatchObject({ ref: "o1:background-output" });
  });

  it("detects a same-byte change in bounded large visible output samples", () => {
    const tracker = new ExchangeTracker();
    const input = { command: "generate" };
    const original = `${"a".repeat(600 * 1024)}M${"b".repeat(600 * 1024)}`;
    const changed = `${"a".repeat(600 * 1024)}X${"b".repeat(600 * 1024)}`;
    const samples = (text: string): string[] => {
      const output = [String(text.length)];
      for (const ratio of [0, 0.25, 0.5, 0.75, 1]) {
        const center = Math.floor(text.length * ratio);
        output.push(text.slice(Math.max(0, center - 64), Math.min(text.length, center + 64)));
      }
      return output;
    };
    tracker.start({ toolCallId: "sampled", toolName: "bash", args: input });
    tracker.noteCall({ toolCallId: "sampled", toolName: "bash", input }, "/workspace");
    tracker.noteResult({ toolCallId: "sampled", toolName: "bash", input, isError: false },
      "/workspace", "bounded summary", {
        large: true,
        visibleResultText: original.slice(0, 64 * 1024),
        visibleResultBytes: Buffer.byteLength(original),
        visibleResultTruncated: true,
        visibleResultTail: original.slice(-4096),
        visibleResultSamples: samples(original),
      });
    const [completed] = tracker.finishTurn({
      role: "assistant",
      content: [{ type: "toolCall", id: "sampled", name: "bash", arguments: input }],
    }, [{
      role: "toolResult", toolCallId: "sampled", toolName: "bash",
      content: [{ type: "text", text: changed }], isError: false,
    }]);
    expect(completed.persistedResultChanged).toBe(true);
    expect(completed.persistedCanonicalResultChanged).toBe(true);
  });

  it("keeps result comparison samples fixed across many tiny blocks", async () => {
    const content = [
      ...Array.from({ length: 50000 }, () => ({ type: "text", text: "" })),
      ...Array.from({ length: 5000 }, () => ({ type: "text", text: "x" })),
    ];
    const stats = boundedResultTextStats(content);
    expect(stats.text).toBe("x".repeat(5000));
    expect(stats.textBytes).toBe(5000);
    expect(stats.samples).toHaveLength(6);
    expect(stats.samples[0]).toBe("5000");
    expect(boundedResultTextStats([
      { type: "text", text: "ab" }, { type: "text", text: "cd" },
    ]).samples).toEqual(boundedResultTextStats([{ type: "text", text: "abcd" }]).samples);

    const root = await mkdtemp(join(tmpdir(), "prime-context-many-blocks-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "many-blocks-session");
    const intent = adaptToolIntent({
      exchangeId: "o1", toolCallId: "many", toolName: "bash", input: { command: "many" },
      cwd: "/workspace", modelInputBytes: 1, resultText: stats.text, isError: false,
    });
    await archive.finalizeExchanges([{
      metadata: {
        exchangeId: "o1", toolCallId: "many", intentKind: intent.kind, subjectKey: intent.subjectKey,
        resources: intent.resources, mutatesWorkspace: false, modelInputBytes: 1, executedInputBytes: 1,
        outcome: collectFactualOutcome(intent, stats.text, false),
      },
      toolName: "bash", isError: false, source: "visible-tool-result",
      parts: [{ name: "result", kind: "result", text: stats.text }],
      persistedModelInput: { command: "many" },
      persistedRawResult: { content, isError: false },
      resultText: stats.text,
    }]);
    expect(await archive.readExactText("o1")).toBe(stats.text);
    expect((await archive.loadFixedExchangeViews())[0].result.kind).toBe("literal");
  });

  it("projects only complete unsigned pairs without mutating replay metadata or raw messages", () => {
    expect(fixedExchangeBudgetBytes()).toBe(24 * 1024);
    expect(fixedExchangeBudgetBytes({ tokens: 60, contextWindow: 100 })).toBe(16 * 1024);
    expect(fixedExchangeBudgetBytes({ tokens: 80, contextWindow: 100 })).toBe(8 * 1024);
    const signedCall = {
      type: "toolCall", id: "signed", name: "bash",
      arguments: { command: "signed raw command" },
      thoughtSignature: "opaque-provider-signature",
      vendorState: { keep: true },
    };
    const image = { type: "image", data: "aGVsbG8=", mimeType: "image/png", imageMeta: "keep" };
    const orphan = {
      role: "toolResult", toolCallId: "orphan", toolName: "bash",
      content: [{ type: "text", text: "orphan raw" }], isError: false, timestamp: 5,
    };
    const messages = [
      {
        role: "assistant",
        providerState: { keep: "assistant metadata" },
        content: [
          { type: "text", text: "assistant text", textSignature: "text-sig", extra: 1 },
          { type: "thinking", thinking: "reasoning", thinkingSignature: "thinking-sig", extra: 2 },
          {
            type: "toolCall", id: "plain", name: "bash",
            arguments: { command: "plain raw command" }, vendorState: { keep: true },
          },
          signedCall,
          { type: "toolCall", id: "live", name: "bash", arguments: { command: "live raw" } },
        ],
      },
      {
        role: "toolResult", toolCallId: "plain", toolName: "bash", details: { keep: true },
        content: [
          { type: "text", text: "plain raw result", resultMeta: "keep" },
          image,
          { type: "providerMeta", value: "keep provider block" },
          { type: "text", text: "plain raw tail", unknown: "removed with text" },
        ],
        isError: false, timestamp: 2,
      },
      {
        role: "toolResult", toolCallId: "signed", toolName: "bash",
        content: [{
          type: "text", text: "signed raw result", textSignature: "signed-result-text",
        }], isError: false, timestamp: 3,
      },
      orphan,
    ];
    const original = structuredClone(messages);
    const views: FixedExchangeView[] = [
      {
        schema: "prime-context.fixed-exchange-view/v1", generation: 0,
        exchangeId: "o1", toolCallId: "plain",
        callArguments: { command: '<archived-call ref="o1:call#/command" bytes="99" lines="1" />' },
        result: { kind: "capsule", text: "plain fixed capsule" },
        visibleBytes: 100,
      },
      {
        schema: "prime-context.fixed-exchange-view/v1", generation: 0,
        exchangeId: "o2", toolCallId: "signed",
        callArguments: { command: "must not replace signed arguments" },
        result: { kind: "capsule", text: "signed fixed capsule" },
        visibleBytes: 200,
      },
      {
        schema: "prime-context.fixed-exchange-view/v1", generation: 0,
        exchangeId: "o3", toolCallId: "live",
        callArguments: { command: "must remain live" },
        result: { kind: "literal" },
        visibleBytes: 300,
      },
    ];

    const projected = projectFixedExchangeViews(messages, views) as typeof messages;
    expect(projected).not.toBe(messages);
    expect((projected[0].content[2] as { arguments: unknown }).arguments).toEqual(views[0].callArguments);
    expect(projected[0].content[3]).toBe(signedCall);
    expect((projected[0].content[3] as typeof signedCall).arguments.command).toBe("signed raw command");
    expect((projected[0].content[4] as { arguments: { command: string } }).arguments.command).toBe("live raw");
    expect(projected[0].content[0]).toBe(messages[0].content[0]);
    expect(projected[0].content[1]).toBe(messages[0].content[1]);
    expect((projected[0] as { providerState: unknown }).providerState)
      .toBe((messages[0] as { providerState: unknown }).providerState);
    expect((projected[1] as { details: unknown }).details)
      .toBe((messages[1] as { details: unknown }).details);
    expect(projected[1].content).toHaveLength(3);
    expect(projected[1].content[0]).toMatchObject({ text: "plain fixed capsule", resultMeta: "keep" });
    expect(projected[1].content[1]).toBe(image);
    expect(projected[1].content[2]).toBe(messages[1].content[2]);
    expect(projected[2]).toBe(messages[2]);
    expect((projected[2].content[0] as { text: string }).text).toBe("signed raw result");
    expect(projected[3]).toBe(orphan);
    expect(messages).toEqual(original);
    expect(projectFixedExchangeViews(projected, views)).toBe(projected);
  });

  it("materializes a delta when its baseline leaves the active epoch", () => {
    const assistant = {
      role: "assistant",
      content: [
        { type: "toolCall", id: "baseline", name: "read", arguments: { path: "a" } },
        { type: "toolCall", id: "current", name: "read", arguments: { path: "a" } },
      ],
    };
    const baseline = { role: "toolResult", toolCallId: "baseline", toolName: "read", content: [{ type: "text", text: "full baseline" }] };
    const current = { role: "toolResult", toolCallId: "current", toolName: "read", content: [{ type: "text", text: "full current" }] };
    const view: FixedExchangeView = {
      schema: "prime-context.fixed-exchange-view/v1",
      generation: 0,
      exchangeId: "o2",
      toolCallId: "current",
      result: { kind: "capsule", text: "<prime_context_delta id=\"o2\">unchanged</prime_context_delta>" },
      visibleBytes: 64,
      deltaDependency: { baselineToolCallId: "baseline", contextEpoch: 7 },
    };

    const visible = projectFixedExchangeViews([assistant, baseline, current], [view], undefined, 7);
    expect((visible[2].content as Array<{ text: string }>)[0].text).toContain("prime_context_delta");
    const rebuilt = projectFixedExchangeViews([assistant, baseline, current], [view], undefined, 8);
    expect(rebuilt).toEqual([assistant, baseline, current]);
    const missing = projectFixedExchangeViews([assistant, current], [view], undefined, 7);
    expect(missing).toEqual([assistant, current]);
  });

  it("bounds the aggregate first-exposure fixed-view batch", () => {
    const budget = fixedExchangeBudgetBytes({ tokens: 80, contextWindow: 100 });
    const selected = selectFixedExchangeViews(
      Array.from({ length: 4 }, (_, sourceOrder) => ({
        exchangeId: `o${sourceOrder + 1}`,
        toolCallId: `call-${sourceOrder + 1}`,
        sourceOrder,
        toolName: "custom",
        renderedToolCall: {
          type: "toolCall", id: `call-${sourceOrder + 1}`, name: "custom", arguments: {},
        },
        resultText: `${sourceOrder}:${"result".repeat(2_000)}`,
        requiresCapsule: true,
        isError: false,
        changesWorkspace: false,
        capsule: (maxBytes: number) => "c".repeat(maxBytes),
      })),
      budget,
      2_048,
    );
    expect(selected).toHaveLength(4);
    expect(selected.every(({ view }) => view.result.kind === "capsule")).toBe(true);
    expect(selected.reduce((bytes, { view }) => bytes + view.visibleBytes, 0)).toBeLessThanOrEqual(budget);
  });

  it("keeps every required fixed view when fork imports exceed the optional cap", () => {
    const fixed = Array.from({ length: 513 }, (_, index) => `o${index + 1}`);
    const refs = selectForkImportRefs(["pinned"], fixed, ["visible", "o1"]);
    expect(refs.slice(0, 2)).toEqual(["pinned", "o1"]);
    expect(refs).toContain("o513");
    expect(refs).toContain("visible");
    expect(refs).toHaveLength(515);
    const branchView = {
      schema: "prime-context.fixed-exchange-view/v1" as const, generation: 0 as const,
      exchangeId: "o1", toolCallId: "branch-call", result: { kind: "literal" as const }, visibleBytes: 1,
    };
    const siblingView = { ...branchView, exchangeId: "o2", toolCallId: "sibling-call" };
    expect(scopeFixedExchangeViews([branchView, siblingView], new Set(["branch-call"])))
      .toEqual([branchView]);

    const branch: any[] = [
      { id: "cold-call-entry", type: "message", message: { role: "assistant", content: [{ type: "toolCall", id: "cold-call", name: "read", arguments: { path: "cold" } }] } },
      { id: "cold-result", type: "message", message: { role: "toolResult", toolCallId: "cold-call", content: [{ type: "text", text: "obs_cold" }] } },
      { id: "hot-user", type: "message", message: { role: "user", content: "keep hot" } },
      { id: "hot-call-entry", type: "message", message: { role: "assistant", content: [{ type: "toolCall", id: "hot-call", name: "read", arguments: { path: "hot", rawRef: "o998" } }] } },
      { id: "hot-result", type: "message", message: { role: "toolResult", toolCallId: "hot-call", content: [{ type: "text", text: "obs_hot" }], details: { rawRef: "o999" } } },
      { id: "summary", type: "branch_summary", summary: "surviving obs_summary" },
    ];
    const coldView = { ...branchView, exchangeId: "o-cold", toolCallId: "cold-call" };
    const hotView = { ...branchView, exchangeId: "o-hot", toolCallId: "hot-call", callArguments: { path: "<archived-call />" } };
    const visible = selectForkVisibleImports(branch, ["obs_pin"], [coldView, hotView]);
    expect(visible.completeToolCallIds).toEqual(new Set(["cold-call", "hot-call"]));
    expect(visibleFixedToolCallIds(branch)).toEqual(new Set(["cold-call", "hot-call"]));
    expect(visible.refs).toEqual(expect.arrayContaining(["obs_pin", "obs_summary", "obs_cold", "obs_hot"]));
    expect(visible.refs).not.toContain("o998");
    expect(visible.refs).not.toContain("o999");
  });

  it("previews a root-task pivot on the current contract and reuses its persisted anchor", async () => {
    type Handler = (event: any, context: any) => unknown;
    const handlers = new Map<string, Handler>();
    const pi = {
      on: (name: string, handler: Handler) => registerPatchedHandler(handlers, name, handler),
      registerTool: () => undefined,
      registerCommand: () => undefined,
      appendEntry: () => undefined,
      getAllTools: () => [],
    } as unknown as ExtensionAPI;
    primeContext(pi);
    const branch: any[] = [];
    const context = { cwd: "/workspace", sessionManager: { getBranch: () => branch } };
    const event = { prompt: "Build Step E", images: [], systemPrompt: "", systemPromptOptions: {} };
    expect(await handlers.get("before_agent_start")?.(event, context)).toBeUndefined();

    branch.push({ id: "user-root", type: "message", message: { role: "user", content: event.prompt } });
    handlers.get("model_context")?.({
      purpose: "provider",
      messages: [{ role: "user", content: event.prompt }],
      entryRefs: [{ messageIndex: 0, entryId: "user-root" }],
    }, context);
    const pivot = { ...event, prompt: "Also preserve images." };
    const first = await handlers.get("before_agent_start")?.(pivot, context) as any;
    expect(first).toBeUndefined();
  });

  it("uses a positional unscoped anchor for a durable new root", async () => {
    type Handler = (event: any, context: any) => unknown;
    const handlers = new Map<string, Handler>();
    const pi = {
      on: (name: string, handler: Handler) => registerPatchedHandler(handlers, name, handler),
      registerTool: () => undefined,
      registerCommand: () => undefined,
      appendEntry: () => undefined,
      getAllTools: () => [],
    } as unknown as ExtensionAPI;
    primeContext(pi);
    const branch: any[] = [
      { id: "old-root", type: "message", message: { role: "user", content: "Old task" } },
      { id: "old-stop", type: "message", message: { role: "assistant", content: "done", stopReason: "stop" } },
      {
        id: "snapshot",
        type: "custom",
        customType: "prime-context.task-snapshot",
        data: {
          schema: "prime-context.task-snapshot/v1",
          focus: "keep durable focus",
          openItems: [],
          pinnedObservationIds: [],
          updatedAt: "ignored",
        },
      },
    ];
    const context = { cwd: "/workspace", sessionManager: { getBranch: () => branch } };
    handlers.get("session_tree")?.({}, context);
    const event = { prompt: "Start durable new task", images: [], systemPrompt: "", systemPromptOptions: {} };
    const first = await handlers.get("before_agent_start")?.(event, context) as any;
    expect(first).toBeUndefined();
  });

  it("keeps model-context projection pure when compaction cuts the visible root", () => {
    type Handler = (event: any, context: any) => unknown;
    const handlers = new Map<string, Handler>();
    const pi = {
      on: (name: string, handler: Handler) => registerPatchedHandler(handlers, name, handler),
      registerTool: () => undefined,
      registerCommand: () => undefined,
      appendEntry: () => undefined,
      getAllTools: () => [],
    } as unknown as ExtensionAPI;
    primeContext(pi);
    const branch: any[] = [
      { id: "root", type: "message", message: { role: "user", content: "Keep the root contract" } },
      { id: "kept", type: "message", message: { role: "assistant", content: "retained", stopReason: "stop" } },
      { id: "compact", type: "compaction", firstKeptEntryId: "kept" },
    ];
    const context = { cwd: "/workspace", sessionManager: { getBranch: () => branch } };
    handlers.get("session_compact")?.({}, context);
    const projected = handlers.get("model_context")?.({
      purpose: "provider",
      messages: [{ role: "user", content: "summary" }, branch[1].message],
      entryRefs: [{ messageIndex: 0, entryId: "compact" }, { messageIndex: 1, entryId: "kept" }],
    }, context) as any;

    expect(projected).toEqual({ projectionIdentity: expect.any(String) });
  });

  it("finds a retained goal anchor when firstKept is older than the goal slice", async () => {
    type Handler = (event: any, context: any) => unknown;
    const handlers = new Map<string, Handler>();
    const pi = {
      on: (name: string, handler: Handler) => registerPatchedHandler(handlers, name, handler),
      registerTool: () => undefined,
      registerCommand: () => undefined,
      appendEntry: () => undefined,
      getAllTools: () => [],
    } as unknown as ExtensionAPI;
    primeContext(pi);
    const branch: any[] = [
      { id: "kept", type: "message", message: { role: "assistant", content: "retained" } },
      { id: "goal-user", type: "message", message: { role: "user", content: "Build the goal" } },
      { id: "goal-state", type: "custom", customType: "thread_goal_state", data: { goalId: "g1", objective: "Build the goal", status: "active" } },
    ];
    const context = { cwd: "/workspace", sessionManager: { getBranch: () => branch } };
    const event = { prompt: "continue", images: [], systemPrompt: "", systemPromptOptions: {} };
    expect(await handlers.get("before_agent_start")?.(event, context)).toBeUndefined();
    branch.push({ id: "compact", type: "compaction", firstKeptEntryId: "kept" });
    expect(await handlers.get("before_agent_start")?.(event, context)).toBeUndefined();
  });

  it("registers named hooks and commits one replacement runtime at turn_end", async () => {
    type Handler = (event: any, context: any) => unknown;
    const handlers = new Map<string, Handler>();
    const appended: Array<{ type: string; data: any }> = [];
    const pi = {
      on: (name: string, handler: Handler) => registerPatchedHandler(handlers, name, handler),
      registerTool: () => undefined,
      registerCommand: () => undefined,
      appendEntry: (type: string, data: any) => appended.push({ type, data }),
      getAllTools: () => [],
    } as unknown as ExtensionAPI;
    primeContext(pi);

    expect(requiredHooksLoaded(new Set(handlers.keys()))).toBe(true);
    const missing = new Set(REQUIRED_HOOKS);
    missing.delete("turn_end");
    expect(requiredHooksLoaded(missing)).toBe(false);

    const branch = [{
      id: "user-root",
      type: "message",
      message: { role: "user", content: "REQUIREMENTS LOCKED. Before completion, run pytest tests and npm run typecheck." },
    }];
    const sessionManager = { getBranch: () => branch };
    handlers.get("model_context")?.({
      purpose: "provider",
      messages: [{ role: "user", content: branch[0].message.content }],
      entryRefs: [{ messageIndex: 0, entryId: "user-root" }],
    }, { cwd: "/workspace", sessionManager });

    const input = { command: "pytest tests" };
    handlers.get("tool_execution_start")?.(
      { toolCallId: "call", toolName: "bash", args: { command: "pytest tests" } },
      {},
    );
    const result = handlers.get("tool_call")?.(
      { toolCallId: "call", toolName: "bash", input },
      { cwd: "/workspace", sessionManager },
    );
    expect(result).toBeUndefined();
    expect(input).toEqual({ command: "pytest tests" });

    await handlers.get("tool_result")?.(
      {
        toolCallId: "call", toolName: "bash", input, isError: false,
        content: [{ type: "text", text: "TEST_RESULT PASS 2/2" }],
      },
      { cwd: "/workspace", signal: undefined, getContextUsage: () => undefined },
    );
    const turnResult = await handlers.get("turn_end")?.({
      toolExecution: "parallel",
      message: {
        role: "assistant",
        content: [{ type: "toolCall", id: "call", name: "bash", arguments: input }],
      },
      toolResults: [{
        role: "toolResult", toolCallId: "call", toolName: "bash",
        content: [{ type: "text", text: "TEST_RESULT PASS 2/2" }],
        isError: false, timestamp: 1,
      }],
    }, {
      cwd: "/workspace",
      signal: undefined,
      sessionManager,
      getContextUsage: () => undefined,
    setAutomaticRefinementEnabled: () => undefined,
    });

    expect(appended).toHaveLength(1);
    expect(appended[0].type).toBe("prime-context.task-snapshot");
    expect(appended[0].data).toMatchObject({
      schema: "prime-context.task-snapshot/v2",
      taskKey: "user-root",
      actionableObservations: expect.any(Array),
    });
    expect(turnResult).toMatchObject({
      messages: [{
        role: "custom",
        customType: "prime_context_update",
        display: false,
        timestamp: expect.any(Number),
        details: { schema: "prime-context.task-update/v1", taskKey: "user-root" },
      }],
    });
    const noOpResult = await handlers.get("turn_end")?.({
      toolExecution: "sequential",
      message: { role: "assistant", content: "done", stopReason: "stop" },
      toolResults: [],
    }, {
      cwd: "/workspace",
      signal: undefined,
      sessionManager,
      getContextUsage: () => undefined,
    setAutomaticRefinementEnabled: () => undefined,
    });
    expect(noOpResult).toBeUndefined();
    expect(appended).toHaveLength(1);
  });

  it("leaves compaction and tree summarization to the host", async () => {
    type Handler = (event: any, context: any) => any;
    const handlers = new Map<string, Handler>();
    const pi = {
      on: (name: string, handler: Handler) => registerPatchedHandler(handlers, name, handler),
      registerTool: () => undefined,
      registerCommand: () => undefined,
      appendEntry: () => undefined,
      getAllTools: () => [],
    } as unknown as ExtensionAPI;
    primeContext(pi);
    expect(await handlers.get("session_before_compact")?.({}, {})).toBeUndefined();
    expect(await handlers.get("session_before_tree")?.({}, {})).toBeUndefined();
  });

  it("does not archive output returned by the prime_context tool itself", () => {
    expect(shouldArchiveToolResult("prime_context")).toBe(false);
    const tracker = new ExchangeTracker();
    tracker.start({ toolCallId: "recovery", toolName: "prime_context", args: { action: "read" } });
    tracker.noteCall({
      toolCallId: "recovery", toolName: "prime_context", input: { action: "read" },
    }, "/workspace");
    const exchange = tracker.noteResult({
      toolCallId: "recovery", toolName: "prime_context", input: { action: "read" }, isError: false,
    }, "/workspace", "large recovery output", {
      source: "visible-tool-result", parts: [], retainResultText: false,
    });
    expect(exchange.outcome).toBeUndefined();
    expect(exchange.resultText).toBeUndefined();
  });

  it("continues to archive ordinary tool output", () => {
    expect(shouldArchiveToolResult("bash")).toBe(true);
  });

  it("keeps a new tool image through retries and pages it after one successful response", async () => {
    type Handler = (event: any, context: any) => any;
    type Execute = (id: string, params: unknown, signal?: AbortSignal) => Promise<any>;
    const handlers = new Map<string, Handler>();
    let execute: Execute | undefined;
    const pi = {
      on: (name: string, handler: Handler) => registerPatchedHandler(handlers, name, handler),
      registerTool: (tool: { execute: Execute }) => { execute = tool.execute; },
      registerCommand: () => undefined,
      appendEntry: () => undefined,
      getAllTools: () => [],
    } as unknown as ExtensionAPI;
    primeContext(pi);
    const archiveRoot = await mkdtemp(join(tmpdir(), "prime-context-media-lease-"));
    temporaryPaths.push(archiveRoot);
    const branch: any[] = [];
    const context = {
      cwd: "/workspace",
      signal: undefined,
      sessionManager: { getBranch: () => branch, getSessionId: () => "media-session" },
      getContextUsage: () => undefined,
    setAutomaticRefinementEnabled: () => undefined,
    };
    const previousHome = process.env.PRIME_CONTEXT_HOME;
    process.env.PRIME_CONTEXT_HOME = archiveRoot;
    try {
      await handlers.get("session_start")?.({ reason: "startup" }, context);
    } finally {
      if (previousHome === undefined) delete process.env.PRIME_CONTEXT_HOME;
      else process.env.PRIME_CONTEXT_HOME = previousHome;
    }
    const image = {
      type: "image" as const,
      mimeType: "image/png",
      data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    };
    handlers.get("tool_execution_start")?.({
      toolCallId: "image-call", toolName: "custom", args: {},
    }, context);
    handlers.get("tool_call")?.({
      toolCallId: "image-call", toolName: "custom", input: {},
    }, context);
    const imageResult = {
      toolCallId: "image-call",
      toolName: "custom",
      input: {},
      content: [image],
      details: {},
      isError: false,
    };
    await handlers.get("tool_result")?.(imageResult, context);
    await handlers.get("turn_end")?.({
      message: {
        role: "assistant",
        content: [{ type: "toolCall", id: "image-call", name: "custom", arguments: {} }],
      },
      toolResults: [imageResult],
    }, context);
    expect((await new ObservationArchive(archiveRoot, "media-session").inspect("o1:image:1")).details)
      .toMatchObject({ ref: "o1:image:1", binaryBytes: 68, width: 1, height: 1 });
    const raw = [{
      role: "toolResult",
      toolCallId: "image-call",
      toolName: "custom",
      content: [image],
      details: { raw: true },
      isError: false,
    }];
    const first = handlers.get("model_context")?.({ purpose: "provider", messages: raw }, context);
    expect(first.messages[0].content[0]).toEqual(image);
    expect(first.messages[0].details).toBeUndefined();
    await handlers.get("session_compact")?.({}, context);
    await handlers.get("message_end")?.({ message: { role: "assistant", stopReason: "aborted", content: [] } }, context);
    const retry = handlers.get("model_context")?.({ purpose: "provider", messages: raw }, context);
    expect(retry.messages[0].content[0]).toEqual(image);
    await handlers.get("message_end")?.({ message: { role: "assistant", stopReason: "stop", content: [] } }, context);
    const consumed = handlers.get("model_context")?.({ purpose: "provider", messages: raw }, context);
    expect(consumed.messages[0].content[0]).toEqual(image);
    expect(raw[0].content[0]).toEqual(image);
    const reopened = new ObservationArchive(archiveRoot, "media-session");
    await reopened.count();
    expect(reopened.brokerStatistics().metrics.typedMediaBytesProjectedOut).toBe(0);

    if (!execute) throw new Error("prime_context tool was not registered");
    const recovery = await execute("recovery-call", {
      action: "inspect", ref: "media-session:o1:image:1", scope: "session",
    });
    const recoveryRaw = [{
      role: "toolResult", toolCallId: "recovery-call", toolName: "prime_context",
      content: recovery.content, details: recovery.details, isError: false,
    }];
    const recoveredFirst = handlers.get("model_context")?.({ purpose: "provider", messages: recoveryRaw }, context);
    expect(recoveredFirst.messages[0].content).toContainEqual(image);
    await handlers.get("message_end")?.({ message: { role: "assistant", stopReason: "aborted", content: [] } }, context);
    const beforeRecoveryCommit = new ObservationArchive(archiveRoot, "media-session");
    await beforeRecoveryCommit.count();
    expect(beforeRecoveryCommit.brokerStatistics().metrics.inspectRecallHits).toBe(0);
    handlers.get("model_context")?.({ purpose: "provider", messages: recoveryRaw }, context);
    await handlers.get("message_end")?.({ message: { role: "assistant", stopReason: "stop", content: [] } }, context);
    const afterRecoveryCommit = new ObservationArchive(archiveRoot, "media-session");
    await afterRecoveryCommit.count();
    expect(afterRecoveryCommit.brokerStatistics().metrics).toMatchObject({
      typedMediaBytesProjectedOut: 0,
      inspectRecallHits: 0,
      recoveryBytesExposed: 0,
    });

    const imported = projectModelContext({
      purpose: "provider",
      messages: raw,
      fixedViews: [{
        schema: "prime-context.fixed-exchange-view/v1",
        generation: 0,
        exchangeId: "o1",
        toolCallId: "image-call",
        result: { kind: "literal" },
        visibleBytes: 8,
        images: [{ ref: "o1:image:1", mimeType: "image/png", bytes: 68, width: 1, height: 1 }],
      }],
    });
    expect((imported.messages[0].content as any[])[0].type).toBe("image");
  });

  it("bounds unconsumed pending image results", async () => {
    const { handlers, context } = await extensionHarness([], "bounded-pending-images");
    const image = {
      type: "image" as const,
      mimeType: "image/png",
      data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    };
    const results: any[] = [];
    const calls: any[] = [];
    for (let index = 0; index < 34; index += 1) {
      const id = `image-${index}`;
      const input = { index };
      handlers.get("tool_execution_start")?.({ toolCallId: id, toolName: "custom", args: input }, context);
      handlers.get("tool_call")?.({ toolCallId: id, toolName: "custom", input }, context);
      const result = { toolCallId: id, toolName: "custom", input, content: [image], details: {}, isError: false };
      await handlers.get("tool_result")?.(result, context);
      results.push(result);
      calls.push({ type: "toolCall", id, name: "custom", arguments: input });
    }
    await handlers.get("turn_end")?.({ message: { role: "assistant", content: calls }, toolResults: results }, context);
    const raw = results.map((result) => ({ role: "toolResult", ...result }));
    const projected = handlers.get("model_context")?.({ purpose: "provider", messages: raw }, context);
    const firstBlocks = projected.messages.map((message: any) => message.content[0]);
    expect(firstBlocks.filter((block: any) => block.type === "image")).toHaveLength(34);
    expect(firstBlocks.filter((block: any) => block.type === "text" && block.text.includes("shown once"))).toHaveLength(0);
  });

  it("clears cached fixed views with current-session cleanup", async () => {
    let handler: ((args: string, ctx: any) => Promise<void>) | undefined;
    let cleared = 0;
    const pi = {
      registerCommand: (_name: string, command: { handler: typeof handler }) => {
        handler = command.handler;
      },
    } as unknown as ExtensionAPI;
    const actions = {
      getArchive: () => ({ clear: async () => 2 }),
      getSnapshot: () => createTaskSnapshotV2("session"),
      clearFixedViews: () => { cleared += 1; },
    } as unknown as PrimeContextActions;
    registerPrimeContextCommands(pi, actions);
    await handler?.("cleanup current", {
      signal: new AbortController().signal,
      ui: { notify: () => undefined },
    });
    expect(cleared).toBe(1);
  });

  it("bounds model-facing recovery ranges and result bytes", async () => {
    const calls: Array<{ action: string; args: unknown[] }> = [];
    const archive = {
      sessionId: "current-session",
      findObservation: async (id: string) => ({ id, createdAt: "2026-08-29T10:00:00.000Z", envelope: {} }),
      readLines: async (...args: unknown[]) => {
        calls.push({ action: "read", args });
        return "read result";
      },
      search: async (...args: unknown[]) => {
        calls.push({ action: "search", args });
        return "search result";
      },
      inspect: async (...args: unknown[]) => {
        calls.push({ action: "inspect", args });
        const ref = args[0] as string;
        const direct = ref === "o1:stderr";
        return {
          content: [{ type: "text", text: direct ? "exact recovered stderr" : "x".repeat(5000) }],
          details: {
            observationId: direct ? "o1" : "obs_one",
            ref,
            partKind: direct ? "stderr" : "result",
            startLine: 1,
            endLine: direct ? 1 : 80,
            totalLines: direct ? 1 : 200,
            hasMore: !direct,
            subjectKey: "test",
            scope: "task",
            currentWorkspace: true,
            currentRequirements: true,
          },
        };
      },
      list: async (limit: number) => {
        calls.push({ action: "list", args: [limit] });
        return [];
      },
      recordRecovery: () => undefined,
      recall: async (...args: unknown[]) => {
        calls.push({ action: "recall", args });
        return {
          content: [{ type: "text", text: "project recall result" }],
          matches: [{ ref: "o1:result", sessionId: "project-session" }],
        };
      },
    };
    const leases = new Map<string, Array<{ type: string; text: string }>>();
    const actions = {
      getArchive: () => archive,
      getReadMaxBytes: () => 65_536,
      getSnapshot: () => createTaskSnapshotV2("task", "Recover evidence"),
      registerRecoveryLease: (id: string, content: unknown) =>
        leases.set(id, content as Array<{ type: string; text: string }>),
      registerRecoveryUtility: () => undefined,
      resolveRecallSources: async () => [{
        archive,
        scope: "project" as const,
        sessionId: "project-session",
        sessionDate: "2026-08-29T10:00:00.000Z",
      }],
    } as unknown as PrimeContextActions;
    type Execute = (id: string, params: unknown, signal: AbortSignal) => Promise<unknown>;
    let execute: Execute | undefined;
    const pi = {
      registerTool: (tool: { execute: Execute }) => {
        execute = tool.execute;
      },
    } as unknown as ExtensionAPI;
    registerPrimeContextTool(pi, actions);
    if (!execute) throw new Error("prime_context tool was not registered");
    const signal = new AbortController().signal;

    await execute("read-call", { action: "read", id: "obs_one", endLine: 10_000 }, signal);
    await execute("search-call", { action: "search", id: "obs_one", query: "failure", maxMatches: 50 }, signal);
    const receipt = await execute("inspect-call", { action: "inspect", ref: "o1:stderr" }, signal) as any;
    const projectReceipt = await execute("project-inspect", {
      action: "inspect", ref: "project-session:o1:stderr", scope: "project",
    }, signal) as any;
    await execute("list-call", { action: "list", limit: 100 }, signal);
    const projectSearch = await execute("project-search", {
      action: "search", query: "known path", scope: "project",
    }, signal) as any;

    expect(calls[0].args[0]).toBe("obs_one:result");
    expect(calls[0].args[1]).toMatchObject({
      startLine: 1, endLine: MODEL_READ_DEFAULT_LINES, maxBytes: MODEL_RECOVERY_MAX_BYTES,
    });
    expect(calls[1].args[0]).toBe("obs_one:result");
    expect(calls[1].args[1]).toMatchObject({
      query: "failure", matchOffset: 0, maxMatches: MODEL_SEARCH_DEFAULT_MATCHES,
      maxBytes: MODEL_RECOVERY_MAX_BYTES,
    });
    expect(calls[2].args[0]).toBe("o1:stderr");
    expect(calls[3].args[0]).toBe("o1:stderr");
    expect(calls[3].args[3]).toBe(true);
    expect(calls[4].args).toEqual([MODEL_LIST_MAX_OBSERVATIONS]);
    expect(calls[5]).toMatchObject({ action: "recall" });
    expect(calls[5].args[0]).toMatchObject({ query: "known path", scope: "project" });
    expect(receipt.content[0].text).toBe("exact recovered stderr");
    expect(receipt.details).toMatchObject({ ref: "o1:stderr", currentWorkspace: true });
    expect(projectReceipt.content[0].text).toBe("exact recovered stderr");
    expect(projectReceipt.details).toMatchObject({ ref: "o1:stderr", scope: "project", sessionId: "project-session" });
    expect(projectSearch.content[0].text).toBe("project recall result");
    expect(leases.size).toBe(0);
  });
});


function exchangeMetadata(exchangeId: string, toolCallId: string, text = "ok") {
  return {
    exchangeId,
    toolCallId,
    intentKind: "run" as const,
    subjectKey: `tool:${toolCallId}`,
    resources: [],
    mutatesWorkspace: false,
    modelInputBytes: 1,
    executedInputBytes: 1,
    outcome: analyzeOutcome(text, false),
  };
}

type Handler = (event: any, context: any) => any;

async function extensionHarness(
  branch: any[],
  sessionId: string,
  setAutomaticRefinementEnabled: (enabled: boolean | undefined) => void = () => undefined,
) {
  const root = await mkdtemp(join(tmpdir(), "prime-context-final-blockers-"));
  temporaryPaths.push(root);
  await mkdir(join(root, ".prime", "agent"), { recursive: true });
  await writeFile(join(root, ".prime", "agent", "prime-context.json"), JSON.stringify({
    enabled: true,
    minTextBytes: 1,
    capsuleMaxBytes: 1024,
  }));

  const handlers = new Map<string, Handler>();
  const appended: Array<{ type: string; data: unknown }> = [];
  const pi = {
    on: (name: string, handler: Handler) => registerPatchedHandler(handlers, name, handler),
    registerTool: () => undefined,
    registerCommand: () => undefined,
    appendEntry: (type: string, data: unknown) => appended.push({ type, data }),
    getAllTools: () => [],
  } as unknown as ExtensionAPI;
  primeContext(pi);
  const context = {
    cwd: root,
    signal: undefined,
    sessionManager: {
      getBranch: () => branch,
      getSessionId: () => sessionId,
    },
    getContextUsage: () => undefined,
    setAutomaticRefinementEnabled,
  };
  const previousHome = process.env.PRIME_CONTEXT_HOME;
  process.env.PRIME_CONTEXT_HOME = root;
  try {
    await handlers.get("session_start")?.({ reason: "startup" }, context);
  } finally {
    if (previousHome === undefined) delete process.env.PRIME_CONTEXT_HOME;
    else process.env.PRIME_CONTEXT_HOME = previousHome;
  }
  return { root, handlers, context, appended };
}

describe("final Step H/I blockers", () => {
  it("releases refinement and finalizes zero-call accounting on shutdown", async () => {
    const refinementStates: Array<boolean | undefined> = [];
    const harness = await extensionHarness([], "refinement-shutdown", (enabled) => {
      refinementStates.push(enabled);
    });
    const metricsPath = join(harness.root, "benchmark-metrics.json");
    const previousMetrics = process.env.PRIME_CONTEXT_BENCHMARK_METRICS;
    process.env.PRIME_CONTEXT_BENCHMARK_METRICS = metricsPath;
    try {
      expect(refinementStates).toEqual([false]);
      await harness.handlers.get("before_agent_start")?.({
        prompt: "Complete one benchmark task",
        images: [],
        systemPrompt: "",
        systemPromptOptions: {},
      }, harness.context);
      await harness.handlers.get("session_shutdown")?.({}, harness.context);
      expect(refinementStates).toEqual([false, undefined]);
      const metrics = JSON.parse(await readFile(metricsPath, "utf8"));
      expect(metrics.auxiliary.zeroCallTasks).toBe(1);
    } finally {
      if (previousMetrics === undefined) delete process.env.PRIME_CONTEXT_BENCHMARK_METRICS;
      else process.env.PRIME_CONTEXT_BENCHMARK_METRICS = previousMetrics;
    }
  });

  it("continues exact byte pages through a long single-line call field", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-call-page-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "call-page");
    const code = `prefix-${"🙂漢字".repeat(3_000)}-suffix`;
    const input = { code };
    await archive.finalizeExchanges([{
      metadata: {
        ...exchangeMetadata("o1", "call-1"),
        modelInputBytes: Buffer.byteLength(JSON.stringify(input)),
        executedInputBytes: Buffer.byteLength(JSON.stringify(input)),
      },
      toolName: "ipython",
      isError: false,
      persistedModelInput: input,
      persistedRawCall: { type: "toolCall", id: "call-1", name: "ipython", arguments: input },
      persistedRawResult: { content: [{ type: "text", text: "ok" }], isError: false },
      resultText: "ok",
    }]);

    let startByte = 0;
    let recovered = "";
    while (true) {
      const page = await archive.inspect("o1:call#/code", { startByte, maxBytes: 257 });
      recovered += (page.content[0] as { text: string }).text;
      expect(page.details.startByte).toBe(startByte);
      if (!page.details.hasMore) break;
      expect(page.details.endByte).toBeGreaterThan(startByte);
      startByte = page.details.endByte!;
    }
    expect(recovered).toBe(code);
    expect(Buffer.byteLength(recovered)).toBe(Buffer.byteLength(code));
    const scalarPage = await archive.inspect("o1:call#/code", { startByte: 7, endByte: 8 });
    expect((scalarPage.content[0] as { text: string }).text).toBe("🙂");
    expect(scalarPage.details).toMatchObject({ startByte: 7, endByte: 11, hasMore: true });
  });

  it("admits reverse-completed parallel results in assistant source order through hooks", async () => {
    const branch = [{
      id: "root", type: "message", message: { role: "user", content: "Run both commands." },
    }];
    const { root, handlers, context } = await extensionHarness(branch, "parallel-order");
    const inputA = { command: "printf a" };
    const inputB = { command: "printf b" };
    for (const [toolCallId, input] of [["a", inputA], ["b", inputB]] as const) {
      handlers.get("tool_execution_start")?.({ toolCallId, toolName: "bash", args: input }, context);
      handlers.get("tool_call")?.({ toolCallId, toolName: "bash", input }, context);
    }
    const resultA = {
      role: "toolResult", toolCallId: "a", toolName: "bash", input: inputA,
      content: [{ type: "text", text: `A_SOURCE_FIRST\n${"a".repeat(20_000)}` }], isError: false,
    };
    const resultB = {
      role: "toolResult", toolCallId: "b", toolName: "bash", input: inputB,
      content: [{ type: "text", text: `B_SOURCE_SECOND\n${"b".repeat(20_000)}` }], isError: false,
    };
    await handlers.get("tool_result")?.(resultB, context);
    await handlers.get("tool_result")?.(resultA, context);
    const assistant = {
      role: "assistant",
      content: [
        { type: "toolCall", id: "a", name: "bash", arguments: inputA },
        { type: "toolCall", id: "b", name: "bash", arguments: inputB },
      ],
    };
    await handlers.get("turn_end")?.({
      toolExecution: "parallel", message: assistant, toolResults: [resultB, resultA],
    }, context);

    const archive = new ObservationArchive(root, "parallel-order");
    expect((await archive.findObservation("o1")).envelope?.toolCallId).toBe("a");
    expect((await archive.findObservation("o2")).envelope?.toolCallId).toBe("b");
    const views = await archive.loadFixedExchangeViews();
    expect(new Map(views.map((view) => [view.exchangeId, view.toolCallId])))
      .toEqual(new Map([["o1", "a"], ["o2", "b"]]));

    const projected = handlers.get("model_context")?.({
      purpose: "provider",
      messages: [assistant, resultA, resultB],
    }, context);
    expect(projected.messages[1].content[0].text).toContain("A_SOURCE_FIRST");
    expect(projected.messages[2].content[0].text).toContain("B_SOURCE_SECOND");
  });

  it("refreshes the capsule and outcome from the final persisted result and isError", async () => {
    const branch = [{
      id: "root", type: "message", message: { role: "user", content: "Run pytest." },
    }];
    const { root, handlers, context } = await extensionHarness(branch, "final-result");
    const input = { command: "pytest -q" };
    handlers.get("tool_execution_start")?.({ toolCallId: "test", toolName: "bash", args: input }, context);
    handlers.get("tool_call")?.({ toolCallId: "test", toolName: "bash", input }, context);
    const stale = `STALE_SUCCESS\n${"old output\n".repeat(1_000)}1 passed`;
    const final = `FINAL_PERSISTED_FAILURE\n${"new output\n".repeat(1_000)}1 failed\nTEST_RESULT FAIL 0/1`;
    await handlers.get("tool_result")?.({
      toolCallId: "test", toolName: "bash", input,
      content: [{ type: "text", text: stale }], isError: false,
    }, context);
    await handlers.get("turn_end")?.({
      toolExecution: "parallel",
      message: {
        role: "assistant",
        content: [{ type: "toolCall", id: "test", name: "bash", arguments: input }],
      },
      toolResults: [{
        role: "toolResult", toolCallId: "test", toolName: "bash",
        content: [{ type: "text", text: final }], isError: true,
      }],
    }, context);

    const archive = new ObservationArchive(root, "final-result");
    const record = await archive.findObservation("o1");
    expect(record.isError).toBe(true);
    expect(record.exchange?.outcome.status).toBe("failure");
    expect(await archive.readExactText("o1")).toBe(final);
    expect(record.envelope?.resultCapsule).toContain("TEST_RESULT FAIL 0/1");
    expect(record.envelope?.resultCapsule).not.toContain("STALE_SUCCESS");
    const [view] = await archive.loadFixedExchangeViews();
    expect(view.result).toMatchObject({
      kind: "capsule", text: expect.stringContaining("TEST_RESULT FAIL 0/1"),
    });
  });

  it("freezes file-backed result bytes at tool completion before source-order admission", async () => {
    const branch = [{ id: "root", type: "message", message: { role: "user", content: "Capture output." } }];
    const { root, handlers, context } = await extensionHarness(branch, "frozen-file-result");
    const fullOutputPath = join(root, "complete-output.txt");
    const original = `${"original line\n".repeat(90_000)}ORIGINAL_TAIL`;
    await writeFile(fullOutputPath, original);
    const input = { command: "generate-output" };
    handlers.get("tool_execution_start")?.({ toolCallId: "file", toolName: "bash", args: input }, context);
    handlers.get("tool_call")?.({ toolCallId: "file", toolName: "bash", input }, context);
    const result = {
      role: "toolResult", toolCallId: "file", toolName: "bash", input,
      content: [{ type: "text", text: "ORIGINAL_TAIL" }],
      details: { fullOutputPath, exitCode: 0 }, isError: false,
    };
    await handlers.get("tool_result")?.(result, context);
    await writeFile(fullOutputPath, `${"replacement\n".repeat(90_000)}REPLACEMENT_TAIL`);
    const assistant = {
      role: "assistant",
      content: [{ type: "toolCall", id: "file", name: "bash", arguments: input }],
    };
    await handlers.get("turn_end")?.({ message: assistant, toolResults: [result], toolExecution: "sequential" }, context);
    const archive = new ObservationArchive(root, "frozen-file-result");
    expect(await archive.readExactText("o1")).toBe(original);
    const sidecar = JSON.parse(await readFile(join(archive.observationsPath, "o1.meta.json"), "utf8"));
    const resultPart = sidecar.parts.find((part: { kind: string }) => part.kind === "result");
    expect(resultPart.textBytes).toBe(Buffer.byteLength(original, "utf8"));
    expect(sidecar.fixedView.result).toMatchObject({ kind: "literal" });
  });

  it("exactly reconciles an unsampled same-size raw-content edit", async () => {
    const branch = [{ id: "root", type: "message", message: { role: "user", content: "Capture exact output." } }];
    const { root, handlers, context } = await extensionHarness(branch, "hidden-file-reconcile");
    const fullOutputPath = join(root, "hidden-complete-output.txt");
    const original = "a".repeat(32_000);
    const changed = `${original.slice(0, 12_000)}X${original.slice(12_001)}`;
    await writeFile(fullOutputPath, original);
    const input = { command: "generate-hidden-output" };
    handlers.get("tool_execution_start")?.({ toolCallId: "hidden", toolName: "bash", args: input }, context);
    handlers.get("tool_call")?.({ toolCallId: "hidden", toolName: "bash", input }, context);
    const result = {
      role: "toolResult", toolCallId: "hidden", toolName: "bash", input,
      content: [{ type: "text", text: original }], details: { fullOutputPath, exitCode: 0 }, isError: false,
    };
    await handlers.get("tool_result")?.(result, context);
    await writeFile(fullOutputPath, changed);
    result.content = [{ type: "text", text: changed }];
    await handlers.get("turn_end")?.({
      message: { role: "assistant", content: [{ type: "toolCall", id: "hidden", name: "bash", arguments: input }] },
      toolResults: [result], toolExecution: "sequential",
    }, context);
    expect(await new ObservationArchive(root, "hidden-file-reconcile").readExactText("o1")).toBe(changed);
  });

  it("projects and fork-imports a synthetic large bash execution by entry ID", async () => {
    const entryId = "shell-entry";
    const command = `python -c '${"x".repeat(9_000)}'`;
    const output = Array.from({ length: 1_500 }, (_, index) => `output ${index} ${"y".repeat(20)}`).join("\n");
    const source: any = {
      role: "bashExecution", command, output, exitCode: 0, cancelled: false, timestamp: 1,
    };
    const rootEntry = { id: "shell-root", type: "message", message: { role: "user", content: "Inspect shell output." } };
    const branch: any[] = [rootEntry];
    const { root, handlers, context } = await extensionHarness(branch, "bash-parent");
    const completeOutput = Array.from({ length: 1_500 }, (_, index) => `complete ${index} ${"z".repeat(20)}`).join("\n");
    const fullOutputPath = join(root, "historical-full-output.txt");
    await writeFile(fullOutputPath, completeOutput);
    source.fullOutputPath = fullOutputPath;
    branch.push({ id: entryId, type: "message", message: source });
    await handlers.get("user_bash_end")?.({
      type: "user_bash_end", entryId, command, output, isError: false, exitCode: 0, fullOutputPath,
    }, context);
    await writeFile(fullOutputPath, "replacement after import");
    const raw = { role: "user", content: [{ type: "text", text: output }] };
    const projected = handlers.get("model_context")?.({
      purpose: "provider",
      messages: [rootEntry.message, raw],
      entryRefs: [{ messageIndex: 0, entryId: rootEntry.id }, { messageIndex: 1, entryId }],
    }, context);
    expect(JSON.stringify(projected.messages[1])).toContain(`ub_${entryId}`);
    expect(JSON.stringify(projected.messages[1]).length).toBeLessThan(output.length / 2);
    const compactProjection = handlers.get("model_context")?.({
      purpose: "compaction",
      messages: [rootEntry.message, raw],
      entryRefs: [{ messageIndex: 0, entryId: rootEntry.id }, { messageIndex: 1, entryId }],
    }, context);
    const compacted = await handlers.get("session_before_compact")?.({
      preparation: {
        firstKeptEntryId: "after-shell",
        messagesToSummarize: compactProjection?.messages ?? [rootEntry.message, raw],
        turnPrefixMessages: [],
        isSplitTurn: false,
        tokensBefore: 20_000,
        fileOps: { read: new Set(), written: new Set(), edited: new Set() },
      },
      branchEntries: branch,
    }, context);
    expect(compacted).toBeUndefined();
    const tree = await handlers.get("session_before_tree")?.({
      preparation: { entriesToSummarize: branch, userWantsSummary: true },
    }, context);
    expect(tree).toBeUndefined();

    const parent = new ObservationArchive(root, "bash-parent");
    const views = await parent.loadFixedExchangeViews();
    expect(views[0]).toMatchObject({ exchangeId: `ub_${entryId}`, toolCallId: entryId });
    expect(views[0].result.kind).toBe("capsule");
    const selected = selectForkVisibleImports(branch, [], views);
    expect(selected.fixedRefs).toEqual([`ub_${entryId}`]);
    expect(selected.refs).toContain(`ub_${entryId}`);

    const child = new ObservationArchive(root, "bash-child");
    expect(await child.importFrom(parent, selected.refs)).toBe(1);
    expect(await child.readExactText(`ub_${entryId}`)).toBe(completeOutput);
    const importedCall = await child.inspect(`ub_${entryId}:call#/command`, { maxBytes: 20_000 });
    expect((importedCall.content[0] as { text: string }).text).toBe(command);
  });

  it("replaces replay-origin call arguments only after cross-model normalization", () => {
    const rawArguments = { code: "provider-specific raw code" };
    const compactArguments = { code: "<archived-call-field ref=o1:call#/code>" };
    const signedCall = {
      type: "toolCall", id: "replay", name: "ipython", arguments: rawArguments,
      thoughtSignature: "opaque-provider-signature",
    };
    const result = {
      role: "toolResult", toolCallId: "replay", toolName: "ipython",
      content: [{ type: "text", text: "ok" }], isError: false,
    };
    const view = {
      schema: "prime-context.fixed-exchange-view/v1" as const,
      generation: 0 as const,
      exchangeId: "o1",
      toolCallId: "replay",
      callArguments: compactArguments,
      result: { kind: "literal" as const },
      visibleBytes: 10,
      replayOriginKey: "provider:model-a",
    };

    const sameOrigin = projectFixedExchangeViews([
      { role: "assistant", content: [signedCall] }, result,
    ], [view], "provider:model-a");
    expect(sameOrigin[0].content[0]).toBe(signedCall);

    const crossModelSigned = projectFixedExchangeViews([
      { role: "assistant", content: [signedCall] }, result,
    ], [view], "provider:model-b");
    expect(crossModelSigned[0].content[0]).toBe(signedCall);

    const normalizedCall = { type: "toolCall", id: "replay", name: "ipython", arguments: rawArguments };
    const crossModelNormalized = projectFixedExchangeViews([
      { role: "assistant", content: [normalizedCall] }, result,
    ], [view], "provider:model-b");
    expect(crossModelNormalized[0].content[0]).toEqual({
      ...normalizedCall, arguments: compactArguments,
    });
  });

  it("keeps an opaque result block while paging its normal text sibling", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-mixed-opaque-"));
    temporaryPaths.push(root);
    const archive = new ObservationArchive(root, "mixed-opaque");
    const opaque = { type: "text", text: "SIGNED_LITERAL", textSignature: "opaque-signature" };
    const normal = { type: "text", text: `NORMAL_PAGEABLE\n${"normal output\n".repeat(2_000)}` };
    const input = { query: "mixed" };
    await archive.finalizeExchanges([{
      metadata: exchangeMetadata("o1", "mixed", normal.text),
      toolName: "custom",
      isError: false,
      persistedModelInput: input,
      persistedRawCall: { type: "toolCall", id: "mixed", name: "custom", arguments: input },
      persistedRawResult: { content: [opaque, normal], isError: false },
      resultText: `${opaque.text}\n${normal.text}`,
      sourceOrder: 0,
    }], undefined, { budgetBytes: 2_048, capsuleMaxBytes: 1_024 });
    const [view] = await archive.loadFixedExchangeViews();
    expect(view.result.kind).toBe("capsule");

    const messages = [
      { role: "assistant", content: [{ type: "toolCall", id: "mixed", name: "custom", arguments: input }] },
      { role: "toolResult", toolCallId: "mixed", toolName: "custom", content: [opaque, normal], isError: false },
    ];
    const projected = projectFixedExchangeViews(messages, [view]);
    expect(projected[1].content[0]).toBe(opaque);
    expect(projected[1].content[1]).toMatchObject({
      type: "text", text: expect.stringContaining('id="o1:result"'),
    });
    expect(messages[1].content[1]).toBe(normal);
  });

  it("retains every direct-adapter failing ID beyond 32", () => {
    const ids = Array.from({ length: 40 }, (_, index) => `tests/test_many.py::test_case_${index}`);
    const output = `${ids.map((id) => `FAILED ${id} - assertion failed`).join("\n")}\n40 failed`;
    const intent = adaptToolIntent({
      exchangeId: "o1", toolCallId: "pytest", toolName: "bash",
      input: { command: "pytest -q" }, cwd: "/workspace", modelInputBytes: 1,
      resultText: output, isError: false,
    });
    expect(collectFactualOutcome(intent, output, false).failingTests).toEqual(ids);
    const genericOutput = `${ids.map((id) => `FAIL ${id}`).join("\n")}\n40 failed`;
    expect(analyzeOutcome(genericOutput, false).failingTests).toEqual(ids);
  });

  it("isolates parallel branch state and fork-imports visible exact evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "prime-context-integrated-edge-"));
    temporaryPaths.push(root);
    await mkdir(join(root, ".prime", "agent"), { recursive: true });
    await writeFile(join(root, ".prime", "agent", "prime-context.json"), JSON.stringify({
      enabled: true, minTextBytes: 1, capsuleMaxBytes: 1_024,
    }));

    type SessionFixture = {
      id: string;
      branch: any[];
      header?: { parentSession?: string };
    };
    const parent: SessionFixture = {
      id: "edge-parent",
      branch: [{
        id: "a-root", type: "message",
        message: { role: "user", content: "REQUIREMENTS LOCKED. Before completion run pytest tests/current." },
      }],
    };
    const sibling: SessionFixture = {
      id: "edge-sibling",
      branch: [{ id: "b-root", type: "message", message: { role: "user", content: "Sibling task." } }],
    };
    let active = parent;
    let entrySequence = 0;
    const committed: Array<{ sessionId: string; type: string; data: any }> = [];
    const handlers = new Map<string, Handler>();
    const pi = {
      on: (name: string, handler: Handler) => registerPatchedHandler(handlers, name, handler),
      registerTool: () => undefined,
      registerCommand: () => undefined,
      getAllTools: () => [],
      appendEntry: (type: string, data: any) => {
        committed.push({ sessionId: active.id, type, data });
        active.branch.push({
          id: `state-${++entrySequence}`, type: "custom", customType: type, data,
        });
      },
    } as unknown as ExtensionAPI;
    primeContext(pi);
    const context = {
      cwd: root,
      signal: undefined,
      sessionManager: {
        getBranch: () => active.branch,
        getSessionId: () => active.id,
        getHeader: () => active.header ?? null,
        getSessionDir: () => root,
      },
      getContextUsage: () => undefined,
    setAutomaticRefinementEnabled: () => undefined,
    };
    const startSession = async (reason: string) => {
      const previousHome = process.env.PRIME_CONTEXT_HOME;
      process.env.PRIME_CONTEXT_HOME = root;
      try {
        await handlers.get("session_start")?.({ reason }, context);
      } finally {
        if (previousHome === undefined) delete process.env.PRIME_CONTEXT_HOME;
        else process.env.PRIME_CONTEXT_HOME = previousHome;
      }
    };
    type TurnCall = {
      id: string;
      name: string;
      input: Record<string, unknown>;
      content: Array<Record<string, unknown>>;
      isError: boolean;
      details?: Record<string, unknown>;
    };
    const runTurn = async (calls: TurnCall[], toolExecution: "parallel" | "sequential") => {
      for (const call of calls) {
        handlers.get("tool_execution_start")?.({
          toolCallId: call.id, toolName: call.name, args: call.input,
        }, context);
        handlers.get("tool_call")?.({
          toolCallId: call.id, toolName: call.name, input: call.input,
        }, context);
      }
      const results = calls.map((call) => ({
        role: "toolResult", toolCallId: call.id, toolName: call.name, input: call.input,
        content: call.content, isError: call.isError, details: call.details ?? {},
      }));
      const completionOrder = toolExecution === "parallel" ? [...results].reverse() : results;
      for (const result of completionOrder) await handlers.get("tool_result")?.(result, context);
      const assistant = {
        role: "assistant",
        content: calls.map((call) => ({
          type: "toolCall", id: call.id, name: call.name, arguments: call.input,
        })),
      };
      active.branch.push({ id: `assistant-${++entrySequence}`, type: "message", message: assistant });
      for (const result of results) {
        active.branch.push({ id: `result-${++entrySequence}`, type: "message", message: result });
      }
      await handlers.get("turn_end")?.({ toolExecution, message: assistant, toolResults: results }, context);
      return { assistant, results };
    };
    const latestRuntime = (sessionId: string) => committed
      .filter((entry) => entry.sessionId === sessionId && entry.type === "prime-context.task-snapshot")
      .at(-1)?.data;

    await startSession("startup");
    await runTurn([{
      id: "diagnostic-test", name: "bash", input: { command: "pytest tests/diagnostic -q" },
      content: [{
        type: "text",
        text: `${"diagnostic context\n".repeat(200)}FAILED tests/diagnostic/test_edge.py::test_old - mismatch\n1 failed`,
      }],
      isError: true,
      details: { exitCode: 1 },
    }], "sequential");
    expect(latestRuntime(parent.id).actionableObservations.length).toBeGreaterThan(0);

    const parallel = await runTurn([{
      id: "parallel-edit", name: "edit",
      input: { path: "src/edge.ts", edits: [{ oldText: "old", newText: "new" }] },
      content: [{ type: "text", text: `EDIT_APPLIED\n${"edit output\n".repeat(200)}` }],
      isError: false,
      details: { diff: "-old\n+new", firstChangedLine: 1 },
    }, {
      id: "parallel-test", name: "bash", input: { command: "pytest tests/current -q" },
      content: [{ type: "text", text: `${"test output\n".repeat(200)}TEST_RESULT PASS 1/1` }],
      isError: false,
      details: { exitCode: 0 },
    }], "parallel");
    const parentRuntime = latestRuntime(parent.id);
    expect(parentRuntime).toMatchObject({
      schema: "prime-context.task-snapshot/v2",
      taskKey: "a-root",
      actionableObservations: expect.any(Array),
      artifacts: expect.any(Array),
    });
    expect(parentRuntime.actionableObservations.length).toBeGreaterThan(0);

    active = sibling;
    await startSession("switch");
    const siblingTurn = await runTurn([{
      id: "sibling-call", name: "bash", input: { command: "pytest tests/sibling -q" },
      content: [{ type: "text", text: `1 passed in 0.01s\n${"s".repeat(30_000)}` }],
      isError: false,
    }], "sequential");
    const siblingRuntime = latestRuntime(sibling.id);
    expect(siblingRuntime).toMatchObject({
      schema: "prime-context.task-snapshot/v2", taskKey: "b-root",
      actionableObservations: expect.any(Array),
    });
    const siblingProjected = handlers.get("model_context")?.({
      purpose: "provider", messages: [siblingTurn.assistant, ...siblingTurn.results],
    }, context);
    expect(siblingProjected.messages[1].content[0].text).toContain("<prime_context_output");
    const parentWhileSibling = handlers.get("model_context")?.({
      purpose: "provider", messages: [parallel.assistant, ...parallel.results],
    }, context);
    expect(parentWhileSibling.messages[1].content[0].text).toContain("EDIT_APPLIED");

    active = parent;
    await startSession("switch");
    const restored = handlers.get("model_context")?.({
      purpose: "provider", messages: [parallel.assistant, ...parallel.results],
    }, context);
    expect(restored.messages[1].content[0].text).toContain("EDIT_APPLIED");
    const siblingWhileParent = handlers.get("model_context")?.({
      purpose: "provider", messages: [siblingTurn.assistant, ...siblingTurn.results],
    }, context);
    expect(siblingWhileParent.messages[1].content[0].text).toContain("1 passed in 0.01s");
    await handlers.get("turn_end")?.({
      toolExecution: "sequential", message: { role: "assistant", content: "resume" }, toolResults: [],
    }, context);
    const restoredRuntime = latestRuntime(parent.id);
    expect(restoredRuntime.taskKey).toBe("a-root");
    expect(restoredRuntime.actionableObservations).toEqual(parentRuntime.actionableObservations);
    expect(restoredRuntime.artifacts).toEqual(parentRuntime.artifacts);

    const diagnosticText = `EXACT_VISIBLE_DIAGNOSTIC\n${"stderr detail\n".repeat(100)}`;
    const parentArchive = new ObservationArchive(root, parent.id);
    await parentArchive.archiveVisibleContent(
      [{ type: "text", text: diagnosticText }], "custom", true, 1, 1_024,
      undefined, undefined, undefined,
      {
        ...exchangeMetadata("o99", "visible-diagnostic", diagnosticText),
        taskKey: "a-root",
        outcome: analyzeOutcome(diagnosticText, true),
      },
      [{ name: "stderr", kind: "stderr", text: diagnosticText }],
    );
    expect((await parentArchive.loadFixedExchangeViews()).some((view) => view.exchangeId === "o99")).toBe(false);
    parent.branch.push({
      id: "visible-diagnostic-ref", type: "message",
      message: { role: "user", content: "Use exact visible evidence o99:stderr." },
    });
    const parentFile = join(root, "edge-parent.jsonl");
    await writeFile(parentFile, `${JSON.stringify({
      type: "session", id: parent.id, timestamp: "2026-08-30T00:00:00.000Z", cwd: root,
    })}\n`);
    const fork: SessionFixture = {
      id: "edge-fork",
      branch: structuredClone(parent.branch),
      header: { parentSession: parentFile },
    };
    active = fork;
    await startSession("fork");
    const forkArchive = new ObservationArchive(root, fork.id);
    const imported = await forkArchive.inspect("o99:stderr", { startLine: 1, endLine: 80 });
    expect(imported.content[0]).toMatchObject({
      type: "text", text: expect.stringContaining("EXACT_VISIBLE_DIAGNOSTIC"),
    });
    expect((await forkArchive.findObservation("o99")).envelope?.forkImported).toBe(true);
  });
});
