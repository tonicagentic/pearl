import { defineChannel, POST } from "eve/channels";

import {
  CHAT_ID_MARKER,
  CUSTOM_AGENT_ID_MARKER,
} from "@/lib/agent-mode-context";
import { saveChatSessionState } from "@/lib/db/queries";

type RoutineTarget = {
  readonly chatId: string;
  readonly agentId: string;
  readonly userId: string;
};

/**
 * Proactive target for custom-agent routine dispatchers. Address is the
 * durable chat id so schedule runs continue one conversation per agent.
 * Session ids are linked onto chat.eveSession so the UI can resume them.
 */
export default defineChannel({
  // Required by defineChannel; schedules use receive(), not this route.
  routes: [
    POST("/internal/custom-agent-routine/health", async () =>
      Response.json({ ok: true }),
    ),
  ],
  async receive({ message, target, ...send }, { from }) {
    const typed = target as RoutineTarget;
    const chatId = String(typed.chatId ?? "").trim();
    const agentId = String(typed.agentId ?? "").trim();
    const userId = String(typed.userId ?? "").trim();
    if (!chatId || !agentId || !userId) {
      throw new Error(
        "custom-agent-routine target needs chatId, agentId, userId.",
      );
    }

    const clientContext = JSON.stringify({
      [CHAT_ID_MARKER]: chatId,
      [CUSTOM_AGENT_ID_MARKER]: agentId,
    });

    const delivery = await from(`chat:${chatId}`).send(message, {
      ...send,
      context: [
        ...(send.context ?? []),
        `Client context: ${clientContext}`,
      ],
    });

    if (delivery.sessionId) {
      await saveChatSessionState({
        chatId,
        userId,
        session: {
          sessionId: delivery.sessionId,
          streamIndex: 0,
        },
      });
    }

    return delivery;
  },
});
