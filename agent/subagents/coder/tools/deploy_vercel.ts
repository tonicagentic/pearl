import { authenticateVercel } from "eve/extensions/code/sandbox";
import type { SandboxSession } from "eve/sandbox";
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { formatApprovalPrompt } from "@/lib/chat/approval-brief";
import {
  brokerVercelHeaders,
  CODER_BASELINE_NETWORK_POLICY,
} from "@/lib/coder/network-policy";
import { requireCoderUserId } from "@/lib/coder/principal";
import { vercelTokenUnavailableMessage } from "@/lib/connections/grant-errors";
import { getVercelUserToken } from "@/lib/connections/tokens";
import {
  deploymentIdFromUrl,
  vercelDashboardUrl,
  vercelTitle,
  type WatchState,
} from "@/lib/watch/deploy";
import { buildApprovalCard } from "@/lib/workbench/approvals";
import { environment } from "../sandbox.ts";

type DeployOk = {
  readonly status: "ok";
  readonly target: "preview" | "production";
  readonly url: string | null;
  readonly deploymentId: string | null;
  readonly projectId: string | null;
  readonly teamId: string | null;
  readonly dashboardUrl: string;
  readonly state: WatchState;
  readonly title: string;
  readonly cardSummary: string;
  readonly warnsPhoneApi: boolean;
  readonly summary: string;
};

type DeployErr = {
  readonly status: "error";
  readonly error: string;
  readonly target: "preview" | "production";
  readonly url?: string | null;
  readonly deploymentId?: string | null;
  readonly projectId?: string | null;
  readonly teamId?: string | null;
  readonly state?: WatchState;
  readonly title?: string;
};

type DeployResult = DeployOk | DeployErr;

type PolicySandbox = SandboxSession & {
  setNetworkPolicy(
    policy:
      | "allow-all"
      | "deny-all"
      | { readonly allow: Record<string, unknown> },
  ): Promise<void>;
};

function hasMutableNetworkPolicy(
  sandbox: SandboxSession,
): sandbox is PolicySandbox {
  return (
    "setNetworkPolicy" in sandbox &&
    typeof (sandbox as PolicySandbox).setNetworkPolicy === "function"
  );
}

async function restoreBaseline(sandbox: SandboxSession): Promise<void> {
  if (!hasMutableNetworkPolicy(sandbox)) return;
  try {
    await sandbox.setNetworkPolicy(
      CODER_BASELINE_NETWORK_POLICY as unknown as {
        readonly allow: Record<string, unknown>;
      },
    );
  } catch (error) {
    console.error("[deploy_vercel] restore baseline failed", error);
  }
}

