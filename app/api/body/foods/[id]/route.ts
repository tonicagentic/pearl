import { withBodyApi, num, str } from "@/lib/body/api-helpers";
import { deleteFood, updateFood } from "@/lib/body/api";
import { isMealSlot, type MealSlot } from "@/lib/body/slots";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withBodyApi(request, async () => {
    const body = (await request.json()) as Record<string, unknown>;
    let slot: MealSlot | null | undefined = undefined;
    if (body.slot === null || body.slot === "") {
      slot = null;
    } else if (body.slot != null) {
      if (!isMealSlot(body.slot)) {
        throw new Error(`Invalid meal slot: ${String(body.slot)}`);
      }
      slot = body.slot;
    }
    const barcode =
      body.barcode === null || body.barcode === ""
        ? null
        : body.barcode != null
          ? str(body.barcode)
          : undefined;
    return updateFood(id, {
      name: body.name != null ? str(body.name) : undefined,
      servingLabel:
        body.servingLabel != null ? str(body.servingLabel) : undefined,
      slot,
      barcode,
      calories: body.calories != null ? num(body.calories) : undefined,
      proteinG: body.proteinG != null ? num(body.proteinG) : undefined,
      carbsG: body.carbsG != null ? num(body.carbsG) : undefined,
      fatG: body.fatG != null ? num(body.fatG) : undefined,
    });
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withBodyApi(request, async () => deleteFood(id));
}
