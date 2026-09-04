import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import {
  accessSync,
  constants as fsConstants,
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceHostRoot = resolve(
  process.env.PRIME_AGENT_ROOT ?? join(packageRoot, "node_modules", "@earendil-works", "pi-coding-agent"),
);
const bundledEntry = readFileSync(join(packageRoot, "dist", "index.js"), "utf8");
assert.doesNotMatch(bundledEntry, /(?:from\s+["']diff["']|require\(["']diff["']\))/,
  "dist/index.js must bundle the runtime diff dependency for local package images.");
const temporary = mkdtempSync(join(tmpdir(), "prime-context-package-smoke-"));
const home = join(temporary, "home");
const app = join(temporary, "app");
const workspace = join(temporary, "workspace with spaces");
const hostRoot = join(temporary, "prime-agent-host");
const daemonSocket = join(temporary, "prime-agent.sock");
mkdirSync(home, { recursive: true });
mkdirSync(app, { recursive: true });
mkdirSync(workspace, { recursive: true });

function dependencyTreeForHost(root) {
  let current = root;
  for (;;) {
    const candidate = join(current, "node_modules");
    if (existsSync(join(candidate, "@earendil-works", "pi-agent-core", "package.json"))) return candidate;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`Prime Agent host has no resolvable pi-agent-core dependency: ${root}`);
}

const sourceHostManifest = JSON.parse(readFileSync(join(sourceHostRoot, "package.json"), "utf8"));
assert.equal(sourceHostManifest.name, "prime-agent");
assert.equal(sourceHostManifest.version, "0.9.1");
const sourceHostContract = readFileSync(join(sourceHostRoot, "dist", "core", "extensions", "types.d.ts"), "utf8");
assert.doesNotMatch(sourceHostContract, /projectionIdentity/, "Package smoke requires a pristine Prime Agent 0.9.1 host.");
cpSync(sourceHostRoot, hostRoot, { recursive: true, dereference: true });
if (!existsSync(join(hostRoot, "node_modules", "@earendil-works", "pi-agent-core", "package.json"))) {
  cpSync(dependencyTreeForHost(sourceHostRoot), join(hostRoot, "node_modules"), {
    recursive: true,
    dereference: true,
  });
}
assert.equal(lstatSync(hostRoot).isSymbolicLink(), false, "Disposable Prime Agent host must be materialized.");
assert.equal(
  lstatSync(join(hostRoot, "node_modules", "@earendil-works", "pi-agent-core")).isSymbolicLink(),
  false,
  "Disposable pi-agent-core dependency must be materialized.",
);

const cleanEnvironment = {
  ...process.env,
  HOME: home,
  PRIME_CONTEXT_HOME: join(temporary, "prime-context-data"),
  FORCE_COLOR: "0",
  NO_COLOR: "1",
};
delete cleanEnvironment.npm_config_allow_scripts;
delete cleanEnvironment.NPM_CONFIG_ALLOW_SCRIPTS;
for (const key of Object.keys(cleanEnvironment)) {
  if (key.startsWith("PRIME_AGENT_INTERNAL_")) delete cleanEnvironment[key];
}
cleanEnvironment.PRIME_AGENT_CODING_AGENT_DIR = join(home, ".prime", "agent");
const originalProcessEnvironment = {
  HOME: process.env.HOME,
  PRIME_CONTEXT_HOME: process.env.PRIME_CONTEXT_HOME,
  PRIME_AGENT_CODING_AGENT_DIR: process.env.PRIME_AGENT_CODING_AGENT_DIR,
};
process.env.HOME = cleanEnvironment.HOME;
process.env.PRIME_CONTEXT_HOME = cleanEnvironment.PRIME_CONTEXT_HOME;
process.env.PRIME_AGENT_CODING_AGENT_DIR = cleanEnvironment.PRIME_AGENT_CODING_AGENT_DIR;

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? packageRoot,
    env: cleanEnvironment,
    encoding: "utf8",
    shell: false,
    stdio: options.stdio ?? "pipe",
  });
}

