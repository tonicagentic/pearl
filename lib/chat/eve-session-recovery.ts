import {
  ClientError,
  SessionNotActiveError,
  type SessionStreamEvent,
} from "eve/client";

/**
 * True when the server will never accept more turns on this session id —
 * the client should start a new session and retry the user’s send.
 */
export function isEveSessionInactive(error: unknown): boolean {
  if (SessionNotActiveError.is(error)) {
    // session_not_ready is retryable; session_not_active is terminal.
    return !error.retryable;
  }

  if (ClientError.is(error)) {
    return (
      error.code === "session_stranded" || error.code === "session_expired"
    );
  }

  return false;
}

/**
 * True when two stream events are the same durable row. Prefer reference
 * equality; fall back to JSON so a DB round-trip clone still matches the live
 * store's prefix after resume (reference identity alone almost never holds).
 */
export function sessionEventsEqual(
  left: SessionStreamEvent,
  right: SessionStreamEvent,
): boolean {
  if (left === right) return true;
  if (left.type !== right.type) return false;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

/**
 * Preserve Pearl UI history when a SessionStore snapshot only contains the
 * new session’s events after `newSession()`. Never shrinks the archived prefix.
 */
export function mergeEventsForSnapshot(
  archived: readonly SessionStreamEvent[],
  live: readonly SessionStreamEvent[],
): readonly SessionStreamEvent[] {
  if (archived.length === 0) return live;
  if (live.length === 0) return archived;

  // If live still starts with the archived prefix (same session resume), prefer live.
  if (live.length >= archived.length) {
    let prefixMatch = true;
    for (let i = 0; i < archived.length; i += 1) {
      if (!sessionEventsEqual(live[i]!, archived[i]!)) {
        prefixMatch = false;
        break;
      }
    }
    if (prefixMatch) return live;
  }

  return [...archived, ...live];
}
