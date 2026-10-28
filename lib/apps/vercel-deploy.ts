const VERCEL_API = "https://api.vercel.com";

type VercelProject = {
  readonly id: string;
  readonly name: string;
  readonly accountId?: string;
};

type VercelDeployment = {
  readonly uid: string;
  readonly url: string;
  readonly readyState?: string;
  readonly aliasAssigned?: boolean;
};

async function vercelFetch(
  token: string,
  path: string,
  init?: RequestInit & { readonly teamId?: string | null },
): Promise<Response> {
  const url = new URL(`${VERCEL_API}${path}`);
  if (init?.teamId) {
    url.searchParams.set("teamId", init.teamId);
  }
  const { teamId: _teamId, ...rest } = init ?? {};
  return fetch(url, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(rest.headers ?? {}),
    },
  });
}

async function vercelJson<T>(
  token: string,
  path: string,
  init?: RequestInit & { readonly teamId?: string | null },
): Promise<T> {
  const res = await vercelFetch(token, path, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel ${init?.method ?? "GET"} ${path} → ${res.status}: ${body.slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

/** Prefer a personal account; fall back to the first team the token can see. */
export async function resolveVercelTeamId(
  token: string,
): Promise<string | null> {
  const teams = await vercelJson<{ teams?: Array<{ id: string }> }>(
    token,
    "/v2/teams",
  );
  return teams.teams?.[0]?.id ?? null;
}

/**
 * Ensure a Vercel project exists for the pearl repo and is linked to GitHub.
 * Returns the project id. Requires the Vercel account's GitHub integration.
 */
export async function ensureVercelProject(args: {
  readonly token: string;
  readonly projectName: string;
  readonly githubOwner: string;
  readonly githubRepo: string;
  readonly teamId?: string | null;
}): Promise<{ readonly projectId: string; readonly projectName: string }> {
  const teamId = args.teamId ?? (await resolveVercelTeamId(args.token));

  // Look for an existing project with this name first.
  const listed = await vercelJson<{
    projects?: Array<{ id: string; name: string }>;
  }>(args.token, `/v9/projects`, {
    method: "GET",
    teamId,
  });

  const existing = listed.projects?.find((p) => p.name === args.projectName);
  if (existing) {
    return { projectId: existing.id, projectName: existing.name };
  }

  const created = await vercelJson<VercelProject>(args.token, "/v11/projects", {
    method: "POST",
    teamId,
    body: JSON.stringify({
      name: args.projectName,
      framework: "nextjs",
      gitRepository: {
        type: "github",
        repo: `${args.githubOwner}/${args.githubRepo}`,
      },
    }),
  });

  return { projectId: created.id, projectName: created.name };
}

/** Wait until the latest production deployment is READY; return its URL. */
export async function waitForProductionUrl(args: {
  readonly token: string;
  readonly projectId: string;
  readonly teamId?: string | null;
  readonly timeoutMs?: number;
}): Promise<string> {
  const teamId = args.teamId ?? (await resolveVercelTeamId(args.token));
  const deadline = Date.now() + (args.timeoutMs ?? 180_000);

  while (Date.now() < deadline) {
    const deployments = await vercelJson<{
      deployments?: VercelDeployment[];
    }>(args.token, `/v6/deployments?projectId=${args.projectId}&target=production&limit=1`, {
      teamId,
    });

    const latest = deployments.deployments?.[0];
    if (latest?.readyState === "READY" && latest.url) {
      return `https://${latest.url}`;
    }
    if (latest?.readyState === "ERROR" || latest?.readyState === "CANCELED") {
      throw new Error(
        `Production deployment ${latest.uid} ended in ${latest.readyState}.`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }

  throw new Error("Timed out waiting for a production deployment.");
}

/**
 * Trigger a production deployment from the linked Git repo (after a push).
 * Prefer the Git integration's automatic deploy; this is a fallback nudge.
 */
export async function triggerProductionDeploy(args: {
  readonly token: string;
  readonly projectName: string;
  readonly githubOwner: string;
  readonly githubRepo: string;
  readonly teamId?: string | null;
}): Promise<void> {
  const teamId = args.teamId ?? (await resolveVercelTeamId(args.token));
  await vercelJson(args.token, "/v13/deployments", {
    method: "POST",
    teamId,
    body: JSON.stringify({
      name: args.projectName,
      project: args.projectName,
      target: "production",
      gitSource: {
        type: "github",
        org: args.githubOwner,
        repo: args.githubRepo,
        ref: "main",
      },
    }),
  });
}
