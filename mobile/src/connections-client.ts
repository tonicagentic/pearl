import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

export type ConnectionStatus = {
  id: "vercel" | "github" | "neon" | "notion" | "linear" | "sentry";
  label: string;
  status: "unavailable" | "available" | "unknown" | "connected" | "not-connected";
  detail?: string;
};

async function request(path: "status" | "authorize", method: "GET" | "POST", id?: ConnectionStatus["id"], deviceCode = false) {
  const credential = getAuthCookie();
  const response = await fetch(`${AGENT_URL}/api/connections/${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(credential ? { authorization: `Bearer ${credential}` } : {}),
    },
    ...(id ? { body: JSON.stringify({ id, ...(deviceCode ? { deviceCode: true } : {}) }) } : {}),
  });
  if (!response.ok) {
    if (response.status === 401) sessionInvalid();
    throw new Error(`Could not ${path === "authorize" ? "start authorization" : "load connection status"} (${response.status}).`);
  }
  return response;
}

export async function getConnections(): Promise<ConnectionStatus[]> {
  const response = await request("status", "GET");
  const data = (await response.json()) as { connections: ConnectionStatus[] };
  return data.connections;
}

export async function checkConnection(id: ConnectionStatus["id"]): Promise<ConnectionStatus> {
  const response = await request("status", "POST", id);
  const data = (await response.json()) as { connection: ConnectionStatus };
  return data.connection;
}

export async function authorizeConnection(id: ConnectionStatus["id"]): Promise<{ url: string; userCode?: string }> {
  const response = await request("authorize", "POST", id, true);
  return (await response.json()) as { url: string; userCode?: string };
}
