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
  event: { readonly type: string },
  ctx: {
    readonly session: { readonly id: string };
    readonly position: { readonly index: number };
  },
): Promise<void> {
  try {
    if (!isChatPresenceEventType(event.type)) {
      return;
    }

    const mirrored = await appendChatEventForSession({
      sessionId: ctx.session.id,
      event: event as Parameters<typeof appendChatEventForSession>[0]["event"],
      eventIndex: ctx.position.index,
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
