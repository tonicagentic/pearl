import { REMOTE_AGENT_ID_MARKER } from "@/lib/agent-mode-context";

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

/**
 * Read the connected-agent id from ephemeral clientContext. Empty / absent
 * means Pearl itself. Values are not trusted until ownership is checked.
 */
export function readRemoteAgentIdMarker(
  messages: readonly ScannedMessage[],
): string | null {
  const markerPattern = new RegExp(
    `"${REMOTE_AGENT_ID_MARKER}"\\s*:\\s*"([^"]*)"`,
  );
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
