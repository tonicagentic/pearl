// Auto-attachment for large pastes in the chat composer.
//
// Mechanics mirror attachments: a large paste is captured at the composer
// boundary, held outside the composer text, shown as a removable chip, and
// injected into the outgoing turn message at send time as clearly delimited
// inline blocks (rendered collapsed in the user bubble by UserTextPart).
// The composer text never holds the paste, so large pastes stay out of the
// 8000-char message-limit path (limits.ts) while the agent still receives
// the full content.

/** Pastes longer than this become chip-attached. */
export const LARGE_PASTE_CHARS = 1200;

/**
 * Refuse to attach pastes beyond this size instead of failing late at the
 * model call: the 8000-char message limit does not apply to attached pastes
 * (the limit check sees only the composer text), so the practical ceiling is
 * the model's context window. 400k chars is roughly 100k tokens, comfortably
 * inside a 1M-token context even with other conversation content.
 */
export const LARGE_PASTE_MAX_CHARS = 400_000;

/** Registry cap so a long session cannot accumulate unbounded pastes. */
export const LARGE_PASTE_MAX_ENTRIES = 20;

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

// ---------------------------------------------------------------------------
// Module-scoped registry for held pastes.
//
// A module singleton (not React state/context) is deliberate: the composer's
// paste handler, the composer chips, and the send-path expansion may run
// under different component instances (the surface can mount more than once,
// e.g. across route transitions), and React context values are scoped to one
// instance's subtree. A module registry is shared by every instance, so the
// paste registered by the composer handler is always the paste the send path
// expands, and chip removal works regardless of which instance renders.

export type HeldPaste = {
  readonly id: string;
  readonly charCount: number;
};

const contentById = new Map<string, string>();
const heldOrder: string[] = [];
let nextPasteIndex = 0;

const storeListeners = new Set<() => void>();
let storeVersion = 0;
let heldSnapshot: readonly HeldPaste[] = [];

function emitChange() {
  storeVersion += 1;
  heldSnapshot = heldOrder.map((id) => ({
    charCount: contentById.get(id)?.length ?? 0,
    id,
  }));
  for (const listener of storeListeners) {
    listener();
  }
}

/** Snapshot for `useSyncExternalStore` — stable identity between changes. */
export function getHeldPastes(): readonly HeldPaste[] {
  return heldSnapshot;
}

export function subscribeToHeldPastes(listener: () => void): () => void {
  storeListeners.add(listener);
  return () => storeListeners.delete(listener);
}

// Errors from the paste flow (size cap, chip cap) surface through the chat
// surface's error toast; the surface registers its setter here once.
let pasteErrorHandler: ((message: string) => void) | undefined;

export function setLargePasteErrorHandler(
  handler: (message: string) => void,
): void {
  pasteErrorHandler = handler;
}

function reportPasteError(message: string): void {
  pasteErrorHandler?.(message);
}

/**
 * Attaches a large paste. Returns null (with an error reported through the
 * registered handler) when the paste exceeds the size cap or too many are
 * held.
 */
export function addHeldPaste(pastedText: string): HeldPaste | null {
  if (pastedText.length > LARGE_PASTE_MAX_CHARS) {
    reportPasteError(
      `Pasted text is too large (${formatCount(pastedText.length)} characters). Split it into parts or attach it as a file.`,
    );
    return null;
  }

  if (heldOrder.length >= LARGE_PASTE_MAX_ENTRIES) {
    reportPasteError(
      `Too many held pastes (${formatCount(LARGE_PASTE_MAX_ENTRIES)}). Send or remove one first.`,
    );
    return null;
  }

  const id = `paste-${(nextPasteIndex += 1)}`;
  contentById.set(id, pastedText);
  heldOrder.push(id);
  emitChange();

  return { id, charCount: pastedText.length };
}

export function removeHeldPaste(id: string): void {
  if (!contentById.delete(id)) {
    return;
  }

  const index = heldOrder.indexOf(id);
  if (index !== -1) {
    heldOrder.splice(index, 1);
  }
  emitChange();
}

