import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deriveSubagentRowContent,
  modelLabelForId,
  subagentRowActivity,
  subagentRowTitle,
} from "../lib/chat/subagent-row.ts";

describe("subagentRowTitle", () => {
  it("uses the first line and truncates", () => {
    assert.equal(
      subagentRowTitle("Finance app Drizzle cutover\nmore detail", "coder"),
      "Finance app Drizzle cutover",
    );
    const long = "x".repeat(80);
    const title = subagentRowTitle(long, "coder");
    assert.ok(title.endsWith("…"));
    assert.ok(title.length <= 48);
  });

  it("falls back when the message is empty", () => {
    assert.equal(subagentRowTitle("  ", "coder"), "coder");
    assert.equal(subagentRowTitle(undefined, "agent"), "agent");
  });
});

describe("modelLabelForId", () => {
  it("maps known gateway ids to composer labels", () => {
    assert.equal(modelLabelForId("openai/gpt-6-astra"), "GPT 6 Astra");
    assert.equal(modelLabelForId("callstack/apex"), "Apex");
  });

  it("falls back to the trailing segment", () => {
    assert.equal(modelLabelForId("vendor/custom-model-9"), "custom model 9");
  });

  it("omits empty ids", () => {
    assert.equal(modelLabelForId(undefined), undefined);
    assert.equal(modelLabelForId("  "), undefined);
  });
});

describe("subagentRowActivity", () => {
  it("prefers a live tool label in timeline voice", () => {
    assert.equal(
      subagentRowActivity([
        {
          role: "assistant",
          metadata: { status: "streaming" },
          parts: [
            {
              type: "tool",
              name: "bash",
              state: "running",
              input: { command: "pnpm tsc --noEmit" },
            },
          ],
        },
      ]),
      "Running pnpm tsc --noEmit",
    );
  });

  it("falls back to a reasoning heading", () => {
    assert.equal(
      subagentRowActivity([
        {
          role: "assistant",
          metadata: { status: "streaming" },
          parts: [
            {
              type: "reasoning",
              state: "streaming",
              text: "**Type-checking and fixing call sites**\nLooking at imports.",
            },
          ],
        },
      ]),
      "Type-checking and fixing call sites",
    );
  });

  it("ignores settled tools and empty transcripts", () => {
    assert.equal(
      subagentRowActivity([
        {
          role: "assistant",
          parts: [
            {
              type: "tool",
              name: "read_file",
              state: "completed",
              input: { filePath: "a.ts" },
            },
          ],
        },
      ]),
      undefined,
    );
    assert.equal(subagentRowActivity(undefined), undefined);
    assert.equal(subagentRowActivity([]), undefined);
  });
});

describe("deriveSubagentRowContent", () => {
  it("returns only the title when the child is missing", () => {
    assert.deepEqual(
      deriveSubagentRowContent({ title: "Finance cutover" }),
      { title: "Finance cutover" },
    );
  });

  it("returns only the title when the child is not followed", () => {
    assert.deepEqual(
      deriveSubagentRowContent({
        title: "Finance cutover",
        child: {
          name: "coder",
          observation: { status: "not-followed" },
        },
      }),
      { title: "Finance cutover" },
    );
  });

  it("includes activity from a followed child", () => {
    const row = deriveSubagentRowContent({
      title: "Finance cutover",
      child: {
        name: "coder",
        observation: {
          status: "following",
          conversation: {
            messages: [
              {
                role: "assistant",
                metadata: { status: "streaming" },
                parts: [
                  {
                    type: "reasoning",
                    state: "streaming",
                    text: "**Type-checking and fixing call sites**",
                  },
                ],
              },
            ],
          },
        },
      },
    });
    assert.equal(row.title, "Finance cutover");
    assert.equal(row.activity, "Type-checking and fixing call sites");
    assert.equal(row.modelLabel, undefined);
  });
});
