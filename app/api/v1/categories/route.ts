import {
  buildCategoriesPayload,
  createCategoryGroupRecord,
  createCategoryRecord,
  type CreateCategoryGroupInput,
  type CreateCategoryInput,
} from "@/lib/finance/api-v1-ledger";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { withUserDb } from "@/lib/finance/db";

export async function GET(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    const payload = await buildCategoriesPayload();
    return Response.json(payload);
  });
}

export async function POST(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    try {
      const body = (await request.json()) as CreateCategoryInput &
        CreateCategoryGroupInput & { type?: string };
      // Same route can grow an empty chart: omit groupId (or type=group) to
      // create a group; otherwise create a category inside a group.
      const creatingGroup =
        body.type === "group" ||
        !("groupId" in body) ||
        body.groupId == null ||
        String(body.groupId).trim() === "";
      const result = creatingGroup
        ? await createCategoryGroupRecord(body)
        : await createCategoryRecord(body);
      const payload = await buildCategoriesPayload();
      return Response.json({ ...payload, createdId: result.id }, { status: 201 });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Create failed" },
        { status: 400 },
      );
    }
  });
}