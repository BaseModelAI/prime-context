#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

const SUPPORTED_VERSION = "0.9.1";
const argv = process.argv.slice(2);
const checkOnly = argv.includes("--check");
const stockOnly = argv.includes("--check-stock");
if (checkOnly && stockOnly) {
  throw new Error("choose either --check or --check-stock");
}
const positional = argv.filter((arg) => arg !== "--check" && arg !== "--check-stock");
if (positional.length > 1) {
  throw new Error("usage: patch-prime-agent.mjs [--check|--check-stock] [prime-agent-root]");
}
const root = resolve(
  positional[0] ?? process.env.PRIME_AGENT_ROOT ?? "/usr/local/lib/node_modules/prime-agent",
);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function occurrences(text, value) {
  return text.split(value).length - 1;
}

const stockVirtualFiles = new Map();
const pendingWrites = new Map();

function readCurrentText(path) {
  const diskText = readFileSync(path, "utf8");
  return stockOnly
    ? stockVirtualFiles.get(path) ?? diskText
    : pendingWrites.get(path) ?? diskText;
}

function applyPatches(relativePath, patches) {
  const path = join(root, relativePath);
  const diskText = readFileSync(path, "utf8");
  let text = readCurrentText(path);
  let changed = false;

  if (stockOnly) {
    for (const { name, before, after, supersededBy } of patches) {
      const afterCount = occurrences(diskText, after);
      const beforeCount = occurrences(diskText, before);
      const embeddedBeforeCount = occurrences(after, before);
      const supersededCount = supersededBy ? occurrences(diskText, supersededBy) : 0;
      if ((afterCount === 1 && beforeCount === embeddedBeforeCount) ||
          (afterCount === 0 && supersededBy && supersededCount === 1)) {
        throw new Error(`${relativePath}: found patched ${name} in stock host`);
      }
    }
  }

  for (const { name, before, after, supersededBy } of patches) {
    const afterCount = occurrences(text, after);
    if (afterCount === 0 && supersededBy && occurrences(text, supersededBy) === 1) continue;
    if (afterCount === 1) {
      const beforeCount = occurrences(text, before);
      const embeddedBeforeCount = occurrences(after, before);
      if (beforeCount !== embeddedBeforeCount) {
        throw new Error(
          `${relativePath}: found ambiguous patched/unpatched ${name} sites (${afterCount}/${beforeCount})`,
        );
      }
      continue;
    }
    if (afterCount !== 0) {
      throw new Error(`${relativePath}: expected one patched ${name} site, found ${afterCount}`);
    }
    if (checkOnly) {
      throw new Error(`${relativePath}: missing ${name}`);
    }
    const beforeCount = occurrences(text, before);
    if (beforeCount !== 1) {
      throw new Error(`${relativePath}: expected one ${name} patch site, found ${beforeCount}`);
    }
    text = text.replace(before, after);
    changed = true;
  }

  if (stockOnly) {
    stockVirtualFiles.set(path, text);
    console.log(`stock ${relativePath}`);
  } else if (changed) {
    pendingWrites.set(path, text);
    console.log(`planned ${relativePath}`);
  } else {
    console.log(`ok ${relativePath}`);
  }
}

const primeAgentPackage = readJson(join(root, "package.json"));
if (primeAgentPackage.name !== "prime-agent" || primeAgentPackage.version !== SUPPORTED_VERSION) {
  throw new Error(
    `expected prime-agent@${SUPPORTED_VERSION}, found ${primeAgentPackage.name}@${primeAgentPackage.version}`,
  );
}
const piCoreRoot = join(root, "node_modules/@earendil-works/pi-agent-core");
const piCorePackage = readJson(join(piCoreRoot, "package.json"));
if (piCorePackage.version !== SUPPORTED_VERSION) {
  throw new Error(
    `expected nested @earendil-works/pi-agent-core@${SUPPORTED_VERSION}, found ${piCorePackage.version}`,
  );
}

// A saved-session resume is also a fresh worker launch opportunity. Without launchEnv,
// the supervisor cannot safely replace a live worker whose descriptor is already failed.
applyPatches("dist/modes/agents-view/agents-view-mode.js", [
  {
    name: "Agents View resume launch environment import",
    before:
      'import { collectDaemonClientEnv, isUnknownDaemonCommandError, } from "../daemon/daemon-protocol.js";',
    after:
      'import { collectDaemonClientEnv, collectDaemonLaunchEnv, isUnknownDaemonCommandError, } from "../daemon/daemon-protocol.js";',
  },
  {
    name: "Agents View resume fresh worker launch environment",
    before: `        config: createAgentsViewResumeConfig(config, overrideCwd),
        sessionPath: summary.sessionFile,`,
    after: `        config: createAgentsViewResumeConfig(config, overrideCwd),
        sessionPath: summary.sessionFile,
        launchEnv: collectDaemonLaunchEnv(),`,
  },
]);

// Send the supervisor hello as soon as its owned socket accepts a client. Command handling
// remains gated on `ready`; delaying the hello behind worker adoption makes healthy clients
// classify a slow recovery as stale and launch competing replacement supervisors.
applyPatches("dist/modes/daemon/daemon-supervisor.js", [
  {
    name: "daemon hello before worker adoption completes",
    before: `        void this.ready.then(() => {
            if (!client.socket.destroyed && this.clients.has(client)) {
                this.write(client, {
                    type: "daemon_hello",
                    socketPath: this.socketPath,
                    protocol: DAEMON_PROTOCOL_INFO,
                    schemaId: DAEMON_SCHEMA_ID,
                    schemaRevision: DAEMON_SCHEMA_REVISION,
                    appVersion: VERSION,
                    runtime: getDaemonRuntimeIdentity(),
                    supervisorGeneration: this.generation,
                    supervisorOwnerToken: this.ownership?.record.token,
                    supervisorPid: process.pid,
                    supervisorProcessStartId: this.ownership?.record.processStartId,
                    supervisorSocketPath: this.ownership?.record.socketPath,
                    clientId: client.id,
                    serverCapabilities: SUPERVISOR_SERVER_CAPABILITIES,
                });
            }
        }, () => client.socket.destroy());`,
    after: `        if (!client.socket.destroyed && this.clients.has(client)) {
            this.write(client, {
                type: "daemon_hello",
                socketPath: this.socketPath,
                protocol: DAEMON_PROTOCOL_INFO,
                schemaId: DAEMON_SCHEMA_ID,
                schemaRevision: DAEMON_SCHEMA_REVISION,
                appVersion: VERSION,
                runtime: getDaemonRuntimeIdentity(),
                supervisorGeneration: this.generation,
                supervisorOwnerToken: this.ownership?.record.token,
                supervisorPid: process.pid,
                supervisorProcessStartId: this.ownership?.record.processStartId,
                supervisorSocketPath: this.ownership?.record.socketPath,
                clientId: client.id,
                serverCapabilities: SUPERVISOR_SERVER_CAPABILITIES,
            });
        }`,
  },
  {
    name: "session worker V8 heap sized for large persistent sessions",
    supersededBy: 'const workerHeapOption = "--max-old-space-size=16384";',
    before: `        delete workerEnvironment.RLM_DEPTH;
        await this.assertRecoveryAllowed();`,
    after: `        delete workerEnvironment.RLM_DEPTH;
        workerEnvironment.NODE_OPTIONS = [workerEnvironment.NODE_OPTIONS, "--max-old-space-size=16384"]
            .filter(Boolean)
            .join(" ");
        await this.assertRecoveryAllowed();`,
  },
  {
    name: "session worker heap option is not duplicated",
    supersededBy: 'NODE_OPTIONS?.split(" ").includes(workerHeapOption)',
    before: `        delete workerEnvironment.RLM_DEPTH;
        workerEnvironment.NODE_OPTIONS = [workerEnvironment.NODE_OPTIONS, "--max-old-space-size=16384"]
            .filter(Boolean)
            .join(" ");
        await this.assertRecoveryAllowed();`,
    after: `        delete workerEnvironment.RLM_DEPTH;
        const workerHeapOption = "--max-old-space-size=16384";
        if (!workerEnvironment.NODE_OPTIONS?.split(/\s+/).includes(workerHeapOption)) {
            workerEnvironment.NODE_OPTIONS = [workerEnvironment.NODE_OPTIONS, workerHeapOption]
                .filter(Boolean)
                .join(" ");
        }
        await this.assertRecoveryAllowed();`,
  },
  {
    name: "session worker heap option tokenization is literal-safe",
    before: `        if (!workerEnvironment.NODE_OPTIONS?.split(/s+/).includes(workerHeapOption)) {`,
    after: `        if (!workerEnvironment.NODE_OPTIONS?.split(" ").includes(workerHeapOption)) {`,
  },
  {
    name: "large worker attach uses long-running request timeout",
    before: `                            env: command.env ?? collectDaemonClientEnv(),
                        });`,
    after: `                            env: command.env ?? collectDaemonClientEnv(),
                        }, WORKER_REQUEST_TIMEOUT_MS);`,
  },
  {
    name: "in-flight snapshot invalidation keeps dedupe ownership",
    before: `                        if (match.worker.snapshotLoads.get(snapshotLoadKey) !== loading) {
                            throw new SnapshotLoadInvalidatedError("Session snapshot changed during attach");
                        }`,
    after: `                        const loadInvalidated = match.worker.invalidatedSnapshotLoads?.delete(snapshotLoadKey) === true;
                        if (match.worker.snapshotLoads.get(snapshotLoadKey) !== loading || loadInvalidated) {
                            throw new SnapshotLoadInvalidatedError("Session snapshot changed during attach");
                        }`,
  },
  {
    name: "snapshot invalidation marks rather than abandons active loads",
    before: `        worker.snapshotLoads.delete(\`\${activeSessionId}:chunked\`);
        worker.snapshotLoads.delete(\`\${activeSessionId}:full\`);`,
    after: `        worker.invalidatedSnapshotLoads ??= new Set();
        for (const key of [\`\${activeSessionId}:chunked\`, \`\${activeSessionId}:full\`]) {
            if (worker.snapshotLoads.has(key)) worker.invalidatedSnapshotLoads.add(key);
        }`,
  },
  {
    name: "completed snapshot load clears invalidation tombstone",
    before: `                        finally {
                            if (match.worker.snapshotLoads.get(snapshotLoadKey) === loading) {
                                match.worker.snapshotLoads.delete(snapshotLoadKey);
                            }
                        }`,
    after: `                        finally {
                            match.worker.invalidatedSnapshotLoads?.delete(snapshotLoadKey);
                            if (match.worker.snapshotLoads.get(snapshotLoadKey) === loading) {
                                match.worker.snapshotLoads.delete(snapshotLoadKey);
                            }
                        }`,
  },
  {
    name: "failed snapshot load clears invalidation tombstone",
    before: `                    }, () => {
                        if (match.worker.snapshotLoads.get(snapshotLoadKey) === loading) {
                            match.worker.snapshotLoads.delete(snapshotLoadKey);
                        }
                    });`,
    after: `                    }, () => {
                        match.worker.invalidatedSnapshotLoads?.delete(snapshotLoadKey);
                        if (match.worker.snapshotLoads.get(snapshotLoadKey) === loading) {
                            match.worker.snapshotLoads.delete(snapshotLoadKey);
                        }
                    });`,
  },
  {
    name: "duplicate snapshot chunks compare encoded buffers directly",
    before: `                        const chunk = JSON.parse(frame.payload.toString("utf8"));
                        if (chunk.type !== "session_snapshot_chunk" ||
                            chunk.activeSessionId !== activeSessionId ||
                            chunk.snapshotId !== generation.transcript.snapshotId ||
                            chunk.index !== duplicateIndex ||
                            !generation.transcript.readChunk(duplicateIndex).equals(Buffer.from(frame.payload))) {`,
    after: `                        const encodedChunk = Buffer.from(frame.payload);
                        if (!generation.transcript.readChunk(duplicateIndex).equals(encodedChunk)) {`,
  },
  {
    name: "child passivation sweeps never evict top-level workers",
    before: `        const candidates = [...refreshed].filter((worker) => canEvictWorker(this.workerEvictionSnapshot(worker), idleEvictionMinutes, now));`,
    after: `        // This timer exists to passivate completed child sessions. Top-level workers
        // must remain resident even when their UI client temporarily disconnects.
        const candidates = [];`,
  },
]);

applyPatches("dist/modes/daemon/daemon-mode.js", [
  {
    name: "worker child passivation keeps an in-flight tombstone",
    before: `                case "worker_passivate_idle_children": {
                    const count = await this.passivateIdleChildren(command.idleEvictionMinutes, command.now, command.limit);
                    this.writeWorkerSuccess(client, command, { count });
                    return;
                }`,
    after: `                case "worker_passivate_idle_children": {
                    let passivation = this.idleChildPassivation;
                    if (!passivation) {
                        passivation = this.passivateIdleChildren(command.idleEvictionMinutes, command.now, command.limit);
                        this.idleChildPassivation = passivation;
                        void passivation.then(() => {
                            if (this.idleChildPassivation === passivation) this.idleChildPassivation = undefined;
                        }, () => {
                            if (this.idleChildPassivation === passivation) this.idleChildPassivation = undefined;
                        });
                    }
                    const count = await passivation;
                    this.writeWorkerSuccess(client, command, { count });
                    return;
                }`,
  },
]);

applyPatches("dist/modes/agent-connection/daemon-agent-connection.js", [
  {
    name: "public attach uses long-running request timeout",
    before: `            resumeCursor: this.lastEventCursor === undefined
                ? undefined
                : {
                    activeSessionId: this.activeSessionId,
                    ...this.lastEventCursor,
                },
        }, undefined, options);`,
    after: `            resumeCursor: this.lastEventCursor === undefined
                ? undefined
                : {
                    activeSessionId: this.activeSessionId,
                    ...this.lastEventCursor,
                },
        }, DAEMON_LONG_RUNNING_REQUEST_TIMEOUT_MS, options);`,
  },
  {
    name: "snapshot assembly timeout follows transfer progress",
    before: `    getSnapshotAssembly(snapshotId) {
        const existing = this.snapshotAssemblies.get(snapshotId);
        if (existing) {
            return existing;
        }
        let resolveSnapshot;
        let rejectSnapshot;
        const promise = new Promise((resolve, reject) => {
            resolveSnapshot = resolve;
            rejectSnapshot = reject;
        });
        void promise.catch(() => undefined);
        const timeout = setTimeout(() => {
            const current = this.snapshotAssemblies.get(snapshotId);
            if (current) {
                current.reject(new Error(\`Timed out waiting for snapshot \${snapshotId}\`));
                this.snapshotAssemblies.delete(snapshotId);
                this.ignoreSnapshotId(snapshotId);
            }
        }, this.options.snapshotTimeoutMs ?? DAEMON_SNAPSHOT_TIMEOUT_MS);
        timeout.unref();
        const assembly = {
            chunks: new Map(),
            promise,
            resolve: resolveSnapshot,
            reject: rejectSnapshot,
            timeout,
        };
        this.snapshotAssemblies.set(snapshotId, assembly);
        return assembly;
    }`,
    after: `    refreshSnapshotAssemblyTimeout(snapshotId, assembly) {
        clearTimeout(assembly.timeout);
        assembly.timeout = setTimeout(() => {
            const current = this.snapshotAssemblies.get(snapshotId);
            if (current === assembly) {
                current.reject(new Error(\`Timed out waiting for snapshot \${snapshotId}\`));
                this.snapshotAssemblies.delete(snapshotId);
                this.ignoreSnapshotId(snapshotId);
            }
        }, this.options.snapshotTimeoutMs ?? DAEMON_SNAPSHOT_TIMEOUT_MS);
        assembly.timeout.unref();
    }
    getSnapshotAssembly(snapshotId) {
        const existing = this.snapshotAssemblies.get(snapshotId);
        if (existing) {
            return existing;
        }
        let resolveSnapshot;
        let rejectSnapshot;
        const promise = new Promise((resolve, reject) => {
            resolveSnapshot = resolve;
            rejectSnapshot = reject;
        });
        void promise.catch(() => undefined);
        const assembly = {
            chunks: new Map(),
            promise,
            resolve: resolveSnapshot,
            reject: rejectSnapshot,
            timeout: undefined,
        };
        this.snapshotAssemblies.set(snapshotId, assembly);
        this.refreshSnapshotAssemblyTimeout(snapshotId, assembly);
        return assembly;
    }`,
  },
  {
    name: "snapshot begin refreshes inactivity timeout",
    before: `            const assembly = this.getSnapshotAssembly(message.snapshotId);
            assembly.begin = message;
            return;`,
    after: `            const assembly = this.getSnapshotAssembly(message.snapshotId);
            assembly.begin = message;
            this.refreshSnapshotAssemblyTimeout(message.snapshotId, assembly);
            return;`,
  },
  {
    name: "snapshot chunk refreshes inactivity timeout",
    before: `            this.getSnapshotAssembly(message.snapshotId).chunks.set(message.index, message.messages);
            return;`,
    after: `            const assembly = this.getSnapshotAssembly(message.snapshotId);
            assembly.chunks.set(message.index, message.messages);
            this.refreshSnapshotAssemblyTimeout(message.snapshotId, assembly);
            return;`,
  },
]);

// Bound memory-heavy resident RLM sessions. Completed children stay addressable through the
// daemon's passive registry after idle eviction; callers can wait or delete one before spawning more.
applyPatches("dist/core/agent-session.js", [
  {
    name: "resident RLM child memory limit",
    supersededBy: "residentRlmChildCount >= 1",
    before: `        if (this._rlmDepth >= this._rlmMaxDepth) {
            throw new Error(\`RLM recursion depth limit reached (RLM_DEPTH=\${this._rlmDepth}, RLM_MAX_DEPTH=\${this._rlmMaxDepth})\`);
        }
        if (requestedSessionName) {`,
    after: `        if (this._rlmDepth >= this._rlmMaxDepth) {
            throw new Error(\`RLM recursion depth limit reached (RLM_DEPTH=\${this._rlmDepth}, RLM_MAX_DEPTH=\${this._rlmMaxDepth})\`);
        }
        const residentRlmChildCount = this._unsettledRlmChildRuns.size + this._rlmChildSessions.size;
        if (residentRlmChildCount >= 4) {
            throw new Error(
                \`RLM resident child limit reached (\${residentRlmChildCount}/4). Wait for idle passivation or delete a completed subagent before spawning another.\`,
            );
        }
        if (requestedSessionName) {`,
  },
  {
    name: "resident RLM child limit tightened for large sessions",
    before: `        const residentRlmChildCount = this._unsettledRlmChildRuns.size + this._rlmChildSessions.size;
        if (residentRlmChildCount >= 4) {
            throw new Error(
                \`RLM resident child limit reached (\${residentRlmChildCount}/4). Wait for idle passivation or delete a completed subagent before spawning another.\`,
            );
        }`,
    after: `        const residentRlmChildCount = this._unsettledRlmChildRuns.size + this._rlmChildSessions.size;
        if (residentRlmChildCount >= 1) {
            throw new Error(
                \`RLM resident child limit reached (\${residentRlmChildCount}/1). Wait for idle passivation or delete the completed subagent before spawning another.\`,
            );
        }`,
  },
]);

applyPatches("node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js", [
  {
    name: "turn_end mode for failed assistant response",
    supersededBy: 'toolExecution: config.toolExecution ?? "parallel", exchanges: []',
    before: '                await emit({ type: "turn_end", message, toolResults: [] });',
    after: `                const turnEndResult = await emit({ type: "turn_end", message, toolResults: [], toolExecution: config.toolExecution ?? "parallel" });
                for (const turnEndMessage of turnEndResult?.messages ?? []) {
                    await emit({ type: "message_start", message: turnEndMessage });
                    await emit({ type: "message_end", message: turnEndMessage });
                    currentContext.messages.push(turnEndMessage);
                    newMessages.push(turnEndMessage);
                }`,
  },
  {
    name: "effective mode captured from the executed batch",
    supersededBy: "                exchanges.push(...executedToolBatch.exchanges);",
    before: `            const toolCalls = message.content.filter((c) => c.type === "toolCall");
            const toolResults = [];
            hasMoreToolCalls = false;
            if (toolCalls.length > 0) {
                const executedToolBatch = await executeToolCalls(currentContext, message, config, signal, emit);
                toolResults.push(...executedToolBatch.messages);`,
    after: `            const toolCalls = message.content.filter((c) => c.type === "toolCall");
            const toolResults = [];
            let toolExecution = config.toolExecution ?? "parallel";
            hasMoreToolCalls = false;
            if (toolCalls.length > 0) {
                const executedToolBatch = await executeToolCalls(currentContext, message, config, signal, emit);
                toolExecution = executedToolBatch.toolExecution;
                toolResults.push(...executedToolBatch.messages);`,
  },
  {
    name: "turn_end effective mode",
    supersededBy: 'toolResults, toolExecution, exchanges });',
    before: '            await emit({ type: "turn_end", message, toolResults });',
    after: `            const turnEndResult = await emit({ type: "turn_end", message, toolResults, toolExecution });
            for (const turnEndMessage of turnEndResult?.messages ?? []) {
                await emit({ type: "message_start", message: turnEndMessage });
                await emit({ type: "message_end", message: turnEndMessage });
                currentContext.messages.push(turnEndMessage);
                newMessages.push(turnEndMessage);
            }`,
  },
  {
    name: "mode returned by the selected tool execution branch",
    supersededBy: 'return withToolExchanges(batch, toolCalls, "sequential");',
    before: `    if (config.toolExecution === "sequential" || hasSequentialToolCall) {
        return executeToolCallsSequential(currentContext, assistantMessage, toolCalls, config, signal, emit);
    }
    return executeToolCallsParallel(currentContext, assistantMessage, toolCalls, config, signal, emit);`,
    after: `    if (config.toolExecution === "sequential" || hasSequentialToolCall) {
        const batch = await executeToolCallsSequential(currentContext, assistantMessage, toolCalls, config, signal, emit);
        return { ...batch, toolExecution: "sequential" };
    }
    const batch = await executeToolCallsParallel(currentContext, assistantMessage, toolCalls, config, signal, emit);
    return { ...batch, toolExecution: "parallel" };`,
  },
]);

applyPatches("node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js", [
  {
    name: "finalized exchanges on failed assistant turn",
    before: '                const turnEndResult = await emit({ type: "turn_end", message, toolResults: [], toolExecution: config.toolExecution ?? "parallel" });',
    after: '                const turnEndResult = await emit({ type: "turn_end", message, toolResults: [], toolExecution: config.toolExecution ?? "parallel", exchanges: [] });',
  },
  {
    name: "finalized exchange batch bridge",
    before: `    if (config.toolExecution === "sequential" || hasSequentialToolCall) {
        const batch = await executeToolCallsSequential(currentContext, assistantMessage, toolCalls, config, signal, emit);
        return { ...batch, toolExecution: "sequential" };
    }
    const batch = await executeToolCallsParallel(currentContext, assistantMessage, toolCalls, config, signal, emit);
    return { ...batch, toolExecution: "parallel" };
}`,
    after: `    if (config.toolExecution === "sequential" || hasSequentialToolCall) {
        const batch = await executeToolCallsSequential(currentContext, assistantMessage, toolCalls, config, signal, emit);
        return withToolExchanges(batch, toolCalls, "sequential");
    }
    const batch = await executeToolCallsParallel(currentContext, assistantMessage, toolCalls, config, signal, emit);
    return withToolExchanges(batch, toolCalls, "parallel");
}
function withToolExchanges(batch, toolCalls, toolExecution) {
    const exchanges = batch.messages.map((result, sourceOrder) => {
        const original = toolCalls[sourceOrder];
        const finalized = batch.finalizedCalls[sourceOrder];
        return {
            sourceOrder,
            toolCallId: original.id,
            toolName: original.name,
            originalInput: original.arguments,
            ...(finalized?.executedInput === undefined ? {} : { executedInput: finalized.executedInput }),
            result,
        };
    });
    return { messages: batch.messages, terminate: batch.terminate, toolExecution, exchanges };
}`,
  },
  {
    name: "executed normalized input captured",
    before: `    return {
        toolCall: prepared.toolCall,
        result,
        isError,
    };`,
    after: `    return {
        toolCall: prepared.toolCall,
        executedInput: prepared.args,
        result,
        isError,
    };`,
  },
  {
    name: "sequential finalized calls returned",
    before: `    return {
        messages,
        terminate: shouldTerminateToolBatch(finalizedCalls),
    };
}
async function executeToolCallsParallel`,
    after: `    return {
        messages,
        finalizedCalls,
        terminate: shouldTerminateToolBatch(finalizedCalls),
    };
}
async function executeToolCallsParallel`,
  },
  {
    name: "parallel finalized calls returned",
    before: `    return {
        messages,
        terminate: shouldTerminateToolBatch(orderedFinalizedCalls),
    };
}
function shouldTerminateToolBatch`,
    after: `    return {
        messages,
        finalizedCalls: orderedFinalizedCalls,
        terminate: shouldTerminateToolBatch(orderedFinalizedCalls),
    };
}
function shouldTerminateToolBatch`,
  },
  {
    name: "finalized exchange event accumulator",
    before: `            const toolResults = [];
            let toolExecution = config.toolExecution ?? "parallel";
            hasMoreToolCalls = false;
            if (toolCalls.length > 0) {
                const executedToolBatch = await executeToolCalls(currentContext, message, config, signal, emit);
                toolExecution = executedToolBatch.toolExecution;
                toolResults.push(...executedToolBatch.messages);`,
    after: `            const toolResults = [];
            const exchanges = [];
            let toolExecution = config.toolExecution ?? "parallel";
            hasMoreToolCalls = false;
            if (toolCalls.length > 0) {
                const executedToolBatch = await executeToolCalls(currentContext, message, config, signal, emit);
                toolExecution = executedToolBatch.toolExecution;
                toolResults.push(...executedToolBatch.messages);
                exchanges.push(...executedToolBatch.exchanges);`,
  },
  {
    name: "turn end includes finalized exchanges",
    before: `            const turnEndResult = await emit({ type: "turn_end", message, toolResults, toolExecution });`,
    after: `            const turnEndResult = await emit({ type: "turn_end", message, toolResults, toolExecution, exchanges });`,
  },
]);

