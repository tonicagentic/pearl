/**
 * Per-delta reply text ahead of SessionStore snapshots.
 *
 * eve only folds `content.delta` into `snapshot.messages` at NDJSON line
 * boundaries (`endOfLine`). `onEvent` still fires every delta — accumulate
 * here so Expo Go can paint smaller chunks while the line is still open.
 *
 * Each SessionStore owns its own buffer so concurrent chats cannot mix text
 * into the open thread.
 */

export type LiveReplySessionKey = object;

type LivePart = { readonly kind: "text"; text: string };

type LiveReplyState = {
  readonly turnId: string | null;
  readonly parts: ReadonlyMap<string, LivePart>;
  readonly order: readonly string[];
  /**
   * partIds that announced an explicit non-text kind (e.g. reasoning).
   * Follow-up deltas often omit `kind`; keep rejecting those so reasoning
   * tails do not leak into the visible reply overlay.
   */
  readonly nonTextPartIds: ReadonlySet<string>;
  readonly version: number;
};

type SessionBucket = {
  state: LiveReplyState;
  readonly listeners: Set<() => void>;
};

const buckets = new WeakMap<LiveReplySessionKey, SessionBucket>();
/** Strong refs for test reset only — WeakMap entries are otherwise GC'd. */
const testKeys = new Set<LiveReplySessionKey>();

const EMPTY_STATE: LiveReplyState = {
  turnId: null,
  parts: new Map(),
  order: [],
  nonTextPartIds: new Set(),
  version: 0,
};

function emptyPartsState(
  turnId: string | null,
  version: number,
): LiveReplyState {
  return {
    turnId,
    parts: new Map(),
    order: [],
    nonTextPartIds: new Set(),
    version,
  };
}

function bucketFor(key: LiveReplySessionKey): SessionBucket {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = {
      state: emptyPartsState(null, 0),
      listeners: new Set(),
    };
    buckets.set(key, bucket);
    testKeys.add(key);
  }
  return bucket;
}

function emit(key: LiveReplySessionKey, next: LiveReplyState): void {
  const bucket = bucketFor(key);
  bucket.state = next;
  for (const listener of bucket.listeners) listener();
}

/**
 * True when this partId should accumulate as assistant reply text.
 * Explicit non-text kinds are remembered so later omitted-kind deltas
 * for the same partId stay rejected (eve often tags only the first chunk).
 */
function isTextPart(
  state: LiveReplyState,
  partId: string,
  kind: string | undefined,
): { readonly accept: boolean; readonly markNonText: boolean } {
  if (kind === "text") return { accept: true, markNonText: false };
  if (kind && kind !== "text") {
    return { accept: false, markNonText: true };
  }
  if (state.nonTextPartIds.has(partId)) {
    return { accept: false, markNonText: false };
  }
  const existing = state.parts.get(partId);
  if (existing) {
    return { accept: existing.kind === "text", markNonText: false };
  }
  // eve often omits `kind` on every content.delta (including the first).
  // Unknown partId with missing kind → text.
  return { accept: true, markNonText: false };
}

/**
 * Fold a `content.delta` into the live buffer for one session. Ignores
 * non-text kinds (reasoning, etc.). A new turnId replaces prior parts.
 */
export function pushLiveReplyDelta(
  key: LiveReplySessionKey,
  event: {
    readonly turnId?: string;
    readonly partId: string;
    readonly kind?: string;
    readonly delta: string;
  },
): void {
  const { partId, delta, kind, turnId } = event;
  if (!partId || typeof delta !== "string" || delta.length === 0) return;

  const bucket = bucketFor(key);
  let state = bucket.state;

  // A new turn replaces the previous buffer so stale parts do not linger.
  if (
    turnId !== undefined &&
    state.turnId !== null &&
    turnId !== state.turnId
  ) {
    state = emptyPartsState(turnId, state.version);
  }

  const decision = isTextPart(state, partId, kind);
  const nextTurnId = turnId ?? state.turnId;

  if (!decision.accept) {
    // Remember non-text partIds and stamp turnId even with no text emit, so
    // omitted-kind tails stay rejected and a later turnId can clear memory.
    const needsNonText =
      decision.markNonText && !state.nonTextPartIds.has(partId);
    if (needsNonText || nextTurnId !== state.turnId) {
      const nonTextPartIds = needsNonText
        ? new Set(state.nonTextPartIds)
        : state.nonTextPartIds;
      if (needsNonText) nonTextPartIds.add(partId);
      bucket.state = {
        ...state,
        turnId: nextTurnId,
        nonTextPartIds,
      };
    }
    return;
  }

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

  emit(key, {
    turnId: nextTurnId,
    parts,
    order,
    nonTextPartIds: state.nonTextPartIds,
    version: state.version + 1,
  });
}

