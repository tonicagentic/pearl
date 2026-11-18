import { withBodyApi, num } from "@/lib/body/api-helpers";
import { listRecentFoods } from "@/lib/body/api";

export async function GET(request: Request) {
  return withBodyApi(request, async () => {
    const url = new URL(request.url);
    const limit = num(url.searchParams.get("limit"), 12);
    return listRecentFoods(limit);
  });
}
