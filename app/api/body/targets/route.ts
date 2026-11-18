import { withBodyApi, num } from "@/lib/body/api-helpers";
import { getTargets, putTargets } from "@/lib/body/api";
import { parseTrainingDays } from "@/lib/body/training";

export async function GET(request: Request) {
  return withBodyApi(request, async () => getTargets());
}

export async function PUT(request: Request) {
  return withBodyApi(request, async () => {
    const body = (await request.json()) as Record<string, unknown>;
    const trainingDays = Array.isArray(body.trainingDays)
      ? (body.trainingDays as number[])
      : typeof body.trainingDays === "string"
        ? parseTrainingDays(body.trainingDays)
        : [];
    return putTargets({
      calories: num(body.calories, 2000),
      proteinG: num(body.proteinG, 150),
      carbsG: num(body.carbsG, 200),
      fatG: num(body.fatG, 65),
      trainingDays,
    });
  });
}
