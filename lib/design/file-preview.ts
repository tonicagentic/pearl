import {
  previewKindForPath,
  type DesignPreviewKind,
} from "./preview-kind.ts";

/** Basename of a workspace path. */
export function fileBasename(path: string): string {
  return path.split("/").pop() || path;
}

/** Short label for a preview kind shown on cards. */
export function previewKindLabel(kind: DesignPreviewKind): string {
  switch (kind) {
    case "markdown":
      return "Markdown";
    case "html":
      return "HTML";
    case "svg":
      return "SVG";
    case "pdf":
      return "PDF";
    case "image":
      return "Image";
    case "scene":
      return "3D scene";
    case "mermaid":
      return "Diagram";
    default:
      return "File";
  }
}

/** MIME type for Android native preview intents. */
export function mimeTypeForPath(path: string): string {
  const kind = previewKindForPath(path);
  const lower = path.toLowerCase();
  switch (kind) {
    case "markdown":
      return "text/markdown";
    case "html":
      return "text/html";
    case "svg":
      return "image/svg+xml";
    case "pdf":
      return "application/pdf";
    case "image":
      if (lower.endsWith(".png")) return "image/png";
      if (lower.endsWith(".webp")) return "image/webp";
      if (lower.endsWith(".gif")) return "image/gif";
      return "image/jpeg";
    case "mermaid":
    case "scene":
      return "text/plain";
    default:
      if (lower.endsWith(".json")) return "application/json";
      if (lower.endsWith(".csv")) return "text/csv";
      return "text/plain";
  }
}

/** True when file content is a browser-loadable URL or data URI. */
export function isContentUrl(content: string): boolean {
  return /^(https?:|data:|blob:)/i.test(content.trim());
}

/**
 * Prefer in-app readers for types Quick Look shows as source.
 * Everything else tries the native system viewer first.
 */
export function prefersInAppPreview(path: string): boolean {
  const kind = previewKindForPath(path);
  return (
    kind === "markdown" ||
    kind === "html" ||
    kind === "mermaid" ||
    kind === "scene"
  );
}

const SNIPPET_CHARS = 280;

/** Clamped text snippet for card previews. */
export function filePreviewSnippet(content: string, limit = SNIPPET_CHARS): string {
  const trimmed = content.replace(/\r\n/g, "\n").trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit).trimEnd()}…`;
}
