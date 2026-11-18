import { reconcileAccountTransactions } from "@/lib/finance/api-v1-ledger";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { withUserDb } from "@/lib/finance/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    const { id } = await context.params;

    try {
      const body = (await request.json()) as {
        transactionIds?: string[];
        reconciled?: boolean;
      };
      const transactionIds = body.transactionIds ?? [];
      const reconciled = body.reconciled !== false;
      if (transactionIds.length === 0) {
        return Response.json({ error: "transactionIds is required" }, { status: 400 });
      }

      const payload = await reconcileAccountTransactions(id, transactionIds, reconciled);
      return Response.json(payload);
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Reconcile failed" },
        { status: 400 },
      );
    }
  });
}