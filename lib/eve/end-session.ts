import { Client, type ClientOptions } from "eve/client";

import { getEffectiveAppUrl } from "@/lib/auth-url";

export type EndSessionRequestHeaders = Headers | HeadersInit;

type EndableSession = {
  end: (options?: { readonly reason?: string }) => Promise<unknown>;
};

type EndSessionClient = {
  readonly sessions: {
    attach: (sessionId: string) => EndableSession;
  };
};

export type BestEffortEndEveSessionDeps = {
  readonly createClient?: (options: ClientOptions) => EndSessionClient;
  readonly baseUrl?: string;
};

function pickAuthHeaders(
  requestHeaders: EndSessionRequestHeaders | undefined,
): Record<string, string> {
  if (!requestHeaders) return {};
  const headers = new Headers(requestHeaders);
  const out: Record<string, string> = {};
  const cookie = headers.get("cookie");
  const authorization = headers.get("authorization");
  if (cookie) out.cookie = cookie;
  if (authorization) out.authorization = authorization;
  return out;
}

/**
 * Best-effort retirement of an eve session. Never throws — callers use this
 * before deleting Pearl chat rows so sandbox/`session.ended` cleanup can run
 * without blocking the user-facing delete.
 */
export async function bestEffortEndEveSession(
  input: {
    readonly sessionId: string;
    readonly requestHeaders?: EndSessionRequestHeaders;
    readonly reason?: string;
  },
  deps: BestEffortEndEveSessionDeps = {},
): Promise<void> {
  const sessionId = input.sessionId?.trim();
  if (!sessionId) return;

  try {
    const createClient =
      deps.createClient ??
      ((options: ClientOptions) => new Client(options) as EndSessionClient);
    const client = createClient({
      baseUrl: deps.baseUrl ?? getEffectiveAppUrl(),
      headers: pickAuthHeaders(input.requestHeaders),
    });
    await client.sessions.attach(sessionId).end({
      reason: input.reason ?? "chat_deleted",
    });
  } catch {
    // Delete must succeed even when the session is already gone or eve is down.
  }
}
