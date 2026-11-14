import { createHash } from "node:crypto";

import { defaultNamespace } from "eve/memory";
import { MemoryDocumentConflictError } from "eve/memory/file";
import { vercelBlob } from "eve/memory/file/vercel";
import type { MemoryDocument, MemoryDocumentBackend } from "eve/memory/file";

import {
  applyMemoryOp,
  emptyMemoryFile,
  formatMemoryDocument,
  MEMORY_RECALL_CHARACTER_LIMIT,
  parseMemoryDocument,
  recallCharacterCount,
  type MemoryEntry,
  type MemoryFile,
  type MemoryNotice,
  type MemoryOp,
} from "@/lib/memory/file-document";

// Profile reader and editor for the agent's file memory document (the user's
// MEMORY.md). eve stores one document per locked memory scope and derives the
// Blob pathname key internally, so this module reproduces that derivation
// from eve's createMemoryScope and checks it against the store: list the
// prefix, compute candidate keys for the signed-in principal, and read or
// write only a blob that matches. If eve changes its key derivation, no
// candidate matches and the profile degrades to an empty state — it can never
// show another principal's memory, because every candidate still embeds the
// current principal's identity.
//
// Storage layout (eve/memory/file): documents live at
// `<prefix>/<encodeURIComponent(scope.key)>/MEMORY.md` with the default
// prefix `eve/memory/file`. The scope key is
// digest("memscope1_", concat("eve-memory-composite-v1\0",
//   lengthPrefix(digest("memns1_", encodeScalar("namespace", namespace))),
//   lengthPrefix(digest("memscope1_", encodeScope(scopeValue))))).
//
// The running agent namespaces memory with runtimeNodeId, which is `__root__`
// for the main agent (eve 1.0.0-rc.16). Older builds used the memory-wrapper
// node id. Reads prefer `__root__` when more than one candidate is present,
// and a brand-new document is created under `__root__` so the agent recalls it.

const MEMORY_PREFIX = "eve/memory/file";
const MEMORY_SLOT = "profile";
const CREATE_NODE = "__root__";
const WRITE_ATTEMPTS = 8;
const MEMORY_NODE_CANDIDATES = [
  CREATE_NODE,
  "eve:memory-wrapper:tools/profile.ts:from:memory/profile.ts",
  "tools/profile.ts",
  "tools/profile",
  "memory/profile.ts",
  "memory/profile",
] as const;

type BlobAuth = {
  readonly token?: string;
  readonly storeId?: string;
};

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

function memoryPathname(key: string): string {
  return `${MEMORY_PREFIX}/${encodeURIComponent(key)}/MEMORY.md`;
}

// Same credential order as eve's default file-memory backend: the dedicated
// EVE_MEMORY_BLOB_* store, then a generic BLOB_* store. An empty result lets
// the SDK use OIDC on Vercel.
function blobAuth(): BlobAuth {
  const eveStore = process.env.EVE_MEMORY_BLOB_STORE_ID?.trim();
  if (eveStore) return { storeId: eveStore };
  const eveToken = process.env.EVE_MEMORY_BLOB_READ_WRITE_TOKEN?.trim();
  if (eveToken) return { token: eveToken };
  const storeId = process.env.BLOB_STORE_ID?.trim();
  if (storeId) return { storeId };
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (token) return { token };
  return {};
}

function blobConfigured(): boolean {
  const auth = blobAuth();
  return Boolean(
    auth.storeId ||
      auth.token ||
      process.env.VERCEL_OIDC_TOKEN?.trim() ||
      process.env.VERCEL,
  );
}

