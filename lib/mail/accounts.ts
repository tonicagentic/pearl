import { and, asc, eq } from "drizzle-orm";
import {
  getTokenResponse,
  NoValidTokenError,
  UserAuthorizationRequiredError,
  type ConnectTokenResponse,
} from "@vercel/connect";
import { randomUUID } from "node:crypto";

import {
  connectionConfiguration,
  connectionSubjectForUser,
} from "@/lib/connections/catalog";
import { connectionTokenParams } from "@/lib/connections/oauth-scopes";
import { accountLabelFromToken } from "@/lib/connections/status";
import { missingFromGranted } from "@/lib/connections/grant-scopes";
import { db } from "@/lib/db/client";
import { mailAccount, type MailAccountRow } from "@/lib/db/schema";
import {
  connectionSubjectForMailbox,
  isLegacyMailboxSubject,
  mailboxSubjectId,
} from "@/lib/mail/subjects";

const GMAIL_MODIFY_SCOPE =
  "https://www.googleapis.com/auth/gmail.modify";

export type MailboxStatus =
  | "connected"
  | "not-connected"
  | "unavailable"
  | "unknown";

export type MailboxSummary = {
  readonly id: string;
  readonly emailLabel: string | null;
  readonly nickname: string | null;
  readonly isLegacy: boolean;
  readonly status: MailboxStatus;
  readonly detail?: string;
  readonly canModify: boolean;
  readonly missingScopes?: readonly string[];
};

/** List persisted mailboxes for a user (no Connect probing). */
export async function listMailAccounts(
  userId: string,
): Promise<readonly MailAccountRow[]> {
  return db
    .select()
    .from(mailAccount)
    .where(eq(mailAccount.userId, userId))
    .orderBy(asc(mailAccount.createdAt));
}

