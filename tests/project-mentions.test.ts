import assert from "node:assert/strict";
import { test } from "node:test";

import {
  deleteChipBeforeCaret,
  draftPartsFromText,
  extractProjectMentions,
  insertProjectMention,
  plainTextFromDirectives,
  resolveTurnProjectId,
  serializeDraftParts,
  serializeProjectMention,
  trailingMentionQuery,
} from "../lib/chat/project-mentions.ts";
import { createFallbackTitle } from "../lib/chat/title.ts";

test("serializeProjectMention: bracket form with distinct id", () => {
  assert.equal(
    serializeProjectMention({ id: "proj_1", label: "Presentations" }),
    ":project[Presentations]{name=proj_1}",
  );
});

test("serializeProjectMention: omits name when id equals label", () => {
  assert.equal(
    serializeProjectMention({ id: "Alpha", label: "Alpha" }),
    ":project[Alpha]",
  );
});

test("serializeProjectMention: quoted fields when label has ]", () => {
  assert.equal(
    serializeProjectMention({ id: "p1", label: "A]B" }),
    ':project{label="A]B" name="p1"}',
  );
});

test("extractProjectMentions: bracket, quoted, ignores other types, dedupes", () => {
  const text =
    'Ask :project[Presentations]{name=p1} and :tool[Search] then ' +
    ':project{label="A]B" name="p2"} and :project[Presentations]{name=p1} again';
  assert.deepEqual(extractProjectMentions(text), [
    { id: "p1", label: "Presentations" },
    { id: "p2", label: "A]B" },
  ]);
});

test("plainTextFromDirectives: replaces chips with labels", () => {
  assert.equal(
    plainTextFromDirectives("Review :project[Presentations]{name=p1} tonight"),
    "Review Presentations tonight",
  );
});

test("createFallbackTitle: uses project labels, not raw directives", () => {
  assert.equal(
    createFallbackTitle("Help with :project[Presentations]{name=p1}"),
    "Help with Presentations",
  );
});

test("draft round-trip preserves project chips", () => {
  const source = "See :project[Presentations]{name=p1} please";
  const parts = draftPartsFromText(source);
  assert.deepEqual(parts, [
    { kind: "text", text: "See " },
    { kind: "project", id: "p1", label: "Presentations" },
    { kind: "text", text: " please" },
  ]);
  assert.equal(serializeDraftParts(parts), source);
});

test("trailingMentionQuery and insertProjectMention", () => {
  assert.equal(trailingMentionQuery("hello @pre"), "pre");
  assert.equal(trailingMentionQuery("hello @"), "");
  assert.equal(trailingMentionQuery("hello @pre more"), null);

  const inserted = insertProjectMention(
    draftPartsFromText("hello @pre"),
    { id: "p1", label: "Presentations" },
  );
  assert.deepEqual(inserted, [
    { kind: "text", text: "hello " },
    { kind: "project", id: "p1", label: "Presentations" },
    { kind: "text", text: "" },
  ]);
});

test("deleteChipBeforeCaret removes the preceding chip", () => {
  const parts = [
    { kind: "text" as const, text: "hi " },
    { kind: "project" as const, id: "p1", label: "Presentations" },
    { kind: "text" as const, text: "" },
  ];
  assert.deepEqual(deleteChipBeforeCaret(parts), [
    { kind: "text", text: "hi " },
  ]);
  assert.equal(deleteChipBeforeCaret([{ kind: "text", text: "x" }]), null);
});

test("resolveTurnProjectId: chat project wins; single mention fills; else null", () => {
  assert.equal(
    resolveTurnProjectId({
      chatProjectId: "chat_p",
      verifiedMentionIds: ["m1"],
    }),
    "chat_p",
  );
  assert.equal(
    resolveTurnProjectId({
      chatProjectId: null,
      verifiedMentionIds: ["m1"],
    }),
    "m1",
  );
  assert.equal(
    resolveTurnProjectId({
      chatProjectId: null,
      verifiedMentionIds: ["m1", "m2"],
    }),
    null,
  );
  assert.equal(
    resolveTurnProjectId({
      chatProjectId: null,
      verifiedMentionIds: [],
    }),
    null,
  );
});
