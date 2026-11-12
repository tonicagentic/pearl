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

import {
  clearSavedAgentUrl,
  loadSavedAgentUrl,
  saveAgentUrl,
} from "./agent-url";
import { clearSession, sessionInvalid } from "./session-store";

export { toThreadMessages } from "./message-projection";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
export const DEFAULT_AGENT_URL = "https://my-agent-pi-eight.vercel.app";

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

function envOrDefaultAgentUrl(): string {
  return process.env.EXPO_PUBLIC_AGENT_URL ?? DEFAULT_AGENT_URL;
}

/**
 * Resolve the agent API base URL.
 *
 * On a physical device, `127.0.0.1` is the phone — rewrite loopback agent URLs
 * to Metro's LAN host so local Next stays reachable without editing .env.
 */
export function resolveAgentUrl(
  configured = envOrDefaultAgentUrl(),
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

// Live binding: importers that read AGENT_URL at call time pick up overrides
// after applyAgentUrl / resetAgentUrl. On local web dev, use Metro's
// loopback-only same-origin proxy so browser requests keep production's
// CORS/CSRF protection intact.
export let AGENT_URL = resolveAgentUrl();

const agentUrlListeners = new Set<() => void>();

export function subscribeAgentUrlBinding(listener: () => void): () => void {
  agentUrlListeners.add(listener);
  return () => {
    agentUrlListeners.delete(listener);
  };
}

function notifyAgentUrlListeners() {
  for (const listener of agentUrlListeners) listener();
}

export function getAgentUrl(): string {
  return AGENT_URL;
}

export function isCustomAgentUrl(): boolean {
  return AGENT_URL !== resolveAgentUrl(envOrDefaultAgentUrl());
}

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

function dropSessionStore() {
  store = null;
}

async function clearAuthForHostSwitch() {
  setAuthCookie(null);
  dropSessionStore();
  await clearSession();
  // Notify AuthProvider so signed-in UI state resets (same path as a 401).
  sessionInvalid();
}

/**
 * Point the app at a custom eve deployment. Clears auth so credentials never
 * cross hosts, persists the URL, and rebuilds the SessionStore on next use.
 */
export async function applyAgentUrl(url: string): Promise<string> {
  await saveAgentUrl(url);
  const next = resolveAgentUrl(url);
  AGENT_URL = next;
  await clearAuthForHostSwitch();
  notifyAgentUrlListeners();
  return next;
}

/** Restore the hosted / env default agent and clear any custom override. */
export async function resetAgentUrl(): Promise<string> {
  await clearSavedAgentUrl();
  AGENT_URL = resolveAgentUrl(envOrDefaultAgentUrl());
  await clearAuthForHostSwitch();
  notifyAgentUrlListeners();
  return AGENT_URL;
}

/**
 * Cold-start: load a saved custom agent URL before the first API call.
 * Does not clear auth — pair with session restore in AuthProvider.
 */
export async function restoreAgentUrl(): Promise<string> {
  const saved = await loadSavedAgentUrl();
  AGENT_URL = resolveAgentUrl(saved ?? envOrDefaultAgentUrl());
  dropSessionStore();
  notifyAgentUrlListeners();
  return AGENT_URL;
}
