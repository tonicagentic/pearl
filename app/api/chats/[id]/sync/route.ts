import { NextResponse } from "next/server";
import {
  appendChatEventsAction,
  markChatPendingMessageAction,
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
    readonly append?: readonly { readonly event: unknown; readonly eventIndex: number }[];
    readonly pendingUserMessage?: string;
    readonly session?: unknown;
  };

  const { id: chatId } = await params;

  if (body.append !== undefined) {
    if (!Array.isArray(body.append) || body.append.some(
      (entry) => !Number.isSafeInteger(entry?.eventIndex) || entry.eventIndex < 0 ||
        typeof entry.event !== "object" || entry.event === null,
    )) {
      return NextResponse.json({ error: "Invalid event batch." }, { status: 400 });
    }
    await appendChatEventsAction({
      chatId,
      events: body.append as Parameters<typeof appendChatEventsAction>[0]["events"],
    });
    return NextResponse.json({ ok: true });
  }

  if (body.pendingUserMessage !== undefined) {
    if (typeof body.pendingUserMessage !== "string") {
      return NextResponse.json({ error: "Invalid pending message." }, { status: 400 });
    }
    await markChatPendingMessageAction({ chatId, message: body.pendingUserMessage });
    return NextResponse.json({ ok: true });
  }

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
