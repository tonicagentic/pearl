// GitHub / Vercel connection catalogs for mobile plugin screens.
// Hits the web app's authenticated catalog routes with the same better-auth
// credential the connections client uses.

import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

export type CatalogRepo = {
  readonly id: number;
  readonly name: string;
  readonly fullName: string;
  readonly private: boolean;
  readonly description: string | null;
  readonly htmlUrl: string;
  readonly updatedAt: string | null;
};

export type GithubReposCatalog =
  | {
      readonly connected: true;
      readonly repos: readonly CatalogRepo[];
      readonly truncated: boolean;
    }
  | {
      readonly connected: false;
      readonly repos: readonly [];
      readonly truncated: false;
      readonly message: string;
    };

export type CatalogVercelProject = {
  readonly id: string;
  readonly name: string;
  readonly framework: string | null;
  readonly updatedAt: number | null;
  readonly teamId: string | null;
  readonly teamName: string | null;
  readonly teamSlug: string | null;
  readonly dashboardUrl: string;
};

export type CatalogVercelTeam = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
};

export type VercelProjectsCatalog =
  | {
      readonly connected: true;
      readonly username: string;
      readonly teams: readonly CatalogVercelTeam[];
      readonly projects: readonly CatalogVercelProject[];
      readonly skippedTeams: readonly {
        readonly id: string;
        readonly name: string;
        readonly slug: string;
        readonly reason: string;
      }[];
      readonly truncated: boolean;
    }
  | {
      readonly connected: false;
      readonly projects: readonly [];
      readonly truncated: false;
      readonly message: string;
    };

export type CatalogVercelDomain = {
  readonly name: string;
  readonly verified: boolean;
  readonly serviceType: string | null;
  readonly expiresAt: number | null;
  readonly teamId: string | null;
  readonly teamName: string | null;
  readonly teamSlug: string | null;
  readonly dashboardUrl: string;
};

export type CatalogVercelIntegration = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly status: string;
  readonly source: string | null;
  readonly installationType: string | null;
  readonly projectCount: number | null;
  readonly teamId: string | null;
  readonly teamName: string | null;
  readonly teamSlug: string | null;
  readonly dashboardUrl: string;
};

export type CatalogVercelStore = {
  readonly id: string;
  readonly name: string;
  readonly kind: "blob" | "postgres" | "edge-config" | "kv" | "other";
  readonly status: string | null;
  readonly region: string | null;
  readonly teamId: string | null;
  readonly teamName: string | null;
  readonly teamSlug: string | null;
  readonly dashboardUrl: string;
};

export type VercelResourcesCatalog =
  | {
      readonly connected: true;
      readonly username: string;
      readonly teams: readonly CatalogVercelTeam[];
      readonly domains: readonly CatalogVercelDomain[];
      readonly integrations: readonly CatalogVercelIntegration[];
      readonly stores: readonly CatalogVercelStore[];
      readonly skippedTeams: readonly {
        readonly id: string;
        readonly name: string;
        readonly slug: string;
        readonly reason: string;
      }[];
      readonly truncated: {
        readonly domains: boolean;
        readonly integrations: boolean;
        readonly stores: boolean;
      };
    }
  | {
      readonly connected: false;
      readonly domains: readonly [];
      readonly integrations: readonly [];
      readonly stores: readonly [];
      readonly message: string;
    };

function authHeaders(): Record<string, string> {
  const credential = getAuthCookie();
  return {
    "content-type": "application/json",
    ...(credential ? { authorization: `Bearer ${credential}` } : {}),
  };
}

async function parseError(response: Response, fallback: string): Promise<never> {
  if (response.status === 401) {
    sessionInvalid();
  }
  throw new Error(`${fallback} (${response.status}).`);
}

/** Every GitHub repo visible to the signed-in grant. */
export async function fetchGithubReposCatalog(): Promise<GithubReposCatalog> {
  const response = await fetch(`${AGENT_URL}/api/repos?all=1`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    await parseError(response, "Could not load GitHub repositories");
  }
  return (await response.json()) as GithubReposCatalog;
}

/** Every Vercel project on the personal account and each visible team. */
export async function fetchVercelProjectsCatalog(): Promise<VercelProjectsCatalog> {
  const response = await fetch(
    `${AGENT_URL}/api/connections/vercel/projects`,
    {
      headers: authHeaders(),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    await parseError(response, "Could not load Vercel projects");
  }
  return (await response.json()) as VercelProjectsCatalog;
}

/** Domains, integrations, and storage across personal + teams. */
export async function fetchVercelResourcesCatalog(): Promise<VercelResourcesCatalog> {
  const response = await fetch(
    `${AGENT_URL}/api/connections/vercel/resources`,
    {
      headers: authHeaders(),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    await parseError(response, "Could not load Vercel resources");
  }
  return (await response.json()) as VercelResourcesCatalog;
}
