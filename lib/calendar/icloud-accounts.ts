import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  IcloudCalDavError,
  getIcloudEvent,
  listIcloudCalendars,
  listIcloudEvents,
  searchIcloudEvents,
  verifyIcloudCalDavCredentials,
  type IcloudCalendarEvent,
  type IcloudCalendarSummary,
} from "@/lib/calendar/icloud-caldav";
import type { IcloudCalendarAccountSummary } from "@/lib/calendar/types";
import {
  SecretCryptoError,
  credentialsKeyConfigured,
  decryptSecret,
  encryptSecret,
} from "@/lib/crypto/secrets";
import { db } from "@/lib/db/client";
import {
  icloudCalendarAccount,
  type IcloudCalendarAccountRow,
} from "@/lib/db/schema";

function normalizeAppleId(value: string): string {
  return value.trim().toLowerCase();
}

function toSummary(
  row: IcloudCalendarAccountRow,
  opts?: { status?: IcloudCalendarAccountSummary["status"]; detail?: string },
): IcloudCalendarAccountSummary {
  return {
    id: row.id,
    appleId: row.appleId,
    nickname: row.nickname,
    status: opts?.status ?? "connected",
    detail: opts?.detail,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
  };
}

/** List persisted iCloud calendar accounts (no CalDAV probing). */
export async function listIcloudCalendarAccounts(
  userId: string,
): Promise<readonly IcloudCalendarAccountRow[]> {
  return db
    .select()
    .from(icloudCalendarAccount)
    .where(eq(icloudCalendarAccount.userId, userId))
    .orderBy(asc(icloudCalendarAccount.createdAt));
}

export async function listIcloudCalendarAccountSummaries(
  userId: string,
): Promise<readonly IcloudCalendarAccountSummary[]> {
  if (!credentialsKeyConfigured()) {
    const rows = await listIcloudCalendarAccounts(userId);
    return rows.map((row) =>
      toSummary(row, {
        status: "unavailable",
        detail: "iCloud Calendar encryption key is not configured.",
      }),
    );
  }
  const rows = await listIcloudCalendarAccounts(userId);
  return rows.map((row) => toSummary(row));
}

export async function getIcloudCalendarAccountForUser(
  userId: string,
  accountId: string,
): Promise<IcloudCalendarAccountRow | null> {
  const rows = await db
    .select()
    .from(icloudCalendarAccount)
    .where(
      and(
        eq(icloudCalendarAccount.userId, userId),
        eq(icloudCalendarAccount.id, accountId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

function decryptPassword(row: IcloudCalendarAccountRow): string {
  try {
    return decryptSecret(row.credentialCiphertext);
  } catch (cause) {
    if (cause instanceof SecretCryptoError) throw cause;
    throw new SecretCryptoError("Could not decrypt iCloud credentials.");
  }
}

export async function createIcloudCalendarAccount(params: {
  readonly userId: string;
  readonly appleId: string;
  readonly appSpecificPassword: string;
  readonly nickname?: string | null;
}): Promise<IcloudCalendarAccountSummary> {
  if (!credentialsKeyConfigured()) {
    throw new SecretCryptoError(
      "ICLOUD_CALDAV_CREDENTIALS_KEY is not configured.",
    );
  }

  const appleId = normalizeAppleId(params.appleId);
  const password = params.appSpecificPassword.trim();
  if (!appleId || !appleId.includes("@")) {
    throw new IcloudCalDavError("Enter a valid Apple ID email.");
  }
  if (!password) {
    throw new IcloudCalDavError("Enter an app-specific password.");
  }

  const existing = await listIcloudCalendarAccounts(params.userId);
  if (existing.some((row) => row.appleId === appleId)) {
    throw new IcloudCalDavError(
      "That Apple ID is already linked. Disconnect it first to reconnect.",
    );
  }

  const verified = await verifyIcloudCalDavCredentials({
    appleId,
    appSpecificPassword: password,
  });
  const encrypted = encryptSecret(password);
  const id = randomUUID();
  const nickname = params.nickname?.trim() || null;
  const now = new Date();

  const [row] = await db
    .insert(icloudCalendarAccount)
    .values({
      id,
      userId: params.userId,
      appleId,
      nickname,
      credentialCiphertext: encrypted.ciphertext,
      credentialKeyId: encrypted.keyId,
      calendarHomeUrl: verified.calendarHomeUrl,
      lastVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!row) {
    throw new Error("Could not save iCloud Calendar account.");
  }
  return toSummary(row);
}

export async function deleteIcloudCalendarAccount(
  userId: string,
  accountId: string,
): Promise<void> {
  await db
    .delete(icloudCalendarAccount)
    .where(
      and(
        eq(icloudCalendarAccount.userId, userId),
        eq(icloudCalendarAccount.id, accountId),
      ),
    );
}

async function credentialsForAccount(
  userId: string,
  accountId: string,
): Promise<{
  appleId: string;
  appSpecificPassword: string;
  row: IcloudCalendarAccountRow;
}> {
  const row = await getIcloudCalendarAccountForUser(userId, accountId);
  if (!row) {
    throw new IcloudCalDavError("Unknown iCloud Calendar account.");
  }
  return {
    appleId: row.appleId,
    appSpecificPassword: decryptPassword(row),
    row,
  };
}

export async function listCalendarsForAccount(
  userId: string,
  accountId: string,
): Promise<readonly IcloudCalendarSummary[]> {
  const credentials = await credentialsForAccount(userId, accountId);
  return listIcloudCalendars(credentials);
}

export async function listEventsForAccount(params: {
  readonly userId: string;
  readonly accountId: string;
  readonly calendarUrl: string;
  readonly start: string;
  readonly end: string;
}): Promise<readonly IcloudCalendarEvent[]> {
  const credentials = await credentialsForAccount(
    params.userId,
    params.accountId,
  );
  return listIcloudEvents({
    credentials,
    calendarUrl: params.calendarUrl,
    start: params.start,
    end: params.end,
  });
}

export async function searchEventsForAccount(params: {
  readonly userId: string;
  readonly accountId: string;
  readonly calendarUrl: string;
  readonly start: string;
  readonly end: string;
  readonly query: string;
}): Promise<readonly IcloudCalendarEvent[]> {
  const credentials = await credentialsForAccount(
    params.userId,
    params.accountId,
  );
  return searchIcloudEvents({
    credentials,
    calendarUrl: params.calendarUrl,
    start: params.start,
    end: params.end,
    query: params.query,
  });
}

export async function getEventForAccount(params: {
  readonly userId: string;
  readonly accountId: string;
  readonly calendarUrl: string;
  readonly eventUrl: string;
  readonly start?: string;
  readonly end?: string;
}): Promise<IcloudCalendarEvent | null> {
  const credentials = await credentialsForAccount(
    params.userId,
    params.accountId,
  );
  return getIcloudEvent({
    credentials,
    calendarUrl: params.calendarUrl,
    eventUrl: params.eventUrl,
    start: params.start,
    end: params.end,
  });
}

/** Strip raw iCal blob before returning tool results. */
export function publicEventFields(event: IcloudCalendarEvent) {
  return {
    url: event.url,
    etag: event.etag,
    uid: event.uid,
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: event.start,
    end: event.end,
  };
}
