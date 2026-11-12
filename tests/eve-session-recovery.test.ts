import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ClientError,
  SessionNotActiveError,
  type SessionStreamEvent,
} from "eve/client";
import {
  isEveSessionInactive,
  mergeEventsForSnapshot,
} from "../lib/chat/eve-session-recovery.ts";

const event = (type: string): SessionStreamEvent =>
  ({ type }) as unknown as SessionStreamEvent;

test("isEveSessionInactive detects terminal session_not_active", () => {
  assert.equal(isEveSessionInactive(new SessionNotActiveError()), true);
  assert.equal(
    isEveSessionInactive(new SessionNotActiveError({ retryable: true })),
    false,
  );
});

test("isEveSessionInactive detects stranded and expired client errors", () => {
  const stranded = new ClientError(409, JSON.stringify({ code: "session_stranded" }));
  // ClientError constructor may not set code from body in all builds — set via create if needed.
  Object.defineProperty(stranded, "code", { value: "session_stranded" });
  assert.equal(isEveSessionInactive(stranded), true);

  const expired = new ClientError(410, JSON.stringify({ code: "session_expired" }));
  Object.defineProperty(expired, "code", { value: "session_expired" });
  assert.equal(isEveSessionInactive(expired), true);

  const other = new ClientError(500, JSON.stringify({ code: "http_error" }));
  Object.defineProperty(other, "code", { value: "http_error" });
  assert.equal(isEveSessionInactive(other), false);
  assert.equal(isEveSessionInactive(new Error("nope")), false);
  assert.equal(isEveSessionInactive(undefined), false);
});

test("mergeEventsForSnapshot never shrinks archived Pearl history", () => {
  const archived = [event("a"), event("b"), event("c")];
  const live = [event("d")];
  const merged = mergeEventsForSnapshot(archived, live);
  assert.equal(merged.length, 4);
  assert.equal(merged[0], archived[0]);
  assert.equal(merged[3], live[0]);
});

test("mergeEventsForSnapshot prefers live when it still prefixes archived", () => {
  const a = event("a");
  const b = event("b");
  const c = event("c");
  const archived = [a, b];
  const live = [a, b, c];
  const merged = mergeEventsForSnapshot(archived, live);
  assert.equal(merged, live);
});

test("mergeEventsForSnapshot keeps archived when live is empty", () => {
  const archived = [event("a")];
  assert.deepEqual(mergeEventsForSnapshot(archived, []), archived);
});
