import { sql } from "drizzle-orm";

import { runDailyBooksPass } from "@/lib/finance/agent-coach";
import { withUserDb } from "@/lib/finance/db";
import { db } from "@/lib/db/client";
import { user } from "@/lib/db/schema";

export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  if (url.searchParams.get("secret") === secret) return true;

  return false;
}

async function resolveOwnerUserId(): Promise<string | null> {
  const email = process.env.PEARL_OWNER_EMAIL?.trim().toLowerCase();
  if (!email) return null;

  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(sql`lower(${user.email}) = ${email}`)
    .limit(1);

  return rows[0]?.id ?? null;
}

async function handle(request: Request) {
  if (!authorizeCron(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await resolveOwnerUserId();
  if (!ownerId) {
    return Response.json(
      { error: "PEARL_OWNER_EMAIL not set or user not found" },
      { status: 500 },
    );
  }

  try {
    const result = await withUserDb(ownerId, () => runDailyBooksPass());
    return Response.json({ ok: true, ownerId, ...result });
  } catch (err) {
    console.error("[cron/finance-daily]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Daily books failed" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
