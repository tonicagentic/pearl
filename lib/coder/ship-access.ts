/**
 * Preflight for coder ship steps: verify the signed-in user's Connect grants
 * can push to a GitHub repo and see a linked Vercel project. Tokens never
 * leave this module.
 */

import {
  getConnectorMetadata,
  getTokenResponse,
  NoValidTokenError,
  startAuthorization,
  UserAuthorizationRequiredError,
} from "@vercel/connect";

import { getEffectiveAppUrl } from "@/lib/auth-url";
import {
  connectionConfiguration,
  connectionSubjectForUser,
} from "@/lib/connections/catalog";
import {
  githubPushDeniedMessage,
  vercelTokenUnavailableMessage,
} from "@/lib/connections/grant-errors";
import { connectionTokenParams } from "@/lib/connections/oauth-scopes";
import { listAllVercelTeams } from "@/lib/connections/vercel-account";

const GITHUB_MANAGE_INDEX = "https://github.com/settings/applications";
const GITHUB_API = "https://api.github.com";
const VERCEL_API = "https://api.vercel.com";

export type ShipAccessProviderResult = {
  readonly ok: boolean;
  readonly reason?: string;
  readonly authorizeUrl?: string;
  readonly manageUrl?: string;
  readonly login?: string;
  readonly hasRepoScope?: boolean;
  readonly canPush?: boolean;
  readonly username?: string;
  readonly projectFound?: boolean;
  readonly projectName?: string;
  readonly teamSlug?: string | null;
};

export type ShipAccessResult = {
  readonly status: "ok" | "blocked";
  readonly github: ShipAccessProviderResult;
  readonly vercel: ShipAccessProviderResult;
  /** Short instruction for the coder model. */
  readonly nextStep: string;
};

type GithubProbe = {
  readonly login: string;
  readonly scopes: readonly string[];
  readonly hasRepoScope: boolean;
  readonly canPush: boolean;
  readonly repoStatus: number;
};

async function githubFetch(
  token: string,
  url: string,
): Promise<Response> {
  return fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "pearl-ship-access",
      "x-github-api-version": "2022-11-28",
    },
    cache: "no-store",
  });
}

async function probeGithubRepo(args: {
  readonly token: string;
  readonly owner: string;
  readonly repo: string;
}): Promise<GithubProbe> {
  const userRes = await githubFetch(args.token, `${GITHUB_API}/user`);
  const scopesHeader =
    userRes.headers.get("x-oauth-scopes") ??
    userRes.headers.get("X-OAuth-Scopes") ??
    "";
  const scopes = scopesHeader
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const hasRepoScope = scopes
    .map((scope) => scope.toLowerCase())
    .includes("repo");

  let login = "unknown";
  if (userRes.ok) {
    const body = (await userRes.json()) as { login?: string };
    if (typeof body.login === "string" && body.login.trim()) {
      login = body.login.trim();
    }
  }

  const repoRes = await githubFetch(
    args.token,
    `${GITHUB_API}/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repo)}`,
  );
  let canPush = false;
  if (repoRes.ok) {
    const body = (await repoRes.json()) as {
      permissions?: { push?: boolean };
    };
    canPush = body.permissions?.push === true && hasRepoScope;
  }

  return {
    login,
    scopes,
    hasRepoScope,
    canPush,
    repoStatus: repoRes.status,
  };
}

async function githubOAuthManageUrl(
  connector: string,
): Promise<string> {
  try {
    const meta = await getConnectorMetadata(connector);
    const vendor = meta.vendor ?? {};
    const clientId =
      pickString(vendor.clientId) ??
      pickString(vendor.client_id) ??
      pickString(vendor.oauthClientId) ??
      pickString(vendor.oauth_client_id);
    if (clientId) {
      return `https://github.com/settings/connections/applications/${encodeURIComponent(clientId)}`;
    }
  } catch {
    // Fall through to the apps index.
  }
  return GITHUB_MANAGE_INDEX;
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function startConnectionAuthorize(
  id: "github" | "vercel",
  userId: string,
): Promise<string | undefined> {
  const config = connectionConfiguration(id);
  if (!config.connector) return undefined;
  try {
    await getConnectorMetadata(config.connector);
    const challenge = await startAuthorization(
      config.connector,
      {
        subject: connectionSubjectForUser(userId),
        ...connectionTokenParams(id),
      },
      {
        callbackUrl: `${getEffectiveAppUrl()}/settings/connections/return`,
      },
    );
    const url = new URL(challenge.url);
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      return undefined;
    }
    return url.href;
  } catch {
    return undefined;
  }
}

