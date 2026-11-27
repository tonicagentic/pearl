import {
  buildCategoriesPayload,
  createCategoryGroupRecord,
  type CreateCategoryGroupInput,
} from "@/lib/finance/api-v1-ledger";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { withUserDb } from "@/lib/finance/db";

export async function POST(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    try {
      const body = (await request.json()) as CreateCategoryGroupInput;
      const result = await createCategoryGroupRecord(body);
      const payload = await buildCategoriesPayload();
      return Response.json(
        { ...payload, createdId: result.id },
        { status: 201 },
      );
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Create failed" },
        { status: 400 },
      );
    }
  });
}
