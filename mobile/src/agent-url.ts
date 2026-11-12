import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const AGENT_URL_KEY = "pearl.agent_url.v1";

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeAgentUrl(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function readStored(): Promise<string | null> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(AGENT_URL_KEY);
  }
  return SecureStore.getItemAsync(AGENT_URL_KEY);
}

async function writeStored(url: string | null): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return;
    if (url) window.localStorage.setItem(AGENT_URL_KEY, url);
    else window.localStorage.removeItem(AGENT_URL_KEY);
    return;
  }
  if (url) await SecureStore.setItemAsync(AGENT_URL_KEY, url);
  else await SecureStore.deleteItemAsync(AGENT_URL_KEY);
}

/** Normalize and validate a user-entered agent base URL. */
export function normalizeAgentUrlInput(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) {
    throw new Error("Enter your deployment URL.");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("That doesn’t look like a valid URL.");
  }
  if (parsed.protocol !== "https:") {
    if (!(__DEV__ && (parsed.protocol === "http:"))) {
      throw new Error("Use an https:// URL for your deployment.");
    }
  }
  if (parsed.username || parsed.password) {
    throw new Error("Don’t include credentials in the URL.");
  }
  return parsed.toString().replace(/\/$/, "");
}

export function agentHostname(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Disk helpers used by eve-transport. Callers that change the active agent
 * should go through applyAgentUrl / resetAgentUrl in eve-transport so the
 * in-memory binding and SessionStore stay in sync.
 */
export async function loadSavedAgentUrl(): Promise<string | null> {
  const value = await readStored();
  if (!value) return null;
  try {
    return normalizeAgentUrlInput(value);
  } catch {
    await writeStored(null);
    return null;
  }
}

export async function saveAgentUrl(url: string): Promise<void> {
  const normalized = normalizeAgentUrlInput(url);
  await writeStored(normalized);
  notify();
}

export async function clearSavedAgentUrl(): Promise<void> {
  await writeStored(null);
  notify();
}
