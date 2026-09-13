import type { SetupStatus } from "@/lib/chat/types";
import { isDatabaseConfigured, isDatabaseSchemaReady } from "@/lib/db/client";

const PASSWORD_ENV_KEY = "EVE_CHAT_PASSWORD";
const BETTER_AUTH_SECRET_KEY = "BETTER_AUTH_SECRET";
const VERCEL_AUTH_ENV_KEYS = [
  "NEXT_PUBLIC_VERCEL_APP_CLIENT_ID",
  "VERCEL_APP_CLIENT_SECRET",
] as const;

const CONNECTION_ENV_KEYS = [
  "LINEAR_CONNECTOR",
  "NOTION_CONNECTOR",
  "SENTRY_CONNECTOR",
] as const;

const RATE_LIMIT_ENV_GROUPS = [
  ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
  ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
] as const;

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

export function isVercelAuthConfigured() {
  return (
    hasEnv(BETTER_AUTH_SECRET_KEY) && VERCEL_AUTH_ENV_KEYS.every(hasEnv)
  );
}

// Email/password sign-in only needs the Better Auth secret. Sign-up is
// disabled in lib/auth.ts; accounts are provisioned with
// scripts/create-user.mjs.
export function isEmailAuthConfigured() {
  return hasEnv(BETTER_AUTH_SECRET_KEY);
}

export function isPasswordConfigured() {
  return Boolean(process.env.EVE_CHAT_PASSWORD?.trim());
}

export function isRateLimitConfigured() {
  return RATE_LIMIT_ENV_GROUPS.some((group) => group.every(hasEnv));
}

export function getInitialSetupStatus(): SetupStatus {
  return createSetupStatus({
    databaseSchemaReady: isDatabaseConfigured(),
  });
}

export async function getSetupStatus(): Promise<SetupStatus> {
  const databaseConfigured = isDatabaseConfigured();
  const betterAuthReady = isVercelAuthConfigured() || isEmailAuthConfigured();
  // Local development does not require Upstash; enforceRateLimit no-ops when
  // Redis is not configured.
  const fullEnvironmentReady =
    databaseConfigured &&
    betterAuthReady &&
    (isRateLimitConfigured() || isLocalDevelopment());
  const databaseSchemaReady = fullEnvironmentReady
    ? await isDatabaseSchemaReady()
    : false;

  return createSetupStatus({ databaseSchemaReady });
}

export async function isAppConfigured() {
  const status = await getSetupStatus();

  return status.appReady;
}

function createSetupStatus({
  databaseSchemaReady,
}: {
  readonly databaseSchemaReady: boolean;
}): SetupStatus {
  const databaseConfigured = isDatabaseConfigured();
  const vercelAuthReady = isVercelAuthConfigured();
  const betterAuthReady = vercelAuthReady || isEmailAuthConfigured();
  const rateLimitReady = isRateLimitConfigured();
  const localDevReady = isLocalDevelopment();
  const databaseReady = databaseConfigured && databaseSchemaReady;
  const fullEnvironmentReady =
    databaseConfigured && betterAuthReady && (rateLimitReady || localDevReady);
  const passwordReady = isPasswordConfigured();
  const connectionsAvailable =
    localDevReady || CONNECTION_ENV_KEYS.some(hasEnv);

  if (fullEnvironmentReady) {
    return {
      appReady: databaseReady,
      authMode: vercelAuthReady ? "vercel" : "email",
      authReady: betterAuthReady,
      connectionsAvailable,
      databaseConfigured,
      databaseReady,
      databaseSchemaReady,
      missing: databaseSchemaReady ? [] : ["database migrations"],
      rateLimitReady,
      storageMode: "database",
    };
  }

  if (passwordReady || localDevReady) {
    return {
      appReady: true,
      authMode: passwordReady ? "password" : "local-dev",
      authReady: true,
      connectionsAvailable,
      databaseConfigured,
      databaseReady,
      databaseSchemaReady,
      missing: [],
      rateLimitReady,
      storageMode: "browser",
    };
  }

  return {
    appReady: false,
    authMode: "unconfigured",
    authReady: false,
    connectionsAvailable,
    databaseConfigured,
    databaseReady,
    databaseSchemaReady,
    missing: [
      PASSWORD_ENV_KEY,
      "or DATABASE_URL, BETTER_AUTH_SECRET, and Upstash configuration",
    ],
    rateLimitReady,
    storageMode: "browser",
  };
}

function isLocalDevelopment() {
  return process.env.NODE_ENV === "development" && process.env.VERCEL !== "1";
}
