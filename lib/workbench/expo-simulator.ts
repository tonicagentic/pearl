import { PEARL_EXPO_PROJECT_ID } from "./types.ts";

export type ExpoSimulatorCreateBody = {
  readonly appId: string;
  readonly platform: "ios";
  readonly type: "agent-device";
  readonly name: string;
  readonly maxDurationMinutes?: number;
  readonly maxIdleTimeMinutes?: number;
  readonly buildId?: string;
  readonly publicPreview?: boolean;
  readonly frameAncestors?: readonly string[];
};

export type ExpoSimulatorSession = {
  readonly id: string;
  readonly status: string;
  readonly previewUrl: string | null;
  readonly webPreviewToken: string | null;
};

/**
 * Build the REST body for POST /v2/device-run-sessions.
 * Project id comes from the pin; Pearl's id is only the fallback when omitted.
 */
export function buildCreateSimulatorBody(args: {
  readonly expoProjectId?: string | null;
  readonly name: string;
  readonly buildId?: string | null;
  readonly maxDurationMinutes?: number;
  readonly frameAncestors?: readonly string[];
}): ExpoSimulatorCreateBody {
  const appId = args.expoProjectId?.trim() || PEARL_EXPO_PROJECT_ID;
  const body: ExpoSimulatorCreateBody = {
    appId,
    platform: "ios",
    type: "agent-device",
    name: args.name.trim() || "Pearl coder session",
    maxDurationMinutes: args.maxDurationMinutes ?? 30,
    maxIdleTimeMinutes: 10,
  };
  if (args.buildId?.trim()) {
    return { ...body, buildId: args.buildId.trim() };
  }
  if (args.frameAncestors && args.frameAncestors.length > 0) {
    return { ...body, frameAncestors: args.frameAncestors };
  }
  return body;
}

/** Public-facing preview URL the phone can open (token stays server-side). */
export function resolvePhonePreviewUrl(session: {
  readonly url?: string | null;
  readonly remoteConfig?: {
    readonly webPreviewUrl?: string | null;
    readonly previewUrl?: string | null;
    readonly webPreviewToken?: string | null;
  } | null;
  readonly publicPreview?: boolean;
}): { readonly previewUrl: string | null; readonly hasToken: boolean } {
  const remote = session.remoteConfig;
  const base =
    remote?.previewUrl?.trim() ||
    remote?.webPreviewUrl?.trim() ||
    session.url?.trim() ||
    null;
  const token = remote?.webPreviewToken?.trim() || null;
  if (!base) {
    return { previewUrl: null, hasToken: Boolean(token) };
  }
  // Prefer a session page URL without embedding the token in client state.
  // Callers that need a public link should mint it server-side only.
  if (session.publicPreview && token) {
    if (base.includes("#") || base.includes("?token=")) {
      return { previewUrl: base, hasToken: true };
    }
    const sep = base.includes("?") ? "&" : "?";
    return { previewUrl: `${base}${sep}token=${encodeURIComponent(token)}`, hasToken: true };
  }
  return { previewUrl: base, hasToken: Boolean(token) };
}

export function expoStopSessionPath(sessionId: string): string {
  return `/v2/device-run-sessions/${encodeURIComponent(sessionId)}/stop`;
}

export function expoCreateSessionPath(): string {
  return "/v2/device-run-sessions";
}

export const EXPO_API_BASE = "https://api.expo.dev";
