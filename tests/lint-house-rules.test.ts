import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  houseLint,
  singleItemListCount,
} from "../agent/lib/house-lint.ts";

// The house mechanical rules, checked deterministically on every file write
// and edit (the `lint` array in the tool result) and via lint_against_style.
// Fenced code blocks are excluded everywhere: code and diagrams legitimately
// contain dashes, arrows, quotes, and exclamation marks.

describe("house lint", () => {
  it("passes clean prose", () => {
    const text = [
      "The state change is from a plausible claim to a calibrated one.",
      "",
      "## Why the floor matters",
      "",
      "A single-item list is prose pretending to be structure, so we write sentences instead.",
    ].join("\n");
    assert.deepEqual(houseLint(text), []);
  });

  it("flags em dash overuse but allows sparing use", () => {
    const sparing =
      "The results, which were surprising, held. A rare emphasis—that is all.";
    assert.deepEqual(houseLint(sparing), []);

    const overuse = "a—b—c—d";
    assert.ok(houseLint(overuse).some((v) => v.includes("Em dashes")));
  });

  it("flags curly quotes and apostrophes", () => {
    assert.ok(houseLint("the author’s voice").some((v) =>
      v.includes("Curly quotes"),
    ));
    assert.deepEqual(houseLint('the author\'s "voice"'), []);
  });

  it("flags single-item lists and counts multi-item lists as clean", () => {
    assert.equal(
      singleItemListCount("- only one item in this list"),
      1,
    );
    const two = "- first item\n- second item";
    assert.equal(singleItemListCount(two), 0);
    assert.ok(houseLint("- a lone bullet").some((v) =>
      v.includes("single-item list"),
    ));
  });

  it("flags generic headings", () => {
    assert.ok(
      houseLint("## Overview").some((v) => v.includes("Generic heading")),
    );
    assert.deepEqual(houseLint("## Why teams regret self-hosting"), []);
  });

  it("flags hype vocabulary", () => {
    assert.ok(houseLint("a robust and seamless system").some((v) =>
      v.includes("Hype vocabulary"),
    ));
    assert.deepEqual(houseLint("a system that recovers after a tool fails"), []);
  });

  it("flags exclamation overuse", () => {
    assert.ok(houseLint("wow! amazing! incredible!").some((v) =>
      v.includes("exclamation points"),
    ));
  });

  it("excludes fenced code blocks from every check", () => {
    const text = [
      "```",
      "a — b — c — d",
      "x → y → z",
      'say "hi!" — it’s fine',
      "```",
    ].join("\n");
    assert.deepEqual(houseLint(text), []);
  });
});