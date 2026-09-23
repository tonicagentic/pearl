import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { arrowLineCount, MAX_ARROW_LINES } from "../agent/lib/arrow-notation.ts";

// The house rule reserves arrow notation for diagrams, equations, and one
// deliberately schematic passage; prose and table cells express state changes
// as transformations instead. The lint enforces this as a density check:
// more than MAX_ARROW_LINES arrow-bearing lines outside fenced code blocks is
// a violation.

describe("lint_against_style arrow density", () => {
  it("allows a single schematic process model", () => {
    const text = [
      "Some prose paragraph.",
      "",
      "intent → audience model → argument → expression → reader effect",
      "",
      "More prose.",
    ].join("\n");
    assert.equal(arrowLineCount(text), 1);
  });

  it("counts each arrow-bearing prose or table line", () => {
    const text = [
      "plausible claim → calibrated claim",
      "| Felt sense → Articulated thought |",
      "draft → publication-ready",
      "exploration → synthesis",
    ].join("\n");
    assert.equal(arrowLineCount(text), 4);
    assert.ok(4 > MAX_ARROW_LINES);
  });

  it("ignores arrows inside fenced code blocks", () => {
    const text = [
      "```",
      "a → b → c",
      "d → e → f",
      "g → h → i",
      "```",
      "one → two",
    ].join("\n");
    assert.equal(arrowLineCount(text), 1);
  });

  it("returns zero for clean prose using transformations", () => {
    assert.equal(
      arrowLineCount(
        "The state change is from a plausible claim to a calibrated one.\n" +
          "A plausible claim becomes a calibrated one.",
      ),
      0,
    );
  });

  it("handles an unclosed fence without crashing", () => {
    assert.equal(arrowLineCount("```\na → b"), 0);
  });
});
