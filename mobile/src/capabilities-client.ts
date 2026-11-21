// Capability catalog client for the mobile app — marketable skills,
// products, and services over /api/capabilities.

import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

export type CapabilityKind = "skill" | "product" | "service";
export type CapabilityStatus = "active" | "exploring" | "archived";

export type CapabilityDto = {
  id: string;
  name: string;
  kind: CapabilityKind;
  summary: string;
  audience: string | null;
  proof: string | null;
  status: CapabilityStatus;
  projectId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CapabilityInput = {
  name: string;
  kind: CapabilityKind;
  summary: string;
  audience?: string | null;
  proof?: string | null;
  status?: CapabilityStatus;
  notes?: string | null;
  id?: string;
};

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

export async function fetchCapabilities(
  includeArchived = false,
): Promise<readonly CapabilityDto[]> {
  const query = includeArchived ? "?includeArchived=1" : "";
  const response = await fetch(`${AGENT_URL}/api/capabilities${query}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    await parseError(response, "Could not load capabilities");
  }
  const data = (await response.json()) as {
    capabilities?: CapabilityDto[];
  };
  return data.capabilities ?? [];
}

async function postOp(
  body: Record<string, unknown>,
): Promise<CapabilityDto> {
  const response = await fetch(`${AGENT_URL}/api/capabilities`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    await parseError(response, "Could not update capability");
  }
  const data = (await response.json()) as { capability?: CapabilityDto };
  if (!data.capability) {
    throw new Error("Could not update capability");
  }
  return data.capability;
}

export function saveCapability(input: CapabilityInput): Promise<CapabilityDto> {
  return postOp({ op: "save", ...input });
}

export function updateCapability(
  id: string,
  input: Partial<CapabilityInput>,
): Promise<CapabilityDto> {
  return postOp({ op: "update", id, ...input });
}

export function archiveCapability(id: string): Promise<CapabilityDto> {
  return postOp({ op: "archive", id });
}
