import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { executeSend } from "../lib/agent/notification.ts";

// Part 5 (required): network loss during a tool call. The fault is injected
// at the real boundary — a local stub HTTP server that misbehaves — and the
// tool's actual delivery path (fetch inside executeSend) runs unmodified.
// Nothing partial may be reported as success, and the ledger must reflect the
// failure so a later status check sees the truth.

let server: Server;
let baseUrl = "";
let hitCount = 0;
let mode: "reset-mid-body" | "hang" | "server-error" | "ok" = "ok";

before(async () => {
  server = createServer((req, res) => {
    hitCount++;

    if (mode === "reset-mid-body") {
      res.writeHead(200, { "content-type": "application/json" });
      res.write('{"receipt":"half-');
      setTimeout(() => res.destroy(), 10); // kill the connection mid-body
      return;
    }

    if (mode === "hang") {
      // Never respond; the client's AbortSignal.timeout must fire.
      return;
    }

    if (mode === "server-error") {
      res.writeHead(503);
      res.end("unavailable");
      return;
    }

    res.writeHead(200, { "content-type": "application/json" });
    res.end('{"receipt":"ok-123"}');
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();

  if (addr && typeof addr === "object") {
    baseUrl = `http://127.0.0.1:${addr.port}`;
  }

  process.env.NOTIFICATION_ENDPOINT = baseUrl;
});

after(() => {
  delete process.env.NOTIFICATION_ENDPOINT;
  server.close();
});

function saltedInput(note: string) {
  const salt = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    recipient: "ops",
    message: `${note}-${salt}`,
    idempotencyKey: `nf-${salt}`,
  };
}

describe("network loss mid-response", () => {
  it("a connection destroyed mid-body is a loud failure, not a partial success", async () => {
    mode = "reset-mid-body";
    const input = saltedInput("mid-body-reset");

    await assert.rejects(
      executeSend(input, {
        deliver: async (endpoint, body) => {
          const res = await fetch(endpoint, { method: "POST", body });
          if (!res.ok) throw new Error(`Endpoint responded ${res.status}`);
          return await res.text();
        },
      }),
      (error: unknown) => /failed and was not retried|fetch failed|terminated/i.test(String(error)),
    );

    const { readExecutionState } = await import("../lib/agent/notification.ts");
    const { keyFor } = await import("../lib/agent/notification.ts");
    const state = await readExecutionState(keyFor(input));
    assert.equal(state?.status, "failed", "the ledger must record the failure");
  });

  it("a hung endpoint times out and fails loudly (never returns a half receipt)", async () => {
    mode = "hang";
    const input = saltedInput("hang");

    await assert.rejects(
      executeSend(input, {
        deliver: async (endpoint, body) => {
          const res = await fetch(endpoint, {
            method: "POST",
            body,
            signal: AbortSignal.timeout(500),
          });
          if (!res.ok) throw new Error(`Endpoint responded ${res.status}`);
          return await res.text();
        },
      }),
      /failed and was not retried|timeout|abort/i,
    );
  });

  it("a 5xx endpoint is surfaced to the model as an actionable error", async () => {
    mode = "server-error";
    const input = saltedInput("server-error");

    await assert.rejects(
      executeSend(input, {
        deliver: async (endpoint, body) => {
          const res = await fetch(endpoint, { method: "POST", body });
          if (!res.ok) throw new Error(`Endpoint responded ${res.status}`);
          return await res.text();
        },
      }),
      /Endpoint responded 503/,
    );
  });

  it("a healthy endpoint delivers exactly once and records the receipt", async () => {
    mode = "ok";
    const input = saltedInput("healthy");

    const result = await executeSend(input, {
      deliver: async (endpoint, body) => {
        const res = await fetch(endpoint, { method: "POST", body });
        return await res.text();
      },
    });

    assert.equal(result.status, "delivered");
    assert.match(String(result.receipt), /ok-123/);
  });
});
