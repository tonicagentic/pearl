/**
 * Paths that look like application source. The parent writing sandbox is for
 * drafts, notes, and design files — not app trees. Coder owns those checkouts.
 */

const APP_BASENAMES = new Set([
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "tsconfig.json",
  "jsconfig.json",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "next.config.cjs",
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mjs",
  "cargo.toml",
  "go.mod",
  "dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "vercel.json",
  "turbo.json",
  "nx.json",
]);

const APP_DIR_SEGMENTS = new Set([
  "node_modules",
  "src",
  "app",
  "pages",
  "components",
  "lib",
  "server",
  "api",
  "packages",
  "apps",
  "mobile",
  "ios",
  "android",
  "cmd",
  "internal",
  "pkg",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".md",
  ".mdx",
  ".txt",
  ".html",
  ".htm",
  ".svg",
  ".mmd",
  ".mermaid",
  ".css",
  ".json", // scene.json and small design JSON — basename rules still apply
]);

export function normalizeWorkspacePath(filePath: string): string {
  return filePath
    .trim()
    .replace(/^file:\/\//, "")
    .replace(/^\/workspace\//, "")
    .replace(/^\.\//, "")
    .replace(/\\/g, "/");
}

/**
 * True when a write/edit in the writing sandbox should be refused and sent to
 * coder instead.
 */
export function isAppSourcePath(filePath: string): boolean {
  const relative = normalizeWorkspacePath(filePath);
  if (!relative || relative.includes("..")) {
    return true;
  }

  const parts = relative.split("/").filter(Boolean);
  const base = (parts[parts.length - 1] ?? "").toLowerCase();

  if (APP_BASENAMES.has(base)) {
    return true;
  }

  // Design / diagram JSON is allowed; other .ts/.tsx/.js under src-like trees
  // are not.
  const ext = extensionOf(base);
  if (base.endsWith(".scene.json")) {
    return false;
  }

  for (const part of parts.slice(0, -1)) {
    if (APP_DIR_SEGMENTS.has(part.toLowerCase())) {
      if (
        ext === ".ts" ||
        ext === ".tsx" ||
        ext === ".js" ||
        ext === ".jsx" ||
        ext === ".mjs" ||
        ext === ".cjs" ||
        ext === ".py" ||
        ext === ".go" ||
        ext === ".rs" ||
        ext === ".java" ||
        ext === ".kt" ||
        ext === ".swift"
      ) {
        return true;
      }
    }
  }

  // Top-level source files that aren't prose/design.
  if (parts.length === 1) {
    if (
      ext === ".ts" ||
      ext === ".tsx" ||
      ext === ".js" ||
      ext === ".jsx" ||
      ext === ".mjs" ||
      ext === ".cjs" ||
      ext === ".py" ||
      ext === ".go" ||
      ext === ".rs"
    ) {
      return true;
    }
  }

  // Nested source under any path with a code extension (except allowed design).
  if (
    parts.length > 1 &&
    (ext === ".ts" ||
      ext === ".tsx" ||
      ext === ".js" ||
      ext === ".jsx" ||
      ext === ".mjs" ||
      ext === ".cjs" ||
      ext === ".py" ||
      ext === ".go" ||
      ext === ".rs")
  ) {
    return true;
  }

  void ALLOWED_EXTENSIONS; // documented allowlist for prose/design
  return false;
}

export function appSourceBlockedMessage(filePath: string): string {
  return (
    `Refused to write application source in the writing sandbox (${filePath}). ` +
    `Delegate to coder with the repo, goal, and constraints instead.`
  );
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return "";
  return filename.slice(dot).toLowerCase();
}
