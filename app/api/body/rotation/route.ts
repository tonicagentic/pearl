import { withBodyApi } from "@/lib/body/api-helpers";
import { getRotation, putRotation } from "@/lib/body/api";

export async function GET(request: Request) {
  return withBodyApi(request, async () => getRotation());
}

export async function PUT(request: Request) {
  return withBodyApi(request, async () => {
    const body = (await request.json()) as {
      steps?: Array<{ muscles?: string[] }>;
    };
    if (!Array.isArray(body.steps)) {
      throw new Error("steps is required");
    }
    return putRotation({
      steps: body.steps.map((s) => ({
        muscles: Array.isArray(s.muscles) ? s.muscles : [],
      })),
    });
  });
}
