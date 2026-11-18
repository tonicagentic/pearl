import {
  buildBillsPayload,
  createBillRecord,
  type CreateBillInput,
} from "@/lib/finance/api-v1-ledger";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { withUserDb } from "@/lib/finance/db";

export async function GET(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    const payload = await buildBillsPayload();
    return Response.json(payload);
  });
}

export async function POST(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    try {
      const body = (await request.json()) as CreateBillInput;
      const result = await createBillRecord(body);
      const payload = await buildBillsPayload();
      return Response.json({ ...payload, createdId: result.id }, { status: 201 });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Create failed" },
        { status: 400 },
      );
    }
  });
}