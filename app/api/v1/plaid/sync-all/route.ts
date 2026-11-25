import { syncAllPlaidItems } from "@/lib/finance/agent-coach";
import { buildAccountsPayload } from "@/lib/finance/api-v1";
import { buildPlaidFeedsFreshness } from "@/lib/finance/plaid-freshness";
import { plaidConfigured } from "@/lib/finance/plaid";
import { prisma } from "@/lib/finance/prisma";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { withUserDb } from "@/lib/finance/db";

export const maxDuration = 300;

export async function POST(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;

  if (!plaidConfigured()) {
    return Response.json({ error: "Plaid is not configured" }, { status: 503 });
  }

  let forceRefresh = false;
  try {
    const body = (await request.json()) as { forceRefresh?: boolean };
    forceRefresh = Boolean(body?.forceRefresh);
  } catch {
    // empty body is fine
  }

  return withUserDb(session.user.id, async () => {
    const sync = await syncAllPlaidItems({
      allowRefresh: true,
      forceRefresh,
    });
    const payload = await buildAccountsPayload();
    const items = await prisma.plaidItem.findMany({
      select: {
        status: true,
        lastSyncedAt: true,
        lastRefreshedAt: true,
        updatedAt: true,
      },
    });
    const freshness = buildPlaidFeedsFreshness(items);
    return Response.json({ ...sync, feeds: payload.feeds, freshness });
  });
}
