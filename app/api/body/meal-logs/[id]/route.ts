import { withBodyApi, num, str } from "@/lib/body/api-helpers";
import { addMealLogItem, deleteMealLog } from "@/lib/body/api";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withBodyApi(request, async () => {
    const body = (await request.json()) as Record<string, unknown>;
    const foodId = str(body.foodId);
    if (!foodId) throw new Error("foodId is required");
    return addMealLogItem(id, {
      foodId,
      servings: num(body.servings, 1),
    });
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withBodyApi(request, async () => deleteMealLog(id));
}
