import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import { artifactMaterial, usedTargetedEdit } from "./file-assertions.ts";

// The efficiency contract for revisions: a discrete change to a seeded file
// goes through edit_file as a targeted span replacement, and every untouched
// section survives byte-for-byte. A full-file rewrite here is the failure
// mode this eval exists to catch.
const SECTIONS_DRAFT = `# Field notes: migrating session storage

## Why we moved

Redis has been fine operationally but we're paying for a cluster we barely
use — peak memory utilization is 8%, and we're the only team on it. Postgres
already runs our primary datastore with the backup and failover story we
need, so session rows would inherit that for free.

## How the migration works

The migration is a read-through pattern: Postgres is the source of truth, we
keep a small in-process LRU in front to keep p99 latency acceptable. Sessions
are ~2KB each, 40k active sessions, so the table stays small.

## Rollback

Rollback is trivial: Redis is still running for two weeks after cutover, we
just flip the feature flag back. Worst case is we lose the "free" part and
keep paying for Redis.`;

export default defineEval({
  description:
    "Targeted file edit: revise one section of a seeded draft with edit_file while every other section survives byte-for-byte.",
  tags: ["smoke"],
  async test(t) {
    // Seed the artifact in a file.
    const seed = await t.send(
      `Write this draft to a file exactly as it is, no changes and no commentary:\n\n${SECTIONS_DRAFT}`,
    );

    const seeded = artifactMaterial(seed);
    t.check(
      seeded.length,
      satisfies((n: number) => n > 400, "the draft was seeded into a file"),
    );

    // Revise exactly one section.
    const turn = await t.send(
      "In the 'How the migration works' section, add one sentence noting that the LRU is capped at 200MB so p99 stays bounded. Change nothing else.",
    );

    t.succeeded();
    t.calledTool("edit_file");
    t.check(
      usedTargetedEdit(turn),
      satisfies(
        Boolean,
        "a discrete section change uses edit_file, not a full-file rewrite",
      ),
    );

    const material = artifactMaterial(turn, seeded);

    for (const untouched of [
      "# Field notes: migrating session storage",
      "## Why we moved",
      "peak memory utilization is 8%",
      "## Rollback",
      'Worst case is we lose the "free" part',
    ]) {
      t.check(
        material.includes(untouched),
        satisfies(
          Boolean,
          `untouched section survives byte-for-byte: ${untouched.slice(0, 40)}`,
        ),
      );
    }

    t.check(
      material.includes("200MB"),
      satisfies(Boolean, "the requested sentence was added"),
    );
    t.check(
      material.length,
      satisfies(
        (n: number) => n > seeded.length,
        "the file grew by the added sentence rather than being rewritten",
      ),
    );
  },
});
