/**
 * Extract and sanitize SVG documents produced by vector models.
 *
 * The chat canvas inlines workspace SVGs with dangerouslySetInnerHTML, so
 * model output must drop scriptable content before it is written.
 */

const SVG_DOCUMENT =
  /<svg\b[^>]*>[\s\S]*?<\/svg>/i;

/** Pull the first complete `<svg>…</svg>` document from model text. */
export function extractSvgDocument(text: string): string | null {
  const match = text.match(SVG_DOCUMENT);
  if (!match) return null;
  return match[0].trim();
}

/**
 * Strip scriptable / active content from an SVG document.
 * Removes `<script>`, `<foreignObject>`, event-handler attributes, and
 * `javascript:` URLs. Does not attempt a full XML parse.
 */
export function sanitizeSvgDocument(svg: string): string {
  let out = svg;
  // Remove script and foreignObject elements (and their contents).
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<script\b[^>]*\/>/gi, "");
  out = out.replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject>/gi, "");
  out = out.replace(/<foreignObject\b[^>]*\/>/gi, "");
  // Drop on* event handler attributes.
  out = out.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Neutralize javascript: URLs in href / xlink:href / src.
  out = out.replace(
    /(\s(?:href|xlink:href|src)\s*=\s*)(["'])\s*javascript:[^"']*\2/gi,
    "$1$2#$2",
  );
  out = out.replace(
    /(\s(?:href|xlink:href|src)\s*=\s*)javascript:[^\s>]*/gi,
    "$1#",
  );
  return out.trim();
}

/** Extract then sanitize; returns null when no SVG document is present. */
export function prepareSvgDocument(text: string): string | null {
  const extracted = extractSvgDocument(text);
  if (!extracted) return null;
  const sanitized = sanitizeSvgDocument(extracted);
  if (!/<svg\b/i.test(sanitized)) return null;
  return sanitized;
}

/** Normalize a user-supplied slug into an absolute workspace .svg path. */
export function workspaceSvgPath(slug?: string): string {
  const raw = (slug ?? `design-${Date.now()}`).trim();
  const withoutSlash = raw.replace(/^\/+/, "").replace(/^workspace\//, "");
  const withExt = withoutSlash.toLowerCase().endsWith(".svg")
    ? withoutSlash
    : `${withoutSlash}.svg`;
  return `/workspace/${withExt}`;
}
