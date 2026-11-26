import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SessionStreamEvent } from "eve/client";
import {
  isLivePrefixExtension,
  planTurnPersist,
} from "../lib/chat/persist-turn.ts";

function event(type: string): SessionStreamEvent {
  return { type } as SessionStreamEvent;
}

describe("isLivePrefixExtension", () => {
  it("treats empty archived as an extension", () => {
    assert.equal(isLivePrefixExtension([], [event("a")]), true);
  });

  it("requires live to start with archived", () => {
    const a = event("a");
    const b = event("b");
    assert.equal(isLivePrefixExtension([a], [a, b]), true);
    assert.equal(isLivePrefixExtension([a], [b]), false);
  });
});

describe("planTurnPersist", () => {
  it("returns noop when nothing grew", () => {
    const live = [event("a"), event("b")];
    assert.deepEqual(
      planTurnPersist({
        archived: live,
        live,
        hydratedFromIndex: 0,
        confirmedNextIndex: 2,
        savedEventCount: 2,
        session: undefined,
      }),
      { kind: "noop" },
    );
  });

  it("appends only the unsaved tail for an ordinary extension", () => {
    const a = event("a");
    const b = event("b");
    const c = event("c");
    const plan = planTurnPersist({
      archived: [a, b],
      live: [a, b, c],
      hydratedFromIndex: 0,
      confirmedNextIndex: 2,
      savedEventCount: 2,
      session: { sessionId: "s", streamIndex: 1 } as never,
    });
    assert.equal(plan.kind, "append");
    if (plan.kind !== "append") return;
    assert.deepEqual(plan.events, [{ event: c, eventIndex: 2 }]);
    assert.equal(plan.confirmedNextIndex, 3);
    assert.equal(plan.savedEventCount, 3);
  });

  it("never snapshots when hydratedFromIndex is non-zero", () => {
    const old = event("old");
    const neu = event("new");
    const plan = planTurnPersist({
      archived: [old],
      live: [neu],
      hydratedFromIndex: 100,
      confirmedNextIndex: 101,
      savedEventCount: 1,
      session: undefined,
    });
    assert.equal(plan.kind, "append");
    if (plan.kind !== "append") return;
    assert.deepEqual(plan.events, [{ event: neu, eventIndex: 101 }]);
  });

  it("snapshots only when the prefix changed and this device has it", () => {
    const old = event("old");
    const neu = event("new");
    const plan = planTurnPersist({
      archived: [old],
      live: [neu],
      hydratedFromIndex: 0,
      confirmedNextIndex: 1,
      savedEventCount: 1,
      session: undefined,
    });
    assert.equal(plan.kind, "snapshot");
    if (plan.kind !== "snapshot") return;
    assert.deepEqual(plan.events, [old, neu]);
    assert.equal(plan.confirmedNextIndex, 2);
  });
});
