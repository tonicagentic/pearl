import assert from "node:assert/strict";
import { test } from "node:test";
import { SessionStore } from "eve/client";
import { isEveSessionInactive } from "../lib/chat/eve-session-recovery.ts";

/**
 * First send against a dead attached session surfaces inactive; newSession()
 * clears the local cursor so the next turn can create a fresh session.
 * (Does not follow the live stream — that would hang under a stub fetch.)
 */
test("SessionStore surfaces inactive session then newSession clears it", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.includes("/eve/v1/session") && method === "POST") {
      return new Response(
        JSON.stringify({
          code: "session_not_active",
          message: "The session is no longer active. Start a new session.",
        }),
        { status: 409, headers: { "content-type": "application/json" } },
      );
    }

    return new Response("not found", { status: 404 });
  };

  try {
    const store = new SessionStore({
      baseUrl: "http://127.0.0.1:9",
      initialSession: { sessionId: "sess_old", streamIndex: 3 },
    });

    assert.equal(store.snapshot.session?.sessionId, "sess_old");

    let firstError = null;
    try {
      await store.send({ message: "hello again" });
    } catch (error) {
      firstError = error;
    }

    assert.equal(
      isEveSessionInactive(firstError) ||
        isEveSessionInactive(store.snapshot.error),
      true,
      "first send should surface an inactive session error",
    );

    store.newSession();
    assert.equal(
      store.snapshot.session,
      undefined,
      "newSession clears the dead cursor so the next send can create a session",
    );
    assert.equal(store.snapshot.events.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
