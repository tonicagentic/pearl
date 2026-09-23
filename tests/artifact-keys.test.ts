import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ARTIFACTS_PREFIX,
  artifactKey,
  artifactSandboxPath,
  artifactsPrefix,
  isReservedArtifactPath,
  isReservedArtifactUrl,
  normalizeArtifactSlug,
} from "../agent/lib/artifacts.ts";

// Durable artifacts are principal-scoped Blob objects under artifacts/<hash>/.
// The key derives from the framework-resolved principal — never model input —
// and the slug normalization is the line between a usable name and a path
// traversal or a cross-principal write.

const PRINCIPAL = { principalId: "user-1", principalType: "user" } as const;

describe("artifact key scheme", () => {
  it("hashes the principal into a stable, opaque scope", () => {
    const prefix = artifactsPrefix(PRINCIPAL);
    assert.ok(prefix?.startsWith(ARTIFACTS_PREFIX));
    assert.ok(prefix?.endsWith("/"));
    assert.equal(prefix, artifactsPrefix(PRINCIPAL));
    assert.notEqual(prefix, artifactsPrefix({ ...PRINCIPAL, principalId: "user-2" }));
  });

  it("declines non-user principals", () => {
    assert.equal(artifactsPrefix({ principalId: "app", principalType: "app" }), null);
    assert.equal(artifactsPrefix(null), null);
    assert.equal(artifactsPrefix(undefined), null);
    assert.equal(artifactKey(null, "x.md"), null);
  });

  it("accepts sandbox paths, bare slugs, and already-scoped pathnames", () => {
    assert.equal(normalizeArtifactSlug("/workspace/migration.md"), "migration.md");
    assert.equal(normalizeArtifactSlug("migration.md"), "migration.md");
    assert.equal(
      normalizeArtifactSlug("artifacts/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/migration.md"),
      "migration.md",
    );
  });

  it("rejects traversal and empty slugs", () => {
    assert.equal(normalizeArtifactSlug(""), null);
    assert.equal(normalizeArtifactSlug(".."), null);
    assert.equal(normalizeArtifactSlug("notes/../../secret.md"), null);
    assert.equal(normalizeArtifactSlug("   "), null);
  });

  it("builds the full scoped key from a sandbox path", () => {
    const key = artifactKey(PRINCIPAL, "/workspace/migration.md");
    const prefix = artifactsPrefix(PRINCIPAL);
    assert.equal(key, `${prefix}migration.md`);
    assert.ok(key?.startsWith("artifacts/"));
  });

  it("restores to the basename under /workspace by default", () => {
    assert.equal(
      artifactSandboxPath("artifacts/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/migration.md"),
      "/workspace/migration.md",
    );
    assert.equal(artifactSandboxPath("artifacts/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/"), null);
  });

  it("marks artifacts paths and URLs reserved for the generic asset tools", () => {
    assert.ok(isReservedArtifactPath("artifacts/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/x.md"));
    assert.ok(isReservedArtifactUrl("https://example.public.blob.vercel-storage.com/artifacts/ab12/x.md"));
    assert.ok(!isReservedArtifactPath("drafts/x.md"));
    assert.ok(!isReservedArtifactUrl("https://not-a-blob.example.com/x"));
  });
});
