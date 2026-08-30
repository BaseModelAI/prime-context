import { describe, expect, it } from "vitest";
import {
  appendTemporaryAnchor,
  mapStableControlMessages,
  matchingAnchorInMessages,
  persistentControlMessage,
  renderPrimeContextAnchor,
  renderPrimeContextState,
  rankWorkingSet,
  type ContextMessageLike,
} from "../src/context.js";
import { applyRequirementDeltas, createTaskRuntime, previewTaskContract } from "../src/runtime.js";
import {
  PRIME_CONTEXT_ANCHOR_TYPE,
  type TaskSnapshotV1,
} from "../src/state.js";

const snapshot: TaskSnapshotV1 = {
  schema: "prime-context.task-snapshot/v1",
  focus: "ship Step E",
  openItems: [{ id: "item_1", text: "Keep the control plane stable" }],
  pinnedObservationIds: ["obs_1"],
  updatedAt: "ignored",
};

describe("persistent control rendering", () => {
  it("renders a stable anchor only from semantic contract fields", () => {
    const base = createTaskRuntime({ taskKey: "goal-1", goalId: "goal-1", objective: "Implement Step E", source: "goal" });
    const preview = previewTaskContract(base, "Do not edit benchmarks/**; run npm run typecheck.").runtime;
    const runtime = {
      ...preview,
      validationGates: [{ key: "suite:npm-typecheck:all", suiteFamily: "npm-typecheck", target: "all", source: "explicit-user-command" as const }],
    };
    const first = renderPrimeContextAnchor({ taskKey: "goal-1", objective: "Implement Step E", runtime, snapshot });
    const repeated = renderPrimeContextAnchor({ taskKey: "goal-1", objective: "Implement Step E", runtime, snapshot });
    const changedRuntime = previewTaskContract(runtime, "Also preserve images.").runtime;
    const changed = renderPrimeContextAnchor({ taskKey: "goal-1", objective: "Implement Step E", runtime: changedRuntime, snapshot });

    expect(repeated).toEqual(first);
    expect(changed.content).not.toBe(first.content);
    expect(first.content).toMatch(/objective:[\s\S]*requirements_revision:[\s\S]*constraints:[\s\S]*required_gates:[\s\S]*protected_paths:[\s\S]*durable_focus:/);
    expect(first.content).not.toMatch(/timestamp|context percentage|token budget/);
  });

  it("renders a bounded RLM child anchor with lazy parent refs", () => {
    const runtime = createTaskRuntime({ taskKey: "child-task", objective: "Implement the parser", source: "user" });
    const child = renderPrimeContextAnchor({
      taskKey: "child-task",
      objective: "Implement the parser",
      runtime,
      snapshot: { ...snapshot, focus: "", openItems: [], pinnedObservationIds: [] },
      child: {
        parentSessionId: "parent-session",
        parentRefs: Array.from({ length: 10 }, (_, index) => `o${index + 1}:result`),
        relevantPaths: ["src/parser.ts", "test/parser.test.ts"],
        constraints: ["Only edit the parser.", "Do not change the API."],
      },
    });
    expect(child.content).toContain("child_context:");
    expect(child.content).toContain("parent_session: parent-session");
    expect(child.content).toContain("src/parser.ts");
    expect(child.content).toContain("Only edit the parser.");
    expect(child.content).toContain("current validation facts, and child refs");
    expect(child.content).toContain("o8:result");
    expect(child.content).not.toContain("o9:result");
  });

  it("keeps the state checkpoint byte-stable when only turnSequence changes", () => {
    const runtime = createTaskRuntime({ taskKey: "task-1", source: "user" });
    const first = renderPrimeContextState(runtime);
    const sameFacts = renderPrimeContextState({ ...runtime, turnSequence: 99 });
    const changed = renderPrimeContextState({ ...runtime, requirementsLocked: true });
    const ready = renderPrimeContextState({
      ...runtime,
      requirementsLocked: true,
      validationGates: [{
        key: "suite:pytest:tests",
        suiteFamily: "pytest",
        target: "tests",
        source: "explicit-user-command" as const,
      }],
      validations: [{
        suite: { family: "pytest", target: "tests", scope: "broad" as const },
        status: "success" as const,
        summary: "9 passed",
        total: 9,
        requirementsRevision: runtime.requirementsRevision,
        workspaceRevision: runtime.workspaceRevision,
        turnSequence: 1,
      }],
    });

    expect(sameFacts.content).toBe(first.content);
    expect(changed.content).not.toBe(first.content);
    expect(first.content).toContain("readiness: NOT_READY");
    expect(ready.content).toContain("readiness: GOAL_READY");
    expect(first.content).not.toContain("turnSequence");
  });

  it("renders per-gate stale resources and ranks the typed working set", () => {
    const committed = applyRequirementDeltas(
      createTaskRuntime({ taskKey: "task", objective: "Ship Step G", source: "user" }),
      [{ id: "u2", text: "Touch `src/steered.ts` only." }],
    ).runtime;
    const runtime = {
      ...committed,
      workspaceRevision: 3,
      validationGates: [
        { key: "suite:pytest:tests", suiteFamily: "pytest", target: "tests", source: "explicit-user-command" as const },
        { key: "suite:tsc:all", suiteFamily: "tsc", target: "all", source: "explicit-user-command" as const },
      ],
      validations: [
        { suite: { family: "pytest", target: "tests", scope: "broad" as const }, status: "failure" as const, summary: "failed", requirementsRevision: 1, workspaceRevision: 1, turnSequence: 1 },
        { suite: { family: "tsc", target: "all", scope: "broad" as const }, status: "success" as const, summary: "clean", requirementsRevision: 1, workspaceRevision: 2, turnSequence: 2 },
      ],
      modifiedResources: [
        { path: "src/newer.ts", revision: 3 },
        { path: "src/older.ts", revision: 2 },
      ],
      activeDiagnostics: [{
        id: "d1", summary: "src/failure.ts:8", suiteFamily: "pytest", resources: ["src/failure.ts"],
        exchangeId: "o9", workspaceRevision: 1, state: "awaiting-rerun" as const,
      }],
    };
    const state = renderPrimeContextState(runtime, snapshot).content;
    const pytest = state.split("\n").find((line) => line.includes("pytest:tests="));
    const tsc = state.split("\n").find((line) => line.includes("tsc:all="));

    expect(pytest).toContain("modified=src/newer.ts, src/older.ts");
    expect(tsc).toContain("modified=src/newer.ts");
    expect(state).toContain("ref=o9:result");
    expect(state).toContain("next_obligation: rerun current pytest gate");
    expect(rankWorkingSet(runtime, snapshot).slice(0, 4)).toEqual([
      "src/failure.ts", "src/newer.ts", "src/older.ts", "src/steered.ts",
    ]);
    expect(state).not.toMatch(/timestamp|full command|raw log/i);

    const hugePath = `src/${"a".repeat(100_000)}.ts`;
    const zeroBudget = applyRequirementDeltas(
      createTaskRuntime({ taskKey: "bounded", objective: "Keep objective exact", source: "user" }),
      [{ id: "huge", text: `Only touch \`${hugePath}\`.` }],
      0,
    ).runtime;
    expect(zeroBudget.steeringResources).toEqual([]);
    const hugeState = renderPrimeContextState({
      ...zeroBudget,
      modifiedResources: [{ path: hugePath, revision: 1 }],
      workspaceRevision: 1,
    }).content;
    expect(Buffer.byteLength(hugeState, "utf8")).toBeLessThan(2048);
    expect(hugeState).toContain("…");
    expect(hugeState).toContain('objective: &quot;Keep objective exact&quot;');
  });
});