applyPatches("node_modules/@earendil-works/pi-agent-core/dist/types.d.ts", [
  {
    name: "pi-agent-core agent event listener result declaration",
    before: `/**
 * Events emitted by the Agent for UI updates.`,
    after: `/** Result returned by awaited agent event listeners. */
export interface AgentEventResult {
    messages?: AgentMessage[];
}
/**
 * Events emitted by the Agent for UI updates.`,
  },
  {
    name: "pi-agent-core turn_end declaration",
    supersededBy: "    exchanges: readonly FinalizedToolExchange[];",
    before: `    type: "turn_end";
    message: AgentMessage;
    toolResults: ToolResultMessage[];
}`,
    after: `    type: "turn_end";
    message: AgentMessage;
    toolResults: ToolResultMessage[];
    toolExecution: ToolExecutionMode;
}`,
  },
]);


applyPatches("node_modules/@earendil-works/pi-agent-core/dist/types.d.ts", [
  {
    name: "finalized tool exchange declaration",
    before: `/** Result returned by awaited agent event listeners. */`,
    after: `/** A final source-ordered tool exchange after all supported result replacements. */
export interface FinalizedToolExchange {
    sourceOrder: number;
    toolCallId: string;
    toolName: string;
    originalInput: unknown;
    executedInput?: unknown;
    result: ToolResultMessage;
}
/** Result returned by awaited agent event listeners. */`,
  },
  {
    name: "agent turn end finalized exchanges declaration",
    before: `    toolResults: ToolResultMessage[];
    toolExecution: ToolExecutionMode;
}`,
    after: `    toolResults: ToolResultMessage[];
    toolExecution: ToolExecutionMode;
    exchanges: readonly FinalizedToolExchange[];
}`,
  },
]);

applyPatches("node_modules/@earendil-works/pi-agent-core/dist/agent-loop.d.ts", [
  {
    name: "pi-agent-core event sink result import",
    before:
      'import type { AgentContext, AgentEvent, AgentLoopConfig, AgentMessage, StreamFn } from "./types.js";',
    after:
      'import type { AgentContext, AgentEvent, AgentEventResult, AgentLoopConfig, AgentMessage, StreamFn } from "./types.js";',
  },
  {
    name: "pi-agent-core awaited event sink result declaration",
    before: "export type AgentEventSink = (event: AgentEvent) => Promise<void> | void;",
    after:
      "export type AgentEventSink = (event: AgentEvent) => Promise<AgentEventResult | void> | AgentEventResult | void;",
  },
]);

applyPatches("node_modules/@earendil-works/pi-agent-core/dist/agent.js", [
  {
    name: "pi-agent-core awaited listener message result propagation",
    before: `        for (const listener of this.listeners) {
            await listener(event, signal);
        }`,
    after: `        const resultMessages = [];
        for (const listener of this.listeners) {
            const listenerResult = await listener(event, signal);
            if (event.type === "turn_end" && Array.isArray(listenerResult?.messages)) {
                resultMessages.push(...listenerResult.messages);
            }
        }
        return resultMessages.length > 0 ? { messages: resultMessages } : undefined;`,
  },
]);

applyPatches("node_modules/@earendil-works/pi-agent-core/dist/agent.d.ts", [
  {
    name: "pi-agent-core agent listener result import",
    before:
      'import type { AfterToolCallContext, AfterToolCallResult, AgentEvent, AgentMessage, AgentState, BeforeToolCallContext, BeforeToolCallResult, GetContinuationMessagesContext, ShouldStopAfterTurnContext, StreamFn, ToolExecutionMode } from "./types.js";',
    after:
      'import type { AfterToolCallContext, AfterToolCallResult, AgentEvent, AgentEventResult, AgentMessage, AgentState, BeforeToolCallContext, BeforeToolCallResult, GetContinuationMessagesContext, ShouldStopAfterTurnContext, StreamFn, ToolExecutionMode } from "./types.js";',
  },
  {
    name: "pi-agent-core agent listener result declaration",
    before:
      "    subscribe(listener: (event: AgentEvent, signal: AbortSignal) => Promise<void> | void): () => void;",
    after:
      "    subscribe(listener: (event: AgentEvent, signal: AbortSignal) => Promise<AgentEventResult | void> | AgentEventResult | void): () => void;",
  },
]);

applyPatches("dist/core/extensions/runner.js", [
  {
    name: "awaited ordered turn_end handler results",
    before: `    async emitMessageEnd(event) {`,
    after: `    async emitTurnEnd(event) {
        const ctx = this.createContext();
        const messages = [];
        for (const ext of this.extensions) {
            const handlers = ext.handlers.get("turn_end");
            if (!handlers || handlers.length === 0)
                continue;
            for (const handler of handlers) {
                try {
                    const handlerResult = await handler(event, ctx);
                    if (handlerResult?.messages === undefined)
                        continue;
                    if (!Array.isArray(handlerResult.messages)) {
                        this.emitError({
                            extensionPath: ext.path,
                            event: "turn_end",
                            error: "turn_end handler messages must be an array",
                        });
                        continue;
                    }
                    for (let index = 0; index < handlerResult.messages.length; index++) {
                        const sourceMessage = handlerResult.messages[index];
                        let message = sourceMessage;
                        if (sourceMessage !== null && typeof sourceMessage === "object" && !Array.isArray(sourceMessage)) {
                            const { role, customType, content, display, details, timestamp, ...extras } = sourceMessage;
                            message = { ...extras, role, customType, content, display, details, timestamp };
                        }
                        const validContent = typeof message?.content === "string" ||
                            (Array.isArray(message?.content) && Array.from(message.content).every((block) => block !== null &&
                                typeof block === "object" &&
                                ((block.type === "text" && typeof block.text === "string") ||
                                    (block.type === "image" && typeof block.data === "string" && typeof block.mimeType === "string"))));
                        if (message === null ||
                            typeof message !== "object" ||
                            Array.isArray(message) ||
                            message.role !== "custom" ||
                            message.display !== false ||
                            typeof message.customType !== "string" ||
                            message.customType.length === 0 ||
                            !validContent ||
                            typeof message.timestamp !== "number" ||
                            !Number.isFinite(message.timestamp)) {
                            this.emitError({
                                extensionPath: ext.path,
                                event: "turn_end",
                                error: \`turn_end handler message at index \${index} must be a hidden CustomMessage\`,
                            });
                            continue;
                        }
                        messages.push(message);
                    }
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    const stack = err instanceof Error ? err.stack : undefined;
                    this.emitError({
                        extensionPath: ext.path,
                        event: "turn_end",
                        error: message,
                        stack,
                    });
                }
            }
        }
        return messages.length > 0 ? { messages } : undefined;
    }
    async emitMessageEnd(event) {`,
  },
]);

applyPatches("dist/core/agent-session.js", [
  {
    name: "turn_end boundary message persistence marker",
    before: "    _agentEventQueue = Promise.resolve();",
    after: `    _agentEventQueue = Promise.resolve();
    _turnEndMessages = new WeakSet();`,
  },
  {
    name: "extension turn_end mode bridge",
    supersededBy: "                exchanges: event.exchanges,",
    before: `                message: event.message,
                toolResults: event.toolResults,
            };`,
    after: `                message: event.message,
                toolResults: event.toolResults,
                toolExecution: event.toolExecution,
            };`,
  },
  {
    name: "queued agent event result and boundary persistence await",
    before: `        this._agentEventQueue = this._agentEventQueue.then(() => this._processAgentEvent(event), () => this._processAgentEvent(event));
        this._agentEventQueue.catch(() => { });`,
    after: `        const isTurnEndMessageEvent = (event.type === "message_start" || event.type === "message_end") &&
            this._turnEndMessages.has(event.message);
        const queuedEvent = this._agentEventQueue.then(() => this._processAgentEvent(event), () => this._processAgentEvent(event));
        this._agentEventQueue = queuedEvent.finally(() => {
            if (isTurnEndMessageEvent && event.type === "message_end") {
                this._turnEndMessages.delete(event.message);
            }
        });
        this._agentEventQueue.catch(() => { });
        if (event.type === "turn_end" || isTurnEndMessageEvent) {
            return this._agentEventQueue;
        }`,
  },
  {
    name: "capture extension event result",
    before: "        await this._emitExtensionEvent(event);",
    after: "        const extensionResult = await this._emitExtensionEvent(event);",
  },
  {
    name: "return queued extension event result",
    before: `        }
    }
    _resolveRetry() {`,
    after: `        }
        return extensionResult;
    }
    _resolveRetry() {`,
  },
  {
    name: "awaited turn_end result bridge",
    before: `            await this._extensionRunner.emit(extensionEvent);
            this._turnIndex++;`,
    after: `            const result = await this._extensionRunner.emitTurnEnd(extensionEvent);
            for (const message of result?.messages ?? []) {
                this._turnEndMessages.add(message);
            }
            this._turnIndex++;
            return result;`,
  },
]);

applyPatches("dist/core/agent-session.js", [
  {
    name: "extension finalized exchange bridge",
    before: `                toolResults: event.toolResults,
                toolExecution: event.toolExecution,
            };`,
    after: `                toolResults: event.toolResults,
                toolExecution: event.toolExecution,
                exchanges: event.exchanges,
            };`,
  },
]);

applyPatches("dist/core/agent-session.js", [
  {
    name: "await normal user bash persistence event",
    before: `            if (!options?.transient) {
                this.recordBashResult(command, result, options);
            }`,
    after: `            if (!options?.transient) {
                await this.recordBashResult(command, result, options);
            }`,
  },
  {
    name: "await extension supplied user bash persistence event",
    before: `                record(result);
                return {
                    exitCode: result.exitCode,`,
    after: `                await record(result);
                return {
                    exitCode: result.exitCode,`,
  },
  {
    name: "await cancelled user bash persistence event",
    before: `                record({
                    output: "",
                    exitCode: undefined,`,
    after: `                await record({
                    output: "",
                    exitCode: undefined,`,
  },
  {
    name: "await failed user bash persistence event",
    before: `            record({
                output: \`bash failed: \${errorMessage}\`,`,
    after: `            await record({
                output: \`bash failed: \${errorMessage}\`,`,
  },
  {
    name: "async user bash recorder closure",
    before: `        const record = transient
            ? () => { }
            : (result) => this.recordBashResult(command, result, { excludeFromContext });`,
    after: `        const record = transient
            ? async () => { }
            : async (result) => this.recordBashResult(command, result, { excludeFromContext });`,
  },
  {
    name: "direct finalized user bash event",
    before: `    recordBashResult(command, result, options) {
        const bashMessage = {`,
    after: `    async _emitUserBashEnd(entryId, bashMessage) {
        await this._extensionRunner.emit({
            type: "user_bash_end",
            entryId,
            command: bashMessage.command,
            output: bashMessage.output,
            isError: bashMessage.exitCode !== 0 || bashMessage.cancelled === true,
            exitCode: bashMessage.exitCode,
            cancelled: bashMessage.cancelled,
            truncated: bashMessage.truncated,
            fullOutputPath: bashMessage.fullOutputPath,
        });
    }
    async recordBashResult(command, result, options) {
        const bashMessage = {`,
  },
  {
    name: "emit finalized user bash after direct persistence",
    before: `            this.agent.state.messages.push(bashMessage);
            this.sessionManager.appendMessage(bashMessage);
        }
    }`,
    after: `            this.agent.state.messages.push(bashMessage);
            const entryId = this.sessionManager.appendMessage(bashMessage);
            await this._emitUserBashEnd(entryId, bashMessage);
        }
    }`,
  },
  {
    name: "await pending bash flush before validation",
    before: `        if (policy.flushPendingBashBeforeValidation)
            this._flushPendingBashMessages();`,
    after: `        if (policy.flushPendingBashBeforeValidation)
            await this._flushPendingBashMessages();`,
  },
  {
    name: "await pending bash flush after validation",
    before: `        if (!policy.flushPendingBashBeforeValidation)
            this._flushPendingBashMessages();`,
    after: `        if (!policy.flushPendingBashBeforeValidation)
            await this._flushPendingBashMessages();`,
  },
  {
    name: "emit finalized pending user bash events",
    before: `    _flushPendingBashMessages() {
        if (this._pendingBashMessages.length === 0)
            return;
        for (const bashMessage of this._pendingBashMessages) {
            this.agent.state.messages.push(bashMessage);
            this.sessionManager.appendMessage(bashMessage);
        }
        this._pendingBashMessages = [];
    }`,
    after: `    async _flushPendingBashMessages() {
        if (this._pendingBashMessages.length === 0)
            return;
        for (const bashMessage of this._pendingBashMessages) {
            this.agent.state.messages.push(bashMessage);
            const entryId = this.sessionManager.appendMessage(bashMessage);
            await this._emitUserBashEnd(entryId, bashMessage);
        }
        this._pendingBashMessages = [];
    }`,
  },
]);

applyPatches("dist/core/extensions/runner.js", [
  {
    name: "automatic refinement override action",
    before: `    getContextUsageFn = () => undefined;
    compactFn = () => { };`,
    after: `    getContextUsageFn = () => undefined;
    setAutomaticRefinementEnabledFn = () => { };
    compactFn = () => { };`,
  },
  {
    name: "bind automatic refinement override",
    before: `        this.getContextUsageFn = contextActions.getContextUsage;
        this.compactFn = contextActions.compact;`,
    after: `        this.getContextUsageFn = contextActions.getContextUsage;
        this.setAutomaticRefinementEnabledFn = contextActions.setAutomaticRefinementEnabled;
        this.compactFn = contextActions.compact;`,
  },
  {
    name: "automatic refinement extension context method",
    before: `            compact: (options) => {
                runner.assertActive();`,
    after: `            setAutomaticRefinementEnabled: (enabled) => {
                runner.assertActive();
                runner.setAutomaticRefinementEnabledFn(enabled);
            },
            compact: (options) => {
                runner.assertActive();`,
  },
]);

applyPatches("dist/core/agent-session.js", [
  {
    name: "automatic refinement override state",
    before: `    _refinePlanInFlight;
`,
    after: `    _refinePlanInFlight;
    _automaticRefinementEnabled;
`,
  },
  {
    name: "bind automatic refinement override action",
    before: `            getContextUsage: () => this.getContextUsage(),
            compact: (options) => {`,
    after: `            getContextUsage: () => this.getContextUsage(),
            setAutomaticRefinementEnabled: (enabled) => this.setAutomaticRefinementEnabled(enabled),
            compact: (options) => {`,
  },
  {
    name: "automatic refinement override gate",
    supersededBy: "this._scheduledAutoRefineTimers.clear();\n    }\n    _autoRefineAllowedForSession",
    before: `    _autoRefineAllowedForSession() {
        return this._rlmDepth === 0 && this._localHarnessStateDir() !== undefined;
    }`,
    after: `    setAutomaticRefinementEnabled(enabled) {
        this._automaticRefinementEnabled = enabled;
    }
    _autoRefineAllowedForSession() {
        return this._automaticRefinementEnabled !== false && this._rlmDepth === 0 && this._localHarnessStateDir() !== undefined;
    }`,
  },
]);

applyPatches("dist/core/extensions/types.d.ts", [
  {
    name: "extension turn_end declaration",
    supersededBy: "    exchanges: readonly FinalizedToolExchange[];",
    before: `    turnIndex: number;
    message: AgentMessage;
    toolResults: ToolResultMessage[];
}`,
    after: `    turnIndex: number;
    message: AgentMessage;
    toolResults: ToolResultMessage[];
    toolExecution: ToolExecutionMode;
}`,
  },
  {
    name: "extension turn_end result declaration",
    before: "/** Fired when a message starts (user, assistant, or toolResult) */",
    after: `export interface TurnEndEventResult {
    messages?: CustomMessage[];
}
/** Fired when a message starts (user, assistant, or toolResult) */`,
  },
  {
    name: "extension turn_end result handler overload",
    before: '    on(event: "turn_end", handler: ExtensionHandler<TurnEndEvent>): void;',
    after:
      '    on(event: "turn_end", handler: ExtensionHandler<TurnEndEvent, TurnEndEventResult>): void;',
  },
]);

applyPatches("dist/core/extensions/types.d.ts", [
  {
    name: "extension finalized exchange declaration",
    before: `interface TurnEndEvent {`,
    after: `export interface FinalizedToolExchange {
    sourceOrder: number;
    toolCallId: string;
    toolName: string;
    originalInput: unknown;
    executedInput?: unknown;
    result: ToolResultMessage;
}
interface TurnEndEvent {`,
  },
  {
    name: "extension turn end exchanges declaration",
    before: `    toolResults: ToolResultMessage[];
    toolExecution: ToolExecutionMode;
}`,
    after: `    toolResults: ToolResultMessage[];
    toolExecution: ToolExecutionMode;
    exchanges: readonly FinalizedToolExchange[];
}`,
  },
]);

applyPatches("dist/core/extensions/types.d.ts", [
  {
    name: "user bash end event declaration",
    before: `/** Source of user input */`,
    after: `/** Fired after a user Bash message is finalized and persisted. */
export interface UserBashEndEvent {
    type: "user_bash_end";
    entryId: string;
    command: string;
    output: string;
    isError: boolean;
    exitCode?: number | null;
    cancelled?: boolean;
    truncated?: boolean;
    fullOutputPath?: string;
    details?: unknown;
}
/** Source of user input */`,
  },
  {
    name: "user bash end event union",
    before: ` | UserBashEvent | InputEvent | ToolCallEvent`,
    after: ` | UserBashEvent | UserBashEndEvent | InputEvent | ToolCallEvent`,
  },
  {
    name: "user bash end extension overload",
    before: `    on(event: "user_bash", handler: ExtensionHandler<UserBashEvent, UserBashEventResult>): void;
    on(event: "input",`,
    after: `    on(event: "user_bash", handler: ExtensionHandler<UserBashEvent, UserBashEventResult>): void;
    on(event: "user_bash_end", handler: ExtensionHandler<UserBashEndEvent>): void;
    on(event: "input",`,
  },
]);

applyPatches("dist/core/extensions/types.d.ts", [
  {
    name: "automatic refinement override declaration",
    before: `    /** Trigger compaction without awaiting completion. */`,
    after: `    /** Override automatic refinement for the active extension lifecycle; undefined releases the override. */
    setAutomaticRefinementEnabled(enabled: boolean | undefined): void;
    /** Trigger compaction without awaiting completion. */`,
  },
]);

applyPatches("dist/core/extensions/runner.d.ts", [
  {
    name: "turn_end dedicated runner type imports",
    before: "SessionShutdownEvent, ToolCallEvent, ToolCallEventResult",
    after:
      "SessionShutdownEvent, ToolCallEvent, ToolCallEventResult, TurnEndEvent, TurnEndEventResult",
  },
  {
    name: "exclude turn_end from generic runner emit",
    before:
      "BeforeProviderRequestEvent | BeforeAgentStartEvent | MessageEndEvent | ResourcesDiscoverEvent | InputEvent>;",
    after:
      "BeforeProviderRequestEvent | BeforeAgentStartEvent | MessageEndEvent | ResourcesDiscoverEvent | InputEvent | TurnEndEvent>;",
  },
  {
    name: "turn_end dedicated runner declaration",
    before: "    emitMessageEnd(event: MessageEndEvent): Promise<AgentMessage | undefined>;",
    after: `    emitTurnEnd(event: TurnEndEvent): Promise<TurnEndEventResult | undefined>;
    emitMessageEnd(event: MessageEndEvent): Promise<AgentMessage | undefined>;`,
  },
]);

applyPatches("dist/core/extensions/index.d.ts", [
  {
    name: "extension turn_end result export",
    supersededBy: "FinalizedToolExchange, TurnEndEvent, TurnEndEventResult",
    before: "TreePreparation, TurnEndEvent, TurnStartEvent",
    after: "TreePreparation, TurnEndEvent, TurnEndEventResult, TurnStartEvent",
  },
]);

applyPatches("dist/index.d.ts", [
  {
    name: "root turn_end result export",
    supersededBy: "FinalizedToolExchange, TurnEndEvent, TurnEndEventResult",
    before: "ToolResultEvent, TurnEndEvent, TurnStartEvent",
    after: "ToolResultEvent, TurnEndEvent, TurnEndEventResult, TurnStartEvent",
  },
]);


// Step G: one purpose-aware projection surface for all model-facing consumers.
applyPatches("dist/core/messages.js", [
  {
    name: "provider-visible conversion result and entry-ref remapping",
    supersededBy: "messages: convertedMessages,",
    before: `        .filter((m) => m !== undefined);
}
//# sourceMappingURL=messages.js.map`,
    after: `        .filter((m) => m !== undefined);
}
/** Convert to the provider view without cloning provider-irrelevant tool details. */
export function convertToLlmWithEntryRefs(messages, entryRefs) {
    const refsByIndex = new Map((entryRefs ?? []).map((ref) => [ref.messageIndex, ref.entryId]));
    const convertedMessages = [];
    const convertedRefs = [];
    for (let messageIndex = 0; messageIndex < messages.length; messageIndex++) {
        const converted = convertToLlm([messages[messageIndex]])[0];
        if (!converted)
            continue;
        let modelMessage = converted;
        if (converted.role === "toolResult" && Object.hasOwn(converted, "details")) {
            const { details: _details, ...providerVisible } = converted;
            modelMessage = providerVisible;
        }
        const projectedIndex = convertedMessages.length;
        convertedMessages.push(modelMessage);
        const entryId = refsByIndex.get(messageIndex);
        if (entryId !== undefined) {
            convertedRefs.push({ messageIndex: projectedIndex, entryId });
        }
    }
    return {
        messages: structuredClone(convertedMessages),
        entryRefs: entryRefs === undefined ? undefined : convertedRefs,
    };
}
//# sourceMappingURL=messages.js.map`,
  },
]);

applyPatches("dist/core/messages.d.ts", [
  {
    name: "provider-visible conversion entry-ref declaration",
    before: `export declare function convertToLlm(messages: AgentMessage[]): Message[];`,
    after: `export declare function convertToLlm(messages: AgentMessage[]): Message[];
export declare function convertToLlmWithEntryRefs(messages: AgentMessage[], entryRefs?: Array<{
    messageIndex: number;
    entryId: string;
}>): {
    messages: Message[];
    entryRefs?: Array<{
        messageIndex: number;
        entryId: string;
    }>;
};`,
  },
]);

applyPatches("dist/core/session-manager.js", [
  {
    name: "empty session context entry refs",
    before: `    if (leafId === null) {
        return { messages: [], thinkingLevel: "off", serviceTier: "default", model: null };
    }`,
    after: `    if (leafId === null) {
        return { messages: [], entryRefs: [], thinkingLevel: "off", serviceTier: "default", model: null };
    }`,
  },
  {
    name: "second empty session context entry refs",
    before: `    if (!leaf) {
        return { messages: [], thinkingLevel: "off", serviceTier: "default", model: null };
    }`,
    after: `    if (!leaf) {
        return { messages: [], entryRefs: [], thinkingLevel: "off", serviceTier: "default", model: null };
    }`,
  },
  {
    name: "session context message construction entry ids",
    before: `    const messages = [];
    const appendMessage = (entry, target = messages) => {
        if (entry.type === "message") {
            target.push(entry.message);
        }
        else if (entry.type === "custom_message") {
            target.push(createCustomMessage(entry.customType, entry.content, entry.display, entry.details, entry.timestamp));
        }
        else if (entry.type === "branch_summary" && entry.summary) {
            target.push(createBranchSummaryMessage(entry.summary, entry.fromId, entry.timestamp));
        }
    };`,
    after: `    const messages = [];
    const entryIds = [];
    const appendMessage = (entry, target = messages, targetEntryIds = entryIds) => {
        let message;
        if (entry.type === "message") {
            message = entry.message;
        }
        else if (entry.type === "custom_message") {
            message = createCustomMessage(entry.customType, entry.content, entry.display, entry.details, entry.timestamp);
        }
        else if (entry.type === "branch_summary" && entry.summary) {
            message = createBranchSummaryMessage(entry.summary, entry.fromId, entry.timestamp);
        }
        if (message) {
            target.push(message);
            targetEntryIds.push(entry.id);
        }
    };`,
  },
  {
    name: "retained session context entry ids",
    before: `        const retainedMessages = [];
        let foundFirstKept = false;`,
    after: `        const retainedMessages = [];
        const retainedEntryIds = [];
        let foundFirstKept = false;`,
  },
  {
    name: "retained session message ref construction",
    before: `                appendMessage(entry, retainedMessages);`,
    after: `                appendMessage(entry, retainedMessages, retainedEntryIds);`,
  },
  {
    name: "compaction summary and retained entry ids",
    before: `        messages.push(createCompactionSummaryMessage(compaction.summary, compaction.tokensBefore, compaction.timestamp, compaction.customInstructions, retainedMessages.length), ...retainedMessages);`,
    after: `        messages.push(createCompactionSummaryMessage(compaction.summary, compaction.tokensBefore, compaction.timestamp, compaction.customInstructions, retainedMessages.length), ...retainedMessages);
        entryIds.push(compaction.id, ...retainedEntryIds);`,
  },
  {
    name: "session context returned entry refs",
    before: `    return { messages, thinkingLevel, serviceTier, model };
}`,
    after: `    return {
        messages,
        entryRefs: entryIds.map((entryId, messageIndex) => ({ messageIndex, entryId })),
        thinkingLevel,
        serviceTier,
        model,
    };
}`,
  },
  {
    name: "session manager exact message identity map",
    before: `    persistListeners = new Set();
    constructor(cwd, sessionDir, sessionFile, persist, preloadedEntries) {`,
    after: `    persistListeners = new Set();
    _entryIdsByMessage = new WeakMap();
    constructor(cwd, sessionDir, sessionFile, persist, preloadedEntries) {`,
  },
  {
    name: "bind appended raw messages to entries",
    before: `        this._appendEntry(entry);
        return entry.id;
    }
    appendThinkingLevelChange(thinkingLevel) {`,
    after: `        this._appendEntry(entry);
        this.bindMessageEntry(message, entry.id);
        return entry.id;
    }
    bindMessageEntry(message, entryId) {
        if (message !== null && typeof message === "object") {
            this._entryIdsByMessage.set(message, entryId);
        }
    }
    getContextEntryRefs(messages) {
        const entryRefs = [];
        for (let messageIndex = 0; messageIndex < messages.length; messageIndex++) {
            const entryId = this._entryIdsByMessage.get(messages[messageIndex]);
            if (entryId !== undefined) {
                entryRefs.push({ messageIndex, entryId });
            }
        }
        return entryRefs;
    }
    appendThinkingLevelChange(thinkingLevel) {`,
  },
  {
    name: "bind custom message source identity",
    before: `    appendCustomMessageEntry(customType, content, display, details) {
        const entry = {`,
    after: `    appendCustomMessageEntry(customType, content, display, details, sourceMessage) {
        const entry = {`,
  },
  {
    name: "return bound custom message entry",
    before: `        this._appendEntry(entry);
        return entry.id;
    }
    /**
     * Append a custom message, undoing the append if persistence fails so a`,
    after: `        this._appendEntry(entry);
        if (sourceMessage) {
            this.bindMessageEntry(sourceMessage, entry.id);
        }
        return entry.id;
    }
    /**
     * Append a custom message, undoing the append if persistence fails so a`,
  },
  {
    name: "bind rollback custom message source identity",
    before: `    appendCustomMessageEntryWithRollback(customType, content, display, details) {
        return this._appendEntryWithRollback(() => this.appendCustomMessageEntry(customType, content, display, details));
    }`,
    after: `    appendCustomMessageEntryWithRollback(customType, content, display, details, sourceMessage) {
        const entryId = this._appendEntryWithRollback(() => this.appendCustomMessageEntry(customType, content, display, details));
        if (sourceMessage) {
            this.bindMessageEntry(sourceMessage, entryId);
        }
        return entryId;
    }`,
  },
  {
    name: "bind rebuilt session context messages",
    before: `        return buildSessionContext(this.fileEntries, this.leafId, this.byId);
    }
    getHeader() {`,
    after: `        const context = buildSessionContext(this.fileEntries, this.leafId, this.byId);
        for (const ref of context.entryRefs) {
            this.bindMessageEntry(context.messages[ref.messageIndex], ref.entryId);
        }
        return context;
    }
    getHeader() {`,
  },
]);

