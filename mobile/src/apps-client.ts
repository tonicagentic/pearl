// Mini apps client: hits the web app's /api/apps routes with the same
// better-auth credential the eve transport uses.

import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

export type MiniAppDto = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly githubOwner: string | null;
  readonly githubRepo: string | null;
  readonly productionUrl: string | null;
  readonly previewUrl: string | null;
  readonly previewPort?: number;
  readonly status: "draft" | "building" | "published" | "failed";
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly embedUrl?: string | null;
};

function authHeaders(): Record<string, string> {
  const credential = getAuthCookie();

  return {
    "content-type": "application/json",
    ...(credential ? { authorization: `Bearer ${credential}` } : {}),
  };
}

export async function fetchApps(): Promise<{ apps: MiniAppDto[] }> {
  const response = await fetch(`${AGENT_URL}/api/apps`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      sessionInvalid();
    }
    const body = await response.text().catch(() => "");
    throw new Error(
      `Failed to load apps (${response.status}) ${body.slice(0, 120)}`,
    );
  }

  return (await response.json()) as { apps: MiniAppDto[] };
}

export async function fetchApp(
  id: string,
): Promise<{ app: MiniAppDto & { embedUrl: string | null } }> {
  const response = await fetch(
    `${AGENT_URL}/api/apps/${encodeURIComponent(id)}`,
    { headers: authHeaders() },
  );

  if (!response.ok) {
    if (response.status === 401) {
      sessionInvalid();
    }
    const body = await response.text().catch(() => "");
    throw new Error(
      `Failed to load app (${response.status}) ${body.slice(0, 120)}`,
    );
  }

  return (await response.json()) as {
    app: MiniAppDto & { embedUrl: string | null };
  };
}
