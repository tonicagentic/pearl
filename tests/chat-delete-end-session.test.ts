import assert from "node:assert/strict";
import { test } from "node:test";

import { bestEffortEndEveSession } from "../lib/eve/end-session.ts";

test("bestEffortEndEveSession calls end with chat_deleted when sessionId is set", async () => {
  const calls: { sessionId: string; reason?: string }[] = [];
  await bestEffortEndEveSession(
    {
      sessionId: "sess_abc",
      requestHeaders: { authorization: "Bearer test" },
      reason: "chat_deleted",
    },
    {
      baseUrl: "http://example.test",
      createClient: (options) => {
        assert.equal(options.baseUrl, "http://example.test");
        const headers =
          typeof options.headers === "function"
            ? undefined
            : options.headers;
        assert.equal(headers?.authorization, "Bearer test");
        return {
          sessions: {
            attach: (sessionId: string) => ({
              end: async (opts?: { readonly reason?: string }) => {
                calls.push({ sessionId, reason: opts?.reason });
              },
            }),
          },
        };
      },
    },
  );
  assert.deepEqual(calls, [{ sessionId: "sess_abc", reason: "chat_deleted" }]);
});

test("bestEffortEndEveSession swallows end failures", async () => {
  await bestEffortEndEveSession(
    { sessionId: "sess_dead" },
    {
      createClient: () => ({
        sessions: {
          attach: () => ({
            end: async () => {
              throw new Error("already ended");
            },
          }),
        },
      }),
    },
  );
});

test("bestEffortEndEveSession no-ops on empty sessionId", async () => {
  let created = false;
  await bestEffortEndEveSession(
    { sessionId: "  " },
    {
      createClient: () => {
        created = true;
        return {
          sessions: {
            attach: () => ({
              end: async () => {},
            }),
          },
        };
      },
    },
  );
  assert.equal(created, false);
});
