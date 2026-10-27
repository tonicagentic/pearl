// Connections client for the mobile app: hits the web app's
// /api/connections routes with the same better-auth credential the eve
// transport uses, so grants stay keyed to the signed-in principal.

import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

export type ConnectionId =
  | "gmail"
  | "calendar"
  | "drive"
  | "github"
  | "vercel"
  | "xero"
  | "notion"
  | "linear"
  | "sentry";

export type ConnectionStatus = {
  id: ConnectionId;
  label: string;
  status:
    | "unavailable"
    | "available"
    | "unknown"
    | "connected"
    | "not-connected";
  detail?: string;
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

export async function getConnections(): Promise<ConnectionStatus[]> {
  const response = await fetch(`${AGENT_URL}/api/connections/status`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    await parseError(response, "Could not load connection status");
  }
  const data = (await response.json()) as { connections: ConnectionStatus[] };
  return data.connections;
}

export async function checkConnection(
  id: ConnectionId,
): Promise<ConnectionStatus> {
  const response = await fetch(`${AGENT_URL}/api/connections/status`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ id }),
  });
  if (!response.ok) {
    await parseError(response, "Could not check connection status");
  }
  const data = (await response.json()) as { connection: ConnectionStatus };
  return data.connection;
}

export async function authorizeConnection(
  id: ConnectionId,
): Promise<{ url: string; userCode?: string }> {
  const response = await fetch(`${AGENT_URL}/api/connections/authorize`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ id, deviceCode: true }),
  });
  if (!response.ok) {
    await parseError(response, "Could not start authorization");
  }
  return (await response.json()) as { url: string; userCode?: string };
}

export async function revokeConnection(
  id: ConnectionId,
): Promise<ConnectionStatus> {
  const response = await fetch(`${AGENT_URL}/api/connections/revoke`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ id }),
  });
  if (!response.ok) {
    await parseError(response, "Could not disconnect");
  }
  const data = (await response.json()) as { connection: ConnectionStatus };
  return data.connection;
}
