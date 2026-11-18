import { buildAccountsPayload } from "@/lib/finance/api-v1";
import {
  exchangePublicToken,
  markPlaidItemReconnected,
} from "@/lib/finance/plaid-link";
import { plaidConfigured } from "@/lib/finance/plaid";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { withUserDb } from "@/lib/finance/db";

export async function POST(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;

  if (!plaidConfigured()) {
    return Response.json({ error: "Plaid is not configured" }, { status: 503 });
  }

  return withUserDb(session.user.id, async () => {
    try {
      const body = (await request.json()) as {
        publicToken?: string;
        entityId?: string;
        institutionName?: string | null;
        /** When set, this is an update-mode reconnect (no new item). */
        plaidItemId?: string;
      };

      if (body.plaidItemId) {
        const sync = await markPlaidItemReconnected(body.plaidItemId);
        const payload = await buildAccountsPayload();
        return Response.json({
          itemId: body.plaidItemId,
          reconnected: true,
          sync,
          feeds: payload.feeds,
        });
      }

      if (!body.publicToken?.trim() || !body.entityId?.trim()) {
        return Response.json(
          { error: "publicToken and entityId are required" },
          { status: 400 },
        );
      }

      const { itemId } = await exchangePublicToken({
        publicToken: body.publicToken.trim(),
        entityId: body.entityId.trim(),
        institutionName: body.institutionName ?? null,
      });
      const payload = await buildAccountsPayload();
      return Response.json({ itemId, feeds: payload.feeds });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Exchange failed" },
        { status: 400 },
      );
    }
  });
}
