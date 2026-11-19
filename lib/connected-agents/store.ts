import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { ConnectedAgentSummary } from "@/lib/connected-agents/types";
import {
  ConnectedAgentUrlError,
  assertSafeConnectedAgentUrl,
  normalizeConnectedAgentUrl,
  probeConnectedAgentHealth,
} from "@/lib/connected-agents/url-safety";
import {
  SecretCryptoError,
  credentialsKeyConfigured,
  decryptSecret,
  encryptSecret,
} from "@/lib/crypto/secrets";
import { db } from "@/lib/db/client";
import {
  chat,
  connectedAgent,
  type ConnectedAgentRow,
} from "@/lib/db/schema";

const MAX_LABEL = 80;
const MAX_TOKEN = 8_192;

function toSummary(row: ConnectedAgentRow): ConnectedAgentSummary {
  return {
    id: row.id,
    label: row.label,
    url: row.url,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
  };
}

function requireLabel(raw: string): string {
  const label = raw.replace(/\s+/g, " ").trim();
  if (!label) {
    throw new ConnectedAgentUrlError("Enter a name for this agent.");
  }
  if (label.length > MAX_LABEL) {
    throw new ConnectedAgentUrlError(
      `Names must be ${MAX_LABEL} characters or fewer.`,
    );
  }
  return label;
}

function requireToken(raw: string): string {
  const token = raw.trim();
  if (!token) {
    throw new ConnectedAgentUrlError("Enter the bearer token for this agent.");
  }
  if (token.length > MAX_TOKEN) {
    throw new ConnectedAgentUrlError("That bearer token is too long.");
  }
  return token;
}

export async function listConnectedAgents(
  userId: string,
): Promise<readonly ConnectedAgentRow[]> {
  return db
    .select()
    .from(connectedAgent)
    .where(eq(connectedAgent.userId, userId))
    .orderBy(asc(connectedAgent.label));
}

export async function listConnectedAgentSummaries(
  userId: string,
): Promise<readonly ConnectedAgentSummary[]> {
  const rows = await listConnectedAgents(userId);
  return rows.map(toSummary);
}

export async function getConnectedAgentForUser(
  userId: string,
  agentId: string,
): Promise<ConnectedAgentRow | null> {
  const [row] = await db
    .select()
    .from(connectedAgent)
    .where(
      and(eq(connectedAgent.userId, userId), eq(connectedAgent.id, agentId)),
    )
    .limit(1);
  return row ?? null;
}

/** Decrypt the bearer for an owned connection. Re-check URL safety first. */
export async function getConnectedAgentCredentialsForUser(
  userId: string,
  agentId: string,
): Promise<{
  readonly id: string;
  readonly label: string;
  readonly url: string;
  readonly token: string;
} | null> {
  const row = await getConnectedAgentForUser(userId, agentId);
  if (!row) return null;
  const url = await assertSafeConnectedAgentUrl(row.url);
  try {
    const token = decryptSecret(row.tokenCiphertext);
    return { id: row.id, label: row.label, url, token };
  } catch (cause) {
    if (cause instanceof SecretCryptoError) throw cause;
    throw new SecretCryptoError("Could not decrypt the agent token.");
  }
}

export async function createConnectedAgent(params: {
  readonly userId: string;
  readonly label: string;
  readonly url: string;
  readonly token: string;
}): Promise<ConnectedAgentSummary> {
  if (!credentialsKeyConfigured()) {
    throw new SecretCryptoError(
      "USER_SECRETS_KEY (or ICLOUD_CALDAV_CREDENTIALS_KEY) is not configured.",
    );
  }

  const label = requireLabel(params.label);
  const token = requireToken(params.token);
  const url = await assertSafeConnectedAgentUrl(params.url);
  await probeConnectedAgentHealth(url);

  const existing = await listConnectedAgents(params.userId);
  if (existing.some((row) => row.url === url)) {
    throw new ConnectedAgentUrlError(
      "You already connected an agent at that URL.",
    );
  }

  const encrypted = encryptSecret(token);
  const [row] = await db
    .insert(connectedAgent)
    .values({
      id: randomUUID(),
      userId: params.userId,
      label,
      url,
      tokenCiphertext: encrypted.ciphertext,
      tokenKeyId: encrypted.keyId,
      lastVerifiedAt: new Date(),
    })
    .returning();

  if (!row) {
    throw new Error("Failed to save connected agent.");
  }
  return toSummary(row);
}

export async function updateConnectedAgent(params: {
  readonly userId: string;
  readonly agentId: string;
  readonly label?: string;
  readonly url?: string;
  readonly token?: string;
}): Promise<ConnectedAgentSummary | null> {
  const existing = await getConnectedAgentForUser(
    params.userId,
    params.agentId,
  );
  if (!existing) return null;

  const patch: {
    label?: string;
    url?: string;
    tokenCiphertext?: string;
    tokenKeyId?: string;
    lastVerifiedAt?: Date;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (params.label !== undefined) {
    patch.label = requireLabel(params.label);
  }

  let nextUrl = existing.url;
  if (params.url !== undefined) {
    nextUrl = await assertSafeConnectedAgentUrl(params.url);
    const siblings = await listConnectedAgents(params.userId);
    if (siblings.some((row) => row.id !== existing.id && row.url === nextUrl)) {
      throw new ConnectedAgentUrlError(
        "You already connected an agent at that URL.",
      );
    }
    patch.url = nextUrl;
  }

  if (params.token !== undefined) {
    if (!credentialsKeyConfigured()) {
      throw new SecretCryptoError(
        "USER_SECRETS_KEY (or ICLOUD_CALDAV_CREDENTIALS_KEY) is not configured.",
      );
    }
    const token = requireToken(params.token);
    const encrypted = encryptSecret(token);
    patch.tokenCiphertext = encrypted.ciphertext;
    patch.tokenKeyId = encrypted.keyId;
  }

  // Re-probe when the URL or token changes.
  if (params.url !== undefined || params.token !== undefined) {
    await probeConnectedAgentHealth(nextUrl);
    patch.lastVerifiedAt = new Date();
  }

  const [row] = await db
    .update(connectedAgent)
    .set(patch)
    .where(
      and(
        eq(connectedAgent.userId, params.userId),
        eq(connectedAgent.id, params.agentId),
      ),
    )
    .returning();

  return row ? toSummary(row) : null;
}

export async function deleteConnectedAgent(
  userId: string,
  agentId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(connectedAgent)
    .where(
      and(eq(connectedAgent.userId, userId), eq(connectedAgent.id, agentId)),
    )
    .returning({ id: connectedAgent.id });
  return deleted.length > 0;
}

/** Persist which connected agent a chat is talking through (null = Pearl). */
export async function setChatRemoteAgent(
  userId: string,
  chatId: string,
  remoteAgentId: string | null,
): Promise<boolean> {
  if (remoteAgentId) {
    const owned = await getConnectedAgentForUser(userId, remoteAgentId);
    if (!owned) return false;
  }
  const updated = await db
    .update(chat)
    .set({ remoteAgentId, updatedAt: new Date() })
    .where(and(eq(chat.userId, userId), eq(chat.id, chatId)))
    .returning({ id: chat.id });
  return updated.length > 0;
}

export { normalizeConnectedAgentUrl };
