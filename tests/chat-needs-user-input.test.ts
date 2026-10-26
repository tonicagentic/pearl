import assert from "node:assert/strict";
import { test } from "node:test";
import type { MessageStreamEvent } from "eve/client";
import { chatNeedsUserInput } from "../lib/chat/events.ts";

const requested = (requestId: string, toolName = "confirm_step"): MessageStreamEvent =>
  ({
    type: "input.requested",
    data: {
      requests: [
        {
          requestId,
          kind: "tool-approval",
          action: { toolName, callId: "call_1" },
        },
      ],
    },
  }) as MessageStreamEvent;

const resolved = (requestId: string): MessageStreamEvent =>
  ({
    type: "input.resolved",
    data: { resolutions: [{ requestId }] },
  }) as MessageStreamEvent;

test("open tool approvals mark the chat as waiting for input", () => {
  assert.equal(chatNeedsUserInput([requested("a1")]), true);
});

test("resolved approvals clear the waiting signal", () => {
  assert.equal(chatNeedsUserInput([requested("a1"), resolved("a1")]), false);
});

test("failed turns drop unresolved parks", () => {
  assert.equal(
    chatNeedsUserInput([
      requested("a1"),
      { type: "turn.failed", data: { turnId: "t1" } } as MessageStreamEvent,
    ]),
    false,
  );
});

test("authorization challenges wait until completed", () => {
  const required = {
    type: "authorization.required",
    data: { name: "github", description: "Connect", sequence: 1, stepIndex: 0, turnId: "t1" },
  } as MessageStreamEvent;
  const completed = {
    type: "authorization.completed",
    data: {
      name: "github",
      outcome: "authorized",
      sequence: 2,
      stepIndex: 0,
      turnId: "t1",
    },
  } as MessageStreamEvent;
  assert.equal(chatNeedsUserInput([required]), true);
  assert.equal(chatNeedsUserInput([required, completed]), false);
});
