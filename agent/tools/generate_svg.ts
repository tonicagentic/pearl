import { generateText } from "ai";
import { defineDynamic, defineTool } from "eve/tools";
import {
  imageSurfaceEnabled,
  latestUserHint,
} from "#lib/lane-state.js";
import { writeFile } from "eve/tools/write_file";
import { z } from "zod";

import { persistAgentFile } from "@/agent/tools/write_file";
import {
  prepareSvgDocument,
  workspaceSvgPath,
} from "@/lib/design/svg";
import {
  currentVectorModelId,
  isPlanMode,
  planModeBlocked,
} from "#lib/turn-context.js";

type ToolCtx = {
  session: { id: string };
};

const DEFAULT_MAX_OUTPUT_TOKENS = 16_384;
const MAX_OUTPUT_TOKENS_CAP = 65_536;

const SVG_SYSTEM_WRAPPER =
  "Return exactly one complete SVG document and nothing else. " +
  "Start with <svg and end with </svg>. No markdown fences, no commentary, " +
  "no explanation before or after the SVG.";

/**
 * Generate an editable SVG via Quiver Arrow models on the AI Gateway.
 *
 * The model id comes from clientContext.eveVectorModelSelection (allowlisted),
 * synced into turn intent on step.started — never from the tool arguments.
 *
 * Intentional policy exception: do NOT attach GATEWAY_PROVIDER_OPTIONS
 * (US region / zero data retention / no prompt training). QuiverAI is not a
 * ZDR gateway provider, so those filters fail closed. Raster generate_image
 * keeps the full policy; this tool alone omits it.
 */
const tool = defineTool({
  description:
    "Generate an editable SVG with Quiver Arrow (text-to-SVG) and write it to " +
    "the workspace. Use after loading vector-graphics (or logo/icon/" +
    "illustration skills) when shapes are easier to describe than to hand-" +
    "author. Prefer write_file for exact simple geometry. The vector model " +
    "comes from Models settings (Vector picker), not from this tool's " +
    "arguments. Does not vectorize, edit, or animate existing files.",
  async execute(input, ctx) {
    if (isPlanMode()) {
      return {
        success: false,
        error: planModeBlocked("generate_svg").error,
        filePath: "",
        model: "",
        prompt: input.prompt,
      };
    }

    const model = currentVectorModelId();
    const maxOutputTokens = Math.min(
      Math.max(input.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS, 1),
      MAX_OUTPUT_TOKENS_CAP,
    );
    const filePath = workspaceSvgPath(input.filePath);

    try {
      // No providerOptions.gateway — see file comment above.
      const result = await generateText({
        model,
        prompt: `${SVG_SYSTEM_WRAPPER}\n\n${input.prompt}`,
        maxOutputTokens,
      });

      const svg = prepareSvgDocument(result.text);
      if (!svg) {
        return {
          success: false,
          error:
            "The vector model did not return a complete <svg>…</svg> document. " +
            "Tighten the prompt or retry.",
          filePath: "",
          model,
          prompt: input.prompt,
        };
      }

      await writeFile.execute(
        { filePath, content: svg },
        ctx as never,
      );
      await persistAgentFile(ctx as ToolCtx, filePath, svg);

      return {
        success: true,
        filePath,
        model,
        prompt: input.prompt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: message,
        filePath: "",
        model,
        prompt: input.prompt,
      };
    }
  },
  inputSchema: z.object({
    prompt: z
      .string()
      .min(1)
      .describe(
        "Vector brief: subject, use and size, style, colors, composition, " +
          "required details, and what to avoid.",
      ),
    filePath: z
      .string()
      .optional()
      .describe(
        'Workspace path or slug for the SVG, e.g. "/workspace/mark.svg" or "mark".',
      ),
    maxOutputTokens: z
      .number()
      .int()
      .min(1)
      .max(MAX_OUTPUT_TOKENS_CAP)
      .optional()
      .describe(
        `Upper bound for SVG tokens (default ${DEFAULT_MAX_OUTPUT_TOKENS}, max ${MAX_OUTPUT_TOKENS_CAP}).`,
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
    filePath: z.string(),
    model: z.string(),
    prompt: z.string(),
  }),
});

export default defineDynamic(async (ctx) =>
  imageSurfaceEnabled(latestUserHint(await ctx.messages())) ? tool : null,
);

