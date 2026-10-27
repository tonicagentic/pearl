// Public connection names and server-only setup requirements. Credentials and
// connector UIDs never leave the server through the status endpoint.
export const CONNECTION_IDS = [
  "gmail",
  "calendar",
  "drive",
  "github",
  "vercel",
  "xero",
  "notion",
  "linear",
  "sentry",
] as const;

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

const LABELS: Record<ConnectionId, string> = {
  gmail: "Gmail",
  calendar: "Google Calendar",
  drive: "Google Drive",
  github: "GitHub",
  vercel: "Vercel",
  xero: "Xero",
  notion: "Notion",
  linear: "Linear",
  sentry: "Sentry",
};

const OPT_IN_ENV: Partial<Record<ConnectionId, string>> = {
  gmail: "GMAIL_CONNECTOR",
  calendar: "CALENDAR_CONNECTOR",
  drive: "DRIVE_CONNECTOR",
  github: "GITHUB_CONNECTOR",
  vercel: "VERCEL_CONNECTOR",
  xero: "XERO_CONNECTOR",
};

export function connectionConfiguration(
  id: ConnectionId,
  env: NodeJS.ProcessEnv = process.env,
): ConnectionConfiguration {
  const label = LABELS[id];

  if (id === "notion" || id === "linear" || id === "sentry") {
    // Match the existing static eve definitions' fallback connector names.
    const connector = env[`${id.toUpperCase()}_CONNECTOR`]?.trim() || id;
    return {
      id,
      label,
      connector,
      reason: "Connector is not attached to this project.",
    };
  }

  const envKey = OPT_IN_ENV[id];
  const connector = envKey ? env[envKey]?.trim() || null : null;
  return {
    id,
    label,
    connector,
    reason: connector
      ? "Connector is not attached to this project or environment."
      : `A ${label} MCP connector has not been configured.`,
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
