import type { ThreadMessageLike } from "@assistant-ui/react-native";

/** Calm base typewriter pace while the assistant part is still streaming. */
export const LIVE_CHARS_PER_SEC = 95;
/** Cap per animation frame so a hitch cannot dump a paragraph. */
export const LIVE_MAX_PER_FRAME = 14;
/** Backlog (code units) at which live pace reaches its soft boost ceiling. */
export const LIVE_LAG_SOFT_CAP = 80;
/** Peak live rate multiplier when the buffer is deep (still far from a dump). */
export const LIVE_LAG_BOOST = 1.5;
/** After the turn completes, ease the buffered tail out within this window. */
export const CATCH_UP_WINDOW_MS = 700;

export type RevealMode =
  | { mode: "live"; charsPerSec?: number; maxPerFrame?: number; carry?: number }
  | { mode: "catchUp"; remainingMs: number; windowMs?: number; carry?: number };

export type RevealStep = {
  end: number;
  carry: number;
};

function easeOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}

function advanceCodePoints(text: string, from: number, count: number): number {
  let end = from;
  for (let i = 0; i < count && end < text.length; i++) {
    end += (text.codePointAt(end) ?? 0) > 0xffff ? 2 : 1;
  }
  return end;
}

// Live streaming uses a soft rate with fractional carry so cadence stays even
// instead of jumping a whole character every frame. Pace eases up with lag so
// large deltas type out, then catch-up eases the finished tail closed.
export function nextRevealLength(
  text: string,
  from: number,
  elapsedMs: number,
  options: RevealMode = { mode: "live" },
): RevealStep {
  if (from >= text.length) return { end: text.length, carry: 0 };
  const remaining = text.length - from;
  const carry = Math.max(0, options.carry ?? 0);
  const dt = Math.max(0, elapsedMs);

  if (options.mode === "catchUp") {
    const windowMs = options.windowMs ?? CATCH_UP_WINDOW_MS;
    const { remainingMs } = options;
    if (dt >= remainingMs || remainingMs <= 0 || remaining > 32_768) {
      return { end: text.length, carry: 0 };
    }
    const elapsed = Math.max(0, windowMs - remainingMs);
    const prevT = Math.max(0, (elapsed - dt) / windowMs);
    const nextT = Math.min(1, elapsed / windowMs);
    const span = easeOutCubic(nextT) - easeOutCubic(prevT);
    const denom = Math.max(1e-6, 1 - easeOutCubic(prevT));
    const uncapped = carry + remaining * (span / denom);
    const budget = Math.max(1, Math.floor(uncapped));
    const end = advanceCodePoints(text, from, budget);
    return { end, carry: end >= text.length ? 0 : uncapped - budget };
  }

  const charsPerSec = options.charsPerSec ?? LIVE_CHARS_PER_SEC;
  const maxPerFrame = options.maxPerFrame ?? LIVE_MAX_PER_FRAME;
  const lag = easeOutCubic(Math.min(1, remaining / LIVE_LAG_SOFT_CAP));
  const rate = charsPerSec * (1 + LIVE_LAG_BOOST * lag);
  const uncapped = carry + rate * dt / 1000;
  // Open with a glyph immediately; after that, fractional carry keeps the
  // cadence smooth instead of forcing a character every frame.
  const floor = from === 0 && remaining > 0 ? 1 : 0;
  const budget = Math.min(maxPerFrame, Math.max(floor, Math.floor(uncapped)));
  const end = advanceCodePoints(text, from, budget);
  return { end, carry: end >= text.length ? 0 : Math.max(0, uncapped - budget) };
}

// The pending assistant row owns one quiet pre-content label. Reasoning and
// tool steps hand off to the timeline; text and media hand off to their parts.
export function shouldShowThinking(
  running: boolean,
  parts: readonly { type: string; text?: string }[],
): boolean {
  return running && !parts.some((part) =>
    part.type === "text" ? Boolean(part.text?.length) :
      part.type === "reasoning" || part.type === "tool-call" ||
      part.type === "data" || part.type === "file" || part.type === "image",
  );
}

// eve creates its assistant row on step.started, after message.received. Until
// then, keep a display-only row at that same position; it is never persisted.
// `awaitingReply` covers the optimistic preparing window before streaming
// confirms the user turn, so Thinking can replace "Sending…".
export function withPendingAssistant(
  messages: readonly ThreadMessageLike[],
  source: readonly { role: string; metadata?: { status?: string } }[],
  streaming: boolean,
  awaitingReply = false,
): ThreadMessageLike[] {
  if (messages[messages.length - 1]?.role === "assistant") {
    return [...messages];
  }
  const lastSource = source[source.length - 1];
  const streamReady =
    streaming
    && lastSource?.role === "user"
    && lastSource.metadata?.status === "complete";
  const preparingOptimistic =
    awaitingReply && messages[messages.length - 1]?.role === "user";
  if (!streamReady && !preparingOptimistic) {
    return [...messages];
  }
  return [...messages, { role: "assistant", content: [], status: { type: "running" } }];
}
