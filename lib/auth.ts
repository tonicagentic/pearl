import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getAppUrlHost, getEffectiveAppUrl } from "@/lib/auth-url";
import { db } from "@/lib/db/client";

const vercelClientId = process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID?.trim() ?? "";
const vercelClientSecret = process.env.VERCEL_APP_CLIENT_SECRET?.trim() ?? "";
const betterAuthSecret = process.env.BETTER_AUTH_SECRET?.trim();
const vercelProviderConfigured = Boolean(betterAuthSecret && vercelClientId && vercelClientSecret);
const authBaseUrl = getEffectiveAppUrl();
const authProtocol = new URL(authBaseUrl).protocol === "https:" ? "https" : "http";

// Local-device testing (the phone on the LAN, Expo Go) signs in from origins
// like http://192.168.0.250:3000 (or the Metro dev-server origin on :8081).
// better-auth's origin check rejects anything not in trustedOrigins, so
// development additionally trusts private-LAN http origins on any port; the
// wildcard list never applies to production (NODE_ENV gate).
const trustedOrigins =
  process.env.NODE_ENV === "production"
    ? undefined
    : [
        "http://localhost:*",
        "http://127.0.0.1:*",
        "http://10.*:*",
        "http://172.16.*:*",
        "http://172.17.*:*",
        "http://172.18.*:*",
        "http://172.19.*:*",
        "http://172.20.*:*",
        "http://172.21.*:*",
        "http://172.22.*:*",
        "http://172.23.*:*",
        "http://172.24.*:*",
        "http://172.25.*:*",
        "http://172.26.*:*",
        "http://172.27.*:*",
        "http://172.28.*:*",
        "http://172.29.*:*",
        "http://172.30.*:*",
        "http://172.31.*:*",
        "http://192.168.*:*",
      ];
const allowedHosts = [
  "localhost:3000",
  "localhost:3001",
  "127.0.0.1:3000",
  "127.0.0.1:3001",
  "*.vercel.app",
  getAppUrlHost(process.env.BETTER_AUTH_URL),
  getAppUrlHost(process.env.VERCEL_PROJECT_PRODUCTION_URL),
  getAppUrlHost(process.env.VERCEL_URL),
].filter((host): host is string => Boolean(host));

export const auth = betterAuth({
  baseURL: {
    allowedHosts,
    fallback: authBaseUrl,
    protocol: authProtocol,
  },
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  account: {
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      trustedProviders: ["vercel"],
      allowDifferentEmails: true,
    },
  },
  secret: betterAuthSecret ?? "eve-chat-template-unconfigured-secret",
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    // Accounts are provisioned with scripts/create-user.mjs; public
    // registration stays closed.
    disableSignUp: true,
  },
  advanced: {
    database: {
      generateId: () => randomUUID(),
    },
  },
  onAPIError: {
    errorURL: "/auth/error",
  },
  socialProviders: vercelProviderConfigured
    ? {
        vercel: {
          clientId: vercelClientId,
          clientSecret: vercelClientSecret,
          overrideUserInfoOnSignIn: true,
          scope: ["openid", "email", "profile"],
        },
      }
    : {},
  plugins: [nextCookies()],
});
