// Skills client for the mobile app: hits the web app's /api/skills routes
// with the same better-auth credential the eve transport uses.

import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

export type SkillDto = {
  id: string;
  slug: string;
  title: string;
  description: string;
  markdown: string;
  files: Record<string, string>;
  enabled: boolean;
  source: "custom" | "registry";
  registryName: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type RegistrySearchHit = {
  name: string;
  title: string;
  description: string;
};

export type RegistrySkillPackage = {
  registryName: string;
  slug: string;
  title: string;
  description: string;
  author?: string;
  markdown: string;
  files: Record<string, string>;
  filePaths: string[];
};

export type SkillsPayload = {
  skills: SkillDto[];
};

export type SkillFormInput = {
  title: string;
  slug: string;
  description: string;
  markdown: string;
  enabled: boolean;
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

async function postOp<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${AGENT_URL}/api/skills`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    await parseError(response, "Skills request failed");
  }
  return (await response.json()) as T;
}

export async function fetchSkills(): Promise<SkillsPayload> {
  const response = await fetch(`${AGENT_URL}/api/skills`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    await parseError(response, "Could not load skills");
  }
  return (await response.json()) as SkillsPayload;
}

export async function createSkillRequest(
  input: SkillFormInput,
): Promise<SkillDto> {
  const data = await postOp<{ skill: SkillDto }>({ op: "create", ...input });
  return data.skill;
}

export async function updateSkillRequest(
  id: string,
  input: SkillFormInput,
): Promise<SkillDto> {
  const data = await postOp<{ skill: SkillDto }>({
    op: "update",
    id,
    ...input,
  });
  return data.skill;
}

export async function setSkillEnabledRequest(
  id: string,
  enabled: boolean,
): Promise<SkillDto> {
  const data = await postOp<{ skill: SkillDto }>({
    op: "setEnabled",
    id,
    enabled,
  });
  return data.skill;
}

export async function deleteSkillRequest(id: string): Promise<void> {
  await postOp<{ ok: true }>({ op: "delete", id });
}

export async function searchPublishedSkillsRequest(query: string): Promise<{
  items: RegistrySearchHit[];
  total: number;
  hasMore: boolean;
}> {
  return postOp({ op: "search", query });
}

export async function previewPublishedSkillRequest(
  registryName: string,
): Promise<RegistrySkillPackage> {
  const data = await postOp<{ preview: RegistrySkillPackage }>({
    op: "preview",
    registryName,
  });
  return data.preview;
}

export async function installPublishedSkillRequest(
  registryName: string,
): Promise<SkillDto> {
  const data = await postOp<{ skill: SkillDto }>({
    op: "install",
    registryName,
  });
  return data.skill;
}
