import assert from "node:assert/strict";
import { test } from "node:test";
import { EveAgentStore, defaultMessageReducer } from "eve/client";
import { createLocalSend, hasConfirmedSend, hasUnresolvedSend, projectSendMessages, shouldRestoreUnsentDraft } from "../mobile/src/send-feedback.ts";

const user = (text) => ({ role: "user", content: [{ type: "text", text }] });

test("eve resolves failed preparation without dispatching; the draft must return", async () => {
  const store = new EveAgentStore({
    host: "http://127.0.0.1:1",
    reducer: defaultMessageReducer(),
  });
  store.setCallbacks({
    prepareSend: async () => { throw new Error("Could not save pending marker"); },
  });
  await store.send({ message: "local-only test" });
  assert.equal(store.snapshot.status, "error");
  assert.equal(store.snapshot.events.length, 0);
  assert.equal(shouldRestoreUnsentDraft(store.snapshot.status, false), true);
  assert.equal(shouldRestoreUnsentDraft(store.snapshot.status, true), false);
});

test("local user row appears before eve accepts an identical follow-up", () => {
  const prior = user("same words");
  const pending = createLocalSend({}, 2, 3, {
    content: [{ type: "text", text: "same words" }],
    attachments: [],
  });
  const during = projectSendMessages([prior, { role: "assistant", content: "Done" }], [prior, { role: "assistant" }], pending);
  assert.equal(during.length, 3);
  assert.equal(during[2].metadata.custom.mobileSendState, "preparing");
  assert.equal(during[2].id, undefined);
  assert.equal(hasConfirmedSend([{ type: "message.received" }, { type: "message.appended" }], pending), false);
  assert.equal(hasConfirmedSend([{ type: "message.received" }, { type: "message.appended" }, { type: "step.started" }, { type: "message.received" }], pending), true);
  const optimistic = projectSendMessages([...during.slice(0, 2), user("same words")], [prior, { role: "assistant" }, { role: "user" }], pending);
  assert.equal(optimistic.length, 3);
  assert.equal(optimistic[2].metadata.custom.mobileSendState, "preparing");
  const accepted = projectSendMessages([...during.slice(0, 2), user("same words")], [prior, { role: "assistant" }, { role: "user" }], pending, true);
  assert.equal(accepted.length, 3);
  assert.equal(accepted[2].metadata, undefined);
});

test("unresolved turns cannot be overwritten before confirmation", () => {
  const pending = createLocalSend({}, 0, 0, { content: [{ type: "text", text: "first" }], attachments: [] });
  assert.equal(hasUnresolvedSend([], pending, null), true);
  assert.equal(hasUnresolvedSend([{ type: "message.received" }], pending, "first"), false);
  assert.equal(hasUnresolvedSend([], null, "first"), true);
  assert.equal(hasUnresolvedSend([], null, null), false);
});

test("attachment-only turn keeps its chip and never relies on text matching", () => {
  const attachment = { id: "image-1", name: "photo.jpg", type: "image", contentType: "image/jpeg", status: { type: "complete" }, content: [] };
  const pending = createLocalSend({}, 0, 0, { content: [], attachments: [attachment] });
  const during = projectSendMessages([], [], pending);
  assert.equal(during[0].attachments[0].name, "photo.jpg");
  assert.equal(during[0].content.length, 0);
  const accepted = projectSendMessages([user("")], [{ role: "user" }], pending, true);
  assert.equal(accepted.length, 1);
});

test("uncertain local turn remains visible until server confirmation", () => {
  const pending = { ...createLocalSend({}, 1, 1, { content: [{ type: "text", text: "hello" }], attachments: [] }), phase: "uncertain" };
  const during = projectSendMessages([user("old")], [{ role: "user" }], pending);
  assert.equal(during.at(-1).metadata.custom.mobileSendState, "uncertain");
  assert.equal(projectSendMessages([user("old")], [{ role: "user" }], null).length, 1);
});