export async function getMailAccountForUser(
  userId: string,
  mailboxId: string,
): Promise<MailAccountRow | null> {
  const rows = await db
    .select()
    .from(mailAccount)
    .where(
      and(eq(mailAccount.userId, userId), eq(mailAccount.id, mailboxId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * If the user has a legacy Connect grant and no mail_account rows yet,
 * insert a primary row keyed by the Better Auth user id so the grant
 * keeps working without a reconnect.
 */
export async function ensureLegacyMailAccount(
  userId: string,
): Promise<MailAccountRow | null> {
  const existing = await listMailAccounts(userId);
  if (existing.length > 0) return existing[0] ?? null;

  const connector = connectionConfiguration("gmail").connector;
  if (!connector) return null;

  let token: ConnectTokenResponse;
  try {
    token = await getTokenResponse(
      connector,
      {
        subject: connectionSubjectForUser(userId),
        ...connectionTokenParams("gmail"),
      },
      { forceRefresh: false },
    );
  } catch (error) {
    if (
      error instanceof UserAuthorizationRequiredError ||
      error instanceof NoValidTokenError
    ) {
      return null;
    }
    return null;
  }

  const emailLabel = accountLabelFromToken(token) ?? null;
  const id = randomUUID();
  const [row] = await db
    .insert(mailAccount)
    .values({
      id,
      userId,
      subjectId: userId,
      emailLabel,
    })
    .returning();
  return row ?? null;
}

/** Create a mailbox row for a new Google account (non-legacy subject). */
export async function createMailAccount(
  userId: string,
): Promise<MailAccountRow> {
  const id = randomUUID();
  const [row] = await db
    .insert(mailAccount)
    .values({
      id,
      userId,
      subjectId: mailboxSubjectId(userId, id),
      emailLabel: null,
    })
    .returning();
  if (!row) throw new Error("Could not create mail account.");
  return row;
}

/**
 * Ensure there is a primary (legacy-subject) mailbox to authorize when the
 * user has none yet. Used by "Add Gmail account" when the list is empty.
 */
export async function ensurePrimaryMailAccount(
  userId: string,
): Promise<MailAccountRow> {
  const legacy = await ensureLegacyMailAccount(userId);
  if (legacy) return legacy;

  const existing = await listMailAccounts(userId);
  const primary = existing.find((row) =>
    isLegacyMailboxSubject(userId, row.subjectId),
  );
  if (primary) return primary;
  if (existing[0]) return existing[0];

  const id = randomUUID();
  const [row] = await db
    .insert(mailAccount)
    .values({
      id,
      userId,
      subjectId: userId,
      emailLabel: null,
    })
    .returning();
  if (!row) throw new Error("Could not create primary mail account.");
  return row;
}

export async function updateMailAccountLabel(
  userId: string,
  mailboxId: string,
  emailLabel: string | null,
): Promise<MailAccountRow | null> {
  const [row] = await db
    .update(mailAccount)
    .set({ emailLabel, updatedAt: new Date() })
    .where(
      and(eq(mailAccount.userId, userId), eq(mailAccount.id, mailboxId)),
    )
    .returning();
  return row ?? null;
}

export async function updateMailAccountNickname(
  userId: string,
  mailboxId: string,
  nickname: string | null,
): Promise<MailAccountRow | null> {
  const trimmed = nickname?.trim() || null;
  const [row] = await db
    .update(mailAccount)
    .set({ nickname: trimmed, updatedAt: new Date() })
    .where(
      and(eq(mailAccount.userId, userId), eq(mailAccount.id, mailboxId)),
    )
    .returning();
  return row ?? null;
}

export async function deleteMailAccount(
  userId: string,
  mailboxId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(mailAccount)
    .where(
      and(eq(mailAccount.userId, userId), eq(mailAccount.id, mailboxId)),
    )
    .returning({ id: mailAccount.id });
  return deleted.length > 0;
}

function scopesFromToken(
  token: ConnectTokenResponse,
): readonly string[] | undefined {
  const claims = token.claims;
  if (!claims || typeof claims !== "object") return undefined;
  const scope = (claims as Record<string, unknown>).scope;
  if (typeof scope === "string") {
    return scope.split(/[\s,]+/).filter(Boolean);
  }
  if (Array.isArray(scope)) {
    return scope.filter((item): item is string => typeof item === "string");
  }
  return undefined;
}

async function probeMailbox(
  userId: string,
  row: MailAccountRow,
): Promise<MailboxSummary> {
  const connector = connectionConfiguration("gmail").connector;
  if (!connector) {
    return {
      id: row.id,
      emailLabel: row.emailLabel,
      nickname: row.nickname,
      isLegacy: isLegacyMailboxSubject(userId, row.subjectId),
      status: "unavailable",
      detail: "Gmail connector is not configured.",
      canModify: false,
    };
  }

  try {
    const token = await getTokenResponse(
      connector,
      {
        subject: connectionSubjectForMailbox(userId, row.subjectId),
        ...connectionTokenParams("gmail"),
      },
      { forceRefresh: false },
    );
    let label = accountLabelFromToken(token) ?? row.emailLabel;
    if (!label) {
      const { getGmailProfileEmail } = await import("@/lib/agent/gmail-api");
      label = await getGmailProfileEmail(token.token);
    }
    if (label && label !== row.emailLabel) {
      await updateMailAccountLabel(userId, row.id, label);
    }
    const granted = scopesFromToken(token);
    const requested = connectionTokenParams("gmail").scopes ?? [];
    const missing = missingFromGranted(requested, granted);
    // Prefer positive evidence of modify; if Connect omits scopes from
    // claims, assume modify is present until a REST call returns 403.
    const knownMissingModify =
      missing?.some((scope) => scope.includes("gmail.modify")) === true;
    const canModify = !knownMissingModify;

    return {
      id: row.id,
      emailLabel: label,
      nickname: row.nickname,
      isLegacy: isLegacyMailboxSubject(userId, row.subjectId),
      status: "connected",
      detail: label
        ? canModify
          ? `Connected as ${label}.`
          : `Connected as ${label}. Reconnect to enable archive and mark-read.`
        : canModify
          ? "Connected."
          : "Connected. Reconnect to enable archive and mark-read.",
      canModify,
      missingScopes: missing,
    };
  } catch (error) {
    if (
      error instanceof UserAuthorizationRequiredError ||
      error instanceof NoValidTokenError
    ) {
      return {
        id: row.id,
        emailLabel: row.emailLabel,
        nickname: row.nickname,
        isLegacy: isLegacyMailboxSubject(userId, row.subjectId),
        status: "not-connected",
        detail:
          "Not authorized. Connect this Gmail account to grant access.",
        canModify: false,
        missingScopes: [GMAIL_MODIFY_SCOPE],
      };
    }
    return {
      id: row.id,
      emailLabel: row.emailLabel,
      nickname: row.nickname,
      isLegacy: isLegacyMailboxSubject(userId, row.subjectId),
      status: "unknown",
      detail: "Could not verify this mailbox right now.",
      canModify: false,
    };
  }
}

/** List mailboxes with live Connect status. Seeds a legacy row when needed. */
export async function listMailboxSummaries(
  userId: string,
): Promise<readonly MailboxSummary[]> {
  await ensureLegacyMailAccount(userId);
  const rows = await listMailAccounts(userId);
  return Promise.all(rows.map((row) => probeMailbox(userId, row)));
}

/** Resolve a Gmail bearer for a mailbox, or the sole/legacy mailbox. */
export async function getGmailTokenForMailbox(
  userId: string,
  mailboxId?: string | null,
): Promise<{ readonly token: string; readonly mailbox: MailAccountRow }> {
  await ensureLegacyMailAccount(userId);
  const rows = await listMailAccounts(userId);
  if (rows.length === 0) {
    throw new Error(
      "Connect a Gmail account in Settings before sending or managing mail.",
    );
  }

  let mailbox: MailAccountRow | undefined;
  if (mailboxId) {
    mailbox = rows.find((row) => row.id === mailboxId);
    if (!mailbox) {
      throw new Error("That Gmail account is not connected.");
    }
  } else if (rows.length === 1) {
    mailbox = rows[0];
  } else {
    throw new Error(
      "Multiple Gmail accounts are connected. Pass accountId to choose one.",
    );
  }
  if (!mailbox) {
    throw new Error("Gmail account unavailable.");
  }

  const connector = connectionConfiguration("gmail").connector;
  if (!connector) {
    throw new Error(
      "Gmail is not configured. Attach GMAIL_CONNECTOR, then connect Gmail in Settings.",
    );
  }

  const token = (
    await getTokenResponse(connector, {
      subject: connectionSubjectForMailbox(userId, mailbox.subjectId),
      ...connectionTokenParams("gmail"),
    })
  ).token;

  return { token, mailbox };
}
