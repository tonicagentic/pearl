// Shared clientContext markers for Agent vs Plan mode and the active
// project. Used by the composer (client) and by agent/lib/turn-context.ts
// (server / eve runtime). Keep this file free of eve imports so the web
// bundle can read the constants.

export const MODE_MARKER = "eveAgentMode";
export const PROJECT_ID_MARKER = "eveProjectId";

export type AgentMode = "agent" | "plan";