function memoryBackend(): MemoryDocumentBackend {
  return vercelBlob(blobAuth());
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

export type MemorySnapshot = {
  readonly entries: MemoryEntry[];
  readonly recallCharacters: number;
  readonly recallLimit: number;
};

export type MemoryMutationSnapshot = MemorySnapshot & {
  readonly notice: MemoryNotice | null;
};

export class MemoryUnavailableError extends Error {
  readonly reason: "no-storage" | "read-failed" | "conflict";

  constructor(
    reason: MemoryUnavailableError["reason"],
    message: string,
  ) {
    super(message);
    this.name = "MemoryUnavailableError";
    this.reason = reason;
  }
}

type LocatedMemory =
  | { readonly state: "unavailable"; readonly reason: "no-storage" | "read-failed" }
  | {
      readonly state: "absent";
      readonly key: string;
      readonly reason: "no-document" | "no-matching-document";
    }
  | {
      readonly state: "ready";
      readonly key: string;
      readonly document: MemoryDocument;
    };

export async function readProfileMemory(
  authMode: string,
  userId: string,
): Promise<ProfileMemoryResult> {
  const located = await locateMemory(authMode, userId);
  if (located.state === "unavailable") return located;
  if (located.state === "absent") {
    return { state: "empty", reason: located.reason };
  }
  return { state: "ok", content: located.document.content };
}

export async function listProfileMemory(
  authMode: string,
  userId: string,
): Promise<MemorySnapshot> {
  const file = await readMemoryFile(authMode, userId);
  return toSnapshot(file);
}

export async function mutateProfileMemory(
  authMode: string,
  userId: string,
  op: MemoryOp,
): Promise<MemoryMutationSnapshot> {
  const located = await locateMemory(authMode, userId);
  if (located.state === "unavailable") {
    throw unavailable(located.reason);
  }

  let document: MemoryDocument | null =
    located.state === "ready" ? located.document : null;
  const backend = memoryBackend();
  const signal = AbortSignal.timeout(20_000);

  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
    const current = document ? parseLocated(document.content) : emptyMemoryFile();
    const mutation = applyMemoryOp(current, op);
    if (!mutation.changed) {
      return { ...toSnapshot(mutation.file), notice: mutation.notice ?? null };
    }
    try {
      await backend.write({
        content: formatMemoryDocument(mutation.file),
        expectedVersion: document?.version ?? null,
        key: located.key,
        signal,
      });
      return { ...toSnapshot(mutation.file), notice: null };
    } catch (error) {
      if (!MemoryDocumentConflictError.is(error) || attempt === WRITE_ATTEMPTS - 1) {
        if (MemoryDocumentConflictError.is(error)) {
          throw new MemoryUnavailableError(
            "conflict",
            "Memory changed while saving. Try again.",
          );
        }
        throw unavailable(blobConfigured() ? "read-failed" : "no-storage");
      }
      try {
        document = await backend.read({ key: located.key, signal });
      } catch {
        throw unavailable(blobConfigured() ? "read-failed" : "no-storage");
      }
    }
  }

  throw new MemoryUnavailableError(
    "conflict",
    "Memory changed while saving. Try again.",
  );
}

async function readMemoryFile(
  authMode: string,
  userId: string,
): Promise<MemoryFile> {
  const located = await locateMemory(authMode, userId);
  if (located.state === "unavailable") throw unavailable(located.reason);
  if (located.state === "absent") return emptyMemoryFile();
  return parseLocated(located.document.content);
}

function parseLocated(content: string): MemoryFile {
  try {
    return parseMemoryDocument(content);
  } catch {
    throw unavailable("read-failed");
  }
}

function toSnapshot(file: MemoryFile): MemorySnapshot {
  return {
    entries: file.entries.map((entry) => ({
      index: entry.index,
      text: entry.text,
    })),
    recallCharacters: recallCharacterCount(file.entries),
    recallLimit: MEMORY_RECALL_CHARACTER_LIMIT,
  };
}

function unavailable(
  reason: "no-storage" | "read-failed",
): MemoryUnavailableError {
  if (reason === "no-storage") {
    return new MemoryUnavailableError(
      "no-storage",
      "Agent memory needs durable storage to be configured.",
    );
  }
  return new MemoryUnavailableError(
    "read-failed",
    "The memory store could not be reached. Try again later.",
  );
}

async function locateMemory(
  authMode: string,
  userId: string,
): Promise<LocatedMemory> {
  const candidates = candidateKeys(authMode, userId);
  if (candidates.length === 0) {
    return { state: "unavailable", reason: "no-storage" };
  }

  const auth = blobAuth();
  let pathnames: string[];
  try {
    pathnames = await listMemoryPathnames(auth);
  } catch {
    return {
      state: "unavailable",
      reason: blobConfigured() ? "read-failed" : "no-storage",
    };
  }

  const matches = candidates.filter((candidate) =>
    pathnames.includes(memoryPathname(candidate.key)),
  );
  const matching =
    matches.find((candidate) => candidate.node === CREATE_NODE) ?? matches[0];

  console.log(
    `[profile-memory] listed=${pathnames.length} candidates=${candidates.length} matched=${matching ? matching.node : "none"}`,
  );

  const createKey =
    candidates.find((candidate) => candidate.node === CREATE_NODE)?.key ??
    candidates[0]?.key;
  if (!createKey) {
    return { state: "unavailable", reason: "no-storage" };
  }

  if (!matching) {
    return {
      state: "absent",
      key: createKey,
      reason: pathnames.length > 0 ? "no-matching-document" : "no-document",
    };
  }

  let document: MemoryDocument | null;
  try {
    document = await memoryBackend().read({
      key: matching.key,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return {
      state: "unavailable",
      reason: blobConfigured() ? "read-failed" : "no-storage",
    };
  }

  if (!document) {
    return { state: "absent", key: matching.key, reason: "no-document" };
  }

  return { state: "ready", key: matching.key, document };
}

async function listMemoryPathnames(auth: BlobAuth): Promise<string[]> {
  const { list } = await import("@vercel/blob");
  const pathnames: string[] = [];
  let cursor: string | undefined;
  do {
    const result = await list({
      prefix: `${MEMORY_PREFIX}/`,
      cursor,
      limit: 100,
      ...auth,
    });
    for (const blob of result.blobs) {
      pathnames.push(blob.pathname);
    }
    cursor = result.cursor;
    if (!result.hasMore) break;
  } while (cursor);
  return pathnames;
}
