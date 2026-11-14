/**
 * Shared Vercel Connect account probe for catalog endpoints.
 * Tokens stay in callers — this module only resolves identity + teams.
 */

const VERCEL_API = "https://api.vercel.com";

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
    }
  | {
      readonly connected: false;
      readonly message: string;
    };

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

  const teamsRes = await fetch(`${VERCEL_API}/v2/teams`, {
    headers: { authorization: `Bearer ${args.token}` },
    cache: "no-store",
  });
  const teams: VercelAccountTeam[] = [];
  if (teamsRes.ok) {
    const body = (await teamsRes.json()) as {
      teams?: Array<{ id?: string; name?: string; slug?: string }>;
    };
    for (const team of body.teams ?? []) {
      if (
        typeof team.id === "string" &&
        typeof team.name === "string" &&
        typeof team.slug === "string"
      ) {
        teams.push({ id: team.id, name: team.name, slug: team.slug });
      }
    }
  }

  const teamsSorted = [...teams].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  return {
    connected: true,
    token: args.token,
    username,
    teams: teamsSorted,
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
