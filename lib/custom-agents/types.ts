/** Public summary of a user-defined Pearl agent (no secrets). */
export type CustomAgentSummary = {
  readonly id: string;
  readonly name: string;
  readonly instructions: string;
  readonly accent: string;
  /** The one durable chat for this agent. */
  readonly chatId: string;
  /** Current title of the agent's durable chat (preview / activity). */
  readonly chatTitle: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/** Identity payload attached to an open chat when it belongs to a custom agent. */
export type CustomAgentRef = {
  readonly id: string;
  readonly name: string;
  readonly accent: string;
  readonly instructions: string;
};
