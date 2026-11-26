/**
 * Explicit mobile contract for every eve SessionStreamEvent type.
 *
 * Eve catalogs 31 types (28 facts + 3 progress). Mobile does not need a
 * custom UI branch for each — stability means every type is classified so a
 * new eve release fails CI until we assign a tier.
 */

/** Handling tier for a stream event on the mobile client. */
export type StreamEventTier =
  /** May update the live reply overlay / catch-up hold. */
  | "live"
  /** May update thinking / timeline / subagent / presence chrome. */
  | "chrome"
  /** Transcript via SessionStore projection only. */
  | "project"
  /** Never enters the live reply buffer (e.g. reasoning deltas). */
  | "ignore-overlay";

/**
 * Full eve catalog including `child.sent` (omitted from authoringEventTypes).
 * Keep in sync with node_modules/eve FACT_CATALOG + PROGRESS_CATALOG.
 */
export const EVE_STREAM_EVENT_TYPES = [
  // Progress
  "content.delta",
  "call.input",
  "call.progress",
  // Session / delivery / turn
  "session.started",
  "session.ended",
  "delivery.admitted",
  "delivery.consumed",
  "delivery.settled",
  "turn.started",
  "turn.paused",
  "turn.settled",
  // Model / content
  "model.requested",
  "model.started",
  "model.retried",
  "model.settled",
  "content.completed",
  // Call
  "call.requested",
  "call.started",
  "call.settled",
  // Task / child
  "task.started",
  "task.ended",
  "child.opened",
  "child.sent",
  // Interaction / response
  "interaction.opened",
  "interaction.settled",
  "response.submitted",
  "response.admitted",
  "response.settled",
  // Context / usage
  "context.started",
  "context.settled",
  "usage.recorded",
] as const;

export type EveStreamEventType = (typeof EVE_STREAM_EVENT_TYPES)[number];

const TIER_BY_TYPE: Readonly<Record<EveStreamEventType, StreamEventTier>> = {
  // Progress
  "content.delta": "live", // text only; non-text kinds → ignore-overlay via classify
  "call.input": "chrome",
  "call.progress": "chrome",
  // Session / delivery / turn
  "session.started": "project",
  "session.ended": "chrome",
  "delivery.admitted": "project",
  "delivery.consumed": "chrome", // also clears pending send
  "delivery.settled": "project",
  "turn.started": "project",
  "turn.paused": "project",
  "turn.settled": "chrome",
  // Model / content
  "model.requested": "project",
  "model.started": "project",
  "model.retried": "chrome",
  "model.settled": "project",
  "content.completed": "project",
  // Call
  "call.requested": "chrome",
  "call.started": "chrome",
  "call.settled": "chrome",
  // Task / child
  "task.started": "chrome",
  "task.ended": "chrome",
  "child.opened": "chrome",
  "child.sent": "project",
  // Interaction / response
  "interaction.opened": "chrome",
  "interaction.settled": "chrome",
  "response.submitted": "project",
  "response.admitted": "project",
  "response.settled": "project",
  // Context / usage
  "context.started": "chrome",
  "context.settled": "chrome",
  "usage.recorded": "project",
};

const KNOWN = new Set<string>(EVE_STREAM_EVENT_TYPES);

/** True when `type` is one of the 31 known eve stream event types. */
export function isKnownStreamEventType(type: unknown): type is EveStreamEventType {
  return typeof type === "string" && KNOWN.has(type);
}

/**
 * Classify a stream event for mobile handling.
 * Unknown types return `"unknown"` so callers / tests can fail closed.
 */
export function classifyStreamEvent(
  type: string,
  kind?: string,
): StreamEventTier | "unknown" {
  if (!isKnownStreamEventType(type)) return "unknown";
  // Non-text content.delta never enters the live overlay.
  if (type === "content.delta" && kind && kind !== "text") {
    return "ignore-overlay";
  }
  return TIER_BY_TYPE[type];
}

/**
 * Throws when `type` is not in the eve catalog.
 * Used by tests / debug to catch eve upgrades that add event types.
 */
export function assertKnownStreamEvent(type: string): asserts type is EveStreamEventType {
  if (!isKnownStreamEventType(type)) {
    throw new Error(
      `Unknown eve stream event type "${type}". Classify it in stream-event-contract.ts.`,
    );
  }
}

/** Progress types that must not flash live chrome during catch-up. */
export function isCatchUpChromeProgress(type: string): boolean {
  return type === "call.input" || type === "call.progress";
}

/**
 * Events that should clear the catch-up hold and live overlay.
 * Failed / cancelled turns and ended sessions leave nothing to pace.
 */
export function shouldClearCatchUpOnEvent(input: {
  readonly type: string;
  readonly outcome?: string;
}): boolean {
  if (input.type === "session.ended") return true;
  if (input.type !== "turn.settled") return false;
  return (
    input.outcome === "failed" ||
    input.outcome === "cancelled"
  );
}
