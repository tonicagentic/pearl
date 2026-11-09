/**
 * Design artifact helpers: extensions that are not house-prose, and MIME types
 * for Blob persistence / canvas preview.
 */

export const DESIGN_FILE_EXTENSIONS = [
  ".html",
  ".svg",
  ".mmd",
  ".scene.json",
] as const;

export type DesignFileExtension = (typeof DESIGN_FILE_EXTENSIONS)[number];

const CONTENT_TYPES: Record<DesignFileExtension, string> = {
  ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml",
  ".mmd": "text/plain; charset=utf-8",
  ".scene.json": "application/json",
};

/** True when the path is a design source file (skip house prose lint). */
export function isDesignFilePath(path: string): boolean {
  return designFileExtension(path) !== null;
}

/** Matching design extension for a path, or null. */
export function designFileExtension(path: string): DesignFileExtension | null {
  const lower = path.toLowerCase();
  // Check the multi-dot extension before single-dot ones.
  if (lower.endsWith(".scene.json")) return ".scene.json";
  if (lower.endsWith(".html")) return ".html";
  if (lower.endsWith(".svg")) return ".svg";
  if (lower.endsWith(".mmd")) return ".mmd";
  return null;
}

/**
 * Blob / HTTP content type for a workspace path. Design files get real MIME
 * types; everything else stays markdown (the writing-artifact default).
 */
export function contentTypeForWorkspacePath(path: string): string {
  const ext = designFileExtension(path);
  if (ext) return CONTENT_TYPES[ext];
  if (/\.pdf$/i.test(path)) return "application/pdf";
  if (/\.png$/i.test(path)) return "image/png";
  if (/\.jpe?g$/i.test(path)) return "image/jpeg";
  if (/\.webp$/i.test(path)) return "image/webp";
  return "text/markdown";
}
