import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { withWebDevProxy } = require("../mobile/web-dev-proxy.js");

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

test("loopback proxy forwards auth and streams without storing a cookie", async (t) => {
  let seen;
  const upstream = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    seen = {
      url: req.url,
      origin: req.headers.origin,
      authorization: req.headers.authorization,
      cookie: req.headers.cookie,
      body: Buffer.concat(chunks).toString(),
    };
    res.setHeader("content-type", "application/json");
    res.setHeader("set-cookie", "session=secret; HttpOnly");
    res.end(JSON.stringify({ token: "test-token" }));
  });
  const upstreamUrl = await listen(upstream);
  t.after(() => upstream.closeAllConnections());
  t.after(() => upstream.close());

  const proxy = createServer(withWebDevProxy((_req, res) => res.writeHead(404).end(), upstreamUrl));
  const proxyUrl = await listen(proxy);
  t.after(() => proxy.closeAllConnections());
  t.after(() => proxy.close());

  const response = await fetch(`${proxyUrl}/__pearl_api/api/auth/sign-in/email?test=1`, {
    method: "POST",
    headers: {
      origin: proxyUrl,
      authorization: "Bearer test-token",
      "content-type": "application/json",
      cookie: "not-forwarded=true",
    },
    body: '{"email":"test@example.com"}',
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { token: "test-token" });
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(seen, {
    url: "/api/auth/sign-in/email?test=1",
    origin: upstreamUrl,
    authorization: "Bearer test-token",
    cookie: undefined,
    body: '{"email":"test@example.com"}',
  });

  const connections = await fetch(`${proxyUrl}/__pearl_api/api/connections/status`, {
    method: "POST",
    headers: { origin: proxyUrl, authorization: "Bearer test-token", "content-type": "application/json" },
    body: '{"id":"github"}',
  });
  assert.equal(connections.status, 200);
  assert.equal(seen.url, "/api/connections/status");
  assert.equal(seen.authorization, "Bearer test-token");
  assert.equal(seen.body, '{"id":"github"}');

  const authorize = await fetch(`${proxyUrl}/__pearl_api/api/connections/authorize`, {
    method: "POST",
    headers: { origin: proxyUrl, authorization: "Bearer test-token", "content-type": "application/json" },
    body: '{"id":"neon"}',
  });
  assert.equal(authorize.status, 200);
  assert.equal(seen.url, "/api/connections/authorize");
  assert.equal(seen.authorization, "Bearer test-token");
  assert.equal(seen.body, '{"id":"neon"}');
  assert.equal(authorize.headers.get("set-cookie"), null);
  assert.equal(authorize.headers.get("cache-control"), "no-store");

  const wrongAuthorizeOrigin = await fetch(`${proxyUrl}/__pearl_api/api/connections/authorize`, {
    method: "POST", headers: { origin: "https://untrusted.example" }, body: '{}',
  });
  assert.equal(wrongAuthorizeOrigin.status, 403);
  const missingAuthorizeOrigin = await fetch(`${proxyUrl}/__pearl_api/api/connections/authorize`, {
    method: "POST", body: '{}',
  });
  assert.equal(missingAuthorizeOrigin.status, 403);
  for (const path of ["authorize/extra", "authorize-other", "status/extra"]) {
    const denied = await fetch(`${proxyUrl}/__pearl_api/api/connections/${path}`, {
      method: "POST", headers: { origin: proxyUrl }, body: '{}',
    });
    assert.equal(denied.status, 404, path);
  }
  assert.equal(seen.url, "/api/connections/authorize");

  const wrongOrigin = await fetch(`${proxyUrl}/__pearl_api/api/chats`, {
    method: "POST",
    headers: { origin: "https://untrusted.example" },
  });
  assert.equal(wrongOrigin.status, 403);
  const otherPath = await fetch(`${proxyUrl}/__pearl_api/api/not-allowed`, {
    headers: { origin: proxyUrl },
  });
  assert.equal(otherPath.status, 404);
  const authSubpath = await fetch(`${proxyUrl}/__pearl_api/api/auth/sign-in/email/other`, {
    headers: { origin: proxyUrl },
  });
  assert.equal(authSubpath.status, 404);
});
