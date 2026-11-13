import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

// CI installs only the root package — not mobile/node_modules — so Babel from
// Expo is unavailable. Resolve extensionless mobile imports to `.ts` and let
// Node strip types (same path as tests/mobile-stream-presentation.test.mjs).
register("./mobile-ts-resolve.mjs", pathToFileURL("./tests/"));

const {
  toThreadMessages,
  hasPendingAction,
  getPendingApprovals,
  composerWaitingQuestions,
  isTaskNotification,
  pendingMessageLabel,
} = await import("../mobile/src/message-projection.ts");
const { toEveTurn } = await import("../mobile/src/attachment-content.ts");

const user = { id: "turn:user", role: "user", parts: [{ type: "text", text: "hello" }] };
const assistant = (parts, status = "streaming") => ({
  id: "turn:assistant", role: "assistant", metadata: { turnId: "turn", status }, parts,
});

const openApproval = ({
  callId = "c1",
  name = "write_file",
  interactionId = "approval_1",
  prompt = "Save this?",
  input = { filePath: "a.md", content: "hello" },
  options = [
    { id: "approve", label: "Allow" },
    { id: "cancel", label: "Deny" },
  ],
} = {}) => ({
  type: "tool",
  callId,
  stepIndex: 0,
  kind: "tool",
  name,
  label: name,
  state: "approval",
  input,
  interaction: {
    interactionId,
    turnId: "turn",
    stepIndex: 0,
    status: "open",
    request: {
      kind: "approval",
      prompt,
      options,
    },
  },
});

test("projects reasoning, live tool arguments, final result and text in order", () => {
  const messages = toThreadMessages({ messages: [user, assistant([
    { type: "reasoning", text: "Checking", state: "done" },
    { type: "tool", callId: "call_1", stepIndex: 0, kind: "tool", name: "lookup", label: "lookup", state: "streaming", inputText: '{"q":' },
    { type: "text", text: "Done", state: "streaming" },
  ])] }, { isRunning: true });
  assert.equal(messages[1].status.type, "running");
  assert.deepEqual(messages[1].content.map((part) => part.type), ["reasoning", "tool-call", "text"]);
  assert.equal(messages[1].content[1].argsText, '{"q":');
  assert.equal(messages[1].content[1].toolCallId, "call_1");
  assert.equal(messages[1].content[0].status.type, "complete");
  const settled = toThreadMessages({ messages: [assistant([
    { type: "tool", callId: "call_1", stepIndex: 0, kind: "tool", name: "lookup", label: "lookup", state: "completed", input: { q: "a" }, output: { answer: "b" } },
  ], "complete")] });
  assert.deepEqual(settled[0].content[0].result, { answer: "b" });
  assert.equal(settled[0].status.type, "complete");
});

test("renders authorization and file metadata without inventing bytes or unsafe links", () => {
  const data = { messages: [assistant([
    {
      type: "interaction",
      interactionId: "auth_1",
      turnId: "turn",
      stepIndex: 0,
      status: "open",
      request: {
        kind: "sign-in",
        prompt: "Connect",
        signIn: {
          name: "github",
          displayName: "GitHub",
          url: "javascript:alert(1)",
          userCode: "ABCD",
        },
      },
    },
    { type: "file", mediaType: "text/plain", filename: "report.txt" },
  ])] };
  assert.equal(hasPendingAction(data), true);
  const message = toThreadMessages(data)[0];
  assert.deepEqual(message.status, { type: "requires-action", reason: "interrupt" });
  assert.equal(message.content[0].data.url, undefined);
  assert.equal(message.content[0].data.userCode, "ABCD");
  assert.equal(message.content[1].sourceType, "id");
  assert.equal(message.content[1].data, "unavailable");
  const completed = toThreadMessages({ messages: [assistant([{
    type: "interaction",
    interactionId: "auth_1",
    turnId: "turn",
    stepIndex: 0,
    status: "settled",
    outcome: "accepted",
    request: {
      kind: "sign-in",
      prompt: "Connect",
      signIn: {
        name: "github",
        displayName: "GitHub",
        url: "https://github.com/login/device",
      },
    },
  }], "complete")] })[0];
  assert.equal(completed.content[0].data.url, "https://github.com/login/device");
  assert.equal(completed.content[0].data.outcome, "authorized");
  assert.equal(hasPendingAction({ messages: [assistant([], "complete")] }), false);
});

