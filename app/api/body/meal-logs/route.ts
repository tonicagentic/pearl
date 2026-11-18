import { withBodyApi, isoDate, num, str } from "@/lib/body/api-helpers";
import { createMealLog } from "@/lib/body/api";

export async function POST(request: Request) {
  return withBodyApi(request, async () => {
    const body = (await request.json()) as Record<string, unknown>;
    const date = isoDate(body.date);
    if (!date) throw new Error("Invalid date");
    const items = Array.isArray(body.items)
      ? (body.items as Array<Record<string, unknown>>).map((item) => ({
          foodId: str(item.foodId),
          servings: num(item.servings, 1),
        }))
      : undefined;
    return createMealLog({
      date,
      slot: str(body.slot),
      notes: body.notes != null ? str(body.notes) : undefined,
      items,
    });
  });
}
