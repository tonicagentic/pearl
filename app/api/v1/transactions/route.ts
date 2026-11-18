import {
  buildTransactionsListPayload,
  createManualTransaction,
  parseTransactionListFilters,
  type CreateTransactionInput,
} from "@/lib/finance/api-v1-ledger";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { withUserDb } from "@/lib/finance/db";

export async function GET(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    const filters = parseTransactionListFilters(new URL(request.url).searchParams);
    const payload = await buildTransactionsListPayload(filters);
    return Response.json(payload);
  });
}

export async function POST(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    try {
      const body = (await request.json()) as CreateTransactionInput;
      const result = await createManualTransaction(body);
      return Response.json(result, { status: 201 });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Create failed" },
        { status: 400 },
      );
    }
  });
}