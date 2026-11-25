import { getExpoUserToken } from "@/lib/connections/tokens";
import {
  easDashboardUrl,
  easTitle,
  mapEasBuildStatus,
  scrubLogLine,
  type WatchSnapshot,
} from "./deploy.ts";

const EXPO_GRAPHQL = "https://api.expo.dev/graphql";

const BUILD_BY_ID = `
  query PearlWatchBuild($buildId: ID!) {
    builds {
      byId(buildId: $buildId) {
        id
        status
        platform
        buildProfile
        error {
          message
          errorCode
        }
        artifacts {
          buildUrl
        }
        app {
          id
          fullName
          slug
        }
      }
    }
  }
`;

type BuildNode = {
  readonly id?: string;
  readonly status?: string;
  readonly platform?: string;
  readonly buildProfile?: string;
  readonly error?: {
    readonly message?: string | null;
    readonly errorCode?: string | null;
  } | null;
  readonly artifacts?: { readonly buildUrl?: string | null } | null;
  readonly app?: {
    readonly id?: string;
    readonly fullName?: string;
    readonly slug?: string;
  } | null;
};

/**
 * Fetch a live EAS build snapshot for the signed-in user.
 * Logs are only attached when the build has finished (Expo rule).
 */
export async function fetchEasWatch(args: {
  readonly userId: string;
  readonly buildId: string;
  readonly includeLogs?: boolean;
}): Promise<WatchSnapshot> {
  const buildId = args.buildId.trim();
  if (!buildId) {
    return {
      provider: "eas",
      state: "error",
      title: "EAS build",
      target: "eas",
      error: "Missing buildId.",
    };
  }

  let token: string;
  try {
    token = await getExpoUserToken(args.userId);
  } catch {
    return {
      provider: "eas",
      state: "error",
      title: "EAS build",
      target: "eas",
      buildId,
      error: "Connect Expo in Profile → Coder → Expo.",
    };
  }

  const response = await fetch(EXPO_GRAPHQL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept:
        "application/graphql-response+json, application/graphql+json, application/json",
    },
    body: JSON.stringify({
      query: BUILD_BY_ID,
      variables: { buildId },
    }),
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    return {
      provider: "eas",
      state: "error",
      title: "EAS build",
      target: "eas",
      buildId,
      error: "Expo authorization failed. Reconnect Expo.",
    };
  }

  if (!response.ok) {
    return {
      provider: "eas",
      state: "error",
      title: "EAS build",
      target: "eas",
      buildId,
      error: `Expo GraphQL failed (${response.status}).`,
    };
  }

  const body = (await response.json()) as {
    data?: { builds?: { byId?: BuildNode | null } | null };
    errors?: Array<{ message?: string }>;
  };

  const node = body.data?.builds?.byId;
  if (!node) {
    const first = body.errors?.[0]?.message?.trim();
    return {
      provider: "eas",
      state: "error",
      title: "EAS build",
      target: "eas",
      buildId,
      error: first || "Build not found.",
    };
  }

  const state = mapEasBuildStatus(node.status);
  const platform = node.platform ?? null;
  const profile = node.buildProfile ?? null;
  const fullName = node.app?.fullName ?? null;
  const url = node.artifacts?.buildUrl?.trim() || null;
  const errorMessage = node.error?.message?.trim()
    ? scrubLogLine(node.error.message.trim())
    : null;

  let logs: readonly string[] | undefined;
  if (
    args.includeLogs &&
    (state === "ready" || state === "error" || state === "canceled")
  ) {
    // Expo only exposes build logs after completion. Best-effort: surface the
    // error message as a one-line log when present.
    logs = errorMessage ? [errorMessage] : [];
  }

  return {
    provider: "eas",
    state,
    title: easTitle({ platform, profile }),
    target: [platform, profile].filter(Boolean).join(" / ") || "eas",
    url,
    dashboardUrl: easDashboardUrl({
      buildId: node.id ?? buildId,
      projectFullName: fullName,
    }),
    buildId: node.id ?? buildId,
    projectId: node.app?.id ?? null,
    ...(errorMessage ? { error: errorMessage } : {}),
    ...(logs ? { logs } : {}),
  };
}