applyPatches("dist/core/session-manager.d.ts", [
  {
    name: "session context entry refs declaration",
    before: `export interface SessionContext {
    messages: AgentMessage[];`,
    after: `export interface SessionContext {
    messages: AgentMessage[];
    entryRefs: Array<{
        messageIndex: number;
        entryId: string;
    }>;`,
  },
  {
    name: "session manager message ref methods",
    before: `    appendMessage(message: Message | CustomMessage | BashExecutionMessage): string;
    appendThinkingLevelChange(thinkingLevel: string): string;`,
    after: `    appendMessage(message: Message | CustomMessage | BashExecutionMessage): string;
    bindMessageEntry(message: object, entryId: string): void;
    getContextEntryRefs(messages: AgentMessage[]): Array<{
        messageIndex: number;
        entryId: string;
    }>;
    appendThinkingLevelChange(thinkingLevel: string): string;`,
  },
  {
    name: "custom message source identity declaration",
    before: `    appendCustomMessageEntry<T = unknown>(customType: string, content: string | (TextContent | ImageContent)[], display: boolean, details?: T): string;`,
    after: `    appendCustomMessageEntry<T = unknown>(customType: string, content: string | (TextContent | ImageContent)[], display: boolean, details?: T, sourceMessage?: CustomMessage<T>): string;`,
  },
  {
    name: "rollback custom message source identity declaration",
    before: `    appendCustomMessageEntryWithRollback<T = unknown>(customType: string, content: string | (TextContent | ImageContent)[], display: boolean, details?: T): string;`,
    after: `    appendCustomMessageEntryWithRollback<T = unknown>(customType: string, content: string | (TextContent | ImageContent)[], display: boolean, details?: T, sourceMessage?: CustomMessage<T>): string;`,
  },
]);

applyPatches("dist/core/extensions/runner.js", [
  {
    name: "projection conversion import",
    before: `import { theme } from "../../modes/interactive/theme/theme.js";`,
    after: `import { theme } from "../../modes/interactive/theme/theme.js";
import { convertToLlmWithEntryRefs } from "../messages.js";`,
  },
  {
    name: "purpose-aware raw and model context projection pipeline",
    supersededBy: "const previousMessages = currentMessages;",
    before: `    async emitContext(messages) {
        const ctx = this.createContext();
        let currentMessages = structuredClone(messages);
        for (const ext of this.extensions) {
            const handlers = ext.handlers.get("context");
            if (!handlers || handlers.length === 0)
                continue;
            for (const handler of handlers) {
                try {
                    const event = { type: "context", messages: currentMessages };
                    const handlerResult = await handler(event, ctx);
                    if (handlerResult && handlerResult.messages) {
                        currentMessages = handlerResult.messages;
                    }
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    const stack = err instanceof Error ? err.stack : undefined;
                    this.emitError({
                        extensionPath: ext.path,
                        event: "context",
                        error: message,
                        stack,
                    });
                }
            }
        }
        return currentMessages;
    }`,
    after: `    async _emitContextStage(type, messages, purpose, entryRefs) {
        const ctx = this.createContext();
        let currentMessages = messages;
        let currentEntryRefs = entryRefs;
        for (const ext of this.extensions) {
            const handlers = ext.handlers.get(type);
            if (!handlers || handlers.length === 0)
                continue;
            for (const handler of handlers) {
                try {
                    const event = {
                        type,
                        purpose,
                        messages: currentMessages,
                        ...(currentEntryRefs === undefined ? {} : { entryRefs: currentEntryRefs }),
                    };
                    const handlerResult = await handler(event, ctx);
                    if (!handlerResult)
                        continue;
                    if (handlerResult.messages !== undefined) {
                        const previousCount = currentMessages.length;
                        currentMessages = handlerResult.messages;
                        if (handlerResult.entryRefs !== undefined) {
                            currentEntryRefs = handlerResult.entryRefs;
                        }
                        else if (currentMessages.length !== previousCount) {
                            currentEntryRefs = undefined;
                        }
                    }
                    else if (handlerResult.entryRefs !== undefined) {
                        currentEntryRefs = handlerResult.entryRefs;
                    }
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    const stack = err instanceof Error ? err.stack : undefined;
                    this.emitError({
                        extensionPath: ext.path,
                        event: type,
                        error: message,
                        stack,
                    });
                }
            }
        }
        return { messages: currentMessages, entryRefs: currentEntryRefs };
    }
    async emitContext(messages, purpose = "provider", entryRefs) {
        const projected = await this._emitContextStage("context", structuredClone(messages), purpose, entryRefs);
        return projected.messages;
    }
    async projectContext(messages, purpose, entryRefs, transformModelMessages) {
        let raw = { messages, entryRefs };
        if (this.hasHandlers("context")) {
            raw = await this._emitContextStage("context", structuredClone(messages), purpose, entryRefs);
        }
        let model = convertToLlmWithEntryRefs(raw.messages, raw.entryRefs);
        if (transformModelMessages) {
            const previousCount = model.messages.length;
            const transformedMessages = await transformModelMessages(model.messages);
            model = {
                messages: transformedMessages,
                entryRefs: transformedMessages.length === previousCount ? model.entryRefs : undefined,
            };
        }
        if (this.hasHandlers("model_context")) {
            model = await this._emitContextStage("model_context", model.messages, purpose, model.entryRefs);
        }
        return model;
    }`,
  },
]);

applyPatches("dist/core/sdk.js", [
  {
    name: "provider projection conversion import",
    before: `import { convertToLlm } from "./messages.js";`,
    after: `import { convertToLlmWithEntryRefs } from "./messages.js";`,
  },
  {
    name: "provider projection before image blocking",
    before: `    const convertToLlmWithBlockImages = (messages) => {
        const converted = convertToLlm(messages);
        if (!settingsManager.getBlockImages()) {
            return converted;
        }
        return converted.map((msg) => {`,
    after: `    const applyBlockImages = (converted) => {
        if (!settingsManager.getBlockImages()) {
            return converted;
        }
        return converted.map((msg) => {`,
  },
  {
    name: "ordinary provider request uses shared projection",
    before: `            return msg;
        });
    };
    const extensionRunnerRef = {};`,
    after: `            return msg;
        });
    };
    const extensionRunnerRef = {};
    const convertToLlmWithBlockImages = async (messages) => {
        const runner = extensionRunnerRef.current;
        if (!runner) {
            return applyBlockImages(convertToLlmWithEntryRefs(messages).messages);
        }
        const projected = await runner.projectContext(messages, "provider", sessionManager.getContextEntryRefs(messages), applyBlockImages);
        return projected.messages;
    };`,
  },
  {
    name: "remove legacy provider-only raw transform bridge",
    before: `        sessionId: sessionManager.getSessionId(),
        transformContext: async (messages) => {
            const runner = extensionRunnerRef.current;
            if (!runner)
                return messages;
            return runner.emitContext(messages);
        },
        steeringMode: settingsManager.getSteeringMode(),`,
    after: `        sessionId: sessionManager.getSessionId(),
        steeringMode: settingsManager.getSteeringMode(),`,
  },
]);

applyPatches("dist/core/compaction/compaction.js", [
  {
    name: "projected token accumulation for compaction cut",
    before: `export function findCutPoint(entries, startIndex, endIndex, keepRecentTokens) {
    const cutPoints = findValidCutPoints(entries, startIndex, endIndex);`,
    after: `export function findCutPoint(entries, startIndex, endIndex, keepRecentTokens, projected) {
    const cutPoints = findValidCutPoints(entries, startIndex, endIndex);`,
  },
  {
    name: "projected per-entry token sizes",
    before: `    let accumulatedTokens = 0;
    let cutIndex = cutPoints[0]; // Default: keep from first message (not header)
    for (let i = endIndex - 1; i >= startIndex; i--) {
        const entry = entries[i];
        if (entry.type !== "message")
            continue;
        const messageTokens = estimateTokens(entry.message);
        accumulatedTokens += messageTokens;`,
    after: `    const projectedTokensByEntryId = new Map();
    if (projected?.entryRefs) {
        for (const ref of projected.entryRefs) {
            const message = projected.messages[ref.messageIndex];
            if (!message)
                continue;
            projectedTokensByEntryId.set(ref.entryId, (projectedTokensByEntryId.get(ref.entryId) ?? 0) + estimateTokens(message));
        }
    }
    let accumulatedTokens = 0;
    let cutIndex = cutPoints[0]; // Default: keep from first message (not header)
    for (let i = endIndex - 1; i >= startIndex; i--) {
        const entry = entries[i];
        if (entry.type !== "message" && !projectedTokensByEntryId.has(entry.id))
            continue;
        const messageTokens = projected
            ? (projectedTokensByEntryId.get(entry.id) ?? 0)
            : estimateTokens(entry.message);
        accumulatedTokens += messageTokens;`,
  },
  {
    name: "projected compaction preparation and fallback",
    before: `export function prepareCompaction(pathEntries, settings) {
    if (pathEntries.length > 0 && pathEntries[pathEntries.length - 1].type === "compaction") {`,
    after: `export function prepareCompaction(pathEntries, settings, projected) {
    if (pathEntries.length > 0 && pathEntries[pathEntries.length - 1].type === "compaction") {`,
  },
  {
    name: "complete projected refs or raw compaction fallback",
    before: `    let prevCompactionIndex = -1;`,
    after: `    const pathEntryIds = new Set(pathEntries.map((entry) => entry.id));
    const projectedMessageIndexes = new Set();
    let hasUsableProjection = Array.isArray(projected?.messages) &&
        Array.isArray(projected?.entryRefs) &&
        projected.entryRefs.length === projected.messages.length;
    if (hasUsableProjection) {
        for (const ref of projected.entryRefs) {
            if (!Number.isInteger(ref.messageIndex) || ref.messageIndex < 0 ||
                ref.messageIndex >= projected.messages.length || typeof ref.entryId !== "string" ||
                !pathEntryIds.has(ref.entryId) || projectedMessageIndexes.has(ref.messageIndex)) {
                hasUsableProjection = false;
                break;
            }
            projectedMessageIndexes.add(ref.messageIndex);
        }
    }
    if (!hasUsableProjection) {
        projected = undefined;
    }
    let prevCompactionIndex = -1;`,
  },
  {
    name: "projected compaction size and cut",
    before: `    const tokensBefore = estimateContextTokens(buildSessionContext(pathEntries).messages).tokens;
    const cutPoint = findCutPoint(pathEntries, boundaryStart, boundaryEnd, settings.keepRecentTokens);`,
    after: `    const tokensBefore = projected
        ? projected.messages.reduce((total, message) => total + estimateTokens(message), 0)
        : estimateContextTokens(buildSessionContext(pathEntries).messages).tokens;
    const cutPoint = findCutPoint(pathEntries, boundaryStart, boundaryEnd, settings.keepRecentTokens, projected);`,
  },
  {
    name: "projected compaction summary ranges with raw file inputs",
    before: `    const messagesToSummarize = [];
    for (let i = boundaryStart; i < historyEnd; i++) {
        const msg = getMessageFromEntryForCompaction(pathEntries[i]);
        if (msg)
            messagesToSummarize.push(msg);
    }
    const turnPrefixMessages = [];
    if (cutPoint.isSplitTurn) {
        for (let i = cutPoint.turnStartIndex; i < cutPoint.firstKeptEntryIndex; i++) {
            const msg = getMessageFromEntryForCompaction(pathEntries[i]);
            if (msg)
                turnPrefixMessages.push(msg);
        }
    }`,
    after: `    const rawMessagesToSummarize = [];
    for (let i = boundaryStart; i < historyEnd; i++) {
        const msg = getMessageFromEntryForCompaction(pathEntries[i]);
        if (msg)
            rawMessagesToSummarize.push(msg);
    }
    const rawTurnPrefixMessages = [];
    if (cutPoint.isSplitTurn) {
        for (let i = cutPoint.turnStartIndex; i < cutPoint.firstKeptEntryIndex; i++) {
            const msg = getMessageFromEntryForCompaction(pathEntries[i]);
            if (msg)
                rawTurnPrefixMessages.push(msg);
        }
    }
    let messagesToSummarize = rawMessagesToSummarize;
    let turnPrefixMessages = rawTurnPrefixMessages;
    if (projected) {
        const entryIndexById = new Map(pathEntries.map((entry, index) => [entry.id, index]));
        const refsByMessageIndex = new Map(projected.entryRefs.map((ref) => [ref.messageIndex, ref.entryId]));
        const previousCompactionId = prevCompactionIndex >= 0 ? pathEntries[prevCompactionIndex].id : undefined;
        const projectedRange = (startIndex, endIndex) => projected.messages.filter((_message, messageIndex) => {
            const entryId = refsByMessageIndex.get(messageIndex);
            const entryIndex = entryIndexById.get(entryId);
            return entryId !== previousCompactionId && entryIndex !== undefined &&
                entryIndex >= startIndex && entryIndex < endIndex;
        });
        messagesToSummarize = projectedRange(boundaryStart, historyEnd);
        turnPrefixMessages = cutPoint.isSplitTurn
            ? projectedRange(cutPoint.turnStartIndex, cutPoint.firstKeptEntryIndex)
            : [];
        if (prevCompactionIndex >= 0) {
            const prevCompaction = pathEntries[prevCompactionIndex];
            const projectedPreviousMessages = projected.messages.filter((_message, messageIndex) =>
                refsByMessageIndex.get(messageIndex) === prevCompaction.id);
            if (projectedPreviousMessages.length === 0) {
                previousSummary = undefined;
            }
            else {
                const expectedPreviousMessage = createCompactionSummaryMessage(prevCompaction.summary, prevCompaction.tokensBefore, prevCompaction.timestamp, prevCompaction.customInstructions);
                const expectedSerialized = serializeConversation(convertToLlm([expectedPreviousMessage]));
                const projectedSerialized = serializeConversation(projectedPreviousMessages);
                previousSummary = projectedSerialized === expectedSerialized
                    ? prevCompaction.summary
                    : projectedSerialized;
            }
        }
    }`,
  },
  {
    name: "raw compaction file operation extraction",
    before: `    const fileOps = extractFileOperations(messagesToSummarize, pathEntries, prevCompactionIndex);
    // Split turns retain their suffix, but their prefix file operations still belong in the summary.
    if (cutPoint.isSplitTurn) {
        for (const msg of turnPrefixMessages) {`,
    after: `    const fileOps = extractFileOperations(rawMessagesToSummarize, pathEntries, prevCompactionIndex);
    // Split turns retain their suffix, but their prefix file operations still belong in the summary.
    if (cutPoint.isSplitTurn) {
        for (const msg of rawTurnPrefixMessages) {`,
  },
]);

applyPatches("dist/core/compaction/compaction.d.ts", [
  {
    name: "projected compaction model message import",
    before: `import type { Model, Usage } from "@earendil-works/pi-ai";`,
    after: `import type { Message, Model, Usage } from "@earendil-works/pi-ai";`,
  },
  {
    name: "projected compaction preparation messages",
    before: `    messagesToSummarize: AgentMessage[];
    /** Messages that will be turned into turn prefix summary (if splitting) */
    turnPrefixMessages: AgentMessage[];`,
    after: `    messagesToSummarize: Message[];
    /** Messages that will be turned into turn prefix summary (if splitting) */
    turnPrefixMessages: Message[];`,
  },
  {
    name: "projected compaction input declaration",
    before: `export interface CompactionPreparation {`,
    after: `export interface ProjectedCompactionInput {
    messages: Message[];
    entryRefs?: Array<{
        messageIndex: number;
        entryId: string;
    }>;
}
export interface CompactionPreparation {`,
  },
  {
    name: "projected compaction cut declaration",
    before: `export declare function findCutPoint(entries: SessionEntry[], startIndex: number, endIndex: number, keepRecentTokens: number): CutPointResult;`,
    after: `export declare function findCutPoint(entries: SessionEntry[], startIndex: number, endIndex: number, keepRecentTokens: number, projected?: ProjectedCompactionInput): CutPointResult;`,
  },
  {
    name: "projected compaction preparation declaration",
    before: `export declare function prepareCompaction(pathEntries: SessionEntry[], settings: CompactionSettings): CompactionPreparation | undefined;`,
    after: `export declare function prepareCompaction(pathEntries: SessionEntry[], settings: CompactionSettings, projected?: ProjectedCompactionInput): CompactionPreparation | undefined;`,
  },
]);

applyPatches("dist/core/compaction/branch-summarization.js", [
  {
    name: "complete projected tree exchange groups",
    before: `export function prepareBranchEntries(entries, tokenBudget = 0) {
    const messages = [];
    const fileOps = createFileOps();
    let totalTokens = 0;`,
    after: `export function prepareBranchEntries(entries, tokenBudget = 0, projected) {
    const messages = [];
    const fileOps = createFileOps();
    let totalTokens = 0;`,
  },
  {
    name: "tree raw file ops and projected complete-pair budgeting",
    before: `    for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        const message = getMessageFromEntry(entry);
        if (!message)
            continue;
        extractFileOpsFromMessage(message, fileOps);
        const tokens = estimateTokens(message);
        if (tokenBudget > 0 && totalTokens + tokens > tokenBudget) {
            if (entry.type === "compaction" || entry.type === "branch_summary") {
                if (totalTokens < tokenBudget * 0.9) {
                    messages.unshift(message);
                    totalTokens += tokens;
                }
            }
            break;
        }
        messages.unshift(message);
        totalTokens += tokens;
    }
    return { messages, fileOps, totalTokens };`,
    after: `    if (!projected) {
        for (let i = entries.length - 1; i >= 0; i--) {
            const entry = entries[i];
            const message = getMessageFromEntry(entry);
            if (!message)
                continue;
            extractFileOpsFromMessage(message, fileOps);
            const tokens = estimateTokens(message);
            if (tokenBudget > 0 && totalTokens + tokens > tokenBudget) {
                if (entry.type === "compaction" || entry.type === "branch_summary") {
                    if (totalTokens < tokenBudget * 0.9) {
                        messages.unshift(message);
                        totalTokens += tokens;
                    }
                }
                break;
            }
            messages.unshift(message);
            totalTokens += tokens;
        }
        return { messages, fileOps, totalTokens };
    }
    const rawMessages = [];
    for (const entry of entries) {
        const message = getMessageFromEntry(entry);
        if (message) {
            rawMessages.push(message);
            extractFileOpsFromMessage(message, fileOps);
        }
    }
    const sourceMessages = projected?.messages ?? convertToLlm(rawMessages);
    const groups = [];
    for (let index = 0; index < sourceMessages.length;) {
        const message = sourceMessages[index];
        if (message.role === "toolResult") {
            index++;
            continue;
        }
        if (message.role === "assistant") {
            const toolCallIds = message.content.filter((part) => part.type === "toolCall").map((part) => part.id);
            if (toolCallIds.length > 0) {
                const expected = new Set(toolCallIds);
                const results = [];
                let next = index + 1;
                while (next < sourceMessages.length && sourceMessages[next].role === "toolResult") {
                    if (expected.has(sourceMessages[next].toolCallId)) {
                        results.push(sourceMessages[next]);
                    }
                    next++;
                }
                const completed = new Set(results.map((result) => result.toolCallId));
                if (toolCallIds.every((id) => completed.has(id))) {
                    groups.push([message, ...results]);
                }
                else {
                    const visibleContent = message.content.filter((part) => part.type !== "toolCall");
                    if (visibleContent.length > 0) {
                        groups.push([{ ...message, content: visibleContent }]);
                    }
                }
                index = next;
                continue;
            }
        }
        groups.push([message]);
        index++;
    }
    for (let index = groups.length - 1; index >= 0; index--) {
        const group = groups[index];
        const tokens = group.reduce((sum, message) => sum + estimateTokens(message), 0);
        if (tokenBudget > 0 && totalTokens + tokens > tokenBudget) {
            break;
        }
        messages.unshift(...group);
        totalTokens += tokens;
    }
    return { messages, fileOps, totalTokens };`,
  },
  {
    name: "tree summary consumes projected messages",
    before: `    const { model, apiKey, headers, signal, customInstructions, replaceInstructions, reserveTokens = 16384 } = options;
    const contextWindow = model.contextWindow || 128000;
    const tokenBudget = contextWindow - reserveTokens;
    const { messages, fileOps } = prepareBranchEntries(entries, tokenBudget);`,
    after: `    const { model, apiKey, headers, signal, customInstructions, replaceInstructions, reserveTokens = 16384, projected } = options;
    const contextWindow = model.contextWindow || 128000;
    const tokenBudget = contextWindow - reserveTokens;
    const { messages, fileOps } = prepareBranchEntries(entries, tokenBudget, projected);`,
  },
]);

applyPatches("dist/core/compaction/branch-summarization.d.ts", [
  {
    name: "tree model message type import",
    before: `import type { Model } from "@earendil-works/pi-ai";`,
    after: `import type { Message, Model } from "@earendil-works/pi-ai";`,
  },
  {
    name: "tree preparation model messages",
    before: `    messages: AgentMessage[];
    /** File operations extracted from tool calls */`,
    after: `    messages: Message[];
    /** File operations extracted from tool calls */`,
  },
  {
    name: "tree projected option declaration",
    before: `    /** Tokens reserved for prompt + LLM response (default 16384) */
    reserveTokens?: number;
}`,
    after: `    /** Tokens reserved for prompt + LLM response (default 16384) */
    reserveTokens?: number;
    projected?: {
        messages: Message[];
        entryRefs?: Array<{
            messageIndex: number;
            entryId: string;
        }>;
    };
}`,
  },
  {
    name: "tree projected input declaration",
    before: `export declare function prepareBranchEntries(entries: SessionEntry[], tokenBudget?: number): BranchPreparation;`,
    after: `export declare function prepareBranchEntries(entries: SessionEntry[], tokenBudget?: number, projected?: {
    messages: Message[];
    entryRefs?: Array<{
        messageIndex: number;
        entryId: string;
    }>;
}): BranchPreparation;`,
  },
]);

applyPatches("dist/core/extensions/types.d.ts", [
  {
    name: "model message type import",
    before: `import type { Api, AssistantMessageEvent, AssistantMessageEventStream, Context, ImageContent, Model, OAuthCredentials, OAuthLoginCallbacks, SimpleStreamOptions, TextContent, ToolResultMessage } from "@earendil-works/pi-ai";`,
    after: `import type { Api, AssistantMessageEvent, AssistantMessageEventStream, Context, ImageContent, Message, Model, OAuthCredentials, OAuthLoginCallbacks, SimpleStreamOptions, TextContent, ToolResultMessage } from "@earendil-works/pi-ai";`,
  },
  {
    name: "public context purpose and entry refs",
    supersededBy: "\"provider\" | \"budget\" | \"compaction\"",
    before: `/** Fired before each LLM call. Can modify messages. */
export interface ContextEvent {
    type: "context";
    messages: AgentMessage[];
}`,
    after: `export type ContextPurpose = "provider" | "compaction" | "branch-summary" | "refine";
export interface ContextEntryRef {
    messageIndex: number;
    entryId: string;
}
/** Fired before each model-facing conversation consumer. */
export interface ContextEvent {
    type: "context";
    purpose: ContextPurpose;
    messages: AgentMessage[];
    entryRefs?: ContextEntryRef[];
}
/** Fired with the lightweight provider-visible view of the same conversation. */
export interface ModelContextEvent {
    type: "model_context";
    purpose: ContextPurpose;
    messages: Message[];
    entryRefs?: ContextEntryRef[];
}`,
  },
  {
    name: "model context event union",
    before: `export type ExtensionEvent = ResourcesDiscoverEvent | SessionEvent | ContextEvent | BeforeProviderRequestEvent`,
    after: `export type ExtensionEvent = ResourcesDiscoverEvent | SessionEvent | ContextEvent | ModelContextEvent | BeforeProviderRequestEvent`,
  },
  {
    name: "context result refs and model result",
    supersededBy: "projectionIdentity?: string;",
    before: `export interface ContextEventResult {
    messages?: AgentMessage[];
}
export type BeforeProviderRequestEventResult = unknown;`,
    after: `export interface ContextEventResult {
    messages?: AgentMessage[];
    entryRefs?: ContextEntryRef[];
}
export interface ModelContextEventResult {
    messages?: Message[];
    entryRefs?: ContextEntryRef[];
}
export type BeforeProviderRequestEventResult = unknown;`,
  },
  {
    name: "model context extension handler overload",
    before: `    on(event: "context", handler: ExtensionHandler<ContextEvent, ContextEventResult>): void;
    on(event: "before_provider_request", handler: ExtensionHandler<BeforeProviderRequestEvent, BeforeProviderRequestEventResult>): void;`,
    after: `    on(event: "context", handler: ExtensionHandler<ContextEvent, ContextEventResult>): void;
    on(event: "model_context", handler: ExtensionHandler<ModelContextEvent, ModelContextEventResult>): void;
    on(event: "before_provider_request", handler: ExtensionHandler<BeforeProviderRequestEvent, BeforeProviderRequestEventResult>): void;`,
  },
]);