function selectedShell() {
  let cliShell;
  for (let index = 2; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    if (argument === "--shell") {
      if (cliShell !== undefined || index + 1 >= process.argv.length) {
        throw new Error("Usage: node scripts/package-smoke.mjs --shell <bash-or-zsh-command>");
      }
      cliShell = process.argv[++index];
    } else if (argument.startsWith("--shell=")) {
      if (cliShell !== undefined) {
        throw new Error("Specify --shell only once.");
      }
      cliShell = argument.slice("--shell=".length);
    } else {
      throw new Error(`Unknown package-smoke argument: ${argument}`);
    }
  }

  const command = cliShell || process.env.PRIME_CONTEXT_SMOKE_SHELL;
  if (!command) {
    throw new Error("Set --shell or PRIME_CONTEXT_SMOKE_SHELL to the configured Bash or Zsh command.");
  }
  const flavor = basename(command);
  if (flavor !== "bash" && flavor !== "zsh") {
    throw new Error(`Package smoke supports Bash or Zsh, not ${command}.`);
  }
  try {
    run(command, ["--version"]);
  } catch (error) {
    throw new Error(`Configured shell command is not executable: ${command}`, { cause: error });
  }
  return { command, flavor };
}

const shell = selectedShell();

function resultText(result) {
  const block = result?.content?.find((item) => item.type === "text");
  assert.equal(typeof block?.text, "string", "Prime Context tool did not return text.");
  return block.text;
}

