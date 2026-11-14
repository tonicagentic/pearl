/**
 * Full Vercel project catalog for the signed-in Connect grant.
 * Tokens stay in this module — never returned to clients.
 */

import {
  resolveVercelGrantContext,
  vercelDashboardPath,
  VERCEL_API,
  type VercelAccountTeam,
} from "@/lib/connections/vercel-account";
import { getVercelUserToken } from "@/lib/connections/tokens";

export const ALL_PROJECTS_PER_PAGE = 100;
/** Cap across personal + every team (100 × 20 = 2,000). */
export const ALL_PROJECTS_MAX_PAGES = 20;
export const ALL_PROJECTS_MAX = ALL_PROJECTS_PER_PAGE * ALL_PROJECTS_MAX_PAGES;

export type VercelCatalogProject = {
  readonly id: string;
  readonly name: string;
  readonly framework: string | null;
  readonly updatedAt: number | null;
  readonly teamId: string | null;
  readonly teamName: string | null;
  readonly teamSlug: string | null;
  readonly dashboardUrl: string;
};

export type VercelCatalogTeam = VercelAccountTeam;

export type VercelSkippedTeam = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly reason: string;
};

export type VercelProjectsCatalog =
  | {
      readonly connected: true;
      readonly username: string;
      readonly teams: readonly VercelCatalogTeam[];
      readonly projects: readonly VercelCatalogProject[];
      readonly skippedTeams: readonly VercelSkippedTeam[];
      readonly truncated: boolean;
    }
  | {
      readonly connected: false;
      readonly projects: readonly [];
      readonly truncated: false;
      readonly message: string;
    };

type VercelProjectPayload = {
  readonly id?: string;
  readonly name?: string;
  readonly framework?: string | null;
  readonly updatedAt?: number | null;
};

export type VercelProjectsPage = {
  readonly projects: readonly VercelCatalogProject[];
  readonly nextUntil: number | null;
  readonly forbidden: boolean;
};

/**
 * Walk one account's `/v9/projects` pages. Vercel returns `pagination.next` as a
 * timestamp passed back as `until` on the next request.
 */
export async function walkVercelProjectPages(args: {
  readonly fetchPage: (until: number | null) => Promise<VercelProjectsPage>;
  readonly maxPages?: number;
}): Promise<{
  readonly projects: VercelCatalogProject[];
  readonly truncated: boolean;
  readonly forbidden: boolean;
}> {
  const maxPages = args.maxPages ?? ALL_PROJECTS_MAX_PAGES;
  const projects: VercelCatalogProject[] = [];
  let until: number | null = null;
  let truncated = false;

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await args.fetchPage(until);
    if (result.forbidden) {
      return { projects, truncated: false, forbidden: true };
    }
    projects.push(...result.projects);
    if (result.nextUntil == null) {
      return { projects, truncated, forbidden: false };
    }
    until = result.nextUntil;
    if (page === maxPages) {
      truncated = true;
    }
  }

  return { projects, truncated, forbidden: false };
}

function mapProjects(
  payload: readonly VercelProjectPayload[],
  account: {
    readonly teamId: string | null;
    readonly teamName: string | null;
    readonly teamSlug: string | null;
    readonly accountSlug: string;
  },
): VercelCatalogProject[] {
  const projects: VercelCatalogProject[] = [];
  for (const project of payload) {
    const id = project.id?.trim();
    const name = project.name?.trim();
    if (!id || !name) continue;
    projects.push({
      id,
      name,
      framework:
        typeof project.framework === "string" && project.framework.trim()
          ? project.framework.trim()
          : null,
      updatedAt:
        typeof project.updatedAt === "number" ? project.updatedAt : null,
      teamId: account.teamId,
      teamName: account.teamName,
      teamSlug: account.teamSlug,
      dashboardUrl: vercelDashboardPath({
        accountSlug: account.accountSlug,
        path: `/${name}`,
      }),
    });
  }
  return projects;
}

