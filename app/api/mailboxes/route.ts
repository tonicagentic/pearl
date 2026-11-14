import { NextResponse } from "next/server";

import { listMailboxSummaries } from "@/lib/mail/accounts";
import { RateLimitError, enforceRateLimit } from "@/lib/rate-limit";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

const PRIVATE = { "Cache-Control": "private, no-store" };

/** List connected Gmail mailboxes for the signed-in user. */
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
      prefix: "mailboxes-list",
      limit: 30,
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
      { error: "Could not load mailboxes." },
      { status: 503, headers: PRIVATE },
    );
  }

  const mailboxes = await listMailboxSummaries(viewer.id);
  return NextResponse.json({ mailboxes }, { headers: PRIVATE });
}
