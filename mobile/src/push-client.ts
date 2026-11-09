// Register / unregister Expo push tokens with the Pearl API.

import { Platform } from "react-native";

import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

function authHeaders(credential?: string | null): Record<string, string> {
  const token = credential ?? getAuthCookie();
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function parseError(response: Response, fallback: string): Promise<never> {
  if (response.status === 401) {
    sessionInvalid();
  }
  let detail = fallback;
  try {
    const data = (await response.json()) as { error?: string };
    if (typeof data.error === "string" && data.error.trim()) {
      detail = data.error;
    }
  } catch {
    // keep fallback
  }
  throw new Error(detail);
}

export async function registerPushToken(
  token: string,
  credential?: string | null,
): Promise<void> {
  const response = await fetch(`${AGENT_URL}/api/push-tokens`, {
    method: "POST",
    headers: authHeaders(credential),
    body: JSON.stringify({
      token,
      platform: Platform.OS,
    }),
  });
  if (!response.ok) {
    await parseError(response, "Could not register push token");
  }
}

export async function unregisterPushToken(
  token: string,
  credential?: string | null,
): Promise<void> {
  const response = await fetch(`${AGENT_URL}/api/push-tokens`, {
    method: "DELETE",
    headers: authHeaders(credential),
    body: JSON.stringify({ token }),
  });
  if (!response.ok && response.status !== 401) {
    await parseError(response, "Could not unregister push token");
  }
}
