// Long-term memory client for the mobile app: the signed-in principal's
// indexed facts, over /api/memory.

import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

export type MemoryEntry = {
  index: number;
  text: string;
};

export type MemorySnapshot = {
  entries: MemoryEntry[];
  recallCharacters: number;
  recallLimit: number;
  notice?: "duplicate" | "missing" | null;
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

export async function fetchMemories(): Promise<MemorySnapshot> {
  const response = await fetch(`${AGENT_URL}/api/memory`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    await parseError(response, "Could not load memory");
  }
  return (await response.json()) as MemorySnapshot;
}

async function postOp(body: Record<string, unknown>): Promise<MemorySnapshot> {
  const response = await fetch(`${AGENT_URL}/api/memory`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    await parseError(response, "Could not update memory");
  }
  return (await response.json()) as MemorySnapshot;
}

export function addMemory(text: string): Promise<MemorySnapshot> {
  return postOp({ op: "add", text });
}

export function updateMemory(
  index: number,
  text: string,
): Promise<MemorySnapshot> {
  return postOp({ op: "update", index, text });
}

export function removeMemory(index: number): Promise<MemorySnapshot> {
  return postOp({ op: "remove", index });
}

export function clearMemories(): Promise<MemorySnapshot> {
  return postOp({ op: "clear" });
}
