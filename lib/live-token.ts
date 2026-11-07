/**
 * Voice-first realtime model. Live mode is audio by default; camera frames are
 * optional. Gemini live was tried earlier but pairing it with Gateway ZDR mint
 * options produced WebSocket auth failures.
 */
export const LIVE_MODEL_ID = "openai/gpt-realtime-mini";

/** Gateway client-secret lifetime (seconds). Default is 60; max is 300. */
export const LIVE_TOKEN_TTL_SECONDS = 300;

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
    return "Live mode is not available under the current data policy.";
  }
  // Realtime client secrets cannot be minted with OIDC alone.
  if (/gateway api key|client secrets can only be minted/i.test(message)) {
    return "Live sessions need an AI Gateway API key on the server.";
  }
  return "Could not start the live session.";
}

function liveWebSocketUrl(modelId: string): string {
  const url = new URL("wss://ai-gateway.vercel.sh/v4/ai/realtime-model");
  url.searchParams.set("ai-model-id", modelId);
  return url.toString();
}

type ClientSecretResponse = {
  readonly token?: unknown;
  readonly expiresAt?: unknown;
  readonly error?: { readonly message?: unknown };
};

/**
 * Mint a short-lived realtime client secret.
 *
 * Prefer a plain mint: `providerOptions.gateway.zeroDataRetention` on this
 * endpoint returns a `vcst_` the WebSocket then rejects (close 1006). The AI
 * SDK `getToken` helper also does not forward providerOptions yet.
 */
export async function mintLiveToken(): Promise<LiveToken> {
  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Client secrets can only be minted with a Gateway API key");
  }

  const response = await fetch(
    "https://ai-gateway.vercel.sh/v1/realtime/client-secrets",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: LIVE_MODEL_ID,
        expiresIn: LIVE_TOKEN_TTL_SECONDS,
      }),
    },
  );

  const body = (await response.json().catch(() => null)) as
    | ClientSecretResponse
    | null;

  if (!response.ok) {
    const message =
      body && typeof body.error?.message === "string"
        ? body.error.message
        : `Gateway mint failed (${response.status})`;
    throw new Error(message);
  }

  if (!body || typeof body.token !== "string") {
    throw new Error("Gateway mint returned no client secret");
  }

  return {
    token: body.token,
    url: liveWebSocketUrl(LIVE_MODEL_ID),
    ...(typeof body.expiresAt === "number"
      ? { expiresAt: body.expiresAt }
      : {}),
  };
}
