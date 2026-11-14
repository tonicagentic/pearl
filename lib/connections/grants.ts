/**
 * Per-user grant summaries for Settings. Uses the signed-in user's Connect
 * token to probe GitHub and Vercel. Tokens never leave this module.
 */

import {
  getTokenResponse,
  NoValidTokenError,
  UserAuthorizationRequiredError,
  type ConnectTokenResponse,
} from "@vercel/connect";

import { listWorkbenchPins } from "@/lib/db/workbench-pins";
import {
  CONNECTION_IDS,
  connectionConfiguration,
  connectionSubjectForUser,
  type ConnectionId,
} from "@/lib/connections/catalog";
import type {
  ConnectionGrantSummary,
  GithubAvailableRepo,
  GithubGrantDetails,
  GithubRepoGrant,
  VercelGrantDetails,
} from "@/lib/connections/grant-types";
import {
  missingFromGranted,
  requestedScopesFor,
} from "@/lib/connections/grant-scopes";
import { connectionTokenParams } from "@/lib/connections/oauth-scopes";
import { checkConnectionStatus } from "@/lib/connections/status";

export type {
  ConnectionGrantSummary,
  GithubGrantDetails,
  GithubRepoGrant,
  VercelGrantDetails,
} from "@/lib/connections/grant-types";
export {
  GRANT_SCOPE_CATALOGS,
  missingFromGranted,
  requestedScopesFor,
} from "@/lib/connections/grant-scopes";

const GITHUB_MANAGE_URL = "https://github.com/settings/applications";

/**
 * Build grant rows for every catalog connection. Sheets/Xero appear even when
 * hidden from the plugin catalog, as long as their connector env is set (or
 * the status check can still report unavailable).
 */
export async function listConnectionGrants(
  userId: string,
): Promise<readonly ConnectionGrantSummary[]> {
  const pins = await listWorkbenchPins(userId).catch(
    () => [] as Awaited<ReturnType<typeof listWorkbenchPins>>,
  );
  return Promise.all(
    CONNECTION_IDS.map((id) => summarizeGrant(id, userId, pins)),
  );
}

async function summarizeGrant(
  id: ConnectionId,
  userId: string,
  pins: Awaited<ReturnType<typeof listWorkbenchPins>>,
): Promise<ConnectionGrantSummary> {
  const status = await checkConnectionStatus(id, userId);
  const requestedScopes = requestedScopesFor(id);
  const base: ConnectionGrantSummary = {
    ...status,
    requestedScopes,
  };

  if (status.status !== "connected") {
    return base;
  }

  const connector = connectionConfiguration(id).connector;
  if (!connector) return base;

  let tokenResponse: ConnectTokenResponse;
  try {
    tokenResponse = await getTokenResponse(
      connector,
      {
        subject: connectionSubjectForUser(userId),
        ...connectionTokenParams(id),
      },
      { forceRefresh: false },
    );
  } catch (error) {
    if (
      error instanceof UserAuthorizationRequiredError ||
      error instanceof NoValidTokenError
    ) {
      return {
        ...base,
        status: "not-connected",
        detail:
          "Not authorized for your account. You can connect here or authorize when Pearl needs it in chat.",
        accountLabel: undefined,
      };
    }
    return {
      ...base,
      status: "unknown",
      detail: "Could not refresh the grant right now.",
    };
  }

  const claimScopes = scopesFromClaims(tokenResponse);
  let grantedScopes = claimScopes;
  let github: GithubGrantDetails | undefined;
  let vercel: VercelGrantDetails | undefined;

  if (id === "github") {
    const probe = await probeGithub(tokenResponse.token, pins);
    grantedScopes = probe.scopes.length > 0 ? probe.scopes : claimScopes;
    github = probe.details;
  } else if (id === "vercel") {
    vercel = await probeVercel(tokenResponse.token);
  } else if (id === "gmail" || id === "calendar" || id === "drive" || id === "sheets") {
    const googleScopes = await probeGoogleScopes(tokenResponse.token);
    if (googleScopes.length > 0) grantedScopes = googleScopes;
  }

  const missingScopes = missingFromGranted(requestedScopes, grantedScopes);
  const detail = detailForMissing(id, status.detail, missingScopes, github);

  return {
    ...base,
    detail,
    grantedScopes,
    missingScopes:
      missingScopes && missingScopes.length > 0 ? missingScopes : undefined,
    github,
    vercel,
  };
}

function detailForMissing(
  id: ConnectionId,
  existing: string | undefined,
  missing: readonly string[] | undefined,
  github: GithubGrantDetails | undefined,
): string | undefined {
  if (github) {
    const blocked = github.repos.filter((repo) => !repo.canPush);
    if (!github.hasRepoScope) {
      return "This grant is missing the repo scope. Tap Update and accept repo access so Pearl can push and open draft pull requests.";
    }
    if (blocked.length > 0) {
      const owners = [
        ...new Set(
          blocked.map((repo) => repo.fullName.split("/")[0]!).filter(Boolean),
        ),
      ];
      return `Pearl cannot push as you in ${owners.join(", ")}. Grant that organization on GitHub (Authorized OAuth Apps), then tap Update.`;
    }
  }
  if (missing && missing.length > 0) {
    if (id === "gmail" && missing.some((s) => s.includes("gmail.compose"))) {
      return "This grant is read-only. Tap Update and accept compose so Pearl can create drafts and send mail with approval.";
    }
    return `Missing scopes: ${missing.join(", ")}. Tap Update to re-authorize.`;
  }
  return existing;
}

