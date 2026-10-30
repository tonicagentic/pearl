import { defineTool } from "eve/tools";
import { z } from "zod";

import { captureAppScreenshot } from "@/lib/apps/preview-service";

export default defineTool({
  description:
    "Capture a PNG screenshot of a mini app's sandbox draft preview (or " +
    "production URL if published), upload it, and return a public image URL " +
    "to share in chat. Pass the app id from create_app / list_apps / code_with_fx.",
  inputSchema: z.object({
    appId: z.string().min(1).describe("Mini app id from create_app / list_apps."),
  }),
  async execute(input, ctx) {
    const principal = ctx.session.auth.current;
    const userId =
      principal?.principalType === "user" ? principal.principalId : null;
    if (!principal || !userId) {
      return { status: "error", error: "No signed-in user." };
    }

    return captureAppScreenshot({
      userId,
      appId: input.appId,
    });
  },
});
