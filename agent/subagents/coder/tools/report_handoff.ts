import { defineTool } from "eve/tools";
import { z } from "zod";

import { parseCoderHandoff } from "@/lib/chat/coder-receipt";

/**
 * Publish the structured receipt the parent task card renders. Call once at
 * the end of a coding task after the draft PR (and preview_check when there
 * is a URL). Does not deploy, push, or open a PR — it only records what those
 * tools already returned.
 */
export default defineTool({
  description:
    "Publish the structured coding receipt for the parent chat card: " +
    "summary, repo, draft PR, files changed, preview URL, and optional " +
    "recording. Call once near the end of the task, after the draft PR and " +
    "after preview_check when a URL exists. Does not push, deploy, or open " +
    "a PR. Then end with a short prose summary (and include the same " +
    "handoff object on your final JSON completion payload so the card " +
    "survives after the child session is gone).",
  inputSchema: z.object({
    summary: z
      .string()
      .min(1)
      .describe("One or two sentences describing what changed."),
    repo: z
      .object({
        owner: z.string().min(1),
        name: z.string().min(1),
        url: z.string().url(),
        branch: z.string().nullish(),
      })
      .nullish(),
    pullRequest: z
      .object({
        url: z.string().url(),
        number: z.number().int().positive(),
        title: z.string().min(1),
        draft: z.boolean().nullish(),
      })
      .nullish(),
    files: z
      .array(
        z.object({
          path: z.string().min(1),
          additions: z.number().int().nonnegative(),
          deletions: z.number().int().nonnegative(),
        }),
      )
      .nullish()
      .describe(
        "Paths from `git diff --numstat` against the base branch, with line counts.",
      ),
    preview: z
      .object({
        url: z.string().url(),
        httpStatus: z.number().int().nullish(),
        authWall: z.boolean().nullish(),
        screenshotUrl: z.string().url().nullish(),
      })
      .nullish(),
    recording: z
      .object({
        url: z.string().url(),
        posterUrl: z.string().url().nullish(),
        durationMs: z.number().int().positive().nullish(),
        title: z.string().nullish(),
      })
      .nullish(),
  }),
  async execute(input) {
    const handoff = parseCoderHandoff({
      summary: input.summary,
      ...(input.repo
        ? {
            repo: {
              owner: input.repo.owner,
              name: input.repo.name,
              url: input.repo.url,
              ...(input.repo.branch ? { branch: input.repo.branch } : {}),
            },
          }
        : {}),
      ...(input.pullRequest
        ? {
            pullRequest: {
              url: input.pullRequest.url,
              number: input.pullRequest.number,
              title: input.pullRequest.title,
              ...(input.pullRequest.draft != null
                ? { draft: input.pullRequest.draft }
                : {}),
            },
          }
        : {}),
      ...(input.files?.length ? { files: input.files } : {}),
      ...(input.preview
        ? {
            preview: {
              url: input.preview.url,
              ...(input.preview.httpStatus != null
                ? { httpStatus: input.preview.httpStatus }
                : {}),
              ...(input.preview.authWall != null
                ? { authWall: input.preview.authWall }
                : {}),
              ...(input.preview.screenshotUrl
                ? { screenshotUrl: input.preview.screenshotUrl }
                : {}),
            },
          }
        : {}),
      ...(input.recording
        ? {
            recording: {
              url: input.recording.url,
              ...(input.recording.posterUrl
                ? { posterUrl: input.recording.posterUrl }
                : {}),
              ...(input.recording.durationMs
                ? { durationMs: input.recording.durationMs }
                : {}),
              ...(input.recording.title
                ? { title: input.recording.title }
                : {}),
            },
          }
        : {}),
    });

    if (!handoff) {
      return {
        status: "error" as const,
        error: "Handoff was empty after normalization.",
      };
    }

    return {
      status: "ok" as const,
      handoff,
    };
  },
});
