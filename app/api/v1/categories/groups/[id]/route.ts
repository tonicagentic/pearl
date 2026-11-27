import {
  buildCategoriesPayload,
  patchCategoryGroupRecord,
  type PatchCategoryGroupInput,
} from "@/lib/finance/api-v1-ledger";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { withUserDb } from "@/lib/finance/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    const { id } = await context.params;
    try {
      const body = (await request.json()) as PatchCategoryGroupInput;
      await patchCategoryGroupRecord(id, body);
      const payload = await buildCategoriesPayload();
      return Response.json(payload);
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Update failed" },
        { status: 400 },
      );
    }
  });
}
