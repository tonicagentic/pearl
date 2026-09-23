import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The editor subagent needs its own copies of the shared review skills: eve's
// skill discovery classifies directory entries without following symlinks, so
// a symlinked skill blocks `eve dev` from starting (discovery error
// `discover/skill-entry-not-directory`). Keep the copies byte-identical to
// the canonical files in agent/skills/ — this test fails loudly on drift
// instead of letting the editor grade against stale rules.

const parentSkillsDir = join(process.cwd(), "agent", "skills");
const editorSkillsDir = join(
  process.cwd(),
  "agent",
  "subagents",
  "editor",
  "skills",
);

describe("editor skill copies stay in sync with agent/skills", () => {
  const editorSkills = readdirSync(editorSkillsDir).filter((name) =>
    name.endsWith(".md"),
  );

  it("the editor ships the skills it loads", () => {
    for (const required of ["audience-adaptation.md", "house-style.md", "technical-writing-review.md"]) {
      assert.ok(
        editorSkills.includes(required),
        `agent/subagents/editor/skills/${required} is missing; the editor's instructions load it`,
      );
    }
  });

  for (const name of editorSkills) {
    it(`${name} matches agent/skills/${name}`, () => {
      const canonical = readFileSync(join(parentSkillsDir, name));
      const copy = readFileSync(join(editorSkillsDir, name));
      assert.deepEqual(
        copy,
        canonical,
        `agent/subagents/editor/skills/${name} has drifted from the canonical agent/skills/${name}. Copy the canonical file over the copy (eve's skill discovery cannot follow symlinks).`,
      );
    });
  }
});

// The reviewer subagent has the same constraint: its skills directory holds
// copies (editorial_review is reviewer-authored; house-style and
// public_editorial_voice are canonical agent/skills files). Byte-identical or
// the reviewer grades against stale voice rules.

const reviewerSkillsDir = join(
  process.cwd(),
  "agent",
  "subagents",
  "reviewer",
  "skills",
);

describe("reviewer skill copies stay in sync with agent/skills", () => {
  const reviewerSkills = readdirSync(reviewerSkillsDir).filter((name) =>
    name.endsWith(".md"),
  );

  it("the reviewer ships the skills it loads", () => {
    for (const required of [
      "editorial_review.md",
      "house-style.md",
      "public_editorial_voice.md",
    ]) {
      assert.ok(
        reviewerSkills.includes(required),
        `agent/subagents/reviewer/skills/${required} is missing; the reviewer's instructions load it`,
      );
    }
  });

  for (const name of reviewerSkills) {
    if (name === "editorial_review.md") {
      // Reviewer-authored skill with no canonical parent copy; nothing to sync.
      continue;
    }

    it(`${name} matches agent/skills/${name}`, () => {
      const canonical = readFileSync(join(parentSkillsDir, name));
      const copy = readFileSync(join(reviewerSkillsDir, name));
      assert.deepEqual(
        copy,
        canonical,
        `agent/subagents/reviewer/skills/${name} has drifted from the canonical agent/skills/${name}. Copy the canonical file over the copy (eve's skill discovery cannot follow symlinks).`,
      );
    });
  }
});
