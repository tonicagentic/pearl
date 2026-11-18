import { withBodyApi, num } from "@/lib/body/api-helpers";
import { updateSessionSet } from "@/lib/body/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withBodyApi(request, async () => {
    const body = (await request.json()) as Record<string, unknown>;
    return updateSessionSet(id, {
      weight: body.weight !== undefined ? (body.weight == null ? null : num(body.weight)) : undefined,
      reps: body.reps !== undefined ? (body.reps == null ? null : num(body.reps)) : undefined,
      completed: body.completed !== undefined ? body.completed === true : undefined,
    });
  });
}
