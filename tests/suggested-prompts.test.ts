import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildSuggestedPromptContextPack,
  fingerprintSuggestedPromptContext,
  isSuggestedPromptContextEmpty,
  sanitizeSuggestedPrompts,
} from "../lib/chat/suggested-prompts.ts";

test("buildSuggestedPromptContextPack caps and clips inputs", () => {
  const pack = buildSuggestedPromptContextPack({
    memoryEntries: [
      { text: "  Likes   short replies. " },
      { text: "x".repeat(200) },
      ...Array.from({ length: 20 }, (_, i) => ({ text: `fact ${i}` })),
    ],
    issues: [
      {
        title: "File taxes",
        areaName: "Finance",
        dueDate: "2026-04-15",
        reviewDate: null,
      },
      {
        title: "   ",
        areaName: "Home",
        dueDate: null,
        reviewDate: null,
      },
    ],
    chats: [{ title: "Kitchen remodel" }, { title: "" }],
  });

  assert.equal(pack.memory.length, 12);
  assert.equal(pack.memory[0], "Likes short replies.");
  assert.ok(pack.memory[1]!.endsWith("…"));
  assert.equal(pack.memory[1]!.length, 120);
  assert.deepEqual(pack.issues, [
    {
      title: "File taxes",
      area: "Finance",
      dueDate: "2026-04-15",
      reviewDate: null,
    },
  ]);
  assert.deepEqual(pack.recentChats, ["Kitchen remodel"]);
});

test("fingerprint is stable for the same pack and changes with content", () => {
  const base = buildSuggestedPromptContextPack({
    memoryEntries: [{ text: "Lives in Berlin" }],
    issues: [
      {
        title: "Renew passport",
        areaName: "Admin",
        dueDate: "2026-06-01",
        reviewDate: null,
      },
    ],
    chats: [{ title: "Trip planning" }],
  });
  const same = buildSuggestedPromptContextPack({
    memoryEntries: [{ text: "Lives in Berlin" }],
    issues: [
      {
        title: "Renew passport",
        areaName: "Admin",
        dueDate: "2026-06-01",
        reviewDate: null,
      },
    ],
    chats: [{ title: "Trip planning" }],
  });
  const changed = buildSuggestedPromptContextPack({
    memoryEntries: [{ text: "Lives in Berlin" }],
    issues: [
      {
        title: "Renew passport",
        areaName: "Admin",
        dueDate: "2026-06-01",
        reviewDate: null,
      },
      {
        title: "Book dentist",
        areaName: "Health",
        dueDate: null,
        reviewDate: "2026-05-01",
      },
    ],
    chats: [{ title: "Trip planning" }],
  });

  assert.equal(
    fingerprintSuggestedPromptContext(base),
    fingerprintSuggestedPromptContext(same),
  );
  assert.notEqual(
    fingerprintSuggestedPromptContext(base),
    fingerprintSuggestedPromptContext(changed),
  );
});

test("empty pack skips model work", () => {
  const empty = buildSuggestedPromptContextPack({});
  assert.equal(isSuggestedPromptContextEmpty(empty), true);
  assert.equal(
    isSuggestedPromptContextEmpty(
      buildSuggestedPromptContextPack({
        memoryEntries: [{ text: "Prefers brief emails" }],
      }),
    ),
    false,
  );
});

test("sanitizeSuggestedPrompts drops bad items and caps at four", () => {
  const prompts = sanitizeSuggestedPrompts([
    { title: "Taxes", prompt: "Help me finish my taxes" },
    { title: "", prompt: "Missing title" },
    { title: "Dup", prompt: "Help me finish my taxes" },
    { title: 12, prompt: "bad" },
    { title: "Passport", prompt: "What do I need for my passport renewal?" },
    { title: "Kitchen", prompt: "Continue the kitchen remodel plan" },
    { title: "Dentist", prompt: "Remind me to book the dentist" },
    { title: "Extra", prompt: "Should not appear" },
  ]);

  assert.deepEqual(prompts, [
    { title: "Taxes", prompt: "Help me finish my taxes" },
    {
      title: "Passport",
      prompt: "What do I need for my passport renewal?",
    },
    { title: "Kitchen", prompt: "Continue the kitchen remodel plan" },
    { title: "Dentist", prompt: "Remind me to book the dentist" },
  ]);
});

test("sanitizeSuggestedPrompts turns empty model output into []", () => {
  assert.deepEqual(sanitizeSuggestedPrompts([]), []);
  assert.deepEqual(
    sanitizeSuggestedPrompts([{ title: null, prompt: null }]),
    [],
  );
});
