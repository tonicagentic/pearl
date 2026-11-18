import { withBodyApi, isoDate, str } from "@/lib/body/api-helpers";
import { createSession } from "@/lib/body/api";

export async function POST(request: Request) {
  return withBodyApi(request, async () => {
    const body = (await request.json()) as Record<string, unknown>;
    const date = isoDate(body.date);
    if (!date) throw new Error("Invalid date");
    return createSession({
      date,
      fromProgram: body.fromProgram !== false,
      notes: body.notes != null ? str(body.notes) : undefined,
    });
  });
}
