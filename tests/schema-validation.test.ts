import assert from "node:assert/strict";
import { test } from "node:test";

import {
  schemaBodiesEqual,
  validateSchemaDraft,
  validateSchemaSlug,
} from "../lib/schemas/validation.ts";

test("validateSchemaSlug rejects empty and invalid shapes", () => {
  assert.equal(validateSchemaSlug("")?.field, "slug");
  assert.equal(validateSchemaSlug("-bad")?.field, "slug");
  assert.equal(validateSchemaSlug("ok-term"), null);
});

test("validateSchemaDraft requires title and statement", () => {
  const missing = validateSchemaDraft({
    slug: "commitment",
    title: "",
    statement: "",
  });
  assert.ok(!("ok" in missing));
  assert.equal(missing.field, "title");

  const ok = validateSchemaDraft({
    slug: "commitment",
    title: "Commitment",
    statement: "A promise the speaker intends to keep.",
    includes: ["Explicit promise to a person"],
    excludes: ["Vague hope without a promise"],
    distinctions: [
      { term: "intention", difference: "Intention has no promise to another." },
    ],
  });
  assert.ok("ok" in ok);
  assert.equal(ok.draft.slug, "commitment");
  assert.equal(ok.draft.includes.length, 1);
});

test("validateSchemaDraft caps list lengths", () => {
  const tooMany = validateSchemaDraft({
    slug: "x",
    title: "X",
    statement: "A thing.",
    includes: Array.from({ length: 13 }, (_, i) => `item ${String(i)}`),
  });
  assert.ok(!("ok" in tooMany));
  assert.equal(tooMany.field, "includes");
});

test("schemaBodiesEqual detects identical normalized drafts", () => {
  const a = {
    slug: "a",
    title: "A",
    statement: "One.",
    includes: ["in"],
    excludes: ["out"],
    distinctions: [],
    examples: [],
    nonExamples: [],
  };
  assert.equal(schemaBodiesEqual(a, { ...a }), true);
  assert.equal(
    schemaBodiesEqual(a, { ...a, statement: "Two." }),
    false,
  );
});
