import { defineHook } from "eve/hooks";

import {
  appendChatEventForSession,
  countWaitingChatsForUser,
  isChatPresenceEventType,
} from "@/lib/db/queries";
import { listDevicePushTokensForUser } from "@/lib/db/push";
import { sendExpoPush } from "@/lib/push/expo";

/**
 * Mirror presence-relevant stream events into chat_event from the server so
 * Recents stays correct with zero mobile observers. Fan out a silent Expo
 * data push so the list can patch instantly. Observe-only: never throw.
 */
export default defineHook({
  events: {
    async "interaction.opened"(event, ctx) {
      await mirrorPresenceEvent(event, ctx);
    },
    async "interaction.settled"(event, ctx) {
      await mirrorPresenceEvent(event, ctx);
    },
    async "turn.started"(event, ctx) {
      await mirrorPresenceEvent(event, ctx);
    },
    async "turn.paused"(event, ctx) {
      await mirrorPresenceEvent(event, ctx);
    },
    async "turn.settled"(event, ctx) {
      await mirrorPresenceEvent(event, ctx);
    },
    async "delivery.consumed"(event, ctx) {
      await mirrorPresenceEvent(event, ctx);
    },
    async "session.ended"(event, ctx) {
      await mirrorPresenceEvent(event, ctx);
    },
  },
});

async function mirrorPresenceEvent(
  event: { readonly type: string; readonly meta?: unknown; readonly data?: unknown },
  ctx: {
    readonly session: { readonly id: string };
    readonly position: { readonly index: number; readonly line?: number };
  },
): Promise<void> {
  try {
    if (!isChatPresenceEventType(event.type)) {
      return;
    }

    // Stamp stream position so UI hydrate (eve ≥27) can accept these rows when
    // they later appear in a full client flush. Presence queries still work
    // without it; getChat filters non-positioned events out of initialEvents.
    const line = ctx.position.line ?? ctx.position.index;
    const priorMeta =
      event.meta && typeof event.meta === "object"
        ? (event.meta as Record<string, unknown>)
        : {};
    const stamped = {
      ...event,
      meta: {
        ...priorMeta,
        position: {
          index: ctx.position.index,
          line,
        },
      },
    };

    // position.index is the slot inside one stream line (0, 1, …), not a
    // chat_event key. The mobile client numbers rows 0…n. Writing the mirror
    // at index 0 upserts over the first transcript row and sorts a later
    // turn.paused ahead of every message, which makes eve drop the thread.
    const mirrored = await appendChatEventForSession({
      sessionId: ctx.session.id,
      event: stamped as Parameters<typeof appendChatEventForSession>[0]["event"],
      eventIndex: -(line * 32 + ctx.position.index + 1),
      bumpUpdatedAt: true,
    });
    if (!mirrored) {
      // First-turn race: chat row not linked yet. Client prepareSend creates it.
      return;
    }

    const tokens = await listDevicePushTokensForUser(mirrored.userId);
    if (tokens.length === 0) {
      return;
    }

    const waitingBadge = await countWaitingChatsForUser(mirrored.userId);

    // Silent data-only: updates Recents + absolute waiting badge without a
    // banner. Visible "needs you" banners still come from mobile-push.ts.
    await sendExpoPush(
      tokens.map((row) => ({
        to: row.token,
        data: {
          type: "presence",
          chatId: mirrored.chatId,
          presence: mirrored.presence,
          badge: String(waitingBadge),
        },
        sound: null,
        priority: "normal" as const,
        _contentAvailable: true,
        badge: waitingBadge,
      })),
    );
  } catch (error) {
    console.error("[chat-event-mirror]", event.type, error);
  }
}
