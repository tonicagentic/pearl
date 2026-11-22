import { File, Paths } from "expo-file-system";

import { artifactKindFromBasename, type ArtifactKind } from "../../lib/library/artifact-kind";
import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

export type ArtifactDto = {
  readonly pathname: string;
  readonly basename: string;
  readonly size: number;
  readonly uploadedAt: string;
  readonly kind: ArtifactKind;
};

function authHeaders(): Record<string, string> {
  const credential = getAuthCookie();
  return {
    "content-type": "application/json",
    ...(credential ? { authorization: `Bearer ${credential}` } : {}),
  };
}

/** Auth headers for Image / download requests (no content-type). */
export function artifactAuthHeaders(): Record<string, string> {
  const credential = getAuthCookie();
  return credential ? { authorization: `Bearer ${credential}` } : {};
}

/** Absolute content URL for an artifact pathname. */
export function artifactContentUrl(
  pathname: string,
  options?: { readonly download?: boolean },
): string {
  const params = new URLSearchParams({ pathname });
  if (options?.download) params.set("download", "1");
  return `${AGENT_URL}/api/artifacts/content?${params.toString()}`;
}

export async function listArtifacts(): Promise<readonly ArtifactDto[]> {
  const response = await fetch(`${AGENT_URL}/api/artifacts`, {
    headers: authHeaders(),
  });
  if (response.status === 401) {
    sessionInvalid();
    throw new Error("Sign in to view your library.");
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(data?.error ?? "Failed to load library.");
  }
  const data = (await response.json()) as {
    artifacts?: readonly {
      pathname: string;
      basename: string;
      size: number;
      uploadedAt: string;
      kind?: ArtifactKind;
    }[];
  };
  return (data.artifacts ?? []).map((row) => ({
    pathname: row.pathname,
    basename: row.basename,
    size: row.size,
    uploadedAt: row.uploadedAt,
    kind: row.kind ?? artifactKindFromBasename(row.basename),
  }));
}

export async function deleteArtifact(pathname: string): Promise<void> {
  const response = await fetch(`${AGENT_URL}/api/artifacts`, {
    method: "DELETE",
    headers: authHeaders(),
    body: JSON.stringify({ pathname }),
  });
  if (response.status === 401) {
    sessionInvalid();
    throw new Error("Sign in to delete library items.");
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(data?.error ?? "Failed to delete.");
  }
}

function sanitizeName(name: string): string {
  const cleaned = name.replace(/[/\\?%*:|"<>]/g, "_").trim();
  return cleaned || "file";
}

/** Download artifact bytes with auth into a cache file for preview/share. */
export async function downloadArtifactToCache(
  item: Pick<ArtifactDto, "pathname" | "basename">,
): Promise<File> {
  const response = await fetch(artifactContentUrl(item.pathname), {
    headers: artifactAuthHeaders(),
  });
  if (response.status === 401) {
    sessionInvalid();
    throw new Error("Sign in to open library items.");
  }
  if (!response.ok) {
    throw new Error("Could not download that file.");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const file = new File(
    Paths.cache,
    `pearl-library-${Date.now()}-${sanitizeName(item.basename)}`,
  );
  file.create({ overwrite: true });
  file.writeSync(bytes);
  return file;
}
