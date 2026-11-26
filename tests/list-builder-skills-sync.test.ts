import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// List Builder needs its own skill copies: eve skill discovery does not
// follow symlinks. Keep copies byte-identical to agent/skills/.

const parentSkillsDir = join(process.cwd(), "agent", "skills");
const listBuilderSkillsDir = join(
  process.cwd(),
  "agent",
  "subagents",
  "list-builder",
  "skills",
);

const REQUIRED_FLAT = ["lead-generation.md", "company-research.md"] as const;
const REQUIRED_DIRS = [
  "sales-prospecting",
  "market-discovery",
  "offer-discovery",
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

describe("list-builder skill copies stay in sync with agent/skills", () => {
  it("the list-builder ships the skills it loads", () => {
    const present = new Set(readdirSync(listBuilderSkillsDir));
    for (const required of REQUIRED_FLAT) {
      assert.ok(
        present.has(required),
        `agent/subagents/list-builder/skills/${required} is missing`,
      );
    }
    for (const required of REQUIRED_DIRS) {
      assert.ok(
        present.has(required),
        `agent/subagents/list-builder/skills/${required} is missing`,
      );
    }
  });

  for (const name of REQUIRED_FLAT) {
    it(`${name} matches agent/skills/${name}`, () => {
      const canonical = readFileSync(join(parentSkillsDir, name));
      const copy = readFileSync(join(listBuilderSkillsDir, name));
      assert.deepEqual(
        copy,
        canonical,
        `agent/subagents/list-builder/skills/${name} drifted from agent/skills/${name}`,
      );
    });
  }

  for (const skill of REQUIRED_DIRS) {
    it(`${skill}/ matches agent/skills/${skill}/`, () => {
      const canonicalRoot = join(parentSkillsDir, skill);
      const copyRoot = join(listBuilderSkillsDir, skill);
      const canonicalFiles = listFilesRecursive(canonicalRoot).map((p) =>
        relative(canonicalRoot, p),
      );
      const copyFiles = listFilesRecursive(copyRoot).map((p) =>
        relative(copyRoot, p),
      );
      assert.deepEqual(
        copyFiles,
        canonicalFiles,
        `file set for list-builder/skills/${skill} drifted`,
      );
      for (const rel of canonicalFiles) {
        const canonical = readFileSync(join(canonicalRoot, rel));
        const copy = readFileSync(join(copyRoot, rel));
        assert.deepEqual(
          copy,
          canonical,
          `agent/subagents/list-builder/skills/${skill}/${rel} drifted`,
        );
      }
    });
  }
});
