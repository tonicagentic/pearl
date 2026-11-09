// Runtime bridge: eve's framework-agnostic SessionStore drives
// @assistant-ui/react-native's external-store runtime. The web template's
// useEveAgentRuntime is web-only (imports @assistant-ui/react), so this file
// re-implements the thin mapping:
//
//   SessionStore snapshot -> ThreadMessageLike[] + isRunning -> adapter
//
// Messages come from SessionStore's conversation projection. Delivery is
// confirmed with delivery.consumed (stream v27), not the removed
// message.received event.

import { SessionStore } from "eve/client";
import Constants from "expo-constants";
import { Platform } from "react-native";
export { toThreadMessages } from "./message-projection";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const DEFAULT_AGENT_URL = "https://my-agent-pi-eight.vercel.app";

function metroLanHostname(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.experienceUrl?.replace(/^[a-z]+:\/\//, "") ??
    null;
  if (!hostUri) return null;
  const host = hostUri.split("/")[0]?.split(":")[0]?.trim();
  if (!host || LOOPBACK_HOSTS.has(host)) return null;
  return host;
}

/**
 * Resolve the agent API base URL.
 *
 * On a physical device, `127.0.0.1` is the phone — rewrite loopback agent URLs
 * to Metro's LAN host so local Next stays reachable without editing .env.
 */
export function resolveAgentUrl(
  configured = process.env.EXPO_PUBLIC_AGENT_URL ?? DEFAULT_AGENT_URL,
): string {
  if (
    Platform.OS === "web" &&
    __DEV__ &&
    typeof window !== "undefined" &&
    LOOPBACK_HOSTS.has(window.location.hostname)
  ) {
    return `${window.location.origin}/__pearl_api`;
  }

  if (Platform.OS === "web" || !__DEV__) return configured;

  try {
    const url = new URL(configured);
    if (!LOOPBACK_HOSTS.has(url.hostname)) return configured;
    const lanHost = metroLanHostname();
    if (!lanHost) return configured;
    url.hostname = lanHost;
    return url.toString().replace(/\/$/, "");
  } catch {
    return configured;
  }
}

// On local web dev, use Metro's loopback-only same-origin proxy so browser
// requests keep production's CORS/CSRF protection intact. Native clients still
// contact the configured agent directly; a deployed web build needs its own
// same-origin API host. Set EXPO_PUBLIC_AGENT_URL for local backend testing.
export const AGENT_URL = resolveAgentUrl();

// Session credential captured at sign-in (mirrored to SecureStore by
// session-store). A better-auth bearer token from the sign-in response body
// (RN fetch cannot read Set-Cookie). Cleared when the user signs out.
let authCookie: string | null = null;

export function setAuthCookie(cookie: string | null) {
  authCookie = cookie;
}

export function getAuthCookie(): string | null {
  return authCookie;
}

let store: SessionStore | null = null;

export function getStore(): SessionStore {
  if (!store) {
    store = new SessionStore({
      baseUrl: AGENT_URL,
      headers: () =>
        authCookie
          ? { authorization: `Bearer ${authCookie}` }
          : ({} as Record<string, string>),
    });
  }
  return store;
}