applyPatches("dist/core/extensions/runner.d.ts", [
  {
    name: "runner model message type import",
    before: `import type { ImageContent } from "@earendil-works/pi-ai";`,
    after: `import type { ImageContent, Message } from "@earendil-works/pi-ai";`,
  },
  {
    name: "runner model context dedicated import",
    before: `ContextEvent, Extension,`,
    after: `ContextEntryRef, ContextEvent, ContextPurpose, Extension,`,
  },
  {
    name: "exclude model context from generic runner emit",
    before: `UserBashEvent | ContextEvent | BeforeProviderRequestEvent`,
    after: `UserBashEvent | ContextEvent | ModelContextEvent | BeforeProviderRequestEvent`,
  },
  {
    name: "runner model context import",
    before: `MessageEndEvent, MessageRenderer,`,
    after: `MessageEndEvent, MessageRenderer, ModelContextEvent,`,
  },
  {
    name: "purpose-aware projection runner declarations",
    supersededBy: "projectionIdentity?: string;",
    before: `    emitContext(messages: AgentMessage[]): Promise<AgentMessage[]>;`,
    after: `    emitContext(messages: AgentMessage[], purpose?: ContextPurpose, entryRefs?: ContextEntryRef[]): Promise<AgentMessage[]>;
    projectContext(messages: AgentMessage[], purpose: ContextPurpose, entryRefs?: ContextEntryRef[], transformModelMessages?: (messages: Message[]) => Message[] | Promise<Message[]>): Promise<{
        messages: Message[];
        entryRefs?: ContextEntryRef[];
    }>;`,
  },
]);

applyPatches("dist/core/extensions/index.d.ts", [
  {
    name: "context projection public exports",
    before: `ContextEvent, ContextEventResult, ContextUsage,`,
    after: `ContextEntryRef, ContextEvent, ContextEventResult, ContextPurpose, ContextUsage, ModelContextEvent, ModelContextEventResult,`,
  },
]);

applyPatches("dist/index.d.ts", [
  {
    name: "root context projection public exports",
    before: `ContextEvent, ContextUsage,`,
    after: `ContextEntryRef, ContextEvent, ContextEventResult, ContextPurpose, ContextUsage, ModelContextEvent, ModelContextEventResult,`,
  },
]);

applyPatches("dist/core/agent-session.js", [
  {
    name: "projected threshold token estimator import",
    before: `compact, estimateContextTokens, generateBranchSummary,`,
    after: `compact, estimateContextTokens, estimateTokens, generateBranchSummary,`,
  },
  {
    name: "projected threshold context tokens",
    supersededBy: '_projectContext("budget", messages',
    before: `    _getThresholdContextTokens(assistantMessage, compactionTimestamp) {
        const messages = this.agent.state.messages;
        const estimate = estimateContextTokens(messages);
        if (estimate.lastUsageIndex !== null) {
            // Verify the usage source is post-compaction. Kept pre-compaction messages
            // have stale usage reflecting the old (larger) context and would falsely
            // trigger compaction right after one just finished.
            const usageMsg = messages[estimate.lastUsageIndex];
            if (compactionTimestamp !== undefined &&
                usageMsg.role === "assistant" &&
                usageMsg.timestamp <= compactionTimestamp) {
                return undefined;
            }
            return estimate.tokens;
        }
        if (assistantMessage.stopReason === "error")
            return undefined;
        return calculateContextTokens(assistantMessage.usage);
    }`,
    after: `    async _getThresholdContextTokens(assistantMessage, compactionTimestamp) {
        const messages = this.agent.state.messages;
        const estimate = estimateContextTokens(messages);
        if (estimate.lastUsageIndex !== null) {
            // Verify the usage source is post-compaction. Kept pre-compaction messages
            // have stale usage reflecting the old (larger) context and would falsely
            // trigger compaction right after one just finished.
            const usageMsg = messages[estimate.lastUsageIndex];
            if (compactionTimestamp !== undefined &&
                usageMsg.role === "assistant" &&
                usageMsg.timestamp <= compactionTimestamp) {
                return undefined;
            }
        }
        if (assistantMessage.stopReason === "error")
            return undefined;
        const projected = await this._projectContext("compaction", messages, this.sessionManager.getContextEntryRefs(messages));
        return projected.messages.reduce((total, message) => total + estimateTokens(message), 0);
    }`,
  },
  {
    name: "await projected pre-prompt threshold tokens",
    before: `        const contextTokens = this._getThresholdContextTokens(context.message, compactionTimestamp);
        if (contextTokens === undefined || !shouldCompact(contextTokens, contextWindow, settings)) {`,
    after: `        const contextTokens = await this._getThresholdContextTokens(context.message, compactionTimestamp);
        if (contextTokens === undefined || !shouldCompact(contextTokens, contextWindow, settings)) {`,
  },
  {
    name: "await projected post-tool threshold tokens",
    before: `        const contextTokens = this._getThresholdContextTokens(assistantMessage, compactionTimestamp);
        if (contextTokens === undefined)
            return false;`,
    after: `        const contextTokens = await this._getThresholdContextTokens(assistantMessage, compactionTimestamp);
        if (contextTokens === undefined)
            return false;`,
  },
  {
    name: "session context pure builder import",
    before: `import { CURRENT_SESSION_VERSION, getLatestCompactionEntry, SessionManager, } from "./session-manager.js";`,
    after: `import { buildSessionContext as buildRawSessionContext, CURRENT_SESSION_VERSION, getLatestCompactionEntry, SessionManager, } from "./session-manager.js";`,
  },
  {
    name: "bind autonomous custom message entry ref",
    before: `        this.agent.state.messages.push(message);
        this.sessionManager.appendCustomMessageEntry(message.customType, message.content, message.display, message.details);
        this._emit({ type: "message_start", message });`,
    after: `        this.agent.state.messages.push(message);
        this.sessionManager.appendCustomMessageEntry(message.customType, message.content, message.display, message.details, message);
        this._emit({ type: "message_start", message });`,
  },
  {
    name: "bind event custom message entry ref",
    before: `                this.sessionManager.appendCustomMessageEntry(event.message.customType, event.message.content, event.message.display, event.message.details);`,
    after: `                this.sessionManager.appendCustomMessageEntry(event.message.customType, event.message.content, event.message.display, event.message.details, event.message);`,
  },
  {
    name: "bind durable slash command entry ref",
    before: `        this.sessionManager.appendCustomMessageEntryWithRollback(message.customType, message.content, message.display, message.details);
        this.agent.state.messages.push(message);`,
    after: `        this.sessionManager.appendCustomMessageEntryWithRollback(message.customType, message.content, message.display, message.details, message);
        this.agent.state.messages.push(message);`,
  },
  {
    name: "bind direct custom application message entry ref",
    before: `            this.sessionManager.appendCustomMessageEntry(message.customType, message.content, message.display, message.details);
            this._emit({ type: "message_start", message: appMessage });`,
    after: `            this.sessionManager.appendCustomMessageEntry(message.customType, message.content, message.display, message.details, appMessage);
            this._emit({ type: "message_start", message: appMessage });`,
  },
  {
    name: "bind ipython state custom message entry ref",
    before: `        this.sessionManager.appendCustomMessageEntry(message.customType, message.content, message.display, undefined);`,
    after: `        this.sessionManager.appendCustomMessageEntry(message.customType, message.content, message.display, undefined, message);`,
  },
  {
    name: "bind refinement outcome custom message entry ref",
    before: `            this.sessionManager.appendCustomMessageEntryWithRollback(message.customType, message.content, message.display, message.details);
        }
        catch {
            // Not in the session file, so context rebuilds would drop the outcome.`,
    after: `            this.sessionManager.appendCustomMessageEntryWithRollback(message.customType, message.content, message.display, message.details, message);
        }
        catch {
            // Not in the session file, so context rebuilds would drop the outcome.`,
  },
  {
    name: "bind compaction outcome custom message entry ref",
    before: `            this.sessionManager.appendCustomMessageEntryWithRollback(outcomeMessage.customType, outcomeMessage.content, outcomeMessage.display, outcomeMessage.details);`,
    after: `            this.sessionManager.appendCustomMessageEntryWithRollback(outcomeMessage.customType, outcomeMessage.content, outcomeMessage.display, outcomeMessage.details, outcomeMessage);`,
  },
  {
    name: "shared projection helper",
    before: `    buildSessionContext() {
        const context = this.sessionManager.buildSessionContext();`,
    after: `    async _projectContext(purpose, messages, entryRefs) {
        return this._extensionRunner.projectContext(messages, purpose, entryRefs);
    }
    async _snapshotRefineContext() {
        const messages = this.agent.state.messages;
        return this._projectContext("refine", messages, this.sessionManager.getContextEntryRefs(messages));
    }
    buildSessionContext() {
        const context = this.sessionManager.buildSessionContext();`,
  },
  {
    name: "exact refs after unpersisted outcome merge",
    before: `        this._mergeUnpersistedOutcomes(context.messages);
        return context;`,
    after: `        this._mergeUnpersistedOutcomes(context.messages);
        context.entryRefs = this.sessionManager.getContextEntryRefs(context.messages);
        return context;`,
  },
  {
    name: "compaction scheduling avoids unprojected preparation",
    before: `                const preparation = prepareCompaction(this.sessionManager.getBranch(), this.settingsManager.getCompactionSettings());
                if (!preparation) {
                    const lastEntry = this.sessionManager.getBranch().at(-1);`,
    after: `                const branch = this.sessionManager.getBranch();
                const lastEntry = branch.at(-1);
                const conversationEntries = branch.filter((entry) => (entry.type === "message" && entry.message.role !== "toolResult") || entry.type === "custom_message" || entry.type === "branch_summary");
                if (lastEntry?.type === "compaction" || conversationEntries.length < 2) {`,
  },
  {
    name: "project before default compaction preparation",
    before: `        const pathEntries = this.sessionManager.getBranch();
        const settings = this.settingsManager.getCompactionSettings();
        const preparation = prepareCompaction(pathEntries, settings);`,
    after: `        const pathEntries = this.sessionManager.getBranch();
        const settings = this.settingsManager.getCompactionSettings();
        const rawContext = this.sessionManager.buildSessionContext();
        const projected = await this._projectContext("compaction", rawContext.messages, rawContext.entryRefs);
        const preparation = prepareCompaction(pathEntries, settings, projected);`,
  },
  {
    name: "tree branch context projected before late hook",
    before: `        this._branchSummaryAbortController = new AbortController();
        let resolveBranchSummaryOperation = () => { };`,
    after: `        this._branchSummaryAbortController = new AbortController();
        let projectedBranch;
        if (options.summarize && entriesToSummarize.length > 0) {
            const lastEntryId = entriesToSummarize.at(-1)?.id;
            const byId = new Map(entriesToSummarize.map((entry) => [entry.id, entry]));
            const rawBranch = buildRawSessionContext(entriesToSummarize, lastEntryId, byId);
            projectedBranch = await this._projectContext("branch-summary", rawBranch.messages, rawBranch.entryRefs);
        }
        let resolveBranchSummaryOperation = () => { };`,
  },
  {
    name: "default tree summary receives projected branch",
    before: `                    reserveTokens: branchSummarySettings.reserveTokens,
                });`,
    after: `                    reserveTokens: branchSummarySettings.reserveTokens,
                    projected: projectedBranch,
                });`,
  },
  {
    name: "interactive auto refine snapshot shared with review",
    before: `        let approvedReview;
        try {
            const review = await this._reviewAutoRefine({ reason, turnsSinceLastReview }, reviewAbort.signal);`,
    after: `        let approvedReview;
        let approvedRefineMessages;
        try {
            const refineSnapshot = await this._snapshotRefineContext();
            const review = await this._reviewAutoRefine({ reason, turnsSinceLastReview }, reviewAbort.signal, refineSnapshot.messages);`,
  },
  {
    name: "pending auto refine retains shared projection snapshot",
    before: `                this._pendingAutoRefineReview = { reason, review };`,
    after: `                this._pendingAutoRefineReview = { reason, review, refineMessages: refineSnapshot.messages };`,
  },
  {
    name: "approved auto refine retains shared projection snapshot",
    before: `            approvedReview = review;`,
    after: `            approvedReview = review;
            approvedRefineMessages = refineSnapshot.messages;`,
  },
  {
    name: "approved auto refine uses shared projection snapshot",
    before: `            await this._runApprovedRefine(reason, approvedReview);`,
    after: `            await this._runApprovedRefine(reason, approvedReview, approvedRefineMessages);`,
  },
  {
    name: "pending approved auto refine uses saved projection",
    before: `            await this._runApprovedRefine(pendingReview.reason, pendingReview.review);`,
    after: `            await this._runApprovedRefine(pendingReview.reason, pendingReview.review, pendingReview.refineMessages);`,
  },
  {
    name: "approved refine passes projected snapshot",
    before: `    async _runApprovedRefine(reason, review) {
        this._autoRefineInProgress = true;
        try {
            await this.refine({ instructions: autoRefineInstructions(reason, review) }, { trigger: "auto" });`,
    after: `    async _runApprovedRefine(reason, review, refineMessages) {
        this._autoRefineInProgress = true;
        try {
            await this.refine({ instructions: autoRefineInstructions(reason, review) }, { trigger: "auto", refineMessages });`,
  },
  {
    name: "auto refine reviewer accepts projected messages",
    before: `    async _reviewAutoRefine(context, signal) {`,
    after: `    async _reviewAutoRefine(context, signal, refineMessages) {`,
  },
  {
    name: "auto refine reviewer projects by default",
    before: `        const { apiKey, headers } = await this._getRequiredRequestAuth(model);
        return reviewAutoRefine(this.agent.state.messages, this._loadMergedHarnessState(),`,
    after: `        const { apiKey, headers } = await this._getRequiredRequestAuth(model);
        const messages = refineMessages ?? (await this._snapshotRefineContext()).messages;
        return reviewAutoRefine(messages, this._loadMergedHarnessState(),`,
  },
  {
    name: "manual refine passes optional projection snapshot",
    before: `        const planRun = this._planRefine(options, refineAbort.signal, internal.trigger ?? "manual");`,
    after: `        const planRun = this._planRefine(options, refineAbort.signal, internal.trigger ?? "manual", internal.refineMessages);`,
  },
  {
    name: "refine planner accepts projected messages",
    before: `    async _planRefine(options, signal, trigger = "manual") {`,
    after: `    async _planRefine(options, signal, trigger = "manual", refineMessages) {`,
  },
  {
    name: "refine planner snapshots projected input once",
    before: `        const history = this._loadRefinementHistory();
        const rollbackTarget = options.rollbackId ? history.find((item) => item.id === options.rollbackId) : undefined;`,
    after: `        const history = this._loadRefinementHistory();
        const messages = refineMessages ?? (await this._snapshotRefineContext()).messages;
        const rollbackTarget = options.rollbackId ? history.find((item) => item.id === options.rollbackId) : undefined;`,
  },
  {
    name: "refine hook serializes projected snapshot",
    before: `                    conversationText: serializeConversation(convertToLlm(this.agent.state.messages)).slice(-80_000),`,
    after: `                    conversationText: serializeConversation(convertToLlm(messages)).slice(-80_000),`,
  },
  {
    name: "refine planner consumes projected snapshot",
    before: `        const plan = await planRefinement(this.agent.state.messages, planningState, history, model, apiKey, options, headers, signal, this.thinkingLevel);`,
    after: `        const plan = await planRefinement(messages, planningState, history, model, apiKey, options, headers, signal, this.thinkingLevel);`,
  },
  {
    name: "background auto refine snapshots once",
    before: `        try {
            let planOptions = options;
            if (!skipReview) {`,
    after: `        try {
            const refineSnapshot = await this._snapshotRefineContext();
            let planOptions = options;
            if (!skipReview) {`,
  },
  {
    name: "background auto refine review uses shared projection",
    before: `                }, refineAbort.signal);`,
    after: `                }, refineAbort.signal, refineSnapshot.messages);`,
  },
  {
    name: "background auto refine plan uses shared projection",
    before: `            const plan = await this._planRefine(planOptions, refineAbort.signal, skipReview ? "manual" : "auto");`,
    after: `            const plan = await this._planRefine(planOptions, refineAbort.signal, skipReview ? "manual" : "auto", refineSnapshot.messages);`,
  },
  {
    name: "serialized auto refine snapshots once",
    before: `        try {
            const review = await this._reviewAutoRefine({ reason, turnsSinceLastReview: this._assistantTurnsSinceAutoRefine }, reviewAbort.signal);`,
    after: `        try {
            const refineSnapshot = await this._snapshotRefineContext();
            const review = await this._reviewAutoRefine({ reason, turnsSinceLastReview: this._assistantTurnsSinceAutoRefine }, reviewAbort.signal, refineSnapshot.messages);`,
  },
  {
    name: "serialized auto refine plan shares projection",
    before: `            await this._runSerializedRefine({ instructions: autoRefineInstructions(reason, review) }, "auto");`,
    after: `            await this._runSerializedRefine({ instructions: autoRefineInstructions(reason, review) }, "auto", refineSnapshot.messages);`,
  },
  {
    name: "serialized refine accepts projected snapshot",
    before: `    async _runSerializedRefine(options, trigger = "manual") {`,
    after: `    async _runSerializedRefine(options, trigger = "manual", refineMessages) {`,
  },
  {
    name: "serialized refine planner uses projected snapshot",
    before: `        const planRun = this._planRefine(options, refineAbort.signal, trigger);`,
    after: `        const planRun = this._planRefine(options, refineAbort.signal, trigger, refineMessages);`,
  },
]);

let activeBundledCliFiles;
applyPatches("dist/core/extensions/index.d.ts", [
  {
    name: "extension finalized exchange export",
    before: "TreePreparation, TurnEndEvent,",
    after: "TreePreparation, FinalizedToolExchange, TurnEndEvent,",
  },
]);

applyPatches("dist/index.d.ts", [
  {
    name: "root finalized exchange export",
    before: "ToolResultEvent, TurnEndEvent,",
    after: "ToolResultEvent, FinalizedToolExchange, TurnEndEvent,",
  },
]);

applyPatches("dist/core/extensions/index.d.ts", [
  {
    name: "extension user bash end export",
    before: "UserBashEvent, UserBashEventResult,",
    after: "UserBashEvent, UserBashEndEvent, UserBashEventResult,",
  },
]);
applyPatches("dist/index.d.ts", [
  {
    name: "root user bash end export",
    before: "UserBashEvent, UserBashEventResult,",
    after: "UserBashEvent, UserBashEndEvent, UserBashEventResult,",
  },
]);

applyPatches("dist/core/messages.js", [
  {
    name: "avoid full converted message clone",
    before: `        messages: structuredClone(convertedMessages),`,
    after: `        messages: convertedMessages,`,
  },
]);

applyPatches("dist/core/extensions/runner.js", [
  {
    name: "conservative extension entry ref invalidation",
    before: `                    if (handlerResult.messages !== undefined) {
                        const previousCount = currentMessages.length;
                        currentMessages = handlerResult.messages;
                        if (handlerResult.entryRefs !== undefined) {
                            currentEntryRefs = handlerResult.entryRefs;
                        }
                        else if (currentMessages.length !== previousCount) {
                            currentEntryRefs = undefined;
                        }
                    }`,
    after: `                    if (handlerResult.messages !== undefined) {
                        const previousMessages = currentMessages;
                        currentMessages = handlerResult.messages;
                        if (handlerResult.entryRefs !== undefined) {
                            currentEntryRefs = handlerResult.entryRefs;
                        }
                        else if (currentMessages !== previousMessages) {
                            currentEntryRefs = undefined;
                        }
                    }`,
  },
  {
    name: "conservative host transform entry ref invalidation",
    before: `            const previousCount = model.messages.length;
            const transformedMessages = await transformModelMessages(model.messages);
            model = {
                messages: transformedMessages,
                entryRefs: transformedMessages.length === previousCount ? model.entryRefs : undefined,
            };`,
    after: `            const previousMessages = model.messages;
            const transformedMessages = await transformModelMessages(previousMessages);
            model = {
                messages: transformedMessages,
                entryRefs: transformedMessages === previousMessages ? model.entryRefs : undefined,
            };`,
  },
]);

applyPatches("dist/core/extensions/types.d.ts", [
  {
    name: "provider context estimate fields",
    supersededBy: "projectedMessageCount?: number;",
    before: `    /** Context usage as percentage of context window, or null if tokens is unknown. */
    percent: number | null;
}`,
    after: `    /** Context usage as percentage of context window, or null if tokens is unknown. */
    percent: number | null;
    /** Provider-bound projected message tokens in the cached next-request estimate. */
    messageTokens?: number;
    /** Effective system-prompt tokens in the cached next-request estimate. */
    systemTokens?: number;
    /** Active tool-definition tokens in the cached next-request estimate. */
    toolTokens?: number;
    /** Sum of message, system, and tool tokens. */
    totalTokens?: number;
    projectedMessageCount?: number;
}`,
  },
  {
    name: "budget context purpose declaration",
    before: `export type ContextPurpose = "provider" | "compaction" | "branch-summary" | "refine";`,
    after: `export type ContextPurpose = "provider" | "budget" | "compaction" | "branch-summary" | "refine";`,
  },
  {
    name: "readonly model context contract",
    before: `    messages: Message[];
    entryRefs?: ContextEntryRef[];
}`,
    after: `    messages: readonly Message[];
    entryRefs?: readonly ContextEntryRef[];
}`,
  },
]);

