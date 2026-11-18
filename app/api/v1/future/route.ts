import {
  buildFuturePayload,
  upsertFuturePlanRecord,
  type UpsertFuturePlanInput,
} from "@/lib/finance/future";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { withUserDb } from "@/lib/finance/db";

export async function GET(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    const payload = await buildFuturePayload();
    return Response.json(payload);
  });
}

export async function PUT(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    try {
      const body = (await request.json()) as UpsertFuturePlanInput;
      await upsertFuturePlanRecord(body);
      const payload = await buildFuturePayload();
      return Response.json(payload);
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Update failed" },
        { status: 400 },
      );
    }
  });
}

export async function PATCH(request: Request) {
  return PUT(request);
}