test("projects pending approval as action-required and preserves declared option identities", () => {
  const data = { messages: [assistant([openApproval()])] };
  assert.equal(hasPendingAction(data), true);
  const message = toThreadMessages(data)[0];
  assert.deepEqual(message.status, { type: "requires-action", reason: "tool-calls" });
  assert.equal(message.content[0].approval.id, "approval_1");
  assert.deepEqual(message.content[0].approval.options.map(({ id, kind }) => [id, kind]), [
    ["approve", "allow-once"], ["cancel", "reject-once"],
  ]);
});

test("completed turns with an open approval stay action-required", () => {
  const data = { messages: [assistant([openApproval({
    name: "confirm_step",
    interactionId: "approval_park",
    prompt: "Confirm?",
    input: { summary: "ship the release" },
  })], "complete")] };
  assert.equal(hasPendingAction(data), true);
  assert.deepEqual(toThreadMessages(data)[0].status, {
    type: "requires-action",
    reason: "tool-calls",
  });
  assert.deepEqual(getPendingApprovals(data), [{
    requestId: "approval_park",
    toolName: "confirm_step",
    kind: "approval",
    display: "decision",
    prompt: "Confirm?",
    detail: "ship the release",
    options: [
      { id: "approve", label: "Allow" },
      { id: "cancel", label: "Deny" },
    ],
    allowFreeform: false,
  }]);
});

test("free-text schema question has no synthetic Approve/Cancel", () => {
  const data = {
    messages: [
      assistant(
        [
          {
            type: "interaction",
            interactionId: "q1",
            turnId: "turn",
            stepIndex: 0,
            status: "open",
            request: {
              kind: "question",
              display: "text",
              prompt: "What should count as inside this concept?",
              allowFreeform: true,
            },
            call: { name: "ask_question" },
          },
        ],
        "complete",
      ),
    ],
  };
  const pending = getPendingApprovals(data);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].kind, "question");
  assert.equal(pending[0].display, "text");
  assert.equal(pending[0].allowFreeform, true);
  assert.deepEqual(pending[0].options, []);
});

test("choice schema question keeps real option ids", () => {
  const data = {
    messages: [
      assistant(
        [
          {
            type: "interaction",
            interactionId: "q2",
            turnId: "turn",
            stepIndex: 0,
            status: "open",
            request: {
              kind: "question",
              display: "select",
              prompt: "Does a handshake count?",
              options: [
                { id: "yes", label: "Yes, it counts" },
                { id: "no", label: "No, spoken only" },
              ],
            },
            call: { name: "ask_question" },
          },
        ],
        "complete",
      ),
    ],
  };
  const pending = getPendingApprovals(data);
  assert.deepEqual(
    pending[0].options.map((option) => option.id),
    ["yes", "no"],
  );
  assert.equal(pending[0].kind, "question");
});

