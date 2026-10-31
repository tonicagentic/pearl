import assert from "node:assert/strict";
import { test } from "node:test";

import {
  embeddableAppUrl,
  embeddableProductionUrl,
  preferEmbedUrl,
} from "../lib/apps/embed.ts";
import {
  assertPearlAppRepo,
  isPearlRepoName,
  normalizePearlSlug,
} from "../lib/apps/slug.ts";

test("normalizePearlSlug accepts bare and prefixed slugs", () => {
  assert.equal(normalizePearlSlug("my-notes"), "pearl-my-notes");
  assert.equal(normalizePearlSlug("pearl-my-notes"), "pearl-my-notes");
  assert.equal(normalizePearlSlug("  Tip-Jar  "), "pearl-tip-jar");
});

test("normalizePearlSlug rejects invalid slugs", () => {
  assert.equal(normalizePearlSlug(""), null);
  assert.equal(normalizePearlSlug("pearl-"), null);
  assert.equal(normalizePearlSlug("pearl-pearl-x"), null);
  assert.equal(normalizePearlSlug("My Notes"), null);
  assert.equal(normalizePearlSlug("../etc"), null);
  assert.equal(normalizePearlSlug("has_underscore"), null);
});

test("isPearlRepoName only allows pearl-* repo names", () => {
  assert.equal(isPearlRepoName("pearl-my-notes"), true);
  assert.equal(isPearlRepoName("my-agent"), false);
  assert.equal(isPearlRepoName("pearl-"), false);
});

test("assertPearlAppRepo refuses foreign or non-pearl repos", () => {
  assert.throws(
    () =>
      assertPearlAppRepo({
        githubOwner: "alice",
        githubRepo: "my-agent",
        expectedOwner: "alice",
        expectedRepo: "pearl-notes",
      }),
    /only pearl-\*/,
  );

  assert.throws(
    () =>
      assertPearlAppRepo({
        githubOwner: "bob",
        githubRepo: "pearl-notes",
        expectedOwner: "alice",
        expectedRepo: "pearl-notes",
      }),
    /not this mini app/,
  );

  assert.doesNotThrow(() =>
    assertPearlAppRepo({
      githubOwner: "alice",
      githubRepo: "pearl-notes",
      expectedOwner: "alice",
      expectedRepo: "pearl-notes",
    }),
  );
});

test("embeddableProductionUrl only allows https URLs without credentials", () => {
  assert.equal(
    embeddableProductionUrl("https://pearl-notes.vercel.app"),
    "https://pearl-notes.vercel.app/",
  );
  assert.equal(embeddableAppUrl("https://draft.vercel.run"), "https://draft.vercel.run/");
  assert.equal(embeddableProductionUrl("http://evil.example"), null);
  assert.equal(embeddableProductionUrl("javascript:alert(1)"), null);
  assert.equal(embeddableProductionUrl("https://user:pass@evil.example"), null);
  assert.equal(embeddableProductionUrl(null), null);
  assert.equal(embeddableProductionUrl("not a url"), null);
  assert.equal(
    preferEmbedUrl({
      productionUrl: null,
      previewUrl: "https://draft.vercel.run",
    }),
    "https://draft.vercel.run/",
  );
});

test("builder create_app and publish_app declare approval gates", async () => {
  const { readFile } = await import("node:fs/promises");
  const create = await readFile(
    "agent/subagents/builder/tools/create_app.ts",
    "utf8",
  );
  const publish = await readFile(
    "agent/subagents/builder/tools/publish_app.ts",
    "utf8",
  );
  assert.match(create, /approval:\s*always\(\)/);
  assert.match(publish, /approval:\s*always\(\)/);
});

test("root instructions require calling builder tool in the same turn", async () => {
  const { readFile } = await import("node:fs/promises");
  const instructions = await readFile("agent/instructions.md", "utf8");
  assert.match(instructions, /calling the `builder` tool directly/);
  assert.match(instructions, /turn must include the `builder` call/);
});

test("builder agent keeps libfx external for durable/vercel.mjs", async () => {
  const { readFile } = await import("node:fs/promises");
  const agent = await readFile("agent/subagents/builder/agent.ts", "utf8");
  assert.match(
    agent,
    /externalDependencies:\s*\["libfx",\s*"durable-harness"\]/,
  );
});

test("DELEGATION_TOOLS includes declared subagents for TaskCard lane", async () => {
  const { readFile } = await import("node:fs/promises");
  const { readdir } = await import("node:fs/promises");
  const source = await readFile(
    "components/assistant-ui/elements/task-card.aui.tsx",
    "utf8",
  );
  const mobile = await readFile(
    "mobile/components/assistant-ui/elements/task-card.aui.tsx",
    "utf8",
  );
  const declared = (await readdir("agent/subagents", { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  for (const name of ["agent", ...declared]) {
    assert.match(source, new RegExp(`"${name}"`));
    assert.match(mobile, new RegExp(`"${name}"`));
  }
});

test("code_with_fx follows durable turns with reconnect", async () => {
  const { readFile } = await import("node:fs/promises");
  const code = await readFile("lib/apps/code-service.ts", "utf8");
  assert.match(code, /awaitDurableFxTurn/);
  assert.doesNotMatch(code, /for await \(const event of turn\)/);
});
