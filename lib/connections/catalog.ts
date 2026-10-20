// Public connection names and server-only setup requirements. Credentials and
// connector UIDs never leave the server through the status endpoint.
export const CONNECTION_IDS = ["vercel", "github", "neon", "notion", "linear", "sentry"] as const;
export type ConnectionId = (typeof CONNECTION_IDS)[number];
export type ConnectionState =
  | "unavailable"
  | "available"
  | "unknown"
  | "connected"
  | "not-connected";

export type ConnectionStatus = {
  readonly id: ConnectionId;
  readonly label: string;
  readonly status: ConnectionState;
  readonly detail?: string;
};

export type ConnectionConfiguration = {
  readonly id: ConnectionId;
  readonly label: string;
  readonly connector: string | null;
  readonly reason: string;
};

export function connectionConfiguration(
  id: ConnectionId,
  env: NodeJS.ProcessEnv = process.env,
): ConnectionConfiguration {
  if (id === "vercel") {
    const connector = env.VERCEL_CONNECTOR?.trim();
    const pinned = env.VERCEL_MCP_TEAM_ID?.trim() && env.VERCEL_MCP_PROJECT_ID?.trim();
    return {
      id,
      label: "Vercel",
      connector: connector && pinned ? connector : null,
      reason: "A Vercel connector and pinned team/project are required.",
    };
  }
  if (id === "github") {
    return {
      id,
      label: "GitHub",
      connector: env.GITHUB_CONNECTOR?.trim() || null,
      reason: "A GitHub MCP connector has not been configured.",
    };
  }
  if (id === "notion" || id === "linear" || id === "sentry") {
    // Match the existing static eve definitions' fallback connector names.
    const connector = env[`${id.toUpperCase()}_CONNECTOR`]?.trim() || id;
    return {
      id,
      label: id === "notion" ? "Notion" : id === "linear" ? "Linear" : "Sentry",
      connector,
      reason: "Connector is not attached to this project.",
    };
  }
  // Match the runtime guard in agent/connections/neon.ts. The status route
  // must not advertise a connector that eve will not expose to the agent.
  const production = env.VERCEL_ENV === "production" ||
    (!env.VERCEL_ENV && env.NODE_ENV === "production");
  const connector = env.NEON_CONNECTOR?.trim();
  const project = env.NEON_MCP_PROJECT_ID?.trim();
  const liveProjectId = env.NEON_PROJECT_ID?.trim();
  const role = env.NEON_MCP_ROLE?.trim();
  return {
    id,
    label: "Neon",
    connector: !production && connector && project && role && project !== liveProjectId ? connector : null,
    reason: production
      ? "Neon MCP is disabled in production. Use an isolated development database."
      : project && project === liveProjectId
        ? "The configured Neon project matches this app's database; choose a separate development project."
        : "A non-production Neon project, restricted SQL role, and connector are required.",
  };
}

// The subject must match the user principal emitted by lib/eve-auth.ts.
// Vercel Connect keys durable grants by this identity across devices/restarts.
export function connectionSubjectForUser(userId: string) {
  return { type: "user" as const, id: userId, issuer: "better-auth" };
}

export function isConnectionId(value: unknown): value is ConnectionId {
  return typeof value === "string" && CONNECTION_IDS.some((id) => id === value);
}
