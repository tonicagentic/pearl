import { previewKindForPath } from "./preview-kind.ts";

/** Reject paths that cannot be looked up safely. */
export function sanitizeWorkspaceLookupPath(
  path: string | null | undefined,
): string | null {
  if (typeof path !== "string") return null;
  const trimmed = path.trim();
  if (!trimmed || trimmed.includes("\0") || trimmed.includes("..")) {
    return null;
  }
  return trimmed;
}

/** ASCII-safe basename for Content-Disposition. */
export function dispositionFilename(path: string): string {
  const name = path.split("/").pop() || "file";
  return name.replace(/["\\\r\n]/g, "_");
}

/**
 * Same-origin URL for a chat workspace file.
 * `download: true` forces Content-Disposition: attachment.
 */
export function chatFileUrl(args: {
  readonly chatId: string;
  readonly path: string;
  readonly download?: boolean;
}): string {
  const params = new URLSearchParams({ path: args.path });
  if (args.download) params.set("download", "1");
  return `/api/chats/${encodeURIComponent(args.chatId)}/files?${params.toString()}`;
}

/** True when a workspace path should paint as an inline SVG in chat. */
export function isSvgWorkspacePath(path: string): boolean {
  return previewKindForPath(path) === "svg";
}

/** True when a workspace path is Mermaid source (`.mmd`). */
export function isMermaidWorkspacePath(path: string): boolean {
  return previewKindForPath(path) === "mermaid";
}

/** Match a stored agent file path to a requested workspace path. */
export function pathsMatchWorkspaceFile(
  stored: string,
  requested: string,
): boolean {
  return stored === requested || stored.endsWith(`/${requested}`);
}
