import { NextResponse } from "next/server";

import {
  createConnectedAgent,
  listConnectedAgentSummaries,
} from "@/lib/connected-agents/store";
import { ConnectedAgentUrlError } from "@/lib/connected-agents/url-safety";
import {
  SecretCryptoError,
  credentialsKeyConfigured,
} from "@/lib/crypto/secrets";
import { RateLimitError, enforceRateLimit } from "@/lib/rate-limit";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

const PRIVATE = { "Cache-Control": "private, no-store" };

/** List connected private eve agents for the signed-in user. */
export async function GET(request: Request) {
  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup, request.headers);
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in required." },
      { status: 401, headers: PRIVATE },
    );
  }
  if (setup.authMode !== "email" && setup.authMode !== "vercel") {
    return NextResponse.json(
      { error: "A personal account is required." },
      { status: 403, headers: PRIVATE },
    );
  }

  try {
    await enforceRateLimit({
      key: viewer.id,
      prefix: "connected-agents-list",
      limit: 60,
      windowSeconds: 300,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: 429,
          headers: { ...PRIVATE, "Retry-After": String(error.retryAfter) },
        },
      );
    }
    return NextResponse.json(
      { error: "Could not load connected agents." },
      { status: 503, headers: PRIVATE },
    );
  }

  const agents = await listConnectedAgentSummaries(viewer.id);
  return NextResponse.json(
    {
      agents,
      available: credentialsKeyConfigured(),
    },
    { headers: PRIVATE },
  );
}

/** Link a private eve agent by URL + bearer token. */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const browserOrigin = request.headers.get("origin");
  if (browserOrigin && browserOrigin !== origin) {
    return NextResponse.json(
      { error: "Origin not allowed." },
      { status: 403, headers: PRIVATE },
    );
  }

  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup, request.headers);
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in required." },
      { status: 401, headers: PRIVATE },
    );
  }
  if (setup.authMode !== "email" && setup.authMode !== "vercel") {
    return NextResponse.json(
      { error: "A personal account is required." },
      { status: 403, headers: PRIVATE },
    );
  }

  if (!credentialsKeyConfigured()) {
    return NextResponse.json(
      { error: "Connected agents are not available on this deployment." },
      { status: 409, headers: PRIVATE },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    label?: unknown;
    url?: unknown;
    token?: unknown;
  } | null;

  const label = typeof body?.label === "string" ? body.label : "";
  const url = typeof body?.url === "string" ? body.url : "";
  const token = typeof body?.token === "string" ? body.token : "";

  try {
    await enforceRateLimit({
      key: viewer.id,
      prefix: "connected-agents-create",
      limit: 10,
      windowSeconds: 300,
    });

    const agent = await createConnectedAgent({
      userId: viewer.id,
      label,
      url,
      token,
    });
    const agents = await listConnectedAgentSummaries(viewer.id);
    return NextResponse.json({ agent, agents }, { headers: PRIVATE });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: 429,
          headers: { ...PRIVATE, "Retry-After": String(error.retryAfter) },
        },
      );
    }
    if (
      error instanceof ConnectedAgentUrlError ||
      error instanceof SecretCryptoError
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: PRIVATE },
      );
    }
    return NextResponse.json(
      { error: "Could not connect that agent." },
      { status: 502, headers: PRIVATE },
    );
  }
}