async function exerciseInstalledExtension(installedPackage) {
  const installedEntry = join(installedPackage, "dist", "index.js");
  let extension;
  try {
    ({ default: extension } = await import(pathToFileURL(installedEntry).href));
  } catch (error) {
    throw new Error(`Installed Prime Context could not load against the package-smoke host ABI: ${error.message}`, {
      cause: error,
    });
  }
  assert.equal(typeof extension, "function", "Installed Prime Context has no default extension export.");

  const handlers = new Map();
  const tools = new Map();
  const commands = new Map();
  const appendedEntries = [];
  const fakeApi = {
    on: (name, handler) => handlers.set(name, handler),
    registerTool: (tool) => tools.set(tool.name, tool),
    registerCommand: (name, command) => commands.set(name, command),
    appendEntry: (type, data) => appendedEntries.push({ type, data }),
    getAllTools: () => [],
  };
  extension(fakeApi);

  const requiredHandlers = [
    "session_start",
    "resources_discover",
    "agent_end",
    "tool_execution_start",
    "tool_call",
    "tool_result",
    "turn_end",
    "model_context",
    "message_end",
    "session_before_compact",
    "session_before_tree",
  ];
  for (const name of requiredHandlers) {
    assert.equal(typeof handlers.get(name), "function", `Installed Prime Context did not register ${name}.`);
  }
  assert.ok(commands.has("pc"), "Installed Prime Context did not register /pc.");
  const primeContextTool = tools.get("prime_context");
  assert.equal(typeof primeContextTool?.execute, "function", "Installed Prime Context did not register its tool.");

  const branch = [{
    id: "package-smoke-user",
    type: "message",
    message: {
      role: "user",
      content: "REQUIREMENTS LOCKED. Before completion, run python3 run_tests.py.",
    },
  }];
  function appendControlMessages(result, prefix) {
    for (const [index, message] of (result?.messages ?? []).entries()) {
      assert.equal(message.role, "custom", "turn_end returned a non-control host message.");
      branch.push({
        id: `${prefix}-control-${index + 1}`,
        type: "custom_message",
        customType: message.customType,
        content: message.content,
        display: message.display,
        details: message.details,
      });
    }
  }
  function providerFixtureEntries() {
    return branch.flatMap((entry) => {
      if (entry.type === "message") return [{ entry, message: entry.message }];
      if (entry.type !== "custom_message") return [];
      return [{
        entry,
        message: {
          role: "custom",
          customType: entry.customType,
          content: entry.content,
          display: entry.display,
          details: entry.details,
        },
      }];
    });
  }
  const sessionId = `package-smoke-${shell.flavor}`;
  const sessionManager = {
    getSessionId: () => sessionId,
    getBranch: () => branch,
  };
  const signal = new AbortController().signal;
  const context = {
    cwd: workspace,
    signal,
    sessionManager,
    getContextUsage: () => undefined,
    setAutomaticRefinementEnabled: () => undefined,
  };
  const nativeSkillsPath = join(workspace, ".prime", "agent", "prime-context", "knowledge", "skills");
  mkdirSync(nativeSkillsPath, { recursive: true });
  assert.deepEqual(
    await handlers.get("resources_discover")({ cwd: workspace }),
    { skillPaths: [nativeSkillsPath] },
    "Installed Prime Context did not expose its configured native skill directory.",
  );
  await handlers.get("session_start")({ reason: "startup" }, context);

  writeFileSync(join(workspace, "run_tests.py"), 'print("TEST_RESULT PASS 1/1")\n');
  const sharedCommand = `cd ${JSON.stringify(workspace)} && python3 run_tests.py`;
  const nestedCommand = `${shell.flavor} -lc 'python3 run_tests.py'`;
  const redirectedCommand = "cat <<'EOF' > 'result file.txt'\n9 passed\nEOF";

  const generatedLineCount = 4096;
  const fullOutputPath = join(workspace, `${shell.flavor} stable output.txt`);
  const fileCommand = [
    `awk -f - > ${JSON.stringify(fullOutputPath)} <<"PRIME_CONTEXT_SMOKE"`,
    "BEGIN {",
    `  for (i = 1; i <= ${generatedLineCount}; i++) printf "SMOKE_LINE_%04d %0500d\\n", i, 0`,
    '  print "SMOKE_TAIL_ONE"',
    '  print "SMOKE_TAIL_TWO"',
    "}",
    "PRIME_CONTEXT_SMOKE",
  ].join("\n");
  const fixtureScript = join(temporary, `${shell.flavor}-fixture.sh`);
  writeFileSync(fixtureScript, ["set -eu", sharedCommand, redirectedCommand, fileCommand, ""].join("\n"));
  const executed = run(shell.command, [fixtureScript], { cwd: workspace });
  assert.equal(executed, "TEST_RESULT PASS 1/1\n");
  assert.equal(readFileSync(join(workspace, "result file.txt"), "utf8"), "9 passed\n");
  assert.ok(statSync(fullOutputPath).size > 1024 * 1024, "Shell fixture was not file-backed and large.");

  const editPath = join(workspace, "large edit fixture.txt");
  const oldText = `OLD_EDIT_SENTINEL\n${"o".repeat(14_000)}`;
  const newText = `NEW_EDIT_SENTINEL\n${"n".repeat(14_000)}`;
  const editInput = { path: editPath, edits: [{ oldText, newText }] };
  const editResult = `Applied large edit to ${editPath}.\n${"EDIT_RESULT_LINE\n".repeat(900)}`;
  writeFileSync(editPath, newText);
  const fixtures = [
    {
      toolCallId: "package-smoke-shared",
      command: sharedCommand,
      text: "TEST_RESULT PASS 1/1",
      details: { exitCode: 0 },
    },
    {
      toolCallId: "package-smoke-nested",
      command: nestedCommand,
      text: "TEST_RESULT PASS 1/1",
      details: { exitCode: 0 },
    },
    {
      toolCallId: "package-smoke-redirected",
      command: redirectedCommand,
      text: "9 passed\n",
      details: { exitCode: 0 },
    },
    {
      toolCallId: "package-smoke-file",
      command: fileCommand,
      text: "SMOKE_TAIL_ONE\nSMOKE_TAIL_TWO\n",
      details: { fullOutputPath, exitCode: 0 },
    },
    {
      toolCallId: "package-smoke-edit",
      toolName: "edit",
      input: editInput,
      text: editResult,
      details: { diff: "@@ -1 +1 @@\n-OLD_EDIT_SENTINEL\n+NEW_EDIT_SENTINEL" },
    },
  ];
  const exchanges = [];
  for (const fixture of fixtures) {
    const toolName = fixture.toolName ?? "bash";
    const input = fixture.input ?? { command: fixture.command };
    const content = [{ type: "text", text: fixture.text }];
    const executionEvent = { toolCallId: fixture.toolCallId, toolName, args: input };
    const callEvent = { toolCallId: fixture.toolCallId, toolName, input };
    const resultEvent = {
      toolCallId: fixture.toolCallId,
      toolName,
      input,
      content,
      details: fixture.details,
      isError: false,
    };
    const exchange = {
      fixture,
      input,
      content,
      executionEvent,
      callEvent,
      resultEvent,
      before: structuredClone({ executionEvent, callEvent, resultEvent }),
    };
    exchanges.push(exchange);
    await handlers.get("tool_execution_start")(executionEvent, context);
    await handlers.get("tool_call")(callEvent, context);
    await handlers.get("tool_result")(resultEvent, context);
  }

  const turnEvent = {
    toolExecution: "sequential",
    message: {
      role: "assistant",
      content: exchanges.map(({ fixture, input }) => ({
        type: "toolCall", id: fixture.toolCallId, name: fixture.toolName ?? "bash", arguments: input,
      })),
    },
    toolResults: exchanges.map(({ fixture, content }) => ({
      role: "toolResult",
      toolCallId: fixture.toolCallId,
      toolName: fixture.toolName ?? "bash",
      content,
      details: fixture.details,
      isError: false,
      timestamp: 1,
    })),
  };
  turnEvent.exchanges = exchanges.map(({ fixture, input }, sourceOrder) => ({
    sourceOrder,
    toolCallId: fixture.toolCallId,
    toolName: fixture.toolName ?? "bash",
    originalInput: input,
    executedInput: input,
    result: turnEvent.toolResults[sourceOrder],
  }));
  branch.push(
    { id: "package-smoke-assistant", type: "message", message: turnEvent.message },
    ...turnEvent.toolResults.map((message, index) => ({
      id: `package-smoke-result-${index + 1}`, type: "message", message,
    })),
  );
  const turnBefore = structuredClone(turnEvent);
  const firstTurnResult = await handlers.get("turn_end")(turnEvent, context);
  const taskUpdate = firstTurnResult?.messages?.find((message) => message.customType === "prime_context_update");
  assert.match(taskUpdate?.content ?? "", /TEST_RESULT PASS 1\/1/,
    "The first finalized turn did not emit its sparse factual task update.");
  appendControlMessages(firstTurnResult, "package-smoke-first");

  const providerEntries = providerFixtureEntries();
  const providerMessages = providerEntries.map(({ message }) => message);
  const providerBefore = structuredClone(providerMessages);
  const projected = await handlers.get("model_context")({
    purpose: "provider",
    messages: providerMessages,
    entryRefs: providerEntries.map(({ entry }, messageIndex) => ({ messageIndex, entryId: entry.id })),
  }, context);
  assert.ok(projected?.messages, "Installed Prime Context did not project provider context.");
  assert.deepEqual(providerMessages, providerBefore, "model_context changed raw provider messages.");
  assert.deepEqual(
    (projected.entryRefs ?? providerEntries.map(({ entry }, messageIndex) => ({ messageIndex, entryId: entry.id })))
      .map((ref) => ref.entryId),
    providerEntries.map(({ entry }) => entry.id),
    "model_context did not preserve exact session entry refs.",
  );
  const projectedToolResults = projected.messages.filter((message) => message.role === "toolResult");
  assert.equal(projectedToolResults.length, turnEvent.toolResults.length);
  assert.ok(
    projectedToolResults.every((message) => !("details" in message)),
    "model_context exposed provider-irrelevant raw tool-result details.",
  );
  const projectedAssistant = projected.messages.find((message) => message.role === "assistant");
  const projectedEditCall = projectedAssistant?.content?.find?.((block) => block.id === "package-smoke-edit");
  const projectedEditArguments = JSON.stringify(projectedEditCall?.arguments ?? {});
  const projectedEdit = projectedEditCall?.arguments?.edits?.[0];
  assert.ok(projectedEdit?.oldText?.startsWith("<archived-call ref=\"") &&
    projectedEdit?.newText?.startsWith("<archived-call ref=\""),
  "The first historical provider view did not page the large Edit fields.");
  assert.ok(!projectedEditArguments.includes("o".repeat(1_000)) &&
    !projectedEditArguments.includes("n".repeat(1_000)),
  "The first historical provider view retained a large raw Edit field.");

  for (const exchange of exchanges) {
    assert.deepEqual(
      {
        executionEvent: exchange.executionEvent,
        callEvent: exchange.callEvent,
        resultEvent: exchange.resultEvent,
      },
      exchange.before,
      `${exchange.fixture.toolCallId} changed the raw result content or command.`,
    );
  }
  assert.deepEqual(turnEvent, turnBefore, "turn_end changed the persisted raw result content or command.");

  const observationsPath = join(
    cleanEnvironment.PRIME_CONTEXT_HOME,
    "sessions",
    sessionId,
    "observations",
  );
  const envelopes = readdirSync(observationsPath)
    .filter((name) => name.endsWith(".meta.json"))
    .map((name) => JSON.parse(readFileSync(join(observationsPath, name), "utf8")))
    .sort((left, right) => Number(left.id.slice(1)) - Number(right.id.slice(1)));
  assert.deepEqual(
    envelopes.map(({ id, toolCallId }) => ({ id, toolCallId })),
    fixtures.map(({ toolCallId }, index) => ({ id: `o${index + 1}`, toolCallId })),
    "Installed sidecars did not preserve source order.",
  );
  const envelopeByCall = new Map(envelopes.map((envelope) => [envelope.toolCallId, envelope]));
  const scriptTarget = join(workspace, "run_tests.py");
  const suiteTarget = JSON.stringify({ target: scriptTarget, cwd: workspace });
  const expectedTestIntent = {
    intentKind: "test",
    subjectKey: `suite:python-test-script:${suiteTarget}`,
    resources: [scriptTarget],
    suite: { family: "python-test-script", target: suiteTarget, scope: "broad" },
    effectiveCwd: workspace,
    mutatesWorkspace: false,
  };
  for (const toolCallId of ["package-smoke-shared", "package-smoke-nested"]) {
    const envelope = envelopeByCall.get(toolCallId);
    assert.deepEqual({
      intentKind: envelope?.intentKind,
      subjectKey: envelope?.subjectKey,
      resources: envelope?.resources,
      suite: envelope?.suite,
      effectiveCwd: envelope?.effectiveCwd,
      mutatesWorkspace: envelope?.mutatesWorkspace,
    }, expectedTestIntent, `${toolCallId} was not classified as the same Python test intent.`);
  }
  const redirectedEnvelope = envelopeByCall.get("package-smoke-redirected");
  const redirectedPath = join(workspace, "result file.txt");
  assert.deepEqual({
    intentKind: redirectedEnvelope?.intentKind,
    subjectKey: redirectedEnvelope?.subjectKey,
    resources: redirectedEnvelope?.resources,
    effectiveCwd: redirectedEnvelope?.effectiveCwd,
    mutatesWorkspace: redirectedEnvelope?.mutatesWorkspace,
  }, {
    intentKind: "run",
    subjectKey: redirectedPath,
    resources: [redirectedPath],
    effectiveCwd: workspace,
    mutatesWorkspace: true,
  }, "The heredoc/output redirection classification changed in the installed package.");

  const editEnvelope = envelopeByCall.get("package-smoke-edit");
  assert.deepEqual(
    editEnvelope?.parts
      ?.filter((part) => part.kind === "call-field")
      .map((part) => part.pointer)
      .sort(),
    ["/edits/0/newText", "/edits/0/oldText"],
    "The large Edit call fields were not independently recoverable.",
  );
  assert.ok(editEnvelope?.parts?.some((part) => part.kind === "diff"),
    "The large Edit diff was not recoverable by an exact part ref.");

  await handlers.get("turn_start")?.({ type: "turn_start", turnIndex: 1, timestamp: 2 }, context);
  const currentToolCallId = "package-smoke-current-validation";
  const currentInput = { command: sharedCommand };
  const currentContent = [{ type: "text", text: "TEST_RESULT PASS 1/1" }];
  await handlers.get("tool_execution_start")({
    toolCallId: currentToolCallId, toolName: "bash", args: currentInput,
  }, context);
  await handlers.get("tool_call")({
    toolCallId: currentToolCallId, toolName: "bash", input: currentInput,
  }, context);
  await handlers.get("tool_result")({
    toolCallId: currentToolCallId,
    toolName: "bash",
    input: currentInput,
    content: currentContent,
    details: { exitCode: 0 },
    isError: false,
  }, context);
  const currentAssistant = {
    role: "assistant",
    content: [{ type: "toolCall", id: currentToolCallId, name: "bash", arguments: currentInput }],
  };
  const currentResult = {
    role: "toolResult",
    toolCallId: currentToolCallId,
    toolName: "bash",
    content: currentContent,
    details: { exitCode: 0 },
    isError: false,
    timestamp: 2,
  };
  branch.push(
    { id: "package-smoke-current-assistant", type: "message", message: currentAssistant },
    { id: "package-smoke-current-result", type: "message", message: currentResult },
  );
  const secondTurnResult = await handlers.get("turn_end")({
    toolExecution: "sequential",
    message: currentAssistant,
    toolResults: [currentResult],
    exchanges: [{
      sourceOrder: 0,
      toolCallId: currentToolCallId,
      toolName: "bash",
      originalInput: currentInput,
      executedInput: currentInput,
      result: currentResult,
    }],
  }, context);
  appendControlMessages(secondTurnResult, "package-smoke-second");
  const secondProviderEntries = providerFixtureEntries();
  const secondProjection = await handlers.get("model_context")({
    purpose: "provider",
    messages: secondProviderEntries.map(({ message }) => message),
    entryRefs: secondProviderEntries.map(({ entry }, messageIndex) => ({ messageIndex, entryId: entry.id })),
  }, context);
  assert.deepEqual(
    secondProjection.messages.slice(0, projected.messages.length),
    projected.messages,
    "The second tool turn changed the prior stable provider prefix.",
  );

  const listed = resultText(await primeContextTool.execute(
    "package-smoke-list",
    { action: "list", limit: 20 },
    signal,
  ));
  const observationId = envelopeByCall.get("package-smoke-file")?.id;
  assert.equal(typeof observationId, "string", "The file-backed Bash sidecar was not written.");
  assert.ok(listed.includes(`- ${observationId} | bash |`), `The file-backed Bash result was not admitted.\n${listed}`);
  const startLine = generatedLineCount + 1;
  const endLine = generatedLineCount + 3;
  const recovery = await primeContextTool.execute(
    "package-smoke-inspect",
    { action: "inspect", ref: `${observationId}:result`, startLine, endLine },
    signal,
  );
  const receipt = resultText(recovery);
  assert.ok(receipt.includes(`${startLine}: SMOKE_TAIL_ONE`),
    "prime_context inspect did not return the recovered text directly.");
  const recoveryMessage = {
    role: "toolResult",
    toolCallId: "package-smoke-inspect",
    toolName: "prime_context",
    content: recovery.content,
    details: recovery.details,
    isError: false,
    timestamp: 2,
  };
  const recoveryEntry = { id: "package-smoke-recovery", type: "message", message: recoveryMessage };
  branch.push(recoveryEntry);
  const recoveryEntries = branch.filter((entry) => entry.type === "message");
  const recoveryProjection = await handlers.get("model_context")({
    purpose: "provider",
    messages: recoveryEntries.map((entry) => entry.message),
    entryRefs: recoveryEntries.map((entry, messageIndex) => ({ messageIndex, entryId: entry.id })),
  }, context);
  const recovered = resultText(recoveryProjection.messages.at(-1));
  const expectedRecovery = [
    `Observation part ${observationId}:result: lines ${startLine}-${endLine} of ${endLine}.`,
    `${startLine}: SMOKE_TAIL_ONE`,
    `${startLine + 1}: SMOKE_TAIL_TWO`,
    `${endLine}: `,
  ].join("\n");
  assert.equal(recovered, expectedRecovery, "prime_context inspect did not project the exact file-backed tail range.");
  handlers.get("message_end")({
    message: { role: "assistant", content: [], stopReason: "aborted" },
  }, context);
  const retryProjection = await handlers.get("model_context")({
    purpose: "provider",
    messages: recoveryEntries.map((entry) => entry.message),
    entryRefs: recoveryEntries.map((entry, messageIndex) => ({ messageIndex, entryId: entry.id })),
  }, context);
  assert.equal(
    resultText(retryProjection.messages.at(-1)),
    expectedRecovery,
    "An aborted assistant response changed persistent recovered evidence.",
  );
  handlers.get("message_end")({
    message: { role: "assistant", content: [], stopReason: "stop" },
  }, context);
  const consumedProjection = await handlers.get("model_context")({
    purpose: "provider",
    messages: recoveryEntries.map((entry) => entry.message),
    entryRefs: recoveryEntries.map((entry, messageIndex) => ({ messageIndex, entryId: entry.id })),
  }, context);
  assert.equal(
    resultText(consumedProjection.messages.at(-1)),
    expectedRecovery,
    "A successful assistant response changed persistent recovered evidence.",
  );
  assert.equal(resultText(recoveryMessage), receipt, "Recovery projection changed the persisted receipt.");
}