async function fetchProjectsPage(args: {
  readonly token: string;
  readonly teamId: string | null;
  readonly teamName: string | null;
  readonly teamSlug: string | null;
  readonly accountSlug: string;
  readonly until: number | null;
}): Promise<VercelProjectsPage> {
  const url = new URL(`${VERCEL_API}/v9/projects`);
  url.searchParams.set("limit", String(ALL_PROJECTS_PER_PAGE));
  if (args.teamId) url.searchParams.set("teamId", args.teamId);
  if (args.until != null) url.searchParams.set("until", String(args.until));

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${args.token}` },
    cache: "no-store",
  });

  if (response.status === 403) {
    return { projects: [], nextUntil: null, forbidden: true };
  }
  if (!response.ok) {
    throw new Error(`Vercel list projects failed (${response.status}).`);
  }

  const body = (await response.json()) as {
    projects?: VercelProjectPayload[];
    pagination?: { next?: number | null };
  };
  const next =
    typeof body.pagination?.next === "number" ? body.pagination.next : null;

  return {
    projects: mapProjects(body.projects ?? [], {
      teamId: args.teamId,
      teamName: args.teamName,
      teamSlug: args.teamSlug,
      accountSlug: args.accountSlug,
    }),
    nextUntil: next,
    forbidden: false,
  };
}

/** Every project on the personal account and each visible team. */
export async function listAllVercelProjects(args: {
  readonly userId: string;
}): Promise<VercelProjectsCatalog> {
  let token: string;
  try {
    token = await getVercelUserToken(args.userId);
  } catch {
    return {
      connected: false,
      projects: [],
      truncated: false,
      message: "Connect Vercel in Settings to see your projects.",
    };
  }

  const context = await resolveVercelGrantContext({ token });
  if (!context.connected) {
    return {
      connected: false,
      projects: [],
      truncated: false,
      message: context.message,
    };
  }

  const projects: VercelCatalogProject[] = [];
  const skippedTeams: VercelSkippedTeam[] = [];
  let truncated = false;
  let pagesUsed = 0;

  const appendAccount = async (account: {
    readonly teamId: string | null;
    readonly teamName: string | null;
    readonly teamSlug: string | null;
    readonly accountSlug: string;
  }): Promise<"ok" | "forbidden" | "cap"> => {
    if (pagesUsed >= ALL_PROJECTS_MAX_PAGES) {
      truncated = true;
      return "cap";
    }
    const maxPages = ALL_PROJECTS_MAX_PAGES - pagesUsed;
    let pagesThisAccount = 0;
    const walked = await walkVercelProjectPages({
      maxPages,
      fetchPage: async (until) => {
        pagesThisAccount += 1;
        return fetchProjectsPage({
          token: context.token,
          teamId: account.teamId,
          teamName: account.teamName,
          teamSlug: account.teamSlug,
          accountSlug: account.accountSlug,
          until,
        });
      },
    });
    pagesUsed += Math.max(pagesThisAccount, walked.projects.length > 0 ? 1 : 0);
    if (walked.forbidden) return "forbidden";
    projects.push(...walked.projects);
    if (walked.truncated) truncated = true;
    if (pagesUsed >= ALL_PROJECTS_MAX_PAGES && walked.truncated) return "cap";
    return "ok";
  };

  await appendAccount({
    teamId: null,
    teamName: null,
    teamSlug: null,
    accountSlug: context.username,
  });

  for (const team of context.teams) {
    if (pagesUsed >= ALL_PROJECTS_MAX_PAGES) {
      truncated = true;
      break;
    }
    const status = await appendAccount({
      teamId: team.id,
      teamName: team.name,
      teamSlug: team.slug,
      accountSlug: team.slug,
    });
    if (status === "forbidden") {
      skippedTeams.push({
        id: team.id,
        name: team.name,
        slug: team.slug,
        reason: "Forbidden (403)",
      });
    }
  }

  if (projects.length > ALL_PROJECTS_MAX) {
    projects.length = ALL_PROJECTS_MAX;
    truncated = true;
  }

  projects.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  return {
    connected: true,
    username: context.username,
    teams: context.teams,
    projects,
    skippedTeams,
    truncated,
  };
}
