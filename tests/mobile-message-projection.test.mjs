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
    prompt: "Confirm?",
    detail: "ship the release",
    options: [
      { id: "approve", label: "Allow" },
      { id: "cancel", label: "Deny" },
    ],
  }]);
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
