import assert from "node:assert/strict";
import { test } from "node:test";
import type { SessionStreamEvent } from "eve/client";
import {
  chatNeedsAuthorization,
  chatNeedsUserInput,
} from "../lib/chat/events.ts";

const requested = (interactionId: string, toolName = "confirm_step"): SessionStreamEvent =>
  ({
    type: "interaction.opened",
    data: {
      interactionId,
      subject: { callId: "call_1" },
      request: {
        kind: "approval",
        prompt: `Allow ${toolName}?`,
      },
    },
  }) as unknown as SessionStreamEvent;

const resolved = (interactionId: string): SessionStreamEvent =>
  ({
    type: "interaction.settled",
    data: { interactionId, outcome: "accepted" },
  }) as unknown as SessionStreamEvent;

test("open tool approvals mark the chat as waiting for input", () => {
  assert.equal(chatNeedsUserInput([requested("a1")]), true);
});

test("resolved approvals clear the waiting signal", () => {
  assert.equal(chatNeedsUserInput([requested("a1"), resolved("a1")]), false);
});

test("settled turns drop unresolved parks", () => {
  assert.equal(
    chatNeedsUserInput([
      requested("a1"),
      {
        type: "turn.settled",
        data: { turnId: "t1", outcome: "failed" },
      } as unknown as SessionStreamEvent,
    ]),
    false,
  );
});

test("sign-in challenges wait until settled", () => {
  const required = {
    type: "interaction.opened",
    data: {
      interactionId: "i_auth",
      subject: { callId: "call_1" },
      request: {
        kind: "sign-in",
        prompt: "Connect GitHub",
        signIn: { name: "github" },
      },
    },
  } as unknown as SessionStreamEvent;
  const completed = {
    type: "interaction.settled",
    data: { interactionId: "i_auth", outcome: "accepted" },
  } as unknown as SessionStreamEvent;
  assert.equal(chatNeedsUserInput([required]), true);
  assert.equal(chatNeedsUserInput([required, completed]), false);
  assert.equal(chatNeedsAuthorization([required]), true);
  assert.equal(chatNeedsAuthorization([required, completed]), false);
});

test("stale tool approvals are not authorization parks", () => {
  assert.equal(chatNeedsAuthorization([requested("a1")]), false);
  assert.equal(chatNeedsUserInput([requested("a1")]), true);
});
