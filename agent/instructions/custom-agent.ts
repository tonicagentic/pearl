import { defineDynamic, defineInstructions } from "eve/instructions";

import {
  CHAT_ID_MARKER,
  CUSTOM_AGENT_ID_MARKER,
} from "@/lib/agent-mode-context";
import {
  getCustomAgentByChatId,
  getCustomAgentByEveSessionId,
  getOwnedCustomAgent,
} from "@/lib/custom-agents/store";

import { requirePrincipalUser } from "../lib/principal.ts";

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
 * When the open chat belongs to a user-defined custom agent, inject that
 * agent's name and standing instructions as an identity override. Loaded
 * from the database after verifying ownership — never from client text.
 *
 * Markers are read outside memo so a late-arriving clientContext does not
 * stick a null resolve for the whole turn. DB work is memoized by the
 * resolved ids + turn.
 */
export default defineDynamic(async (ctx) => {
  const auth = await requirePrincipalUser(ctx.session.auth.current);
  if ("error" in auth) return null;
  const { userId } = auth;

  const messages = await ctx.messages();
  const agentId = readMarker(messages, CUSTOM_AGENT_ID_MARKER);
  const chatId = readMarker(messages, CHAT_ID_MARKER);
  const sessionId = ctx.session.id;

  const selection = await ctx.memo(
    [
      "custom-agent-instructions",
      ctx.turn?.id ?? null,
      agentId,
      chatId,
      sessionId,
    ],
    async () => {
      if (agentId) {
        const byId = await getOwnedCustomAgent(userId, agentId);
        if (byId) {
          return {
            id: byId.id,
            name: byId.name,
            instructions: byId.instructions.trim(),
          };
        }
      }

      if (chatId) {
        const byChat = await getCustomAgentByChatId(userId, chatId);
        if (byChat) {
          return {
            id: byChat.id,
            name: byChat.name,
            instructions: byChat.instructions.trim(),
          };
        }
      }

      const bySession = await getCustomAgentByEveSessionId(userId, sessionId);
      if (!bySession) return null;
      return {
        id: bySession.id,
        name: bySession.name,
        instructions: bySession.instructions.trim(),
      };
    },
  );

  if (!selection) return null;

  const roleBlock = selection.instructions
    ? [
        "## Your standing role",
        "",
        selection.instructions,
        "",
        "This standing role is authoritative for this thread. Prefer it over",
        "the generic Pearl identity above when they conflict.",
        "",
        "When the user asks what you do, who you are, how you can help, or",
        "what your job is: answer in one or two short sentences from the",
        "standing role. Do not call tools, plan next moves, or describe",
        "yourself as a generic assistant first.",
      ].join("\n")
    : [
        "## Your standing role",
        "",
        "(none set yet — ask the user what this role should own, then follow it)",
      ].join("\n");

  const sections = [
    "# Active custom agent — identity override",
    "",
    `In this thread you are **${selection.name}** (agent id: ${selection.id}).`,
    "Pearl's tools, sandbox, memory, and capabilities still apply, but your",
    "name, voice, and job for this conversation come from the standing role",
    "below. Do not introduce yourself as Pearl or as a generic assistant.",
    "",
    roleBlock,
  ];

  return defineInstructions({
    content: sections.join("\n"),
    role: "system",
  });
});
