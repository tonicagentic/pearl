import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Names of compiled filesystem skills under agent/skills/.
 *
 * @remarks
 * Server-only: reads the filesystem. Client code must not import this module.
 */
function readBuiltinSkillNames(): ReadonlySet<string> {
  try {
    const dir = join(process.cwd(), "agent", "skills");
    const names = readdirSync(dir, { withFileTypes: true })
      .filter(
        (entry) =>
          (entry.isFile() && entry.name.endsWith(".md")) ||
          (entry.isDirectory() && !entry.name.startsWith(".")),
      )
      .map((entry) =>
        entry.isFile() ? entry.name.replace(/\.md$/, "") : entry.name,
      );
    return new Set(names);
  } catch {
    return new Set();
  }
}

let cachedBuiltinNames: ReadonlySet<string> | null = null;

export function builtinSkillNames(): ReadonlySet<string> {
  cachedBuiltinNames ??= readBuiltinSkillNames();
  return cachedBuiltinNames;
}

export function isBuiltinSkillSlug(slug: string): boolean {
  return builtinSkillNames().has(slug);
}
