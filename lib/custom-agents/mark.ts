/** Canadian-style head silhouette for agent marks (Terrance/Phillip default). */
export const AGENT_MARK_SHAPES = [
  "oval",
  "diamond",
  "square",
  "trap",
] as const;

export type AgentMarkShape = (typeof AGENT_MARK_SHAPES)[number];

export const DEFAULT_AGENT_MARK_SHAPE: AgentMarkShape = "oval";

/** How the pearl talks — kinematics / rhythm only. */
export const AGENT_MARK_TALKS = ["hinge", "lift", "chatter"] as const;

export type AgentMarkTalk = (typeof AGENT_MARK_TALKS)[number];

export const DEFAULT_AGENT_MARK_TALK: AgentMarkTalk = "hinge";

/**
 * Where the mark animates:
 * - idle: continuous talk loop (thread identity only)
 * - burst: short open/close on press (mobile) or hover (web)
 * - off: always closed
 */
export type AgentMarkMotion = "idle" | "burst" | "off";

/**
 * Terrance/Phillip-style flesh tone — default “Canadian” pearl look.
 * Hex uppercase to match store normalization.
 */
export const TERRANCE_FLESH = "#F5C9A0";

/** Solid accent swatches for agent configuration. */
export const AGENT_MARK_ACCENTS = [
  TERRANCE_FLESH,
  "#2DD4BF",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#64748B",
] as const;

export const DEFAULT_AGENT_MARK_ACCENT = AGENT_MARK_ACCENTS[0];

export function isAgentMarkShape(value: unknown): value is AgentMarkShape {
  return (
    typeof value === "string" &&
    (AGENT_MARK_SHAPES as readonly string[]).includes(value)
  );
}

export function isAgentMarkTalk(value: unknown): value is AgentMarkTalk {
  return (
    typeof value === "string" &&
    (AGENT_MARK_TALKS as readonly string[]).includes(value)
  );
}