export default defineTool({
  approval: {
    request: always(),
    prompt: ({ input }) =>
      formatApprovalPrompt({
        toolName: "deploy_vercel",
        input: {
          target: input.target,
          ...(input.owner != null ? { owner: input.owner } : {}),
          ...(input.repo != null ? { repo: input.repo } : {}),
          ...(input.workingDirectory != null
            ? { workingDirectory: input.workingDirectory }
            : {}),
        },
      }),
  },
  description:
    "Deploy the current sandbox checkout to the signed-in user's Vercel " +
    "account. Preview is the default; production only when target is " +
    "production. Always needs approval — the card must name owner/repo and " +
    "the target. Production deploy and Expo build or workflow runs are " +
    "always separate " +
    "approvals. When owner/repo is Pearl (alex/my-agent), production warns " +
    "that the phone API will change. Returns a watch handle as soon as the " +
    "deployment URL appears; Pearl chat polls status — do not call " +
    "vercel inspect or list_deployments to wait on this deploy.",
  label: {
    start: ({ target }) =>
      target === "production"
        ? "Watch production deployment"
        : "Watch preview deployment",
    delta: (_input, partial) => {
      const row = asDeployResult(partial);
      if (!row) return "";
      if (row.status === "error") return "Deploy failed";
      if (row.state === "ready") return "Deployment ready";
      if (row.url) return `Deploying ${row.url}`;
      return "Starting deploy";
    },
    complete: (_input, output) => {
      const row = asDeployResult(output);
      if (!row) return "Deploy finished";
      if (row.status === "error") return "Deploy failed";
      if (row.state === "ready") return "Deployment ready";
      return row.url ? `Deploying ${row.url}` : "Deploy started";
    },
  },
  toModelOutput: (output) => {
    const row = asDeployResult(output);
    if (!row || row.status === "error") {
      return {
        type: "text",
        value: `Deploy failed (${row?.target ?? "preview"}): ${row && row.status === "error" ? row.error : "unknown error"}`,
      };
    }
    const bits = [
      `target=${row.target}`,
      `state=${row.state}`,
      row.url ? `url=${row.url}` : null,
    ].filter(Boolean);
    return {
      type: "text",
      value:
        `Deploy watch started (${bits.join(", ")}). ` +
        "Status updates on the live card — do not poll.",
    };
  },
  inputSchema: z.object({
    target: z
      .enum(["preview", "production"])
      .default("preview")
      .describe("preview (default) or production."),
    owner: z.string().nullish().describe("GitHub owner for the approval card."),
    repo: z.string().nullish().describe("GitHub repo for the approval card."),
    workingDirectory: z
      .string()
      .nullish()
      .describe("Optional path under /workspace for the app root."),
  }),
  async *execute(input, ctx): AsyncGenerator<DeployResult, void, undefined> {
    const auth = requireCoderUserId(ctx.session.auth.current);
    if ("error" in auth) {
      yield {
        status: "error",
        error: auth.error,
        target: input.target,
        state: "error",
        title: vercelTitle(input.target),
      };
      return;
    }

    let token: string;
    try {
      token = await getVercelUserToken(auth.userId);
    } catch (cause) {
      yield {
        status: "error",
        error: vercelTokenUnavailableMessage(
          cause instanceof Error ? cause.message : undefined,
        ),
        target: input.target,
        state: "error",
        title: vercelTitle(input.target),
      };
      return;
    }

    const sandbox = await ctx.getSandbox(environment);
    const owner = input.owner?.trim() || "repo";
    const repo = input.repo?.trim() || "checkout";
    const card = buildApprovalCard({
      action:
        input.target === "production"
          ? "production_deploy"
          : "preview_deploy",
      owner,
      repo,
      target: input.target,
    });

    let restoreOwned = true;
    try {
      await authenticateVercel(sandbox, {
        token,
        delivery: "firewall",
        broker: brokerVercelHeaders,
      });

      const cwd = input.workingDirectory?.trim() || undefined;
      const project = await readVercelProject(sandbox, cwd);
      const prodFlag = input.target === "production" ? " --prod" : "";

      yield {
        status: "ok",
        target: input.target,
        url: null,
        deploymentId: null,
        projectId: project.projectId,
        teamId: project.teamId,
        dashboardUrl: vercelDashboardUrl({ teamId: project.teamId }),
        state: "starting",
        title: vercelTitle(input.target),
        cardSummary: card.summary,
        warnsPhoneApi: card.warnsPhoneApi,
        summary: "Starting deploy…",
      } satisfies DeployOk;

      try {
        const process = await sandbox.spawn({
          command: `vc deploy --yes${prodFlag}`,
          workingDirectory: cwd,
          signal: ctx.abortSignal,
        });

        let stdout = "";
        let stderr = "";
        const decoder = new TextDecoder();

        const consume = async (
          stream: ReadableStream<Uint8Array>,
          which: "out" | "err",
        ) => {
          const reader = stream.getReader();
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              if (which === "out") stdout += chunk;
              else stderr += chunk;
            }
          } finally {
            reader.releaseLock();
          }
        };

        const outTask = consume(process.stdout, "out");
        const errTask = consume(process.stderr, "err");

        const started = Date.now();
        while (Date.now() - started < 120_000) {
          if (ctx.abortSignal.aborted) {
            try {
              await process.kill();
            } catch {
              // ignore
            }
            yield {
              status: "error",
              error: "Deploy cancelled.",
              target: input.target,
              projectId: project.projectId,
              teamId: project.teamId,
              state: "canceled",
              title: vercelTitle(input.target),
            };
            return;
          }
          const url = extractHttpsUrl(stdout) ?? extractHttpsUrl(stderr);
          if (url) {
            const deploymentId = deploymentIdFromUrl(url);
            yield {
              status: "ok",
              target: input.target,
              url,
              deploymentId,
              projectId: project.projectId,
              teamId: project.teamId,
              dashboardUrl: vercelDashboardUrl({
                deploymentId,
                url,
                teamId: project.teamId,
              }),
              state: "building",
              title: vercelTitle(input.target),
              cardSummary: card.summary,
              warnsPhoneApi: card.warnsPhoneApi,
              summary: `Deploy started: ${url}`,
            } satisfies DeployOk;
            // Leave vc running; restore baseline only after it exits.
            restoreOwned = false;
            void (async () => {
              try {
                await process.wait();
                await Promise.all([outTask, errTask]);
              } finally {
                await restoreBaseline(sandbox);
              }
            })();
            return;
          }
          await sleep(400, ctx.abortSignal);
        }

        const { exitCode } = await process.wait();
        await Promise.all([outTask, errTask]);
        if (exitCode !== 0) {
          yield {
            status: "error",
            error: `vc deploy failed (exit ${exitCode}): ${truncate(stderr || stdout)}`,
            target: input.target,
            projectId: project.projectId,
            teamId: project.teamId,
            state: "error",
            title: vercelTitle(input.target),
          };
          return;
        }
        const url = extractHttpsUrl(stdout) ?? extractHttpsUrl(stderr);
        const deploymentId = deploymentIdFromUrl(url);
        yield {
          status: "ok",
          target: input.target,
          url,
          deploymentId,
          projectId: project.projectId,
          teamId: project.teamId,
          dashboardUrl: vercelDashboardUrl({
            deploymentId,
            url,
            teamId: project.teamId,
          }),
          state: url ? "building" : "ready",
          title: vercelTitle(input.target),
          cardSummary: card.summary,
          warnsPhoneApi: card.warnsPhoneApi,
          summary: truncate(stdout || "Deploy finished."),
        };
      } catch (spawnError) {
        yield {
          status: "ok",
          target: input.target,
          url: null,
          deploymentId: null,
          projectId: project.projectId,
          teamId: project.teamId,
          dashboardUrl: vercelDashboardUrl({ teamId: project.teamId }),
          state: "building",
          title: vercelTitle(input.target),
          cardSummary: card.summary,
          warnsPhoneApi: card.warnsPhoneApi,
          summary: `Spawn unavailable (${spawnError instanceof Error ? spawnError.message : "error"}); running deploy to completion.`,
        };

        const result = await sandbox.run({
          command: `vc deploy --yes${prodFlag}`,
          workingDirectory: cwd,
          signal: ctx.abortSignal,
        });

        if (result.exitCode !== 0) {
          yield {
            status: "error",
            error: `vc deploy failed (exit ${result.exitCode}): ${truncate(result.stderr || result.stdout)}`,
            target: input.target,
            projectId: project.projectId,
            teamId: project.teamId,
            state: "error",
            title: vercelTitle(input.target),
          };
          return;
        }

        const url =
          extractHttpsUrl(result.stdout) ?? extractHttpsUrl(result.stderr);
        const deploymentId = deploymentIdFromUrl(url);
        yield {
          status: "ok",
          target: input.target,
          url,
          deploymentId,
          projectId: project.projectId,
          teamId: project.teamId,
          dashboardUrl: vercelDashboardUrl({
            deploymentId,
            url,
            teamId: project.teamId,
          }),
          state: "ready",
          title: vercelTitle(input.target),
          cardSummary: card.summary,
          warnsPhoneApi: card.warnsPhoneApi,
          summary: truncate(result.stdout || "Deploy finished."),
        };
      }
    } finally {
      if (restoreOwned) {
        await restoreBaseline(sandbox);
      }
    }
  },
});