export type PendingPaste = {
  readonly id: string;
  readonly content: string;
  readonly charCount: number;
};

function pendingPastes(): PendingPaste[] {
  return heldOrder.map((id) => ({
    charCount: contentById.get(id)?.length ?? 0,
    content: contentById.get(id) ?? "",
    id,
  }));
}

/**
 * Send-time expansion: appends held pastes as inline blocks after the
 * composer text and consumes them. A no-op when nothing is held.
 */
export function expandHeldPastes(text: string): {
  text: string;
  consumedIds: readonly string[];
} {
  const expanded = expandPastesForSend(text, pendingPastes());

  if (expanded.consumedIds.length > 0) {
    for (const id of expanded.consumedIds) {
      contentById.delete(id);
      const index = heldOrder.indexOf(id);
      if (index !== -1) {
        heldOrder.splice(index, 1);
      }
    }
    emitChange();
  }

  return expanded;
}

/** The exact inline block delimiter expandPastesForSend produces. */
export function pasteBlockStart(id: string, charCount: number): string {
  return `[pasted text ${id} · ${formatCount(charCount)} characters]`;
}

function pasteBlock(id: string, content: string, charCount: number): string {
  return [
    pasteBlockStart(id, charCount),
    content.replace(/\n+$/, ""),
    `[end ${id}]`,
  ].join("\n");
}

/** A segment of message text: literal text or a delimited paste block. */
export type MessageSegment =
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "paste";
      readonly id: string;
      readonly charCount: number;
      readonly content: string;
    };

const BLOCK_START_PATTERN = /^\[pasted text (paste-\d+) · ([\d,]+) characters\]\n?/;

/**
 * Splits an expanded message (the text produced by expandPastesForSend) into
 * literal text and structured paste segments, so renderers can present
 * pastes collapsed while everything else renders normally. Unmatched or
 * malformed markers stay as literal text.
 */
export function splitPasteBlocks(text: string): readonly MessageSegment[] {
  const segments: MessageSegment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const start = text.indexOf("[pasted text ", cursor);

    if (start === -1) {
      segments.push({ kind: "text", text: text.slice(cursor) });
      break;
    }

    if (start > cursor) {
      segments.push({ kind: "text", text: text.slice(cursor, start) });
    }

    const headerMatch = BLOCK_START_PATTERN.exec(text.slice(start));

    if (!headerMatch) {
      segments.push({ kind: "text", text: "[" });
      cursor = start + 1;
      continue;
    }

    const endMarker = `[end ${headerMatch[1]}]`;
    const end = text.indexOf(endMarker, start + headerMatch[0].length);

    if (end === -1) {
      segments.push({ kind: "text", text: text.slice(start) });
      break;
    }

    // The block builder strips trailing newlines from the paste content and
    // joins header/content/footer with "\n", so exactly one trailing newline
    // here is structural, not content.
    let content = text.slice(start + headerMatch[0].length, end);

    if (content.endsWith("\n")) {
      content = content.slice(0, -1);
    }

    segments.push({
      kind: "paste",
      id: headerMatch[1] as string,
      charCount: Number(headerMatch[2].replace(/,/g, "")),
      content,
    });
    cursor = end + endMarker.length;
  }

  return segments;
}

/**
 * Expands held pastes into the outgoing turn message: blocks are appended
 * after the composer text (attachment-style, no inline positioning), and all
 * consumed ids are returned so the caller can drop them from the registry.
 */
export function expandPastesForSend(
  text: string,
  pastes: readonly PendingPaste[],
): { text: string; consumedIds: readonly string[] } {
  if (pastes.length === 0) {
    return { text, consumedIds: [] };
  }

  const blocks = pastes.map((paste) =>
    pasteBlock(paste.id, paste.content, paste.charCount),
  );
  const separator = text.trim().length === 0 ? "" : "\n\n";

  return {
    text: `${text}${separator}${blocks.join("\n\n")}`,
    consumedIds: pastes.map((paste) => paste.id),
  };
}
