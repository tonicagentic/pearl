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
  version: 0,
};

function bucketFor(key: LiveReplySessionKey): SessionBucket {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = {
      state: { ...EMPTY_STATE, parts: new Map() },
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

/** True when this partId is tracked as assistant reply text (not reasoning). */
function isTextPart(
  state: LiveReplyState,
  partId: string,
  kind: string | undefined,
): boolean {
  if (kind === "text") return true;
  if (kind && kind !== "text") return false;
  const existing = state.parts.get(partId);
  if (existing) return existing.kind === "text";
  // eve often omits `kind` on every content.delta (including the first).
  // Non-text parts announce an explicit kind — treat missing kind as text.
  return true;
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
    state = {
      turnId,
      parts: new Map(),
      order: [],
      version: state.version,
    };
  }

  if (!isTextPart(state, partId, kind)) return;

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
    turnId: turnId ?? state.turnId,
    parts,
    order,
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
  emit(key, {
    turnId: input.turnId ?? null,
    parts,
    order,
    version: bucket.state.version + 1,
  });
}

/** Drop live overlay for one session (turn settled or snapshot caught up). */
export function clearLiveReplyText(key: LiveReplySessionKey): void {
  const bucket = buckets.get(key);
  if (!bucket) return;
  if (bucket.state.parts.size === 0 && bucket.state.version === 0) return;
  emit(key, {
    turnId: null,
    parts: new Map(),
    order: [],
    version: bucket.state.version + 1,
  });
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
