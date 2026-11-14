// Computer Use sandbox settings for the signed-in account.

import {
  BROWSER_TIMEOUT_MINUTES,
  CODER_TIMEOUT_MINUTES,
  SANDBOX_VCPU_OPTIONS,
  type SandboxSettings,
  type SandboxSettingsPatch,
} from "../../lib/sandbox/settings";
import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

export {
  BROWSER_TIMEOUT_MINUTES,
  CODER_TIMEOUT_MINUTES,
  SANDBOX_VCPU_OPTIONS,
};
export type { SandboxSettings, SandboxSettingsPatch };

function authHeaders(): Record<string, string> {
  const credential = getAuthCookie();
  return {
    "content-type": "application/json",
    ...(credential ? { authorization: `Bearer ${credential}` } : {}),
  };
}

async function parseError(response: Response, fallback: string): Promise<never> {
  if (response.status === 401) {
    sessionInvalid();
  }
  let detail = fallback;
  try {
    const data = (await response.json()) as { error?: string };
    if (typeof data.error === "string" && data.error.trim()) {
      detail = data.error;
    }
  } catch {
    // keep fallback
  }
  throw new Error(detail);
}

export async function fetchSandboxSettings(): Promise<SandboxSettings> {
  const response = await fetch(`${AGENT_URL}/api/sandbox-settings`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    await parseError(response, "Could not load sandbox settings");
  }
  return (await response.json()) as SandboxSettings;
}

export async function updateSandboxSettings(
  patch: SandboxSettingsPatch,
): Promise<SandboxSettings> {
  const response = await fetch(`${AGENT_URL}/api/sandbox-settings`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    await parseError(response, "Could not save sandbox settings");
  }
  return (await response.json()) as SandboxSettings;
}
