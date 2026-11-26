import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { chatListNeedsPresencePoll } from "../lib/chat/presence-poll.ts";
import { repairSessionHydration } from "../lib/chat/hydration-prefix.ts";
import type { SessionStreamEvent } from "eve/client";

/**
 * Gate after data/state P0 work (phases A–C): unit coverage that flow UX can
 * build on without unbounded hydrate / idle poll / hydration prefix regressions.
 *
 * Flow-by-flow product QA (drawer, send, push resume, …) starts from here —
 * those E2E paths stay out of this file until each flow is polished.
 */
describe("data-state gate — presence poll", () => {
  it("polls fast when any row is working, waiting, or unread", () => {
    assert.equal(
      chatListNeedsPresencePoll([{ presence: "idle" }, { presence: "working" }]),
      true,
    );
    assert.equal(chatListNeedsPresencePoll([{ presence: "waiting" }]), true);
    assert.equal(chatListNeedsPresencePoll([{ presence: "unread" }]), true);
  });

  it("backs off when every row is idle", () => {
    assert.equal(
      chatListNeedsPresencePoll([{ presence: "idle" }, { presence: "idle" }]),
      false,
    );
    assert.equal(chatListNeedsPresencePoll([]), false);
  });
});

describe("data-state gate — hydrate prefix repair", () => {
  it("returns empty events for an empty log", () => {
    const repaired = repairSessionHydration([], undefined);
    assert.deepEqual(repaired.events, []);
  });

  it("keeps positioned events for resume", () => {
    const event = {
      type: "turn.started",
      data: {},
      meta: { position: { line: 0, index: 0 } },
    } as unknown as SessionStreamEvent;
    const repaired = repairSessionHydration([event], undefined);
    assert.equal(repaired.events.length, 1);
  });
});

describe("data-state gate — first flow checklist (manual / E2E next)", () => {
  const flows = [
    "open Recents → select chat → hydrate without full-history scan",
    "send on web → pending mark → settle clears pending",
    "mobile idle list → 30s poll; working row → 1.5s poll",
    "billing reconcile cron → pending Metronome ingest + aged sandbox_open",
  ] as const;

  for (const flow of flows) {
    it(`ready to polish: ${flow}`, () => {
      assert.ok(flow.length > 0);
    });
  }
});
