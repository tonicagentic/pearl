/**
 * Minimal Vercel REST helpers for the workbench.
 * Env values are never returned — only names and targets.
 */

import type {
  WorkbenchDeployment,
  WorkbenchDomain,
  WorkbenchEnvName,
  WorkbenchStorageItem,
  WorkbenchVercelUsage,
} from "./types.ts";

const VERCEL_API = "https://api.vercel.com";

export type VercelFetch = (
  path: string,
  init?: RequestInit & { readonly teamId?: string | null },
) => Promise<Response>;

export function createVercelFetch(token: string): VercelFetch {
  return async (path, init) => {
    const url = new URL(`${VERCEL_API}${path}`);
    if (init?.teamId) {
      url.searchParams.set("teamId", init.teamId);
    }
    const { teamId: _teamId, ...rest } = init ?? {};
    return fetch(url, {
      ...rest,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(rest.headers ?? {}),
      },
    });
  };
}

async function vercelJson<T>(
  vercelFetch: VercelFetch,
  path: string,
  init?: RequestInit & { readonly teamId?: string | null },
): Promise<T> {
  const res = await vercelFetch(path, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Vercel ${init?.method ?? "GET"} ${path} → ${res.status}: ${body.slice(0, 400)}`,
    );
  }
  return (await res.json()) as T;
}

export async function listProjectDeployments(
  vercelFetch: VercelFetch,
  args: {
    readonly projectId: string;
    readonly teamId?: string | null;
    readonly limit?: number;
  },
): Promise<readonly WorkbenchDeployment[]> {
  const limit = args.limit ?? 10;
  const data = await vercelJson<{
    deployments?: Array<{
      uid: string;
      url: string;
      readyState?: string;
      state?: string;
      target?: string | null;
      created?: number;
      createdAt?: number;
    }>;
  }>(
    vercelFetch,
    `/v6/deployments?projectId=${encodeURIComponent(args.projectId)}&limit=${limit}`,
    { teamId: args.teamId },
  );

  return (data.deployments ?? []).map((d) => ({
    uid: d.uid,
    url: d.url.startsWith("http") ? d.url : `https://${d.url}`,
    state: d.readyState ?? d.state ?? "UNKNOWN",
    target:
      d.target === "production" ||
      d.target === "preview" ||
      d.target === "staging"
        ? d.target
        : null,
    createdAt: d.createdAt ?? d.created ?? null,
  }));
}

export async function listProjectDomains(
  vercelFetch: VercelFetch,
  args: { readonly projectId: string; readonly teamId?: string | null },
): Promise<readonly WorkbenchDomain[]> {
  const data = await vercelJson<{
    domains?: Array<{
      name: string;
      verified?: boolean;
      configured?: boolean;
    }>;
  }>(
    vercelFetch,
    `/v9/projects/${encodeURIComponent(args.projectId)}/domains`,
    { teamId: args.teamId },
  );
  return (data.domains ?? []).map((d) => ({
    name: d.name,
    verified: Boolean(d.verified),
    configured: d.configured !== false,
  }));
}

type RawEnv = {
  readonly id?: string;
  readonly key: string;
  readonly target?: string[] | string;
  readonly value?: string;
};

/** Map raw env rows to name-only records. Strips any `value` field. */
export function mapEnvNames(rows: readonly RawEnv[]): readonly WorkbenchEnvName[] {
  return rows.map((row) => {
    const targets = Array.isArray(row.target)
      ? row.target
      : typeof row.target === "string"
        ? [row.target]
        : [];
    const filtered = targets.filter(
      (t): t is "production" | "preview" | "development" =>
        t === "production" || t === "preview" || t === "development",
    );
    return {
      id: row.id ?? row.key,
      key: row.key,
      target: filtered,
    };
  });
}

export async function listProjectEnvNames(
  vercelFetch: VercelFetch,
  args: { readonly projectId: string; readonly teamId?: string | null },
): Promise<readonly WorkbenchEnvName[]> {
  const data = await vercelJson<{ envs?: RawEnv[] } | RawEnv[]>(
    vercelFetch,
    `/v9/projects/${encodeURIComponent(args.projectId)}/env`,
    { teamId: args.teamId },
  );
  const rows = Array.isArray(data) ? data : (data.envs ?? []);
  return mapEnvNames(rows);
}

export async function listProjectStorage(
  vercelFetch: VercelFetch,
  args: { readonly projectId: string; readonly teamId?: string | null },
): Promise<readonly WorkbenchStorageItem[]> {
  // Vercel stores API varies; tolerate empty / missing.
  try {
    const data = await vercelJson<{
      stores?: Array<{
        id: string;
        name?: string;
        type?: string;
        status?: string;
        region?: string;
      }>;
    }>(
      vercelFetch,
      `/v1/storage?projectId=${encodeURIComponent(args.projectId)}&limit=50`,
      { teamId: args.teamId },
    );
    return (data.stores ?? []).map((s) => ({
      id: s.id,
      kind: classifyStore(s.type),
      name: s.name ?? s.id,
      status: s.status ?? null,
      region: s.region ?? null,
    }));
  } catch {
    return [];
  }
}

