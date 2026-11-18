import { withBodyApi, isoDate, str } from "@/lib/body/api-helpers";
import { completeRotation } from "@/lib/body/api";

export async function POST(request: Request) {
  return withBodyApi(request, async () => {
    const body = (await request.json()) as Record<string, unknown>;
    const date = isoDate(str(body.date));
    if (!date) throw new Error("Invalid date");
    return completeRotation(date);
  });
}
