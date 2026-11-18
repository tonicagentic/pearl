import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  advanceRotation,
  DEFAULT_ROTATION_STEPS,
  missingMusclesFromSteps,
  parseMuscles,
  resolveRotationAssignment,
  serializeMuscles,
  undoRotationCompletion,
} from "@/lib/body/rotation";

describe("parseMuscles / serializeMuscles", () => {
  it("parses and dedupes valid muscles", () => {
    assert.deepEqual(parseMuscles('["chest","chest","back"]'), [
      "chest",
      "back",
    ]);
  });

  it("filters unknown values", () => {
    assert.deepEqual(parseMuscles('["chest","neck",1]'), ["chest"]);
  });

  it("round-trips", () => {
    assert.equal(
      serializeMuscles(["glutes", "quads", "glutes"]),
      '["glutes","quads"]',
    );
  });
});

describe("missingMusclesFromSteps", () => {
  it("reports muscles never covered", () => {
    const missing = missingMusclesFromSteps([
      ["chest", "shoulders"],
      ["back", "biceps"],
    ]);
    for (const m of [
      "triceps",
      "quads",
      "hamstrings",
      "glutes",
      "calves",
      "core",
    ] as const) {
      assert.ok(missing.includes(m), `expected missing ${m}`);
    }
  });

  it("is empty for the default seed", () => {
    assert.deepEqual(missingMusclesFromSteps(DEFAULT_ROTATION_STEPS), []);
  });
});

describe("resolveRotationAssignment", () => {
  const steps = DEFAULT_ROTATION_STEPS;

  it("returns empty muscles on rest days without advancing", () => {
    const a = resolveRotationAssignment({
      isTrainingDay: false,
      steps,
      nextIndex: 2,
      completedOn: null,
      date: "2026-11-18",
    });
    assert.equal(a.isTrainingDay, false);
    assert.deepEqual(a.muscles, []);
    assert.equal(a.stepIndex, 2);
    assert.equal(a.completedToday, false);
  });

  it("shows the current step when not completed", () => {
    const a = resolveRotationAssignment({
      isTrainingDay: true,
      steps,
      nextIndex: 1,
      completedOn: null,
      date: "2026-11-18",
    });
    assert.deepEqual(a.muscles, ["back", "biceps"]);
    assert.equal(a.stepIndex, 1);
    assert.equal(a.completedToday, false);
  });

  it("shows the completed step after marking trained today", () => {
    const a = resolveRotationAssignment({
      isTrainingDay: true,
      steps,
      nextIndex: 2,
      completedOn: "2026-11-18",
      date: "2026-11-18",
    });
    assert.equal(a.completedToday, true);
    assert.deepEqual(a.muscles, ["back", "biceps"]);
    assert.equal(a.stepIndex, 1);
  });
});

describe("advanceRotation", () => {
  it("advances once and records completedOn", () => {
    assert.deepEqual(
      advanceRotation({
        nextIndex: 0,
        completedOn: null,
        date: "2026-11-18",
        stepCount: 4,
      }),
      {
        nextIndex: 1,
        completedOn: "2026-11-18",
        advanced: true,
      },
    );
  });

  it("is idempotent when already completed today", () => {
    assert.deepEqual(
      advanceRotation({
        nextIndex: 1,
        completedOn: "2026-11-18",
        date: "2026-11-18",
        stepCount: 4,
      }),
      {
        nextIndex: 1,
        completedOn: "2026-11-18",
        advanced: false,
      },
    );
  });

  it("wraps around the queue", () => {
    assert.equal(
      advanceRotation({
        nextIndex: 3,
        completedOn: "2026-11-17",
        date: "2026-11-18",
        stepCount: 4,
      }).nextIndex,
      0,
    );
  });
});

describe("undoRotationCompletion", () => {
  it("rolls back only when completed today", () => {
    assert.deepEqual(
      undoRotationCompletion({
        nextIndex: 2,
        completedOn: "2026-11-18",
        date: "2026-11-18",
        stepCount: 4,
      }),
      {
        nextIndex: 1,
        completedOn: null,
        undone: true,
      },
    );
  });

  it("does nothing when not completed today", () => {
    assert.equal(
      undoRotationCompletion({
        nextIndex: 2,
        completedOn: "2026-11-17",
        date: "2026-11-18",
        stepCount: 4,
      }).undone,
      false,
    );
  });
});
