import { removePlaidItem } from "@/lib/finance/plaid-link";
import { buildAccountsPayload } from "@/lib/finance/api-v1";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { withUserDb } from "@/lib/finance/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;

  return withUserDb(session.user.id, async () => {
    const { id } = await context.params;
    try {
      await removePlaidItem(id);
      const payload = await buildAccountsPayload();
      return Response.json({ ok: true, feeds: payload.feeds, accounts: payload.accounts });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Remove failed";
      const status = message.includes("not found") ? 404 : 400;
      return Response.json({ error: message }, { status });
    }
  });
}
