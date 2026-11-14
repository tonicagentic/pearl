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
      "GitHub is not configured. Attach GITHUB_CONNECTOR, then connect GitHub in Settings → GitHub.",
    );
  }
  return getToken(connector, {
    subject: connectionSubjectForUser(userId),
    ...connectionTokenParams("github"),
  });
}

/**
 * Resolve the signed-in user's Gmail OAuth bearer via Vercel Connect, for the
 * REST send call. Prefer {@link getGmailTokenForMailbox} when a mailbox id is
 * known. Requests compose + modify scopes; older grants must re-authorize.
 */
export async function getGmailUserToken(userId: string): Promise<string> {
  const { getGmailTokenForMailbox } = await import("@/lib/mail/accounts");
  const { token } = await getGmailTokenForMailbox(userId);
  return token;
}

/** Resolve the signed-in user's Vercel OAuth bearer via Vercel Connect. */
export async function getVercelUserToken(userId: string): Promise<string> {
  const connector = connectionConfiguration("vercel").connector;
  if (!connector) {
    throw new Error(
      "Vercel is not configured. Attach VERCEL_CONNECTOR, then connect Vercel in Settings → Vercel.",
    );
  }
  return getToken(connector, {
    subject: connectionSubjectForUser(userId),
  });
}
