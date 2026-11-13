import { AGENT_URL, getAuthCookie } from "@/src/eve-transport";

export type WorkbenchPinDto = {
  readonly id: string;
  readonly userId: string;
  readonly owner: string;
  readonly name: string;
  readonly fullName: string;
  readonly vercelProjectId: string | null;
  readonly vercelTeamId: string | null;
  readonly expoProjectId: string | null;
  readonly expoUpdateChannel: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type SuggestedPinDto = {
  readonly owner: string;
  readonly name: string;
  readonly vercelProjectId?: string | null;
  readonly vercelTeamId?: string | null;
  readonly expoProjectId?: string | null;
  readonly expoUpdateChannel?: string | null;
};

function authHeaders(): HeadersInit {
  const credential = getAuthCookie();
  return {
    "content-type": "application/json",
    ...(credential ? { authorization: `Bearer ${credential}` } : {}),
  };
}

async function parseJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(
      typeof body.error === "string" ? body.error : `Request failed (${response.status})`,
    );
  }
  return body;
}

export async function fetchWorkbenchPins(): Promise<{
  readonly pins: readonly WorkbenchPinDto[];
  readonly suggested: SuggestedPinDto | null;
}> {
  const response = await fetch(`${AGENT_URL}/api/workbench/pins`, {
    headers: authHeaders(),
  });
  return parseJson(response);
}

export async function createWorkbenchPin(
  input: SuggestedPinDto & { readonly fullName?: string },
): Promise<WorkbenchPinDto> {
  const response = await fetch(`${AGENT_URL}/api/workbench/pins`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ pin: WorkbenchPinDto }>(response);
  return data.pin;
}

export async function deleteWorkbenchPin(pinId: string): Promise<void> {
  const response = await fetch(`${AGENT_URL}/api/workbench/pins/${pinId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await parseJson(response);
}

export type PinStatusDto = {
  readonly connected: boolean;
  readonly pullRequests: readonly {
    readonly number: number;
    readonly title: string;
    readonly state: string;
    readonly draft: boolean;
    readonly htmlUrl: string;
    readonly headRef: string;
    readonly baseRef: string;
  }[];
  readonly deployments: readonly {
    readonly uid: string;
    readonly url: string;
    readonly state: string;
    readonly target: string | null;
    readonly createdAt: number | null;
  }[];
  readonly message?: string;
  readonly githubError?: string;
  readonly vercelError?: string;
};

export async function fetchPinStatus(pinId: string): Promise<{
  readonly pin: WorkbenchPinDto;
  readonly status: PinStatusDto;
}> {
  const response = await fetch(
    `${AGENT_URL}/api/workbench/pins/${pinId}/status`,
    { headers: authHeaders() },
  );
  return parseJson(response);
}

export async function fetchPinResources(pinId: string): Promise<{
  readonly resources: {
    readonly domains: readonly {
      readonly name: string;
      readonly verified: boolean;
      readonly configured: boolean;
    }[];
    readonly envNames: readonly {
      readonly id: string;
      readonly key: string;
      readonly target: readonly string[];
    }[];
    readonly storage: readonly {
      readonly id: string;
      readonly kind: string;
      readonly name: string;
      readonly status: string | null;
      readonly region: string | null;
    }[];
    readonly recentErrors: readonly string[];
    readonly error?: string;
  };
}> {
  const response = await fetch(
    `${AGENT_URL}/api/workbench/pins/${pinId}/resources`,
    { headers: authHeaders() },
  );
  return parseJson(response);
}

export async function fetchPinUsage(pinId: string): Promise<{
  readonly kind: string;
  readonly usage: {
    readonly teamId: string | null;
    readonly periodStart: string | null;
    readonly periodEnd: string | null;
    readonly bandwidthBytes: number | null;
    readonly functionInvocationCount: number | null;
    readonly buildMinutes: number | null;
    readonly storageBytes: number | null;
    readonly invoiceTotalCents: number | null;
  };
  readonly pearlBillingPath: string;
}> {
  const response = await fetch(
    `${AGENT_URL}/api/workbench/pins/${pinId}/usage`,
    { headers: authHeaders() },
  );
  return parseJson(response);
}

export async function fetchPinDatabase(pinId: string): Promise<{
  readonly status: {
    readonly branch: string | null;
    readonly computeStatus: string | null;
    readonly storageBytes: number | null;
    readonly tables: readonly {
      readonly schema: string;
      readonly name: string;
      readonly approximateRows: number | null;
    }[];
  };
}> {
  const response = await fetch(
    `${AGENT_URL}/api/workbench/pins/${pinId}/database`,
    { headers: authHeaders() },
  );
  return parseJson(response);
}

export async function queryPinDatabase(
  pinId: string,
  sql: string,
): Promise<{
  readonly fields: readonly string[];
  readonly rows: readonly Record<string, unknown>[];
  readonly truncated: boolean;
}> {
  const response = await fetch(
    `${AGENT_URL}/api/workbench/pins/${pinId}/database`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ sql }),
    },
  );
  return parseJson(response);
}

export async function writePinEnv(
  pinId: string,
  input: {
    readonly key: string;
    readonly value: string;
    readonly target: readonly ("production" | "preview" | "development")[];
    readonly approved: boolean;
  },
): Promise<{ readonly ok: true; readonly key: string }> {
  const response = await fetch(
    `${AGENT_URL}/api/workbench/pins/${pinId}/env`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(input),
    },
  );
  return parseJson(response);
}

export async function addPinDomain(
  pinId: string,
  input: { readonly name: string; readonly approved: boolean },
): Promise<{ readonly ok: true; readonly name: string }> {
  const response = await fetch(
    `${AGENT_URL}/api/workbench/pins/${pinId}/domains`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(input),
    },
  );
  return parseJson(response);
}
