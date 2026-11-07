import { AGENT_URL, getAuthCookie } from "./eve-transport";

export type LiveTokenResponse = {
  readonly token: string;
  readonly url: string;
  readonly expiresAt?: number;
};

export async function fetchLiveToken(): Promise<LiveTokenResponse> {
  const credential = getAuthCookie();
  let response: Response;
  try {
    response = await fetch(`${AGENT_URL}/api/live/token`, {
      method: "POST",
      headers: {
        accept: "application/json",
        ...(credential ? { authorization: `Bearer ${credential}` } : {}),
      },
      redirect: "manual",
    });
  } catch {
    throw new Error("Could not reach the agent. Check that Next is running and the phone can reach it.");
  }
  if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
    throw new Error("Could not start the live session.");
  }
  const body = await response.json().catch(() => null) as {
    error?: unknown;
    expiresAt?: unknown;
    token?: unknown;
    url?: unknown;
  } | null;
  if (!response.ok) {
    throw new Error(typeof body?.error === "string" ? body.error : "Could not start the live session.");
  }
  if (
    !body ||
    typeof body.token !== "string" ||
    typeof body.url !== "string" ||
    !/^wss?:\/\//.test(body.url)
  ) {
    throw new Error("Could not start the live session.");
  }
  return {
    token: body.token,
    url: body.url,
    ...(typeof body.expiresAt === "number" ? { expiresAt: body.expiresAt } : {}),
  };
}
