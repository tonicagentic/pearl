/**
 * Shared Vercel Connect account probe for catalog endpoints.
 * Tokens stay in callers — this module only resolves identity + teams.
 */

const VERCEL_API = "https://api.vercel.com";

/** Same page size Vercel uses by default for /v2/teams. */
export const VERCEL_TEAMS_PER_PAGE = 20;
/** Cap team pages so a huge membership cannot hang the catalog. */
export const VERCEL_TEAMS_MAX_PAGES = 20;

export type VercelAccountTeam = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
};

export type VercelGrantContext =
  | {
      readonly connected: true;
      readonly token: string;
      readonly username: string;
      readonly teams: readonly VercelAccountTeam[];
      /** True when the team walk hit the page cap. */
      readonly teamsTruncated: boolean;
    }
  | {
      readonly connected: false;
      readonly message: string;
    };

type TeamsPage = {
  readonly teams: VercelAccountTeam[];
  readonly nextUntil: number | null;
};

async function fetchTeamsPage(args: {
  readonly token: string;
  readonly until: number | null;
}): Promise<TeamsPage> {
  const url = new URL(`${VERCEL_API}/v2/teams`);
  url.searchParams.set("limit", String(VERCEL_TEAMS_PER_PAGE));
  if (args.until != null) {
    url.searchParams.set("until", String(args.until));
  }
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${args.token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    return { teams: [], nextUntil: null };
  }
  const body = (await response.json()) as {
    teams?: Array<{ id?: string; name?: string; slug?: string }>;
    pagination?: { next?: number | null };
  };
  const teams: VercelAccountTeam[] = [];
  for (const team of body.teams ?? []) {
    if (
      typeof team.id === "string" &&
      typeof team.name === "string" &&
      typeof team.slug === "string"
    ) {
      teams.push({ id: team.id, name: team.name, slug: team.slug });
    }
  }
  const next =
    typeof body.pagination?.next === "number" ? body.pagination.next : null;
  return { teams, nextUntil: next };
}

/** Walk every /v2/teams page the grant can see. */
export async function listAllVercelTeams(args: {
  readonly token: string;
  readonly maxPages?: number;
}): Promise<{
  readonly teams: VercelAccountTeam[];
  readonly truncated: boolean;
}> {
  const maxPages = args.maxPages ?? VERCEL_TEAMS_MAX_PAGES;
  const teams: VercelAccountTeam[] = [];
  const seen = new Set<string>();
  let until: number | null = null;
  let truncated = false;

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await fetchTeamsPage({ token: args.token, until });
    for (const team of result.teams) {
      if (seen.has(team.id)) continue;
      seen.add(team.id);
      teams.push(team);
    }
    if (result.nextUntil == null) {
      return { teams, truncated };
    }
    until = result.nextUntil;
    if (page === maxPages) {
      truncated = true;
    }
  }

  return { teams, truncated };
}

export async function resolveVercelGrantContext(args: {
  readonly token: string;
}): Promise<VercelGrantContext> {
  const userRes = await fetch(`${VERCEL_API}/v2/user`, {
    headers: { authorization: `Bearer ${args.token}` },
    cache: "no-store",
  });
  if (userRes.status === 401 || userRes.status === 403) {
    return {
      connected: false,
      message: "Vercel rejected the connection. Reconnect Vercel in Settings.",
    };
  }
  if (!userRes.ok) {
    throw new Error(`Vercel user probe failed (${userRes.status}).`);
  }

  const userBody = (await userRes.json()) as {
    user?: { username?: string; email?: string };
  };
  const username =
    userBody.user?.username?.trim() ||
    userBody.user?.email?.trim() ||
    "unknown";

  const { teams, truncated } = await listAllVercelTeams({ token: args.token });
  const teamsSorted = [...teams].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  return {
    connected: true,
    token: args.token,
    username,
    teams: teamsSorted,
    teamsTruncated: truncated,
  };
}

export function vercelDashboardPath(args: {
  readonly accountSlug: string;
  readonly path: string;
}): string {
  const path = args.path.startsWith("/") ? args.path : `/${args.path}`;
  return `https://vercel.com/${encodeURIComponent(args.accountSlug)}${path}`;
}

export { VERCEL_API };
