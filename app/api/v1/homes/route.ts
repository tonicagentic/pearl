import { buildHomesListPayload } from "@/lib/finance/api-v1-lifestyle";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { withUserDb } from "@/lib/finance/db";

export async function GET(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    const payload = await buildHomesListPayload();
    return Response.json(payload);
  });
}