type VercelProjectHit = {
  readonly name: string;
  readonly teamSlug: string | null;
};

async function findLinkedVercelProject(args: {
  readonly token: string;
  readonly owner: string;
  readonly repo: string;
  readonly username: string;
  readonly teams: readonly { readonly id: string; readonly slug: string }[];
}): Promise<VercelProjectHit | null> {
  const accounts: Array<{ teamId: string | null; slug: string }> = [
    { teamId: null, slug: args.username },
    ...args.teams.map((team) => ({ teamId: team.id, slug: team.slug })),
  ];
  const repoKey = `${args.owner}/${args.repo}`.toLowerCase();
  const repoUrl = `https://github.com/${args.owner}/${args.repo}`.toLowerCase();

  for (const account of accounts) {
    const url = new URL(`${VERCEL_API}/v9/projects`);
    url.searchParams.set("limit", "20");
    url.searchParams.set("repo", `${args.owner}/${args.repo}`);
    if (account.teamId) url.searchParams.set("teamId", account.teamId);

    const response = await fetch(url, {
      headers: { authorization: `Bearer ${args.token}` },
      cache: "no-store",
    });
    if (!response.ok) continue;
    const body = (await response.json()) as {
      projects?: Array<{
        name?: string;
        link?: { type?: string; org?: string; repo?: string; repoUrl?: string };
      }>;
    };
    for (const project of body.projects ?? []) {
      const name = project.name?.trim();
      if (!name) continue;
      const link = project.link;
      if (link?.type === "github") {
        const linked = `${link.org ?? ""}/${link.repo ?? ""}`.toLowerCase();
        const linkedUrl = (link.repoUrl ?? "").toLowerCase();
        if (linked === repoKey || linkedUrl.includes(repoUrl)) {
          return {
            name,
            teamSlug: account.teamId ? account.slug : null,
          };
        }
      }
      // repo= filter already scoped the page; accept the first hit.
      return {
        name,
        teamSlug: account.teamId ? account.slug : null,
      };
    }
  }
  return null;
}

/**
 * Check that Pearl's Connect grants can ship to owner/repo. When the grant is
 * missing scopes or org access, starts authorization and returns the URL.
 */
export async function checkShipAccess(args: {
  readonly userId: string;
  readonly owner: string;
  readonly repo: string;
  /** When false, only GitHub is checked (PR-only tasks). Default true. */
  readonly checkVercel?: boolean;
}): Promise<ShipAccessResult> {
  const owner = args.owner.trim();
  const repo = args.repo.trim();
  const checkVercel = args.checkVercel !== false;

  const github = await checkGithubAccess(args.userId, owner, repo);
  const vercel = checkVercel
    ? await checkVercelAccess(args.userId, owner, repo)
    : { ok: true, projectFound: false, reason: "Skipped (checkVercel=false)." };

  if (github.ok && vercel.ok) {
    return {
      status: "ok",
      github,
      vercel,
      nextStep:
        "Ship access is ready. Continue checkout/edits, then use gated_git " +
        "before the first push and draft PR.",
    };
  }

  const parts: string[] = [];
  if (!github.ok) {
    parts.push(
      github.authorizeUrl
        ? `Open this GitHub authorize URL, then retry: ${github.authorizeUrl}`
        : github.reason ?? githubPushDeniedMessage(owner),
    );
    if (github.manageUrl) {
      parts.push(
        `If the app is already connected, grant the organization here: ${github.manageUrl}`,
      );
    }
  }
  if (!vercel.ok) {
    parts.push(
      vercel.authorizeUrl
        ? `Open this Vercel authorize URL, then retry: ${vercel.authorizeUrl}`
        : vercel.reason ?? vercelTokenUnavailableMessage(),
    );
  }

  return {
    status: "blocked",
    github,
    vercel,
    nextStep:
      parts.join(" ") +
      " Do not clone or edit until ensure_ship_access returns status ok.",
  };
}

