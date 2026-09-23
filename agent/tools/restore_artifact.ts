import { get } from "@vercel/blob";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { artifactKey, artifactSandboxPath } from "#lib/artifacts.js";

/**
 * Tool that restores a durable artifact from Vercel Blob into the sandbox.
 *
 * @remarks
 * New sessions start with artifacts restored automatically (the sandbox
 * definition pulls them in at session start); this tool covers the on-demand
 * case — the user asks for a specific earlier file, or the automatic restore
 * missed one. The destination defaults to the artifact's basename under
 * `/workspace`, so the canvas and the file tools work on it like any other
 * file. The Blob key resolves against the framework-resolved principal, so a
 * session can only restore its own artifacts.
 */
export default defineTool({
  description:
    "Restore a stored artifact from durable storage into the workspace so it " +
    "can be read and edited in this session. Pass a pathname from " +
    "list_artifacts.",
  /**
   * Pull one stored artifact back into the sandbox.
   *
   * @param input - Validated tool input.
   * @param ctx - Tool runtime context; supplies the sandbox handle and the
   * resolved principal.
   * @returns The sandbox `path` the artifact now lives at, or `success: false`
   * with an `error`.
   */
  async execute({ pathname, toPath }, ctx) {
    const key = artifactKey(ctx.session.auth.current, pathname);
    if (!key) {
      return {
        error:
          "No signed-in principal to restore artifacts for, or the pathname is not a usable artifact name.",
        success: false,
      };
    }

    const destination =
      toPath ??
      artifactSandboxPath(key) ??
      `/workspace/${key.split("/").pop() ?? "artifact.md"}`;

    let content: string;
    try {
      // Public-access blob: fetch the URL for the content, mirroring
      // download_asset (get() returns a raw stream, not buffered text).
      const result = await get(key, { access: "public" });
      if (!result || result.statusCode !== 200) {
        return {
          error: `Artifact ${key} is not readable from storage.`,
          success: false,
        };
      }

      const response = await fetch(result.blob.url);
      if (!response.ok) {
        return {
          error: `Failed to download: ${response.status} ${response.statusText}`,
          success: false,
        };
      }

      content = await response.text();
    } catch (error) {
      return {
        error: `Could not read ${key} from storage: ${
          error instanceof Error ? error.message : String(error)
        }`,
        success: false,
      };
    }

    try {
      const sandbox = await ctx.getSandbox();
      await sandbox.writeTextFile({ content, path: destination });
      return { path: destination, success: true };
    } catch (error) {
      return {
        error: `Could not write ${destination} into the sandbox: ${
          error instanceof Error ? error.message : String(error)
        }`,
        success: false,
      };
    }
  },
  inputSchema: z.object({
    pathname: z
      .string()
      .min(1)
      .describe(
        "Stored artifact pathname from list_artifacts, e.g. artifacts/<scope>/migration.md — a bare slug or /workspace path also works."
      ),
    toPath: z
      .string()
      .optional()
      .describe(
        "Optional absolute sandbox path to restore to. Defaults to /workspace/<basename>."
      ),
  }),
  outputSchema: z.object({
    error: z.string().optional(),
    path: z.string().optional(),
    success: z.boolean(),
  }),
});
