import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { spokenTurnsFromRow } from "../lib/chat/spoken-turns.ts";

const queriesPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../lib/db/queries.ts",
);

test("spokenTurnsFromRow returns [] for missing or non-array rows", () => {
  assert.deepEqual(spokenTurnsFromRow(undefined), []);
  assert.deepEqual(spokenTurnsFromRow({ spokenTurns: null }), []);
  assert.deepEqual(spokenTurnsFromRow({ spokenTurns: {} }), []);
  assert.deepEqual(spokenTurnsFromRow({ spokenTurns: "nope" }), []);
});

test("spokenTurnsFromRow keeps a typed spoken-turn list", () => {
  const turns = [
    { id: "live:c:0", role: "user" as const, text: "hi" },
    { id: "live:c:1", role: "assistant" as const, text: "hello" },
  ];
  assert.deepEqual(spokenTurnsFromRow({ spokenTurns: turns }), turns);
});

test("takeSpokenTurnsForUser does not use db.transaction (neon-http)", () => {
  const source = readFileSync(queriesPath, "utf8");
  const start = source.indexOf("export async function takeSpokenTurnsForUser");
  assert.ok(start >= 0, "takeSpokenTurnsForUser should be defined");
  const nextExport = source.indexOf("\nexport ", start + 1);
  const body = source.slice(start, nextExport === -1 ? undefined : nextExport);
  assert.equal(
    body.includes(".transaction("),
    false,
    "neon-http cannot run transactions; select then clear instead",
  );
  assert.match(body, /spokenTurnsFromRow/);
});
