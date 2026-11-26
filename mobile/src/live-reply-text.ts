/**
 * Per-delta reply text ahead of SessionStore snapshots.
 *
 * eve only folds `content.delta` into `snapshot.messages` at NDJSON line
 * boundaries (`endOfLine`). `onEvent` still fires every delta — accumulate
 * here so Expo Go can paint smaller chunks while the line is still open.
 */

type LivePart = { readonly kind: "text"; text: string };

type LiveReplyState = {
  readonly turnId: string | null;
  readonly parts: ReadonlyMap<string, LivePart>;
  readonly order: readonly string[];
  readonly version: number;
};

const listeners = new Set<() => void>();

let state: LiveReplyState = {
  turnId: null,
  parts: new Map(),
  order: [],
  version: 0,
};

function emit(next: LiveReplyState) {
  state = next;
  for (const listener of listeners) listener();
}

/** True when this partId is tracked as assistant reply text (not reasoning). */
function isTextPart(partId: string, kind: string | undefined): boolean {
  if (kind === "text") return true;
  if (kind && kind !== "text") return false;
  const existing = state.parts.get(partId);
  if (existing) return existing.kind === "text";
  // eve often omits `kind` on every content.delta (including the first).
  // Non-text parts announce an explicit kind — treat missing kind as text.
  return true;
}

/**
 * Fold a `content.delta` into the live buffer. Ignores non-text kinds
 * (reasoning, etc.).
 */
export function pushLiveReplyDelta(event: {
  readonly turnId?: string;
  readonly partId: string;
  readonly kind?: string;
  readonly delta: string;
}): void {
  const { partId, delta, kind, turnId } = event;
  if (!partId || typeof delta !== "string" || delta.length === 0) return;
  // First record announces kind; later deltas omit it — only accept text parts.
  if (!isTextPart(partId, kind)) return;

  const parts = new Map(state.parts);
  const prev = parts.get(partId);
  parts.set(partId, {
    kind: "text",
    text: (prev?.text ?? "") + delta,
  });
  const order = prev
    ? state.order
    : state.order.includes(partId)
      ? state.order
      : [...state.order, partId];

  emit({
    turnId: turnId ?? state.turnId,
    parts,
    order,
    version: state.version + 1,
  });
}

/**
 * Seed the live overlay with already-generated text from a catch-up hold.
 * Replaces any existing buffer so the backlog paints in one shot.
 */
export function seedLiveReplyParts(input: {
  readonly turnId?: string | null;
  readonly parts: readonly { readonly id: string; readonly text: string }[];
}): void {
  if (input.parts.length === 0) return;
  const parts = new Map<string, LivePart>();
  const order: string[] = [];
  for (const part of input.parts) {
    if (!part.id || part.text.length === 0) continue;
    parts.set(part.id, { kind: "text", text: part.text });
    order.push(part.id);
  }
  if (order.length === 0) return;
  emit({
    turnId: input.turnId ?? null,
    parts,
    order,
    version: state.version + 1,
  });
}

/** Drop live overlay (turn settled or snapshot caught up). */
export function clearLiveReplyText(): void {
  if (state.parts.size === 0 && state.version === 0) return;
  emit({
    turnId: null,
    parts: new Map(),
    order: [],
    version: state.version + 1,
  });
}

/**
 * When the store snapshot already includes at least as much text as the live
 * buffer, clear so we do not double-apply after line commit.
 */
export function reconcileLiveReplyWithSnapshot(
  messages: readonly {
    readonly role: string;
    readonly parts?: readonly {
      readonly id?: string;
      readonly type?: string;
      readonly text?: string;
    }[];
  }[],
): void {
  if (state.parts.size === 0) return;
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant" || !last.parts) return;

  const textParts = last.parts.filter(
    (part) => part.type === "text" && typeof part.text === "string",
  );

  let allCaughtUp = true;
  for (const partId of state.order) {
    const live = state.parts.get(partId);
    if (!live) continue;
    const byId = textParts.find((part) => part.id === partId);
    const snapText =
      typeof byId?.text === "string"
        ? byId.text
        : // Projection sometimes omits part ids — accept any text that
          // already covers the live buffer so settle does not strand overlay.
          textParts.find(
            (part) =>
              typeof part.text === "string" &&
              part.text.length >= live.text.length &&
              (part.text === live.text || part.text.endsWith(live.text) || live.text.endsWith(part.text)),
          )?.text ?? "";
    if (snapText.length < live.text.length) {
      allCaughtUp = false;
      break;
    }
  }
  if (allCaughtUp) clearLiveReplyText();
}

export function getLiveReplyVersion(): number {
  return state.version;
}

export function getLiveReplyParts(): readonly {
  readonly id: string;
  readonly text: string;
}[] {
  return state.order
    .map((id) => {
      const part = state.parts.get(id);
      return part ? { id, text: part.text } : null;
    })
    .filter((part): part is { id: string; text: string } => part !== null);
}

export function subscribeLiveReplyText(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test helper. */
export function __resetLiveReplyTextForTests(): void {
  state = { turnId: null, parts: new Map(), order: [], version: 0 };
}
