import { createHash } from "node:crypto";

import { defaultNamespace } from "eve/memory";
import { vercelBlob } from "eve/memory/file/vercel";
import type { MemoryDocument } from "eve/memory/file";

// Profile page reader for the agent's file memory document (the user's
// MEMORY.md). eve stores one document per locked memory scope and derives the
// Blob pathname key internally, so this module reproduces that derivation
// verbatim from eve 0.54.3's shared/memory-state.js and verifies it against
// the actual store: we list the store prefix, compute the candidate keys for
// the signed-in principal, and read only a blob that matches. If eve changes
// its key derivation or the runtime uses different node/slot inputs, no
// candidate matches and the profile degrades to an empty state — it can never
// show another principal's memory, because every candidate still embeds the
// current principal's identity.
//
// Storage layout (eve/memory/file docs): documents live at
// `<prefix>/<encodeURIComponent(scope.key)>/MEMORY.md` with the default
// prefix `eve/memory/file`. The scope key is
// digest("memscope1_", concat("eve-memory-composite-v1\0",
//   lengthPrefix(digest("memns1_", encodeScalar("namespace", namespace))),
//   lengthPrefix(digest("memscope1_", encodeScope(scopeValue))))).

const MEMORY_PREFIX = "eve/memory/file";
const MEMORY_NODE_CANDIDATES = ["memory/profile.ts", "memory/profile"] as const;
const MEMORY_SLOT = "profile";

function uint32(value: number): Buffer {
  const buf = Buffer.allocUnsafe(4);
  buf.writeUInt32BE(value);
  return buf;
}

function lengthPrefix(bytes: Buffer): Buffer {
  return Buffer.concat([uint32(bytes.byteLength), bytes]);
}

function digest(prefix: string, bytes: Buffer): string {
  return `${prefix}${createHash("sha256").update(bytes).digest("base64url")}`;
}

function encodeScalar(kind: string, value: string): Buffer {
  return Buffer.concat([
    Buffer.from(`${kind}-v1\0`),
    lengthPrefix(Buffer.from(value, "utf8")),
  ]);
}

function encodeScope(scope: string): Buffer {
  return encodeScalar("scope-scalar", scope);
}

export function memoryScopeKey(namespace: string, scopeValue: string): string {
  const namespaceKey = digest("memns1_", encodeScalar("namespace", namespace));
  const innerScopeKey = digest("memscope1_", encodeScope(scopeValue));
  const composite = Buffer.concat([
    Buffer.from("eve-memory-composite-v1\0"),
    lengthPrefix(Buffer.from(namespaceKey, "utf8")),
    lengthPrefix(Buffer.from(innerScopeKey, "utf8")),
  ]);
  return digest("memscope1_", composite);
}

// Mirrors the principals lib/eve-auth.ts hands to eve, so the profile page
// reads the same scope the agent writes to. `byPrincipal` stringifies
// [principalType, authenticator, issuer, principalId] and special-cases the
// local-dev principal to the bare string "local-dev".
export function memoryScopeValue(
  authMode: string,
  userId: string,
): string | null {
  if (authMode === "local-dev") return "local-dev";
  if (authMode === "password") {
    return JSON.stringify(["user", "password", "eve-chat-template", userId]);
  }
  if (authMode === "vercel" || authMode === "email") {
    return JSON.stringify(["user", "better-auth", "better-auth", userId]);
  }
  return null;
}

// Candidate namespaces: defaultNamespace is public eve API and depends on the
// runtime's appRoot and the memory node id; the node id is either the logical
// path with or without extension, so derive candidates for both.
function candidateKeys(
  authMode: string,
  userId: string,
): { key: string; node: string }[] {
  const scopeValue = memoryScopeValue(authMode, userId);
  if (scopeValue === null) return [];
  const appRoot = process.cwd();
  return MEMORY_NODE_CANDIDATES.map((node) => {
    const namespace = defaultNamespace({ appRoot, node, slot: MEMORY_SLOT });
    return { key: memoryScopeKey(namespace, scopeValue), node };
  });
}

export type ProfileMemoryResult =
  | { readonly state: "empty"; readonly reason: "no-document" }
  | { readonly state: "empty"; readonly reason: "no-matching-document" }
  | { readonly state: "unavailable"; readonly reason: "no-storage" }
  | { readonly state: "unavailable"; readonly reason: "read-failed" }
  | {
      readonly state: "ok";
      readonly content: string;
    };

export async function readProfileMemory(
  authMode: string,
  userId: string,
): Promise<ProfileMemoryResult> {
  const candidates = candidateKeys(authMode, userId);
  if (candidates.length === 0) {
    return { state: "unavailable", reason: "no-storage" };
  }

  const backend = vercelBlob();

  // List the memory prefix and read only a document whose pathname matches a
  // candidate key for this principal. The listing also proves the derivation:
  // a saved memory appears in the store exactly at our computed pathname.
  let pathnames: string[];
  try {
    const listing = await listMemoryPathnames();
    pathnames = listing;
  } catch {
    return { state: "unavailable", reason: "read-failed" };
  }

  const matching = candidates.find((candidate) =>
    pathnames.includes(
      `${MEMORY_PREFIX}/${encodeURIComponent(candidate.key)}/MEMORY.md`,
    ),
  );

  if (!matching) {
    return pathnames.length > 0
      ? { state: "empty", reason: "no-matching-document" }
      : { state: "empty", reason: "no-document" };
  }

  let document: MemoryDocument | null;
  try {
    document = await backend.read({ key: matching.key, signal: new AbortController().signal });
  } catch {
    return { state: "unavailable", reason: "read-failed" };
  }

  if (!document) {
    return { state: "empty", reason: "no-document" };
  }

  return {
    state: "ok",
    content: document.content,
  };
}

// The @vercel/blob SDK resolves credentials from the environment (OIDC on
// Vercel, BLOB_READ_WRITE_TOKEN elsewhere). List with the same prefix eve's
// file memory backend writes under.
async function listMemoryPathnames(): Promise<string[]> {
  const { list } = await import("@vercel/blob");
  const pathnames: string[] = [];
  let cursor: string | undefined;
  do {
    const result = await list({
      prefix: `${MEMORY_PREFIX}/`,
      cursor,
      limit: 100,
    });
    for (const blob of result.blobs) {
      pathnames.push(blob.pathname);
    }
    cursor = result.cursor;
    if (!result.hasMore) break;
  } while (cursor);
  return pathnames;
}
