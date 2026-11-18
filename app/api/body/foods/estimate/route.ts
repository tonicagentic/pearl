import { withBodyApi, str } from "@/lib/body/api-helpers";
import { estimateFoodNutrition } from "@/lib/body/api";
import { isMealSlot } from "@/lib/body/slots";

export async function POST(request: Request) {
  return withBodyApi(request, async () => {
    const body = (await request.json()) as Record<string, unknown>;
    const name = str(body.name).trim();
    if (!name) throw new Error("name is required");
    const slot =
      body.slot === null || body.slot === "" || body.slot == null
        ? null
        : isMealSlot(body.slot)
          ? body.slot
          : (() => {
              throw new Error(`Invalid meal slot: ${String(body.slot)}`);
            })();
    return estimateFoodNutrition({ name, slot });
  });
}
