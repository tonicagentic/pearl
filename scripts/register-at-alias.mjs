/**
 * Node loader so scripts can import `@/…` the same way Next does.
 * Usage: node --import ./scripts/register-at-alias.mjs …
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

register(
  `data:text/javascript,${encodeURIComponent(`
    import { existsSync } from "node:fs";
    const root = ${JSON.stringify(root)};
    function resolveAt(specifier) {
      const base = root + "/" + specifier.slice(2);
      if (existsSync(base)) return base;
      for (const ext of [".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.js"]) {
        if (existsSync(base + ext)) return base + ext;
      }
      return base + ".ts";
    }
    export async function resolve(specifier, context, nextResolve) {
      if (specifier.startsWith("@/")) {
        return nextResolve(resolveAt(specifier), context);
      }
      return nextResolve(specifier, context);
    }
  `)}`,
  pathToFileURL("./"),
);
