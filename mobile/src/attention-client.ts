// Heartbeat the phone's foreground/background state for push alert gating.

import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

export type AttentionHeartbeat = {
  readonly clientKey: string;
  readonly state: "active" | "background";
  readonly chatId?: string | null;
  readonly sessionId?: string | null;
};

/**
 * Report this device's attention. Failures are swallowed — gating is
 * best-effort and a missed heartbeat only means alerts still fire.
 */
export async function postMobileAttention(
  input: AttentionHeartbeat,
  credential?: string | null,
): Promise<void> {
  const clientKey = input.clientKey.trim();
  if (!clientKey) {
    return;
  }

  const token = credential ?? getAuthCookie();
  try {
    const response = await fetch(`${AGENT_URL}/api/attention`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        surface: "mobile",
        clientKey,
        state: input.state,
        chatId: input.chatId ?? null,
        sessionId: input.sessionId ?? null,
      }),
    });
    if (response.status === 401) {
      sessionInvalid();
      return;
    }
  } catch {
    // Offline / transient — next tick or AppState change will retry.
  }
}
