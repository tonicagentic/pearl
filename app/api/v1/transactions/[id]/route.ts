import {
  patchTransaction,
  type PatchTransactionInput,
} from "@/lib/finance/api-v1-ledger";
import { formatMoney } from "@/lib/finance/money";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { prisma } from "@/lib/finance/prisma";
import { withUserDb } from "@/lib/finance/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    const { id } = await context.params;

    try {
      const body = (await request.json()) as PatchTransactionInput;
      await patchTransaction(id, body);

      const t = await prisma.transaction.findUnique({
        where: { id },
        include: {
          account: { select: { id: true, name: true, type: true } },
          category: {
            select: {
              id: true,
              name: true,
              code: true,
              group: { select: { name: true } },
            },
          },
          trip: { select: { id: true, name: true } },
        },
      });
      if (!t) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }

      const item = {
        id: t.id,
        date: t.date.toISOString(),
        memo: t.memo,
        amount: t.amount,
        amountLabel: formatMoney(t.amount, { signed: true }),
        type: t.type,
        account: t.account
          ? { id: t.account.id, name: t.account.name, type: t.account.type }
          : null,
        category: t.category
          ? {
              id: t.category.id,
              name: t.category.name,
              code: t.category.code,
              groupName: t.category.group?.name ?? null,
            }
          : null,
        trip: t.trip ? { id: t.trip.id, name: t.trip.name } : null,
        pending: t.pending,
      };

      return Response.json({ item });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Update failed" },
        { status: 400 },
      );
    }
  });
}