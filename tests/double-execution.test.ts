import assert from "node:assert/strict";
import { test } from "node:test";
import {
  beginExecution,
} from "../lib/agent/execution-ledger.ts";
import {
  executeSend,
  keyFor,
  readExecutionState,
} from "../lib/agent/notification.ts";

// Part 2 (double execution) + Part 5 (partial failure). These tests run
// against the real Postgres execution ledger — fault injection happens at the
// delivery boundary (the injected `deliver` dep), not by mocking the ledger.

const TEST_SALT = () => `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// The tests inject both the endpoint and the delivery function — the real
// network path is exercised separately in tests/network-faults.test.ts.
const stubDeps = (deliver: () => Promise<string>) => ({
  deliver,
  resolveEndpoint: () => "stub://notification-endpoint",
});

test("double execution: a replayed delivery re-reports instead of re-firing", async () => {
  const salt = TEST_SALT();
  let deliveries = 0;

  const deliver = async () => {
    deliveries++;
    return `receipt-${salt}`;
  };

  const input = { recipient: "ops", message: `deploy ${salt}`, idempotencyKey: `key-${salt}` };

  const first = await executeSend(input, stubDeps(deliver));
  assert.equal(first.status, "delivered");
  assert.equal(deliveries, 1);

  const replay = await executeSend(input, stubDeps(deliver));
  assert.equal(replay.status, "already-delivered");
  assert.equal(deliveries, 1, "the side effect must not re-fire");
});

test("double execution: distinct keys both deliver", async () => {
  const salt = TEST_SALT();
  let deliveries = 0;
  const deliver = async () => {
    deliveries++;
    return "ok";
  };

  await executeSend({ recipient: "ops", message: `a-${salt}`, idempotencyKey: `k1-${salt}` }, stubDeps(deliver));
  await executeSend({ recipient: "ops", message: `b-${salt}`, idempotencyKey: `k2-${salt}` }, stubDeps(deliver));

  assert.equal(deliveries, 2);
});

test("network failure mid-delivery: throws loudly and the ledger records the failure", async () => {
  const salt = TEST_SALT();
  const deliver = async () => {
    throw new Error("ECONNRESET mid-body");
  };

  await assert.rejects(
    executeSend({ recipient: "ops", message: `fail-${salt}`, idempotencyKey: `kf-${salt}` }, stubDeps(deliver)),
    /failed and was not retried/,
  );

  const state = await readExecutionState(keyFor({ recipient: "ops", message: `fail-${salt}`, idempotencyKey: `kf-${salt}` }));
  assert.equal(state?.status, "failed");
  assert.match(state?.detail ?? "", /ECONNRESET/);
});

test("partial failure: a pending ledger row from a crash mid-delivery is surfaced, never re-fired", async () => {
  // Simulate the real crash the workflow replay produces: beginExecution
  // marked the key pending, the side effect went out, the process died before
  // completeExecution() — leaving a pending row and an unknown upstream state.
  const salt = TEST_SALT();
  const input = { recipient: "ops", message: `crash-${salt}`, idempotencyKey: `kc-${salt}` };

  await beginExecution("send_notification", keyFor(input));

  const recovery = await executeSend(input, stubDeps(async () => {
    throw new Error("must not re-deliver on a pending ledger");
  }));

  assert.equal(recovery.status, "incomplete");
  assert.match(String(recovery.detail), /may or may not have been sent/i);
});

test("partial failure: failExecution converts a detected failure into a safe-to-retry state", async () => {
  const salt = TEST_SALT();
  const input = { recipient: "ops", message: `safe-${salt}`, idempotencyKey: `ks-${salt}` };

  // First attempt fails cleanly (failExecution runs)…
  await assert.rejects(
    executeSend(input, stubDeps(async () => { throw new Error("endpoint 503"); })),
  );

  // …so a deliberate manual retry (fresh decision, same key) may attempt again:
  const retry = await executeSend(input, stubDeps(async () => "second-attempt-receipt"));
  assert.equal(retry.status, "delivered");
});
