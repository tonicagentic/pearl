import { withBodyApi } from "@/lib/body/api-helpers";
import { deleteMealLogItem } from "@/lib/body/api";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withBodyApi(request, async () => deleteMealLogItem(id));
}
