import { sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { user } from "@/lib/db/schema";
import { withUserDb } from "@/lib/finance/db";
import { plaidConfigured } from "@/lib/finance/plaid";
import { syncPlaidItem } from "@/lib/finance/plaid-sync";
import { verifyPlaidWebhookRequest } from "@/lib/finance/plaid-webhook";
import { prisma } from "@/lib/finance/prisma";

export const maxDuration = 300;

type PlaidWebhookBody = {
  webhook_type?: string;
  webhook_code?: string;
  item_id?: string;
};

async function resolveOwnerUserId(): Promise<string | null> {
  const email = process.env.PEARL_OWNER_EMAIL?.trim().toLowerCase();
  if (!email) return null;
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(sql`lower(${user.email}) = ${email}`)
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function POST(request: Request) {
  if (!plaidConfigured()) {
    return Response.json({ error: "Plaid is not configured" }, { status: 503 });
  }

  const bodyText = await request.text();
  const verified = await verifyPlaidWebhookRequest({
    bodyText,
    plaidVerification: request.headers.get("plaid-verification"),
  });
  if (!verified) {
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let body: PlaidWebhookBody;
  try {
    body = JSON.parse(bodyText) as PlaidWebhookBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const webhookType = (body.webhook_type ?? "").toUpperCase();
  const webhookCode = (body.webhook_code ?? "").toUpperCase();
  const plaidItemId = body.item_id?.trim();

  // Ack anything we don't need; only TRANSACTIONS sync codes pull data.
  if (
    webhookType !== "TRANSACTIONS" ||
    (webhookCode !== "SYNC_UPDATES_AVAILABLE" &&
      webhookCode !== "DEFAULT_UPDATE" &&
      webhookCode !== "INITIAL_UPDATE" &&
      webhookCode !== "HISTORICAL_UPDATE")
  ) {
    return Response.json({ ok: true, ignored: true });
  }

  if (!plaidItemId) {
    return Response.json({ ok: true, ignored: true });
  }

  const ownerId = await resolveOwnerUserId();
  if (!ownerId) {
    console.error("[plaid/webhook] PEARL_OWNER_EMAIL not set or user missing");
    return Response.json({ error: "Owner not configured" }, { status: 500 });
  }

  try {
    const result = await withUserDb(ownerId, async () => {
      const item = await prisma.plaidItem.findFirst({
        where: { itemId: plaidItemId },
        select: { id: true },
      });
      if (!item) {
        return { found: false as const };
      }
      const sync = await syncPlaidItem(item.id);
      return { found: true as const, id: item.id, ...sync };
    });

    return Response.json({ ok: true, webhookCode, ...result });
  } catch (err) {
    console.error("[plaid/webhook]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Webhook sync failed" },
      { status: 500 },
    );
  }
}
