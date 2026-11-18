import { withBodyApi, str } from "@/lib/body/api-helpers";
import { lookupBarcodeFood } from "@/lib/body/api";

export async function POST(request: Request) {
  return withBodyApi(request, async () => {
    const body = (await request.json()) as Record<string, unknown>;
    const code = str(body.code).trim();
    if (!code) throw new Error("code is required");
    return lookupBarcodeFood(code);
  });
}
