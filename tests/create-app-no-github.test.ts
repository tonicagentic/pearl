import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("create_app service no longer imports GitHub helpers", async () => {
  const source = await readFile("lib/apps/create-service.ts", "utf8");
  assert.doesNotMatch(source, /createPearlRepo|getGithubUserToken|getGithubLogin/);
  assert.match(source, /Does not touch\n? \* GitHub|coding happens in a Vercel Sandbox/i);
});

test("publish_app creates the pearl repo when github fields are missing", async () => {
  const source = await readFile("lib/apps/publish-service.ts", "utf8");
  assert.match(source, /createPearlRepo/);
  assert.match(source, /!githubOwner \|\| !githubRepo/);
});

test("create_app tool copy says GitHub is deferred", async () => {
  const source = await readFile(
    "agent/subagents/builder/tools/create_app.ts",
    "utf8",
  );
  assert.match(source, /Does not require GitHub/);
  assert.match(source, /approval:\s*always\(\)/);
});
