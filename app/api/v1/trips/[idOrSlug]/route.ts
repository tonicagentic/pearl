import { buildTripDetailPayload } from "@/lib/finance/api-v1-plan";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { withUserDb } from "@/lib/finance/db";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ idOrSlug: string }> },
) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    const { idOrSlug } = await ctx.params;
    const payload = await buildTripDetailPayload(idOrSlug);
    if (!payload) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }
    return Response.json(payload);
  });
}