import { encryptSecret, decryptSecret } from "@/lib/finance/crypto";
import { getUserId } from "@/lib/finance/db";
import {
  getPlaidClient,
  getPlaidEnv,
  getPlaidProducts,
  plaidConfigured,
  PLAID_COUNTRY_CODES,
} from "@/lib/finance/plaid";
import {
  deletePlaidItemIndex,
  upsertPlaidItemIndex,
} from "@/lib/finance/plaid-item-index";
import { ensurePlaidItemFresh, syncPlaidItem } from "@/lib/finance/plaid-sync";
import { getPlaidWebhookUrl } from "@/lib/finance/plaid-webhook";
import { prisma } from "@/lib/finance/prisma";

function mapAccountType(type?: string | null) {
  if (type === "credit") return "credit";
  if (type === "loan") return "loan";
  if (type === "investment") return "brokerage";
  return "bank";
}

export type LinkTokenResult =
  | { linkToken: string; env: string }
  | { error: string; env: string };

/**
 * Create a Plaid Link token for new connections, or update-mode reconnect
 * when `plaidItemId` is provided.
 */
export async function createLinkToken(input: {
  userId: string;
  plaidItemId?: string | null;
}): Promise<LinkTokenResult> {
  if (!plaidConfigured()) {
    return {
      error:
        "Add PLAID_CLIENT_ID and PLAID_SECRET (from https://dashboard.plaid.com/developers/keys).",
      env: getPlaidEnv(),
    };
  }

  try {
    const client = getPlaidClient();
    const base = {
      user: { client_user_id: input.userId },
      client_name: "Pearl",
      country_codes: [...PLAID_COUNTRY_CODES],
      language: "en" as const,
    };

    const webhook = getPlaidWebhookUrl() ?? undefined;

    if (input.plaidItemId) {
      const item = await prisma.plaidItem.findUnique({
        where: { id: input.plaidItemId },
      });
      if (!item) {
        return { error: "Plaid item not found", env: getPlaidEnv() };
      }
      const res = await client.link.createToken({
        ...base,
        access_token: decryptSecret(item.accessTokenEnc),
        ...(webhook ? { webhook } : {}),
      });
      return { linkToken: res.link_token, env: getPlaidEnv() };
    }

    const res = await client.link.createToken({
      ...base,
      products: getPlaidProducts() as ["transactions"],
      ...(webhook ? { webhook } : {}),
    });
    return { linkToken: res.link_token, env: getPlaidEnv() };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Plaid link token failed";
    return { error: message, env: getPlaidEnv() };
  }
}

export async function exchangePublicToken(input: {
  publicToken: string;
  entityId: string;
  institutionName?: string | null;
}) {
  if (!plaidConfigured()) {
    throw new Error("Plaid is not configured");
  }
  const client = getPlaidClient();
  const exchange = await client.item.exchangePublicToken({
    public_token: input.publicToken,
  });
  const accessToken = exchange.access_token;
  const itemId = exchange.item_id;

  const item = await prisma.plaidItem.create({
    data: {
      itemId,
      accessTokenEnc: encryptSecret(accessToken),
      institutionName: input.institutionName ?? null,
      status: "active",
    },
  });

  await upsertPlaidItemIndex({
    itemId,
    userId: getUserId(),
  });

  const accountsRes = await client.accounts.get({ access_token: accessToken });
  for (const a of accountsRes.accounts) {
    await prisma.account.create({
      data: {
        entityId: input.entityId,
        name: a.official_name ?? a.name ?? "Plaid account",
        type: mapAccountType(a.type),
        source: "plaid",
        balance: a.balances?.current ?? 0,
        plaidAccountId: a.account_id,
        plaidItemId: item.id,
      },
    });
  }

  try {
    await syncPlaidItem(item.id);
  } catch {
    // Balances saved; retry sync later if transactions are still warming up
  }

  return { itemId: item.id };
}

/**
 * After update-mode Link, mark the item active again (access token unchanged).
 */
export async function markPlaidItemReconnected(plaidItemId: string) {
  await prisma.plaidItem.update({
    where: { id: plaidItemId },
    data: { status: "active", updatedAt: new Date() },
  });
  try {
    return await syncPlaidItem(plaidItemId);
  } catch (err) {
    return {
      added: 0,
      modified: 0,
      removed: 0,
      syncError: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function syncPlaidItemById(
  plaidItemId: string,
  opts?: { forceRefresh?: boolean; allowRefresh?: boolean },
) {
  return ensurePlaidItemFresh(plaidItemId, {
    forceRefresh: opts?.forceRefresh,
    allowRefresh: opts?.allowRefresh ?? true,
  });
}

export async function removePlaidItem(id: string) {
  const item = await prisma.plaidItem.findUnique({
    where: { id },
    include: { accounts: true },
  });
  if (!item) {
    throw new Error("Plaid item not found");
  }

  if (plaidConfigured()) {
    try {
      const client = getPlaidClient();
      await client.item.remove({
        access_token: decryptSecret(item.accessTokenEnc),
      });
    } catch {
      // Still remove locally if Plaid revoke fails
    }
  }

  const accountIds = item.accounts.map((a) => a.id);
  if (accountIds.length > 0) {
    await prisma.transaction.deleteMany({
      where: { accountId: { in: accountIds } },
    });
  }
  await prisma.account.deleteMany({ where: { plaidItemId: id } });
  await prisma.plaidItem.delete({ where: { id } });
  await deletePlaidItemIndex(item.itemId);
}
