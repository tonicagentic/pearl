import { defineTool } from "eve/tools";
import { z } from "zod";

import { upsertChatPreviewForSession } from "@/lib/db/chat-previews";
import { requireCoderUserId } from "@/lib/coder/principal";
import { buildExpoSimulatorPreview } from "@/lib/workbench/previews";

/**
 * Store an Expo simulator dashboard URL on the Computer tab. Does not call
 * Expo — pass a URL returned by simulator_start / simulator_get on the expo
 * connection.
 */
export default defineTool({
  description:
    "Pin an Expo cloud simulator preview URL on the Computer tab after " +
    "simulator_start or simulator_get. Pass only an https URL from the Expo " +
    "MCP result, plus owner/repo for the label. Does not call Expo and does " +
    "not need EXPO_TOKEN.",
  inputSchema: z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    previewUrl: z
      .string()
      .url()
      .describe("https URL from simulator_start / simulator_get."),
  }),
  async execute(input, ctx) {
    const auth = requireCoderUserId(ctx.session.auth.current);
    if ("error" in auth) return { status: "error", error: auth.error };

    let url: URL;
    try {
      url = new URL(input.previewUrl.trim());
    } catch {
      return { status: "error", error: "previewUrl must be a valid URL." };
    }
    if (url.protocol !== "https:") {
      return { status: "error", error: "previewUrl must be an https URL." };
    }
    if (url.username || url.password) {
      return {
        status: "error",
        error: "previewUrl must not include credentials.",
      };
    }

    const preview = buildExpoSimulatorPreview({
      repoFullName: `${input.owner.trim()}/${input.repo.trim()}`,
      previewUrl: url.href,
    });
    await upsertChatPreviewForSession(ctx.session.id, preview).catch(() => null);

    return {
      status: "ok",
      previewUrl: preview.url,
      label: preview.label,
    };
  },
});
