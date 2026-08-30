import { describe, expect, it } from "vitest";
import { analyzeOutcome } from "../src/capsule.js";
import { applyRequirementDeltas, createTaskRuntime } from "../src/runtime.js";
import { loadLatestRuntime, RUNTIME_STATE_ENTRY_TYPE } from "../src/state.js";
import { deriveReadiness, isRequirementsLockDeclaration, reduceTurn, type TurnExchangeFacts } from "../src/workflow.js";

const mutation: TurnExchangeFacts = {
  id: "o1",
  toolCallId: "mutation",
  sourceOrder: 0,
  completed: true,
  intent: {
    kind: "edit",
    resources: ["/work/src.ts"],
    subjectKey: "path:/work/src.ts",
    mutatesWorkspace: true,
  },
  outcome: { isError: false, outcome: analyzeOutcome("Done") },
};

const validation: TurnExchangeFacts = {
  id: "o2",
  toolCallId: "validation",
  sourceOrder: 1,
  completed: true,
  intent: {
    kind: "test",
    resources: [],
    subjectKey: "suite:pytest:all",
    suite: { family: "pytest", target: "all", scope: "broad" },
    mutatesWorkspace: false,
  },
  outcome: { isError: false, outcome: analyzeOutcome("TEST_RESULT PASS 9/9") },
};

function lockedRuntime() {
  return applyRequirementDeltas(createTaskRuntime({ taskKey: "task", source: "user" }), [{
    id: "u1",
    text: "REQUIREMENTS LOCKED. Run all tests.",
  }]).runtime;
}

describe("turn reducer", () => {
  it("uses source order and the actual sequential/parallel workspace model", () => {
    const sequential = reduceTurn(lockedRuntime(), [validation, mutation], { toolExecution: "sequential" });
    expect(sequential.runtime.workspaceRevision).toBe(1);
    expect(sequential.runtime.validations[0].workspaceRevision).toBe(1);
    expect(sequential.readiness).toBe("GOAL_READY");
    expect(sequential.exchangeRevisions).toEqual([
      { toolCallId: "mutation", workspaceRevisionAtStart: 0, workspaceRevisionAtResult: 1 },
      { toolCallId: "validation", workspaceRevisionAtStart: 1, workspaceRevisionAtResult: 1 },
    ]);

    const parallel = reduceTurn(lockedRuntime(), [validation, mutation], { toolExecution: "parallel" });
    expect(parallel.runtime.workspaceRevision).toBe(1);
    expect(parallel.runtime.validations[0].workspaceRevision).toBe(0);
    expect(parallel.readiness).toBe("NOT_READY");
    expect(parallel.runtime.recentSubjects.find((subject) => subject.intentKind === "edit")?.workspaceRevision).toBe(1);
    expect(parallel.exchangeRevisions.every((revision) =>
      revision.workspaceRevisionAtStart === 0 && revision.workspaceRevisionAtResult === 0
    )).toBe(true);
  });

  it("invalidates clean validation on a material requirement revision and never unlocks", () => {
    const clean = reduceTurn(lockedRuntime(), [validation], { toolExecution: "parallel" }).runtime;
    expect(deriveReadiness(clean)).toBe("GOAL_READY");

    const updated = applyRequirementDeltas(clean, [{ id: "u2", text: "Also preserve ordering." }]).runtime;
    expect(updated.requirementsRevision).toBe(clean.requirementsRevision + 1);
    expect(updated.requirementsLocked).toBe(true);
    expect(deriveReadiness(updated)).toBe("NOT_READY");

    const focusedValidation: TurnExchangeFacts = {
      ...validation,
      id: "o3",
      toolCallId: "focused",
      intent: {
        ...validation.intent!,
        subjectKey: "suite:pytest:tests/test_one.py",
        suite: { family: "pytest", target: "tests/test_one.py", scope: "focused" },
      },
    };
    const refreshed = reduceTurn(updated, [focusedValidation], { toolExecution: "parallel" });
    expect(refreshed.runtime.validationGates[0].target).toBe("tests/test_one.py");
    expect(refreshed.readiness).toBe("GOAL_READY");

    const question = applyRequirementDeltas(refreshed.runtime, [{ id: "u3", text: "Which tests are still failing?" }]).runtime;
    expect(question.requirementsRevision).toBe(refreshed.runtime.requirementsRevision);
    expect(question.lastProcessedUserEntryId).toBe("u3");

    const focusedFailure = {
      ...focusedValidation,
      outcome: { isError: false, outcome: analyzeOutcome("TEST_RESULT FAIL 0/1\nFAIL test_one") },
    };
    const failed = reduceTurn(question, [focusedFailure], { toolExecution: "parallel" }).runtime;
    expect(failed.activeDiagnostics).toHaveLength(1);
    const packageSuccess: TurnExchangeFacts = {
      ...validation,
      id: "o4",
      toolCallId: "package",
      intent: {
        ...validation.intent!,
        subjectKey: "suite:pytest:tests",
        suite: { family: "pytest", target: "tests", scope: "package" },
      },
    };
    const recovered = reduceTurn(failed, [packageSuccess], { toolExecution: "parallel" }).runtime;
    expect(recovered.activeDiagnostics).toEqual([]);

    expect(isRequirementsLockDeclaration("Do not complete before REQUIREMENTS LOCKED.")).toBe(false);
    expect(isRequirementsLockDeclaration("REQUIREMENTS LOCKED. Run the suite.")).toBe(true);

    const abandoned = createTaskRuntime({ taskKey: "abandoned", source: "user" });
    const selected = loadLatestRuntime([
      { type: "custom", customType: RUNTIME_STATE_ENTRY_TYPE, data: clean },
      { type: "custom", customType: RUNTIME_STATE_ENTRY_TYPE, data: abandoned },
      { type: "custom", customType: RUNTIME_STATE_ENTRY_TYPE, data: updated },
    ], "task");
    expect(selected?.requirementsRevision).toBe(updated.requirementsRevision);
    expect(selected?.taskKey).toBe("task");
  });
});