applyPatches("dist/core/agent-session.js", [
  {
    name: "budget purpose for provider-bound threshold estimate",
    supersededBy: `_projectContext("budget", messages,`,
    before: `        const projected = await this._projectContext("compaction", messages, this.sessionManager.getContextEntryRefs(messages));`,
    after: `        const projected = await this._projectContext("budget", messages, this.sessionManager.getContextEntryRefs(messages));`,
  },
  {
    name: "complete provider-bound threshold estimate",
    supersededBy: "this._providerContextEstimate = {",
    before: `        const projected = await this._projectContext("budget", messages, this.sessionManager.getContextEntryRefs(messages));
        return projected.messages.reduce((total, message) => total + estimateTokens(message), 0);`,
    after: `        const projected = await this._projectContext("budget", messages, this.sessionManager.getContextEntryRefs(messages));
        const messageTokens = projected.messages.reduce((total, message) => total + estimateTokens(message), 0);
        const systemPrompt = this.agent.state.systemPrompt ?? "";
        const tools = this.agent.state.tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
        const toolSignature = JSON.stringify(tools);
        const systemTokens = Math.ceil(systemPrompt.length / 4);
        const toolTokens = Math.ceil(toolSignature.length / 4);
        const totalTokens = systemTokens + toolTokens + messageTokens;
        this._providerContextEstimate = {
            messageTokens,
            systemTokens,
            toolTokens,
            totalTokens,
            projectedMessageCount: projected.messages.length,
            sourceMessageCount: messages.length,
            sourceLastMessage: messages.at(-1),
            systemPrompt,
            toolSignature,
        };
        return totalTokens;`,
  },
  {
    name: "same-epoch provider usage anchor",
    supersededBy: "usageAnchored = false;",
    before: `        const projected = await this._projectContext("budget", messages, this.sessionManager.getContextEntryRefs(messages));
        const messageTokens = projected.messages.reduce((total, message) => total + estimateTokens(message), 0);
        const systemPrompt = this.agent.state.systemPrompt ?? "";
        const tools = this.agent.state.tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
        const toolSignature = JSON.stringify(tools);
        const systemTokens = Math.ceil(systemPrompt.length / 4);
        const toolTokens = Math.ceil(toolSignature.length / 4);
        const totalTokens = systemTokens + toolTokens + messageTokens;
        this._providerContextEstimate = {
            messageTokens,
            systemTokens,
            toolTokens,
            totalTokens,
            projectedMessageCount: projected.messages.length,
            sourceMessageCount: messages.length,
            sourceLastMessage: messages.at(-1),
            systemPrompt,
            toolSignature,
        };
        return totalTokens;`,
    after: `        const sourceEntryRefs = this.sessionManager.getContextEntryRefs(messages);
        const projected = await this._projectContext("budget", messages, sourceEntryRefs);
        const fullMessageTokens = projected.messages.reduce((total, message) => total + estimateTokens(message), 0);
        const systemPrompt = this.agent.state.systemPrompt ?? "";
        const tools = this.agent.state.tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
        const toolSignature = JSON.stringify(tools);
        const systemTokens = Math.ceil(systemPrompt.length / 4);
        const toolTokens = Math.ceil(toolSignature.length / 4);
        let messageTokens = fullMessageTokens;
        let totalTokens = systemTokens + toolTokens + messageTokens;
        let usageAnchored = false;
        const usageAnchorMessage = estimate.lastUsageIndex === null ? undefined : messages[estimate.lastUsageIndex];
        const usageAnchor = usageAnchorMessage?.role === "assistant" ? usageAnchorMessage.usage : undefined;
        const previousPromptTokens = usageAnchor
            ? Math.max(0, usageAnchor.input ?? 0) + Math.max(0, usageAnchor.cacheRead ?? 0) + Math.max(0, usageAnchor.cacheWrite ?? 0)
            : 0;
        const previousEstimate = this._providerContextEstimate;
        if (estimate.lastUsageIndex !== null && previousPromptTokens > 0 &&
            previousEstimate?.systemPrompt === systemPrompt && previousEstimate.toolSignature === toolSignature) {
            const anchorEntryId = sourceEntryRefs.find((ref) => ref.messageIndex === estimate.lastUsageIndex)?.entryId;
            const projectedAnchorIndex = anchorEntryId === undefined
                ? undefined
                : projected.entryRefs?.find((ref) => ref.entryId === anchorEntryId)?.messageIndex;
            if (projectedAnchorIndex !== undefined) {
                const suffixTokens = projected.messages.slice(projectedAnchorIndex + 1)
                    .reduce((total, message) => total + estimateTokens(message), 0);
                totalTokens = previousPromptTokens + suffixTokens;
                messageTokens = Math.max(0, totalTokens - systemTokens - toolTokens);
                usageAnchored = true;
            }
        }
        this._providerContextEstimate = {
            messageTokens,
            systemTokens,
            toolTokens,
            totalTokens,
            projectedMessageCount: projected.messages.length,
            sourceMessageCount: messages.length,
            sourceLastMessage: messages.at(-1),
            systemPrompt,
            toolSignature,
            usageAnchored,
        };
        return totalTokens;`,
  },
  {
    name: "provider prompt usage excludes billed output",
    supersededBy: "const previousPromptTokens = usageAnchor",
    before: `        const sourceEntryRefs = this.sessionManager.getContextEntryRefs(messages);
        const projected = await this._projectContext("budget", messages, sourceEntryRefs);
        const fullMessageTokens = projected.messages.reduce((total, message) => total + estimateTokens(message), 0);
        const systemPrompt = this.agent.state.systemPrompt ?? "";
        const tools = this.agent.state.tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
        const toolSignature = JSON.stringify(tools);
        const systemTokens = Math.ceil(systemPrompt.length / 4);
        const toolTokens = Math.ceil(toolSignature.length / 4);
        let messageTokens = fullMessageTokens;
        let totalTokens = systemTokens + toolTokens + messageTokens;
        let usageAnchored = false;
        const previousEstimate = this._providerContextEstimate;
        if (estimate.lastUsageIndex !== null && estimate.usageTokens > 0 &&
            previousEstimate?.systemPrompt === systemPrompt && previousEstimate.toolSignature === toolSignature) {
            const anchorEntryId = sourceEntryRefs.find((ref) => ref.messageIndex === estimate.lastUsageIndex)?.entryId;
            const projectedAnchorIndex = anchorEntryId === undefined
                ? undefined
                : projected.entryRefs?.find((ref) => ref.entryId === anchorEntryId)?.messageIndex;
            if (projectedAnchorIndex !== undefined) {
                const suffixTokens = projected.messages.slice(projectedAnchorIndex + 1)
                    .reduce((total, message) => total + estimateTokens(message), 0);
                totalTokens = estimate.usageTokens + suffixTokens;
                messageTokens = Math.max(0, totalTokens - systemTokens - toolTokens);
                usageAnchored = true;
            }
        }
        this._providerContextEstimate = {
            messageTokens,
            systemTokens,
            toolTokens,
            totalTokens,
            projectedMessageCount: projected.messages.length,
            sourceMessageCount: messages.length,
            sourceLastMessage: messages.at(-1),
            systemPrompt,
            toolSignature,
            usageAnchored,
        };
        return totalTokens;`,
    after: `        const sourceEntryRefs = this.sessionManager.getContextEntryRefs(messages);
        const projected = await this._projectContext("budget", messages, sourceEntryRefs);
        const fullMessageTokens = projected.messages.reduce((total, message) => total + estimateTokens(message), 0);
        const systemPrompt = this.agent.state.systemPrompt ?? "";
        const tools = this.agent.state.tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
        const toolSignature = JSON.stringify(tools);
        const systemTokens = Math.ceil(systemPrompt.length / 4);
        const toolTokens = Math.ceil(toolSignature.length / 4);
        let messageTokens = fullMessageTokens;
        let totalTokens = systemTokens + toolTokens + messageTokens;
        let usageAnchored = false;
        const usageAnchorMessage = estimate.lastUsageIndex === null ? undefined : messages[estimate.lastUsageIndex];
        const usageAnchor = usageAnchorMessage?.role === "assistant" ? usageAnchorMessage.usage : undefined;
        const previousPromptTokens = usageAnchor
            ? Math.max(0, usageAnchor.input ?? 0) + Math.max(0, usageAnchor.cacheRead ?? 0) + Math.max(0, usageAnchor.cacheWrite ?? 0)
            : 0;
        const previousEstimate = this._providerContextEstimate;
        if (estimate.lastUsageIndex !== null && previousPromptTokens > 0 &&
            previousEstimate?.systemPrompt === systemPrompt && previousEstimate.toolSignature === toolSignature) {
            const anchorEntryId = sourceEntryRefs.find((ref) => ref.messageIndex === estimate.lastUsageIndex)?.entryId;
            const projectedAnchorIndex = anchorEntryId === undefined
                ? undefined
                : projected.entryRefs?.find((ref) => ref.entryId === anchorEntryId)?.messageIndex;
            if (projectedAnchorIndex !== undefined) {
                const suffixTokens = projected.messages.slice(projectedAnchorIndex + 1)
                    .reduce((total, message) => total + estimateTokens(message), 0);
                totalTokens = previousPromptTokens + suffixTokens;
                messageTokens = Math.max(0, totalTokens - systemTokens - toolTokens);
                usageAnchored = true;
            }
        }
        this._providerContextEstimate = {
            messageTokens,
            systemTokens,
            toolTokens,
            totalTokens,
            projectedMessageCount: projected.messages.length,
            sourceMessageCount: messages.length,
            sourceLastMessage: messages.at(-1),
            systemPrompt,
            toolSignature,
            usageAnchored,
        };
        return totalTokens;`,
  },
  {
    name: "synchronous cached provider context usage",
    supersededBy: "const providerEstimate = this._providerContextEstimate;",
    before: `        // After compaction, the last assistant usage reflects pre-compaction context size.
        // We can only trust usage from an assistant that responded after the latest compaction.
        // If no such assistant exists, context token count is unknown until the next LLM response.
        const branchEntries = this.sessionManager.getBranch();
        const latestCompaction = getLatestCompactionEntry(branchEntries);
        if (latestCompaction) {
            // Check if there's a valid assistant usage after the compaction boundary
            const compactionIndex = branchEntries.lastIndexOf(latestCompaction);
            let hasPostCompactionUsage = false;
            for (let i = branchEntries.length - 1; i > compactionIndex; i--) {
                const entry = branchEntries[i];
                if (entry.type === "message" && entry.message.role === "assistant") {
                    const assistant = entry.message;
                    if (assistant.stopReason !== "aborted" && assistant.stopReason !== "error") {
                        const contextTokens = calculateContextTokens(assistant.usage);
                        if (contextTokens > 0) {
                            hasPostCompactionUsage = true;
                        }
                        break;
                    }
                }
            }
            if (!hasPostCompactionUsage) {
                return { tokens: null, contextWindow, percent: null };
            }
        }
        const estimate = estimateContextTokens(this.messages);
        const percent = (estimate.tokens / contextWindow) * 100;
        return {
            tokens: estimate.tokens,
            contextWindow,
            percent,
        };`,
    after: `        const messages = this.agent.state.messages;
        const systemPrompt = this.agent.state.systemPrompt ?? "";
        const tools = this.agent.state.tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
        const toolSignature = JSON.stringify(tools);
        const providerEstimate = this._providerContextEstimate;
        const cacheValid = providerEstimate !== undefined &&
            providerEstimate.sourceMessageCount === messages.length &&
            providerEstimate.sourceLastMessage === messages.at(-1) &&
            providerEstimate.systemPrompt === systemPrompt &&
            providerEstimate.toolSignature === toolSignature;
        const messageTokens = cacheValid
            ? providerEstimate.messageTokens
            : messages.reduce((total, message) => total + estimateTokens(message), 0);
        const systemTokens = cacheValid ? providerEstimate.systemTokens : Math.ceil(systemPrompt.length / 4);
        const toolTokens = cacheValid ? providerEstimate.toolTokens : Math.ceil(toolSignature.length / 4);
        const totalTokens = messageTokens + systemTokens + toolTokens;
        return {
            tokens: totalTokens,
            contextWindow,
            percent: (totalTokens / contextWindow) * 100,
            messageTokens,
            systemTokens,
            toolTokens,
            totalTokens,
            projectedMessageCount: cacheValid ? providerEstimate.projectedMessageCount : messages.length,
        };`,
  },
]);

function findActiveBundledCliFiles() {
  if (activeBundledCliFiles) {
    return activeBundledCliFiles;
  }
  const bundleRoot = join(root, "dist/bundle");
  const cli = readCurrentText(join(bundleRoot, "cli.js"));
  const cliMainMatch = cli.match(/import\("\.\/(cli-main-[^"/]+\.js)"\)/);
  if (!cliMainMatch) {
    throw new Error("dist/bundle/cli.js: could not find bundled CLI main import");
  }
  const pending = [cliMainMatch[1]];
  const visited = new Set();
  while (pending.length > 0) {
    const file = pending.pop();
    if (visited.has(file)) {
      continue;
    }
    visited.add(file);
    const text = readCurrentText(join(bundleRoot, file));
    for (const match of text.matchAll(/["']\.\/([^"'/]+\.js)["']/g)) {
      if (existsSync(join(bundleRoot, match[1])) && !visited.has(match[1])) {
        pending.push(match[1]);
      }
    }
  }
  activeBundledCliFiles = [...visited];
  return activeBundledCliFiles;
}

function findActiveBundledCliChunk(label, markers) {
  const bundleRoot = join(root, "dist/bundle");
  const candidates = findActiveBundledCliFiles().filter((file) => {
    const text = readCurrentText(join(bundleRoot, file));
    return markers.every((marker) => text.includes(marker));
  });
  if (candidates.length !== 1) {
    throw new Error(`dist/bundle/cli.js: expected one active ${label} chunk, found ${candidates.length}`);
  }
  return `dist/bundle/${candidates[0]}`;
}

function findBundledCliChunk() {
  return findActiveBundledCliChunk("agent runtime", [
    "async function executeToolCalls(currentContext, assistantMessage, config, signal, emit)",
    "turnIndex: this._turnIndex",
  ]);
}

function findBundledProviderChunk() {
  return findActiveBundledCliChunk("provider construction", [
    "const extensionRunnerRef = {};",
    "onPayload: async (payload, _model) =>",
    "sessionId: sessionManager.getSessionId(),",
  ]);
}

applyPatches(findBundledProviderChunk(), [
  {
    name: "bundled Agents View resume fresh worker launch environment",
    before: `    config: createAgentsViewResumeConfig(config, overrideCwd),
    sessionPath: summary.sessionFile
  });`,
    after: `    config: createAgentsViewResumeConfig(config, overrideCwd),
    sessionPath: summary.sessionFile,
    launchEnv: collectDaemonLaunchEnv()
  });`,
  },
  {
    name: "bundled daemon hello before worker adoption completes",
    before: `    void this.ready.then(() => {
      if (!client.socket.destroyed && this.clients.has(client)) {
        this.write(client, {
          type: "daemon_hello",
          socketPath: this.socketPath,
          protocol: DAEMON_PROTOCOL_INFO,
          schemaId: DAEMON_SCHEMA_ID,
          schemaRevision: DAEMON_SCHEMA_REVISION,
          appVersion: VERSION,
          runtime: getDaemonRuntimeIdentity(),
          supervisorGeneration: this.generation,
          supervisorOwnerToken: this.ownership?.record.token,
          supervisorPid: process.pid,
          supervisorProcessStartId: this.ownership?.record.processStartId,
          supervisorSocketPath: this.ownership?.record.socketPath,
          clientId: client.id,
          serverCapabilities: SUPERVISOR_SERVER_CAPABILITIES
        });
      }
    }, () => client.socket.destroy());`,
    after: `    if (!client.socket.destroyed && this.clients.has(client)) {
      this.write(client, {
        type: "daemon_hello",
        socketPath: this.socketPath,
        protocol: DAEMON_PROTOCOL_INFO,
        schemaId: DAEMON_SCHEMA_ID,
        schemaRevision: DAEMON_SCHEMA_REVISION,
        appVersion: VERSION,
        runtime: getDaemonRuntimeIdentity(),
        supervisorGeneration: this.generation,
        supervisorOwnerToken: this.ownership?.record.token,
        supervisorPid: process.pid,
        supervisorProcessStartId: this.ownership?.record.processStartId,
        supervisorSocketPath: this.ownership?.record.socketPath,
        clientId: client.id,
        serverCapabilities: SUPERVISOR_SERVER_CAPABILITIES
      });
    }`,
  },
  {
    name: "bundled session worker V8 heap sized for large persistent sessions",
    supersededBy: 'const workerHeapOption = "--max-old-space-size=16384";',
    before: `    delete workerEnvironment.RLM_DEPTH;
    await this.assertRecoveryAllowed();`,
    after: `    delete workerEnvironment.RLM_DEPTH;
    workerEnvironment.NODE_OPTIONS = [workerEnvironment.NODE_OPTIONS, "--max-old-space-size=16384"].filter(Boolean).join(" ");
    await this.assertRecoveryAllowed();`,
  },
  {
    name: "bundled session worker heap option is not duplicated",
    supersededBy: 'NODE_OPTIONS?.split(" ").includes(workerHeapOption)',
    before: `    delete workerEnvironment.RLM_DEPTH;
    workerEnvironment.NODE_OPTIONS = [workerEnvironment.NODE_OPTIONS, "--max-old-space-size=16384"].filter(Boolean).join(" ");
    await this.assertRecoveryAllowed();`,
    after: `    delete workerEnvironment.RLM_DEPTH;
    const workerHeapOption = "--max-old-space-size=16384";
    if (!workerEnvironment.NODE_OPTIONS?.split(/\s+/).includes(workerHeapOption)) {
      workerEnvironment.NODE_OPTIONS = [workerEnvironment.NODE_OPTIONS, workerHeapOption].filter(Boolean).join(" ");
    }
    await this.assertRecoveryAllowed();`,
  },
  {
    name: "bundled session worker heap option tokenization is literal-safe",
    before: `    if (!workerEnvironment.NODE_OPTIONS?.split(/s+/).includes(workerHeapOption)) {`,
    after: `    if (!workerEnvironment.NODE_OPTIONS?.split(" ").includes(workerHeapOption)) {`,
  },
]);

applyPatches(findBundledProviderChunk(), [
  {
    name: "bundled large worker attach uses long-running request timeout",
    before: `              env: command.env ?? collectDaemonClientEnv()
            });`,
    after: `              env: command.env ?? collectDaemonClientEnv()
            }, WORKER_REQUEST_TIMEOUT_MS);`,
  },
  {
    name: "bundled in-flight snapshot invalidation keeps dedupe ownership",
    before: `            if (match2.worker.snapshotLoads.get(snapshotLoadKey) !== loading) {
              throw new SnapshotLoadInvalidatedError("Session snapshot changed during attach");
            }`,
    after: `            const loadInvalidated = match2.worker.invalidatedSnapshotLoads?.delete(snapshotLoadKey) === true;
            if (match2.worker.snapshotLoads.get(snapshotLoadKey) !== loading || loadInvalidated) {
              throw new SnapshotLoadInvalidatedError("Session snapshot changed during attach");
            }`,
  },
  {
    name: "bundled snapshot invalidation marks rather than abandons active loads",
    before: `    worker.snapshotLoads.delete(\`\${activeSessionId}:chunked\`);
    worker.snapshotLoads.delete(\`\${activeSessionId}:full\`);`,
    after: `    worker.invalidatedSnapshotLoads ??= /* @__PURE__ */ new Set();
    for (const key of [\`\${activeSessionId}:chunked\`, \`\${activeSessionId}:full\`]) {
      if (worker.snapshotLoads.has(key)) worker.invalidatedSnapshotLoads.add(key);
    }`,
  },
  {
    name: "bundled completed snapshot load clears invalidation tombstone",
    before: `            } finally {
              if (match2.worker.snapshotLoads.get(snapshotLoadKey) === loading) {
                match2.worker.snapshotLoads.delete(snapshotLoadKey);
              }
            }`,
    after: `            } finally {
              match2.worker.invalidatedSnapshotLoads?.delete(snapshotLoadKey);
              if (match2.worker.snapshotLoads.get(snapshotLoadKey) === loading) {
                match2.worker.snapshotLoads.delete(snapshotLoadKey);
              }
            }`,
  },
  {
    name: "bundled failed snapshot load clears invalidation tombstone",
    before: `          }, () => {
            if (match2.worker.snapshotLoads.get(snapshotLoadKey) === loading) {
              match2.worker.snapshotLoads.delete(snapshotLoadKey);
            }
          });`,
    after: `          }, () => {
            match2.worker.invalidatedSnapshotLoads?.delete(snapshotLoadKey);
            if (match2.worker.snapshotLoads.get(snapshotLoadKey) === loading) {
              match2.worker.snapshotLoads.delete(snapshotLoadKey);
            }
          });`,
  },
  {
    name: "bundled duplicate snapshot chunks compare encoded buffers directly",
    before: `            const chunk = JSON.parse(frame.payload.toString("utf8"));
            if (chunk.type !== "session_snapshot_chunk" || chunk.activeSessionId !== activeSessionId || chunk.snapshotId !== generation.transcript.snapshotId || chunk.index !== duplicateIndex || !generation.transcript.readChunk(duplicateIndex).equals(Buffer.from(frame.payload))) {`,
    after: `            const encodedChunk = Buffer.from(frame.payload);
            if (!generation.transcript.readChunk(duplicateIndex).equals(encodedChunk)) {`,
  },
  {
    name: "bundled child passivation sweeps never evict top-level workers",
    before: `    const candidates = [...refreshed].filter((worker) => canEvictWorker(this.workerEvictionSnapshot(worker), idleEvictionMinutes, now));`,
    after: `    const candidates = [];`,
  },
  {
    name: "bundled worker child passivation keeps an in-flight tombstone",
    before: `        case "worker_passivate_idle_children": {
          const count = await this.passivateIdleChildren(command.idleEvictionMinutes, command.now, command.limit);
          this.writeWorkerSuccess(client, command, { count });
          return;
        }`,
    after: `        case "worker_passivate_idle_children": {
          let passivation = this.idleChildPassivation;
          if (!passivation) {
            passivation = this.passivateIdleChildren(command.idleEvictionMinutes, command.now, command.limit);
            this.idleChildPassivation = passivation;
            void passivation.then(() => {
              if (this.idleChildPassivation === passivation) this.idleChildPassivation = void 0;
            }, () => {
              if (this.idleChildPassivation === passivation) this.idleChildPassivation = void 0;
            });
          }
          const count = await passivation;
          this.writeWorkerSuccess(client, command, { count });
          return;
        }`,
  },
  {
    name: "bundled public attach uses long-running request timeout",
    before: `      resumeCursor: this.lastEventCursor === void 0 ? void 0 : {
        activeSessionId: this.activeSessionId,
        ...this.lastEventCursor
      }
    }, void 0, options);`,
    after: `      resumeCursor: this.lastEventCursor === void 0 ? void 0 : {
        activeSessionId: this.activeSessionId,
        ...this.lastEventCursor
      }
    }, DAEMON_LONG_RUNNING_REQUEST_TIMEOUT_MS, options);`,
  },
  {
    name: "bundled snapshot assembly timeout follows transfer progress",
    before: `  getSnapshotAssembly(snapshotId) {
    const existing = this.snapshotAssemblies.get(snapshotId);
    if (existing) {
      return existing;
    }
    let resolveSnapshot;
    let rejectSnapshot;
    const promise = new Promise((resolve19, reject) => {
      resolveSnapshot = resolve19;
      rejectSnapshot = reject;
    });
    void promise.catch(() => void 0);
    const timeout = setTimeout(() => {
      const current = this.snapshotAssemblies.get(snapshotId);
      if (current) {
        current.reject(new Error(\`Timed out waiting for snapshot \${snapshotId}\`));
        this.snapshotAssemblies.delete(snapshotId);
        this.ignoreSnapshotId(snapshotId);
      }
    }, this.options.snapshotTimeoutMs ?? DAEMON_SNAPSHOT_TIMEOUT_MS);
    timeout.unref();
    const assembly = {
      chunks: /* @__PURE__ */ new Map(),
      promise,
      resolve: resolveSnapshot,
      reject: rejectSnapshot,
      timeout
    };
    this.snapshotAssemblies.set(snapshotId, assembly);
    return assembly;
  }`,
    after: `  refreshSnapshotAssemblyTimeout(snapshotId, assembly) {
    clearTimeout(assembly.timeout);
    assembly.timeout = setTimeout(() => {
      const current = this.snapshotAssemblies.get(snapshotId);
      if (current === assembly) {
        current.reject(new Error(\`Timed out waiting for snapshot \${snapshotId}\`));
        this.snapshotAssemblies.delete(snapshotId);
        this.ignoreSnapshotId(snapshotId);
      }
    }, this.options.snapshotTimeoutMs ?? DAEMON_SNAPSHOT_TIMEOUT_MS);
    assembly.timeout.unref();
  }
  getSnapshotAssembly(snapshotId) {
    const existing = this.snapshotAssemblies.get(snapshotId);
    if (existing) {
      return existing;
    }
    let resolveSnapshot;
    let rejectSnapshot;
    const promise = new Promise((resolve19, reject) => {
      resolveSnapshot = resolve19;
      rejectSnapshot = reject;
    });
    void promise.catch(() => void 0);
    const assembly = {
      chunks: /* @__PURE__ */ new Map(),
      promise,
      resolve: resolveSnapshot,
      reject: rejectSnapshot,
      timeout: void 0
    };
    this.snapshotAssemblies.set(snapshotId, assembly);
    this.refreshSnapshotAssemblyTimeout(snapshotId, assembly);
    return assembly;
  }`,
  },
  {
    name: "bundled snapshot begin refreshes inactivity timeout",
    before: `      const assembly = this.getSnapshotAssembly(message.snapshotId);
      assembly.begin = message;
      return;`,
    after: `      const assembly = this.getSnapshotAssembly(message.snapshotId);
      assembly.begin = message;
      this.refreshSnapshotAssemblyTimeout(message.snapshotId, assembly);
      return;`,
  },
  {
    name: "bundled snapshot chunk refreshes inactivity timeout",
    before: `      this.getSnapshotAssembly(message.snapshotId).chunks.set(message.index, message.messages);
      return;`,
    after: `      const assembly = this.getSnapshotAssembly(message.snapshotId);
      assembly.chunks.set(message.index, message.messages);
      this.refreshSnapshotAssemblyTimeout(message.snapshotId, assembly);
      return;`,
  },
]);

applyPatches(findBundledCliChunk(), [
  {
    name: "bundled resident RLM child memory limit",
    supersededBy: "residentRlmChildCount >= 1",
    before: `    if (this._rlmDepth >= this._rlmMaxDepth) {
      throw new Error(\`RLM recursion depth limit reached (RLM_DEPTH=\${this._rlmDepth}, RLM_MAX_DEPTH=\${this._rlmMaxDepth})\`);
    }
    if (requestedSessionName) {`,
    after: `    if (this._rlmDepth >= this._rlmMaxDepth) {
      throw new Error(\`RLM recursion depth limit reached (RLM_DEPTH=\${this._rlmDepth}, RLM_MAX_DEPTH=\${this._rlmMaxDepth})\`);
    }
    const residentRlmChildCount = this._unsettledRlmChildRuns.size + this._rlmChildSessions.size;
    if (residentRlmChildCount >= 4) {
      throw new Error(
        \`RLM resident child limit reached (\${residentRlmChildCount}/4). Wait for idle passivation or delete a completed subagent before spawning another.\`
      );
    }
    if (requestedSessionName) {`,
  },
  {
    name: "bundled resident RLM child limit tightened for large sessions",
    before: `    const residentRlmChildCount = this._unsettledRlmChildRuns.size + this._rlmChildSessions.size;
    if (residentRlmChildCount >= 4) {
      throw new Error(
        \`RLM resident child limit reached (\${residentRlmChildCount}/4). Wait for idle passivation or delete a completed subagent before spawning another.\`
      );
    }`,
    after: `    const residentRlmChildCount = this._unsettledRlmChildRuns.size + this._rlmChildSessions.size;
    if (residentRlmChildCount >= 1) {
      throw new Error(
        \`RLM resident child limit reached (\${residentRlmChildCount}/1). Wait for idle passivation or delete the completed subagent before spawning another.\`
      );
    }`,
  },
]);

