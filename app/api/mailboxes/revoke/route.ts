import {
  deleteTokenCacheEntry,
  revokeToken,
} from "@vercel/connect";
import { NextResponse } from "next/server";

import { connectionConfiguration } from "@/lib/connections/catalog";
import { connectionTokenParams } from "@/lib/connections/oauth-scopes";
import {
  deleteMailAccount,
  getMailAccountForUser,
  listMailboxSummaries,
} from "@/lib/mail/accounts";
import { connectionSubjectForMailbox } from "@/lib/mail/subjects";
import { RateLimitError, enforceRateLimit } from "@/lib/rate-limit";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

const PRIVATE = { "Cache-Control": "private, no-store" };

/** Revoke one mailbox's Connect grant and delete its row. */
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

  const body = (await request.json().catch(() => null)) as {
    mailboxId?: unknown;
  } | null;
  if (typeof body?.mailboxId !== "string" || !body.mailboxId.trim()) {
    return NextResponse.json(
      { error: "mailboxId is required." },
      { status: 400, headers: PRIVATE },
    );
  }

  const mailbox = await getMailAccountForUser(viewer.id, body.mailboxId.trim());
  if (!mailbox) {
    return NextResponse.json(
      { error: "Unknown mailbox." },
      { status: 404, headers: PRIVATE },
    );
  }

  const config = connectionConfiguration("gmail");
  if (!config.connector) {
    return NextResponse.json(
      { error: "Gmail is not available." },
      { status: 409, headers: PRIVATE },
    );
  }

  const subject = connectionSubjectForMailbox(viewer.id, mailbox.subjectId);

  try {
    await enforceRateLimit({
      key: viewer.id,
      prefix: "mailboxes-revoke",
      limit: 12,
      windowSeconds: 300,
    });
    const tokenParams = {
      subject,
      ...connectionTokenParams("gmail"),
    };
    try {
      await revokeToken(config.connector, { subject });
    } catch {
      // Grant may already be gone; still drop the row.
    }
    deleteTokenCacheEntry(config.connector, tokenParams);
    await deleteMailAccount(viewer.id, mailbox.id);
    const mailboxes = await listMailboxSummaries(viewer.id);
    return NextResponse.json({ mailboxes }, { headers: PRIVATE });
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
      { error: "Could not disconnect mailbox." },
      { status: 502, headers: PRIVATE },
    );
  }
}