/**
 * Seed the live overlay with already-generated text from a catch-up hold.
 * Replaces any existing buffer for this session so the backlog paints in one shot.
 */
export function seedLiveReplyParts(
  key: LiveReplySessionKey,
  input: {
    readonly turnId?: string | null;
    readonly parts: readonly { readonly id: string; readonly text: string }[];
  },
): void {
  if (input.parts.length === 0) return;
  const parts = new Map<string, LivePart>();
  const order: string[] = [];
  for (const part of input.parts) {
    if (!part.id || part.text.length === 0) continue;
    parts.set(part.id, { kind: "text", text: part.text });
    order.push(part.id);
  }
  if (order.length === 0) return;
  const bucket = bucketFor(key);
  const seededTurn = input.turnId ?? null;
  // Same-turn catch-up must keep reasoning partIds. Wiping them lets the
  // omitted-kind tail of a reasoning part paint as reply text after seed.
  const keepNonText =
    bucket.state.turnId === null ||
    seededTurn === null ||
    bucket.state.turnId === seededTurn;
  emit(key, {
    turnId: seededTurn,
    parts,
    order,
    nonTextPartIds: keepNonText ? bucket.state.nonTextPartIds : new Set(),
    version: bucket.state.version + 1,
  });
}

/**
 * Fold one content.delta into the live buffer or the catch-up hold.
 *
 * Explicit non-text kinds are routed "ignore" before they reach the buffer.
 * Eve tags kind on the first chunk only, so that announce must still be
 * recorded — otherwise the omitted-kind tail is accepted as reply text.
 */
export function absorbContentDelta(
  key: LiveReplySessionKey,
  route: "push" | "hold" | "ignore",
  event: {
    readonly turnId?: string;
    readonly partId: string;
    readonly kind?: string;
    readonly delta: string;
  },
): "buffer" | "hold" | "drop" {
  if (route === "ignore" || route === "push") {
    pushLiveReplyDelta(key, event);
    return "buffer";
  }
  const bucket = buckets.get(key);
  if (bucket?.state.nonTextPartIds.has(event.partId)) return "drop";
  return "hold";
}

/** Drop live overlay for one session (turn settled or snapshot caught up). */
export function clearLiveReplyText(key: LiveReplySessionKey): void {
  const bucket = buckets.get(key);
  if (!bucket) return;
  if (
    bucket.state.parts.size === 0 &&
    bucket.state.nonTextPartIds.size === 0 &&
    bucket.state.version === 0
  ) {
    return;
  }
  emit(key, emptyPartsState(null, bucket.state.version + 1));
}

/**
 * When the store snapshot already includes at least as much text as the live
 * buffer, clear so we do not double-apply after line commit.
 */
export function reconcileLiveReplyWithSnapshot(
  key: LiveReplySessionKey,
  messages: readonly {
    readonly role: string;
    readonly parts?: readonly {
      readonly id?: string;
      readonly type?: string;
      readonly text?: string;
    }[];
  }[],
): void {
  const bucket = buckets.get(key);
  if (!bucket || bucket.state.parts.size === 0) return;
  const state = bucket.state;
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
              (part.text === live.text ||
                part.text.endsWith(live.text) ||
                live.text.endsWith(part.text)),
          )?.text ?? "";
    if (snapText.length < live.text.length) {
      allCaughtUp = false;
      break;
    }
  }
  if (allCaughtUp) clearLiveReplyText(key);
}

export function getLiveReplyVersion(key: LiveReplySessionKey): number {
  return buckets.get(key)?.state.version ?? 0;
}

export function getLiveReplyTurnId(
  key: LiveReplySessionKey,
): string | null {
  return buckets.get(key)?.state.turnId ?? null;
}

export function getLiveReplyParts(key: LiveReplySessionKey): readonly {
  readonly id: string;
  readonly text: string;
  readonly turnId: string | null;
}[] {
  const state = buckets.get(key)?.state;
  if (!state) return [];
  return state.order
    .map((id) => {
      const part = state.parts.get(id);
      return part
        ? { id, text: part.text, turnId: state.turnId }
        : null;
    })
    .filter(
      (
        part,
      ): part is { id: string; text: string; turnId: string | null } =>
        part !== null,
    );
}

export function subscribeLiveReplyText(
  key: LiveReplySessionKey,
  listener: () => void,
): () => void {
  const bucket = bucketFor(key);
  bucket.listeners.add(listener);
  return () => {
    bucket.listeners.delete(listener);
  };
}

/** Test helper. */
export function __resetLiveReplyTextForTests(): void {
  for (const key of testKeys) {
    buckets.delete(key);
  }
  testKeys.clear();
}
