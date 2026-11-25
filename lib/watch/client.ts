import type { WatchSnapshot } from "./deploy.ts";
import { isTerminalWatchState } from "./deploy.ts";

export const WATCH_POLL_MS = 3_000;

export async function fetchWatchSnapshot(args: {
  readonly baseUrl: string;
  readonly handle: WatchSnapshot;
  /** Mobile Bearer token (raw, without "Bearer "). */
  readonly bearer?: string | null;
  readonly includeLogs?: boolean;
}): Promise<WatchSnapshot> {
  const clean = new URL(
    args.handle.provider === "vercel"
      ? `/api/watch/vercel`
      : `/api/watch/eas`,
    args.baseUrl.endsWith("/") ? args.baseUrl : `${args.baseUrl}/`,
  );
  if (args.handle.provider === "vercel") {
    if (args.handle.deploymentId) {
      clean.searchParams.set("deploymentId", args.handle.deploymentId);
    } else if (args.handle.url) {
      clean.searchParams.set("url", args.handle.url);
    }
    if (args.handle.projectId) {
      clean.searchParams.set("projectId", args.handle.projectId);
    }
    if (args.handle.teamId) {
      clean.searchParams.set("teamId", args.handle.teamId);
    }
    if (args.handle.target) {
      clean.searchParams.set("target", args.handle.target);
    }
  } else if (args.handle.buildId) {
    clean.searchParams.set("buildId", args.handle.buildId);
  }
  if (args.includeLogs) clean.searchParams.set("logs", "1");

  const headers: Record<string, string> = {
    accept: "application/json",
  };
  if (args.bearer) {
    headers.authorization = `Bearer ${args.bearer}`;
  }

  const response = await fetch(clean.toString(), {
    method: "GET",
    headers,
    // Web: session cookie. Mobile: Bearer only (credentials omit).
    credentials: args.bearer ? "omit" : "include",
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ...args.handle,
      state: "error",
      error: `Watch ${response.status}: ${body.slice(0, 200) || response.statusText}`,
    };
  }
  return (await response.json()) as WatchSnapshot;
}

export { isTerminalWatchState };
