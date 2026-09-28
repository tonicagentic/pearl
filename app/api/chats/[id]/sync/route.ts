import { NextResponse } from "next/server";
import {
  saveChatSessionStateAction,
  saveChatSnapshotAction,
} from "@/app/actions/chat";

/**
 * Mobile chat persistence: the eve store's session cursor and event stream
 * are saved through the same server actions the web uses, so a chat opened on
 * either surface resumes from the same durable state. A full event-array
 * snapshot is idempotent (upsert by index, extras trimmed).
 */
export async function POST(
  request: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
) {
  const body = (await request.json().catch(() => ({}))) as {
    readonly events?: readonly unknown[];
    readonly session?: unknown;
  };

  const { id: chatId } = await params;

  if (body.events !== undefined) {
    if (!Array.isArray(body.events)) {
      return NextResponse.json({ error: "events must be an array." }, { status: 400 });
    }

    await saveChatSnapshotAction({
      chatId,
      events: body.events as Parameters<typeof saveChatSnapshotAction>[0]["events"],
      session: (body.session ?? undefined) as Parameters<
        typeof saveChatSnapshotAction
      >[0]["session"],
    });

    return NextResponse.json({ ok: true });
  }

  if (body.session !== undefined && body.session !== null) {
    await saveChatSessionStateAction({
      chatId,
      session: body.session as Parameters<typeof saveChatSessionStateAction>[0]["session"],
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Nothing to sync." }, { status: 400 });
}
