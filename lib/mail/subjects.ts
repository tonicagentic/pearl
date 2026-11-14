/** Stable, non-secret connection name for a mailbox MCP instance. */
export function gmailConnectionSlug(account: {
  readonly id: string;
  readonly emailLabel: string | null;
}): string {
  const email = account.emailLabel?.trim().toLowerCase();
  if (email && /^[a-z0-9.@_+-]+$/i.test(email)) {
    return `gmail_${email.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "")}`;
  }
  return `gmail_${account.id.replace(/-/g, "").slice(0, 12)}`;
}

/** Connect subject id for a non-legacy mailbox. */
export function mailboxSubjectId(userId: string, mailboxId: string): string {
  return `${userId}:gmail:${mailboxId}`;
}

/** True when this subject is the legacy single-grant subject (user id alone). */
export function isLegacyMailboxSubject(
  userId: string,
  subjectId: string,
): boolean {
  return subjectId === userId;
}

/**
 * Build the Connect token subject for a mailbox.
 * Issuer must match lib/eve-auth.ts / connectionSubjectForUser.
 */
export function connectionSubjectForMailbox(
  userId: string,
  subjectId: string,
): { type: "user"; id: string; issuer: string } {
  return {
    type: "user",
    id: isLegacyMailboxSubject(userId, subjectId) ? userId : subjectId,
    issuer: "better-auth",
  };
}
