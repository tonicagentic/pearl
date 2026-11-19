"use client";

const STORAGE_KEY = "pearl-attention-client-key";

/** Stable per-tab id for web attention heartbeats. */
export function getWebAttentionClientKey(): string {
  if (typeof window === "undefined") {
    return "ssr";
  }
  try {
    const existing = window.sessionStorage.getItem(STORAGE_KEY);
    if (existing?.trim()) {
      return existing.trim();
    }
    const next =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return `web-ephemeral-${Date.now()}`;
  }
}

export type WebAttentionHeartbeat = {
  readonly state: "active" | "background";
  readonly chatId?: string | null;
  readonly sessionId?: string | null;
};

/**
 * Report this browser tab's attention. Same-origin cookies authenticate.
 * Failures are swallowed — a missed heartbeat only means alerts still fire.
 */
export async function postWebAttention(
  input: WebAttentionHeartbeat,
): Promise<void> {
  try {
    await fetch("/api/attention", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        surface: "web",
        clientKey: getWebAttentionClientKey(),
        state: input.state,
        chatId: input.chatId ?? null,
        sessionId: input.sessionId ?? null,
      }),
      keepalive: input.state === "background",
    });
  } catch {
    // Offline / transient.
  }
}
