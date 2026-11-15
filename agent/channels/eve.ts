import { eveChannel, defaultEveAuth } from "eve/channels/eve";
import { localDev, vercelOidc } from "eve/channels/auth";
import { CHAT_ID_MARKER } from "@/lib/agent-mode-context";
import { spokenTurnsAsHistory } from "@/lib/chat/spoken-turns";
import { betterAuthEveAuth, passwordEveAuth } from "@/lib/eve-auth";
import {
  resolveChatIdForSpokenTurns,
  takeSpokenTurnsForUser,
} from "@/lib/db/queries";

function chatIdFromClientContext(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = (value as Record<string, unknown>)[CHAT_ID_MARKER];
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export default eveChannel({
  auth: [betterAuthEveAuth, passwordEveAuth, vercelOidc(), localDev()],
  // Screenshots, images, PDFs, and text files for the thinking-partner flows.
  uploadPolicy: {
    allowedMediaTypes: ["image/*", "text/*", "application/pdf"],
    maxBytes: 10 * 1024 * 1024,
  },
  async onMessage(ctx) {
    const auth = defaultEveAuth(ctx);
    if (!auth || auth.principalType !== "user") {
      return { auth };
    }

    // Spoken-turn import must never fail the user's send. A DB/driver error
    // here previously surfaced as a false "delivery not confirmed" on mobile.
    try {
      const chatId = await resolveChatIdForSpokenTurns({
        chatId: chatIdFromClientContext(ctx.eve.clientContext),
        sessionId: ctx.eve.sessionId,
        userId: auth.principalId,
      });
      if (!chatId) {
        return { auth };
      }

      const turns = await takeSpokenTurnsForUser({
        chatId,
        userId: auth.principalId,
      });
      if (turns.length === 0) {
        return { auth };
      }

      return {
        auth,
        history: spokenTurnsAsHistory(turns),
      };
    } catch (error) {
      console.error("[eve.channel] spoken-turn import failed; continuing send", {
        sessionId: ctx.eve.sessionId,
        error: error instanceof Error ? error.message : error,
      });
      return { auth };
    }
  },
});
