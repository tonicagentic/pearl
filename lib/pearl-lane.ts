/**
 * Shared Pearl Auto lane heuristics and waiting labels.
 *
 * Used by the agent router, web/mobile waiting UI, and (via duplication lock
 * tests) the tool prefill gates. Pure: no I/O, no gateway calls.
 */

export type PearlLane = "voice" | "tools" | "analysis" | "think";

export const PEARL_LANE_LABELS: Record<PearlLane, string> = {
  voice: "Planning next moves",
  tools: "Checking your tools",
  analysis: "Reading the notes",
  think: "Thinking this through",
};

// Avoid bare "email"/"mail" — "companies to email" is a prospecting ask, not
// a mailbox tool ask. Prefer gmail/inbox or "my email" / "send an email".
const TOOL_CUES =
  /\b(calendar|gmail|inbox|my\s+e-?mails?|send\s+(?:an?\s+)?e-?mail|weather|look\s*up|search|check\s+my|add\s+to|send\s+|schedule|remind|notification|browser|open\s+the\s+page|fetch)\b/i;

const ANALYSIS_CUES =
  /\b(summarize|analyse|analyze|diligence|contract|memo|briefing|financial|finance|legal|operations|ops\b|research\s+this|compare\s+these|review\s+this\s+(doc|document|pdf|deck|spreadsheet)|lead\s+list|lead\s+gen|prospect(?:ing|s)?|ideal\s+customer|\bICP\b|market\s+size|competitive\s+landscape|pricing\s+landscape|sales\s+prospecting|who\s+else\s+has|kinds\s+of\s+customers|icp_fit|outbound\s+list|fit\s+(?:over|matters)|targeted\s+(?:company\s+)?list|company\s+list|share(?:s|d)?\s+(?:that\s+)?pain|unplanned\s+compressor|customer\s+kinds|workspace\s+file)\b/i;

/** Research / GTM asks that must keep the Exa analysis surface even when a
 *  weak tool or prose cue also matches (e.g. "write the offer to a file",
 *  "not a list of companies to email"). */
const STRONG_ANALYSIS_CUES =
  /\b(lead\s+list|lead\s+gen|prospect(?:ing|s)?|ideal\s+customer|\bICP\b|market\s+size|competitive\s+landscape|pricing\s+landscape|sales\s+prospecting|who\s+else\s+has|kinds\s+of\s+customers|icp_fit|outbound\s+list|fit\s+(?:over|matters)|targeted\s+(?:company\s+)?list|company\s+list|share(?:s|d)?\s+(?:that\s+)?pain|unplanned\s+compressor|customer\s+kinds|diligence|summarize|analyse|analyze)\b/i;

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
  const strongAnalysis = STRONG_ANALYSIS_CUES.test(trimmed);

  // Strong research / GTM cues need the Exa analysis surface. Prefer them over
  // prose ("Write the offer to a workspace file") and over tool false-positives.
  if (strongAnalysis) return "analysis";

  // Prose ask wins over a bare long paste (but not over strong analysis above).
  if (hasProse && !hasTool && !hasAnalysis) return "think";
  if (hasProse && !hasTool && hasAnalysis) return "analysis";
  if (hasTool && !hasProse && !hasAnalysis) return "tools";
  if (hasAnalysis && !hasTool && !hasProse) return "analysis";
  // Mixed tool + analysis without strong research phrasing → tools (gmail + glance).
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
  if (
    /\b(image|illustration|logo|svg|icon|poster|graphic|photo|photograph|picture|drawing)\b/i.test(
      turnText,
    )
  ) {
    return true;
  }
  return lane === null;
}

/**
 * Cap on stored quick-path turns (user + assistant) before opening an eve
 * session so memory and compaction exist for longer threads.
 */
export const QUICK_PATH_MAX_TURNS = 6;

export type QuickPathEligibility = {
  readonly text: string;
  readonly hasEveSession: boolean;
  readonly hasAttachments: boolean;
  readonly hasCustomAgent: boolean;
  readonly hasRemoteAgent: boolean;
  readonly hasProject: boolean;
  readonly hasPinnedModel: boolean;
  /** Already-stored quick turns on the chat (user + assistant). */
  readonly quickTurnCount: number;
};

/**
 * Whether this send can use the session-free quick path.
 * Ambiguous / tools / analysis / think heuristics go straight to eve.
 */
export function canUseQuickPath(input: QuickPathEligibility): boolean {
  if (input.hasEveSession) return false;
  if (input.hasAttachments) return false;
  if (input.hasCustomAgent) return false;
  if (input.hasRemoteAgent) return false;
  if (input.hasProject) return false;
  if (input.hasPinnedModel) return false;
  if (input.quickTurnCount >= QUICK_PATH_MAX_TURNS) return false;
  const trimmed = input.text.trim();
  if (!trimmed) return false;
  return classifyPearlHeuristic(trimmed) === "voice";
}
