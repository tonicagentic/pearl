import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

register("./mobile-ts-resolve.mjs", pathToFileURL("./tests/"));

const {
  splitAssistantBlocks,
  lastTimelineBlockIndex,
  isContentBlockPart,
  isTrailingContentPhase,
} = await import("../mobile/src/assistant-blocks.ts");

test("splitAssistantBlocks interleaves timeline and content at text boundaries", () => {
  const parts = [
    { type: "reasoning", text: "plan" },
    { type: "tool-call", toolName: "read_file", status: { type: "complete" } },
    { type: "tool-call", toolName: "bash", status: { type: "complete" } },
    { type: "text", text: "Mid-turn answer." },
    { type: "reasoning", text: "more" },
    { type: "tool-call", toolName: "grep", status: { type: "complete" } },
    { type: "text", text: "Final answer." },
  ];

  const blocks = splitAssistantBlocks(parts);
  assert.deepEqual(
    blocks.map((block) => ({ kind: block.kind, indices: [...block.indices] })),
    [
      { kind: "timeline", indices: [0, 1, 2] },
      { kind: "content", indices: [3] },
      { kind: "timeline", indices: [4, 5] },
      { kind: "content", indices: [6] },
    ],
  );
  assert.equal(lastTimelineBlockIndex(blocks), 2);
});

test("empty text does not split the timeline", () => {
  const parts = [
    { type: "tool-call", toolName: "read_file", status: { type: "complete" } },
    { type: "text", text: "" },
    { type: "tool-call", toolName: "bash", status: { type: "complete" } },
  ];
  const blocks = splitAssistantBlocks(parts);
  assert.deepEqual(
    blocks.map((block) => ({ kind: block.kind, indices: [...block.indices] })),
    [{ kind: "timeline", indices: [0, 2] }],
  );
  assert.equal(isContentBlockPart({ type: "text", text: "   " }), false);
});

test("standalone tools and approvals are content boundaries", () => {
  const parts = [
    { type: "tool-call", toolName: "read_file", status: { type: "complete" } },
    {
      type: "tool-call",
      toolName: "write_file",
      status: { type: "complete" },
    },
    { type: "tool-call", toolName: "bash", status: { type: "complete" } },
  ];
  const blocks = splitAssistantBlocks(parts);
  assert.deepEqual(
    blocks.map((block) => ({ kind: block.kind, indices: [...block.indices] })),
    [
      { kind: "timeline", indices: [0] },
      { kind: "content", indices: [1] },
      { kind: "timeline", indices: [2] },
    ],
  );
});

test("live Working belongs only to a trailing timeline segment", () => {
  const toolsThenText = splitAssistantBlocks([
    { type: "tool-call", toolName: "bash", status: { type: "running" } },
    { type: "text", text: "Streaming answer…" },
  ]);
  const lastTimeline = lastTimelineBlockIndex(toolsThenText);
  assert.equal(lastTimeline, 0);
  // Content follows → timeline is last segment but not trailing live cluster.
  assert.notEqual(lastTimeline, toolsThenText.length - 1);
  assert.equal(isTrailingContentPhase(toolsThenText), true);

  const trailingTools = splitAssistantBlocks([
    { type: "text", text: "Earlier answer." },
    { type: "tool-call", toolName: "bash", status: { type: "running" } },
  ]);
  const trailingLast = lastTimelineBlockIndex(trailingTools);
  assert.equal(trailingLast, trailingTools.length - 1);
  assert.equal(isTrailingContentPhase(trailingTools), false);
});
