import {
  beginExecution,
  completeExecution,
  executionKey,
  failExecution,
} from "@/lib/agent/execution-ledger";

import { createPearlRepo, getGithubLogin, pushCommit } from "./github.ts";
import {
  getMiniApp,
  toPublicMiniApp,
  updateMiniApp,
  type MiniAppPublic,
} from "./queries.ts";
import { getGithubUserToken, getVercelUserToken } from "./tokens.ts";
import {
  ensureVercelProject,
  resolveVercelTeamId,
  triggerProductionDeploy,
  waitForProductionUrl,
} from "./vercel-deploy.ts";

export type PublishAppInput = {
  readonly userId: string;
  readonly appId: string;
  readonly commitMessage?: string;
};

/**
 * Push the sandbox workspace to the app's pearl-* repo (creating the repo on
 * first publish), ensure a Vercel project, wait for production, and store the
 * URL. Ledger-guarded. GitHub + Vercel Connect required here — not at create.
 */
export async function publishApp(
  input: PublishAppInput,
): Promise<
  | { readonly status: "published"; readonly app: MiniAppPublic }
  | { readonly status: "already-published"; readonly app: MiniAppPublic }
  | { readonly status: "error"; readonly error: string }
> {
  const app = await getMiniApp(input.userId, input.appId);
  if (!app) {
    return { status: "error", error: "Mini app not found." };
  }

  const commitMessage =
    input.commitMessage?.trim() || `Publish ${app.slug} from Pearl`;
  const key = executionKey(
    "publish_app",
    `${input.userId}\u0000${app.id}\u0000${commitMessage}`,
  );
  const prior = await beginExecution("publish_app", key);

  if (prior.prior?.status === "succeeded" && prior.prior.detail) {
    try {
      const parsed = JSON.parse(prior.prior.detail) as {
        productionUrl?: string;
      };
      const refreshed = await getMiniApp(input.userId, app.id);
      if (refreshed?.productionUrl || parsed.productionUrl) {
        return {
          status: "already-published",
          app: toPublicMiniApp(
            refreshed ?? {
              ...app,
              productionUrl: parsed.productionUrl ?? app.productionUrl,
              status: "published",
            },
          ),
        };
      }
    } catch {
      // Continue.
    }
  }

  if (prior.prior?.status === "pending") {
    return {
      status: "error",
      error:
        "A previous publish for this commit message is still pending. Check Vercel before retrying.",
    };
  }

  try {
    const { readSandboxWorkspaceFiles } = await import("./sandbox-files.ts");
    const files = await readSandboxWorkspaceFiles(app.sandboxName);
    if (files.length === 0) {
      throw new Error(
        "Sandbox workspace is empty. Run code_with_fx first so there is something to publish.",
      );
    }

    const githubToken = await getGithubUserToken(input.userId);
    let githubOwner = app.githubOwner;
    let githubRepo = app.githubRepo;

    if (!githubOwner || !githubRepo) {
      githubOwner = await getGithubLogin(githubToken);
      githubRepo = app.slug;
      await createPearlRepo({
        token: githubToken,
        owner: githubOwner,
        repo: githubRepo,
        description: `Pearl mini app: ${app.title}`,
        files,
      });
      await updateMiniApp(input.userId, app.id, {
        githubOwner,
        githubRepo,
      });
    } else {
      await pushCommit({
        token: githubToken,
        owner: githubOwner,
        repo: githubRepo,
        expectedOwner: githubOwner,
        expectedRepo: githubRepo,
        message: commitMessage,
        files,
      });
    }

    const vercelToken = await getVercelUserToken(input.userId);
    const teamId = await resolveVercelTeamId(vercelToken);
    const project = await ensureVercelProject({
      token: vercelToken,
      projectName: app.slug,
      githubOwner,
      githubRepo,
      teamId,
    });

    try {
      await triggerProductionDeploy({
        token: vercelToken,
        projectName: project.projectName,
        githubOwner,
        githubRepo,
        teamId,
      });
    } catch {
      // Git push often triggers a deploy on its own; continue to wait.
    }

    const productionUrl = await waitForProductionUrl({
      token: vercelToken,
      projectId: project.projectId,
      teamId,
    });

    const updated = await updateMiniApp(input.userId, app.id, {
      githubOwner,
      githubRepo,
      vercelProjectId: project.projectId,
      productionUrl,
      status: "published",
    });

    await completeExecution(
      key,
      JSON.stringify({ productionUrl, projectId: project.projectId }),
    );

    return {
      status: "published",
      app: toPublicMiniApp(
        updated ?? {
          ...app,
          githubOwner,
          githubRepo,
          productionUrl,
          status: "published",
        },
      ),
    };
  } catch (error) {
    await failExecution(
      key,
      error instanceof Error ? error.message : String(error),
    );
    await updateMiniApp(input.userId, app.id, { status: "failed" });
    return {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
