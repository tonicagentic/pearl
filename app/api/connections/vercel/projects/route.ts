import { NextResponse } from "next/server";

import { listAllVercelProjects } from "@/lib/connections/vercel-projects";
import { RateLimitError, enforceRateLimit } from "@/lib/rate-limit";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

const PRIVATE = { "Cache-Control": "private, no-store" };

/** Full Vercel project catalog for the signed-in Connect grant. Never returns tokens. */
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
      prefix: "connect-vercel-projects",
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
      { error: "Could not load Vercel projects." },
      { status: 503, headers: PRIVATE },
    );
  }

  try {
    const catalog = await listAllVercelProjects({ userId: viewer.id });
    return NextResponse.json(catalog, { headers: PRIVATE });
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof Error
            ? cause.message
            : "Failed to load Vercel projects.",
      },
      { status: 502, headers: PRIVATE },
    );
  }
}