async function readVercelProject(
  sandbox: {
    readTextFile: (options: {
      path: string;
    }) => PromiseLike<string | null>;
    resolvePath: (path: string) => string;
  },
  cwd: string | undefined,
): Promise<{ projectId: string | null; teamId: string | null }> {
  const relative = cwd
    ? `${cwd.replace(/\/$/, "")}/.vercel/project.json`
    : ".vercel/project.json";
  try {
    const text = await sandbox.readTextFile({
      path: sandbox.resolvePath(relative),
    });
    if (!text) return { projectId: null, teamId: null };
    const parsed = JSON.parse(text) as {
      projectId?: string;
      orgId?: string;
    };
    return {
      projectId: parsed.projectId?.trim() || null,
      teamId: parsed.orgId?.trim() || null,
    };
  } catch {
    return { projectId: null, teamId: null };
  }
}

function asDeployResult(value: unknown): DeployResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Partial<DeployResult>;
  if (row.status !== "ok" && row.status !== "error") return null;
  return value as DeployResult;
}

function extractHttpsUrl(text: string): string | null {
  const match = text.match(/https:\/\/[^\s]+/);
  return match?.[0]?.replace(/[.,)]+$/, "") ?? null;
}

function truncate(text: string, max = 4_000): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("aborted"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new Error("aborted"));
      },
      { once: true },
    );
  });
}
