import { gateway } from "ai";

/** Gateway realtime model that advertises visual grounding. Not a text-chat picker id. */
export const LIVE_MODEL_ID = "google/gemini-3.8-live";

export type LiveToken = {
  readonly token: string;
  readonly url: string;
  readonly expiresAt?: number;
};

/**
 * The data-policy refusal is the one failure the live screen should explain.
 * Other mint errors stay generic so a gateway body cannot leak into the client.
 */
export function describeLiveTokenError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/no_providers_available|zero[\s-]?data[\s-]?retention/i.test(message)) {
    return "Live video is not available under the current data policy.";
  }
  return "Could not start the live session.";
}

export async function mintLiveToken(): Promise<LiveToken> {
  const secret = await gateway.experimental_realtime.getToken({
    model: LIVE_MODEL_ID,
  });
  return {
    token: secret.token,
    url: secret.url,
    ...(secret.expiresAt != null ? { expiresAt: secret.expiresAt } : {}),
  };
}
