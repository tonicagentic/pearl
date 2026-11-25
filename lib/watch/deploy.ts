/**
 * Shared watch snapshot for live Vercel deploy and EAS build cards in chat.
 * Tokens never appear here — only ids, urls, and presentation-safe state.
 */

export type WatchProvider = "vercel" | "eas";

export type WatchState =
  | "starting"
  | "queued"
  | "building"
  | "ready"
  | "error"
  | "canceled";

export type WatchSnapshot = {
  readonly provider: WatchProvider;
  readonly state: WatchState;
  readonly title: string;
  /** production / preview, or iOS / Android profile label. */
  readonly target: string;
  /** Visit URL when known (deployment hostname or install page). */
  readonly url?: string | null;
  /** Open in Vercel / Expo dashboard. */
  readonly dashboardUrl?: string | null;
  readonly deploymentId?: string | null;
  readonly buildId?: string | null;
  readonly projectId?: string | null;
  readonly teamId?: string | null;
  /** Short failure text; never includes env values. */
  readonly error?: string | null;
  /** Optional scrubbed log tail when requested. */
  readonly logs?: readonly string[];
};

export function isTerminalWatchState(state: WatchState): boolean {
  return state === "ready" || state === "error" || state === "canceled";
}

export function mapVercelReadyState(raw: string | null | undefined): WatchState {
  const state = (raw ?? "").toUpperCase();
  switch (state) {
    case "READY":
      return "ready";
    case "ERROR":
    case "FAILED":
      return "error";
    case "CANCELED":
    case "CANCELLED":
      return "canceled";
    case "QUEUED":
    case "INITIALIZING":
      return "queued";
    case "BUILDING":
    case "UPLOADING":
    case "DEPLOYING":
    case "CHECKING":
      return "building";
    default:
      return state ? "building" : "starting";
  }
}

export function mapEasBuildStatus(raw: string | null | undefined): WatchState {
  const state = (raw ?? "").toUpperCase();
  switch (state) {
    case "FINISHED":
    case "SUCCESS":
      return "ready";
    case "ERRORED":
    case "ERROR":
    case "FAILED":
      return "error";
    case "CANCELED":
    case "CANCELLED":
      return "canceled";
    case "IN_QUEUE":
    case "NEW":
    case "PENDING":
      return "queued";
    case "IN_PROGRESS":
    case "RUNNING":
      return "building";
    default:
      return state ? "building" : "starting";
  }
}

export function vercelDashboardUrl(args: {
  readonly deploymentId?: string | null;
  readonly url?: string | null;
  readonly teamId?: string | null;
}): string {
  const id =
    args.deploymentId?.trim() ||
    hostnameFromUrl(args.url)?.replace(/\.vercel\.app$/i, "") ||
    null;
  if (!id) return "https://vercel.com";
  const team = args.teamId?.trim();
  // Team-scoped deployments open under the team; otherwise personal account.
  if (team && !team.startsWith("team_")) {
    return `https://vercel.com/${encodeURIComponent(team)}/${encodeURIComponent(id)}`;
  }
  return `https://vercel.com/deployments/${encodeURIComponent(id)}`;
}

export function easDashboardUrl(args: {
  readonly buildId?: string | null;
  readonly projectFullName?: string | null;
}): string {
  const buildId = args.buildId?.trim();
  if (!buildId) return "https://expo.dev";
  const full = args.projectFullName?.trim()?.replace(/^@/, "");
  if (full && full.includes("/")) {
    const [account, slug] = full.split("/");
    if (account && slug) {
      return `https://expo.dev/accounts/${encodeURIComponent(account)}/projects/${encodeURIComponent(slug)}/builds/${encodeURIComponent(buildId)}`;
    }
  }
  return `https://expo.dev/builds/${encodeURIComponent(buildId)}`;
}

export function vercelTitle(target: string): string {
  return target === "production"
    ? "Current production deployment"
    : "Current preview deployment";
}

