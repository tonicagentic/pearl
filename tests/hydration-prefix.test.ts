import assert from "node:assert/strict";
import { test } from "node:test";
import { SessionStore, type SessionStreamEvent } from "eve/client";
import { repairSessionHydration } from "../lib/chat/hydration-prefix.ts";

const USER =
  "there’s a bug on the tonicagentic/pearl repo, in the mobile app, where if the user is on a non-chat view, and then opens a recent chat, the view just shows the non-chat thread view. can you fix this";
const REPLY =
  "The coder is starting on `tonicagentic/pearl` to fix the view switch when opening a recent chat and check for regressions.";

function event(
  type: string,
  line: number,
  index: number,
  data: Record<string, unknown>,
  endOfLine: boolean | undefined = true,
): SessionStreamEvent {
  return {
    type,
    data,
    meta: {
      position: { line, index },
      ...(endOfLine === undefined ? {} : { endOfLine }),
    },
  } as unknown as SessionStreamEvent;
}

/**
 * Production chat 8b0835dd: turn.paused at line 59 was stored at row 0, the
 * transcript is lines 1–57, and line 58 (interaction.opened) was never saved.
 */
function productionShapedLog(): SessionStreamEvent[] {
  const pause = event(
    "turn.paused",
    59,
    0,
    {
      turnId: "turn_0",
      awaiting: [{ interactionId: "qUpaAgrSmy0w68vY" }],
    },
    undefined,
  );
  const turnStarted = event(
    "turn.started",
    1,
    0,
    {
      turnId: "turn_0",
      cause: { deliveryId: "17dfdb9a-c404-4d94-aa2a-0457e3f183ea" },
      follows: null,
    },
    false,
  );
  const hookDelivery = event(
    "delivery.consumed",
    1,
    1,
    {
      turnId: "turn_0",
      deliveryId: "17dfdb9a-c404-4d94-aa2a-0457e3f183ea",
      parts: [{ kind: "text", text: USER }],
    },
    undefined,
  );
  const delivery = event("delivery.consumed", 1, 1, {
    turnId: "turn_0",
    deliveryId: "17dfdb9a-c404-4d94-aa2a-0457e3f183ea",
    parts: [{ kind: "text", text: USER }],
  });
  const middle: SessionStreamEvent[] = [];
  for (let line = 2; line <= 39; line += 1) {
    middle.push(
      event("content.delta", line, 0, {
        kind: "text",
        delta: "",
        partId: "run_1.0",
      }),
    );
  }
  middle.push(
    event("model.requested", 40, 0, {
      owner: { turnId: "turn_0" },
      runId: "run_1",
    }),
  );
  middle.push(
    event("model.started", 41, 0, {
      runId: "run_1",
      attempt: 0,
      modelId: "openai/gpt-6.1-sol-fast",
    }),
  );
  for (let line = 42; line <= 54; line += 1) {
    middle.push(
      event("content.delta", line, 0, {
        kind: "text",
        delta: line === 42 ? "The" : "",
        partId: "run_1.0",
      }),
    );
  }
  const completed = event("content.completed", 55, 0, {
    kind: "text",
    phase: "reply",
    runId: "run_1",
    partId: "run_1.0",
    value: REPLY,
  });
  const settled = event(
    "model.settled",
    56,
    0,
    { runId: "run_1", outcome: "completed", finishReason: "stop" },
    false,
  );
  const usage = event("usage.recorded", 56, 1, {
    kind: "model",
    owner: { runId: "run_1" },
    usage: {
      inputTokens: 1,
      outputTokens: 1,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costUsd: 0,
    },
  });
  const childOpened = event(
    "child.opened",
    57,
    0,
    {
      name: "coder",
      owner: { callId: "call_79b5f54842a5486888a74b67966dfe7a" },
      sessionId: "wrun_41M85DVMAH0GSGQJN68BRWKVNZ",
      stream: "/eve/v1/session/wrun_41M85DVMAH0GSGQJN68BRWKVNZ/stream",
    },
    false,
  );
  const childSent = event("child.sent", 57, 1, {
    callId: "call_79b5f54842a5486888a74b67966dfe7a",
    sessionId: "wrun_41M85DVMAH0GSGQJN68BRWKVNZ",
  });
  return [
    pause,
    hookDelivery,
    turnStarted,
    delivery,
    ...middle,
    completed,
    settled,
    usage,
    childOpened,
    childSent,
  ];
}

function messageText(store: SessionStore): string {
  return store.snapshot.messages
    .flatMap((message) => message.parts ?? [])
    .map((part) =>
      "text" in part && typeof part.text === "string" ? part.text : "",
    )
    .join("\n");
}

const session = {
  sessionId: "wrun_41M85DVDSN0GMHDHPC6SRJ5SDS",
  streamIndex: 58,
} as const;

test("raw production order hydrates to an empty thread past the interaction", () => {
  const store = new SessionStore({
    baseUrl: "https://pearl.diy",
    initialEvents: productionShapedLog(),
    initialSession: session,
  });
  assert.equal(store.snapshot.messages.length, 0);
  assert.equal(store.snapshot.session?.streamIndex, 60);
});

test("repaired prefix keeps the transcript and resumes on the missing interaction line", () => {
  const repaired = repairSessionHydration(productionShapedLog(), session);
  assert.equal(repaired.streamIndex, 58);
  assert.equal(
    repaired.events.some((entry) => entry.type === "turn.paused"),
    false,
  );
  assert.equal(
    repaired.events.some((entry) => entry.type === "delivery.admitted"),
    true,
  );

  const store = new SessionStore({
    baseUrl: "https://pearl.diy",
    initialEvents: repaired.events,
    initialSession: { ...session, streamIndex: repaired.streamIndex ?? 0 },
  });
  const text = messageText(store);
  assert.match(text, /non-chat thread view/);
  assert.match(text, /coder is starting/);
  assert.equal(store.snapshot.session?.streamIndex, 58);
  assert.equal(
    store.snapshot.events.some((entry) => entry.type === "child.opened"),
    true,
  );
});

test("an interaction on the missing line renders once it is in the prefix", () => {
  const repaired = repairSessionHydration(productionShapedLog(), session);
  const withInteraction = repairSessionHydration(
    [
      ...repaired.events,
      event("interaction.opened", 58, 0, {
        interactionId: "qUpaAgrSmy0w68vY",
        subject: { turnId: "turn_0" },
        audience: { principalIds: ["u1"] },
        request: {
          kind: "approval",
          display: "decision",
          prompt: "Allow the coder to edit the mobile app?",
          options: [
            { id: "approve", label: "Approve", kind: "accept" },
            { id: "deny", label: "Cancel", kind: "decline" },
          ],
        },
      }),
      event("turn.paused", 59, 0, {
        turnId: "turn_0",
        awaiting: [{ interactionId: "qUpaAgrSmy0w68vY" }],
      }),
    ],
    { ...session, streamIndex: 60 },
  );
  const store = new SessionStore({
    baseUrl: "https://pearl.diy",
    initialEvents: withInteraction.events,
    initialSession: {
      ...session,
      streamIndex: withInteraction.streamIndex ?? 0,
    },
  });
  const parts = store.snapshot.messages.flatMap((message) => message.parts ?? []);
  assert.equal(
    parts.some(
      (part) =>
        part.type === "interaction" &&
        part.status === "open" &&
        part.request.prompt === "Allow the coder to edit the mobile app?",
    ),
    true,
  );
});