// Step G bundle parity: active CLI runtime and provider-construction chunks.
applyPatches(findBundledCliChunk(), [
  {
    name: "bundled provider-visible conversion and exact entry-ref filtering",
    supersededBy: "messages: convertedMessages,",
    before: `  }).filter((m2) => m2 !== void 0);
}

// dist/core/usage.js`,
    after: `  }).filter((m2) => m2 !== void 0);
}
function convertToLlmWithEntryRefs(messages, entryRefs) {
  const refsByIndex = new Map((entryRefs ?? []).map((ref) => [ref.messageIndex, ref.entryId]));
  const convertedMessages = [];
  const convertedRefs = [];
  for (let messageIndex = 0; messageIndex < messages.length; messageIndex++) {
    const converted = convertToLlm([messages[messageIndex]])[0];
    if (!converted)
      continue;
    let modelMessage = converted;
    if (converted.role === "toolResult" && Object.hasOwn(converted, "details")) {
      const { details: _details, ...providerVisible } = converted;
      modelMessage = providerVisible;
    }
    const projectedIndex = convertedMessages.length;
    convertedMessages.push(modelMessage);
    const entryId = refsByIndex.get(messageIndex);
    if (entryId !== void 0) {
      convertedRefs.push({ messageIndex: projectedIndex, entryId });
    }
  }
  return {
    messages: structuredClone(convertedMessages),
    entryRefs: entryRefs === void 0 ? void 0 : convertedRefs
  };
}

// dist/core/usage.js`,
  },
  {
    name: "bundled null-leaf context entry refs",
    before: `  if (leafId === null) {
    return { messages: [], thinkingLevel: "off", serviceTier: "default", model: null };
  }`,
    after: `  if (leafId === null) {
    return { messages: [], entryRefs: [], thinkingLevel: "off", serviceTier: "default", model: null };
  }`,
  },
  {
    name: "bundled empty context entry refs",
    before: `  if (!leaf) {
    return { messages: [], thinkingLevel: "off", serviceTier: "default", model: null };
  }`,
    after: `  if (!leaf) {
    return { messages: [], entryRefs: [], thinkingLevel: "off", serviceTier: "default", model: null };
  }`,
  },
  {
    name: "bundled session context message construction entry ids",
    before: `  const messages = [];
  const appendMessage = (entry, target = messages) => {
    if (entry.type === "message") {
      target.push(entry.message);
    } else if (entry.type === "custom_message") {
      target.push(createCustomMessage(entry.customType, entry.content, entry.display, entry.details, entry.timestamp));
    } else if (entry.type === "branch_summary" && entry.summary) {
      target.push(createBranchSummaryMessage(entry.summary, entry.fromId, entry.timestamp));
    }
  };`,
    after: `  const messages = [];
  const entryIds = [];
  const appendMessage = (entry, target = messages, targetEntryIds = entryIds) => {
    let message;
    if (entry.type === "message") {
      message = entry.message;
    } else if (entry.type === "custom_message") {
      message = createCustomMessage(entry.customType, entry.content, entry.display, entry.details, entry.timestamp);
    } else if (entry.type === "branch_summary" && entry.summary) {
      message = createBranchSummaryMessage(entry.summary, entry.fromId, entry.timestamp);
    }
    if (message) {
      target.push(message);
      targetEntryIds.push(entry.id);
    }
  };`,
  },
  {
    name: "bundled retained context entry ids",
    before: `    const retainedMessages = [];
    let foundFirstKept = false;`,
    after: `    const retainedMessages = [];
    const retainedEntryIds = [];
    let foundFirstKept = false;`,
  },
  {
    name: "bundled retained message entry refs",
    before: `        appendMessage(entry, retainedMessages);`,
    after: `        appendMessage(entry, retainedMessages, retainedEntryIds);`,
  },
  {
    name: "bundled compaction summary and retained entry ids",
    before: `    messages.push(createCompactionSummaryMessage(compaction.summary, compaction.tokensBefore, compaction.timestamp, compaction.customInstructions, retainedMessages.length), ...retainedMessages);`,
    after: `    messages.push(createCompactionSummaryMessage(compaction.summary, compaction.tokensBefore, compaction.timestamp, compaction.customInstructions, retainedMessages.length), ...retainedMessages);
    entryIds.push(compaction.id, ...retainedEntryIds);`,
  },
  {
    name: "bundled session context returned entry refs",
    before: `  return { messages, thinkingLevel, serviceTier, model };
}
function getDefaultSessionDir`,
    after: `  return {
    messages,
    entryRefs: entryIds.map((entryId, messageIndex) => ({ messageIndex, entryId })),
    thinkingLevel,
    serviceTier,
    model
  };
}
function getDefaultSessionDir`,
  },
  {
    name: "bundled session message identity map",
    before: `  persistListeners = /* @__PURE__ */ new Set();
  constructor(cwd, sessionDir, sessionFile, persist, preloadedEntries) {`,
    after: `  persistListeners = /* @__PURE__ */ new Set();
  _entryIdsByMessage = /* @__PURE__ */ new WeakMap();
  constructor(cwd, sessionDir, sessionFile, persist, preloadedEntries) {`,
  },
  {
    name: "bundled bind appended raw messages",
    before: `    this._appendEntry(entry);
    return entry.id;
  }
  appendThinkingLevelChange(thinkingLevel) {`,
    after: `    this._appendEntry(entry);
    this.bindMessageEntry(message, entry.id);
    return entry.id;
  }
  bindMessageEntry(message, entryId) {
    if (message !== null && typeof message === "object") {
      this._entryIdsByMessage.set(message, entryId);
    }
  }
  getContextEntryRefs(messages) {
    const entryRefs = [];
    for (let messageIndex = 0; messageIndex < messages.length; messageIndex++) {
      const entryId = this._entryIdsByMessage.get(messages[messageIndex]);
      if (entryId !== void 0) {
        entryRefs.push({ messageIndex, entryId });
      }
    }
    return entryRefs;
  }
  appendThinkingLevelChange(thinkingLevel) {`,
  },
  {
    name: "bundled bind custom message source identity",
    before: `  appendCustomMessageEntry(customType, content, display, details) {
    const entry = {`,
    after: `  appendCustomMessageEntry(customType, content, display, details, sourceMessage) {
    const entry = {`,
  },
  {
    name: "bundled return bound custom entry",
    before: `    this._appendEntry(entry);
    return entry.id;
  }
  /**
   * Append a custom message, undoing the append if persistence fails so a`,
    after: `    this._appendEntry(entry);
    if (sourceMessage) {
      this.bindMessageEntry(sourceMessage, entry.id);
    }
    return entry.id;
  }
  /**
   * Append a custom message, undoing the append if persistence fails so a`,
  },
  {
    name: "bundled rollback custom source identity",
    before: `  appendCustomMessageEntryWithRollback(customType, content, display, details) {
    return this._appendEntryWithRollback(() => this.appendCustomMessageEntry(customType, content, display, details));
  }`,
    after: `  appendCustomMessageEntryWithRollback(customType, content, display, details, sourceMessage) {
    const entryId = this._appendEntryWithRollback(() => this.appendCustomMessageEntry(customType, content, display, details));
    if (sourceMessage) {
      this.bindMessageEntry(sourceMessage, entryId);
    }
    return entryId;
  }`,
  },
  {
    name: "bundled bind rebuilt context messages",
    before: `  buildSessionContext() {
    return buildSessionContext(this.fileEntries, this.leafId, this.byId);
  }
  getHeader() {`,
    after: `  buildSessionContext() {
    const context = buildSessionContext(this.fileEntries, this.leafId, this.byId);
    for (const ref of context.entryRefs) {
      this.bindMessageEntry(context.messages[ref.messageIndex], ref.entryId);
    }
    return context;
  }
  getHeader() {`,
  },
  {
    name: "bundled purpose-aware raw and model projection pipeline",
    supersededBy: "const previousMessages = currentMessages;",
    before: `  async emitContext(messages) {
    const ctx = this.createContext();
    let currentMessages = structuredClone(messages);
    for (const ext of this.extensions) {
      const handlers = ext.handlers.get("context");
      if (!handlers || handlers.length === 0)
        continue;
      for (const handler of handlers) {
        try {
          const event = { type: "context", messages: currentMessages };
          const handlerResult = await handler(event, ctx);
          if (handlerResult && handlerResult.messages) {
            currentMessages = handlerResult.messages;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const stack = err instanceof Error ? err.stack : void 0;
          this.emitError({
            extensionPath: ext.path,
            event: "context",
            error: message,
            stack
          });
        }
      }
    }
    return currentMessages;
  }`,
    after: `  async _emitContextStage(type, messages, purpose, entryRefs) {
    const ctx = this.createContext();
    let currentMessages = messages;
    let currentEntryRefs = entryRefs;
    for (const ext of this.extensions) {
      const handlers = ext.handlers.get(type);
      if (!handlers || handlers.length === 0)
        continue;
      for (const handler of handlers) {
        try {
          const event = {
            type,
            purpose,
            messages: currentMessages,
            ...currentEntryRefs === void 0 ? {} : { entryRefs: currentEntryRefs }
          };
          const handlerResult = await handler(event, ctx);
          if (!handlerResult)
            continue;
          if (handlerResult.messages !== void 0) {
            const previousCount = currentMessages.length;
            currentMessages = handlerResult.messages;
            if (handlerResult.entryRefs !== void 0) {
              currentEntryRefs = handlerResult.entryRefs;
            } else if (currentMessages.length !== previousCount) {
              currentEntryRefs = void 0;
            }
          } else if (handlerResult.entryRefs !== void 0) {
            currentEntryRefs = handlerResult.entryRefs;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const stack = err instanceof Error ? err.stack : void 0;
          this.emitError({
            extensionPath: ext.path,
            event: type,
            error: message,
            stack
          });
        }
      }
    }
    return { messages: currentMessages, entryRefs: currentEntryRefs };
  }
  async emitContext(messages, purpose = "provider", entryRefs) {
    const projected = await this._emitContextStage("context", structuredClone(messages), purpose, entryRefs);
    return projected.messages;
  }
  async projectContext(messages, purpose, entryRefs, transformModelMessages) {
    let raw = { messages, entryRefs };
    if (this.hasHandlers("context")) {
      raw = await this._emitContextStage("context", structuredClone(messages), purpose, entryRefs);
    }
    let model = convertToLlmWithEntryRefs(raw.messages, raw.entryRefs);
    if (transformModelMessages) {
      const previousCount = model.messages.length;
      const transformedMessages = await transformModelMessages(model.messages);
      model = {
        messages: transformedMessages,
        entryRefs: transformedMessages.length === previousCount ? model.entryRefs : void 0
      };
    }
    if (this.hasHandlers("model_context")) {
      model = await this._emitContextStage("model_context", model.messages, purpose, model.entryRefs);
    }
    return model;
  }`,
  },
  {
    name: "bundled projected token accumulation for compaction cut",
    before: `function findCutPoint(entries, startIndex, endIndex, keepRecentTokens) {
  const cutPoints = findValidCutPoints(entries, startIndex, endIndex);`,
    after: `function findCutPoint(entries, startIndex, endIndex, keepRecentTokens, projected) {
  const cutPoints = findValidCutPoints(entries, startIndex, endIndex);`,
  },
  {
    name: "bundled projected per-entry token sizes",
    before: `  let accumulatedTokens = 0;
  let cutIndex = cutPoints[0];
  for (let i = endIndex - 1; i >= startIndex; i--) {
    const entry = entries[i];
    if (entry.type !== "message")
      continue;
    const messageTokens = estimateTokens2(entry.message);
    accumulatedTokens += messageTokens;`,
    after: `  const projectedTokensByEntryId = /* @__PURE__ */ new Map();
  if (projected?.entryRefs) {
    for (const ref of projected.entryRefs) {
      const message = projected.messages[ref.messageIndex];
      if (!message)
        continue;
      projectedTokensByEntryId.set(ref.entryId, (projectedTokensByEntryId.get(ref.entryId) ?? 0) + estimateTokens2(message));
    }
  }
  let accumulatedTokens = 0;
  let cutIndex = cutPoints[0];
  for (let i = endIndex - 1; i >= startIndex; i--) {
    const entry = entries[i];
    if (entry.type !== "message" && !projectedTokensByEntryId.has(entry.id))
      continue;
    const messageTokens = projected ? projectedTokensByEntryId.get(entry.id) ?? 0 : estimateTokens2(entry.message);
    accumulatedTokens += messageTokens;`,
  },
  {
    name: "bundled projected compaction preparation",
    before: `function prepareCompaction(pathEntries, settings) {
  if (pathEntries.length > 0 && pathEntries[pathEntries.length - 1].type === "compaction") {`,
    after: `function prepareCompaction(pathEntries, settings, projected) {
  if (pathEntries.length > 0 && pathEntries[pathEntries.length - 1].type === "compaction") {`,
  },
  {
    name: "bundled complete projected refs or raw compaction fallback",
    before: `  let prevCompactionIndex = -1;`,
    after: `  const pathEntryIds = new Set(pathEntries.map((entry) => entry.id));
  const projectedMessageIndexes = new Set();
  let hasUsableProjection = Array.isArray(projected?.messages) && Array.isArray(projected?.entryRefs) && projected.entryRefs.length === projected.messages.length;
  if (hasUsableProjection) {
    for (const ref of projected.entryRefs) {
      if (!Number.isInteger(ref.messageIndex) || ref.messageIndex < 0 || ref.messageIndex >= projected.messages.length || typeof ref.entryId !== "string" || !pathEntryIds.has(ref.entryId) || projectedMessageIndexes.has(ref.messageIndex)) {
        hasUsableProjection = false;
        break;
      }
      projectedMessageIndexes.add(ref.messageIndex);
    }
  }
  if (!hasUsableProjection) {
    projected = void 0;
  }
  let prevCompactionIndex = -1;`,
  },
  {
    name: "bundled projected compaction size and cut",
    before: `  const tokensBefore = estimateContextTokens(buildSessionContext(pathEntries).messages).tokens;
  const cutPoint = findCutPoint(pathEntries, boundaryStart, boundaryEnd, settings.keepRecentTokens);`,
    after: `  const tokensBefore = projected ? projected.messages.reduce((total, message) => total + estimateTokens2(message), 0) : estimateContextTokens(buildSessionContext(pathEntries).messages).tokens;
  const cutPoint = findCutPoint(pathEntries, boundaryStart, boundaryEnd, settings.keepRecentTokens, projected);`,
  },
  {
    name: "bundled projected compaction ranges with raw file inputs",
    before: `  const messagesToSummarize = [];
  for (let i = boundaryStart; i < historyEnd; i++) {
    const msg = getMessageFromEntryForCompaction(pathEntries[i]);
    if (msg)
      messagesToSummarize.push(msg);
  }
  const turnPrefixMessages = [];
  if (cutPoint.isSplitTurn) {
    for (let i = cutPoint.turnStartIndex; i < cutPoint.firstKeptEntryIndex; i++) {
      const msg = getMessageFromEntryForCompaction(pathEntries[i]);
      if (msg)
        turnPrefixMessages.push(msg);
    }
  }`,
    after: `  const rawMessagesToSummarize = [];
  for (let i = boundaryStart; i < historyEnd; i++) {
    const msg = getMessageFromEntryForCompaction(pathEntries[i]);
    if (msg)
      rawMessagesToSummarize.push(msg);
  }
  const rawTurnPrefixMessages = [];
  if (cutPoint.isSplitTurn) {
    for (let i = cutPoint.turnStartIndex; i < cutPoint.firstKeptEntryIndex; i++) {
      const msg = getMessageFromEntryForCompaction(pathEntries[i]);
      if (msg)
        rawTurnPrefixMessages.push(msg);
    }
  }
  let messagesToSummarize = rawMessagesToSummarize;
  let turnPrefixMessages = rawTurnPrefixMessages;
  if (projected) {
    const entryIndexById = new Map(pathEntries.map((entry, index) => [entry.id, index]));
    const refsByMessageIndex = new Map(projected.entryRefs.map((ref) => [ref.messageIndex, ref.entryId]));
    const previousCompactionId = prevCompactionIndex >= 0 ? pathEntries[prevCompactionIndex].id : void 0;
    const projectedRange = (startIndex, endIndex) => projected.messages.filter((_message, messageIndex) => {
      const entryId = refsByMessageIndex.get(messageIndex);
      const entryIndex = entryIndexById.get(entryId);
      return entryId !== previousCompactionId && entryIndex !== void 0 && entryIndex >= startIndex && entryIndex < endIndex;
    });
    messagesToSummarize = projectedRange(boundaryStart, historyEnd);
    turnPrefixMessages = cutPoint.isSplitTurn ? projectedRange(cutPoint.turnStartIndex, cutPoint.firstKeptEntryIndex) : [];
    if (prevCompactionIndex >= 0) {
      const prevCompaction = pathEntries[prevCompactionIndex];
      const projectedPreviousMessages = projected.messages.filter((_message, messageIndex) => refsByMessageIndex.get(messageIndex) === prevCompaction.id);
      if (projectedPreviousMessages.length === 0) {
        previousSummary = void 0;
      } else {
        const expectedPreviousMessage = createCompactionSummaryMessage(prevCompaction.summary, prevCompaction.tokensBefore, prevCompaction.timestamp, prevCompaction.customInstructions);
        const expectedSerialized = serializeConversation(convertToLlm([expectedPreviousMessage]));
        const projectedSerialized = serializeConversation(projectedPreviousMessages);
        previousSummary = projectedSerialized === expectedSerialized ? prevCompaction.summary : projectedSerialized;
      }
    }
  }`,
  },
  {
    name: "bundled raw compaction file operation extraction",
    before: `  const fileOps = extractFileOperations(messagesToSummarize, pathEntries, prevCompactionIndex);
  if (cutPoint.isSplitTurn) {
    for (const msg of turnPrefixMessages) {`,
    after: `  const fileOps = extractFileOperations(rawMessagesToSummarize, pathEntries, prevCompactionIndex);
  if (cutPoint.isSplitTurn) {
    for (const msg of rawTurnPrefixMessages) {`,
  },
  {
    name: "bundled complete projected tree exchange groups",
    before: `function prepareBranchEntries(entries, tokenBudget = 0) {
  const messages = [];
  const fileOps = createFileOps();
  let totalTokens = 0;`,
    after: `function prepareBranchEntries(entries, tokenBudget = 0, projected) {
  const messages = [];
  const fileOps = createFileOps();
  let totalTokens = 0;`,
  },
  {
    name: "bundled tree raw file ops and projected complete-pair budget",
    before: `  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    const message = getMessageFromEntry2(entry);
    if (!message)
      continue;
    extractFileOpsFromMessage(message, fileOps);
    const tokens = estimateTokens2(message);
    if (tokenBudget > 0 && totalTokens + tokens > tokenBudget) {
      if (entry.type === "compaction" || entry.type === "branch_summary") {
        if (totalTokens < tokenBudget * 0.9) {
          messages.unshift(message);
          totalTokens += tokens;
        }
      }
      break;
    }
    messages.unshift(message);
    totalTokens += tokens;
  }
  return { messages, fileOps, totalTokens };`,
    after: `  if (!projected) {
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      const message = getMessageFromEntry2(entry);
      if (!message)
        continue;
      extractFileOpsFromMessage(message, fileOps);
      const tokens = estimateTokens2(message);
      if (tokenBudget > 0 && totalTokens + tokens > tokenBudget) {
        if (entry.type === "compaction" || entry.type === "branch_summary") {
          if (totalTokens < tokenBudget * 0.9) {
            messages.unshift(message);
            totalTokens += tokens;
          }
        }
        break;
      }
      messages.unshift(message);
      totalTokens += tokens;
    }
    return { messages, fileOps, totalTokens };
  }
  const rawMessages = [];
  for (const entry of entries) {
    const message = getMessageFromEntry2(entry);
    if (message) {
      rawMessages.push(message);
      extractFileOpsFromMessage(message, fileOps);
    }
  }
  const sourceMessages = projected?.messages ?? convertToLlm(rawMessages);
  const groups = [];
  for (let index = 0; index < sourceMessages.length; ) {
    const message = sourceMessages[index];
    if (message.role === "toolResult") {
      index++;
      continue;
    }
    if (message.role === "assistant") {
      const toolCallIds = message.content.filter((part) => part.type === "toolCall").map((part) => part.id);
      if (toolCallIds.length > 0) {
        const expected = new Set(toolCallIds);
        const results = [];
        let next = index + 1;
        while (next < sourceMessages.length && sourceMessages[next].role === "toolResult") {
          if (expected.has(sourceMessages[next].toolCallId)) {
            results.push(sourceMessages[next]);
          }
          next++;
        }
        const completed = new Set(results.map((result) => result.toolCallId));
        if (toolCallIds.every((id) => completed.has(id))) {
          groups.push([message, ...results]);
        } else {
          const visibleContent = message.content.filter((part) => part.type !== "toolCall");
          if (visibleContent.length > 0) {
            groups.push([{ ...message, content: visibleContent }]);
          }
        }
        index = next;
        continue;
      }
    }
    groups.push([message]);
    index++;
  }
  for (let index = groups.length - 1; index >= 0; index--) {
    const group = groups[index];
    const tokens = group.reduce((sum, message) => sum + estimateTokens2(message), 0);
    if (tokenBudget > 0 && totalTokens + tokens > tokenBudget) {
      break;
    }
    messages.unshift(...group);
    totalTokens += tokens;
  }
  return { messages, fileOps, totalTokens };`,
  },
  {
    name: "bundled tree summary consumes projection",
    before: `  const { model, apiKey, headers, signal, customInstructions, replaceInstructions, reserveTokens = 16384 } = options;
  const contextWindow = model.contextWindow || 128e3;
  const tokenBudget = contextWindow - reserveTokens;
  const { messages, fileOps } = prepareBranchEntries(entries, tokenBudget);`,
    after: `  const { model, apiKey, headers, signal, customInstructions, replaceInstructions, reserveTokens = 16384, projected } = options;
  const contextWindow = model.contextWindow || 128e3;
  const tokenBudget = contextWindow - reserveTokens;
  const { messages, fileOps } = prepareBranchEntries(entries, tokenBudget, projected);`,
  },
]);


