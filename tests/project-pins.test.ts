import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { projectPin } from "../lib/db/schema.ts";

describe("project_pin schema", () => {
  it("exports a project_pin table with project and pin fks", () => {
    assert.equal(projectPin[Symbol.for("drizzle:Name")], "project_pin");
    const columns = Object.keys(projectPin);
    assert.ok(columns.includes("id"));
    assert.ok(columns.includes("projectId"));
    assert.ok(columns.includes("pinId"));
    assert.ok(columns.includes("sortOrder"));
  });

  it("ships migration 0027 and a journal entry", () => {
    const root = join(import.meta.dirname, "..");
    const sql = readFileSync(
      join(root, "lib/db/migrations/0027_project_pins.sql"),
      "utf8",
    );
    assert.match(sql, /CREATE TABLE "project_pin"/);
    assert.match(sql, /idx_project_pin_project_pin/);

    const journal = JSON.parse(
      readFileSync(join(root, "lib/db/migrations/meta/_journal.json"), "utf8"),
    ) as { entries: readonly { tag: string }[] };
    assert.ok(
      journal.entries.some((entry) => entry.tag === "0027_project_pins"),
      "journal missing 0027_project_pins",
    );
  });
});

describe("project pin helpers", () => {
  it("list/link/unlink are exported", async () => {
    const mod = await import("../lib/db/workbench-pins.ts");
    assert.equal(typeof mod.listProjectPins, "function");
    assert.equal(typeof mod.linkPinToProject, "function");
    assert.equal(typeof mod.unlinkPinFromProject, "function");
  });
});
