import { withBodyApi, isoDate, str } from "@/lib/body/api-helpers";
import { undoRotation } from "@/lib/body/api";

export async function POST(request: Request) {
  return withBodyApi(request, async () => {
    const body = (await request.json()) as Record<string, unknown>;
    const date = isoDate(str(body.date));
    if (!date) throw new Error("Invalid date");
    return undoRotation(date);
  });
}
