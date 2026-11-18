import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function keyBytes() {
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
      throw new Error(
        "ENCRYPTION_KEY is required in production to protect SSNs and bank tokens",
      );
    }
    // Local development only — never used when NODE_ENV=production
    return createHash("sha256")
      .update("dev-only-change-me-32chars-min!!")
      .digest();
  }
  if (raw.length < 32) {
    throw new Error("ENCRYPTION_KEY must be at least 32 characters");
  }
  return createHash("sha256").update(raw).digest();
}

/** Encrypt a secret (e.g. Plaid access token, SSN, document number) for storage. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Invalid encrypted payload");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

/** Last 4 visible characters for UI; empty when missing or undecryptable. */
export function maskSecretLast4(enc: string | null | undefined): string {
  if (!enc) return "";
  try {
    const plain = decryptSecret(enc).replace(/\s+/g, "");
    if (plain.length < 4) return "";
    return plain.slice(-4);
  } catch {
    return "";
  }
}
