import { createHash } from "node:crypto";

/**
 * Reserved Blob path prefix for durable agent artifacts.
 *
 * @remarks
 * Artifacts are the agent's cross-session work products (drafts, outlines,
 * research notes) synced from the session sandbox. The general-purpose asset
 * tools (`upload_asset`, `list_assets`, `get_asset_info`, `download_asset`,
 * `delete_asset`) treat this prefix as off-limits, mirroring the
 * writer-preferences guard, so generic asset calls can neither read another
 * principal's artifacts nor bypass the artifact tools' principal scoping.
 */
export const ARTIFACTS_PREFIX = "artifacts/";

/**
 * The current principal, as projected onto a tool's `ctx.session.auth.current`.
 *
 * @remarks
 * Structural subset of eve's `SessionAuthContext`; mirrors
 * `writer-preferences.ts`.
 */
type Principal =
  | { readonly principalId: string; readonly principalType: string }
  | null
  | undefined;

/** Leading slashes stripped before the reserved-prefix check. */
const LEADING_SLASHES = /^\/+/;

/** Path segments that must never appear in an artifact slug. */
const FORBIDDEN_SEGMENTS = /(^|\/)\.\.?(\/|$)/;

/** `/workspace/` prefix stripped from sandbox paths before keying. */
const SANDBOX_WORKSPACE = /^\/workspace\//;

/**
 * An already-scoped key echoed back by the model: `artifacts/<64-hex hash>/…`.
 * The hash segment is dropped because the scope is re-derived from the
 * principal, so echoing a pathname can never nest one scope inside another.
 */
const SCOPED_KEY = /^artifacts\/[0-9a-f]{64}\/(.+)$/;

/**
 * Normalize a caller-supplied artifact slug into a safe Blob object suffix.
 *
 * @remarks
 * Accepts sandbox paths (`/workspace/migration.md`), bare slugs
 * (`migration.md`), and already-prefixed keys (`artifacts/ab12…/x.md`,
 * tolerated because the model often echoes a pathname it just listed). The
 * result is a relative suffix safe to append to the principal-scoped prefix:
 * no leading slash, no `.`/`..` segments, no empty name. A slug that reduces
 * to nothing (or only traversal) returns `null` so callers can decline.
 *
 * @param slug - Sandbox path, bare slug, or previously stored pathname.
 * @returns The normalized suffix, or `null` when the input is unsafe.
 */
export const normalizeArtifactSlug = (slug: string): string | null => {
  const trimmed = slug.trim();
  const scoped = SCOPED_KEY.exec(trimmed);

  if (scoped) {
    return scoped[1];
  }

  const relative = trimmed
    .replace(SANDBOX_WORKSPACE, "")
    .replace(LEADING_SLASHES, "")
    .replace(ARTIFACTS_PREFIX, "");

  if (!relative || FORBIDDEN_SEGMENTS.test(relative)) {
    return null;
  }

  return relative;
};

/**
 * The basename of an artifact key — the default sandbox path it restores to.
 *
 * @param key - A scoped artifact Blob key, e.g. `artifacts/ab12…/x.md`.
 * @returns `/workspace/x.md`, or `null` when the key has no basename.
 */
export const artifactSandboxPath = (key: string): string | null => {
  const suffix = key.slice(ARTIFACTS_PREFIX.length);
  const base = suffix.split("/").pop();
  return base ? `/workspace/${base}` : null;
};

/**
 * Whether a Blob pathname falls under the reserved artifacts prefix.
 *
 * @param pathname - A Blob object pathname (no leading slash).
 * @returns `true` when the path is reserved for durable artifacts.
 */
export const isReservedArtifactPath = (pathname: string): boolean =>
  pathname.startsWith(ARTIFACTS_PREFIX);

/**
 * Whether a Blob URL points at a reserved artifacts object.
 *
 * @remarks
 * A public Blob URL embeds the object pathname as its URL path, so the
 * reserved-prefix check applies to the URL's pathname. Unparseable input is
 * treated as not reserved; the caller's own URL validation handles malformed
 * URLs.
 *
 * @param url - A full Blob URL.
 * @returns `true` when the URL addresses a reserved artifacts object.
 */
export const isReservedArtifactUrl = (url: string): boolean => {
  try {
    return isReservedArtifactPath(
      new URL(url).pathname.replace(LEADING_SLASHES, "")
    );
  } catch {
    return false;
  }
};

/**
 * Resolve the Blob prefix holding the current principal's durable artifacts.
 *
 * @remarks
 * Derived entirely from the framework-resolved principal — never from model
 * input — so a session can only ever see its own artifacts. Mirrors
 * `writerPreferencesKey`: only `principalType: "user"` principals get a
 * prefix; app/service/runtime callers return `null` so tools and the sandbox
 * restore decline rather than share an anonymous pool.
 *
 * @param principal - The value of `ctx.session.auth.current`.
 * @returns The reserved Blob prefix for this principal, or `null`.
 */
export const artifactsPrefix = (principal: Principal): string | null => {
  if (principal?.principalType !== "user" || !principal.principalId) {
    return null;
  }
  const id = createHash("sha256").update(principal.principalId).digest("hex");
  return `${ARTIFACTS_PREFIX}${id}/`;
};

/**
 * Resolve the full Blob key for one of the current principal's artifacts.
 *
 * @param principal - The value of `ctx.session.auth.current`.
 * @param slug - Sandbox path, bare slug, or previously stored pathname.
 * @returns The scoped Blob key, or `null` when there is no principal or the
 * slug is unsafe.
 */
export const artifactKey = (
  principal: Principal,
  slug: string
): string | null => {
  const prefix = artifactsPrefix(principal);
  if (!prefix) {
    return null;
  }
  const suffix = normalizeArtifactSlug(slug);
  if (!suffix) {
    return null;
  }
  return `${prefix}${suffix}`;
};
