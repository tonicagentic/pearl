// Repos client: hits the web app's /api/repos route with the same
// better-auth credential the eve transport uses.

import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

export type RepoDto = {
  readonly id: number;
  readonly name: string;
  readonly fullName: string;
  readonly private: boolean;
  readonly description: string | null;
  readonly htmlUrl: string;
  readonly updatedAt: string | null;
};

export type ReposPageDto = {
  readonly connected: boolean;
  readonly repos: RepoDto[];
  readonly page: number;
  readonly perPage: number;
  readonly hasNext: boolean;
  readonly message?: string;
};

export async function fetchRepos(page: number): Promise<ReposPageDto> {
  const credential = getAuthCookie();
  const response = await fetch(`${AGENT_URL}/api/repos?page=${page}`, {
    headers: credential ? { authorization: `Bearer ${credential}` } : {},
  });

  if (!response.ok) {
    if (response.status === 401) {
      sessionInvalid();
    }
    const body = await response.text().catch(() => "");
    throw new Error(
      `Failed to load repos (${response.status}) ${body.slice(0, 120)}`,
    );
  }

  return (await response.json()) as ReposPageDto;
}
