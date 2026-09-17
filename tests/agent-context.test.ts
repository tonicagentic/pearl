import assert from "node:assert/strict";
import { test } from "node:test";
import {
  callerIdentity,
  currentDatetime,
} from "../lib/agent/session-context.ts";

// The agent must always know (1) who it is talking to and (2) the current
// date/time. These pin the context builders; the behavior evals
// (evals/behavior/identity-and-time.eval.ts) pin that the agent USES them.

test("callerIdentity: names the signed-in user with email and principal", () => {
  const text = callerIdentity({
    name: "Alex Rivera",
    email: "alex@example.com",
    principalId: "user_123",
  });

  assert.ok(text?.includes("Alex Rivera"));
  assert.ok(text?.includes("alex@example.com"));
  assert.ok(text?.includes("user_123"));
});

test("callerIdentity: handles a principal with only an id", () => {
  const text = callerIdentity({ principalId: "eve-chat-user" });

  assert.ok(text?.includes("eve-chat-user"));
  assert.ok(!text?.includes("Name:"));
});

test("callerIdentity: contributes nothing without a principal", () => {
  assert.equal(callerIdentity(null), null);
  assert.equal(callerIdentity(undefined), null);
  assert.equal(callerIdentity({ name: "  ", email: "", principalId: null }), null);
});

test("callerIdentity: blank-ish names are trimmed", () => {
  const text = callerIdentity({ name: "  Alex  ", email: null, principalId: null });
  assert.ok(text?.includes("Alex"));
  assert.ok(!text?.includes("Alex  "));
});

test("currentDatetime: pins the ISO date, clock, weekday, and UTC marker", () => {
  // 2026-09-17 is a Thursday (UTC).
  const text = currentDatetime(new Date("2026-09-17T18:41:00.000Z"));

  assert.ok(text.includes("2026-09-17"));
  assert.ok(text.includes("18:41:00"));
  assert.ok(text.includes("Thursday"));
  assert.ok(text.includes("UTC"));
});

test("currentDatetime: the weekday follows the UTC date, including rollover", () => {
  assert.ok(currentDatetime(new Date("2026-09-14T00:00:00.000Z")).includes("Monday"));
  assert.ok(currentDatetime(new Date("2026-09-13T23:59:59.999Z")).includes("Sunday"));
  // Midnight rollover changes the date.
  const justBefore = currentDatetime(new Date("2026-09-13T23:59:59.999Z"));
  const justAfter = currentDatetime(new Date("2026-09-14T00:00:01.000Z"));
  assert.ok(justBefore.includes("2026-09-13"));
  assert.ok(justAfter.includes("2026-09-14"));
});

test("currentDatetime: full ISO timestamp is embedded verbatim", () => {
  const now = new Date("2026-01-02T03:04:05.678Z");
  assert.ok(currentDatetime(now).includes(now.toISOString()));
});

// The dynamic instruction modules must wire the builders to the right
// lifecycle events and roles: identity at session start (system), time per
// turn (system, outside history so stale timestamps never accumulate).
test("dynamic instruction modules: identity at session.started, time at turn.started", async () => {
  const identity = (await import("../agent/instructions/caller-identity.ts")).default;
  const datetime = (await import("../agent/instructions/current-datetime.ts")).default;

  const ctx = {
    session: {
      auth: {
        current: { name: "Alex Rivera", email: "alex@example.com", principalId: "user_123" },
      },
    },
  } as never;

  const identityEvents = identity.events as Record<
    string,
    (event: never, ctx: never) => unknown
  >;

  const identityResolved = (await identityEvents["session.started"](
    undefined as never,
    ctx,
  )) as { role?: string; content: string } | null;

  assert.ok(identityResolved);
  assert.equal(identityResolved.role, "system");
  assert.ok(identityResolved.content.includes("Alex Rivera"));

  const datetimeModule = (await import("../agent/instructions/current-datetime.ts")).default;
  const datetimeEvents = datetimeModule.events as Record<
    string,
    (event: never, ctx: never) => Promise<{ role?: string; content: string }>
  >;
  const timeResolved = (await datetimeEvents["turn.started"](
    undefined as never,
    ctx,
  )) as { role?: string; content: string };

  assert.ok(timeResolved);
  assert.equal(timeResolved.role, "system");
  assert.ok(timeResolved.content.includes(new Date().toISOString().slice(0, 10)));
});

test("dynamic identity module: returns null when unauthenticated", async () => {
  const identity = (await import("../agent/instructions/caller-identity.ts")).default;
  const identityEvents = identity.events as Record<
    string,
    (event: never, ctx: never) => unknown
  >;

  const resolved = await identityEvents["session.started"](
    undefined as never,
    { session: { auth: { current: null } } } as never,
  );

  assert.equal(resolved, null);
});