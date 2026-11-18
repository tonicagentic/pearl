import { withBodyApi, isoDate, num, str } from "@/lib/body/api-helpers";
import { createWeighIn, listWeighIns } from "@/lib/body/api";

export async function GET(request: Request) {
  return withBodyApi(request, async () => listWeighIns());
}

export async function POST(request: Request) {
  return withBodyApi(request, async () => {
    const body = (await request.json()) as Record<string, unknown>;
    const date = isoDate(body.date);
    if (!date) throw new Error("Invalid date");
    return createWeighIn({
      date,
      weightLbs: num(body.weightLbs),
      notes: body.notes != null ? str(body.notes) : undefined,
    });
  });
}
