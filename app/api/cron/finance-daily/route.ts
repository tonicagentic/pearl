import { runDailyBooksPass } from "@/lib/finance/agent-coach";
import { withUserDb } from "@/lib/finance/db";
import { listPlaidFinanceUserIds } from "@/lib/finance/plaid-item-index";

export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function handle(request: Request) {
  if (!authorizeCron(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userIds = await listPlaidFinanceUserIds();
  if (userIds.length === 0) {
    return Response.json({ ok: true, users: 0, results: [] });
  }

  const results: Array<{ userId: string; ok: boolean; error?: string }> = [];

  for (const userId of userIds) {
    try {
      const result = await withUserDb(userId, () => runDailyBooksPass());
      results.push({ userId, ok: true, ...result });
    } catch (err) {
      console.error("[cron/finance-daily]", userId, err);
      results.push({
        userId,
        ok: false,
        error: err instanceof Error ? err.message : "Daily books failed",
      });
    }
  }

  return Response.json({
    ok: results.every((r) => r.ok),
    users: userIds.length,
    results,
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
