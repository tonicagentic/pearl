import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  buildRawMessage,
  executeGmailSend,
  parseAddresses,
} from "../lib/agent/gmail-send.ts";

test("send_gmail_message is approval-gated, plan-mode-gated, and ledgered", async () => {
  const source = await readFile("agent/tools/send_gmail_message.ts", "utf8");

  assert.match(source, /approval:\s*\{[\s\S]*request:\s*always\(\)/);
  assert.match(source, /isPlanMode\(\)/);
  assert.match(source, /executeGmailSend/);
});

test("address parsing accepts names and rejects header injection", () => {
  assert.deepEqual(parseAddresses("a@b.co, Ann <ann@x.io>"), [
    "a@b.co",
    "Ann <ann@x.io>",
  ]);
  assert.deepEqual(parseAddresses(""), []);
  assert.equal(parseAddresses("not-an-email"), null);
  assert.equal(parseAddresses("a@b.co\r\nBcc: evil@x.io"), null);
});

test("raw message is base64url RFC 2822 with encoded headers and body", () => {
  const raw = buildRawMessage({
    to: ["a@b.co"],
    cc: [],
    bcc: ["c@d.co"],
    subject: "Café intro\r\nBcc: evil@x.io",
    body: "Hello — thanks",
    inReplyTo: "<m1@mail>",
  });
  assert.match(raw, /^[A-Za-z0-9_-]+$/);
  const decoded = Buffer.from(raw, "base64url").toString("utf8");
  const [headers, body] = decoded.split("\r\n\r\n");

  assert.match(headers, /^To: a@b\.co/m);
  assert.match(headers, /^Bcc: c@d\.co/m);
  assert.match(headers, /^In-Reply-To: <m1@mail>/m);
  assert.match(headers, /^Subject: =\?UTF-8\?B\?/m);
  assert.equal(headers.match(/^Bcc:/gm)?.length, 1, "subject cannot inject headers");
  assert.equal(
    Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8"),
    "Hello — thanks",
  );
});

test("invalid recipients are refused before any ledger or network work", async () => {
  const result = await executeGmailSend(
    "user-1",
    { to: "nobody", subject: "Hi", body: "Hello" },
    {
      send: async () => {
        throw new Error("send must not be attempted");
      },
    },
  );
  assert.equal(result.status, "refused");
});
