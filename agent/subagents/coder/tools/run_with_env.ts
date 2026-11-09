import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { requireCoderUserId } from "@/lib/coder/principal";
import { getVercelUserToken } from "@/lib/connections/tokens";
import { environment } from "../sandbox.ts";

const FORBIDDEN =
  /\b(printenv|env\b|export\s+-p|vercel\s+env\s+pull|dotenv|\.env\b|set\s+-a)\b/i;

export default defineTool({
  approval: always(),
  description:
    "Run one sandbox command with named Vercel environment variables injected " +
    "into that process only. Always needs approval — the card lists variable " +
    "names and the target (preview|production), never values. Refuses env " +
    "dumps, dotenv writes, and vercel env pull.",
  inputSchema: z.object({
    command: z.string().min(1).describe("Single shell command to run."),
    names: z
      .array(z.string().min(1))
      .min(1)
      .describe("Vercel env var names to inject (values never shown)."),
    target: z
      .enum(["preview", "production"])
      .describe("Which Vercel target to read env from."),
    workingDirectory: z.string().nullish(),
    projectId: z
      .string()
      .nullish()
      .describe("Optional Vercel project id; otherwise inferred from linkage."),
  }),
  async execute(input, ctx) {
    const auth = requireCoderUserId(ctx.session.auth.current);
    if ("error" in auth) return { status: "error", error: auth.error };

    if (FORBIDDEN.test(input.command)) {
      return {
        status: "error",
        error:
          "Refused: command looks like it prints the environment or writes env files.",
      };
    }

    let token: string;
    try {
      token = await getVercelUserToken(auth.userId);
    } catch (cause) {
      return {
        status: "error",
        error: cause instanceof Error ? cause.message : "Vercel token unavailable.",
      };
    }

    const target = input.target === "production" ? "production" : "preview";
    const env: Record<string, string> = {};
    const missing: string[] = [];

    for (const name of input.names) {
      const value = await fetchVercelEnvValue({
        token,
        key: name,
        target,
        projectId: input.projectId ?? undefined,
      });
      if (value === null) missing.push(name);
      else env[name] = value;
    }

    if (missing.length > 0) {
      return {
        status: "error",
        error: `Missing Vercel env vars for ${target}: ${missing.join(", ")}.`,
      };
    }

    const sandbox = await ctx.getSandbox(environment);
    const cwd = input.workingDirectory?.trim() || undefined;
    const result = await sandbox.run({
      command: input.command,
      workingDirectory: cwd,
      env,
    });

    const redactedOut = redactSecrets(result.stdout || "", Object.values(env));
    const redactedErr = redactSecrets(result.stderr || "", Object.values(env));

    return {
      status: result.exitCode === 0 ? "ok" : "error",
      exitCode: result.exitCode,
      names: input.names,
      target,
      stdout: truncate(redactedOut),
      stderr: truncate(redactedErr),
      ...(result.exitCode === 0
        ? {}
        : {
            error: `Command failed (exit ${result.exitCode}).`,
          }),
    };
  },
});

async function fetchVercelEnvValue(args: {
  readonly token: string;
  readonly key: string;
  readonly target: "preview" | "production";
  readonly projectId?: string;
}): Promise<string | null> {
  // Without a project id, ask the linked project via the Vercel API list.
  // Callers should pass projectId when known.
  if (!args.projectId) {
    return null;
  }
  const url = new URL(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(args.projectId)}/env`,
  );
  url.searchParams.set("decrypt", "true");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${args.token}` },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    envs?: Array<{
      key: string;
      value?: string;
      target?: string[] | string;
    }>;
  };
  const match = (body.envs ?? []).find((row) => {
    if (row.key !== args.key) return false;
    const targets = Array.isArray(row.target)
      ? row.target
      : row.target
        ? [row.target]
        : [];
    return targets.includes(args.target) || targets.includes("production") && args.target === "production";
  });
  return match?.value ?? null;
}

function redactSecrets(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret) out = out.split(secret).join("[redacted]");
  }
  return out;
}

function truncate(text: string, max = 4_000): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}
