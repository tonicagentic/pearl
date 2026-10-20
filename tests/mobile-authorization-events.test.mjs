import assert from "node:assert/strict";
import test from "node:test";
import { latestAuthorization } from "../mobile/src/authorization-events.ts";

const required = { type: "authorization.required", data: { name: "github", turnId: "turn-1" } };
const completed = { type: "authorization.completed", data: { name: "github", turnId: "turn-1", outcome: "authorized" } };

test("authorization is projected from structured eve events, not assistant text", () => {
  assert.equal(latestAuthorization([{ type: "message.appended", data: { messageDelta: "Sign in" } }]), null);
  assert.equal(latestAuthorization([{ type: "turn.started" }, required]), required);
  assert.equal(latestAuthorization([{ type: "turn.started" }, required, { type: "session.waiting" }]), required);
  assert.equal(latestAuthorization([required, completed]), completed);
});

test("a settled or failed turn cannot strand the composer behind old consent", () => {
  assert.equal(latestAuthorization([required, { type: "session.failed" }]), null);
  assert.equal(latestAuthorization([required, completed, { type: "session.completed" }]), null);
  assert.equal(latestAuthorization([required, { type: "turn.started" }]), null);
});
