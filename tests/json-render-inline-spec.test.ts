import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { comparisonBarShares } from "../lib/json-render/comparison-bar.ts";
import {
  parseInlineSpec,
  proseFromMessageText,
} from "../lib/json-render/inline-spec.ts";

const ROOT_PATCH = '{"op":"add","path":"/root","value":"main"}';
const CARD_PATCH =
  '{"op":"add","path":"/elements/main","value":{"type":"Card","props":{"title":"Revenue"},"children":[]}}';
const BAR_PATCH =
  '{"op":"add","path":"/elements/bar","value":{"type":"ComparisonBar","props":{"leftLabel":"No","leftValue":53.7,"rightLabel":"Yes","rightValue":46.3,"caption":"72% counted"},"children":[]}}';
const CARD_WITH_BAR_PATCH =
  '{"op":"add","path":"/elements/main","value":{"type":"Card","props":{"title":"Prop 40"},"children":["bar"]}}';

describe("parseInlineSpec", () => {
  it("returns prose-only for ordinary replies", () => {
    const result = parseInlineSpec("Just a normal answer.\n\nSecond paragraph.");
    assert.equal(result.hasSpec, false);
    assert.equal(result.spec, null);
    assert.equal(result.segments.length, 1);
    assert.equal(result.segments[0]?.type, "text");
    assert.match(result.prose, /Just a normal answer/);
  });

  it("compiles a fenced spec and keeps surrounding prose", () => {
    const text = [
      "Here is a summary:",
      "```spec",
      ROOT_PATCH,
      CARD_PATCH,
      "```",
      "Want more detail?",
    ].join("\n");

    const result = parseInlineSpec(text);
    assert.equal(result.hasSpec, true);
    assert.equal(result.spec?.root, "main");
    assert.equal(result.spec?.elements.main?.type, "Card");
    assert.deepEqual(
      result.segments.map((segment) => segment.type),
      ["text", "spec", "text"],
    );
    assert.equal(result.prose.includes("```spec"), false);
    assert.match(result.prose, /Here is a summary/);
    assert.match(result.prose, /Want more detail/);
  });

  it("treats bare JSONL patch lines between sentences as one spec", () => {
    const text = [
      "Comparison:",
      ROOT_PATCH,
      CARD_PATCH,
      "Pick a follow-up.",
    ].join("\n");

    const result = parseInlineSpec(text);
    assert.equal(result.hasSpec, true);
    assert.deepEqual(
      result.segments.map((segment) => segment.type),
      ["text", "spec", "text"],
    );
    assert.equal(result.segments.filter((s) => s.type === "spec").length, 1);
  });

  it("compiles a ComparisonBar inside a Card scoreboard", () => {
    const text = [
      "No is leading:",
      "```spec",
      ROOT_PATCH,
      CARD_WITH_BAR_PATCH,
      BAR_PATCH,
      "```",
    ].join("\n");

    const result = parseInlineSpec(text);
    assert.equal(result.hasSpec, true);
    assert.equal(result.spec?.elements.main?.type, "Card");
    assert.equal(result.spec?.elements.bar?.type, "ComparisonBar");
    assert.deepEqual(result.spec?.elements.bar?.props, {
      leftLabel: "No",
      leftValue: 53.7,
      rightLabel: "Yes",
      rightValue: 46.3,
      caption: "72% counted",
    });
  });

  it("keeps an incomplete trailing patch buffered while streaming", () => {
    const partial = [
      "Building the card:",
      "```spec",
      ROOT_PATCH,
      '{"op":"add","path":"/elements/main","value":{"type":"Card"',
    ].join("\n");

    const streaming = parseInlineSpec(partial, { complete: false });
    assert.equal(streaming.hasSpec, true);
    assert.equal(streaming.spec?.root, "main");
    assert.equal(streaming.spec?.elements.main, undefined);
    assert.equal(
      streaming.prose.includes('"op":"add"'),
      false,
      "incomplete patch must not leak into prose",
    );

    const settled = parseInlineSpec(
      `${partial},"props":{"title":"X"},"children":[]}}\n\`\`\`\nDone.`,
      { complete: true },
    );
    assert.equal(settled.spec?.elements.main?.type, "Card");
    assert.match(settled.prose, /Done/);
  });
});

describe("proseFromMessageText", () => {
  it("strips fences for clipboard copy", () => {
    const prose = proseFromMessageText(
      `Intro\n\`\`\`spec\n${ROOT_PATCH}\n${CARD_PATCH}\n\`\`\`\nOutro`,
    );
    assert.equal(prose.includes("spec"), false);
    assert.match(prose, /Intro/);
    assert.match(prose, /Outro/);
  });
});

describe("comparisonBarShares", () => {
  it("normalizes percents that already sum to 100", () => {
    assert.deepEqual(comparisonBarShares(53.7, 46.3), {
      left: 53.7,
      right: 46.3,
    });
  });

  it("splits zero totals evenly", () => {
    assert.deepEqual(comparisonBarShares(0, 0), { left: 50, right: 50 });
  });

  it("scales raw shares to 100", () => {
    assert.deepEqual(comparisonBarShares(2, 1), {
      left: (2 / 3) * 100,
      right: (1 / 3) * 100,
    });
  });
});

