import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Designer needs its own copies of design skills: eve's skill discovery does
// not follow symlinks (`discover/skill-entry-not-directory`). Keep copies
// byte-identical to agent/skills/ — this test fails on drift.

const parentSkillsDir = join(process.cwd(), "agent", "skills");
const designerSkillsDir = join(
  process.cwd(),
  "agent",
  "subagents",
  "designer",
  "skills",
);

const REQUIRED_SKILLS = [
  "design",
  "design-principles",
  "graphic-design",
  "icon-design",
  "illustration-design",
  "logo-design",
  "print-design",
  "vector-graphics",
  "diagrams",
  "web-design",
  "3d-design",
] as const;

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...listFilesRecursive(full));
    } else {
      out.push(full);
    }
  }
  return out.sort();
}

describe("designer skill copies stay in sync with agent/skills", () => {
  it("the designer ships the skills it loads", () => {
    const present = new Set(readdirSync(designerSkillsDir));
    for (const required of REQUIRED_SKILLS) {
      assert.ok(
        present.has(required),
        `agent/subagents/designer/skills/${required} is missing; the designer's instructions load it`,
      );
    }
  });

  for (const skill of REQUIRED_SKILLS) {
    it(`${skill}/ matches agent/skills/${skill}/`, () => {
      const canonicalRoot = join(parentSkillsDir, skill);
      const copyRoot = join(designerSkillsDir, skill);
      const canonicalFiles = listFilesRecursive(canonicalRoot).map((p) =>
        relative(canonicalRoot, p),
      );
      const copyFiles = listFilesRecursive(copyRoot).map((p) =>
        relative(copyRoot, p),
      );
      assert.deepEqual(
        copyFiles,
        canonicalFiles,
        `file set for designer/skills/${skill} drifted from agent/skills/${skill}`,
      );
      for (const rel of canonicalFiles) {
        const canonical = readFileSync(join(canonicalRoot, rel));
        const copy = readFileSync(join(copyRoot, rel));
        assert.deepEqual(
          copy,
          canonical,
          `agent/subagents/designer/skills/${skill}/${rel} has drifted from agent/skills/${skill}/${rel}. Copy the canonical tree over the copy (eve cannot follow symlinks).`,
        );
      }
    });
  }
});
