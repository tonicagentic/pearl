import { CONNECTION_IDS, type ConnectionId } from "../connections/catalog";

/** Connection ids a custom agent may allowlist, plus iCloud calendar accounts. */
export const AGENT_INTEGRATION_IDS = [...CONNECTION_IDS, "icloud"] as const;

export type AgentIntegrationId = (typeof AGENT_INTEGRATION_IDS)[number];

export const AGENT_INTEGRATION_LABELS: Record<AgentIntegrationId, string> = {
  gmail: "Gmail",
  calendar: "Google Calendar",
  drive: "Google Drive",
  github: "GitHub",
  vercel: "Vercel",
  expo: "Expo",
  neon: "Neon",
  betterstack: "Better Stack",
  xero: "Xero",
  tempo: "Tempo",
  sheets: "Google Sheets",
  icloud: "iCloud Calendar",
};

export function isAgentIntegrationId(
  value: string,
): value is AgentIntegrationId {
  return (AGENT_INTEGRATION_IDS as readonly string[]).includes(value);
}

export function isConnectionIdIntegration(
  value: AgentIntegrationId,
): value is ConnectionId {
  return (CONNECTION_IDS as readonly string[]).includes(value);
}
