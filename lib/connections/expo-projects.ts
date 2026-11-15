/**
 * Expo account + project catalog for the signed-in Connect grant.
 * Uses the same GraphQL endpoint the Expo CLI uses. Tokens stay here —
 * never returned to clients.
 */

import { getExpoUserToken } from "@/lib/connections/tokens";

const EXPO_GRAPHQL = "https://api.expo.dev/graphql";
export const EXPO_APPS_PER_PAGE = 100;
/** Cap across every account (100 × 20 = 2,000). */
export const EXPO_APPS_MAX_PAGES = 20;
export const EXPO_APPS_MAX = EXPO_APPS_PER_PAGE * EXPO_APPS_MAX_PAGES;

export type ExpoCatalogAccount = {
  readonly id: string;
  readonly name: string;
  readonly isPersonal: boolean;
};

export type ExpoCatalogProject = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly fullName: string;
  readonly accountId: string;
  readonly accountName: string;
  readonly dashboardUrl: string;
};

export type ExpoProjectsCatalog =
  | {
      readonly connected: true;
      readonly username: string;
      readonly accounts: readonly ExpoCatalogAccount[];
      readonly projects: readonly ExpoCatalogProject[];
      readonly truncated: boolean;
    }
  | {
      readonly connected: false;
      readonly projects: readonly [];
      readonly truncated: false;
      readonly message: string;
    };

type GraphqlError = {
  readonly message?: string;
  readonly extensions?: { readonly code?: string };
};

type GraphqlOk<T> = { readonly ok: true; readonly data: T };
type GraphqlErr = {
  readonly ok: false;
  readonly status: number;
  readonly message: string;
};
type GraphqlResult<T> = GraphqlOk<T> | GraphqlErr;

