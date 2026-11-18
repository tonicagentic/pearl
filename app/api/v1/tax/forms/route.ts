import { buildTaxFormsPayload } from "@/lib/finance/api-v1-tax";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { withUserDb } from "@/lib/finance/db";

export async function GET(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    const year = new URL(request.url).searchParams.get("year");
    const payload = await buildTaxFormsPayload(year);
    return Response.json(payload);
  });
}