applyPatches(findBundledCliChunk(), [
  {
    name: "bundled projected threshold context tokens",
    supersededBy: '_projectContext("budget", messages',
    before: `  _getThresholdContextTokens(assistantMessage, compactionTimestamp) {
    const messages = this.agent.state.messages;
    const estimate = estimateContextTokens(messages);
    if (estimate.lastUsageIndex !== null) {
      const usageMsg = messages[estimate.lastUsageIndex];
      if (compactionTimestamp !== void 0 && usageMsg.role === "assistant" && usageMsg.timestamp <= compactionTimestamp) {
        return void 0;
      }
      return estimate.tokens;
    }
    if (assistantMessage.stopReason === "error")
      return void 0;
    return calculateContextTokens(assistantMessage.usage);
  }`,
    after: `  async _getThresholdContextTokens(assistantMessage, compactionTimestamp) {
    const messages = this.agent.state.messages;
    const estimate = estimateContextTokens(messages);
    if (estimate.lastUsageIndex !== null) {
      const usageMsg = messages[estimate.lastUsageIndex];
      if (compactionTimestamp !== void 0 && usageMsg.role === "assistant" && usageMsg.timestamp <= compactionTimestamp) {
        return void 0;
      }
    }
    if (assistantMessage.stopReason === "error")
      return void 0;
    const projected = await this._projectContext("compaction", messages, this.sessionManager.getContextEntryRefs(messages));
    return projected.messages.reduce((total, message) => total + estimateTokens2(message), 0);
  }`,
  },
  {
    name: "bundled await projected pre-prompt threshold tokens",
    before: `    const contextTokens = this._getThresholdContextTokens(context.message, compactionTimestamp);
    if (contextTokens === void 0 || !shouldCompact(contextTokens, contextWindow, settings)) {`,
    after: `    const contextTokens = await this._getThresholdContextTokens(context.message, compactionTimestamp);
    if (contextTokens === void 0 || !shouldCompact(contextTokens, contextWindow, settings)) {`,
  },
  {
    name: "bundled await projected post-tool threshold tokens",
    before: `    const contextTokens = this._getThresholdContextTokens(assistantMessage, compactionTimestamp);
    if (contextTokens === void 0)
      return false;`,
    after: `    const contextTokens = await this._getThresholdContextTokens(assistantMessage, compactionTimestamp);
    if (contextTokens === void 0)
      return false;`,
  },
  {
    name: "bundled bind autonomous custom message ref",
    before: `    this.agent.state.messages.push(message);
    this.sessionManager.appendCustomMessageEntry(message.customType, message.content, message.display, message.details);
    this._emit({ type: "message_start", message });`,
    after: `    this.agent.state.messages.push(message);
    this.sessionManager.appendCustomMessageEntry(message.customType, message.content, message.display, message.details, message);
    this._emit({ type: "message_start", message });`,
  },
  {
    name: "bundled bind event custom message ref",
    before: `        this.sessionManager.appendCustomMessageEntry(event.message.customType, event.message.content, event.message.display, event.message.details);`,
    after: `        this.sessionManager.appendCustomMessageEntry(event.message.customType, event.message.content, event.message.display, event.message.details, event.message);`,
  },
  {
    name: "bundled bind durable slash command ref",
    before: `    this.sessionManager.appendCustomMessageEntryWithRollback(message.customType, message.content, message.display, message.details);
    this.agent.state.messages.push(message);`,
    after: `    this.sessionManager.appendCustomMessageEntryWithRollback(message.customType, message.content, message.display, message.details, message);
    this.agent.state.messages.push(message);`,
  },
  {
    name: "bundled bind direct custom application ref",
    before: `      this.sessionManager.appendCustomMessageEntry(message.customType, message.content, message.display, message.details);
      this._emit({ type: "message_start", message: appMessage });`,
    after: `      this.sessionManager.appendCustomMessageEntry(message.customType, message.content, message.display, message.details, appMessage);
      this._emit({ type: "message_start", message: appMessage });`,
  },
  {
    name: "bundled bind ipython state custom ref",
    before: `    this.sessionManager.appendCustomMessageEntry(message.customType, message.content, message.display, void 0);
    this._emit({ type: "message_start", message });`,
    after: `    this.sessionManager.appendCustomMessageEntry(message.customType, message.content, message.display, void 0, message);
    this._emit({ type: "message_start", message });`,
  },
  {
    name: "bundled bind refinement outcome ref",
    before: `      this.sessionManager.appendCustomMessageEntryWithRollback(message.customType, message.content, message.display, message.details);
    } catch {
      this._unpersistedOutcomes.push(message);`,
    after: `      this.sessionManager.appendCustomMessageEntryWithRollback(message.customType, message.content, message.display, message.details, message);
    } catch {
      this._unpersistedOutcomes.push(message);`,
  },
  {
    name: "bundled bind compaction outcome ref",
    before: `      this.sessionManager.appendCustomMessageEntryWithRollback(outcomeMessage.customType, outcomeMessage.content, outcomeMessage.display, outcomeMessage.details);`,
    after: `      this.sessionManager.appendCustomMessageEntryWithRollback(outcomeMessage.customType, outcomeMessage.content, outcomeMessage.display, outcomeMessage.details, outcomeMessage);`,
  },
  {
    name: "bundled shared projection helpers",
    before: `  buildSessionContext() {
    const context = this.sessionManager.buildSessionContext();`,
    after: `  async _projectContext(purpose, messages, entryRefs) {
    return this._extensionRunner.projectContext(messages, purpose, entryRefs);
  }
  async _snapshotRefineContext() {
    const messages = this.agent.state.messages;
    return this._projectContext("refine", messages, this.sessionManager.getContextEntryRefs(messages));
  }
  buildSessionContext() {
    const context = this.sessionManager.buildSessionContext();`,
  },
  {
    name: "bundled exact refs after unpersisted outcome merge",
    before: `    this._mergeUnpersistedOutcomes(context.messages);
    return context;`,
    after: `    this._mergeUnpersistedOutcomes(context.messages);
    context.entryRefs = this.sessionManager.getContextEntryRefs(context.messages);
    return context;`,
  },
  {
    name: "bundled compaction scheduling avoids unprojected preparation",
    before: `        const preparation = prepareCompaction(this.sessionManager.getBranch(), this.settingsManager.getCompactionSettings());
        if (!preparation) {
          const lastEntry = this.sessionManager.getBranch().at(-1);`,
    after: `        const branch = this.sessionManager.getBranch();
        const lastEntry = branch.at(-1);
        const conversationEntries = branch.filter((entry) => (entry.type === "message" && entry.message.role !== "toolResult") || entry.type === "custom_message" || entry.type === "branch_summary");
        if (lastEntry?.type === "compaction" || conversationEntries.length < 2) {`,
  },
  {
    name: "bundled project before default compaction preparation",
    before: `    const pathEntries = this.sessionManager.getBranch();
    const settings = this.settingsManager.getCompactionSettings();
    const preparation = prepareCompaction(pathEntries, settings);`,
    after: `    const pathEntries = this.sessionManager.getBranch();
    const settings = this.settingsManager.getCompactionSettings();
    const rawContext = this.sessionManager.buildSessionContext();
    const projected = await this._projectContext("compaction", rawContext.messages, rawContext.entryRefs);
    const preparation = prepareCompaction(pathEntries, settings, projected);`,
  },
  {
    name: "bundled tree projection before late hook",
    before: `    this._branchSummaryAbortController = new AbortController();
    let resolveBranchSummaryOperation = () => {`,
    after: `    this._branchSummaryAbortController = new AbortController();
    let projectedBranch;
    if (options.summarize && entriesToSummarize.length > 0) {
      const lastEntryId = entriesToSummarize.at(-1)?.id;
      const byId = new Map(entriesToSummarize.map((entry) => [entry.id, entry]));
      const rawBranch = buildSessionContext(entriesToSummarize, lastEntryId, byId);
      projectedBranch = await this._projectContext("branch-summary", rawBranch.messages, rawBranch.entryRefs);
    }
    let resolveBranchSummaryOperation = () => {`,
  },
  {
    name: "bundled default tree summary receives projection",
    before: `          replaceInstructions,
          reserveTokens: branchSummarySettings.reserveTokens
        });`,
    after: `          replaceInstructions,
          reserveTokens: branchSummarySettings.reserveTokens,
          projected: projectedBranch
        });`,
  },
  {
    name: "bundled interactive auto refine shared snapshot",
    before: `    let approvedReview;
    try {
      const review = await this._reviewAutoRefine({ reason, turnsSinceLastReview }, reviewAbort.signal);`,
    after: `    let approvedReview;
    let approvedRefineMessages;
    try {
      const refineSnapshot = await this._snapshotRefineContext();
      const review = await this._reviewAutoRefine({ reason, turnsSinceLastReview }, reviewAbort.signal, refineSnapshot.messages);`,
  },
  {
    name: "bundled pending auto refine retains projection",
    before: `        this._pendingAutoRefineReview = { reason, review };`,
    after: `        this._pendingAutoRefineReview = { reason, review, refineMessages: refineSnapshot.messages };`,
  },
  {
    name: "bundled approved auto refine retains projection",
    before: `      approvedReview = review;
    } catch {`,
    after: `      approvedReview = review;
      approvedRefineMessages = refineSnapshot.messages;
    } catch {`,
  },
  {
    name: "bundled approved auto refine uses shared projection",
    before: `      await this._runApprovedRefine(reason, approvedReview);`,
    after: `      await this._runApprovedRefine(reason, approvedReview, approvedRefineMessages);`,
  },
  {
    name: "bundled pending approved auto refine uses saved projection",
    before: `      await this._runApprovedRefine(pendingReview.reason, pendingReview.review);`,
    after: `      await this._runApprovedRefine(pendingReview.reason, pendingReview.review, pendingReview.refineMessages);`,
  },
  {
    name: "bundled approved refine passes projection",
    before: `  async _runApprovedRefine(reason, review) {
    this._autoRefineInProgress = true;
    try {
      await this.refine({ instructions: autoRefineInstructions(reason, review) }, { trigger: "auto" });`,
    after: `  async _runApprovedRefine(reason, review, refineMessages) {
    this._autoRefineInProgress = true;
    try {
      await this.refine({ instructions: autoRefineInstructions(reason, review) }, { trigger: "auto", refineMessages });`,
  },
  {
    name: "bundled auto refine reviewer accepts projection",
    before: `  async _reviewAutoRefine(context, signal) {`,
    after: `  async _reviewAutoRefine(context, signal, refineMessages) {`,
  },
  {
    name: "bundled auto refine reviewer projects by default",
    before: `    const { apiKey, headers } = await this._getRequiredRequestAuth(model);
    return reviewAutoRefine(this.agent.state.messages, this._loadMergedHarnessState(),`,
    after: `    const { apiKey, headers } = await this._getRequiredRequestAuth(model);
    const messages = refineMessages ?? (await this._snapshotRefineContext()).messages;
    return reviewAutoRefine(messages, this._loadMergedHarnessState(),`,
  },
  {
    name: "bundled manual refine passes projection",
    before: `    const planRun = this._planRefine(options, refineAbort.signal, internal.trigger ?? "manual");`,
    after: `    const planRun = this._planRefine(options, refineAbort.signal, internal.trigger ?? "manual", internal.refineMessages);`,
  },
  {
    name: "bundled refine planner accepts projection",
    before: `  async _planRefine(options, signal, trigger = "manual") {`,
    after: `  async _planRefine(options, signal, trigger = "manual", refineMessages) {`,
  },
  {
    name: "bundled refine planner snapshots once",
    before: `    const history = this._loadRefinementHistory();
    const rollbackTarget = options.rollbackId ? history.find((item) => item.id === options.rollbackId) : void 0;`,
    after: `    const history = this._loadRefinementHistory();
    const messages = refineMessages ?? (await this._snapshotRefineContext()).messages;
    const rollbackTarget = options.rollbackId ? history.find((item) => item.id === options.rollbackId) : void 0;`,
  },
  {
    name: "bundled refine hook serializes projection",
    before: `          conversationText: serializeConversation(convertToLlm(this.agent.state.messages)).slice(-8e4)`,
    after: `          conversationText: serializeConversation(convertToLlm(messages)).slice(-8e4)`,
  },
  {
    name: "bundled refine planner consumes projection",
    before: `    const plan = await planRefinement(this.agent.state.messages, planningState, history, model, apiKey, options, headers, signal, this.thinkingLevel);`,
    after: `    const plan = await planRefinement(messages, planningState, history, model, apiKey, options, headers, signal, this.thinkingLevel);`,
  },
  {
    name: "bundled background auto refine snapshots once",
    before: `  async _runBackgroundPlan(options, refineAbort, branchVersion, skipReview = false) {
    try {
      let planOptions = options;`,
    after: `  async _runBackgroundPlan(options, refineAbort, branchVersion, skipReview = false) {
    try {
      const refineSnapshot = await this._snapshotRefineContext();
      let planOptions = options;`,
  },
  {
    name: "bundled background review shares projection",
    before: `        const review = await this._reviewAutoRefine({
          reason: "turn_interval",
          turnsSinceLastReview: this._assistantTurnsSinceAutoRefine
        }, refineAbort.signal);`,
    after: `        const review = await this._reviewAutoRefine({
          reason: "turn_interval",
          turnsSinceLastReview: this._assistantTurnsSinceAutoRefine
        }, refineAbort.signal, refineSnapshot.messages);`,
  },
  {
    name: "bundled background plan shares projection",
    before: `      const plan = await this._planRefine(planOptions, refineAbort.signal, skipReview ? "manual" : "auto");`,
    after: `      const plan = await this._planRefine(planOptions, refineAbort.signal, skipReview ? "manual" : "auto", refineSnapshot.messages);`,
  },
  {
    name: "bundled serialized auto refine snapshots once",
    before: `    try {
      const review = await this._reviewAutoRefine({ reason, turnsSinceLastReview: this._assistantTurnsSinceAutoRefine }, reviewAbort.signal);`,
    after: `    try {
      const refineSnapshot = await this._snapshotRefineContext();
      const review = await this._reviewAutoRefine({ reason, turnsSinceLastReview: this._assistantTurnsSinceAutoRefine }, reviewAbort.signal, refineSnapshot.messages);`,
  },
  {
    name: "bundled serialized auto plan shares projection",
    before: `      await this._runSerializedRefine({ instructions: autoRefineInstructions(reason, review) }, "auto");`,
    after: `      await this._runSerializedRefine({ instructions: autoRefineInstructions(reason, review) }, "auto", refineSnapshot.messages);`,
  },
  {
    name: "bundled serialized refine accepts projection",
    before: `  async _runSerializedRefine(options, trigger = "manual") {`,
    after: `  async _runSerializedRefine(options, trigger = "manual", refineMessages) {`,
  },
  {
    name: "bundled serialized refine planner uses projection",
    before: `    const planRun = this._planRefine(options, refineAbort.signal, trigger);`,
    after: `    const planRun = this._planRefine(options, refineAbort.signal, trigger, refineMessages);`,
  },
]);

applyPatches(findBundledProviderChunk(), [
  {
    name: "bundled provider projection before image blocking",
    before: `  const convertToLlmWithBlockImages = (messages) => {
    const converted = convertToLlm(messages);
    if (!settingsManager.getBlockImages()) {
      return converted;
    }
    return converted.map((msg) => {`,
    after: `  const applyBlockImages = (converted) => {
    if (!settingsManager.getBlockImages()) {
      return converted;
    }
    return converted.map((msg) => {`,
  },
  {
    name: "bundled ordinary provider uses shared projection",
    before: `      return msg;
    });
  };
  const extensionRunnerRef = {};`,
    after: `      return msg;
    });
  };
  const extensionRunnerRef = {};
  const providerVisibleFallback = (messages) => structuredClone(convertToLlm(messages).map((message) => {
    if (message.role === "toolResult" && Object.hasOwn(message, "details")) {
      const { details: _details, ...providerVisible } = message;
      return providerVisible;
    }
    return message;
  }));
  const convertToLlmWithBlockImages = async (messages) => {
    const runner = extensionRunnerRef.current;
    if (!runner) {
      return applyBlockImages(providerVisibleFallback(messages));
    }
    const projected = await runner.projectContext(messages, "provider", sessionManager.getContextEntryRefs(messages), applyBlockImages);
    return projected.messages;
  };`,
  },
  {
    name: "bundled remove legacy provider-only raw transform bridge",
    before: `    sessionId: sessionManager.getSessionId(),
    transformContext: async (messages) => {
      const runner = extensionRunnerRef.current;
      if (!runner)
        return messages;
      return runner.emitContext(messages);
    },
    steeringMode: settingsManager.getSteeringMode(),`,
    after: `    sessionId: sessionManager.getSessionId(),
    steeringMode: settingsManager.getSteeringMode(),`,
  },
]);

applyPatches(findBundledCliChunk(), [
  {
    name: "bundled turn_end mode for failed assistant response",
    supersededBy: "toolExecution: config.toolExecution ?? \"parallel\", exchanges: []",
    before: '        await emit({ type: "turn_end", message, toolResults: [] });',
    after: `        const turnEndResult = await emit({ type: "turn_end", message, toolResults: [], toolExecution: config.toolExecution ?? "parallel" });
        for (const turnEndMessage of turnEndResult?.messages ?? []) {
          await emit({ type: "message_start", message: turnEndMessage });
          await emit({ type: "message_end", message: turnEndMessage });
          currentContext.messages.push(turnEndMessage);
          newMessages.push(turnEndMessage);
        }`,
  },
  {
    name: "bundled effective mode captured from the executed batch",
    supersededBy: "        exchanges.push(...executedToolBatch.exchanges);",
    before: `      const toolCalls = message.content.filter((c) => c.type === "toolCall");
      const toolResults = [];
      hasMoreToolCalls = false;
      if (toolCalls.length > 0) {
        const executedToolBatch = await executeToolCalls(currentContext, message, config, signal, emit);
        toolResults.push(...executedToolBatch.messages);`,
    after: `      const toolCalls = message.content.filter((c) => c.type === "toolCall");
      const toolResults = [];
      let toolExecution = config.toolExecution ?? "parallel";
      hasMoreToolCalls = false;
      if (toolCalls.length > 0) {
        const executedToolBatch = await executeToolCalls(currentContext, message, config, signal, emit);
        toolExecution = executedToolBatch.toolExecution;
        toolResults.push(...executedToolBatch.messages);`,
  },
  {
    name: "bundled turn_end effective mode",
    supersededBy: "toolResults, toolExecution, exchanges });",
    before: '      await emit({ type: "turn_end", message, toolResults });',
    after: `      const turnEndResult = await emit({ type: "turn_end", message, toolResults, toolExecution });
      for (const turnEndMessage of turnEndResult?.messages ?? []) {
        await emit({ type: "message_start", message: turnEndMessage });
        await emit({ type: "message_end", message: turnEndMessage });
        currentContext.messages.push(turnEndMessage);
        newMessages.push(turnEndMessage);
      }`,
  },
  {
    name: "bundled mode returned by the selected tool execution branch",
    supersededBy: "return withToolExchanges(batch, toolCalls, \"sequential\");",
    before: `  if (config.toolExecution === "sequential" || hasSequentialToolCall) {
    return executeToolCallsSequential(currentContext, assistantMessage, toolCalls, config, signal, emit);
  }
  return executeToolCallsParallel(currentContext, assistantMessage, toolCalls, config, signal, emit);`,
    after: `  if (config.toolExecution === "sequential" || hasSequentialToolCall) {
    const batch = await executeToolCallsSequential(currentContext, assistantMessage, toolCalls, config, signal, emit);
    return { ...batch, toolExecution: "sequential" };
  }
  const batch = await executeToolCallsParallel(currentContext, assistantMessage, toolCalls, config, signal, emit);
  return { ...batch, toolExecution: "parallel" };`,
  },
  {
    name: "bundled extension turn_end mode bridge",
    supersededBy: "        exchanges: event.exchanges",
    before: `        message: event.message,
        toolResults: event.toolResults
      };`,
    after: `        message: event.message,
        toolResults: event.toolResults,
        toolExecution: event.toolExecution
      };`,
  },
  {
    name: "bundled awaited listener message result propagation",
    before: `    for (const listener of this.listeners) {
      await listener(event, signal);
    }`,
    after: `    const resultMessages = [];
    for (const listener of this.listeners) {
      const listenerResult = await listener(event, signal);
      if (event.type === "turn_end" && Array.isArray(listenerResult?.messages)) {
        resultMessages.push(...listenerResult.messages);
      }
    }
    return resultMessages.length > 0 ? { messages: resultMessages } : void 0;`,
  },
  {
    name: "bundled awaited ordered turn_end handler results",
    before: `  async emitMessageEnd(event) {`,
    after: `  async emitTurnEnd(event) {
    const ctx = this.createContext();
    const messages = [];
    for (const ext of this.extensions) {
      const handlers = ext.handlers.get("turn_end");
      if (!handlers || handlers.length === 0)
        continue;
      for (const handler of handlers) {
        try {
          const handlerResult = await handler(event, ctx);
          if (handlerResult?.messages === void 0)
            continue;
          if (!Array.isArray(handlerResult.messages)) {
            this.emitError({
              extensionPath: ext.path,
              event: "turn_end",
              error: "turn_end handler messages must be an array"
            });
            continue;
          }
          for (let index = 0; index < handlerResult.messages.length; index++) {
            const sourceMessage = handlerResult.messages[index];
            let message = sourceMessage;
            if (sourceMessage !== null && typeof sourceMessage === "object" && !Array.isArray(sourceMessage)) {
              const { role, customType, content, display, details, timestamp, ...extras } = sourceMessage;
              message = { ...extras, role, customType, content, display, details, timestamp };
            }
            const validContent = typeof message?.content === "string" || Array.isArray(message?.content) && Array.from(message.content).every((block) => block !== null && typeof block === "object" && (block.type === "text" && typeof block.text === "string" || block.type === "image" && typeof block.data === "string" && typeof block.mimeType === "string"));
            if (message === null || typeof message !== "object" || Array.isArray(message) || message.role !== "custom" || message.display !== false || typeof message.customType !== "string" || message.customType.length === 0 || !validContent || typeof message.timestamp !== "number" || !Number.isFinite(message.timestamp)) {
              this.emitError({
                extensionPath: ext.path,
                event: "turn_end",
                error: \`turn_end handler message at index \${index} must be a hidden CustomMessage\`
              });
              continue;
            }
            messages.push(message);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const stack = err instanceof Error ? err.stack : void 0;
          this.emitError({
            extensionPath: ext.path,
            event: "turn_end",
            error: message,
            stack
          });
        }
      }
    }
    return messages.length > 0 ? { messages } : void 0;
  }
  async emitMessageEnd(event) {`,
  },
  {
    name: "bundled turn_end boundary message persistence marker",
    before: "  _agentEventQueue = Promise.resolve();",
    after: `  _agentEventQueue = Promise.resolve();
  _turnEndMessages = /* @__PURE__ */ new WeakSet();`,
  },
  {
    name: "bundled queued agent event result and boundary persistence await",
    before: `    this._agentEventQueue = this._agentEventQueue.then(() => this._processAgentEvent(event), () => this._processAgentEvent(event));
    this._agentEventQueue.catch(() => {
    });`,
    after: `    const isTurnEndMessageEvent = (event.type === "message_start" || event.type === "message_end") && this._turnEndMessages.has(event.message);
    const queuedEvent = this._agentEventQueue.then(() => this._processAgentEvent(event), () => this._processAgentEvent(event));
    this._agentEventQueue = queuedEvent.finally(() => {
      if (isTurnEndMessageEvent && event.type === "message_end") {
        this._turnEndMessages.delete(event.message);
      }
    });
    this._agentEventQueue.catch(() => {
    });
    if (event.type === "turn_end" || isTurnEndMessageEvent) {
      return this._agentEventQueue;
    }`,
  },
  {
    name: "bundled capture extension event result",
    before: "    await this._emitExtensionEvent(event);",
    after: "    const extensionResult = await this._emitExtensionEvent(event);",
  },
  {
    name: "bundled return queued extension event result",
    before: `      }
    }
  }
  _resolveRetry() {`,
    after: `      }
    }
    return extensionResult;
  }
  _resolveRetry() {`,
  },
  {
    name: "bundled awaited turn_end result bridge",
    before: `      await this._extensionRunner.emit(extensionEvent);
      this._turnIndex++;`,
    after: `      const result = await this._extensionRunner.emitTurnEnd(extensionEvent);
      for (const message of result?.messages ?? []) {
        this._turnEndMessages.add(message);
      }
      this._turnIndex++;
      return result;`,
  },
  {
    name: "bundled finalized exchanges on failed assistant turn",
    before: '        const turnEndResult = await emit({ type: "turn_end", message, toolResults: [], toolExecution: config.toolExecution ?? "parallel" });',
    after: '        const turnEndResult = await emit({ type: "turn_end", message, toolResults: [], toolExecution: config.toolExecution ?? "parallel", exchanges: [] });',
  },
  {
    name: "bundled finalized exchange batch bridge",
    before: `  if (config.toolExecution === "sequential" || hasSequentialToolCall) {
    const batch = await executeToolCallsSequential(currentContext, assistantMessage, toolCalls, config, signal, emit);
    return { ...batch, toolExecution: "sequential" };
  }
  const batch = await executeToolCallsParallel(currentContext, assistantMessage, toolCalls, config, signal, emit);
  return { ...batch, toolExecution: "parallel" };
}`,
    after: `  if (config.toolExecution === "sequential" || hasSequentialToolCall) {
    const batch = await executeToolCallsSequential(currentContext, assistantMessage, toolCalls, config, signal, emit);
    return withToolExchanges(batch, toolCalls, "sequential");
  }
  const batch = await executeToolCallsParallel(currentContext, assistantMessage, toolCalls, config, signal, emit);
  return withToolExchanges(batch, toolCalls, "parallel");
}
function withToolExchanges(batch, toolCalls, toolExecution) {
  const exchanges = batch.messages.map((result, sourceOrder) => {
    const original = toolCalls[sourceOrder];
    const finalized = batch.finalizedCalls[sourceOrder];
    return {
      sourceOrder,
      toolCallId: original.id,
      toolName: original.name,
      originalInput: original.arguments,
      ...(finalized?.executedInput === void 0 ? {} : { executedInput: finalized.executedInput }),
      result
    };
  });
  return { messages: batch.messages, terminate: batch.terminate, toolExecution, exchanges };
}`,
  },
  {
    name: "bundled executed normalized input captured",
    before: `  return {
    toolCall: prepared.toolCall,
    result,
    isError
  };
}`,
    after: `  return {
    toolCall: prepared.toolCall,
    executedInput: prepared.args,
    result,
    isError
  };
}`,
  },
  {
    name: "bundled sequential finalized calls returned",
    before: `  return {
    messages,
    terminate: shouldTerminateToolBatch(finalizedCalls)
  };
}
async function executeToolCallsParallel`,
    after: `  return {
    messages,
    finalizedCalls,
    terminate: shouldTerminateToolBatch(finalizedCalls)
  };
}
async function executeToolCallsParallel`,
  },
  {
    name: "bundled parallel finalized calls returned",
    before: `  return {
    messages,
    terminate: shouldTerminateToolBatch(orderedFinalizedCalls)
  };
}
function shouldTerminateToolBatch`,
    after: `  return {
    messages,
    finalizedCalls: orderedFinalizedCalls,
    terminate: shouldTerminateToolBatch(orderedFinalizedCalls)
  };
}
function shouldTerminateToolBatch`,
  },
  {
    name: "bundled finalized exchange event accumulator",
    before: `      const toolResults = [];
      let toolExecution = config.toolExecution ?? "parallel";
      hasMoreToolCalls = false;
      if (toolCalls.length > 0) {
        const executedToolBatch = await executeToolCalls(currentContext, message, config, signal, emit);
        toolExecution = executedToolBatch.toolExecution;
        toolResults.push(...executedToolBatch.messages);`,
    after: `      const toolResults = [];
      const exchanges = [];
      let toolExecution = config.toolExecution ?? "parallel";
      hasMoreToolCalls = false;
      if (toolCalls.length > 0) {
        const executedToolBatch = await executeToolCalls(currentContext, message, config, signal, emit);
        toolExecution = executedToolBatch.toolExecution;
        toolResults.push(...executedToolBatch.messages);
        exchanges.push(...executedToolBatch.exchanges);`,
  },
  {
    name: "bundled turn end includes finalized exchanges",
    before: '      const turnEndResult = await emit({ type: "turn_end", message, toolResults, toolExecution });',
    after: '      const turnEndResult = await emit({ type: "turn_end", message, toolResults, toolExecution, exchanges });',
  },
  {
    name: "bundled extension finalized exchange bridge",
    before: `        toolResults: event.toolResults,
        toolExecution: event.toolExecution
      };`,
    after: `        toolResults: event.toolResults,
        toolExecution: event.toolExecution,
        exchanges: event.exchanges
      };`,
  },
  {
    name: "bundled await normal user bash persistence event",
    before: `      if (!options?.transient) {
        this.recordBashResult(command, result, options);
      }`,
    after: `      if (!options?.transient) {
        await this.recordBashResult(command, result, options);
      }`,
  },
  {
    name: "bundled await extension supplied user bash persistence event",
    before: `        record(result2);
        return {
          exitCode: result2.exitCode,`,
    after: `        await record(result2);
        return {
          exitCode: result2.exitCode,`,
  },
  {
    name: "bundled await cancelled user bash persistence event",
    before: `        record({
          output: "",
          exitCode: void 0,`,
    after: `        await record({
          output: "",
          exitCode: void 0,`,
  },
  {
    name: "bundled await failed user bash persistence event",
    before: `      record({
        output: \`bash failed: \${errorMessage4}\`,`,
    after: `      await record({
        output: \`bash failed: \${errorMessage4}\`,`,
  },
  {
    name: "bundled async user bash recorder closure",
    before: `    const record = transient ? () => {
    } : (result) => this.recordBashResult(command, result, { excludeFromContext });`,
    after: `    const record = transient ? async () => {
    } : async (result) => this.recordBashResult(command, result, { excludeFromContext });`,
  },
  {
    name: "bundled direct finalized user bash event",
    before: `  recordBashResult(command, result, options) {
    const bashMessage = {`,
    after: `  async _emitUserBashEnd(entryId, bashMessage) {
    await this._extensionRunner.emit({
      type: "user_bash_end",
      entryId,
      command: bashMessage.command,
      output: bashMessage.output,
      isError: bashMessage.exitCode !== 0 || bashMessage.cancelled === true,
      exitCode: bashMessage.exitCode,
      cancelled: bashMessage.cancelled,
      truncated: bashMessage.truncated,
      fullOutputPath: bashMessage.fullOutputPath
    });
  }
  async recordBashResult(command, result, options) {
    const bashMessage = {`,
  },
  {
    name: "bundled emit finalized user bash after direct persistence",
    before: `      this.agent.state.messages.push(bashMessage);
      this.sessionManager.appendMessage(bashMessage);
    }
  }`,
    after: `      this.agent.state.messages.push(bashMessage);
      const entryId = this.sessionManager.appendMessage(bashMessage);
      await this._emitUserBashEnd(entryId, bashMessage);
    }
  }`,
  },
  {
    name: "bundled await pending bash flush before validation",
    before: `    if (policy.flushPendingBashBeforeValidation)
      this._flushPendingBashMessages();`,
    after: `    if (policy.flushPendingBashBeforeValidation)
      await this._flushPendingBashMessages();`,
  },
  {
    name: "bundled await pending bash flush after validation",
    before: `    if (!policy.flushPendingBashBeforeValidation)
      this._flushPendingBashMessages();`,
    after: `    if (!policy.flushPendingBashBeforeValidation)
      await this._flushPendingBashMessages();`,
  },
  {
    name: "bundled emit finalized pending user bash events",
    before: `  _flushPendingBashMessages() {
    if (this._pendingBashMessages.length === 0)
      return;
    for (const bashMessage of this._pendingBashMessages) {
      this.agent.state.messages.push(bashMessage);
      this.sessionManager.appendMessage(bashMessage);
    }
    this._pendingBashMessages = [];
  }`,
    after: `  async _flushPendingBashMessages() {
    if (this._pendingBashMessages.length === 0)
      return;
    for (const bashMessage of this._pendingBashMessages) {
      this.agent.state.messages.push(bashMessage);
      const entryId = this.sessionManager.appendMessage(bashMessage);
      await this._emitUserBashEnd(entryId, bashMessage);
    }
    this._pendingBashMessages = [];
  }`,
  },
  {
    name: "bundled automatic refinement override action",
    before: `  getContextUsageFn = () => void 0;
  compactFn = () => {`,
    after: `  getContextUsageFn = () => void 0;
  setAutomaticRefinementEnabledFn = () => {
  };
  compactFn = () => {`,
  },
  {
    name: "bundled bind automatic refinement override",
    before: `    this.getContextUsageFn = contextActions.getContextUsage;
    this.compactFn = contextActions.compact;`,
    after: `    this.getContextUsageFn = contextActions.getContextUsage;
    this.setAutomaticRefinementEnabledFn = contextActions.setAutomaticRefinementEnabled;
    this.compactFn = contextActions.compact;`,
  },
  {
    name: "bundled automatic refinement extension context method",
    before: `      compact: (options) => {
        runner.assertActive();`,
    after: `      setAutomaticRefinementEnabled: (enabled) => {
        runner.assertActive();
        runner.setAutomaticRefinementEnabledFn(enabled);
      },
      compact: (options) => {
        runner.assertActive();`,
  },
  {
    name: "bundled automatic refinement override state",
    before: `  _refinePlanInFlight;
`,
    after: `  _refinePlanInFlight;
  _automaticRefinementEnabled;
`,
  },
  {
    name: "bundled bind automatic refinement override action",
    before: `      getContextUsage: () => this.getContextUsage(),
      compact: (options) => {`,
    after: `      getContextUsage: () => this.getContextUsage(),
      setAutomaticRefinementEnabled: (enabled) => this.setAutomaticRefinementEnabled(enabled),
      compact: (options) => {`,
  },
  {
    name: "bundled automatic refinement override gate",
    supersededBy: "this._scheduledAutoRefineTimers.clear();\n  }\n  _autoRefineAllowedForSession",
    before: `  _autoRefineAllowedForSession() {
    return this._rlmDepth === 0 && this._localHarnessStateDir() !== void 0;
  }`,
    after: `  setAutomaticRefinementEnabled(enabled) {
    this._automaticRefinementEnabled = enabled;
  }
  _autoRefineAllowedForSession() {
    return this._automaticRefinementEnabled !== false && this._rlmDepth === 0 && this._localHarnessStateDir() !== void 0;
  }`,
  },
  {
    name: "bundled avoid full converted message clone",
    before: `    messages: structuredClone(convertedMessages),`,
    after: `    messages: convertedMessages,`,
  },
  {
    name: "bundled conservative extension entry ref invalidation",
    before: `          if (handlerResult.messages !== void 0) {
            const previousCount = currentMessages.length;
            currentMessages = handlerResult.messages;
            if (handlerResult.entryRefs !== void 0) {
              currentEntryRefs = handlerResult.entryRefs;
            } else if (currentMessages.length !== previousCount) {
              currentEntryRefs = void 0;
            }
          }`,
    after: `          if (handlerResult.messages !== void 0) {
            const previousMessages = currentMessages;
            currentMessages = handlerResult.messages;
            if (handlerResult.entryRefs !== void 0) {
              currentEntryRefs = handlerResult.entryRefs;
            } else if (currentMessages !== previousMessages) {
              currentEntryRefs = void 0;
            }
          }`,
  },
  {
    name: "bundled conservative host transform entry ref invalidation",
    before: `      const previousCount = model.messages.length;
      const transformedMessages = await transformModelMessages(model.messages);
      model = {
        messages: transformedMessages,
        entryRefs: transformedMessages.length === previousCount ? model.entryRefs : void 0
      };`,
    after: `      const previousMessages = model.messages;
      const transformedMessages = await transformModelMessages(previousMessages);
      model = {
        messages: transformedMessages,
        entryRefs: transformedMessages === previousMessages ? model.entryRefs : void 0
      };`,
  },
  {
    name: "bundled budget purpose for provider-bound threshold estimate",
    supersededBy: `_projectContext("budget", messages,`,
    before: `    const projected = await this._projectContext("compaction", messages, this.sessionManager.getContextEntryRefs(messages));`,
    after: `    const projected = await this._projectContext("budget", messages, this.sessionManager.getContextEntryRefs(messages));`,
  },
  {
    name: "bundled complete provider-bound threshold estimate",
    supersededBy: "this._providerContextEstimate = {",
    before: `    const projected = await this._projectContext("budget", messages, this.sessionManager.getContextEntryRefs(messages));
    return projected.messages.reduce((total, message) => total + estimateTokens2(message), 0);`,
    after: `    const projected = await this._projectContext("budget", messages, this.sessionManager.getContextEntryRefs(messages));
    const messageTokens = projected.messages.reduce((total, message) => total + estimateTokens2(message), 0);
    const systemPrompt = this.agent.state.systemPrompt ?? "";
    const tools = this.agent.state.tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
    const toolSignature = JSON.stringify(tools);
    const systemTokens = Math.ceil(systemPrompt.length / 4);
    const toolTokens = Math.ceil(toolSignature.length / 4);
    const totalTokens = systemTokens + toolTokens + messageTokens;
    this._providerContextEstimate = {
      messageTokens,
      systemTokens,
      toolTokens,
      totalTokens,
      projectedMessageCount: projected.messages.length,
      sourceMessageCount: messages.length,
      sourceLastMessage: messages.at(-1),
      systemPrompt,
      toolSignature
    };
    return totalTokens;`,
  },
  {
    name: "bundled same-epoch provider usage anchor",
    supersededBy: "let usageAnchored = false;",
    before: `    const projected = await this._projectContext("budget", messages, this.sessionManager.getContextEntryRefs(messages));
    const messageTokens = projected.messages.reduce((total, message) => total + estimateTokens2(message), 0);
    const systemPrompt = this.agent.state.systemPrompt ?? "";
    const tools = this.agent.state.tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
    const toolSignature = JSON.stringify(tools);
    const systemTokens = Math.ceil(systemPrompt.length / 4);
    const toolTokens = Math.ceil(toolSignature.length / 4);
    const totalTokens = systemTokens + toolTokens + messageTokens;
    this._providerContextEstimate = {
      messageTokens,
      systemTokens,
      toolTokens,
      totalTokens,
      projectedMessageCount: projected.messages.length,
      sourceMessageCount: messages.length,
      sourceLastMessage: messages.at(-1),
      systemPrompt,
      toolSignature
    };
    return totalTokens;`,
    after: `    const sourceEntryRefs = this.sessionManager.getContextEntryRefs(messages);
    const projected = await this._projectContext("budget", messages, sourceEntryRefs);
    const fullMessageTokens = projected.messages.reduce((total, message) => total + estimateTokens2(message), 0);
    const systemPrompt = this.agent.state.systemPrompt ?? "";
    const tools = this.agent.state.tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
    const toolSignature = JSON.stringify(tools);
    const systemTokens = Math.ceil(systemPrompt.length / 4);
    const toolTokens = Math.ceil(toolSignature.length / 4);
    let messageTokens = fullMessageTokens;
    let totalTokens = systemTokens + toolTokens + messageTokens;
    let usageAnchored = false;
    const usageAnchorMessage = estimate.lastUsageIndex === null ? void 0 : messages[estimate.lastUsageIndex];
    const usageAnchor = usageAnchorMessage?.role === "assistant" ? usageAnchorMessage.usage : void 0;
    const previousPromptTokens = usageAnchor ? Math.max(0, usageAnchor.input ?? 0) + Math.max(0, usageAnchor.cacheRead ?? 0) + Math.max(0, usageAnchor.cacheWrite ?? 0) : 0;
    const previousEstimate = this._providerContextEstimate;
    if (estimate.lastUsageIndex !== null && previousPromptTokens > 0 &&
      previousEstimate?.systemPrompt === systemPrompt && previousEstimate.toolSignature === toolSignature) {
      const anchorEntryId = sourceEntryRefs.find((ref) => ref.messageIndex === estimate.lastUsageIndex)?.entryId;
      const projectedAnchorIndex = anchorEntryId === void 0 ? void 0 : projected.entryRefs?.find((ref) => ref.entryId === anchorEntryId)?.messageIndex;
      if (projectedAnchorIndex !== void 0) {
        const suffixTokens = projected.messages.slice(projectedAnchorIndex + 1).reduce((total, message) => total + estimateTokens2(message), 0);
        totalTokens = previousPromptTokens + suffixTokens;
        messageTokens = Math.max(0, totalTokens - systemTokens - toolTokens);
        usageAnchored = true;
      }
    }
    this._providerContextEstimate = {
      messageTokens,
      systemTokens,
      toolTokens,
      totalTokens,
      projectedMessageCount: projected.messages.length,
      sourceMessageCount: messages.length,
      sourceLastMessage: messages.at(-1),
      systemPrompt,
      toolSignature,
      usageAnchored
    };
    return totalTokens;`,
  },
  {
    name: "bundled provider prompt usage excludes billed output",
    supersededBy: "const previousPromptTokens = usageAnchor",
    before: `    const sourceEntryRefs = this.sessionManager.getContextEntryRefs(messages);
    const projected = await this._projectContext("budget", messages, sourceEntryRefs);
    const fullMessageTokens = projected.messages.reduce((total, message) => total + estimateTokens2(message), 0);
    const systemPrompt = this.agent.state.systemPrompt ?? "";
    const tools = this.agent.state.tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
    const toolSignature = JSON.stringify(tools);
    const systemTokens = Math.ceil(systemPrompt.length / 4);
    const toolTokens = Math.ceil(toolSignature.length / 4);
    let messageTokens = fullMessageTokens;
    let totalTokens = systemTokens + toolTokens + messageTokens;
    let usageAnchored = false;
    const previousEstimate = this._providerContextEstimate;
    if (estimate.lastUsageIndex !== null && estimate.usageTokens > 0 &&
      previousEstimate?.systemPrompt === systemPrompt && previousEstimate.toolSignature === toolSignature) {
      const anchorEntryId = sourceEntryRefs.find((ref) => ref.messageIndex === estimate.lastUsageIndex)?.entryId;
      const projectedAnchorIndex = anchorEntryId === void 0 ? void 0 : projected.entryRefs?.find((ref) => ref.entryId === anchorEntryId)?.messageIndex;
      if (projectedAnchorIndex !== void 0) {
        const suffixTokens = projected.messages.slice(projectedAnchorIndex + 1).reduce((total, message) => total + estimateTokens2(message), 0);
        totalTokens = estimate.usageTokens + suffixTokens;
        messageTokens = Math.max(0, totalTokens - systemTokens - toolTokens);
        usageAnchored = true;
      }
    }
    this._providerContextEstimate = {
      messageTokens,
      systemTokens,
      toolTokens,
      totalTokens,
      projectedMessageCount: projected.messages.length,
      sourceMessageCount: messages.length,
      sourceLastMessage: messages.at(-1),
      systemPrompt,
      toolSignature,
      usageAnchored
    };
    return totalTokens;`,
    after: `    const sourceEntryRefs = this.sessionManager.getContextEntryRefs(messages);
    const projected = await this._projectContext("budget", messages, sourceEntryRefs);
    const fullMessageTokens = projected.messages.reduce((total, message) => total + estimateTokens2(message), 0);
    const systemPrompt = this.agent.state.systemPrompt ?? "";
    const tools = this.agent.state.tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
    const toolSignature = JSON.stringify(tools);
    const systemTokens = Math.ceil(systemPrompt.length / 4);
    const toolTokens = Math.ceil(toolSignature.length / 4);
    let messageTokens = fullMessageTokens;
    let totalTokens = systemTokens + toolTokens + messageTokens;
    let usageAnchored = false;
    const usageAnchorMessage = estimate.lastUsageIndex === null ? void 0 : messages[estimate.lastUsageIndex];
    const usageAnchor = usageAnchorMessage?.role === "assistant" ? usageAnchorMessage.usage : void 0;
    const previousPromptTokens = usageAnchor ? Math.max(0, usageAnchor.input ?? 0) + Math.max(0, usageAnchor.cacheRead ?? 0) + Math.max(0, usageAnchor.cacheWrite ?? 0) : 0;
    const previousEstimate = this._providerContextEstimate;
    if (estimate.lastUsageIndex !== null && previousPromptTokens > 0 &&
      previousEstimate?.systemPrompt === systemPrompt && previousEstimate.toolSignature === toolSignature) {
      const anchorEntryId = sourceEntryRefs.find((ref) => ref.messageIndex === estimate.lastUsageIndex)?.entryId;
      const projectedAnchorIndex = anchorEntryId === void 0 ? void 0 : projected.entryRefs?.find((ref) => ref.entryId === anchorEntryId)?.messageIndex;
      if (projectedAnchorIndex !== void 0) {
        const suffixTokens = projected.messages.slice(projectedAnchorIndex + 1).reduce((total, message) => total + estimateTokens2(message), 0);
        totalTokens = previousPromptTokens + suffixTokens;
        messageTokens = Math.max(0, totalTokens - systemTokens - toolTokens);
        usageAnchored = true;
      }
    }
    this._providerContextEstimate = {
      messageTokens,
      systemTokens,
      toolTokens,
      totalTokens,
      projectedMessageCount: projected.messages.length,
      sourceMessageCount: messages.length,
      sourceLastMessage: messages.at(-1),
      systemPrompt,
      toolSignature,
      usageAnchored
    };
    return totalTokens;`,
  },
  {
    name: "bundled synchronous cached provider context usage",
    supersededBy: "const providerEstimate = this._providerContextEstimate;",
    before: `    const branchEntries2 = this.sessionManager.getBranch();
    const latestCompaction = getLatestCompactionEntry(branchEntries2);
    if (latestCompaction) {
      const compactionIndex = branchEntries2.lastIndexOf(latestCompaction);
      let hasPostCompactionUsage = false;
      for (let i = branchEntries2.length - 1; i > compactionIndex; i--) {
        const entry = branchEntries2[i];
        if (entry.type === "message" && entry.message.role === "assistant") {
          const assistant = entry.message;
          if (assistant.stopReason !== "aborted" && assistant.stopReason !== "error") {
            const contextTokens = calculateContextTokens(assistant.usage);
            if (contextTokens > 0) {
              hasPostCompactionUsage = true;
            }
            break;
          }
        }
      }
      if (!hasPostCompactionUsage) {
        return { tokens: null, contextWindow, percent: null };
      }
    }
    const estimate = estimateContextTokens(this.messages);
    const percent = estimate.tokens / contextWindow * 100;
    return {
      tokens: estimate.tokens,
      contextWindow,
      percent
    };`,
    after: `    const messages = this.agent.state.messages;
    const systemPrompt = this.agent.state.systemPrompt ?? "";
    const tools = this.agent.state.tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
    const toolSignature = JSON.stringify(tools);
    const providerEstimate = this._providerContextEstimate;
    const cacheValid = providerEstimate !== void 0 &&
      providerEstimate.sourceMessageCount === messages.length &&
      providerEstimate.sourceLastMessage === messages.at(-1) &&
      providerEstimate.systemPrompt === systemPrompt &&
      providerEstimate.toolSignature === toolSignature;
    const messageTokens = cacheValid ? providerEstimate.messageTokens : messages.reduce((total, message) => total + estimateTokens2(message), 0);
    const systemTokens = cacheValid ? providerEstimate.systemTokens : Math.ceil(systemPrompt.length / 4);
    const toolTokens = cacheValid ? providerEstimate.toolTokens : Math.ceil(toolSignature.length / 4);
    const totalTokens = messageTokens + systemTokens + toolTokens;
    return {
      tokens: totalTokens,
      contextWindow,
      percent: totalTokens / contextWindow * 100,
      messageTokens,
      systemTokens,
      toolTokens,
      totalTokens,
      projectedMessageCount: cacheValid ? providerEstimate.projectedMessageCount : messages.length
    };`,
  },
]);