async function expoGraphql<T>(args: {
  readonly token: string;
  readonly query: string;
  readonly variables?: Record<string, unknown>;
}): Promise<GraphqlResult<T>> {
  const response = await fetch(EXPO_GRAPHQL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.token}`,
      "content-type": "application/json",
      accept:
        "application/graphql-response+json, application/graphql+json, application/json",
    },
    body: JSON.stringify({
      query: args.query,
      ...(args.variables ? { variables: args.variables } : {}),
    }),
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      status: response.status,
      message:
        "This Expo connection cannot list accounts. Reconnect Expo in Profile → Coder → Expo.",
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: `Expo GraphQL failed (${response.status}).`,
    };
  }

  const body = (await response.json()) as {
    data?: T;
    errors?: GraphqlError[];
  };
  const authError = body.errors?.find((error) => {
    const code = error.extensions?.code?.toUpperCase() ?? "";
    const message = error.message?.toLowerCase() ?? "";
    return (
      code.includes("UNAUTH") ||
      code.includes("FORBIDDEN") ||
      message.includes("unauthorized") ||
      message.includes("not authenticated")
    );
  });
  if (authError) {
    return {
      ok: false,
      status: 401,
      message:
        "This Expo connection cannot list accounts. Reconnect Expo in Profile → Coder → Expo.",
    };
  }
  if (!body.data) {
    const first = body.errors?.[0]?.message?.trim();
    return {
      ok: false,
      status: 502,
      message: first || "Expo GraphQL returned no data.",
    };
  }
  return { ok: true, data: body.data };
}

const ME_QUERY = `
  query PearlExpoMe {
    meUserActor {
      id
      username
      accounts {
        id
        name
      }
    }
  }
`;

const APPS_QUERY = `
  query PearlExpoApps($accountName: String!, $after: String) {
    account {
      byName(accountName: $accountName) {
        id
        name
        appsPaginated(first: ${EXPO_APPS_PER_PAGE}, after: $after) {
          edges {
            node {
              id
              name
              slug
              fullName
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`;

type MeData = {
  meUserActor?: {
    id?: string;
    username?: string;
    accounts?: Array<{ id?: string; name?: string } | null> | null;
  } | null;
};

type AppsPaginated = {
  edges?: Array<{
    node?: {
      id?: string;
      name?: string;
      slug?: string;
      fullName?: string;
    } | null;
  } | null> | null;
  pageInfo?: {
    hasNextPage?: boolean | null;
    endCursor?: string | null;
  } | null;
};

type AppsData = {
  account?: {
    byName?: {
      id?: string;
      name?: string;
      appsPaginated?: AppsPaginated | null;
    } | null;
  } | null;
};

function dashboardUrl(accountName: string, slug: string): string {
  return `https://expo.dev/accounts/${encodeURIComponent(accountName)}/projects/${encodeURIComponent(slug)}`;
}

/** Every Expo account (personal + orgs) and project the grant can see. */
export async function listExpoAccountsAndProjects(args: {
  readonly userId: string;
}): Promise<ExpoProjectsCatalog> {
  let token: string;
  try {
    token = await getExpoUserToken(args.userId);
  } catch {
    return {
      connected: false,
      projects: [],
      truncated: false,
      message: "Connect Expo in Profile → Coder → Expo to see your projects.",
    };
  }

  const me = await expoGraphql<MeData>({ token, query: ME_QUERY });
  if (!me.ok) {
    return {
      connected: false,
      projects: [],
      truncated: false,
      message: me.message,
    };
  }

  const actor = me.data.meUserActor;
  const username = actor?.username?.trim() || "unknown";
  const accounts: ExpoCatalogAccount[] = [];
  for (const account of actor?.accounts ?? []) {
    const id = account?.id?.trim();
    const name = account?.name?.trim();
    if (!id || !name) continue;
    accounts.push({
      id,
      name,
      isPersonal: name === username,
    });
  }
  accounts.sort((a, b) => {
    if (a.isPersonal !== b.isPersonal) return a.isPersonal ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  const projects: ExpoCatalogProject[] = [];
  let truncated = false;
  let pagesUsed = 0;

  for (const account of accounts) {
    if (pagesUsed >= EXPO_APPS_MAX_PAGES) {
      truncated = true;
      break;
    }
    let after: string | null = null;
    for (;;) {
      if (pagesUsed >= EXPO_APPS_MAX_PAGES) {
        truncated = true;
        break;
      }
      pagesUsed += 1;
      const variables: Record<string, unknown> = {
        accountName: account.name,
      };
      if (after) variables.after = after;
      const pageResult: GraphqlResult<AppsData> = await expoGraphql<AppsData>({
        token,
        query: APPS_QUERY,
        variables,
      });
      if (!pageResult.ok) {
        if (pageResult.status === 401 || pageResult.status === 403) {
          return {
            connected: false,
            projects: [],
            truncated: false,
            message: pageResult.message,
          };
        }
        // Skip this account on transient errors; still return what we have.
        break;
      }
      const appsPage: AppsPaginated | null | undefined =
        pageResult.data.account?.byName?.appsPaginated;
      for (const edge of appsPage?.edges ?? []) {
        const node = edge?.node;
        const id = node?.id?.trim();
        const name = node?.name?.trim();
        const slug = node?.slug?.trim();
        if (!id || !name || !slug) continue;
        const fullName =
          node?.fullName?.trim() || `@${account.name}/${slug}`;
        projects.push({
          id,
          name,
          slug,
          fullName,
          accountId: account.id,
          accountName: account.name,
          dashboardUrl: dashboardUrl(account.name, slug),
        });
      }
      const hasNext = appsPage?.pageInfo?.hasNextPage === true;
      const nextCursor = appsPage?.pageInfo?.endCursor?.trim() || null;
      if (!hasNext || !nextCursor) break;
      after = nextCursor;
    }
  }

  if (projects.length > EXPO_APPS_MAX) {
    projects.length = EXPO_APPS_MAX;
    truncated = true;
  }

  return {
    connected: true,
    username,
    accounts,
    projects,
    truncated,
  };
}
