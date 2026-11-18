import { withBodyApi, str } from "@/lib/body/api-helpers";
import { createExercise, listExercises } from "@/lib/body/api";

export async function GET(request: Request) {
  return withBodyApi(request, async () => listExercises());
}

export async function POST(request: Request) {
  return withBodyApi(request, async () => {
    const body = (await request.json()) as Record<string, unknown>;
    const name = str(body.name).trim();
    if (!name) throw new Error("name is required");
    return createExercise({
      name,
      muscleGroup: body.muscleGroup != null ? str(body.muscleGroup) : null,
    });
  });
}
