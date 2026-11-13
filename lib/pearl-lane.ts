/**
 * Shared Pearl Auto lane heuristics and waiting labels.
 *
 * Used by the agent router, web/mobile waiting UI, and (via duplication lock
 * tests) the tool prefill gates. Pure: no I/O, no gateway calls.
 */

export type PearlLane = "voice" | "tools" | "analysis" | "think";

export const PEARL_LANE_LABELS: Record<PearlLane, string> = {
  voice: "Thinking",
  tools: "Checking your tools",
  analysis: "Reading the notes",
  think: "Thinking this through",
};

const TOOL_CUES =
  /\b(calendar|gmail|inbox|email|mail|weather|look\s*up|search|check\s+my|add\s+to|send\s+|schedule|remind|notification|browser|open\s+the\s+page|fetch)\b/i;

const ANALYSIS_CUES =
  /\b(summarize|analyse|analyze|diligence|contract|memo|briefing|financial|finance|legal|operations|ops\b|research\s+this|compare\s+these|review\s+this\s+(doc|document|pdf|deck|spreadsheet))\b/i;

const PROSE_CUES =
  /\b(draft|rewrite|revise|edit\s+this|think\s+(this|it)\s+through|help\s+me\s+write|write\s+(a|an|the|my)|tone|voice|essay|blog\s+post)\b/i;

const LONG_PASTE_CHARS = 1200;

/**
 * Classify the latest user text into a lane, or null when ambiguous.
 * A weak cue is not enough — leave null so Sol stays warm.
 */
export function classifyPearlHeuristic(text: string): PearlLane | null {
  const trimmed = text.trim();
  if (!trimmed) return "voice";

  const longPaste = trimmed.length >= LONG_PASTE_CHARS;
  const hasTool = TOOL_CUES.test(trimmed);
  const hasAnalysis = ANALYSIS_CUES.test(trimmed) || longPaste;
  const hasProse = PROSE_CUES.test(trimmed);

  // Prose ask wins over a bare long paste.
  if (hasProse && !hasTool) return "think";
  if (hasTool && !hasProse && !hasAnalysis) return "tools";
  if (hasAnalysis && !hasTool && !hasProse) return "analysis";
  if (hasTool && hasAnalysis && !hasProse) return "tools";

  // Short chat with no action or writing cue.
  if (!hasTool && !hasAnalysis && !hasProse && trimmed.length < 280) {
    return "voice";
  }

  return null;
}

/** Waiting-UI label for the outgoing text. Always returns a string. */
export function waitingLabelForText(text: string): string {
  const lane = classifyPearlHeuristic(text);
  if (lane === "tools") {
    if (/\b(calendar|schedule|remind)\b/i.test(text)) {
      return "Checking your calendar";
    }
    if (/\b(gmail|inbox|email|mail|send)\b/i.test(text)) {
      return "Checking your mail";
    }
    if (/\b(weather)\b/i.test(text)) return "Checking the weather";
    if (/\b(search|look\s*up|browser|fetch|open)\b/i.test(text)) {
      return "Looking that up";
    }
    return PEARL_LANE_LABELS.tools;
  }
  if (lane === "analysis") return PEARL_LANE_LABELS.analysis;
  if (lane === "think") return PEARL_LANE_LABELS.think;
  return PEARL_LANE_LABELS.voice;
}

/** Whether a lane should expose connection / web / browser tools. */
export function laneNeedsToolSurface(lane: PearlLane | null): boolean {
  // Ambiguous keeps specialist tools so a Decider upgrade is not empty-handed.
  return lane === null || lane === "tools";
}

/** Whether a lane should expose research / attachment tools. */
export function laneNeedsAnalysisSurface(lane: PearlLane | null): boolean {
  return lane === null || lane === "analysis";
}

/** Whether a lane should expose image / SVG generation. */
export function laneNeedsImageSurface(
  lane: PearlLane | null,
  turnText: string,
): boolean {
  if (/\b(image|illustration|logo|svg|icon|poster|graphic)\b/i.test(turnText)) {
    return true;
  }
  return lane === null;
}
