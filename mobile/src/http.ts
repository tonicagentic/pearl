import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

export class HttpError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

/** True when fetch failed before an HTTP response (offline / DNS / timeout). */
export function isTransportFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error instanceof HttpError) return false;
  const message = error.message.toLowerCase();
  return (
    error.name === "TypeError" ||
    message.includes("network request failed") ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("timed out") ||
    message.includes("timeout")
  );
}

export function authHeaders(
  extras: Record<string, string> = {},
): Record<string, string> {
  const credential = getAuthCookie();
  return {
    "content-type": "application/json",
    ...(credential ? { authorization: `Bearer ${credential}` } : {}),
    ...extras,
  };
}

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  return body.error ?? `Request failed (${response.status}).`;
}

function handleAuth(response: Response): void {
  if (response.status === 401) {
    sessionInvalid();
  }
}

export type AuthedFetchOptions = RequestInit & {
  readonly json?: unknown;
};

/**
 * Shared bearer fetch for mobile API clients.
 * SessionStore keeps its own headers path — do not route eve through here.
 */
export async function authedFetch(
  path: string,
  options: AuthedFetchOptions = {},
): Promise<Response> {
  const { json, headers, body, ...rest } = options;
  const url = path.startsWith("http") ? path : `${AGENT_URL}${path}`;
  const response = await fetch(url, {
    ...rest,
    headers: authHeaders(
      headers
        ? Object.fromEntries(
            new Headers(headers).entries(),
          )
        : {},
    ),
    body: json !== undefined ? JSON.stringify(json) : body,
  });
  if (!response.ok) {
    handleAuth(response);
  }
  return response;
}

export async function authedJson<T>(
  path: string,
  options: AuthedFetchOptions = {},
): Promise<T> {
  const response = await authedFetch(path, options);
  if (!response.ok) {
    throw new HttpError(await readError(response), response.status, null);
  }
  return (await response.json()) as T;
}

export async function authedVoid(
  path: string,
  options: AuthedFetchOptions = {},
): Promise<void> {
  const response = await authedFetch(path, options);
  if (!response.ok) {
    throw new HttpError(await readError(response), response.status, null);
  }
}
