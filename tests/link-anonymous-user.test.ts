import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const linkPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../lib/auth/link-anonymous-user.ts",
);

test("reassignAnonymousUserData does not use db.transaction (neon-http)", () => {
  const source = readFileSync(linkPath, "utf8");
  const start = source.indexOf("export async function reassignAnonymousUserData");
  assert.ok(start >= 0, "reassignAnonymousUserData should be defined");
  const body = source.slice(start);
  assert.equal(
    body.includes(".transaction("),
    false,
    "neon-http cannot run interactive transactions; use batch() or sequential queries",
  );
});
