import { createHash } from "node:crypto";
import { importJWK, jwtVerify } from "jose";
import { getEffectiveAppUrl } from "@/lib/auth-url";
import { getPlaidClient, plaidConfigured } from "@/lib/finance/plaid";

const PLAID_WEBHOOK_PATH = "/api/v1/plaid/webhook";

/** Public webhook URL for Link + item.updateWebhook. */
export function getPlaidWebhookUrl(): string | null {
  const explicit = process.env.PLAID_WEBHOOK_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const base = getEffectiveAppUrl().replace(/\/$/, "");
  if (!base || base.includes("localhost")) {
    // Plaid cannot reach localhost; set PLAID_WEBHOOK_URL (or deploy) for production.
    return process.env.VERCEL_ENV === "production" ||
      process.env.NODE_ENV === "production"
      ? `${base}${PLAID_WEBHOOK_PATH}`
      : null;
  }
  return `${base}${PLAID_WEBHOOK_PATH}`;
}

/**
 * Best-effort: point this Item at our webhook so SYNC_UPDATES_AVAILABLE can complete Refresh.
 */
export async function ensurePlaidItemWebhook(accessToken: string) {
  const webhook = getPlaidWebhookUrl();
  if (!webhook || !plaidConfigured()) return;
  try {
    const client = getPlaidClient();
    await client.item.updateWebhook({
      access_token: accessToken,
      webhook,
    });
  } catch (err) {
    console.warn(
      "[plaid] item.updateWebhook failed",
      err instanceof Error ? err.message : err,
    );
  }
}

type CachedKey = { jwk: JsonWebKey; expiresAt: number };
const jwkCache = new Map<string, CachedKey>();

async function getPlaidVerificationJwk(keyId: string): Promise<JsonWebKey> {
  const cached = jwkCache.get(keyId);
  if (cached && cached.expiresAt > Date.now()) return cached.jwk;

  const client = getPlaidClient();
  const res = await client.webhook.getVerificationKey({ key_id: keyId });
  const jwk = res.key as JsonWebKey;
  jwkCache.set(keyId, { jwk, expiresAt: Date.now() + 60 * 60 * 1000 });
  return jwk;
}

/**
 * Verify `Plaid-Verification` JWT per Plaid docs (iat max age + body SHA-256).
 */
export async function verifyPlaidWebhookRequest(input: {
  bodyText: string;
  plaidVerification: string | null;
}): Promise<boolean> {
  if (!plaidConfigured()) return false;
  const token = input.plaidVerification?.trim();
  if (!token) return false;

  try {
    const [headerB64] = token.split(".");
    if (!headerB64) return false;
    const headerJson = Buffer.from(headerB64, "base64url").toString("utf8");
    const header = JSON.parse(headerJson) as { kid?: string; alg?: string };
    if (!header.kid || header.alg !== "ES256") return false;

    const jwk = await getPlaidVerificationJwk(header.kid);
    const key = await importJWK(jwk, "ES256");
    const { payload } = await jwtVerify(token, key, {
      maxTokenAge: "5 min",
    });

    const claimed =
      typeof payload.request_body_sha256 === "string"
        ? payload.request_body_sha256
        : null;
    if (!claimed) return false;

    const actual = createHash("sha256").update(input.bodyText).digest("hex");
    return claimed === actual;
  } catch (err) {
    console.warn(
      "[plaid/webhook] verification failed",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}
