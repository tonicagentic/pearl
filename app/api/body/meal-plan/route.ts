import { withBodyApi, num, str } from "@/lib/body/api-helpers";
import { getMealPlan, putMealPlan } from "@/lib/body/api";

export async function GET(request: Request) {
  return withBodyApi(request, async () => getMealPlan());
}

export async function PUT(request: Request) {
  return withBodyApi(request, async () => {
    const body = (await request.json()) as Record<string, unknown>;
    const meals = Array.isArray(body.meals)
      ? (body.meals as Array<Record<string, unknown>>).map((meal) => ({
          weekday: num(meal.weekday),
          slot: str(meal.slot),
          items: Array.isArray(meal.items)
            ? (meal.items as Array<Record<string, unknown>>).map((item) => ({
                foodId: str(item.foodId),
                servings: num(item.servings, 1),
              }))
            : [],
        }))
      : [];
    return putMealPlan({
      name: body.name != null ? str(body.name) : undefined,
      meals,
    });
  });
}
