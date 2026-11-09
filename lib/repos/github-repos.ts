import { getGithubUserToken } from "@/lib/connections/tokens";

export const REPOS_PER_PAGE = 30;
const MAX_PER_PAGE = 100;

export type UserRepo = {
  readonly id: number;
  readonly name: string;
  readonly fullName: string;
  readonly private: boolean;
  readonly description: string | null;
  readonly htmlUrl: string;
  readonly updatedAt: string | null;
};

export type UserReposPage =
  | {
      readonly connected: true;
      readonly repos: readonly UserRepo[];
      readonly page: number;
      readonly perPage: number;
      readonly hasNext: boolean;
    }
  | {
      readonly connected: false;
      readonly repos: readonly [];
      readonly page: number;
      readonly perPage: number;
      readonly hasNext: false;
      readonly message: string;
    };

type GithubRepoPayload = {
  readonly id: number;
  readonly name: string;
  readonly full_name: string;
  readonly private: boolean;
  readonly description: string | null;
  readonly html_url: string;
  readonly updated_at?: string | null;
};

export function parsePageParam(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

export function parsePerPageParam(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return REPOS_PER_PAGE;
  return Math.min(parsed, MAX_PER_PAGE);
}

function notConnected(
  page: number,
  perPage: number,
  message: string,
): UserReposPage {
  return {
    connected: false,
    repos: [],
    page,
    perPage,
    hasNext: false,
    message,
  };
}

/** One page of the signed-in user's GitHub repos (their full catalog, newest activity first). */
export async function listUserRepos(args: {
  readonly userId: string;
  readonly page?: number;
  readonly perPage?: number;
}): Promise<UserReposPage> {
  const page = args.page ?? 1;
  const perPage = args.perPage ?? REPOS_PER_PAGE;

  let token: string;
  try {
    token = await getGithubUserToken(args.userId);
  } catch {
    return notConnected(page, perPage, "Connect GitHub in Settings to see your repos.");
  }

  const url = new URL("https://api.github.com/user/repos");
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("sort", "pushed");
  url.searchParams.set("affiliation", "owner,collaborator,organization_member");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    return notConnected(
      page,
      perPage,
      "GitHub rejected the connection. Reconnect GitHub in Settings.",
    );
  }
  if (!response.ok) {
    throw new Error(`GitHub list repos failed (${response.status}).`);
  }

  const payload = (await response.json()) as GithubRepoPayload[];
  const hasNext = /rel="next"/.test(response.headers.get("link") ?? "");

  return {
    connected: true,
    repos: payload.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      description: repo.description,
      htmlUrl: repo.html_url,
      updatedAt: repo.updated_at ?? null,
    })),
    page,
    perPage,
    hasNext,
  };
}
