import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const projectsPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../lib/db/projects.ts",
);

test("createProject does not use db.transaction (neon-http)", () => {
  const source = readFileSync(projectsPath, "utf8");
  const start = source.indexOf("export async function createProject");
  assert.ok(start >= 0, "createProject should be defined");
  const nextExport = source.indexOf("\nexport ", start + 1);
  const body = source.slice(start, nextExport === -1 ? undefined : nextExport);
  assert.equal(
    body.includes(".transaction("),
    false,
    "neon-http cannot run interactive transactions; insert project then manager sequentially",
  );
  assert.match(body, /insertProjectManager/);
});
