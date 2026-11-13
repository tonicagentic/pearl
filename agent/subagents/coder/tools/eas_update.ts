import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { requireCoderUserId } from "@/lib/coder/principal";
import { buildApprovalCard } from "@/lib/workbench/approvals";
import {
  buildEasUpdateRequest,
  easUpdateCliArgs,
} from "@/lib/workbench/eas-update";
import { environment } from "../sandbox.ts";

/**
 * Publish an EAS Update to the pin's Expo project / channel.
 * Always needs approval. Separate from production deploy_vercel.
 */
export default defineTool({
  approval: always(),
  description:
    "Publish an Expo EAS Update (JavaScript OTA) to the named Expo project " +
    "and channel. Always needs approval. Never combine with production " +
    "deploy_vercel in one approval — they are separate cards. For Pearl, " +
    "the card warns that the installed phone app will change. Requires " +
    "EXPO_TOKEN. Native changes still need eas_build / eas_submit.",
  inputSchema: z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    expoProjectId: z
      .string()
      .nullish()
      .describe("Required for non-Pearl apps. Pearl may omit to use default."),
    channel: z.string().nullish().describe("Update channel (default preview)."),
    workingDirectory: z.string().nullish(),
    message: z.string().nullish(),
    fallbackToPearl: z
      .boolean()
      .nullish()
      .describe("Only true when this task is the Pearl mobile app itself."),
  }),
  async execute(input, ctx) {
    const auth = requireCoderUserId(ctx.session.auth.current);
    if ("error" in auth) return { status: "error", error: auth.error };

    const expoToken = process.env.EXPO_TOKEN?.trim();
    if (!expoToken) {
      return {
        status: "error",
        error: "EXPO_TOKEN is not configured on the server.",
      };
    }

    let request;
    try {
      request = buildEasUpdateRequest({
        expoProjectId: input.expoProjectId,
        channel: input.channel,
        workingDirectory: input.workingDirectory,
        message: input.message,
        fallbackToPearl: Boolean(input.fallbackToPearl),
      });
    } catch (cause) {
      return {
        status: "error",
        error: cause instanceof Error ? cause.message : "Invalid EAS Update request.",
      };
    }

    const card = buildApprovalCard({
      action: "eas_update",
      owner: input.owner,
      repo: input.repo,
      target: request.channel,
      detail: request.expoProjectId,
    });

    const sandbox = await ctx.getSandbox(environment);
    const cwd = request.workingDirectory || undefined;
    const args = easUpdateCliArgs(request);
    const quoted = args.map(shellSingleQuote).join(" ");
    const result = await sandbox.run({
      command: `npx --yes eas-cli ${quoted}`,
      workingDirectory: cwd,
      env: {
        EXPO_TOKEN: expoToken,
        EAS_PROJECT_ID: request.expoProjectId,
      },
    });

    if (result.exitCode !== 0) {
      return {
        status: "error",
        error: `eas update failed (exit ${result.exitCode}): ${truncate(redact(result.stderr || result.stdout, expoToken))}`,
        cardSummary: card.summary,
      };
    }

    const combined = redact(result.stdout || result.stderr, expoToken);
    return {
      status: "ok",
      expoProjectId: request.expoProjectId,
      channel: request.channel,
      isPearl: request.isPearl,
      url: extractHttpsUrl(combined),
      cardSummary: card.summary,
      summary: truncate(combined),
    };
  },
});

function shellSingleQuote(value: string): string {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

function extractHttpsUrl(text: string): string | null {
  const match = text.match(/https:\/\/[^\s]+/);
  return match?.[0]?.replace(/[.,)]+$/, "") ?? null;
}

function redact(text: string, secret: string): string {
  return text.split(secret).join("[redacted]");
}

function truncate(text: string, max = 4_000): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}
