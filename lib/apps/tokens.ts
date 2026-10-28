import { getToken } from "@vercel/connect";

import {
  connectionConfiguration,
  connectionSubjectForUser,
} from "@/lib/connections/catalog";
import { connectionTokenParams } from "@/lib/connections/oauth-scopes";

/**
 * Resolve the signed-in user's GitHub OAuth bearer via Vercel Connect.
 * Tokens stay in the app runtime — never passed into the sandbox.
 */
export async function getGithubUserToken(userId: string): Promise<string> {
  const connector = connectionConfiguration("github").connector;
  if (!connector) {
    throw new Error(
      "GitHub is not configured. Attach GITHUB_CONNECTOR, then connect GitHub in Settings.",
    );
  }
  return getToken(connector, {
    subject: connectionSubjectForUser(userId),
    ...connectionTokenParams("github"),
  });
}

/** Resolve the signed-in user's Vercel OAuth bearer via Vercel Connect. */
export async function getVercelUserToken(userId: string): Promise<string> {
  const connector = connectionConfiguration("vercel").connector;
  if (!connector) {
    throw new Error(
      "Vercel is not configured. Attach VERCEL_CONNECTOR, then connect Vercel in Settings.",
    );
  }
  return getToken(connector, {
    subject: connectionSubjectForUser(userId),
  });
}
