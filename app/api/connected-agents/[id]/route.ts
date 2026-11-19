import { NextResponse } from "next/server";

import {
  deleteConnectedAgent,
  getConnectedAgentForUser,
  listConnectedAgentSummaries,
  updateConnectedAgent,
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

async function requireViewer(request: Request) {
  const origin = new URL(request.url).origin;
  const browserOrigin = request.headers.get("origin");
  if (browserOrigin && browserOrigin !== origin) {
    return {
      error: NextResponse.json(
        { error: "Origin not allowed." },
        { status: 403, headers: PRIVATE },
      ),
    } as const;
  }

  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup, request.headers);
  if (!viewer) {
    return {
      error: NextResponse.json(
        { error: "Sign in required." },
        { status: 401, headers: PRIVATE },
      ),
    } as const;
  }
  if (setup.authMode !== "email" && setup.authMode !== "vercel") {
    return {
      error: NextResponse.json(
        { error: "A personal account is required." },
        { status: 403, headers: PRIVATE },
      ),
    } as const;
  }
  return { viewer } as const;
}

/** Rename, retarget, or rotate the bearer for one connected agent. */
export async function PATCH(
  request: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
) {
  const auth = await requireViewer(request);
  if ("error" in auth) return auth.error;

  if (!credentialsKeyConfigured()) {
    return NextResponse.json(
      { error: "Connected agents are not available on this deployment." },
      { status: 409, headers: PRIVATE },
    );
  }

  const { id } = await params;
  const existing = await getConnectedAgentForUser(auth.viewer.id, id);
  if (!existing) {
    return NextResponse.json(
      { error: "Unknown connected agent." },
      { status: 404, headers: PRIVATE },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    label?: unknown;
    url?: unknown;
    token?: unknown;
  } | null;

  const label =
    typeof body?.label === "string" ? body.label : undefined;
  const url = typeof body?.url === "string" ? body.url : undefined;
  const token =
    typeof body?.token === "string" ? body.token : undefined;

  if (label === undefined && url === undefined && token === undefined) {
    return NextResponse.json(
      { error: "Provide label, url, and/or token." },
      { status: 400, headers: PRIVATE },
    );
  }

  try {
    await enforceRateLimit({
      key: auth.viewer.id,
      prefix: "connected-agents-update",
      limit: 20,
      windowSeconds: 300,
    });

    const agent = await updateConnectedAgent({
      userId: auth.viewer.id,
      agentId: id,
      label,
      url,
      token,
    });
    if (!agent) {
      return NextResponse.json(
        { error: "Unknown connected agent." },
        { status: 404, headers: PRIVATE },
      );
    }
    const agents = await listConnectedAgentSummaries(auth.viewer.id);
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
      { error: "Could not update that agent." },
      { status: 502, headers: PRIVATE },
    );
  }
}

/** Remove a connected agent. Chats that pointed at it clear to Pearl. */
export async function DELETE(
  request: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
) {
  const auth = await requireViewer(request);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const existing = await getConnectedAgentForUser(auth.viewer.id, id);
  if (!existing) {
    return NextResponse.json(
      { error: "Unknown connected agent." },
      { status: 404, headers: PRIVATE },
    );
  }

  try {
    await enforceRateLimit({
      key: auth.viewer.id,
      prefix: "connected-agents-delete",
      limit: 20,
      windowSeconds: 300,
    });
    await deleteConnectedAgent(auth.viewer.id, id);
    const agents = await listConnectedAgentSummaries(auth.viewer.id);
    return NextResponse.json({ agents }, { headers: PRIVATE });
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
      { error: "Could not remove that agent." },
      { status: 502, headers: PRIVATE },
    );
  }
}
