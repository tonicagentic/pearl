import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";

import {
  callBrowserAction,
  sanitizeBrowserResult,
} from "../lib/browser/client.ts";
import type { BrowserSessionHandle } from "../lib/browser/session.ts";

test("sanitizeBrowserResult drops secret-shaped fields and keeps the snapshot", () => {
  const sanitized = sanitizeBrowserResult(
    {
      ok: true,
      controlMode: "agent",
      url: "https://example.com",
      title: "Example",
      tabs: [{ id: "p1", url: "https://example.com", title: "Example", active: true }],
      snapshot: '- link "Home" [e1]',
      viewUrl: "https://evil.example/view/sekrit",
      controlSecret: "sekrit",
      browserControlSecret: "sekrit",
      note: "opened with sekrit token",
    },
    ["sekrit"],
  );

  assert.equal(sanitized.ok, true);
  assert.equal(sanitized.snapshot, '- link "Home" [e1]');
  assert.equal(sanitized.note, "opened with [redacted] token");
  assert.equal(
    "viewUrl" in sanitized || "controlSecret" in sanitized,
    false,
  );
  assert.equal(
    JSON.stringify(sanitized).includes("sekrit"),
    false,
  );
});

test("callBrowserAction refuses input while the user has control", async () => {
  const secret = "test-secret-value";
  const server = createServer((req, res) => {
    assert.equal(req.headers["x-browser-secret"], secret);
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      const action = JSON.parse(body) as { action: string };
      if (action.action === "click") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            ok: false,
            controlMode: "user",
            url: "https://example.com",
            title: "Example",
            tabs: [
              {
                id: "p1",
                url: "https://example.com",
                title: "Example",
                active: true,
              },
            ],
            snapshot: null,
            note: "the user has control — stop and wait until they hand back",
            viewUrl: `http://127.0.0.1/view/${secret}`,
          }),
        );
        return;
      }
      res.writeHead(400).end();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const handle: BrowserSessionHandle = {
    sandboxName: "browser-test",
    controlSecret: secret,
    baseUrl: `http://127.0.0.1:${address.port}`,
    viewUrl: `http://127.0.0.1:${address.port}/view/${secret}`,
  };

  try {
    const result = await callBrowserAction(handle, {
      action: "click",
      ref: "e1",
    });
    assert.equal(result.ok, false);
    assert.equal(result.controlMode, "user");
    assert.match(result.note ?? "", /user has control/i);
    assert.equal(JSON.stringify(result).includes(secret), false);
    assert.equal(JSON.stringify(result).includes("viewUrl"), false);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
});
