import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

register("./mobile-ts-resolve.mjs", pathToFileURL("./tests/"));
const { sendWithRetry } = await import("../mobile/src/send-retry.ts");

function context(events = []) {
  const calls = [];
  const store = {
    snapshot: { events, session: { sessionId: "session" } },
    send: async () => {
      calls.push("send");
      return { deliveryId: "expected", sessionId: "session" };
    },
    resume: async () => { calls.push("resume"); },
  };
  return {
    calls,
    store,
    wasSendPrepared: () => true,
    recoverDeadSession: () => false,
    clearSessionRecovery: () => calls.push("clearRecovery"),
    clearPendingMessage: () => calls.push("clearPending"),
    offline: false,
  };
}

test("queued receipts are accepted immediately, without waiting for the prior turn", async () => {
  const ctx = context();
  let receipt;
  const result = await sendWithRetry(ctx, { message: "follow-up", turnPolicy: "queue" }, {
    eventBaseline: 0,
    onAccepted: (value) => { receipt = value; },
  });
  assert.deepEqual(receipt, { sessionId: "session", deliveryId: "expected" });
  assert.deepEqual(result, { outcome: "accepted", deliveryId: "expected" });
  assert.deepEqual(ctx.calls, ["send", "clearPending", "clearRecovery"]);
});

test("capture receipt before catch-up and confirm only that delivery", async () => {
  const ctx = context([{ type: "delivery.consumed", data: { deliveryId: "other" } }]);
  let receipt;
  let resolved = false;
  const sending = sendWithRetry(ctx, { message: "follow-up" }, {
    eventBaseline: 0,
    onAccepted: (value) => { receipt = value; },
  }).then((result) => { resolved = true; return result; });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(receipt, { sessionId: "session", deliveryId: "expected" });
  assert.equal(resolved, false, "another delivery must not confirm this send");
  ctx.store.snapshot.events.push({ type: "delivery.consumed", data: { deliveryId: "expected" } });
  assert.deepEqual(await sending, { outcome: "accepted", deliveryId: "expected" });
  assert.equal(ctx.calls.includes("resume"), false);
});
