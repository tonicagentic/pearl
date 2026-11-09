import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { requireCoderUserId } from "@/lib/coder/principal";
import { environment } from "../sandbox.ts";

export default defineTool({
  approval: always(),
  description:
    "Start an Expo EAS iOS build for the checkout (--non-interactive --no-wait). " +
    "Always needs approval. Returns the EAS build URL; does not wait for the " +
    "Mac build to finish. Requires EXPO_TOKEN on the server.",
  inputSchema: z.object({
    workingDirectory: z
      .string()
      .nullish()
      .describe("Optional Expo app root under /workspace."),
    profile: z
      .string()
      .nullish()
      .describe("Optional EAS build profile (default: production)."),
  }),
  async execute(input, ctx) {
    const auth = requireCoderUserId(ctx.session.auth.current);
    if ("error" in auth) return { status: "error", error: auth.error };

    const expoToken = process.env.EXPO_TOKEN?.trim();
    if (!expoToken) {
      return {
        status: "error",
        error:
          "EXPO_TOKEN is not configured on the server. Add it in the Pearl environment, then retry.",
      };
    }

    const sandbox = await ctx.getSandbox(environment);
    const cwd = input.workingDirectory?.trim() || undefined;
    const profile = input.profile?.trim() || "production";
    // Token only in the process env for this command — never written to disk.
    const result = await sandbox.run({
      command: `npx --yes eas-cli build --platform ios --profile ${shellSingleQuote(profile)} --non-interactive --no-wait`,
      workingDirectory: cwd,
      env: { EXPO_TOKEN: expoToken },
    });

    if (result.exitCode !== 0) {
      return {
        status: "error",
        error: `eas build failed (exit ${result.exitCode}): ${truncate(redact(result.stderr || result.stdout, expoToken))}`,
      };
    }

    const combined = redact(result.stdout || result.stderr, expoToken);
    return {
      status: "ok",
      platform: "ios",
      profile,
      url: extractHttpsUrl(combined),
      buildId: extractBuildId(combined),
      summary: truncate(combined),
    };
  },
});

function shellSingleQuote(value: string): string {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

function extractHttpsUrl(text: string): string | null {
  const match = text.match(/https:\/\/expo\.dev\/[^\s]+/);
  return match?.[0]?.replace(/[.,)]+$/, "") ?? extractAnyHttps(text);
}

function extractAnyHttps(text: string): string | null {
  const match = text.match(/https:\/\/[^\s]+/);
  return match?.[0]?.replace(/[.,)]+$/, "") ?? null;
}

function extractBuildId(text: string): string | null {
  const match =
    text.match(/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i) ??
    text.match(/builds\/([A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

function redact(text: string, secret: string): string {
  return text.split(secret).join("[redacted]");
}

function truncate(text: string, max = 4_000): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}
