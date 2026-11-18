import { withBodyApi, num, str } from "@/lib/body/api-helpers";
import { createFood, listFoods } from "@/lib/body/api";

export async function GET(request: Request) {
  return withBodyApi(request, async () => listFoods());
}

export async function POST(request: Request) {
  return withBodyApi(request, async () => {
    const body = (await request.json()) as Record<string, unknown>;
    const name = str(body.name).trim();
    if (!name) throw new Error("name is required");
    return createFood({
      name,
      servingLabel: str(body.servingLabel) || undefined,
      calories: num(body.calories),
      proteinG: num(body.proteinG),
      carbsG: num(body.carbsG),
      fatG: num(body.fatG),
    });
  });
}
