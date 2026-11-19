import type {
  AgentMarkBrows,
  AgentMarkGaze,
  AgentMarkShape,
  AgentMarkTalk,
} from "@/lib/custom-agents/mark";

export type {
  AgentMarkBrows,
  AgentMarkGaze,
  AgentMarkShape,
  AgentMarkTalk,
} from "@/lib/custom-agents/mark";

/** Public summary of a user-defined Pearl agent (no secrets). */
export type CustomAgentSummary = {
  readonly id: string;
  readonly name: string;
  readonly instructions: string;
  readonly accent: string;
  /** Canadian-style head silhouette for the agent mark. */
  readonly markShape: AgentMarkShape;
  /** Talk kinematics for the agent mark. */
  readonly markTalk: AgentMarkTalk;
  /** Optional eyebrows on the agent mark. */
  readonly markBrows: AgentMarkBrows;
  /** Idle eye gaze on the agent mark. */
  readonly markGaze: AgentMarkGaze;
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
  readonly markShape: AgentMarkShape;
  readonly markTalk: AgentMarkTalk;
  readonly markBrows: AgentMarkBrows;
  readonly markGaze: AgentMarkGaze;
  readonly instructions: string;
};