describe("prefix-stable control mapping", () => {
  it("maps appended goal and IPython notices without deleting or changing the prior prefix", () => {
    const image = { type: "image", data: "abc", mimeType: "image/png" };
    const firstGoal: ContextMessageLike = {
      role: "custom",
      customType: "goal_context",
      content: [{ type: "text", text: "<goal_context>\n- remaining tokens: 100\n</goal_context>" }, image],
      details: { goalId: "g1", objective: "Build it", status: "active", continuationsUsed: 0 },
    };
    const nextGoal: ContextMessageLike = {
      role: "custom",
      customType: "goal_context",
      content: "<goal_context>\n- remaining tokens: 80\n</goal_context>",
      details: { goalId: "g1", objective: "Build it", status: "active", continuationsUsed: 1 },
    };
    const ipython: ContextMessageLike = {
      role: "custom",
      customType: "ipython_state_restored",
      content: "These names are available again: alpha, beta.\nThese could not be restored and must be recreated if needed: gamma.",
    };
    const compactedIpython: ContextMessageLike = {
      role: "custom",
      customType: "ipython_state",
      content: "Variables above the per-variable snapshot limit were removed: huge. These names are still defined: alpha, beta.",
    };
    const prefix = mapStableControlMessages([firstGoal]);
    const appended = mapStableControlMessages([firstGoal, nextGoal, ipython, compactedIpython]);
    const secondPass = mapStableControlMessages(appended);

    expect(appended).toHaveLength(4);
    expect(secondPass).toEqual(appended);
    expect(JSON.stringify(secondPass)).toBe(JSON.stringify(appended));
    expect(appended[0]).toEqual(prefix[0]);
    expect(JSON.stringify(appended[1].content)).toContain("goal_tick");
    expect(JSON.stringify(appended[1].content)).toContain("remaining_tokens=\\\"80\\\"");
    expect(JSON.stringify(appended[0].content)).toContain("image/png");
    expect(String(appended[2].content)).toContain('available="2" failed="1" pruned="0"');
    expect(String(appended[3].content)).toContain('available="2" failed="0" pruned="1"');
  });

  it("projects one temporary anchor until the matching persisted anchor appears", () => {
    const runtime = createTaskRuntime({ taskKey: "goal-1", goalId: "goal-1", objective: "Build it", source: "goal" });
    const anchor = renderPrimeContextAnchor({ taskKey: "goal-1", objective: "Build it", runtime, snapshot });
    const base: ContextMessageLike[] = [{ role: "user", content: "continue" }];
    const temporary = appendTemporaryAnchor(base, anchor);
    const repeated = appendTemporaryAnchor(temporary, anchor);
    const persisted = persistentControlMessage(PRIME_CONTEXT_ANCHOR_TYPE, anchor, 1);
    const unscoped = {
      ...persisted,
      details: { ...anchor.details, taskKey: undefined },
    };

    expect(temporary).toHaveLength(2);
    expect(repeated).toBe(temporary);
    expect(matchingAnchorInMessages(temporary, anchor)).toBe(false);
    expect(matchingAnchorInMessages([...base, persisted], anchor)).toBe(true);
    expect(matchingAnchorInMessages([unscoped, ...base], anchor, { allowUnscopedAfterLatestUser: true })).toBe(false);
    expect(matchingAnchorInMessages([...base, unscoped], anchor)).toBe(false);
    expect(matchingAnchorInMessages([...base, unscoped], anchor, { allowUnscopedAfterLatestUser: true })).toBe(true);
    expect(appendTemporaryAnchor([...base, persisted], anchor)).toHaveLength(2);
  });
});
