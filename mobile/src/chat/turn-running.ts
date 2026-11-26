import type { EveMessage } from "eve/client";
import type { SessionView } from "eve/events";
import { activeTurn } from "eve/events";

type StoreStatus = "idle" | "busy" | "resuming";

function toolIsLive(state: string): boolean {
  return state === "streaming" || state === "running";
}

/**
 * Message-level paint fallback when view is missing or lags optimistic UI.
 * Prefer {@link deriveTurnRunning} with `view` for Stop / cancel affordances.
 */
export function deriveTurnRunningFromMessages(input: {
  readonly status: StoreStatus;
  readonly messages: readonly EveMessage[];
}): boolean {
  const last = input.messages[input.messages.length - 1];
  if (last?.role === "assistant" && last.metadata?.status === "streaming") {
    return true;
  }
  if (
    last?.role === "assistant" &&
    last.parts.some(
      (part) => part.type === "tool" && toolIsLive(String(part.state)),
    )
  ) {
    return true;
  }
  if (input.status !== "busy") return false;
  if (last?.role === "assistant" && last.metadata?.status === "complete") {
    return false;
  }
  return true;
}

/**
 * Whether the composer should show Stop / treat the turn as generating.
 *
 * Canonical signal is `activeTurn(view)` (eve docs). Message heuristics fill
 * optimistic gaps before the view catches the streaming assistant row.
 */
export function deriveTurnRunning(input: {
  readonly status: StoreStatus;
  readonly messages: readonly EveMessage[];
  readonly view?: SessionView;
}): boolean {
  if (input.view !== undefined && activeTurn(input.view) !== undefined) {
    return true;
  }
  return deriveTurnRunningFromMessages(input);
}

/**
 * Store reports `busy` but no open turn and the transcript looks settled.
 * Do not call cancel() to "clear" this — that reopens the stream.
 */
export function isZombieBusy(input: {
  readonly status: StoreStatus;
  readonly messages: readonly EveMessage[];
  readonly view?: SessionView;
}): boolean {
  if (input.view !== undefined && activeTurn(input.view) !== undefined) {
    return false;
  }
  return input.status === "busy" && !deriveTurnRunningFromMessages(input);
}
