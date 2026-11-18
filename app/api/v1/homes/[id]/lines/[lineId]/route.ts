import {
  updateHomeLineRecord,
  type UpdateHomeLineInput,
} from "@/lib/finance/api-v1-lifestyle";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { revalidatePath } from "next/cache";
import { withUserDb } from "@/lib/finance/db";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string; lineId: string }> },
) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    try {
      const { id, lineId } = await ctx.params;
      const body = (await request.json()) as UpdateHomeLineInput;
      const payload = await updateHomeLineRecord(id, lineId, body);
      revalidatePath("/lifestyle");
      revalidatePath("/bills");
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
