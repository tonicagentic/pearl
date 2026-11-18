import { buildCoachPayload, handleCoachPost } from "@/lib/finance/api-v1-plan";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { withUserDb } from "@/lib/finance/db";

export async function GET(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    const limit = Number(
      new URL(request.url).searchParams.get("limit") ?? "20",
    );
    const payload = await buildCoachPayload(
      Number.isFinite(limit) ? limit : 20,
    );
    return Response.json(payload);
  });
}

export async function POST(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    let body: { action?: string; id?: string; message?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body.action) {
      return Response.json({ error: "Missing action" }, { status: 400 });
    }

    const result = await handleCoachPost({
      action: body.action,
      id: body.id,
      message: body.message,
    });

    if (!result.ok) {
      return Response.json(result, { status: 400 });
    }

    return Response.json(result);
  });
}