test("multiple open questions return in order with skip option dismissible", () => {
  const data = {
    messages: [
      assistant(
        [
          {
            type: "interaction",
            interactionId: "q-a",
            turnId: "turn",
            stepIndex: 0,
            status: "open",
            request: {
              kind: "question",
              display: "select",
              prompt: "First?",
              options: [
                { id: "one", label: "One" },
                { id: "skip", label: "Skip" },
              ],
            },
            call: { name: "ask_question" },
          },
          {
            type: "interaction",
            interactionId: "q-b",
            turnId: "turn",
            stepIndex: 0,
            status: "open",
            request: {
              kind: "question",
              display: "select",
              prompt: "Second?",
              options: [
                { id: "yes", label: "Yes" },
                { id: "no", label: "No" },
              ],
            },
            call: { name: "ask_question" },
          },
          {
            type: "interaction",
            interactionId: "q-c",
            turnId: "turn",
            stepIndex: 0,
            status: "open",
            request: {
              kind: "question",
              display: "text",
              prompt: "Third?",
              allowFreeform: true,
            },
            call: { name: "ask_question" },
          },
          {
            type: "interaction",
            interactionId: "q-d",
            turnId: "turn",
            stepIndex: 0,
            status: "open",
            request: {
              kind: "question",
              display: "text",
              prompt: "Fourth beyond composer cap?",
              allowFreeform: true,
            },
            call: { name: "ask_question" },
          },
        ],
        "complete",
      ),
    ],
  };
  const pending = getPendingApprovals(data);
  assert.equal(pending.length, 4);
  assert.deepEqual(
    pending.map((item) => item.requestId),
    ["q-a", "q-b", "q-c", "q-d"],
  );
  assert.equal(pending[0].dismissible, true);
  assert.equal(pending[0].skipOptionId, "skip");
  assert.equal(pending[1].dismissible, undefined);
  assert.deepEqual(
    pending.filter((item) => item.kind === "question").slice(0, 3).map((item) => item.requestId),
    ["q-a", "q-b", "q-c"],
  );
});

test("composer waiting questions omit text-only stacks but keep mixed multi-ask", () => {
  const textOnly = {
    requestId: "t1",
    toolName: "ask_question",
    kind: "question",
    display: "text",
    prompt: "Anything else?",
    options: [],
    allowFreeform: true,
  };
  const choice = {
    requestId: "c1",
    toolName: "ask_question",
    kind: "question",
    display: "select",
    prompt: "Pick one",
    options: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ],
    allowFreeform: false,
  };
  assert.deepEqual(composerWaitingQuestions([textOnly]), []);
  assert.deepEqual(
    composerWaitingQuestions([choice, textOnly]).map((item) => item.requestId),
    ["c1", "t1"],
  );
});

test("propose_schema approval surfaces statement detail and Allow/Deny", () => {
  const data = {
    messages: [
      assistant(
        [
          openApproval({
            name: "propose_schema",
            interactionId: "schema_save",
            prompt:
              "Save schema: Commitment (commitment)\nA promise the speaker intends to keep.",
            input: {
              action: "create",
              slug: "commitment",
              statement: "A promise the speaker intends to keep.",
            },
          }),
        ],
        "complete",
      ),
    ],
  };
  const pending = getPendingApprovals(data);
  assert.equal(pending[0].kind, "approval");
  assert.equal(pending[0].toolName, "propose_schema");
  assert.equal(pending[0].detail, "A promise the speaker intends to keep.");
  assert.deepEqual(
    pending[0].options.map((option) => option.id),
    ["approve", "cancel"],
  );
});

test("stale approvals on failed turns cannot block the next send", () => {
  const old = assistant([openApproval({ interactionId: "a1" })], "failed");
  assert.equal(hasPendingAction({ messages: [old] }), false);
  // Historical failures render as complete so old chats do not show a live error banner.
  assert.deepEqual(toThreadMessages({ messages: [old] })[0].status, { type: "complete", reason: "stop" });
});

test("ended sessions with store error do not paint a live failure on history", () => {
  const data = {
    messages: [
      user,
      assistant([{ type: "text", text: "Working", state: "done" }], "complete"),
    ],
  };
  assert.deepEqual(
    toThreadMessages(data, { hasError: true })[1].status,
    { type: "complete", reason: "stop" },
  );
  assert.equal(toThreadMessages(data, { hasError: true })[1].content[0].text, "Working");
});

