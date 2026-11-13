import { defineTool } from "eve/tools";
import { z } from "zod";

import { upsertChatPreviewForSession } from "@/lib/db/chat-previews";
import { requireCoderUserId } from "@/lib/coder/principal";
import {
  buildDevServerPreview,
  resolveDevScript,
} from "@/lib/workbench/previews";
import { environment } from "../sandbox.ts";

type DomainCapable = {
  readonly domain?: (port: number) => string;
  readonly name?: string;
};

/**
 * Start the checked-out repo's package.json dev script and publish its port
 * on the sandbox's public *.vercel.run host for the Computer tab.
 */
export default defineTool({
  description:
    "Start the repo's own package.json `dev` (or `start`) script in the " +
    "sandbox and publish that port as a https://*.vercel.run URL for the " +
    "phone Computer tab. Does not assume Next.js. Restart after big edits " +
    "if hot reload through the proxy fails. Prefer deploy_vercel for a " +
    "durable preview after the sandbox times out (45 min).",
  inputSchema: z.object({
    repoFullName: z
      .string()
      .min(1)
      .describe("owner/name of the repo being previewed."),
    workingDirectory: z
      .string()
      .nullish()
      .describe("Optional app root under /workspace."),
    port: z
      .number()
      .int()
      .positive()
      .nullish()
      .describe("Override the port guessed from the package.json script."),
  }),
  async execute(input, ctx) {
    const auth = requireCoderUserId(ctx.session.auth.current);
    if ("error" in auth) return { status: "error", error: auth.error };

    const sandbox = await ctx.getSandbox(environment);
    const cwd = input.workingDirectory?.trim() || undefined;

    const pkgRaw = await sandbox.readTextFile({
      path: cwd ? `${cwd}/package.json` : "package.json",
    });
    if (!pkgRaw) {
      return {
        status: "error",
        error: "No package.json found in the working directory.",
      };
    }

    let pkg: { scripts?: Record<string, string> };
    try {
      pkg = JSON.parse(pkgRaw) as { scripts?: Record<string, string> };
    } catch {
      return { status: "error", error: "package.json is not valid JSON." };
    }

    const resolved = resolveDevScript(pkg);
    const port = input.port ?? resolved.port;
    const script = resolved.script;

    // Detached-ish: run in background with nohup so the tool can return.
    const start = await sandbox.run({
      command:
        `mkdir -p /tmp/pearl-previews && ` +
        `(PORT=${port} pnpm run ${script} > /tmp/pearl-previews/dev.log 2>&1 & echo $!)`,
      workingDirectory: cwd,
    });
    if (start.exitCode !== 0) {
      return {
        status: "error",
        error: `Failed to start ${script}: ${start.stderr || start.stdout}`,
      };
    }

    // Wait briefly for listen.
    await sandbox.run({
      command: `for i in 1 2 3 4 5 6 7 8 9 10; do curl -sf -o /dev/null http://127.0.0.1:${port}/ && exit 0; sleep 1; done; exit 1`,
    });

    const capable = sandbox as unknown as DomainCapable;
    let hostname: string | null = null;
    try {
      if (typeof capable.domain === "function") {
        hostname = capable.domain(port).replace(/^https?:\/\//i, "");
      }
    } catch (cause) {
      return {
        status: "error",
        error:
          cause instanceof Error
            ? `Port ${port} is not published on this sandbox: ${cause.message}`
            : `Port ${port} is not published on this sandbox.`,
      };
    }

    if (!hostname) {
      return {
        status: "error",
        error:
          `Could not resolve a public domain for port ${port}. ` +
          "Use deploy_vercel for a durable preview URL instead.",
      };
    }

    const preview = buildDevServerPreview({
      repoFullName: input.repoFullName.trim(),
      script,
      port,
      hostname,
    });

    const sessionId = ctx.session.id;
    await upsertChatPreviewForSession(sessionId, preview).catch(() => null);

    return {
      status: "ok",
      url: preview.url,
      label: preview.label,
      script,
      port,
      note: "Open this URL on the Computer tab. Sandbox ends in ~45 minutes.",
    };
  },
});
