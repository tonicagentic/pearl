import {
  buildHomeDetailPayload,
  updateHomeRecord,
  type UpdateHomeInput,
} from "@/lib/finance/api-v1-lifestyle";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { revalidatePath } from "next/cache";
import { withUserDb } from "@/lib/finance/db";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    const { id } = await ctx.params;
    const payload = await buildHomeDetailPayload(id);
    if (!payload) {
      return Response.json({ error: "Home not found" }, { status: 404 });
    }
    return Response.json(payload);
  });
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    try {
      const { id } = await ctx.params;
      const body = (await request.json()) as UpdateHomeInput;
      const payload = await updateHomeRecord(id, body);
      revalidatePath("/lifestyle");
      revalidatePath("/balance-sheet");
      revalidatePath("/");
      return Response.json(payload);
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Update failed" },
        { status: 400 },
      );
    }
  });
}
