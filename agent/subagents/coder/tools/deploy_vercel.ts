import { authenticateVercel } from "eve/extensions/code/sandbox";
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { brokerVercelHeaders } from "@/lib/coder/network-policy";
import { requireCoderUserId } from "@/lib/coder/principal";
import { getVercelUserToken } from "@/lib/connections/tokens";
import { environment } from "../sandbox.ts";

export default defineTool({
  approval: always(),
  description:
    "Deploy the current sandbox checkout to the signed-in user's Vercel " +
    "account. Preview is the default; production only when target is " +
    "production. Always needs approval — the card must name the target.",
  inputSchema: z.object({
    target: z
      .enum(["preview", "production"])
      .default("preview")
      .describe("preview (default) or production."),
    workingDirectory: z
      .string()
      .nullish()
      .describe("Optional path under /workspace for the app root."),
  }),
  async execute(input, ctx) {
    const auth = requireCoderUserId(ctx.session.auth.current);
    if ("error" in auth) return { status: "error", error: auth.error };

    let token: string;
    try {
      token = await getVercelUserToken(auth.userId);
    } catch (cause) {
      return {
        status: "error",
        error: cause instanceof Error ? cause.message : "Vercel token unavailable.",
      };
    }

    const sandbox = await ctx.getSandbox(environment);
    await authenticateVercel(sandbox, {
      token,
      delivery: "firewall",
      broker: brokerVercelHeaders,
    });

    const cwd = input.workingDirectory?.trim() || undefined;
    const prodFlag = input.target === "production" ? " --prod" : "";
    const result = await sandbox.run({
      command: `vc deploy --yes${prodFlag}`,
      workingDirectory: cwd,
    });

    // Drop the leased Vercel headers after the command.
    await brokerVercelHeaders(sandbox, {});

    if (result.exitCode !== 0) {
      return {
        status: "error",
        error: `vc deploy failed (exit ${result.exitCode}): ${truncate(result.stderr || result.stdout)}`,
        target: input.target,
      };
    }

    const url = extractHttpsUrl(result.stdout) ?? extractHttpsUrl(result.stderr);
    return {
      status: "ok",
      target: input.target,
      url,
      summary: truncate(result.stdout || "Deploy finished."),
    };
  },
});


function extractHttpsUrl(text: string): string | null {
  const match = text.match(/https:\/\/[^\s]+/);
  return match?.[0]?.replace(/[.,)]+$/, "") ?? null;
}

function truncate(text: string, max = 4_000): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}
