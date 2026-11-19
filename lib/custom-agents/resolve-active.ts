import {
  CHAT_ID_MARKER,
  CUSTOM_AGENT_ID_MARKER,
} from "@/lib/agent-mode-context";
import {
  getCustomAgentByChatId,
  getCustomAgentByEveSessionId,
  getOwnedCustomAgent,
} from "@/lib/custom-agents/store";
import type { CustomAgent } from "@/lib/db/schema";

interface ScannedMessage {
  readonly role: string;
  readonly content: unknown;
  readonly kind?: unknown;
}

function messageText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
  const parts: string[] = [];
  for (const part of content) {
    if (typeof part === "string") {
      parts.push(part);
      continue;
    }
    if (
      part &&
      typeof part === "object" &&
      "type" in part &&
      part.type === "text" &&
      "text" in part &&
      typeof part.text === "string"
    ) {
      parts.push(part.text);
    }
  }
  return parts.length > 0 ? parts.join("") : null;
}

function isClientContextMessage(message: ScannedMessage): boolean {
  if (message.role !== "user") return false;
  if (message.kind === "context.instruction") return true;
  if (message.kind !== undefined) return false;
  const text = messageText(message.content);
  return text?.startsWith("Client context:") === true;
}

function readMarker(
  messages: readonly ScannedMessage[],
  marker: string,
): string | null {
  const markerPattern = new RegExp(`"${marker}"\\s*:\\s*"([^"]*)"`);
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (!isClientContextMessage(message)) continue;
    const text = messageText(message.content);
    if (!text) continue;
    const match = text.match(markerPattern);
    if (!match) continue;
    const value = match[1]?.trim() ?? "";
    return value || null;
  }
  return null;
}

/**
 * Resolve the active custom agent for this turn from client markers or the
 * eve session → chat link. Shared by instructions, skills, and tool gates.
 */
export async function resolveActiveCustomAgent(input: {
  readonly userId: string;
  readonly messages: readonly ScannedMessage[];
  readonly sessionId: string;
}): Promise<CustomAgent | null> {
  const agentId = readMarker(input.messages, CUSTOM_AGENT_ID_MARKER);
  const chatId = readMarker(input.messages, CHAT_ID_MARKER);

  if (agentId) {
    const byId = await getOwnedCustomAgent(input.userId, agentId);
    if (byId) return byId;
  }

  if (chatId) {
    const byChat = await getCustomAgentByChatId(input.userId, chatId);
    if (byChat) return byChat;
  }

  return getCustomAgentByEveSessionId(input.userId, input.sessionId);
}

export { readMarker, isClientContextMessage, messageText };
export type { ScannedMessage };
