import { NextResponse } from "next/server";

import { listAllVercelResources } from "@/lib/connections/vercel-resources";
import { RateLimitError, enforceRateLimit } from "@/lib/rate-limit";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

const PRIVATE = { "Cache-Control": "private, no-store" };

/** Domains, integrations, and storage for the signed-in Connect grant. Never returns tokens. */
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
      prefix: "connect-vercel-resources",
      limit: 20,
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
      { error: "Could not load Vercel resources." },
      { status: 503, headers: PRIVATE },
    );
  }

  try {
    const catalog = await listAllVercelResources({ userId: viewer.id });
    return NextResponse.json(catalog, { headers: PRIVATE });
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof Error
            ? cause.message
            : "Failed to load Vercel resources.",
      },
      { status: 502, headers: PRIVATE },
    );
  }
}
