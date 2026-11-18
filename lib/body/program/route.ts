import { withBodyApi, num, str } from "@/lib/body/api-helpers";
import { getProgram, putProgram } from "@/lib/body/api";

export async function GET(request: Request) {
  return withBodyApi(request, async () => getProgram());
}

export async function PUT(request: Request) {
  return withBodyApi(request, async () => {
    const body = (await request.json()) as Record<string, unknown>;
    const days = Array.isArray(body.days)
      ? (body.days as Array<Record<string, unknown>>).map((day) => ({
          weekday: num(day.weekday),
          name: day.name != null ? str(day.name) : null,
          exercises: Array.isArray(day.exercises)
            ? (day.exercises as Array<Record<string, unknown>>).map(
                (ex, idx) => ({
                  exerciseId: str(ex.exerciseId),
                  sortOrder: ex.sortOrder != null ? num(ex.sortOrder) : idx,
                  plannedSets: num(ex.plannedSets, 3),
                  plannedReps: num(ex.plannedReps, 8),
                  targetWeight:
                    ex.targetWeight != null ? num(ex.targetWeight) : null,
                }),
              )
            : [],
        }))
      : [];
    return putProgram({
      name: body.name != null ? str(body.name) : undefined,
      days,
    });
  });
}
