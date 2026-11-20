import { importPKCS8, SignJWT } from "jose";

/**
 * Apple Sign In expects a short-lived ES256 JWT as the OAuth client secret
 * (max ~6 months). Regenerated on each better-auth config load.
 */
export async function generateAppleClientSecret(params: {
  readonly clientId: string;
  readonly teamId: string;
  readonly keyId: string;
  readonly privateKey: string;
}): Promise<string> {
  const pem = params.privateKey.includes("\\n")
    ? params.privateKey.replace(/\\n/g, "\n")
    : params.privateKey;
  const key = await importPKCS8(pem, "ES256");
  const now = Math.floor(Date.now() / 1000);
  // Stay under Apple's six-month JWT expiry ceiling.
  const expiresInSeconds = 180 * 24 * 60 * 60;

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: params.keyId })
    .setIssuer(params.teamId)
    .setSubject(params.clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(key);
}
