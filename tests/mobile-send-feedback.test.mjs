import assert from "node:assert/strict";
import { test } from "node:test";
import { SessionStore } from "eve/client";
import {
  applyAttachmentHolds,
  createAttachmentHold,
  createLocalSend,
  hasConfirmedSend,
  hasUnresolvedSend,
  holdSatisfied,
  projectSendMessages,
  shouldRestoreUnsentDraft,
} from "../mobile/src/send-feedback.ts";

const user = (text) => ({ role: "user", content: [{ type: "text", text }] });
const imageAttachment = (image, name = "photo.jpg") => ({
  id: "image-1",
  name,
  type: "image",
  contentType: "image/jpeg",
  status: { type: "complete" },
  content: [{ type: "image", image }],
});

test("eve rejects failed preparation; the draft must return", async () => {
  const store = new SessionStore({
    baseUrl: "http://127.0.0.1:1",
  });
  store.setCallbacks({
    prepareSend: async () => { throw new Error("Could not save pending marker"); },
  });
  await assert.rejects(
    () => store.send({ message: "local-only test" }),
    /Could not save pending marker/,
  );
  assert.equal(store.snapshot.status, "idle");
  assert.equal(store.snapshot.events.length, 0);
  assert.equal(Boolean(store.snapshot.error), true);
  assert.equal(shouldRestoreUnsentDraft(store.snapshot.error, false), true);
  assert.equal(shouldRestoreUnsentDraft(store.snapshot.error, true), false);
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
  assert.equal(hasConfirmedSend([{ type: "delivery.consumed" }, { type: "content.delta" }], pending), false);
  assert.equal(hasConfirmedSend([{ type: "delivery.consumed" }, { type: "content.delta" }, { type: "model.started" }, { type: "delivery.consumed" }], pending), true);
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
  assert.equal(hasUnresolvedSend([{ type: "delivery.consumed" }], pending, "first"), false);
  assert.equal(hasUnresolvedSend([], null, "first"), true);
  assert.equal(hasUnresolvedSend([], null, null), false);
});

test("clearing pending after deliveryId accept unblocks the next send", () => {
  // send() resolved with deliveryId: localSend is dropped, but the durable
  // prepareSend marker can linger until delivery.consumed. That window used
  // to block follow-ups via hasUnresolvedSend(..., null, pendingMessage).
  assert.equal(hasUnresolvedSend([], null, "first"), true);
  // clearPendingMessage (or delivery.consumed) nulls the marker:
  assert.equal(hasUnresolvedSend([], null, null), false);
});

test("a sent photo stays on the bubble instead of the file placeholder", () => {
  const image = "data:image/jpeg;base64,YWJj";
  const attachment = {
    id: "image-1", name: "photo.jpg", type: "image", contentType: "image/jpeg",
    status: { type: "complete" }, content: [{ type: "image", image }],
  };
  const pending = createLocalSend({}, 0, 0, {
    content: [{ type: "text", text: "what's this" }],
    attachments: [attachment],
  });
  const summary = user("what's this\n[file: photo.jpg]");
  const during = projectSendMessages([summary], [{ role: "user" }], pending);
  assert.equal(during[0].content[0].text, "what's this");
  assert.equal(during[0].attachments[0].content[0].image, image);
  const accepted = projectSendMessages([summary], [{ role: "user" }], pending, true);
  assert.equal(accepted[0].content[0].text, "what's this");
  assert.equal(accepted[0].attachments[0].content[0].image, image);
  assert.equal(accepted[0].metadata, undefined);
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

test("attachment hold keeps the photo after deliveryId clears localSend", () => {
  const image = "data:image/jpeg;base64,YWJj";
  const hold = createAttachmentHold(0, {
    content: [{ type: "text", text: "what's this" }],
    attachments: [imageAttachment(image)],
  });
  assert.ok(hold);
  const summary = user("what's this\n[file: photo.jpg]");
  // localSend is null (cleared on deliveryId); hold still paints the chip.
  const held = applyAttachmentHolds([summary], [{ role: "user" }], [hold]);
  assert.equal(held[0].content[0].text, "what's this");
  assert.equal(held[0].attachments[0].content[0].image, image);
  assert.equal(holdSatisfied([{ role: "user", parts: [{ type: "text", text: "what's this\n[file: photo.jpg]" }] }], hold), false);
});

test("attachment hold appends the preview when eve has not published a user row", () => {
  const image = "https://blob.example/attachments/photo.jpg?token=1";
  const hold = createAttachmentHold(0, {
    content: [{ type: "text", text: "fit check" }],
    attachments: [imageAttachment(image)],
  });
  const held = applyAttachmentHolds([], [], [hold]);
  assert.equal(held.length, 1);
  assert.equal(held[0].attachments[0].content[0].image, image);
  assert.equal(holdSatisfied([], hold), false);
});

test("attachment hold leaves a row alone once eve has a displayable image", () => {
  const image = "https://blob.example/attachments/photo.jpg?token=1";
  const hold = createAttachmentHold(0, {
    content: [{ type: "text", text: "what's this" }],
    attachments: [imageAttachment(image)],
  });
  const row = {
    role: "user",
    content: [{ type: "text", text: "what's this" }],
    attachments: [imageAttachment(image, "IMG_7629.jpg")],
  };
  const held = applyAttachmentHolds([row], [{ role: "user" }], [hold]);
  assert.equal(held[0], row);
  assert.equal(
    holdSatisfied(
      [{
        role: "user",
        parts: [
          { type: "text", text: "what's this" },
          { type: "file", mediaType: "image/jpeg", url: image, filename: "IMG_7629.jpg" },
        ],
      }],
      hold,
    ),
    true,
  );
});

test("a second attachment hold targets the later user row", () => {
  const first = "data:image/jpeg;base64,YWJj";
  const second = "data:image/jpeg;base64,ZGVm";
  const firstHold = createAttachmentHold(0, {
    content: [{ type: "text", text: "first" }],
    attachments: [imageAttachment(first, "one.jpg")],
  });
  const secondHold = createAttachmentHold(2, {
    content: [{ type: "text", text: "second" }],
    attachments: [imageAttachment(second, "two.jpg")],
  });
  const messages = [
    {
      role: "user",
      content: [{ type: "text", text: "first" }],
      attachments: [imageAttachment(first, "one.jpg")],
    },
    { role: "assistant", content: [{ type: "text", text: "nice" }] },
    user("second\n[file: two.jpg]"),
  ];
  const source = [
    { role: "user" },
    { role: "assistant" },
    { role: "user" },
  ];
  const held = applyAttachmentHolds(messages, source, [firstHold, secondHold]);
  // First row already has its image — leave it alone.
  assert.equal(held[0], messages[0]);
  assert.equal(held[2].content[0].text, "second");
  assert.equal(held[2].attachments[0].content[0].image, second);
  assert.equal(held[2].attachments[0].name, "two.jpg");
});
