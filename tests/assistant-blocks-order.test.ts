import assert from "node:assert/strict";
import { test } from "node:test";

import {
  splitAssistantBlocks,
  type AssistantMessagePart,
} from "../mobile/src/assistant-blocks.ts";

test("write_file card renders after the Worked-for timeline", () => {
  const parts: AssistantMessagePart[] = [
    {
      type: "tool-call",
      toolName: "write_file",
      status: { type: "complete" },
    },
    {
      type: "tool-call",
      toolName: "read_file",
      status: { type: "complete" },
    },
    {
      type: "tool-call",
      toolName: "bash",
      status: { type: "complete" },
    },
    { type: "text", text: "Saved the README." },
  ];

  const blocks = splitAssistantBlocks(parts);
  assert.deepEqual(
    blocks.map((block) => block.kind),
    ["timeline", "content", "content"],
  );
  assert.deepEqual(blocks[0]?.indices, [1, 2]);
  assert.deepEqual(blocks[1]?.indices, [0]);
  assert.deepEqual(blocks[2]?.indices, [3]);
});

test("write_file after a timeline stays after that timeline", () => {
  const parts: AssistantMessagePart[] = [
    {
      type: "tool-call",
      toolName: "web_search",
      status: { type: "complete" },
    },
    {
      type: "tool-call",
      toolName: "write_file",
      status: { type: "complete" },
    },
    { type: "text", text: "Done." },
  ];

  const blocks = splitAssistantBlocks(parts);
  assert.deepEqual(
    blocks.map((block) => block.kind),
    ["timeline", "content", "content"],
  );
  assert.deepEqual(blocks[0]?.indices, [0]);
  assert.deepEqual(blocks[1]?.indices, [1]);
  assert.deepEqual(blocks[2]?.indices, [2]);
});
