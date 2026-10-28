import { defineTool } from "eve/tools";
import { z } from "zod";

import { listAppsForUser } from "@/lib/apps/create-service";

export default defineTool({
  description:
    "List the signed-in user's Pearl mini apps (id, slug, title, status, production URL).",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const principal = ctx.session.auth.current;
    const userId =
      principal?.principalType === "user" ? principal.principalId : null;
    if (!principal || !userId) {
      return { status: "error", error: "No signed-in user." };
    }

    const apps = await listAppsForUser(userId);
    return { status: "ok", apps };
  },
});
