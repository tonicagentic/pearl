import { put } from "@vercel/blob";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { artifactKey } from "#lib/artifacts.js";

/** Content type by extension for artifact uploads; default is octet-stream. */
const CONTENT_TYPES: Record<string, string> = {
  csv: "text/csv",
  html: "text/html",
  json: "application/json",
  md: "text/markdown",
  txt: "text/plain",
};

const contentTypeFor = (slug: string): string =>
  CONTENT_TYPES[slug.split(".").pop()?.toLowerCase() ?? ""] ??
  "application/octet-stream";

/**
 * Tool that syncs a file from the session sandbox to durable Blob storage.
 *
 * @remarks
 * The sandbox is the workbench (canvas rendering, targeted edits); Blob is the
 * shelf: the durable copy later sessions restore. The sandbox file content is
 * read through `ctx.getSandbox()` — the model never pastes content through the
 * tool call. The Blob key derives from the framework-resolved principal, so a
 * session can only write its own artifacts.
 */
export default defineTool({
  description:
    "Sync a file from the workspace to durable storage so later sessions can " +
    "access it. Call after writing or updating a file the work should " +
    "outlive this session — drafts, outlines, research notes.",
  /**
   * Sync one sandbox file to Blob.
   *
   * @param input - Validated tool input.
   * @param ctx - Tool runtime context; supplies the sandbox handle and the
   * resolved principal.
   * @returns The stored `pathname`, `url`, and `size`, or `success: false`
   * with an `error`.
   */
  async execute({ filePath }, ctx) {
    const key = artifactKey(ctx.session.auth.current, filePath);
    if (!key) {
      return {
        error:
          "No signed-in principal to store artifacts for, or the path is not a usable artifact name.",
        success: false,
      };
    }

    let content: string;
    try {
      const sandbox = await ctx.getSandbox();
      const text = await sandbox.readTextFile({ path: filePath });

      if (text === null) {
        return {
          error: `${filePath} does not exist in the sandbox.`,
          success: false,
        };
      }

      content = text;
    } catch (error) {
      return {
        error: `Could not read ${filePath} in the sandbox: ${
          error instanceof Error ? error.message : String(error)
        }`,
        success: false,
      };
    }

    try {
      const blob = await put(key, content, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: contentTypeFor(key),
      });
      return {
        pathname: blob.pathname ?? key,
        size: content.length,
        success: true,
        url: blob.url,
      };
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "Failed to store artifact",
        success: false,
      };
    }
  },
  inputSchema: z.object({
    filePath: z
      .string()
      .min(1)
      .describe(
        "Absolute sandbox path of the file to sync, e.g. /workspace/migration.md"
      ),
  }),
  outputSchema: z.object({
    error: z.string().optional(),
    pathname: z.string().optional(),
    size: z.number().optional(),
    success: z.boolean(),
    url: z.string().optional(),
  }),
});
