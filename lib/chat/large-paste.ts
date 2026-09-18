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

export type PasteEntry = {
  /** Stable id; block delimiters reference it. */
  readonly id: string;
  readonly charCount: number;
};

export function createPasteEntry(index: number, pastedText: string): PasteEntry {
  return { id: `paste-${index}`, charCount: pastedText.length };
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

export type PendingPaste = {
  readonly id: string;
  readonly content: string;
  readonly charCount: number;
};

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
