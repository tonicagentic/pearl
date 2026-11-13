import { getGithubUserToken, getVercelUserToken } from "@/lib/connections/tokens";
import { listOpenPullRequests, createGithubFetch } from "./github-client.ts";
import {
  createVercelFetch,
  getTeamUsage,
  listProjectDeployments,
  listProjectDomains,
  listProjectEnvNames,
  listProjectStorage,
  listRecentDeploymentErrors,
} from "./vercel-client.ts";
import type {
  WorkbenchDeployment,
  WorkbenchDomain,
  WorkbenchEnvName,
  WorkbenchPin,
  WorkbenchPullRequest,
  WorkbenchStorageItem,
  WorkbenchVercelUsage,
} from "./types.ts";

export type PinStatusResult =
  | {
      readonly connected: true;
      readonly pullRequests: readonly WorkbenchPullRequest[];
      readonly deployments: readonly WorkbenchDeployment[];
      readonly githubError?: string;
      readonly vercelError?: string;
    }
  | {
      readonly connected: false;
      readonly pullRequests: readonly [];
      readonly deployments: readonly [];
      readonly message: string;
    };

export async function loadPinStatus(
  userId: string,
  pin: WorkbenchPin,
): Promise<PinStatusResult> {
  let githubToken: string | null = null;
  try {
    githubToken = await getGithubUserToken(userId);
  } catch {
    githubToken = null;
  }

  if (!githubToken) {
    return {
      connected: false,
      pullRequests: [],
      deployments: [],
      message: "Connect GitHub in Settings → Plugins to load pull requests.",
    };
  }

  let pullRequests: readonly WorkbenchPullRequest[] = [];
  let githubError: string | undefined;
  try {
    pullRequests = await listOpenPullRequests(createGithubFetch(githubToken), {
      owner: pin.owner,
      repo: pin.name,
    });
  } catch (cause) {
    githubError = cause instanceof Error ? cause.message : "GitHub request failed.";
  }

  let deployments: readonly WorkbenchDeployment[] = [];
  let vercelError: string | undefined;
  if (pin.vercelProjectId) {
    try {
      const vercelToken = await getVercelUserToken(userId);
      deployments = await listProjectDeployments(createVercelFetch(vercelToken), {
        projectId: pin.vercelProjectId,
        teamId: pin.vercelTeamId,
      });
    } catch (cause) {
      vercelError =
        cause instanceof Error ? cause.message : "Vercel request failed.";
    }
  }

  return {
    connected: true,
    pullRequests,
    deployments,
    githubError,
    vercelError,
  };
}

export type PinResourcesResult = {
  readonly domains: readonly WorkbenchDomain[];
  readonly envNames: readonly WorkbenchEnvName[];
  readonly storage: readonly WorkbenchStorageItem[];
  readonly recentErrors: readonly string[];
  readonly error?: string;
};

export async function loadPinResources(
  userId: string,
  pin: WorkbenchPin,
): Promise<PinResourcesResult> {
  if (!pin.vercelProjectId) {
    return {
      domains: [],
      envNames: [],
      storage: [],
      recentErrors: [],
      error: "Link a Vercel project id on this pin to load resources.",
    };
  }

  try {
    const token = await getVercelUserToken(userId);
    const vercelFetch = createVercelFetch(token);
    const [domains, envNames, storage, deployments] = await Promise.all([
      listProjectDomains(vercelFetch, {
        projectId: pin.vercelProjectId,
        teamId: pin.vercelTeamId,
      }),
      listProjectEnvNames(vercelFetch, {
        projectId: pin.vercelProjectId,
        teamId: pin.vercelTeamId,
      }),
      listProjectStorage(vercelFetch, {
        projectId: pin.vercelProjectId,
        teamId: pin.vercelTeamId,
      }),
      listProjectDeployments(vercelFetch, {
        projectId: pin.vercelProjectId,
        teamId: pin.vercelTeamId,
        limit: 1,
      }),
    ]);

    let recentErrors: readonly string[] = [];
    const latest = deployments[0];
    if (latest) {
      try {
        recentErrors = await listRecentDeploymentErrors(vercelFetch, {
          deploymentId: latest.uid,
          teamId: pin.vercelTeamId,
        });
      } catch {
        recentErrors = [];
      }
    }

    return { domains, envNames, storage, recentErrors };
  } catch (cause) {
    return {
      domains: [],
      envNames: [],
      storage: [],
      recentErrors: [],
      error: cause instanceof Error ? cause.message : "Failed to load resources.",
    };
  }
}

export async function loadPinUsage(
  userId: string,
  pin: WorkbenchPin,
): Promise<WorkbenchVercelUsage> {
  try {
    const token = await getVercelUserToken(userId);
    return getTeamUsage(createVercelFetch(token), { teamId: pin.vercelTeamId });
  } catch {
    return {
      teamId: pin.vercelTeamId ?? null,
      periodStart: null,
      periodEnd: null,
      bandwidthBytes: null,
      functionInvocationCount: null,
      buildMinutes: null,
      storageBytes: null,
      invoiceTotalCents: null,
    };
  }
}