function scopesFromClaims(
  token: Pick<ConnectTokenResponse, "claims" | "metadata">,
): string[] | undefined {
  for (const source of [token.claims, token.metadata]) {
    if (!source || typeof source !== "object") continue;
    const raw =
      source.scope ?? source.scopes ?? source.scp ?? source.oauth_scopes;
    const parsed = parseScopeValue(raw);
    if (parsed.length > 0) return parsed;
  }
  return undefined;
}

function parseScopeValue(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(/[\s,]+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

async function probeGithub(
  token: string,
  pins: Awaited<ReturnType<typeof listWorkbenchPins>>,
): Promise<{ scopes: string[]; details: GithubGrantDetails }> {
  const userRes = await githubFetch(token, "https://api.github.com/user");
  const scopesHeader =
    userRes.headers.get("x-oauth-scopes") ??
    userRes.headers.get("X-OAuth-Scopes") ??
    "";
  const scopes = scopesHeader
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  let login = "unknown";
  if (userRes.ok) {
    const body = (await userRes.json()) as { login?: string };
    if (typeof body.login === "string" && body.login.trim()) {
      login = body.login.trim();
    }
  }

  const orgsRes = await githubFetch(token, "https://api.github.com/user/orgs");
  const orgs: string[] = [];
  if (orgsRes.ok) {
    const body = (await orgsRes.json()) as Array<{ login?: string }>;
    for (const org of body) {
      if (typeof org.login === "string" && org.login.trim()) {
        orgs.push(org.login.trim());
      }
    }
  }

  const availableRepos = await listAvailableGithubRepos(token);

  const orgSet = new Set(orgs.map((name) => name.toLowerCase()));
  const hasRepoScope = scopes
    .map((scope) => scope.trim().toLowerCase())
    .includes("repo");

  const seen = new Set<string>();
  const repos: GithubRepoGrant[] = [];
  for (const pin of pins) {
    const fullName = `${pin.owner}/${pin.name}`;
    const key = fullName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const owner = pin.owner;
    const ownerIsUser = owner.toLowerCase() === login.toLowerCase();
    if (!ownerIsUser && !orgSet.has(owner.toLowerCase())) {
      repos.push({
        fullName,
        canPush: false,
        blockedReason: `This app cannot act as you in ${owner}.`,
      });
      continue;
    }

    const repoRes = await githubFetch(
      token,
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(pin.name)}`,
    );
    if (repoRes.status === 403 || repoRes.status === 404) {
      repos.push({
        fullName,
        canPush: false,
        blockedReason: `This app cannot act as you in ${owner}.`,
      });
      continue;
    }
    if (!repoRes.ok) {
      repos.push({
        fullName,
        canPush: false,
        blockedReason: `Could not verify push access (${repoRes.status}).`,
      });
      continue;
    }
    const repoBody = (await repoRes.json()) as {
      permissions?: { push?: boolean };
    };
    const canPush = repoBody.permissions?.push === true && hasRepoScope;
    repos.push({
      fullName,
      canPush,
      blockedReason: canPush
        ? undefined
        : hasRepoScope
          ? "No push permission on this repository."
          : "Missing repo scope.",
    });
  }

  return {
    scopes,
    details: {
      login,
      hasRepoScope,
      orgs,
      availableRepos,
      repos,
      manageUrl: GITHUB_MANAGE_URL,
    },
  };
}

async function listAvailableGithubRepos(
  token: string,
): Promise<GithubAvailableRepo[]> {
  const url = new URL("https://api.github.com/user/repos");
  url.searchParams.set("per_page", "30");
  url.searchParams.set("sort", "pushed");
  url.searchParams.set("affiliation", "owner,collaborator,organization_member");

  const response = await githubFetch(token, url.href);
  if (!response.ok) return [];

  const body = (await response.json()) as Array<{
    full_name?: string;
    private?: boolean;
    html_url?: string;
    description?: string | null;
  }>;

  const repos: GithubAvailableRepo[] = [];
  for (const repo of body) {
    const fullName = repo.full_name?.trim();
    const htmlUrl = repo.html_url?.trim();
    if (!fullName || !htmlUrl) continue;
    repos.push({
      fullName,
      private: repo.private === true,
      htmlUrl,
      description:
        typeof repo.description === "string" ? repo.description : null,
    });
  }
  return repos;
}

async function githubFetch(token: string, url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "pearl-connections",
      "x-github-api-version": "2022-11-28",
    },
    cache: "no-store",
  });
}

async function probeVercel(token: string): Promise<VercelGrantDetails> {
  const userRes = await fetch("https://api.vercel.com/v2/user", {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  let username = "unknown";
  if (userRes.ok) {
    const body = (await userRes.json()) as {
      user?: { username?: string; email?: string };
    };
    const name = body.user?.username?.trim() || body.user?.email?.trim();
    if (name) username = name;
  }

  const teamsRes = await fetch("https://api.vercel.com/v2/teams", {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const teams: VercelGrantDetails["teams"][number][] = [];
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

  return { username, teams };
}

async function probeGoogleScopes(token: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
    if (!response.ok) return [];
    const body = (await response.json()) as { scope?: string };
    return parseScopeValue(body.scope);
  } catch {
    return [];
  }
}

