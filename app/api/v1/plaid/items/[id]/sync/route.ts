import { syncPlaidItemById } from "@/lib/finance/plaid-link";
import { plaidConfigured } from "@/lib/finance/plaid";
import { prisma } from "@/lib/finance/prisma";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { withUserDb } from "@/lib/finance/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;

  if (!plaidConfigured()) {
    return Response.json({ error: "Plaid is not configured" }, { status: 503 });
  }

  return withUserDb(session.user.id, async () => {
    const { id } = await context.params;
    const item = await prisma.plaidItem.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!item) {
      return Response.json({ error: "Plaid item not found" }, { status: 404 });
    }

    try {
      const sync = await syncPlaidItemById(id);
      const refreshed = await prisma.plaidItem.findUnique({
        where: { id },
        select: { status: true },
      });
      return Response.json({
        ok: true,
        ...sync,
        status: refreshed?.status ?? "active",
      });
    } catch (err) {
      const refreshed = await prisma.plaidItem.findUnique({
        where: { id },
        select: { status: true },
      });
      return Response.json(
        {
          ok: false,
          error: err instanceof Error ? err.message : "Sync failed",
          status: refreshed?.status ?? "error",
        },
        { status: 400 },
      );
    }
  });
}
