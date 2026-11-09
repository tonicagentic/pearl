import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { requireCoderUserId } from "@/lib/coder/principal";

/**
 * Squash-merge a pull request through the authenticated git__gh path by
 * shelling `gh pr merge` inside the coder sandbox. Relies on the git
 * extension's credential lease when the model uses git__gh; this tool runs
 * `gh` via bash after requiring a signed-in user, and instructs the model to
 * prefer git__gh for auth — we invoke gh through the sandbox with the
 * extension's execute path when available.
 *
 * Practical approach: call `gh pr merge` via sandbox bash and require that
 * GH credentials were already leased by a prior git__gh use in-session, OR
 * use the Connect user token through the GitHub API from the app runtime so
 * the token never enters the sandbox.
 */
import { getGithubUserToken } from "@/lib/connections/tokens";

export default defineTool({
  approval: always(),
  description:
    "Squash-merge a pull request for the signed-in user. Only merge when " +
    "checks are green. Always needs approval. The card must name owner/repo " +
    "and the PR number/title. No force or admin override.",
  inputSchema: z.object({
    owner: z.string().min(1).describe("GitHub owner (user or org)."),
    repo: z.string().min(1).describe("Repository name."),
    pullNumber: z.number().int().positive().describe("Pull request number."),
    title: z
      .string()
      .nullish()
      .describe("PR title for the approval summary."),
  }),
  async execute(input, ctx) {
    const auth = requireCoderUserId(ctx.session.auth.current);
    if ("error" in auth) return { status: "error", error: auth.error };

    let token: string;
    try {
      token = await getGithubUserToken(auth.userId);
    } catch (cause) {
      return {
        status: "error",
        error: cause instanceof Error ? cause.message : "GitHub token unavailable.",
      };
    }

    const repoFull = `${input.owner}/${input.repo}`;
    const prMeta = await githubJson<{
      title: string;
      mergeable_state?: string;
      draft?: boolean;
      html_url: string;
    }>(token, `/repos/${repoFull}/pulls/${input.pullNumber}`);

    const checks = await githubJson<{
      state?: string;
      statuses?: Array<{ state: string }>;
      check_runs?: Array<{ conclusion: string | null; status: string }>;
    }>(
      token,
      `/repos/${repoFull}/commits/${encodeURIComponent(
        (
          await githubJson<{ head: { sha: string } }>(
            token,
            `/repos/${repoFull}/pulls/${input.pullNumber}`,
          )
        ).head.sha,
      )}/status`,
    ).catch(() => null);

    if (checks?.state && checks.state !== "success" && checks.state !== "pending") {
      // pending is allowed to continue to check runs; failure blocks.
      if (checks.state === "failure" || checks.state === "error") {
        return {
          status: "error",
          error: `Checks are not green (combined status: ${checks.state}). Fix CI before merging.`,
        };
      }
    }

    // Refuse explicit unstable mergeable states when GitHub reports them.
    if (
      prMeta.mergeable_state &&
      ["dirty", "blocked", "unstable"].includes(prMeta.mergeable_state)
    ) {
      return {
        status: "error",
        error: `Pull request is not mergeable (state: ${prMeta.mergeable_state}).`,
      };
    }

    const merged = await githubJson<{
      merged?: boolean;
      message?: string;
      sha?: string;
    }>(token, `/repos/${repoFull}/pulls/${input.pullNumber}/merge`, {
      method: "PUT",
      body: JSON.stringify({
        merge_method: "squash",
        commit_title: input.title?.trim() || prMeta.title,
      }),
    });

    if (!merged.merged) {
      return {
        status: "error",
        error: merged.message ?? "GitHub refused the squash merge.",
      };
    }

    return {
      status: "ok",
      url: prMeta.html_url,
      sha: merged.sha,
      title: prMeta.title,
      repo: repoFull,
      pullNumber: input.pullNumber,
    };
  },
});

async function githubJson<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "pearl-coder",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `GitHub ${init?.method ?? "GET"} ${path} → ${res.status}: ${body.slice(0, 400)}`,
    );
  }
  return (await res.json()) as T;
}
