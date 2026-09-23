import { list } from "@vercel/blob";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { artifactsPrefix } from "#lib/artifacts.js";

/**
 * Tool that lists the current principal's durable artifacts in Vercel Blob.
 *
 * @remarks
 * Scoped entirely by the framework-resolved principal (`ctx.session.auth.current`),
 * never model input. Use it to see what work outlived earlier sessions before
 * restoring a file with `restore_artifact`.
 */
export default defineTool({
  description:
    "List this principal's durable artifacts (files synced from earlier " +
    "sessions). Returns each artifact's pathname, size, and upload date. Use " +
    "to find what exists before restoring one.",
  /**
   * List the principal's artifacts.
   *
   * @param input - Validated tool input.
   * @param ctx - Tool runtime context; supplies the resolved principal.
   * @returns The matching `artifacts` and `count`, or an empty list with an
   * `error` message on failure.
   */
  async execute({ limit }, ctx) {
    const prefix = artifactsPrefix(ctx.session.auth.current);
    if (!prefix) {
      return {
        artifacts: [],
        count: 0,
        error: "No signed-in principal to list artifacts for.",
        hasMore: false,
      };
    }

    try {
      const { blobs, cursor, hasMore } = await list({ limit, prefix });
      return {
        artifacts: blobs.map((blob) => ({
          pathname: blob.pathname,
          size: blob.size,
          uploadedAt: blob.uploadedAt.toISOString(),
          url: blob.url,
        })),
        count: blobs.length,
        cursor,
        hasMore,
      };
    } catch (error) {
      return {
        artifacts: [],
        count: 0,
        error:
          error instanceof Error ? error.message : "Failed to list artifacts",
        hasMore: false,
      };
    }
  },
  inputSchema: z.object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .optional()
      .describe("Maximum number of artifacts to return. Defaults to 1000."),
  }),
  outputSchema: z.object({
    artifacts: z.array(
      z.object({
        pathname: z.string(),
        size: z.number(),
        uploadedAt: z.string(),
        url: z.string(),
      })
    ),
    count: z.number(),
    cursor: z.string().optional(),
    error: z.string().optional(),
    hasMore: z.boolean(),
  }),
});
