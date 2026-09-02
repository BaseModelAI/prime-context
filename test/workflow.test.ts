import { describe, expect, it } from "vitest";
import type { ExchangeFacts } from "../src/exchange.js";
import { createTaskSnapshotV2 } from "../src/state.js";
import {
  EXACT_REPEAT_HINT,
  applyProgressEffects,
  createExactRepeatHintState,
  detectStallSignature,
  hasStrongExactRepeat,
  observeExactRepeatHint,
} from "../src/workflow.js";

function facts(sourceOrder: number, progress: ExchangeFacts["progress"], text = "same"): ExchangeFacts {
  return {
    sourceOrder,
    toolCallId: `t${sourceOrder}`,
    toolName: "read",
    originalInput: { path: "a.py" },
    executedInput: { path: "a.py" },
    text,
    textBytes: Buffer.byteLength(text),
    intent: { subjectKey: "path:a.py" },
    progress,
  } as ExchangeFacts;
}

describe("descriptive task progress", () => {
  it("applies canonical effects in host source order", () => {
    const snapshot = createTaskSnapshotV2("task", "Fix it");
    const updated = applyProgressEffects(snapshot, [
      facts(2, { kind: "failure", observation: { text: "second" } }),
      facts(1, { kind: "information", observations: [{ text: "first" }] }),
    ]);
    expect(updated.actionableObservations.map((item) => item.text)).toEqual(["first", "second"]);
  });

  it("emits one hint for a consecutive exact repeat and resets on new evidence", () => {
    const exchange = facts(1, { kind: "information", observations: [{ text: "seen" }] });
    const context = { taskKey: "task", contextEpoch: 1 };
    const first = observeExactRepeatHint(createExactRepeatHintState("task", 1), exchange, context);
    const second = observeExactRepeatHint(first.state, exchange, context);
    const third = observeExactRepeatHint(second.state, exchange, context);
    const reset = observeExactRepeatHint(third.state, exchange, { ...context, intervening: "evidence" as const });
    expect(first.hint).toBeUndefined();
    expect(second.hint).toBe(EXACT_REPEAT_HINT);
    expect(third.hint).toBeUndefined();
    expect(hasStrongExactRepeat(third.state)).toBe(true);
    expect(reset.hint).toBeUndefined();
  });

  it("detects bounded persistent-error, oscillation, and stale-retrieval signatures", () => {
    expect(detectStallSignature([
      { action: "edit:a", decisiveObservation: "mutation:a" },
      { action: "test:a", decisiveObservation: "error:E" },
      { action: "edit:b", decisiveObservation: "mutation:b" },
      { action: "test:a", decisiveObservation: "error:E" },
    ])).toBe("persistent-error");
    expect(detectStallSignature([
      { action: "A", decisiveObservation: "same" }, { action: "B", decisiveObservation: "same" },
      { action: "A", decisiveObservation: "same" }, { action: "B", decisiveObservation: "same" },
    ])).toBe("oscillation");
    expect(detectStallSignature(Array.from({ length: 3 }, () => ({
      action: "read:path:a", decisiveObservation: "evidence:same",
    })))).toBe("stale-retrieval");
  });
});
