import { describe, expect, it } from "vitest";
import {
  mapStableControlMessages,
  projectStableControlMessages,
  renderPrimeContextAnchor,
  renderPrimeContextTask,
  renderPrimeContextUpdate,
  type ContextMessageLike,
} from "../src/context.js";
import {
  createTaskSnapshotV2,
  type TaskSnapshotV2,
} from "../src/state.js";

function task(overrides: Partial<TaskSnapshotV2> = {}): TaskSnapshotV2 {
  return {
    ...createTaskSnapshotV2("goal-1", "Build it", "u1"),
    ...overrides,
  };
}

describe("descriptive task controls", () => {
  it("renders only bounded TaskSnapshotV2 facts", () => {
    const snapshot = task({
      explicitConstraints: [{ id: "c1", text: "Never edit vendor/**", sourceEntryId: "u1" }],
      focus: "Implement parser",
      openItems: [{ id: "i1", text: "Handle empty input" }],
      pinnedObservationIds: ["o1"],
    });
    const first = renderPrimeContextAnchor({ task: snapshot });
    const second = renderPrimeContextAnchor({ task: structuredClone(snapshot) });

    expect(second).toEqual(first);
    expect(first.content).toContain('objective: &quot;Build it&quot;');
    expect(first.content).toContain('Never edit vendor/**');
    expect(first.content).toContain('protected_paths:');
    expect(first.content).not.toMatch(/readiness|next_obligation|requirements_revision|validation_gates/);
    expect(first.details).toEqual({ schema: "prime_context_anchor/v1", taskKey: "goal-1" });
  });

  it("renders a bounded child context and descriptive delta", () => {
    const previous = task();
    const current = task({
      focus: "Parser",
      openItems: [{ id: "i1", text: "Handle edge" }],
      actionableObservations: [{ text: "Failure at parser.py:8", observationRef: "o9" }],
    });
    const anchor = renderPrimeContextAnchor({
      task: current,
      child: {
        parentSessionId: "parent",
        parentRefs: Array.from({ length: 20 }, (_, index) => `o${index}`),
        relevantPaths: ["src/parser.py"],
        constraints: ["Do not edit vendor/**"],
      },
    });
    const packet = renderPrimeContextTask(current, { objectiveVisible: false });
    const update = renderPrimeContextUpdate(previous, current);

    expect(anchor.content.match(/^  - o/gm)?.length).toBeLessThanOrEqual(8);
    expect(anchor.content).toContain("parent_lookup:");
    expect(packet).toContain("<prime_context_task>");
    expect(update).toContain("<prime_context_update>");
    expect(update).toContain("Failure at parser.py:8");
  });
});

describe("bounded control projection", () => {
  it("keeps media controls and only the latest self-contained text state per goal", () => {
    const image = { type: "image", data: "abc", mimeType: "image/png" };
    const mediaGoal: ContextMessageLike = {
      role: "custom",
      customType: "goal_context",
      content: [{ type: "text", text: "<goal_context>\n- remaining tokens: 100\n</goal_context>" }, image],
      details: { goalId: "g1", objective: "Build it", status: "active", continuationsUsed: 0 },
    };
    const continuation = (remaining: number, used: number): ContextMessageLike => ({
      role: "custom",
      customType: "goal_context",
      content: `<goal_context>\n- remaining tokens: ${remaining}\n</goal_context>`,
      details: { goalId: "g1", objective: "Build it", status: "active", continuationsUsed: used },
    });
    const ipython: ContextMessageLike = {
      role: "custom",
      customType: "ipython_state_restored",
      content: "These names are available again: alpha, beta.\nThese could not be restored and must be recreated if needed: gamma.",
    };
    const projected = projectStableControlMessages([
      mediaGoal,
      continuation(80, 1),
      continuation(60, 2),
      ipython,
    ]);

    expect(projected.retainedIndexes).toEqual([0, 2, 3]);
    expect(JSON.stringify(projected.messages[0].content)).toContain("image/png");
    expect(String(projected.messages[1].content)).toContain('<goal_state id="g1" status="active" continuation="2" remaining_tokens="60">');
    expect(String(projected.messages[1].content)).toContain('objective: &quot;Build it&quot;');
    expect(String(projected.messages[2].content)).toContain('available="2" failed="1" pruned="0"');
    expect(mapStableControlMessages(projected.messages)).toEqual(projected.messages);
  });
});
