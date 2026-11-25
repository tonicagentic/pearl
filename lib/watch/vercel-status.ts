import { getVercelUserToken } from "@/lib/connections/tokens";
import {
  createVercelFetch,
  listRecentDeploymentErrors,
} from "@/lib/workbench/vercel-client";
import {
  mapVercelReadyState,
  scrubLogLine,
  vercelDashboardUrl,
  vercelTitle,
  type WatchSnapshot,
} from "./deploy.ts";

type DeploymentPayload = {
  readonly uid?: string;
  readonly id?: string;
  readonly url?: string;
  readonly name?: string;
  readonly readyState?: string;
  readonly status?: string;
  readonly state?: string;
  readonly target?: string | null;
  readonly errorMessage?: string;
  readonly errorCode?: string;
};

/**
 * Fetch a live Vercel deployment snapshot for the signed-in user.
 * Accepts deployment id or hostname / url.
 */
export async function fetchVercelWatch(args: {
  readonly userId: string;
  readonly deploymentId?: string | null;
  readonly url?: string | null;
  readonly projectId?: string | null;
  readonly teamId?: string | null;
  readonly target?: string | null;
  readonly includeLogs?: boolean;
}): Promise<WatchSnapshot> {
  const token = await getVercelUserToken(args.userId);
  const vercelFetch = createVercelFetch(token);
  const idOrHost = (
    args.deploymentId?.trim() ||
    stripUrl(args.url) ||
    ""
  ).replace(/^https?:\/\//, "");

  if (!idOrHost) {
    return {
      provider: "vercel",
      state: "error",
      title: vercelTitle(args.target ?? "preview"),
      target: args.target ?? "preview",
      projectId: args.projectId ?? null,
      teamId: args.teamId ?? null,
      error: "Missing deploymentId or url.",
    };
  }

  const path = `/v13/deployments/${encodeURIComponent(idOrHost)}`;
  const res = await vercelFetch(path, { teamId: args.teamId });
  if (!res.ok) {
    const body = await res.text();
    return {
      provider: "vercel",
      state: "error",
      title: vercelTitle(args.target ?? "preview"),
      target: args.target ?? "preview",
      deploymentId: idOrHost,
      projectId: args.projectId ?? null,
      teamId: args.teamId ?? null,
      error: `Vercel ${res.status}: ${body.slice(0, 240)}`,
    };
  }

  const data = (await res.json()) as DeploymentPayload;
  const ready =
    data.readyState ?? data.status ?? data.state ?? "BUILDING";
  const state = mapVercelReadyState(ready);
  const host = data.url
    ? data.url.startsWith("http")
      ? data.url
      : `https://${data.url}`
    : args.url
      ? args.url.startsWith("http")
        ? args.url
        : `https://${args.url}`
      : null;
  const deploymentId = data.uid ?? data.id ?? idOrHost;
  const target =
    data.target === "production" || args.target === "production"
      ? "production"
      : data.target === "preview" || args.target === "preview"
        ? "preview"
        : (args.target ?? "preview");

  let logs: readonly string[] | undefined;
  let error: string | null =
    typeof data.errorMessage === "string" && data.errorMessage.trim()
      ? scrubLogLine(data.errorMessage.trim())
      : null;

  if (args.includeLogs || state === "error") {
    try {
      const lines = await listRecentDeploymentErrors(vercelFetch, {
        deploymentId,
        teamId: args.teamId,
        limit: 30,
      });
      // Prefer a broader log pull for the Logs expander.
      const eventsRes = await vercelFetch(
        `/v2/deployments/${encodeURIComponent(deploymentId)}/events?direction=backward&limit=40`,
        { teamId: args.teamId },
      );
      if (eventsRes.ok) {
        const events = (await eventsRes.json()) as unknown;
        const fromEvents = Array.isArray(events)
          ? events
              .map((event) => {
                if (!event || typeof event !== "object") return null;
                const row = event as Record<string, unknown>;
                const text =
                  typeof row.text === "string"
                    ? row.text
                    : typeof row.payload === "object" &&
                        row.payload &&
                        typeof (row.payload as { text?: string }).text ===
                          "string"
                      ? (row.payload as { text: string }).text
                      : null;
                return text ? scrubLogLine(text) : null;
              })
              .filter((line): line is string => Boolean(line))
          : [];
        logs = (fromEvents.length > 0 ? fromEvents : lines).slice(-40);
      } else {
        logs = lines;
      }
      if (!error && state === "error" && logs.length > 0) {
        error = logs[logs.length - 1] ?? null;
      }
    } catch {
      logs = undefined;
    }
  }

  return {
    provider: "vercel",
    state,
    title: vercelTitle(target),
    target,
    url: host,
    dashboardUrl: vercelDashboardUrl({
      deploymentId,
      url: host,
      teamId: args.teamId,
    }),
    deploymentId,
    projectId: args.projectId ?? null,
    teamId: args.teamId ?? null,
    ...(error ? { error } : {}),
    ...(logs ? { logs } : {}),
  };
}

function stripUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
  } catch {
    return url.trim();
  }
}
