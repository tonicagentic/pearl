import { put } from "@vercel/blob";
import { generateImage } from "ai";
import { defineTool } from "eve/tools";
import { z } from "zod";

import {
  blockMessage,
  IMAGE_FALLBACK_CENTS,
} from "@/lib/billing/config";
import { assertCanSpend, recordUsage, usdToCents } from "@/lib/billing/ledger";
import { principalIdFromAuth } from "@/lib/billing/principal";
import { GATEWAY_PROVIDER_OPTIONS } from "../agent.ts";
import {
  currentImageModelId,
  isPlanMode,
  planModeBlocked,
} from "#lib/turn-context.js";

/**
 * Generate a pictorial image via the AI Gateway and upload the PNG to Blob.
 *
 * The model id comes from clientContext.eveImageModelSelection (allowlisted),
 * synced into turn intent on step.started — never from the tool arguments.
 * Gateway data policy matches chat: US zone, zero data retention, no prompt
 * training. Fail closed when no compliant provider is available — do not
 * switch models silently.
 */
export default defineTool({
  description:
    "Generate a pictorial image for a design deliverable and return a public " +
    "Blob URL. Use for illustration, texture, or photographic work after " +
    "loading graphic-design (or another design skill). Geometric marks and " +
    "type-led posters should be SVG via write_file instead. The image model " +
    "comes from Models settings, not from this tool's arguments.",
  async execute(input, ctx) {
    if (isPlanMode()) {
      return {
        success: false,
        error: planModeBlocked("generate_image").error,
        url: "",
        downloadUrl: "",
        model: "",
        prompt: input.prompt,
      };
    }

    const userId = principalIdFromAuth(
      (
        ctx as {
          session?: {
            auth?: {
              current?: { principalId?: string };
              initiator?: { principalId?: string };
            };
          };
        }
      ).session?.auth,
    );

    let reservationId: string | null = null;
    if (userId) {
      const gate = await assertCanSpend({
        userId,
        cents: IMAGE_FALLBACK_CENTS,
        reason: "generate_image",
      });
      if (!gate.ok) {
        return {
          success: false,
          error: blockMessage(gate.reason),
          url: "",
          downloadUrl: "",
          model: "",
          prompt: input.prompt,
        };
      }
      reservationId = gate.reservationId;
    }

    const model = currentImageModelId();

    try {
      const result = await generateImage({
        model,
        prompt: input.prompt,
        n: 1,
        ...(input.size
          ? { size: input.size as `${number}x${number}` }
          : {}),
        ...(input.aspectRatio
          ? { aspectRatio: input.aspectRatio as `${number}:${number}` }
          : {}),
        seed: input.seed,
        providerOptions: {
          gateway: GATEWAY_PROVIDER_OPTIONS,
        },
      });

      const file = result.image;
      const bytes = file.uint8Array;
      const contentType = file.mediaType || "image/png";
      const ext = contentType.includes("jpeg")
        ? "jpg"
        : contentType.includes("webp")
          ? "webp"
          : "png";
      const slug =
        input.pathname?.replace(/^\/+/, "") ||
        `design/generated/${Date.now()}.${ext}`;

      const blob = await put(slug, Buffer.from(bytes), {
        access: "public",
        addRandomSuffix: true,
        contentType,
      });

      if (userId) {
        const usage = (result as unknown as { usage?: { costUsd?: number } })
          .usage;
        const providerCost =
          typeof usage?.costUsd === "number" ? usage.costUsd : null;
        const costCents =
          usdToCents(providerCost) || IMAGE_FALLBACK_CENTS;
        try {
          await recordUsage({
            idempotencyKey: `image:${blob.pathname}`,
            userId,
            source: "image",
            costCents,
            reservationId,
            metadata: { model, pathname: blob.pathname },
          });
        } catch (error) {
          console.error("[generate_image] billing", error);
        }
      }

      return {
        success: true,
        url: blob.url,
        downloadUrl: blob.downloadUrl,
        pathname: blob.pathname,
        contentType,
        model,
        prompt: input.prompt,
        width: undefined as number | undefined,
        height: undefined as number | undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const noProvider =
        /no_providers_available|No.*provider/i.test(message) ||
        /zero.?data.?retention|inferenceRegion/i.test(message);
      return {
        success: false,
        error: noProvider
          ? `Image model "${model}" has no provider that meets the US / zero-data-retention policy. Choose another image model in Models settings, or retry later. (${message})`
          : message,
        url: "",
        downloadUrl: "",
        model,
        prompt: input.prompt,
      };
    }
  },
  inputSchema: z.object({
    prompt: z
      .string()
      .min(1)
      .describe("Image generation prompt. Be concrete about subject, composition, and style."),
    size: z
      .string()
      .regex(/^\d+x\d+$/)
      .optional()
      .describe('Pixel size as WIDTHxHEIGHT, e.g. "1024x1024".'),
    aspectRatio: z
      .string()
      .regex(/^\d+:\d+$/)
      .optional()
      .describe('Aspect ratio as W:H, e.g. "16:9". Prefer size or aspectRatio, not both.'),
    seed: z.number().int().optional().describe("Optional seed for reproducibility."),
    pathname: z
      .string()
      .optional()
      .describe(
        'Optional Blob pathname prefix, e.g. "design/poster.png". A random suffix is always added.',
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
    url: z.string(),
    downloadUrl: z.string(),
    pathname: z.string().optional(),
    contentType: z.string().optional(),
    model: z.string(),
    prompt: z.string(),
    width: z.number().optional(),
    height: z.number().optional(),
  }),
});
