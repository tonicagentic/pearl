import { withBodyApi, str } from "@/lib/body/api-helpers";
import { getFoodByBarcode } from "@/lib/body/api";

export async function GET(request: Request) {
  return withBodyApi(request, async () => {
    const url = new URL(request.url);
    const code = str(url.searchParams.get("code")).trim();
    if (!code) throw new Error("code is required");
    return getFoodByBarcode(code);
  });
}
