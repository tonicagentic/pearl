import { withBodyApi, isoDate } from "@/lib/body/api-helpers";
import { suggestMealsForDate } from "@/lib/body/api";

type Ctx = { params: Promise<{ date: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const { date: raw } = await ctx.params;
  return withBodyApi(request, async () => {
    const date = isoDate(raw);
    if (!date) throw new Error("Invalid date");
    return suggestMealsForDate(date);
  });
}
