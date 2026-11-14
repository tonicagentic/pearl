import { getConnectorMetadata, startAuthorization } from "@vercel/connect";
import { NextResponse } from "next/server";

import { connectionConfiguration } from "@/lib/connections/catalog";
import { connectionTokenParams } from "@/lib/connections/oauth-scopes";
import {
  createMailAccount,
  ensurePrimaryMailAccount,
  getMailAccountForUser,
  listMailAccounts,
} from "@/lib/mail/accounts";
import { connectionSubjectForMailbox } from "@/lib/mail/subjects";
import { RateLimitError, enforceRateLimit } from "@/lib/rate-limit";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

const PRIVATE = { "Cache-Control": "private, no-store" };

/**
 * Start Gmail OAuth for a mailbox.
 *
 * - No mailboxId + no rows → create primary (legacy subject) and authorize.
 * - No mailboxId + existing rows → create a new mailbox with a distinct
 *   Connect subject and `prompt: select_account`.
 * - mailboxId → re-authorize that mailbox (e.g. to pick up gmail.modify).
 */
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
    deviceCode?: unknown;
  } | null;

  const config = connectionConfiguration("gmail");
  if (!config.connector) {
    return NextResponse.json(
      { error: "Gmail is not available." },
      { status: 409, headers: PRIVATE },
    );
  }

  try {
    await enforceRateLimit({
      key: viewer.id,
      prefix: "mailboxes-authorize",
      limit: 12,
      windowSeconds: 300,
    });
    await getConnectorMetadata(config.connector);

    let mailboxId =
      typeof body?.mailboxId === "string" && body.mailboxId.trim()
        ? body.mailboxId.trim()
        : null;
    let selectAccount = false;

    if (mailboxId) {
      const existing = await getMailAccountForUser(viewer.id, mailboxId);
      if (!existing) {
        return NextResponse.json(
          { error: "Unknown mailbox." },
          { status: 404, headers: PRIVATE },
        );
      }
      selectAccount = true;
    } else {
      const rows = await listMailAccounts(viewer.id);
      if (rows.length === 0) {
        const primary = await ensurePrimaryMailAccount(viewer.id);
        mailboxId = primary.id;
        selectAccount = true;
      } else {
        const created = await createMailAccount(viewer.id);
        mailboxId = created.id;
        selectAccount = true;
      }
    }

    const mailbox = await getMailAccountForUser(viewer.id, mailboxId);
    if (!mailbox) {
      return NextResponse.json(
        { error: "Could not prepare mailbox." },
        { status: 500, headers: PRIVATE },
      );
    }

    const challenge = await startAuthorization(
      config.connector,
      {
        subject: connectionSubjectForMailbox(viewer.id, mailbox.subjectId),
        ...connectionTokenParams("gmail"),
      },
      {
        callbackUrl: `${origin}/settings/connections/return`,
        deviceCode: body?.deviceCode === true,
        ...(selectAccount ? { prompt: "select_account" } : {}),
      },
    );

    const url = new URL(challenge.url);
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      throw new Error("Connect returned an unsafe authorization URL.");
    }

    return NextResponse.json(
      {
        mailboxId: mailbox.id,
        url: url.href,
        ...(challenge.deviceCode ? { userCode: challenge.deviceCode } : {}),
      },
      { headers: PRIVATE },
    );
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
      {
        error:
          "Could not start authorization. Check connector setup and try again.",
      },
      { status: 502, headers: PRIVATE },
    );
  }
}
