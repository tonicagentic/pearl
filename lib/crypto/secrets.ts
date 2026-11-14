import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export class SecretCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretCryptoError";
  }
}

/**
 * Resolve the AES-256 key for encrypting user CalDAV credentials.
 * Accepts 32 raw bytes as base64 or 64-char hex.
 */
export function resolveCredentialsKey(
  env: NodeJS.ProcessEnv = process.env,
): Buffer {
  const raw = env.ICLOUD_CALDAV_CREDENTIALS_KEY?.trim();
  if (!raw) {
    throw new SecretCryptoError(
      "ICLOUD_CALDAV_CREDENTIALS_KEY is not configured.",
    );
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  try {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === KEY_LENGTH) return decoded;
  } catch {
    // Fall through.
  }

  throw new SecretCryptoError(
    "ICLOUD_CALDAV_CREDENTIALS_KEY must be 32 bytes (base64) or 64 hex chars.",
  );
}

export function credentialsKeyConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  try {
    resolveCredentialsKey(env);
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypt a UTF-8 secret. Output is base64(iv || authTag || ciphertext).
 */
export function encryptSecret(
  plaintext: string,
  keyId = "v1",
  env: NodeJS.ProcessEnv = process.env,
): { ciphertext: string; keyId: string } {
  const key = resolveCredentialsKey(env);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return { ciphertext: packed.toString("base64"), keyId };
}

/** Decrypt a value produced by {@link encryptSecret}. */
export function decryptSecret(
  ciphertext: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const key = resolveCredentialsKey(env);
  let packed: Buffer;
  try {
    packed = Buffer.from(ciphertext, "base64");
  } catch {
    throw new SecretCryptoError("Invalid ciphertext encoding.");
  }
  if (packed.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new SecretCryptoError("Ciphertext is too short.");
  }
  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const data = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  try {
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    throw new SecretCryptoError("Could not decrypt secret.");
  }
}

/** Constant-time string compare for optional verification helpers. */
export function safeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
