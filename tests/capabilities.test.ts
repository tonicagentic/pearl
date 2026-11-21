import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  CapabilityInputError,
  mergeCapabilityInput,
  normalizeCapabilityInput,
  parseCapabilityKind,
  parseCapabilityStatus,
} from "../lib/capabilities/validation.ts";

test("normalizeCapabilityInput requires name, kind, and summary", () => {
  const row = normalizeCapabilityInput({
    name: "  Maintenance monitoring  ",
    kind: "service",
    summary: "Catch compressor failures early",
  });
  assert.equal(row.name, "Maintenance monitoring");
  assert.equal(row.kind, "service");
  assert.equal(row.summary, "Catch compressor failures early");
  assert.equal(row.status, "active");
  assert.equal(row.audience, null);
  assert.equal(row.proof, null);
  assert.equal(row.projectId, null);
  assert.equal(row.notes, null);
});

test("normalizeCapabilityInput rejects blank summary and bad kind", () => {
  assert.throws(
    () =>
      normalizeCapabilityInput({
        name: "Agents",
        kind: "service",
        summary: "   ",
      }),
    CapabilityInputError,
  );
  assert.throws(
    () =>
      normalizeCapabilityInput({
        name: "Agents",
        kind: "hobby" as never,
        summary: "Build custom agents",
      }),
    /skill, product, or service/,
  );
});

test("normalizeCapabilityInput bounds field lengths", () => {
  assert.throws(
    () =>
      normalizeCapabilityInput({
        name: "x".repeat(121),
        kind: "skill",
        summary: "ok",
      }),
    /Name must be at most/,
  );
});

test("mergeCapabilityInput keeps base fields and clears with null", () => {
  const merged = mergeCapabilityInput(
    {
      name: "Agents",
      kind: "product",
      summary: "Custom AI agents",
      audience: "Founders",
      proof: "3 pilots",
      status: "exploring",
      projectId: "proj_1",
      notes: "early",
    },
    {
      status: "active",
      audience: null,
      proof: null,
    },
  );
  assert.equal(merged.name, "Agents");
  assert.equal(merged.status, "active");
  assert.equal(merged.audience, null);
  assert.equal(merged.proof, null);
  assert.equal(merged.projectId, "proj_1");
});

test("parse helpers accept only known kind and status", () => {
  assert.equal(parseCapabilityKind("skill"), "skill");
  assert.equal(parseCapabilityKind("Skill"), null);
  assert.equal(parseCapabilityStatus("archived"), "archived");
  assert.equal(parseCapabilityStatus("gone"), null);
});

test("capability tools declare approval gates and instructions mention the catalog", async () => {
  const save = await readFile("agent/tools/save_capability.ts", "utf8");
  const archive = await readFile("agent/tools/archive_capability.ts", "utf8");
  assert.match(save, /approval:\s*once\(\)/);
  assert.match(archive, /approval:\s*once\(\)/);

  const instructions = await readFile("agent/instructions.md", "utf8");
  assert.match(instructions, /save_capability/);
  assert.match(instructions, /list_capabilities/);
  assert.match(instructions, /marketable skill/);

  const index = await readFile("agent/instructions/capabilities.ts", "utf8");
  assert.match(index, /getCapabilityIndexForPrincipal/);
});
