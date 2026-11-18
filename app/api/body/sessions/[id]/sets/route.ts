import { withBodyApi, num, str } from "@/lib/body/api-helpers";
import { upsertSessionSet } from "@/lib/body/api";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withBodyApi(request, async () => {
    const body = (await request.json()) as Record<string, unknown>;
    const exerciseId = str(body.exerciseId);
    if (!exerciseId) throw new Error("exerciseId is required");
    return upsertSessionSet(id, {
      id: body.id != null ? str(body.id) : undefined,
      exerciseId,
      setNumber: num(body.setNumber, 1),
      weight: body.weight != null ? num(body.weight) : null,
      reps: body.reps != null ? num(body.reps) : null,
      completed: body.completed === true,
    });
  });
}