function classifyStore(
  type: string | undefined,
): WorkbenchStorageItem["kind"] {
  const t = (type ?? "").toLowerCase();
  if (t.includes("blob")) return "blob";
  if (t.includes("postgres") || t.includes("neon")) return "postgres";
  if (t.includes("edge")) return "edge-config";
  return "other";
}

export async function listRecentDeploymentErrors(
  vercelFetch: VercelFetch,
  args: {
    readonly deploymentId: string;
    readonly teamId?: string | null;
    readonly limit?: number;
  },
): Promise<readonly string[]> {
  const data = await vercelJson<{
    events?: Array<{ text?: string; type?: string; info?: { type?: string } }>;
  }>(
    vercelFetch,
    `/v2/deployments/${encodeURIComponent(args.deploymentId)}/events?limit=${args.limit ?? 50}`,
    { teamId: args.teamId },
  );
  const errors: string[] = [];
  for (const event of data.events ?? []) {
    const text = event.text?.trim();
    if (!text) continue;
    const kind = (event.type ?? event.info?.type ?? "").toLowerCase();
    if (kind.includes("error") || /error|failed|fatal/i.test(text)) {
      // Scrub KEY=value before returning.
      errors.push(text.replace(/\b([A-Z][A-Z0-9_]{2,})=([^\s]+)/g, "$1=[redacted]"));
    }
  }
  return errors.slice(0, args.limit ?? 20);
}

/**
 * Best-effort usage summary. Vercel billing APIs differ by plan; return nulls
 * when a field is missing rather than inventing numbers.
 */
export async function getTeamUsage(
  vercelFetch: VercelFetch,
  args: { readonly teamId?: string | null },
): Promise<WorkbenchVercelUsage> {
  const empty: WorkbenchVercelUsage = {
    teamId: args.teamId ?? null,
    periodStart: null,
    periodEnd: null,
    bandwidthBytes: null,
    functionInvocationCount: null,
    buildMinutes: null,
    storageBytes: null,
    invoiceTotalCents: null,
  };

  if (!args.teamId) return empty;

  try {
    const data = await vercelJson<{
      bandwidth?: { total?: number };
      serverlessFunctionExecution?: { total?: number };
      buildExecution?: { total?: number };
      artifacts?: { total?: number };
      period?: { start?: string; end?: string };
      invoice?: { total?: number };
    }>(vercelFetch, `/v1/teams/${encodeURIComponent(args.teamId)}/usage`, {
      teamId: args.teamId,
    });
    return {
      teamId: args.teamId,
      periodStart: data.period?.start ?? null,
      periodEnd: data.period?.end ?? null,
      bandwidthBytes: data.bandwidth?.total ?? null,
      functionInvocationCount: data.serverlessFunctionExecution?.total ?? null,
      buildMinutes: data.buildExecution?.total ?? null,
      storageBytes: data.artifacts?.total ?? null,
      invoiceTotalCents:
        typeof data.invoice?.total === "number"
          ? Math.round(data.invoice.total * 100)
          : null,
    };
  } catch {
    return empty;
  }
}

export type EnvWriteInput = {
  readonly projectId: string;
  readonly teamId?: string | null;
  readonly key: string;
  readonly value: string;
  readonly target: readonly ("production" | "preview" | "development")[];
};

/** Write an env var. Caller must have already obtained approval. */
export async function writeProjectEnv(
  vercelFetch: VercelFetch,
  input: EnvWriteInput,
): Promise<{ readonly id: string; readonly key: string }> {
  const data = await vercelJson<{ id?: string; key?: string }>(
    vercelFetch,
    `/v10/projects/${encodeURIComponent(input.projectId)}/env`,
    {
      method: "POST",
      teamId: input.teamId,
      body: JSON.stringify({
        key: input.key,
        value: input.value,
        type: "encrypted",
        target: input.target,
      }),
    },
  );
  return { id: data.id ?? input.key, key: data.key ?? input.key };
}

export async function addProjectDomain(
  vercelFetch: VercelFetch,
  args: {
    readonly projectId: string;
    readonly teamId?: string | null;
    readonly name: string;
  },
): Promise<{ readonly name: string }> {
  const data = await vercelJson<{ name?: string }>(
    vercelFetch,
    `/v10/projects/${encodeURIComponent(args.projectId)}/domains`,
    {
      method: "POST",
      teamId: args.teamId,
      body: JSON.stringify({ name: args.name }),
    },
  );
  return { name: data.name ?? args.name };
}
