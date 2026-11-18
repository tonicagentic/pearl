import { buildSummaryPayload } from "@/lib/finance/api-v1";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { withUserDb } from "@/lib/finance/db";

export async function GET(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    const summary = await buildSummaryPayload();
    return Response.json({
      ...summary,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
    });
  });
}
