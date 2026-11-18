import { syncAllPlaidItems } from "@/lib/finance/agent-coach";
import { buildAccountsPayload } from "@/lib/finance/api-v1";
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
    const sync = await syncAllPlaidItems();
    const payload = await buildAccountsPayload();
    return Response.json({ ...sync, feeds: payload.feeds });
  });
}