async function loadPrimeAgentExtension(cliPath) {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      process.execPath,
      [cliPath, "--daemon-socket", daemonSocket, "--offline", "--mode", "rpc", "--no-session"],
      {
        cwd: app,
        env: cleanEnvironment,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    let settling = false;
    let timer;
    const finish = (error) => {
      if (settling) return;
      settling = true;
      clearTimeout(timer);
      const settle = () => error ? rejectPromise(error) : resolvePromise();
      if (child.exitCode !== null || child.signalCode !== null) {
        settle();
        return;
      }
      child.once("close", settle);
      child.kill("SIGTERM");
    };
    timer = setTimeout(() => {
      finish(new Error(`Timed out loading Prime Context.\n${stderr}`));
    }, 30000);

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      const lines = stdout.split("\n");
      stdout = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }
        if (message.type === "response" && message.command === "get_commands") {
          const registeredCommands = message.data?.commands ?? [];
          if (!message.success || !registeredCommands.some((command) => command.name === "pc")) {
            finish(new Error(`Prime Context /pc command did not load.\n${line}\n${stderr}`));
          } else {
            finish();
          }
        }
      }
    });
    child.on("error", finish);
    child.on("exit", (code) => {
      if (code && code !== 0) finish(new Error(`Prime Agent exited with code ${code}.\n${stderr}`));
    });
    child.stdin.write(`${JSON.stringify({ id: "smoke", type: "get_commands" })}\n`);
  });
}

