import type { WorkbenchPullRequest } from "./types.ts";

const GITHUB_API = "https://api.github.com";

export type GithubFetch = (
  path: string,
  init?: RequestInit,
) => Promise<Response>;

export function createGithubFetch(token: string): GithubFetch {
  return async (path, init) => {
    const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
    return fetch(url, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init?.headers ?? {}),
      },
    });
  };
}

export async function listOpenPullRequests(
  githubFetch: GithubFetch,
  args: { readonly owner: string; readonly repo: string; readonly limit?: number },
): Promise<readonly WorkbenchPullRequest[]> {
  const limit = args.limit ?? 20;
  const res = await githubFetch(
    `/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repo)}/pulls?state=open&per_page=${limit}`,
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub pulls → ${res.status}: ${body.slice(0, 400)}`);
  }
  const rows = (await res.json()) as Array<{
    number: number;
    title: string;
    state: string;
    draft?: boolean;
    html_url: string;
    head: { ref: string };
    base: { ref: string };
    merged_at?: string | null;
  }>;

  return rows.map((pr) => ({
    number: pr.number,
    title: pr.title,
    state: pr.merged_at ? "merged" : pr.state === "closed" ? "closed" : "open",
    draft: Boolean(pr.draft),
    htmlUrl: pr.html_url,
    headRef: pr.head.ref,
    baseRef: pr.base.ref,
  }));
}