async function checkGithubAccess(
  userId: string,
  owner: string,
  repo: string,
): Promise<ShipAccessProviderResult> {
  const config = connectionConfiguration("github");
  if (!config.connector) {
    return {
      ok: false,
      reason:
        "GitHub is not configured on this deployment. Attach GITHUB_CONNECTOR.",
    };
  }

  let token: string;
  try {
    const response = await getTokenResponse(
      config.connector,
      {
        subject: connectionSubjectForUser(userId),
        ...connectionTokenParams("github"),
      },
      { forceRefresh: false },
    );
    token = response.token;
  } catch (error) {
    if (
      error instanceof UserAuthorizationRequiredError ||
      error instanceof NoValidTokenError
    ) {
      const authorizeUrl = await startConnectionAuthorize("github", userId);
      return {
        ok: false,
        reason:
          "GitHub is not authorized for your Pearl account (or is missing the repo scope).",
        authorizeUrl,
        manageUrl: await githubOAuthManageUrl(config.connector),
      };
    }
    return {
      ok: false,
      reason: "Could not refresh the GitHub grant right now. Retry shortly.",
    };
  }

  try {
    const probe = await probeGithubRepo({ token, owner, repo });
    if (probe.canPush) {
      return {
        ok: true,
        login: probe.login,
        hasRepoScope: probe.hasRepoScope,
        canPush: true,
      };
    }

    const manageUrl = await githubOAuthManageUrl(config.connector);
    if (!probe.hasRepoScope) {
      const authorizeUrl = await startConnectionAuthorize("github", userId);
      return {
        ok: false,
        login: probe.login,
        hasRepoScope: false,
        canPush: false,
        reason:
          "This GitHub grant is missing the repo scope. Update the connection and accept repo access.",
        authorizeUrl,
        manageUrl,
      };
    }

    // Token has repo scope but cannot push — almost always missing org access
    // for the OAuth app (not the user's GitHub role).
    return {
      ok: false,
      login: probe.login,
      hasRepoScope: true,
      canPush: false,
      reason: githubPushDeniedMessage(owner, manageUrl),
      manageUrl,
      authorizeUrl: await startConnectionAuthorize("github", userId),
    };
  } catch {
    return {
      ok: false,
      reason: "Could not verify GitHub push access right now. Retry shortly.",
    };
  }
}

async function checkVercelAccess(
  userId: string,
  owner: string,
  repo: string,
): Promise<ShipAccessProviderResult> {
  const config = connectionConfiguration("vercel");
  if (!config.connector) {
    return {
      ok: false,
      reason:
        "Vercel is not configured on this deployment. Attach VERCEL_CONNECTOR.",
    };
  }

  let token: string;
  try {
    const response = await getTokenResponse(
      config.connector,
      { subject: connectionSubjectForUser(userId) },
      { forceRefresh: false },
    );
    token = response.token;
  } catch (error) {
    if (
      error instanceof UserAuthorizationRequiredError ||
      error instanceof NoValidTokenError
    ) {
      const authorizeUrl = await startConnectionAuthorize("vercel", userId);
      return {
        ok: false,
        reason: vercelTokenUnavailableMessage(),
        authorizeUrl,
      };
    }
    return {
      ok: false,
      reason: "Could not refresh the Vercel grant right now. Retry shortly.",
    };
  }

  try {
    const userRes = await fetch(`${VERCEL_API}/v2/user`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!userRes.ok) {
      const authorizeUrl = await startConnectionAuthorize("vercel", userId);
      return {
        ok: false,
        reason: vercelTokenUnavailableMessage(`HTTP ${userRes.status}`),
        authorizeUrl,
      };
    }
    const userBody = (await userRes.json()) as {
      user?: { username?: string; email?: string };
    };
    const username =
      userBody.user?.username?.trim() ||
      userBody.user?.email?.trim() ||
      "unknown";

    const { teams } = await listAllVercelTeams({ token });
    const hit = await findLinkedVercelProject({
      token,
      owner,
      repo,
      username,
      teams,
    });

    // Token works. A missing linked project is not an auth failure — the
    // coder can still open a PR; deploy_vercel may create or link later.
    return {
      ok: true,
      username,
      projectFound: hit != null,
      projectName: hit?.name,
      teamSlug: hit?.teamSlug ?? null,
      reason: hit
        ? undefined
        : `No Vercel project linked to ${owner}/${repo} yet. Pull requests can proceed; deploy_vercel may need a linked project.`,
    };
  } catch {
    return {
      ok: false,
      reason: "Could not verify Vercel access right now. Retry shortly.",
    };
  }
}
