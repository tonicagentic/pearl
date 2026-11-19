// Shared clientContext markers for Agent vs Plan mode and the active
// project. Used by the composer (client) and by agent/lib/turn-context.ts
// (server / eve runtime). Keep this file free of eve imports so the web
// bundle can read the constants.

export const MODE_MARKER = "eveAgentMode";
export const PROJECT_ID_MARKER = "eveProjectId";
/** Lets onMessage load spoken live turns before the chat row has an eve session. */
export const CHAT_ID_MARKER = "eveChatId";
/**
 * Connected private eve agent for this turn. Absent or empty means Pearl.
 * Value is the connected_agent row id owned by the signed-in user.
 */
export const REMOTE_AGENT_ID_MARKER = "eveRemoteAgentId";
/**
 * User-defined custom agent for this turn. Value is the custom_agent row id.
 * Absent means a normal Pearl chat. Server still verifies ownership + chat link.
 */
export const CUSTOM_AGENT_ID_MARKER = "eveCustomAgentId";

export type AgentMode = "agent" | "plan";
