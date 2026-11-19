import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ATTENTION_FRESH_MS,
  filterAlertPushTokens,
  type AttentionSnapshot,
} from "../lib/attention/filter-alert-tokens.ts";

const NOW = Date.parse("2026-11-19T21:00:00.000Z");

function row(
  partial: Partial<AttentionSnapshot> &
    Pick<AttentionSnapshot, "surface" | "clientKey">,
): AttentionSnapshot {
  return {
    state: "active",
    chatId: "chat-1",
    sessionId: "sess-1",
    updatedAt: new Date(NOW),
    ...partial,
  };
}

test("web watching this session suppresses every token", () => {
  const result = filterAlertPushTokens({
    tokens: [{ token: "ExponentPushToken[a]" }, { token: "ExponentPushToken[b]" }],
    attention: [
      row({
        surface: "web",
        clientKey: "tab-1",
        chatId: null,
        sessionId: "sess-1",
      }),
    ],
    chatId: "chat-1",
    sessionId: "sess-1",
    now: NOW,
  });
  assert.equal(result.suppressAll, true);
  assert.deepEqual(result.tokens, []);
});

test("web watching this chatId suppresses every token", () => {
  const result = filterAlertPushTokens({
    tokens: [{ token: "ExponentPushToken[a]" }],
    attention: [
      row({
        surface: "web",
        clientKey: "tab-1",
        chatId: "chat-1",
        sessionId: null,
      }),
    ],
    chatId: "chat-1",
    sessionId: "sess-other",
    now: NOW,
  });
  assert.equal(result.suppressAll, true);
  assert.deepEqual(result.tokens, []);
});

test("this phone foreground drops only its token", () => {
  const result = filterAlertPushTokens({
    tokens: [
      { token: "ExponentPushToken[phone-a]" },
      { token: "ExponentPushToken[phone-b]" },
    ],
    attention: [
      row({
        surface: "mobile",
        clientKey: "ExponentPushToken[phone-a]",
        chatId: "chat-other",
        sessionId: null,
      }),
    ],
    chatId: "chat-1",
    sessionId: "sess-1",
    now: NOW,
  });
  assert.equal(result.suppressAll, false);
  assert.deepEqual(result.tokens, [{ token: "ExponentPushToken[phone-b]" }]);
});

test("stale active row still alerts", () => {
  const result = filterAlertPushTokens({
    tokens: [{ token: "ExponentPushToken[phone-a]" }],
    attention: [
      row({
        surface: "mobile",
        clientKey: "ExponentPushToken[phone-a]",
        updatedAt: new Date(NOW - ATTENTION_FRESH_MS - 1),
      }),
      row({
        surface: "web",
        clientKey: "tab-1",
        updatedAt: new Date(NOW - ATTENTION_FRESH_MS - 1),
      }),
    ],
    chatId: "chat-1",
    sessionId: "sess-1",
    now: NOW,
  });
  assert.equal(result.suppressAll, false);
  assert.deepEqual(result.tokens, [{ token: "ExponentPushToken[phone-a]" }]);
});

test("background row still alerts", () => {
  const result = filterAlertPushTokens({
    tokens: [{ token: "ExponentPushToken[phone-a]" }],
    attention: [
      row({
        surface: "mobile",
        clientKey: "ExponentPushToken[phone-a]",
        state: "background",
      }),
      row({
        surface: "web",
        clientKey: "tab-1",
        state: "background",
      }),
    ],
    chatId: "chat-1",
    sessionId: "sess-1",
    now: NOW,
  });
  assert.equal(result.suppressAll, false);
  assert.deepEqual(result.tokens, [{ token: "ExponentPushToken[phone-a]" }]);
});

test("web on a different chat does not suppress", () => {
  const result = filterAlertPushTokens({
    tokens: [{ token: "ExponentPushToken[a]" }],
    attention: [
      row({
        surface: "web",
        clientKey: "tab-1",
        chatId: "chat-other",
        sessionId: "sess-other",
      }),
    ],
    chatId: "chat-1",
    sessionId: "sess-1",
    now: NOW,
  });
  assert.equal(result.suppressAll, false);
  assert.deepEqual(result.tokens, [{ token: "ExponentPushToken[a]" }]);
});
