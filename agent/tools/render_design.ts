import { defineTool } from "eve/tools";
import { writeFile } from "eve/tools/write_file";
import { z } from "zod";

import { persistAgentFile } from "@/agent/tools/write_file";
import { renderHtmlToPdf, renderMermaidToSvg } from "@/lib/design/render";
import { isPlanMode, planModeBlocked } from "#lib/turn-context.js";

type SandboxLike = {
  readTextFile(input: { path: string }): Promise<string | null>;
};

type ToolCtx = {
  getSandbox: () => Promise<SandboxLike>;
  session: { id: string };
};

/**
 * Render a design source file to a downloadable deliverable:
 * - pdf: workspace HTML → print PDF (Playwright in a Vercel Sandbox)
 * - diagram: Mermaid source → SVG (uploaded + written back to the workspace)
 */
export default defineTool({
  description:
    "Render a design deliverable. kind=pdf turns workspace print HTML into a " +
    "PDF; kind=diagram turns Mermaid (.mmd or inline source) into an SVG. " +
    "Use after write_file for print-design or diagrams. Returns a Blob URL; " +
    "diagrams also write the SVG into the workspace for the canvas.",
  async execute(input, ctx) {
    if (isPlanMode()) {
      return {
        success: false,
        error: planModeBlocked("render_design").error,
        kind: input.kind,
        url: "",
        downloadUrl: "",
      };
    }

    const toolCtx = ctx as unknown as ToolCtx;

    try {
      if (input.kind === "pdf") {
        const html = await readWorkspaceText(toolCtx, input.filePath);
        if (!html) {
          return {
            success: false,
            error: `Could not read HTML at ${input.filePath}.`,
            kind: input.kind,
            url: "",
            downloadUrl: "",
          };
        }
        const result = await renderHtmlToPdf({
          html,
          pathname: input.outputPathname ?? "design/print.pdf",
        });
        return {
          success: true,
          kind: input.kind,
          url: result.url,
          downloadUrl: result.downloadUrl,
          pathname: result.pathname,
          contentType: result.contentType,
          bytes: result.bytes,
          sourcePath: input.filePath,
        };
      }

      // diagram
      const source =
        input.source?.trim() ||
        (input.filePath
          ? await readWorkspaceText(toolCtx, input.filePath)
          : null);
      if (!source) {
        return {
          success: false,
          error:
            "Provide Mermaid source or a workspace .mmd filePath for kind=diagram.",
          kind: input.kind,
          url: "",
          downloadUrl: "",
        };
      }

      const result = await renderMermaidToSvg({
        source,
        pathname: input.outputPathname ?? "design/diagram.svg",
      });

      const svgPath =
        input.svgFilePath ||
        (input.filePath
          ? input.filePath.replace(/\.mmd$/i, ".svg")
          : "/workspace/diagram.svg");

      await writeFile.execute(
        { filePath: svgPath, content: result.svg },
        ctx as never,
      );
      await persistAgentFile(toolCtx, svgPath, result.svg);

      return {
        success: true,
        kind: input.kind,
        url: result.url,
        downloadUrl: result.downloadUrl,
        pathname: result.pathname,
        contentType: result.contentType,
        svgFilePath: svgPath,
        sourcePath: input.filePath,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        kind: input.kind,
        url: "",
        downloadUrl: "",
      };
    }
  },
  inputSchema: z.object({
    kind: z
      .enum(["pdf", "diagram"])
      .describe("pdf = print HTML to PDF; diagram = Mermaid to SVG."),
    filePath: z
      .string()
      .optional()
      .describe(
        "Absolute workspace path to the source (.html for pdf, .mmd for diagram).",
      ),
    source: z
      .string()
      .optional()
      .describe("Inline Mermaid source when kind=diagram and no filePath."),
    svgFilePath: z
      .string()
      .optional()
      .describe(
        "Workspace path for the written SVG when kind=diagram. Defaults to replacing .mmd with .svg.",
      ),
    outputPathname: z
      .string()
      .optional()
      .describe("Optional Blob pathname for the uploaded deliverable."),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
    kind: z.enum(["pdf", "diagram"]),
    url: z.string(),
    downloadUrl: z.string(),
    pathname: z.string().optional(),
    contentType: z.string().optional(),
    bytes: z.number().optional(),
    svgFilePath: z.string().optional(),
    sourcePath: z.string().optional(),
  }),
});

async function readWorkspaceText(
  ctx: ToolCtx,
  filePath: string | undefined,
): Promise<string | null> {
  if (!filePath) return null;
  const sandbox = await ctx.getSandbox();
  return sandbox.readTextFile({ path: filePath });
}
