import { buildUnclearedTransactionsPayload } from "@/lib/finance/api-v1-ledger";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { withUserDb } from "@/lib/finance/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    const { id } = await context.params;
    const payload = await buildUnclearedTransactionsPayload(id);
    return Response.json(payload);
  });
}