export function easTitle(args: {
  readonly platform?: string | null;
  readonly profile?: string | null;
}): string {
  const platform = (args.platform ?? "").toLowerCase();
  const platformLabel =
    platform === "ios"
      ? "iOS"
      : platform === "android"
        ? "Android"
        : platform
          ? platform
          : "EAS";
  const profile = args.profile?.trim();
  if (profile) return `EAS ${platformLabel} ${profile}`;
  return `EAS ${platformLabel} build`;
}

/** UUID-ish build ids from Expo / EAS. */
const BUILD_ID_RE =
  /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i;

/**
 * Pull a build id from a string, plain object, or MCP `{ content: [{ text }] }`
 * payload. Bare tool names after `__` are handled by callers.
 */
export function extractEasBuildId(value: unknown): string | null {
  if (typeof value === "string") {
    const match = value.match(BUILD_ID_RE);
    return match?.[1] ?? null;
  }
  if (!isRecord(value)) return null;

  const direct =
    asString(value.buildId) ??
    asString(value.build_id) ??
    asString(value.id);
  if (direct && BUILD_ID_RE.test(direct)) return direct.match(BUILD_ID_RE)![1]!;

  const content = value.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (!isRecord(part)) continue;
      const text = asString(part.text) ?? asString(part.value);
      if (!text) continue;
      const fromText = extractEasBuildId(text);
      if (fromText) return fromText;
    }
  }

  // Nested MCP / tool wrappers.
  for (const key of ["result", "data", "output", "body"] as const) {
    if (key in value) {
      const nested = extractEasBuildId(value[key]);
      if (nested) return nested;
    }
  }

  // Last resort: stringify object and scan (bounded).
  try {
    const json = JSON.stringify(value);
    if (json.length < 20_000) {
      const match = json.match(BUILD_ID_RE);
      return match?.[1] ?? null;
    }
  } catch {
    // ignore
  }
  return null;
}

export function hostnameFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(
      url.startsWith("http") ? url : `https://${url}`,
    );
    return parsed.hostname || null;
  } catch {
    return null;
  }
}

export function deploymentIdFromUrl(url: string | null | undefined): string | null {
  const host = hostnameFromUrl(url);
  if (!host) return null;
  // Vercel inspection accepts the hostname; strip protocol leftovers.
  return host;
}

export function bareToolName(toolName: string): string {
  const index = toolName.lastIndexOf("__");
  return index === -1 ? toolName : toolName.slice(index + 2);
}

export function isDeployVercelTool(name: string): boolean {
  return bareToolName(name) === "deploy_vercel";
}

