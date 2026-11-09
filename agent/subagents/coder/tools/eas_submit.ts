import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { requireCoderUserId } from "@/lib/coder/principal";
import { environment } from "../sandbox.ts";

export default defineTool({
  approval: always(),
  description:
    "Submit a finished EAS iOS build to TestFlight (default) or the App Store. " +
    "Always needs approval — separate from eas_build. Pass only a build id " +
    "this task already received from eas_build.",
  inputSchema: z.object({
    buildId: z.string().min(1).describe("EAS build id from eas_build."),
    destination: z
      .enum(["testflight", "app-store"])
      .default("testflight")
      .describe("testflight (default) or app-store."),
    workingDirectory: z
      .string()
      .nullish()
      .describe("Optional Expo app root under /workspace."),
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
    const result = await sandbox.run({
      command: `npx --yes eas-cli submit --platform ios --id ${shellSingleQuote(input.buildId)} --non-interactive`,
      workingDirectory: cwd,
      env: { EXPO_TOKEN: expoToken },
    });

    if (result.exitCode !== 0) {
      return {
        status: "error",
        error: `eas submit failed (exit ${result.exitCode}): ${truncate(redact(result.stderr || result.stdout, expoToken))}`,
        destination: input.destination,
      };
    }

    return {
      status: "ok",
      destination: input.destination,
      buildId: input.buildId,
      summary: truncate(redact(result.stdout || "Submit started.", expoToken)),
    };
  },
});

function shellSingleQuote(value: string): string {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

function redact(text: string, secret: string): string {
  return text.split(secret).join("[redacted]");
}

function truncate(text: string, max = 4_000): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}
