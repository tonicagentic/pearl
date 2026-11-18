import { buildBalanceSheetPayload } from "@/lib/finance/api-v1-plan";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { withUserDb } from "@/lib/finance/db";

export async function GET(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    const yearParam = new URL(request.url).searchParams.get("year");
    const year = yearParam ? Number(yearParam) : undefined;
    const payload = await buildBalanceSheetPayload(year);
    return Response.json(payload);
  });
}