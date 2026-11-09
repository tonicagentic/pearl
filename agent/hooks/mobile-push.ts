import { defineHook } from "eve/hooks";

import { getChatLinkByEveSessionId } from "@/lib/db/queries";
import {
  claimPushDelivery,
  hasPushDelivery,
  listDevicePushTokensForUser,
  type PushDeliveryKind,
} from "@/lib/db/push";
import { sendExpoPush } from "@/lib/push/expo";

function truncate(text: string, max: number): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function turnIdFromInteractionSubject(subject: {
  readonly turnId?: string;
  readonly callId?: string;
  readonly taskId?: string;
  readonly responseId?: string;
}): string | null {
  return typeof subject.turnId === "string" && subject.turnId
    ? subject.turnId
    : null;
}

async function deliverPush(input: {
  readonly sessionId: string;
  readonly turnId: string;
  readonly kind: PushDeliveryKind;
  readonly userId: string;
  readonly chatId: string;
  readonly title: string;
  readonly body: string;
}): Promise<void> {
  if (input.kind === "replied") {
    // A park already notified this turn; the later settle is silent.
    if (
      await hasPushDelivery({
        sessionId: input.sessionId,
        turnId: input.turnId,
        kind: "needs_you",
      })
    ) {
      return;
    }
  }

  const claimed = await claimPushDelivery({
    sessionId: input.sessionId,
    turnId: input.turnId,
    kind: input.kind,
  });
  if (!claimed) {
    return;
  }

  const tokens = await listDevicePushTokensForUser(input.userId);
  if (tokens.length === 0) {
    return;
  }

  await sendExpoPush(
    tokens.map((row) => ({
      to: row.token,
      title: input.title,
      body: input.body,
      sound: "default" as const,
      data: { chatId: input.chatId },
    })),
  );
}

async function resolveOwnedChat(sessionId: string, principalId: string | null) {
  if (!principalId) {
    return null;
  }

  const chat = await getChatLinkByEveSessionId(sessionId);
  if (!chat || chat.userId !== principalId) {
    return null;
  }

  return chat;
}

/**
 * Push a banner when a chat turn reaches a boundary the phone user should
 * see while the app is closed or on another session. Never throws: a hook
 * failure would fail the turn.
 */
export default defineHook({
  events: {
    async "interaction.opened"(event, ctx) {
      try {
        const kind = event.data.request.kind;
        if (kind === "sign-in") {
          // OAuth challenges keep their own stream; skip device push.
          return;
        }

        const turnId =
          event.scope?.turnId ??
          turnIdFromInteractionSubject(event.data.subject);
        if (!turnId) {
          return;
        }

        const principalId =
          ctx.session.auth.current?.principalId ??
          ctx.session.auth.initiator?.principalId ??
          null;
        const chat = await resolveOwnedChat(ctx.session.id, principalId);
        if (!chat) {
          return;
        }

        const prompt = event.data.request.prompt?.trim();
        await deliverPush({
          sessionId: ctx.session.id,
          turnId,
          kind: "needs_you",
          userId: chat.userId,
          chatId: chat.id,
          title: "Pearl needs you",
          body: truncate(
            prompt || event.data.request.title || chat.title || "Respond to continue.",
            140,
          ),
        });
      } catch {
        // Observe-only: never fail the turn for a push delivery error.
      }
    },

    async "turn.settled"(event, ctx) {
      try {
        const outcome = event.data.outcome;
        if (outcome === "cancelled") {
          return;
        }

        const turnId = event.data.turnId;
        const principalId =
          ctx.session.auth.current?.principalId ??
          ctx.session.auth.initiator?.principalId ??
          null;
        const chat = await resolveOwnedChat(ctx.session.id, principalId);
        if (!chat) {
          return;
        }

        if (outcome === "failed") {
          await deliverPush({
            sessionId: ctx.session.id,
            turnId,
            kind: "failed",
            userId: chat.userId,
            chatId: chat.id,
            title: chat.title || "Pearl",
            body: "Pearl couldn't finish.",
          });
          return;
        }

        await deliverPush({
          sessionId: ctx.session.id,
          turnId,
          kind: "replied",
          userId: chat.userId,
          chatId: chat.id,
          title: chat.title || "Pearl",
          body: "Pearl replied.",
        });
      } catch {
        // Observe-only: never fail the turn for a push delivery error.
      }
    },
  },
});
