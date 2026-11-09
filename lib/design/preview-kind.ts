/** Canvas preview kind derived from a workspace file path. */

export type DesignPreviewKind =
  | "markdown"
  | "html"
  | "svg"
  | "pdf"
  | "image"
  | "scene"
  | "mermaid"
  | "text";

export function previewKindForPath(path: string): DesignPreviewKind {
  const lower = path.toLowerCase();
  if (lower.endsWith(".scene.json")) return "scene";
  if (/\.mdx?$/i.test(lower)) return "markdown";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".svg")) return "svg";
  if (lower.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|webp|gif)$/i.test(lower)) return "image";
  if (lower.endsWith(".mmd")) return "mermaid";
  return "text";
}
