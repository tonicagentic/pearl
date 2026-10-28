import { Sandbox } from "@vercel/sandbox";

import type { SeedFile } from "./seed.ts";

const SKIP_PREFIXES = ["node_modules/", ".next/", ".git/"] as const;

/**
 * Read text files from a named Vercel Sandbox workspace for publish.
 * Paths are relative to /workspace (Drive mount).
 */
export async function readSandboxWorkspaceFiles(
  sandboxName: string,
): Promise<SeedFile[]> {
  const sandbox = await Sandbox.get({ name: sandboxName });
  try {
    const listed = await sandbox.runCommand({
      cmd: "bash",
      args: [
        "-c",
        // Prefer /workspace (durable-harness Drive); fall back to cwd.
        "if [ -d /workspace ]; then cd /workspace; fi; find . -type f -not -path './node_modules/*' -not -path './.next/*' -not -path './.git/*' | head -n 400",
      ],
    });
    if (listed.exitCode !== 0) {
      throw new Error(
        `Could not list sandbox files: ${await listed.stderr()}`,
      );
    }
    const paths = (await listed.stdout())
      .split("\n")
      .map((line) => line.trim().replace(/^\.\//, ""))
      .filter(Boolean)
      .filter(
        (path) => !SKIP_PREFIXES.some((prefix) => path.startsWith(prefix)),
      );

    const files: SeedFile[] = [];
    for (const path of paths) {
      const abs = path.startsWith("/") ? path : `/workspace/${path}`;
      const buf = await sandbox.readFileToBuffer({ path: abs });
      if (!buf) continue;
      if (buf.byteLength > 512_000) continue;
      if (buf.includes(0)) continue;
      files.push({ path, content: buf.toString("utf8") });
    }
    return files;
  } finally {
    // Leave the named sandbox running for the next fx turn; do not stop it.
  }
}
