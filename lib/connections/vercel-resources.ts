/**
 * Domains, integrations, and storage catalogs for the signed-in Vercel grant.
 * Tokens stay in this module — never returned to clients.
 */

import {
  resolveVercelGrantContext,
  vercelDashboardPath,
  VERCEL_API,
  type VercelAccountTeam,
} from "@/lib/connections/vercel-account";
import { getVercelUserToken } from "@/lib/connections/tokens";

export const RESOURCES_PER_PAGE = 100;
export const RESOURCES_MAX_PAGES = 20;

export type VercelCatalogDomain = {
  readonly name: string;
  readonly verified: boolean;
  readonly serviceType: string | null;
  readonly expiresAt: number | null;
  readonly teamId: string | null;
  readonly teamName: string | null;
  readonly teamSlug: string | null;
  readonly dashboardUrl: string;
};

export type VercelCatalogIntegration = {
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

export type VercelCatalogStore = {
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

export type VercelSkippedTeam = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly reason: string;
};

export type VercelResourcesCatalog =
  | {
      readonly connected: true;
      readonly username: string;
      readonly teams: readonly VercelAccountTeam[];
      readonly domains: readonly VercelCatalogDomain[];
      readonly integrations: readonly VercelCatalogIntegration[];
      readonly stores: readonly VercelCatalogStore[];
      readonly skippedTeams: readonly VercelSkippedTeam[];
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

type AccountScope = {
  readonly teamId: string | null;
  readonly teamName: string | null;
  readonly teamSlug: string | null;
  readonly accountSlug: string;
};

function classifyStore(
  type: string | undefined,
): VercelCatalogStore["kind"] {
  const t = (type ?? "").toLowerCase();
  if (t.includes("blob")) return "blob";
  if (t.includes("postgres") || t.includes("neon")) return "postgres";
  if (t.includes("edge")) return "edge-config";
  if (t.includes("kv") || t.includes("redis") || t.includes("upstash")) {
    return "kv";
  }
  return "other";
}

async function fetchJson(args: {
  readonly token: string;
  readonly path: string;
  readonly teamId: string | null;
  readonly query?: Record<string, string>;
}): Promise<{ readonly ok: true; readonly status: number; readonly body: unknown } | { readonly ok: false; readonly status: number; readonly forbidden: boolean }> {
  const url = new URL(`${VERCEL_API}${args.path}`);
  if (args.teamId) url.searchParams.set("teamId", args.teamId);
  for (const [key, value] of Object.entries(args.query ?? {})) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${args.token}` },
    cache: "no-store",
  });
  if (response.status === 403) {
    return { ok: false, status: 403, forbidden: true };
  }
  if (!response.ok) {
    return { ok: false, status: response.status, forbidden: false };
  }
  return { ok: true, status: response.status, body: await response.json() };
}

async function listDomainsForAccount(args: {
  readonly token: string;
  readonly account: AccountScope;
}): Promise<{
  readonly items: VercelCatalogDomain[];
  readonly truncated: boolean;
  readonly forbidden: boolean;
}> {
  const items: VercelCatalogDomain[] = [];
  let until: number | null = null;
  let truncated = false;

  for (let page = 1; page <= RESOURCES_MAX_PAGES; page += 1) {
    const result = await fetchJson({
      token: args.token,
      path: "/v5/domains",
      teamId: args.account.teamId,
      query: {
        limit: String(RESOURCES_PER_PAGE),
        ...(until != null ? { until: String(until) } : {}),
      },
    });
    if (!result.ok) {
      if (result.forbidden) return { items, truncated: false, forbidden: true };
      throw new Error(`Vercel list domains failed (${result.status}).`);
    }
    const body = result.body as {
      domains?: Array<{
        name?: string;
        verified?: boolean;
        serviceType?: string;
        expiresAt?: number | null;
      }>;
      pagination?: { next?: number | null };
    };
    for (const domain of body.domains ?? []) {
      const name = domain.name?.trim();
      if (!name) continue;
      items.push({
        name,
        verified: domain.verified === true,
        serviceType:
          typeof domain.serviceType === "string" ? domain.serviceType : null,
        expiresAt:
          typeof domain.expiresAt === "number" ? domain.expiresAt : null,
        teamId: args.account.teamId,
        teamName: args.account.teamName,
        teamSlug: args.account.teamSlug,
        dashboardUrl: vercelDashboardPath({
          accountSlug: args.account.accountSlug,
          path: `/~/domains/${name}`,
        }),
      });
    }
    const next =
      typeof body.pagination?.next === "number" ? body.pagination.next : null;
    if (next == null) return { items, truncated, forbidden: false };
    until = next;
    if (page === RESOURCES_MAX_PAGES) truncated = true;
  }

  return { items, truncated, forbidden: false };
}

async function listIntegrationsForAccount(args: {
  readonly token: string;
  readonly account: AccountScope;
}): Promise<{
  readonly items: VercelCatalogIntegration[];
  readonly truncated: boolean;
  readonly forbidden: boolean;
}> {
  const result = await fetchJson({
    token: args.token,
    path: "/v1/integrations/configurations",
    teamId: args.account.teamId,
    query: { view: "account" },
  });
  if (!result.ok) {
    if (result.forbidden) return { items: [], truncated: false, forbidden: true };
    // Some personal accounts return 404 when empty — treat as none.
    if (result.status === 404) {
      return { items: [], truncated: false, forbidden: false };
    }
    throw new Error(`Vercel list integrations failed (${result.status}).`);
  }

  const rows = Array.isArray(result.body)
    ? (result.body as Array<{
        id?: string;
        slug?: string;
        status?: string;
        source?: string;
        installationType?: string;
        projects?: string[];
        integration?: { name?: string };
        deletedAt?: number | null;
      }>)
    : [];

  const items: VercelCatalogIntegration[] = [];
  for (const row of rows) {
    if (row.deletedAt != null) continue;
    const id = row.id?.trim();
    const slug = row.slug?.trim();
    if (!id || !slug) continue;
    const name =
      (typeof row.integration?.name === "string" && row.integration.name.trim()
        ? row.integration.name.trim()
        : null) ?? slug;
    items.push({
      id,
      slug,
      name,
      status: typeof row.status === "string" && row.status ? row.status : "ready",
      source: typeof row.source === "string" ? row.source : null,
      installationType:
        typeof row.installationType === "string" ? row.installationType : null,
      projectCount: Array.isArray(row.projects) ? row.projects.length : null,
      teamId: args.account.teamId,
      teamName: args.account.teamName,
      teamSlug: args.account.teamSlug,
      dashboardUrl: vercelDashboardPath({
        accountSlug: args.account.accountSlug,
        path: `/~/integrations/${encodeURIComponent(id)}`,
      }),
    });
  }

  items.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return { items, truncated: false, forbidden: false };
}

async function listStoresForAccount(args: {
  readonly token: string;
  readonly account: AccountScope;
}): Promise<{
  readonly items: VercelCatalogStore[];
  readonly truncated: boolean;
  readonly forbidden: boolean;
}> {
  const result = await fetchJson({
    token: args.token,
    path: "/v1/storage/stores",
    teamId: args.account.teamId,
  });
  if (!result.ok) {
    if (result.forbidden) return { items: [], truncated: false, forbidden: true };
    if (result.status === 404) {
      return { items: [], truncated: false, forbidden: false };
    }
    throw new Error(`Vercel list storage failed (${result.status}).`);
  }

  const body = result.body as {
    stores?: Array<{
      id?: string;
      name?: string;
      type?: string;
      status?: string | null;
      region?: string;
    }>;
  };

  const items: VercelCatalogStore[] = [];
  for (const store of body.stores ?? []) {
    const id = store.id?.trim();
    if (!id) continue;
    const name =
      typeof store.name === "string" && store.name.trim()
        ? store.name.trim()
        : id;
    items.push({
      id,
      name,
      kind: classifyStore(store.type),
      status: typeof store.status === "string" ? store.status : null,
      region: typeof store.region === "string" ? store.region : null,
      teamId: args.account.teamId,
      teamName: args.account.teamName,
      teamSlug: args.account.teamSlug,
      dashboardUrl: vercelDashboardPath({
        accountSlug: args.account.accountSlug,
        path: `/~/stores/${encodeURIComponent(id)}`,
      }),
    });
  }

  items.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  const truncated = items.length >= RESOURCES_PER_PAGE * RESOURCES_MAX_PAGES;
  return { items, truncated, forbidden: false };
}

/** Domains, integrations, and storage across the personal account and each team. */
export async function listAllVercelResources(args: {
  readonly userId: string;
}): Promise<VercelResourcesCatalog> {
  let token: string;
  try {
    token = await getVercelUserToken(args.userId);
  } catch {
    return {
      connected: false,
      domains: [],
      integrations: [],
      stores: [],
      message: "Connect Vercel in Settings to see domains, integrations, and storage.",
    };
  }

  const context = await resolveVercelGrantContext({ token });
  if (!context.connected) {
    return {
      connected: false,
      domains: [],
      integrations: [],
      stores: [],
      message: context.message,
    };
  }

  const domains: VercelCatalogDomain[] = [];
  const integrations: VercelCatalogIntegration[] = [];
  const stores: VercelCatalogStore[] = [];
  const skippedTeams: VercelSkippedTeam[] = [];
  const truncated = { domains: false, integrations: false, stores: false };

  const accounts: AccountScope[] = [
    {
      teamId: null,
      teamName: null,
      teamSlug: null,
      accountSlug: context.username,
    },
    ...context.teams.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      teamSlug: team.slug,
      accountSlug: team.slug,
    })),
  ];

  for (const account of accounts) {
    const [domainResult, integrationResult, storeResult] = await Promise.all([
      listDomainsForAccount({ token: context.token, account }),
      listIntegrationsForAccount({ token: context.token, account }),
      listStoresForAccount({ token: context.token, account }),
    ]);

    const forbidden =
      domainResult.forbidden ||
      integrationResult.forbidden ||
      storeResult.forbidden;
    if (
      account.teamId &&
      forbidden &&
      domainResult.items.length === 0 &&
      integrationResult.items.length === 0 &&
      storeResult.items.length === 0
    ) {
      skippedTeams.push({
        id: account.teamId,
        name: account.teamName ?? account.accountSlug,
        slug: account.teamSlug ?? account.accountSlug,
        reason: "Forbidden (403)",
      });
      continue;
    }

    domains.push(...domainResult.items);
    integrations.push(...integrationResult.items);
    stores.push(...storeResult.items);
    truncated.domains = truncated.domains || domainResult.truncated;
    truncated.integrations =
      truncated.integrations || integrationResult.truncated;
    truncated.stores = truncated.stores || storeResult.truncated;
  }

  domains.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  integrations.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  stores.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  return {
    connected: true,
    username: context.username,
    teams: context.teams,
    domains,
    integrations,
    stores,
    skippedTeams,
    truncated,
  };
}
