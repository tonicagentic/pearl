/**
 * Follow a durable fx turn to completion, reconnecting when the session
 * stream drops mid-turn (common on Vercel when the worker yields near the
 * function deadline or the process is replaced). The turn keeps running via
 * queue wakes; only the viewer connection dies.
 *
 * @see https://vercel.com/docs/agent-harnesses/fx#reconnect-to-a-running-turn
 */

export type FxTurnEvent = { type: string; [key: string]: unknown };

export type FxTurnOutcome = {
  readonly events: readonly FxTurnEvent[];
  readonly result: {
    readonly stopReason: string;
    readonly error?: { readonly message?: string };
  };
};

type FxSessionStream = {
  stream(cursor?: number): ReadableStream<Uint8Array>;
};

type FxTurnHandle = {
  readonly messageId: string;
  readonly accepted: Promise<{ readonly messageId: string }>;
};

const STREAM_ENDED =
  /session stream ended before the turn did/i;

const MAX_RECONNECTS = 90;
const RECONNECT_MS_AFTER_DATA = 400;
const RECONNECT_MS_IDLE = 1_500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseLine(line: string): Record<string, unknown> | null {
  if (!line.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(line);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isOurTurnEvent(
  event: Record<string, unknown>,
  messageId: string,
): boolean {
  const id = event.messageId;
  return typeof id !== "string" || id === messageId;
}

function shouldCollect(event: Record<string, unknown>): boolean {
  const type = event.type;
  return (
    typeof type === "string" &&
    type !== "turn_start" &&
    type !== "turn_resume" &&
    type !== "turn_yield" &&
    type !== "turn_end" &&
    type !== "idle"
  );
}

async function readStreamUntilEndOrTurnEnd(options: {
  readonly session: FxSessionStream;
  readonly messageId: string;
  readonly fromCursor: number;
  readonly events: FxTurnEvent[];
}): Promise<
  | { readonly status: "ended"; readonly cursor: number; readonly sawData: boolean }
  | { readonly status: "turn_end"; readonly outcome: FxTurnOutcome }
> {
  const stream = options.session.stream(options.fromCursor);
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  let cursor = options.fromCursor;
  let sawData = false;

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        return { status: "ended", cursor, sawData };
      }
      sawData = true;
      buffered += decoder.decode(value, { stream: true });
      for (;;) {
        const newline = buffered.indexOf("\n");
        if (newline < 0) break;
        const line = buffered.slice(0, newline);
        buffered = buffered.slice(newline + 1);
        const event = parseLine(line);
        if (!event) continue;
        if (typeof event.cursor === "number" && Number.isFinite(event.cursor)) {
          cursor = event.cursor;
        }
        if (!isOurTurnEvent(event, options.messageId)) continue;
        if (shouldCollect(event)) {
          options.events.push(event as FxTurnEvent);
        }
        if (event.type === "turn_end") {
          const stopReason =
            typeof event.stopReason === "string" ? event.stopReason : "end_turn";
          const error = isRecord(event.error)
            ? {
                message:
                  typeof event.error.message === "string"
                    ? event.error.message
                    : undefined,
              }
            : undefined;
          return {
            status: "turn_end",
            outcome: {
              events: options.events,
              result: { stopReason, ...(error ? { error } : {}) },
            },
          };
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // already released
    }
  }
}

/** Await a prompted turn, reconnecting through session.stream on drop. */
export async function awaitDurableFxTurn(
  session: FxSessionStream,
  turn: FxTurnHandle,
): Promise<FxTurnOutcome> {
  const { messageId } = await turn.accepted;
  const events: FxTurnEvent[] = [];
  let cursor = 0;

  for (let attempt = 0; attempt <= MAX_RECONNECTS; attempt += 1) {
    const read = await readStreamUntilEndOrTurnEnd({
      session,
      messageId,
      fromCursor: cursor,
      events,
    });
    if (read.status === "turn_end") return read.outcome;
    cursor = read.cursor;
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        read.sawData ? RECONNECT_MS_AFTER_DATA : RECONNECT_MS_IDLE,
      ),
    );
  }

  throw new Error("the session stream ended before the turn did");
}

export function isFxStreamEndedError(error: unknown): boolean {
  return error instanceof Error && STREAM_ENDED.test(error.message);
}