let cliPath;
let tarball;
try {
  const packOutput = run("npm", ["pack", "--json", "--ignore-scripts"]);
  const packed = JSON.parse(packOutput);
  tarball = join(packageRoot, packed[0].filename);

  writeFileSync(join(app, "package.json"), `${JSON.stringify({ private: true }, null, 2)}\n`);
  run("npm", ["install", "--ignore-scripts", tarball], { cwd: app });

  const installedPackage = join(app, "node_modules", "prime-agent-context");
  const manifest = JSON.parse(readFileSync(join(installedPackage, "package.json"), "utf8"));
  const sourceManifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  if (manifest.version !== sourceManifest.version || manifest.pi?.extensions?.[0] !== "./dist/index.js") {
    throw new Error("Packed Prime Context manifest is invalid.");
  }
  assert.match(manifest.dependencies?.["@earendil-works/pi-ai"] ?? "", /prime-agent-ai-0\.9\.1\.tgz$/);
  assert.match(manifest.dependencies?.["@earendil-works/pi-coding-agent"] ?? "", /prime-agent-0\.9\.1\.tgz$/);
  assert.equal(manifest.dependencies?.typebox, "^1.3.9");
  for (const dependency of ["@earendil-works/pi-ai", "@earendil-works/pi-coding-agent"]) {
    const dependencyManifest = JSON.parse(
      readFileSync(join(app, "node_modules", ...dependency.split("/"), "package.json"), "utf8"),
    );
    assert.equal(dependencyManifest.version, "0.9.1", `${dependency} must install from the pinned host release.`);
  }
  const packedPatcher = join(installedPackage, "scripts", "patch-prime-agent.mjs");
  const packedBin = join(app, "node_modules", ".bin", "prime-context-patch-agent");
  accessSync(packedPatcher, fsConstants.X_OK);
  accessSync(packedBin, fsConstants.X_OK);
  accessSync(join(hostRoot, "package.json"));
  run(process.execPath, [packedBin, "--check-stock", hostRoot]);
  run(process.execPath, [packedBin, hostRoot]);
  run(process.execPath, [packedBin, "--check", hostRoot]);
  const patchedGoals = await import(`${pathToFileURL(join(hostRoot, "dist", "core", "goals.js")).href}?smoke=${Date.now()}`);
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5].map((step) => patchedGoals.goalContinuationBackoffMs(step)),
    [15_000, 30_000, 60_000, 120_000, 180_000, 180_000],
    "Goal watcher continuation delay must double to the hard 180-second cap.",
  );
  const watcherContext = {
    newMessages: [
      {
        role: "custom",
        customType: "goal_context",
        content: "continue",
        details: { kind: "continuation", goalId: "smoke-goal" },
      },
      {
        role: "assistant",
        content: [{
          type: "toolCall",
          id: "watch-call",
          name: "ipython",
          arguments: { code: "print(handle.running, path.stat().st_mtime)" },
        }],
      },
      {
        role: "toolResult",
        toolCallId: "watch-call",
        isError: false,
        content: [{ type: "text", text: "running True" }],
      },
      { role: "assistant", content: [{ type: "text", text: "Still running." }] },
    ],
  };
  assert.equal(typeof patchedGoals.goalWatcherContinuationSignature(watcherContext), "string");
  const failedWatcherContext = structuredClone(watcherContext);
  failedWatcherContext.newMessages[2].isError = true;
  assert.equal(
    patchedGoals.goalWatcherContinuationSignature(failedWatcherContext),
    undefined,
    "Failed watcher turns must remain immediately actionable.",
  );
  const terminalWatcherContext = structuredClone(watcherContext);
  terminalWatcherContext.newMessages[2].content[0].text = "running False";
  assert.equal(
    patchedGoals.goalWatcherContinuationSignature(terminalWatcherContext),
    undefined,
    "A terminal process state must reset the watcher backoff.",
  );
  const patchedAgentSession = await import(
    `${pathToFileURL(join(hostRoot, "dist", "core", "agent-session.js")).href}?smoke=${Date.now()}`
  );
  const sessionBackoff = Object.create(patchedAgentSession.AgentSession.prototype);
  sessionBackoff._goalContinuationBackoffStep = 0;
  sessionBackoff._goalContinuationWatcherSignature = undefined;
  sessionBackoff._goalContinuationBackoffCancel = undefined;
  const interruptedBackoff = sessionBackoff._waitForGoalContinuationBackoff("watch-signature", undefined);
  sessionBackoff._resetGoalContinuationBackoff();
  assert.equal(await interruptedBackoff, false, "User/session activity must interrupt a pending backoff.");
  assert.doesNotMatch(
    readFileSync(join(sourceHostRoot, "dist", "core", "extensions", "types.d.ts"), "utf8"),
    /projectionIdentity/,
    "Package smoke mutated its pristine Prime Agent source host.",
  );
  assert.equal(
    readFileSync(join(packageRoot, "dist", "index.js"), "utf8"),
    bundledEntry,
    "Prime Agent patching mutated the Prime Context checkout.",
  );

  await exerciseInstalledExtension(installedPackage);

  cliPath = join(hostRoot, "dist", "bundle", "cli.js");
  run(process.execPath, [cliPath, "package", "install", installedPackage], { cwd: app });
  await loadPrimeAgentExtension(cliPath);
  console.log(`Prime Context package smoke passed on Prime Agent v0.9.1 with configured ${shell.flavor} (${shell.command}).`);
} finally {
  if (cliPath) {
    try {
      run(process.execPath, [cliPath, "--daemon-socket", daemonSocket, "shutdown", "--force"], { cwd: app });
    } catch {
      // The isolated service may already have exited.
    }
  }
  if (tarball) rmSync(tarball, { force: true });
  for (const [key, value] of Object.entries(originalProcessEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  // Prime Agent may finish a just-terminated uv helper shortly after the RPC
  // process closes. Remove any empty directories it recreates in that window.
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      rmSync(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch (error) {
      if (!error || typeof error !== "object" || !["ENOTEMPTY", "EBUSY", "EPERM"].includes(error.code)) throw error;
    }
    if (attempt < 49) await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  if (existsSync(temporary)) {
    const quarantine = `${temporary}-cleanup-${process.pid}`;
    renameSync(temporary, quarantine);
    rmSync(quarantine, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
    rmSync(temporary, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  }
  // Register last so imported modules' exit handlers cannot recreate empty
  // HOME/workspace directories after the smoke cleanup has completed.
  process.on("exit", () => {
    try {
      rmSync(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    } catch {
      // The command result is already known; a later suite cleanup also removes the isolated root.
    }
  });
}
