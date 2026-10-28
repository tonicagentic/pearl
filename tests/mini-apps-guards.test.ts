import assert from "node:assert/strict";
import { test } from "node:test";

import { embeddableProductionUrl } from "../lib/apps/embed.ts";
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
  assert.equal(embeddableProductionUrl("http://evil.example"), null);
  assert.equal(embeddableProductionUrl("javascript:alert(1)"), null);
  assert.equal(embeddableProductionUrl("https://user:pass@evil.example"), null);
  assert.equal(embeddableProductionUrl(null), null);
  assert.equal(embeddableProductionUrl("not a url"), null);
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
