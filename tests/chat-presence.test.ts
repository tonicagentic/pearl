import assert from "node:assert/strict";
import { test } from "node:test";
import type { SessionStreamEvent } from "eve/client";
import {
  CHAT_WORKING_STALE_MS,
  chatPresence,
} from "../lib/chat/events.ts";

const at = (iso: string) =>
  ({ meta: { at: iso } }) as Pick<SessionStreamEvent, never> & {
    meta: { at: string };
  };

const started = (iso: string): SessionStreamEvent =>
  ({
    type: "turn.started",
    data: { turnId: "t1" },
    ...at(iso),
  }) as unknown as SessionStreamEvent;

const consumed = (iso: string): SessionStreamEvent =>
  ({
    type: "delivery.consumed",
    data: { deliveryId: "d1", turnId: "t1" },
    ...at(iso),
  }) as unknown as SessionStreamEvent;

const settled = (iso: string): SessionStreamEvent =>
  ({
    type: "turn.settled",
    data: { turnId: "t1", outcome: "completed" },
    ...at(iso),
  }) as unknown as SessionStreamEvent;

const opened = (
  interactionId: string,
  iso: string,
  kind: "approval" | "question" | "sign-in" = "approval",
): SessionStreamEvent =>
  ({
    type: "interaction.opened",
    data: {
      interactionId,
      subject: { callId: "call_1" },
      request:
        kind === "sign-in"
          ? { kind: "sign-in", prompt: "Connect", signIn: { name: "github" } }
          : { kind, prompt: "Allow?" },
    },
    ...at(iso),
  }) as unknown as SessionStreamEvent;

test("waiting beats an open turn", () => {
  assert.equal(
    chatPresence(
      [
        started("2026-01-01T12:00:00.000Z"),
        opened("a1", "2026-01-01T12:01:00.000Z", "question"),
      ],
      { now: Date.parse("2026-01-01T12:02:00.000Z") },
    ),
    "waiting",
  );
});

test("fresh open turn is working", () => {
  assert.equal(
    chatPresence([started("2026-01-01T12:00:00.000Z")], {
      now: Date.parse("2026-01-01T12:05:00.000Z"),
      lastReadAt: "2026-01-01T11:00:00.000Z",
    }),
    "working",
  );
  assert.equal(
    chatPresence([consumed("2026-01-01T12:00:00.000Z")], {
      now: Date.parse("2026-01-01T12:05:00.000Z"),
    }),
    "working",
  );
});

test("stale open turn is not working", () => {
  const start = "2026-01-01T12:00:00.000Z";
  const now = Date.parse(start) + CHAT_WORKING_STALE_MS + 1;
  assert.equal(
    chatPresence([started(start)], {
      now,
      lastReadAt: "2026-01-01T11:00:00.000Z",
    }),
    "idle",
  );
});

test("settled after lastReadAt is unread", () => {
  assert.equal(
    chatPresence([settled("2026-01-01T12:10:00.000Z")], {
      lastReadAt: "2026-01-01T12:00:00.000Z",
      now: Date.parse("2026-01-01T12:11:00.000Z"),
    }),
    "unread",
  );
});

test("settled before lastReadAt is idle", () => {
  assert.equal(
    chatPresence([settled("2026-01-01T12:00:00.000Z")], {
      lastReadAt: "2026-01-01T12:10:00.000Z",
      now: Date.parse("2026-01-01T12:11:00.000Z"),
    }),
    "idle",
  );
});

test("never-read settled turn is unread", () => {
  assert.equal(
    chatPresence([settled("2026-01-01T12:00:00.000Z")], {
      lastReadAt: null,
      now: Date.parse("2026-01-01T12:01:00.000Z"),
    }),
    "unread",
  );
});
