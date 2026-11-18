import { randomUUID } from "node:crypto";
import { networkInterfaces } from "node:os";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { anonymous, bearer } from "better-auth/plugins";
import { reassignAnonymousUserData } from "@/lib/auth/link-anonymous-user";
import { getAppUrlHost, getEffectiveAppUrl } from "@/lib/auth-url";
import { db } from "@/lib/db/client";
import {
  sendPasswordResetEmail,
  sendVerificationLinkEmail,
} from "@/lib/email/resend";

/** Dev-only: phone → Mac LAN IP:3000 must be an allowed better-auth host. */
function localLanAgentHosts(): string[] {
  if (process.env.NODE_ENV === "production") return [];
  try {
    const hosts: string[] = [];
    for (const addrs of Object.values(networkInterfaces())) {
      for (const addr of addrs ?? []) {
        if (addr.family === "IPv4" && !addr.internal) {
          hosts.push(`${addr.address}:3000`, `${addr.address}:3001`);
        }
      }
    }
    return hosts;
  } catch {
    return [];
  }
}

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
//
// Production also trusts the canonical app origin so the native phone app can
// send Origin: <EXPO_PUBLIC_AGENT_URL> on auth calls (native fetch has none).
const productionTrustedOrigins = [
  authBaseUrl,
  process.env.BETTER_AUTH_URL?.trim()
    ? `https://${getAppUrlHost(process.env.BETTER_AUTH_URL)}`
    : null,
  "https://my-agent-pi-eight.vercel.app",
  "https://pearl.tonicagentic.com",
  // Companion apps (shared account)
  process.env.FINANCE_APP_URL?.trim() || null,
  "pearlmoney://",
  "pearlmoney://*",
  "pearltasks://",
  "pearltasks://*",
  "pearlbody://",
  "pearlbody://*",
].filter((origin, index, list): origin is string => {
  if (!origin) return false;
  // Custom schemes are not valid URL origins; keep them as-is.
  if (origin.includes("://") && !/^https?:\/\//i.test(origin)) {
    return list.indexOf(origin) === index;
  }
  try {
    const normalized = new URL(origin).origin;
    return list.findIndex((entry) => {
      try {
        return entry != null && new URL(entry).origin === normalized;
      } catch {
        return false;
      }
    }) === index;
  } catch {
    return false;
  }
});

const trustedOrigins =
  process.env.NODE_ENV === "production"
    ? productionTrustedOrigins
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
        "pearlmoney://",
        "pearlmoney://*",
        "pearltasks://",
        "pearltasks://*",
        "pearlbody://",
        "pearlbody://*",
        "exp://",
        "exp://**",
      ];
const allowedHosts = [
  "localhost:3000",
  "localhost:3001",
  "127.0.0.1:3000",
  "127.0.0.1:3001",
  ...localLanAgentHosts(),
  "*.vercel.app",
  "pearl.tonicagentic.com",
  "my-agent-pi-eight.vercel.app",
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
  // Native clients (iOS URLSession via expo/fetch) send Origin: null, which
  // better-auth rejects with MISSING_OR_NULL_ORIGIN. Disabled outside
  // production only: the check protects browser sessions. Production keeps
  // CSRF; /api/auth stamps the canonical origin for opaque native requests
  // (see lib/auth-native-origin.ts) so they match trustedOrigins above.
  advanced: {
    disableCSRFCheck: process.env.NODE_ENV !== "production",
    database: {
      generateId: () => randomUUID(),
    },
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
    // Fire-and-forget so timing attacks cannot infer whether the email exists;
    // Better Auth already runs this via runInBackgroundOrAwait.
    sendResetPassword: async ({ user, url }) => {
      void sendPasswordResetEmail({ to: user.email, url }).catch((error) => {
        console.error("[auth] failed to send password reset email", error);
      });
    },
  },
  user: {
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        void sendVerificationLinkEmail({
          to: user.email,
          url,
          subject: `Confirm email change to ${newEmail}`,
        }).catch((error) => {
          console.error("[auth] failed to send change-email confirmation", error);
        });
      },
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      void sendVerificationLinkEmail({
        to: user.email,
        url,
        subject: "Verify your Pearl email",
      }).catch((error) => {
        console.error("[auth] failed to send verification email", error);
      });
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
  plugins: [
    anonymous({
      emailDomainName: "anonymous.pearl.local",
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        await reassignAnonymousUserData({
          fromUserId: anonymousUser.user.id,
          toUserId: newUser.user.id,
        });
      },
    }),
    bearer(),
    nextCookies(),
  ],
});
