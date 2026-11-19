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
 * Terrance/Phillip-style flesh tone — default for custom agents.
 * Hex uppercase to match store normalization.
 */
export const TERRANCE_FLESH = "#F5C9A0";

/**
 * Built-in Pearl mark — soft natural pearl (warm off-white).
 * Distinct from Terrance flesh used by custom agents.
 */
export const PEARL_IDENTITY_ACCENT = "#F2E8D8";

/** Tall Canadian head for custom-agent ovals. */
export const DEFAULT_AGENT_MARK_HEIGHT_RATIO = 1.28;

/** Circular silhouette for the built-in Pearl character (no pointed poles). */
export const PEARL_MARK_HEIGHT_RATIO = 1;

/** Solid accent swatches for agent configuration. */
export const AGENT_MARK_ACCENTS = [
  TERRANCE_FLESH,
  PEARL_IDENTITY_ACCENT,
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

/** Beady eyes that stay readable on light or dark accents. */
export function markEyeColor(accent: string): string {
  const hex = accent.trim().replace(/^#/, "");
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return "#111111";
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  // Relative luminance (sRGB-ish).
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma < 0.45 ? "#F5F5F5" : "#111111";
}

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