test("live streaming failures still surface incomplete error status", () => {
  const data = {
    messages: [
      user,
      assistant([{ type: "text", text: "Working", state: "streaming" }], "streaming"),
    ],
  };
  assert.deepEqual(
    toThreadMessages(data, { isRunning: true, hasError: true })[1].status,
    { type: "incomplete", reason: "error" },
  );
});

test("hides only eve background notifications, not normal user text", () => {
  assert.equal(isTaskNotification("Background task task_abc update: 50%"), true);
  assert.equal(isTaskNotification("Background task task_abc needs authorization"), true);
  assert.equal(isTaskNotification("My background task is complete"), false);
});

test("attachment-only and paste-only first sends never title chats with a token or body", () => {
  const marker = { type: "text", text: "[mobile-attachment:abc]" };
  assert.equal(pendingMessageLabel([marker, { type: "text", text: "[Pasted text]\nprivate body" }]), "Pasted text");
  assert.equal(pendingMessageLabel([marker, { type: "file", data: "secret" }]), "[Attachment]");
  assert.equal(pendingMessageLabel([marker, { type: "text", text: "hello" }]), "hello");
  assert.equal(pendingMessageLabel([marker, { type: "text", text: "[Attached PDF: paper.pdf]" }]), "[Attachment]");
});

test("an explicit clipboard paste is sent as text and survives as a collapsed user chip", async () => {
  const pasted = "[Pasted text]\nline one\nline two";
  const outgoing = toEveTurn({ content: [], attachments: [{
    id: "paste-1",
    type: "document",
    name: "Pasted text",
    contentType: "text/plain",
    status: { type: "complete" },
    content: [{ type: "text", text: pasted }],
  }] });
  assert.ok(Array.isArray(outgoing.message));
  const projected = toThreadMessages({
    messages: [{
      id: "u1",
      role: "user",
      parts: [{ type: "text", text: pasted }],
    }],
  });
  assert.equal(projected[0].attachments?.[0]?.type, "document");
  assert.match(projected[0].attachments[0].name, /Pasted text/);
});

test("settled prefix messages keep identity across streaming updates to the tail", () => {
  const firstAssistant = {
    id: "a1",
    role: "assistant",
    metadata: { turnId: "t0", status: "complete" },
    parts: [{ type: "text", text: "Done.", state: "done" }],
  };
  const live = {
    id: "a2",
    role: "assistant",
    metadata: { turnId: "t1", status: "streaming" },
    parts: [{ type: "text", text: "Hel", state: "streaming" }],
  };
  const first = toThreadMessages(
    { messages: [user, firstAssistant, live] },
    { isRunning: true },
  );
  const nextLive = {
    ...live,
    parts: [{ type: "text", text: "Hello", state: "streaming" }],
  };
  const second = toThreadMessages(
    { messages: [user, firstAssistant, nextLive] },
    { isRunning: true },
  );
  assert.equal(second[0], first[0]);
  assert.equal(second[1], first[1]);
  assert.notEqual(second[2], first[2]);
  assert.equal(second[2].content[0].text, "Hello");
});

test("prefix identity holds across a multi-delta streaming sequence", () => {
  const prior = {
    id: "a1",
    role: "assistant",
    metadata: { turnId: "t0", status: "complete" },
    parts: [{ type: "text", text: "Earlier.", state: "done" }],
  };
  const chunks = ["H", "Hi", "Hi ", "Hi t", "Hi th", "Hi there"];
  let previous = null;
  for (const text of chunks) {
    const live = {
      id: "a2",
      role: "assistant",
      metadata: { turnId: "t1", status: "streaming" },
      parts: [{ type: "text", text, state: "streaming" }],
    };
    const projected = toThreadMessages(
      { messages: [user, prior, live] },
      { isRunning: true },
    );
    if (previous) {
      assert.equal(projected[0], previous[0]);
      assert.equal(projected[1], previous[1]);
      assert.notEqual(projected[2], previous[2]);
    }
    assert.equal(projected[2].content[0].text, text);
    previous = projected;
  }
});
