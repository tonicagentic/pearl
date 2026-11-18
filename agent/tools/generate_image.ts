import { generateImage } from "ai";
import { defineDynamic, defineTool } from "eve/tools";
import {
  imageSurfaceEnabled,
  latestUserHint,
} from "#lib/lane-state.js";
import { z } from "zod";

import { contentTypeForWorkspacePath } from "@/agent/lib/design-files";
import { persistAgentFileBinary } from "@/lib/agent/persist-agent-file";
import { putPrivateBlob } from "@/lib/blob/private";
import {
  blockMessage,
  IMAGE_FALLBACK_CENTS,
} from "@/lib/billing/config";
import { assertCanSpend, recordUsage } from "@/lib/billing/ledger";
import { principalIdFromAuth } from "@/lib/billing/principal";
import {
  imageMicros,
  microsToUsd,
} from "@/lib/billing/provider-pricing";
import { GATEWAY_ZDR_PROVIDER_OPTIONS } from "../agent.ts";
import {
  currentImageModelId,
  isPlanMode,
  planModeBlocked,
} from "#lib/turn-context.js";

type SandboxBinaryWriter = {
  writeBinaryFile: (options: {
    path: string;
    content: Uint8Array;
  }) => PromiseLike<void>;
};

/**
 * Generate a pictorial image via the AI Gateway, write it into the session
 * sandbox under `/workspace/design/generated/…`, and mirror it to private
 * Blob + agent_file so Computer → Workspace files can list it.
 *
 * The model id comes from clientContext.eveImageModelSelection (allowlisted),
 * synced into turn intent on step.started — never from the tool arguments.
 * Gateway data policy requires ZDR + no prompt training, but not a US zone
 * pin — image catalog endpoints often lack one even when ZDR-cleared. Fail
 * closed when no compliant provider is available — do not switch models
 * silently.
 */