// Disabling automatic refinement invalidates and clears already pending automatic work.
applyPatches("dist/core/agent-session.js", [
  {
    name: "clear pending automatic refinement work",
    before: `    setAutomaticRefinementEnabled(enabled) {
        this._automaticRefinementEnabled = enabled;
    }`,
    after: `    setAutomaticRefinementEnabled(enabled) {
        this._automaticRefinementEnabled = enabled;
        if (enabled !== false)
            return;
        this._autoRefineBranchVersion++;
        this._autoRefineReviewAbort?.abort();
        if (this._autoRefineInProgress)
            this._refineAbortController?.abort();
        this._pendingAutoRefineReview = undefined;
        this._compactAutoRefinePending = false;
        this._turnIntervalAutoRefinePending = false;
        for (const timer of this._scheduledAutoRefineTimers)
            clearTimeout(timer);
        this._scheduledAutoRefineTimers.clear();
    }`,
  },
]);

applyPatches(findBundledCliChunk(), [
  {
    name: "bundled clear pending automatic refinement work",
    before: `  setAutomaticRefinementEnabled(enabled) {
    this._automaticRefinementEnabled = enabled;
  }`,
    after: `  setAutomaticRefinementEnabled(enabled) {
    this._automaticRefinementEnabled = enabled;
    if (enabled !== false)
      return;
    this._autoRefineBranchVersion++;
    this._autoRefineReviewAbort?.abort();
    if (this._autoRefineInProgress)
      this._refineAbortController?.abort();
    this._pendingAutoRefineReview = void 0;
    this._compactAutoRefinePending = false;
    this._turnIntervalAutoRefinePending = false;
    for (const timer of this._scheduledAutoRefineTimers)
      clearTimeout(timer);
    this._scheduledAutoRefineTimers.clear();
  }`,
  },
]);

// Provider usage anchors may only cross the exact projection that produced them.
applyPatches("dist/core/extensions/runner.js", [
  {
    name: "projection identity accumulator",
    before: `        let currentMessages = messages;
        let currentEntryRefs = entryRefs;
        for (const ext of this.extensions) {`,
    after: `        let currentMessages = messages;
        let currentEntryRefs = entryRefs;
        let currentProjectionIdentity;
        for (const ext of this.extensions) {`,
  },
  {
    name: "projection identity result propagation",
    before: `                    else if (handlerResult.entryRefs !== undefined) {
                        currentEntryRefs = handlerResult.entryRefs;
                    }
                }`,
    after: `                    else if (handlerResult.entryRefs !== undefined) {
                        currentEntryRefs = handlerResult.entryRefs;
                    }
                    if (typeof handlerResult.projectionIdentity === "string") {
                        currentProjectionIdentity = handlerResult.projectionIdentity;
                    }
                    else if (handlerResult.messages !== undefined || handlerResult.entryRefs !== undefined) {
                        currentProjectionIdentity = undefined;
                    }
                }`,
  },
  {
    name: "projection identity runner return",
    before: `        return { messages: currentMessages, entryRefs: currentEntryRefs };`,
    after: `        return {
            messages: currentMessages,
            entryRefs: currentEntryRefs,
            ...(currentProjectionIdentity === undefined ? {} : { projectionIdentity: currentProjectionIdentity }),
        };`,
  },
]);

applyPatches("dist/core/extensions/types.d.ts", [
  {
    name: "projection identity model context result type",
    before: `export interface ModelContextEventResult {
    messages?: Message[];
    entryRefs?: ContextEntryRef[];
}`,
    after: `export interface ModelContextEventResult {
    messages?: Message[];
    entryRefs?: ContextEntryRef[];
    projectionIdentity?: string;
}`,
  },
]);

applyPatches("dist/core/extensions/runner.d.ts", [
  {
    name: "projection identity runner result type",
    before: `        messages: Message[];
        entryRefs?: ContextEntryRef[];
    }>;`,
    after: `        messages: Message[];
        entryRefs?: ContextEntryRef[];
        projectionIdentity?: string;
    }>;`,
  },
]);

applyPatches("dist/core/agent-session.js", [
  {
    name: "provider anchor requires projection identity",
    before: `        if (estimate.lastUsageIndex !== null && previousPromptTokens > 0 &&
            previousEstimate?.systemPrompt === systemPrompt && previousEstimate.toolSignature === toolSignature) {`,
    after: `        if (estimate.lastUsageIndex !== null && previousPromptTokens > 0 &&
            projected.projectionIdentity !== undefined &&
            previousEstimate?.projectionIdentity === projected.projectionIdentity &&
            previousEstimate.systemPrompt === systemPrompt && previousEstimate.toolSignature === toolSignature) {`,
  },
  {
    name: "cache provider projection identity",
    before: `            toolSignature,
            usageAnchored,
        };`,
    after: `            toolSignature,
            projectionIdentity: projected.projectionIdentity,
            usageAnchored,
        };`,
  },
]);

applyPatches(findBundledCliChunk(), [
  {
    name: "bundled projection identity accumulator",
    before: `    let currentMessages = messages;
    let currentEntryRefs = entryRefs;
    for (const ext of this.extensions) {`,
    after: `    let currentMessages = messages;
    let currentEntryRefs = entryRefs;
    let currentProjectionIdentity;
    for (const ext of this.extensions) {`,
  },
  {
    name: "bundled projection identity result propagation",
    before: `          } else if (handlerResult.entryRefs !== void 0) {
            currentEntryRefs = handlerResult.entryRefs;
          }
        } catch (err) {`,
    after: `          } else if (handlerResult.entryRefs !== void 0) {
            currentEntryRefs = handlerResult.entryRefs;
          }
          if (typeof handlerResult.projectionIdentity === "string") {
            currentProjectionIdentity = handlerResult.projectionIdentity;
          } else if (handlerResult.messages !== void 0 || handlerResult.entryRefs !== void 0) {
            currentProjectionIdentity = void 0;
          }
        } catch (err) {`,
  },
  {
    name: "bundled projection identity runner return",
    before: `    return { messages: currentMessages, entryRefs: currentEntryRefs };`,
    after: `    return {
      messages: currentMessages,
      entryRefs: currentEntryRefs,
      ...currentProjectionIdentity === void 0 ? {} : { projectionIdentity: currentProjectionIdentity }
    };`,
  },
  {
    name: "bundled provider anchor requires projection identity",
    before: `    if (estimate.lastUsageIndex !== null && previousPromptTokens > 0 &&
      previousEstimate?.systemPrompt === systemPrompt && previousEstimate.toolSignature === toolSignature) {`,
    after: `    if (estimate.lastUsageIndex !== null && previousPromptTokens > 0 &&
      projected.projectionIdentity !== void 0 &&
      previousEstimate?.projectionIdentity === projected.projectionIdentity &&
      previousEstimate.systemPrompt === systemPrompt && previousEstimate.toolSignature === toolSignature) {`,
  },
  {
    name: "bundled cache provider projection identity",
    before: `      toolSignature,
      usageAnchored
    };`,
    after: `      toolSignature,
      projectionIdentity: projected.projectionIdentity,
      usageAnchored
    };`,
  },
]);

applyPatches("dist/core/agent-session.js", [
  {
    name: "automatic refinement prompt state",
    before: `            harnessState: this._loadMergedHarnessState(),`,
    after: `            harnessState: Object.assign(this._loadMergedHarnessState(), {
                automaticRefinementEnabled: this._automaticRefinementEnabled !== false,
            }),`,
  },
]);

applyPatches("dist/core/refinement/refinement.js", [
  {
    name: "empty harness prompt and automatic refinement mode",
    before: `export function formatHarnessStateForPrompt(state, options = {}) {
    const maxEntriesPerKind = options.maxEntriesPerKind ?? DEFAULT_OVERVIEW_ENTRY_LIMIT;`,
    after: `export function formatHarnessStateForPrompt(state, options = {}) {
    const savedEntryCount = Object.values(state.entries).reduce((total, entries) => total + Object.keys(entries).length, 0);
    if (savedEntryCount === 0)
        return "";
    const automaticRefinementEnabled = state.automaticRefinementEnabled !== false;
    const maxEntriesPerKind = options.maxEntriesPerKind ?? DEFAULT_OVERVIEW_ENTRY_LIMIT;`,
  },
  {
    name: "capture concise harness entries",
    before: `    ];
    let totalEntries = 0;`,
    after: `    ];
    const genericLineCount = lines.length;
    let totalEntries = 0;`,
  },
  {
    name: "separate harness entries from refinement history",
    before: `    if (totalEntries === 0) {`,
    after: `    const conciseEntryLines = lines.slice(genericLineCount);
    if (totalEntries === 0) {`,
  },
  {
    name: "omit disabled automatic refinement prompt overhead",
    before: `    return lines.join("\\n").trim();`,
    after: `    if (!automaticRefinementEnabled)
        return ["# Continual Harness State", "", "Saved entries:", "", ...conciseEntryLines].join("\\n").trim();
    return lines.join("\\n").trim();`,
  },
]);

applyPatches(findBundledCliChunk(), [
  {
    name: "bundled automatic refinement prompt state",
    before: `      harnessState: this._loadMergedHarnessState(),`,
    after: `      harnessState: Object.assign(this._loadMergedHarnessState(), {
        automaticRefinementEnabled: this._automaticRefinementEnabled !== false
      }),`,
  },
  {
    name: "bundled empty harness prompt and automatic refinement mode",
    before: `function formatHarnessStateForPrompt(state, options = {}) {
  const maxEntriesPerKind = options.maxEntriesPerKind ?? DEFAULT_OVERVIEW_ENTRY_LIMIT;`,
    after: `function formatHarnessStateForPrompt(state, options = {}) {
  const savedEntryCount = Object.values(state.entries).reduce((total, entries) => total + Object.keys(entries).length, 0);
  if (savedEntryCount === 0)
    return "";
  const automaticRefinementEnabled = state.automaticRefinementEnabled !== false;
  const maxEntriesPerKind = options.maxEntriesPerKind ?? DEFAULT_OVERVIEW_ENTRY_LIMIT;`,
  },
  {
    name: "bundled capture concise harness entries",
    before: `  ];
  let totalEntries = 0;`,
    after: `  ];
  const genericLineCount = lines.length;
  let totalEntries = 0;`,
  },
  {
    name: "bundled separate harness entries from refinement history",
    before: `  if (totalEntries === 0) {`,
    after: `  const conciseEntryLines = lines.slice(genericLineCount);
  if (totalEntries === 0) {`,
  },
  {
    name: "bundled omit disabled automatic refinement prompt overhead",
    before: `  return lines.join("\\n").trim();`,
    after: `  if (!automaticRefinementEnabled)
    return ["# Continual Harness State", "", "Saved entries:", "", ...conciseEntryLines].join("\\n").trim();
  return lines.join("\\n").trim();`,
  },
]);

if (!stockOnly && !checkOnly) {
  for (const [path, text] of pendingWrites) {
    writeFileSync(path, text);
  }
}

console.log(
  `${stockOnly ? "verified stock" : checkOnly ? "verified" : "ready"} prime-agent@${SUPPORTED_VERSION} awaited turn_end and purpose-aware context projection surfaces`,
);