export function isEasBuildRunTool(name: string): boolean {
  return bareToolName(name) === "build_run";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Build a Vercel watch snapshot from a deploy_vercel tool output. */
export function watchFromDeployVercelOutput(
  output: unknown,
  args?: { readonly target?: string | null },
): WatchSnapshot | null {
  if (!isRecord(output)) return null;
  if (output.status === "error" && !asString(output.url)) {
    const target =
      asString(output.target) ?? args?.target?.trim() ?? "preview";
    return {
      provider: "vercel",
      state: "error",
      title: vercelTitle(target),
      target,
      error: asString(output.error) ?? "Deploy failed.",
      ...(asString(output.url) ? { url: asString(output.url) } : {}),
      ...(asString(output.deploymentId)
        ? { deploymentId: asString(output.deploymentId) }
        : {}),
      ...(asString(output.projectId)
        ? { projectId: asString(output.projectId) }
        : {}),
      ...(asString(output.teamId) ? { teamId: asString(output.teamId) } : {}),
    };
  }

  const url = asString(output.url) ?? null;
  const deploymentId =
    asString(output.deploymentId) ?? deploymentIdFromUrl(url);
  const target =
    asString(output.target) ?? args?.target?.trim() ?? "preview";
  const stateRaw = asString(output.state);
  const state: WatchState = isWatchState(stateRaw)
    ? stateRaw
    : stateRaw
      ? mapVercelReadyState(stateRaw)
      : url
        ? "building"
        : "starting";
  const projectId = asString(output.projectId) ?? null;
  const teamId = asString(output.teamId) ?? null;
  const dashboardUrl =
    asString(output.dashboardUrl) ??
    vercelDashboardUrl({ deploymentId, url, teamId });

  if (!url && !deploymentId && state !== "error") return null;

  return {
    provider: "vercel",
    state,
    title: vercelTitle(target),
    target,
    url,
    dashboardUrl,
    deploymentId,
    projectId,
    teamId,
    ...(asString(output.error) ? { error: asString(output.error) } : {}),
  };
}

function isWatchState(value: string | undefined): value is WatchState {
  return (
    value === "starting" ||
    value === "queued" ||
    value === "building" ||
    value === "ready" ||
    value === "error" ||
    value === "canceled"
  );
}

/** Build an EAS watch snapshot from a build_run tool output / args. */
export function watchFromEasBuildOutput(
  output: unknown,
  args?: {
    readonly platform?: string | null;
    readonly profile?: string | null;
    readonly buildProfile?: string | null;
  },
): WatchSnapshot | null {
  const buildId = extractEasBuildId(output);
  const record = isRecord(output) ? output : null;
  const platform =
    (record && asString(record.platform)) ?? args?.platform ?? null;
  const profile =
    (record && (asString(record.profile) ?? asString(record.buildProfile))) ??
    args?.profile ??
    args?.buildProfile ??
    null;
  const stateRaw =
    (record && (asString(record.status) ?? asString(record.state))) ?? null;
  const state = stateRaw ? mapEasBuildStatus(stateRaw) : buildId ? "queued" : "starting";
  const url =
    (record &&
      (asString(record.url) ??
        asString(record.artifactsUrl) ??
        asString(record.buildDetailsPageUrl))) ??
    null;
  const projectFullName =
    (record &&
      (asString(record.appFullName) ??
        asString(record.fullName) ??
        asString(record.projectFullName))) ??
    null;
  const projectId =
    (record && (asString(record.appId) ?? asString(record.projectId))) ?? null;
  const dashboardUrl =
    (record && asString(record.dashboardUrl)) ??
    easDashboardUrl({ buildId, projectFullName });

  if (!buildId && state !== "error") return null;

  return {
    provider: "eas",
    state,
    title: easTitle({ platform, profile }),
    target: [platform, profile].filter(Boolean).join(" / ") || "eas",
    url,
    dashboardUrl,
    buildId,
    projectId,
    ...(record && asString(record.error)
      ? { error: asString(record.error) }
      : {}),
  };
}

type ChildMessagePart = {
  readonly type?: string;
  readonly name?: string;
  readonly state?: string;
  readonly output?: unknown;
  readonly input?: unknown;
};

type ChildMessage = {
  readonly parts?: readonly ChildMessagePart[];
};

/**
 * Newest deploy_vercel and build_run watches from a followed child transcript.
 * Prefer completed/failed outputs; fall back to preliminary output when present.
 */
export function extractWatchHandles(input: {
  readonly childMessages?: readonly ChildMessage[];
}): {
  readonly vercel: WatchSnapshot | null;
  readonly eas: WatchSnapshot | null;
} {
  let vercel: WatchSnapshot | null = null;
  let eas: WatchSnapshot | null = null;
  const messages = input.childMessages ?? [];

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const parts = messages[i]?.parts ?? [];
    for (let j = parts.length - 1; j >= 0; j -= 1) {
      const part = parts[j];
      if (part?.type !== "tool" || !part.name) continue;
      const name = part.name;
      const args = isRecord(part.input) ? part.input : undefined;

      if (!vercel && isDeployVercelTool(name) && part.output !== undefined) {
        vercel = watchFromDeployVercelOutput(part.output, {
          target: args ? asString(args.target) : null,
        });
      }
      if (!eas && isEasBuildRunTool(name) && part.output !== undefined) {
        eas = watchFromEasBuildOutput(part.output, {
          platform: args ? asString(args.platform) : null,
          profile: args
            ? (asString(args.profile) ?? asString(args.buildProfile))
            : null,
        });
      }
      if (vercel && eas) {
        return { vercel, eas };
      }
    }
  }

  return { vercel, eas };
}

/** Scrub KEY=value shapes from log lines. */
export function scrubLogLine(line: string): string {
  return line.replace(
    /\b([A-Z][A-Z0-9_]{2,})=([^\s]+)/g,
    (_, key: string) => `${key}=[redacted]`,
  );
}
