#!/usr/bin/env node
//
// Guard: fails the commit when lib/db/schema.ts changed but no migration was
// generated for it. Used by .githooks/pre-commit (activate once with
// `git config core.hooksPath .githooks`) and runnable standalone as
// `pnpm check:migrations`.
//
import { spawnSync } from "node:child_process";

function sh(cmd) {
  return spawnSync(cmd, { shell: true, encoding: "utf8" });
}

// Skip outside a git repository (fresh checkout before git init).
const inRepo = sh("git rev-parse --is-inside-work-tree");
if (inRepo.status !== 0 || inRepo.stdout.trim() !== "true") {
  console.log("check-migrations: not a git repository, skipping");
  process.exit(0);
}

// On the very first commit there is no HEAD; diff against the empty tree.
let base = "HEAD";
if (sh("git rev-parse --verify HEAD").status !== 0) {
  base = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
}

const schemaDiff = sh(`git diff --quiet ${base} -- lib/db/schema.ts`);
if (schemaDiff.status === 0) {
  process.exit(0);
}

console.log("check-migrations: lib/db/schema.ts changed, running drizzle-kit generate...");
const statusBefore = sh("git status --porcelain -- lib/db/migrations").stdout;
const generate = sh("pnpm exec drizzle-kit generate");
if (generate.status !== 0) {
  process.stdout.write(generate.stdout ?? "");
  process.stderr.write(generate.stderr ?? "");
  console.error(
    "check-migrations: drizzle-kit generate failed. Fix the schema or migration error, then retry the commit.",
  );
  process.exit(1);
}

const statusAfter = sh("git status --porcelain -- lib/db/migrations").stdout;
if (statusAfter === statusBefore) {
  console.log("check-migrations: schema change requires no migration, ok");
  process.exit(0);
}

process.stdout.write(statusAfter);
console.error(
  [
    "check-migrations: a new migration was generated for your schema change.",
    "Review it under lib/db/migrations (adjust data backfills if needed),",
    "then `git add lib/db/migrations` and commit again.",
  ].join("\n"),
);
process.exit(1);