const tool = defineTool({
  description:
    "Generate a pictorial image for a design deliverable, save it into the " +
    "session workspace filesystem, and return a signed Blob URL for chat. " +
    "Use for illustration, texture, or photographic work after loading " +
    "graphic-design (or another design skill). Geometric marks and type-led " +
    "posters should be SVG via write_file instead. The image model comes " +
    "from Models settings, not from this tool's arguments.",
  label: {
    start(input) {
      const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
      if (prompt) {
        const short = prompt.length > 40 ? `${prompt.slice(0, 39)}…` : prompt;
        return `Generating image · ${short}`;
      }
      return "Generating image";
    },
    complete() {
      return "Generated image";
    },
  },
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
      // Many image endpoints (incl. Grok Imagine) reject size / aspectRatio /
      // seed with HTTP 422. Prefer aspect over size when both are set; on
      // Unprocessable Entity retry once with prompt-only so the first visible
      // tool call succeeds instead of failing then re-invoking.
      const sizedCall = {
        model,
        prompt: input.prompt,
        n: 1 as const,
        providerOptions: {
          gateway: GATEWAY_ZDR_PROVIDER_OPTIONS,
        },
        ...(input.aspectRatio
          ? { aspectRatio: input.aspectRatio as `${number}:${number}` }
          : input.size
            ? { size: input.size as `${number}x${number}` }
            : {}),
        ...(typeof input.seed === "number" ? { seed: input.seed } : {}),
      };
      const bareCall = {
        model,
        prompt: input.prompt,
        n: 1 as const,
        providerOptions: {
          gateway: GATEWAY_ZDR_PROVIDER_OPTIONS,
        },
      };

      let result: Awaited<ReturnType<typeof generateImage>>;
      try {
        result = await generateImage(sizedCall);
      } catch (firstError) {
        const firstMessage =
          firstError instanceof Error ? firstError.message : String(firstError);
        // 422 is usually unsupported size/aspect/seed (or a transient gateway
        // reject). One in-tool retry avoids a failed card + a second billed
        // tool call from the model — generation only runs again if the first
        // attempt never produced an image.
        if (!/unprocessable|422|invalid.*(size|aspect|seed|parameter)/i.test(
          firstMessage,
        )) {
          throw firstError;
        }
        const hadGeometry =
          Boolean(input.size) ||
          Boolean(input.aspectRatio) ||
          typeof input.seed === "number";
        result = await generateImage(hadGeometry ? bareCall : sizedCall);
      }

      const file = result.image;
      const bytes = file.uint8Array;
      const contentType = file.mediaType || "image/png";
      const ext = contentType.includes("jpeg")
        ? "jpg"
        : contentType.includes("webp")
          ? "webp"
          : "png";
      const random = Math.random().toString(36).slice(2, 10);
      const requested = input.pathname?.replace(/^\/+/, "").trim();
      const relative = requested
        ? requested.replace(/\.[^.]+$/, "") + `-${random}.${ext}`
        : `design/generated/${Date.now()}-${random}.${ext}`;
      const filePath = relative.startsWith("workspace/")
        ? `/${relative}`
        : `/workspace/${relative.replace(/^workspace\//, "")}`;
      const mime = contentTypeForWorkspacePath(filePath) || contentType;

      // Session filesystem first — Computer tree + agent reads need a real path.
      try {
        const sandbox = (await (
          ctx as { getSandbox: () => PromiseLike<unknown> }
        ).getSandbox()) as SandboxBinaryWriter;
        await sandbox.writeBinaryFile({ path: filePath, content: bytes });
      } catch (error) {
        console.error("[generate_image] sandbox write", error);
      }

      // Durable mirror under artifacts/ + agent_file (signed GET for chat UI).
      const persistence = await persistAgentFileBinary(
        ctx as { session: { id: string } },
        filePath,
        bytes,
        mime,
      );

      let url = persistence.url ?? "";
      let downloadUrl = persistence.downloadUrl ?? "";
      let pathname = persistence.blobPathname;

      // Fallback when chat link / artifacts put is not ready yet: still give
      // the UI a signed URL from a private put outside the artifacts prefix.
      if (!url) {
        const blob = await putPrivateBlob(relative, Buffer.from(bytes), {
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: mime,
        });
        url = blob.url;
        downloadUrl = blob.downloadUrl;
        pathname = blob.pathname;
      }

      if (userId) {
        // AI SDK image usage is tokens-only; Gateway list price is the source
        // of truth unless a provider somehow reports a dollar cost.
        const usage = (
          result as unknown as {
            usage?: { costUsd?: number };
            providerMetadata?: Record<string, { costUsd?: number }>;
          }
        ).usage;
        const metaCost = Object.values(result.providerMetadata ?? {}).find(
          (entry) =>
            entry &&
            typeof entry === "object" &&
            typeof (entry as { costUsd?: unknown }).costUsd === "number",
        ) as { costUsd?: number } | undefined;
        const reportedUsd =
          typeof usage?.costUsd === "number"
            ? usage.costUsd
            : typeof metaCost?.costUsd === "number"
              ? metaCost.costUsd
              : null;
        const priced = imageMicros({
          modelId: model,
          reportedUsd,
          imageCount: 1,
        });
        try {
          await recordUsage({
            idempotencyKey: `image:${pathname ?? filePath}`,
            userId,
            source: "image",
            costMicros: priced.micros,
            reservationId,
            metadata: {
              model,
              pathname,
              filePath,
              pricing: priced.pricing,
              costUsd: microsToUsd(priced.micros),
              costMicros: priced.micros,
            },
          });
        } catch (error) {
          console.error("[generate_image] billing", error);
        }
      }

      return {
        success: true,
        url,
        downloadUrl,
        pathname,
        filePath,
        contentType: mime,
        model,
        prompt: input.prompt,
        width: undefined as number | undefined,
        height: undefined as number | undefined,
        ...(persistence.persisted
          ? {}
          : persistence.note
            ? { note: persistence.note }
            : {}),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const noProvider =
        /no_providers_available|No.*provider/i.test(message) ||
        /zero.?data.?retention|inferenceRegion|disallowPromptTraining/i.test(
          message,
        );
      return {
        success: false,
        error: noProvider
          ? `Image model "${model}" has no provider that meets the zero-data-retention / no-training policy. Choose another image model in Models settings, or retry later. (${message})`
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
      .describe(
        'Pixel size as WIDTHxHEIGHT, e.g. "1024x1024". Many image models ignore or reject this — omit unless the user asks for a specific size.',
      ),
    aspectRatio: z
      .string()
      .regex(/^\d+:\d+$/)
      .optional()
      .describe(
        'Aspect ratio as W:H, e.g. "16:9". Prefer this over size; omit when unsure — unsupported values return 422.',
      ),
    seed: z
      .number()
      .int()
      .optional()
      .describe(
        "Optional seed for reproducibility. Omit unless the user asks — many models reject seed.",
      ),
    pathname: z
      .string()
      .optional()
      .describe(
        'Optional workspace-relative path, e.g. "design/poster.png". A random suffix is always added.',
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
    note: z.string().optional(),
    url: z.string(),
    downloadUrl: z.string(),
    pathname: z.string().optional(),
    filePath: z.string().optional(),
    contentType: z.string().optional(),
    model: z.string(),
    prompt: z.string(),
    width: z.number().optional(),
    height: z.number().optional(),
  }),
});

export default defineDynamic(async (ctx) =>
  imageSurfaceEnabled(latestUserHint(await ctx.messages())) ? tool : null,
);
