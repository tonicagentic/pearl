import { getGmailTokenForMailbox } from "@/lib/mail/accounts";
import { isBetterAuthUserPrincipal } from "./user-connection.js";

export async function resolveGmailToken(
  auth: { readonly principalType?: string; readonly issuer?: string; readonly principalId?: string } | null | undefined,
  accountId?: string | null,
): Promise<
  | { readonly ok: true; readonly userId: string; readonly token: string; readonly emailLabel: string | null }
  | { readonly ok: false; readonly error: string }
> {
  if (!isBetterAuthUserPrincipal(auth) || !auth?.principalId) {
    return {
      ok: false,
      error:
        "Sign in with a personal account and connect Gmail in Settings → Email.",
    };
  }
  try {
    const resolved = await getGmailTokenForMailbox(auth.principalId, accountId);
    return {
      ok: true,
      userId: auth.principalId,
      token: resolved.token,
      emailLabel: resolved.mailbox.emailLabel,
    };
  } catch (cause) {
    return {
      ok: false,
      error:
        cause instanceof Error
          ? cause.message
          : "Gmail token unavailable. Connect a mailbox in Settings → Email.",
    };
  }
}
