import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

// Compile the two pure mobile modules into an ignored local directory so the
// native package's extensionless imports work in Node without a Metro runtime.
const mobile = join(process.cwd(), "mobile");
const mobileRequire = createRequire(join(mobile, "package.json"));
const babel = mobileRequire("@babel/core");
const directory = mkdtempSync(join(mobile, ".expo", "projection-test-"));
for (const name of ["attachment-content", "message-projection", "message-reducer"]) {
  const source = readFileSync(join(mobile, "src", `${name}.ts`), "utf8");
  const { code } = babel.transformSync(source, {
    filename: join(mobile, "src", `${name}.ts`), babelrc: false, configFile: false,
    presets: [mobileRequire.resolve("@babel/preset-typescript")],
    plugins: [mobileRequire.resolve("@babel/plugin-transform-modules-commonjs")],
  });
  writeFileSync(join(directory, `${name}.js`), code);
}
const require = createRequire(join(directory, "message-projection.js"));
const { toThreadMessages, hasPendingAction, isTaskNotification, pendingMessageLabel } = require("./message-projection.js");
const { createMobileMessageReducer } = require("./message-reducer.js");
const { toEveTurn } = require("./attachment-content.js");
process.on("exit", () => rmSync(directory, { recursive: true, force: true }));

const user = { id: "turn:user", role: "user", parts: [{ type: "text", text: "hello" }] };
const assistant = (parts, status = "streaming") => ({
  id: "turn:assistant", role: "assistant", metadata: { turnId: "turn", status }, parts,
});

test("projects reasoning, live tool arguments, final result and text in order", () => {
  const messages = toThreadMessages({ messages: [user, assistant([
    { type: "reasoning", text: "Checking", state: "done" },
    { type: "dynamic-tool", toolName: "lookup", toolCallId: "call_1", inputText: '{"q":', state: "input-streaming" },
    { type: "text", text: "Done", state: "streaming" },
  ])] }, { isRunning: true });
  assert.equal(messages[1].status.type, "running");
  assert.deepEqual(messages[1].content.map((part) => part.type), ["reasoning", "tool-call", "text"]);
  assert.equal(messages[1].content[1].argsText, '{"q":');
  assert.equal(messages[1].content[1].toolCallId, "call_1");
  assert.equal(messages[1].content[0].status.type, "complete");
  const settled = toThreadMessages({ messages: [assistant([
    { type: "dynamic-tool", toolName: "lookup", toolCallId: "call_1", input: { q: "a" }, output: { answer: "b" }, state: "output-available" },
  ], "complete")] });
  assert.deepEqual(settled[0].content[0].result, { answer: "b" });
  assert.equal(settled[0].status.type, "complete");
});

test("renders authorization and file metadata without inventing bytes or unsafe links", () => {
  const data = { messages: [assistant([
    { type: "authorization", name: "github", displayName: "GitHub", description: "Connect", turnId: "turn", stepIndex: 0, state: "required", authorization: { url: "javascript:alert(1)", userCode: "ABCD" } },
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
    type: "authorization", name: "github", displayName: "GitHub", description: "Connect", turnId: "turn", stepIndex: 0,
    state: "completed", outcome: "authorized", authorization: { url: "https://github.com/login/device" },
  }], "complete")] })[0];
  assert.equal(completed.content[0].data.url, "https://github.com/login/device");
  assert.equal(completed.content[0].data.outcome, "authorized");
  assert.equal(hasPendingAction({ messages: [assistant([], "complete")] }), false);
});

test("projects pending approval as action-required and preserves declared option identities", () => {
  const data = { messages: [assistant([{
    type: "dynamic-tool", toolName: "write_file", toolCallId: "c1", input: { filePath: "a.md", content: "hello" },
    state: "approval-requested", approval: { id: "approval_1" },
    toolMetadata: { eve: { kind: "tool-call", name: "write_file", inputRequest: {
      requestId: "approval_1", kind: "tool-approval", prompt: "Save this?", options: [
        { id: "approve", label: "Allow" }, { id: "cancel", label: "Deny" },
      ],
    } } },
  }])] };
  assert.equal(hasPendingAction(data), true);
  const message = toThreadMessages(data)[0];
  assert.deepEqual(message.status, { type: "requires-action", reason: "tool-calls" });
  assert.equal(message.content[0].approval.id, "approval_1");
  assert.deepEqual(message.content[0].approval.options.map(({ id, kind }) => [id, kind]), [
    ["approve", "allow-once"], ["cancel", "reject-once"],
  ]);
});

test("stale approvals on failed turns cannot block the next send", () => {
  const old = assistant([{ type: "dynamic-tool", toolName: "write_file", toolCallId: "c1", input: {}, state: "approval-requested", approval: { id: "a1" } }], "failed");
  assert.equal(hasPendingAction({ messages: [old] }), false);
  assert.deepEqual(toThreadMessages({ messages: [old] })[0].status, { type: "incomplete", reason: "error" });
});

test("failed turns finalize text and keep their error status in the native reducer", () => {
  const reducer = createMobileMessageReducer();
  let data = reducer.initial();
  for (const event of [
    { type: "message.received", data: { messageId: "m1", text: "hello", turnId: "turn" } },
    { type: "message.appended", data: { messageDelta: "Working", messageSoFar: "Working", sequence: 1, stepIndex: 0, turnId: "turn" } },
    { type: "turn.failed", data: { turnId: "turn", error: { message: "failed" } } },
  ]) data = reducer.reduce(data, { meta: { at: new Date().toISOString(), id: "e" }, ...event });
  const reply = data.messages.find((message) => message.role === "assistant");
  assert.equal(reply.metadata.status, "failed");
  assert.equal(reply.parts.find((part) => part.type === "text").state, "done");
  assert.deepEqual(toThreadMessages(data)[1].status, { type: "incomplete", reason: "error" });
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

test("an explicit clipboard paste is sent as text and survives as a collapsed user chip", () => {
  const pasted = "[Pasted text]\nline one\nline two";
  const outgoing = toEveTurn({ content: [], attachments: [{
    name: "Pasted text", status: { type: "complete" }, type: "document",
    content: [{ type: "text", text: pasted }],
  }] });
  assert.deepEqual(outgoing.message, [{ type: "text", text: pasted }]);
  const [message] = toThreadMessages({ messages: [{ id: "u", role: "user", parts: [
    { type: "text", text: pasted },
  ] }] });
  assert.deepEqual(message.content, []);
  assert.equal(message.attachments[0].name, "Pasted text · 17 characters");
  assert.equal(message.attachments[0].contentType, "text/plain");
});

test("keeps user attachment chips while removing only internal marker text", () => {
  const [message] = toThreadMessages({ messages: [{ id: "u", role: "user", parts: [
    { type: "text", text: "[mobile-attachment:abc]" },
    { type: "text", text: "hi" },
    { type: "file", mediaType: "image/png", filename: "photo.png", url: "https://example.com/photo.png" },
  ] }] });
  assert.equal(message.content.length, 1);
  assert.equal(message.content[0].text, "hi");
  assert.equal(message.attachments[0].name, "photo.png");
});
