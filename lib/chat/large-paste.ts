// Auto-attachment for large pastes in the chat composer.
//
// Mechanics mirror attachments (the content is captured at the composer
// boundary and held outside the visible text), but the paste stays inline:
// the composer shows a compact Slack-style placeholder, and at send time the
// placeholder expands into a clearly delimited inline block in the message.
// This keeps pasted logs/JSON/articles out of the 8000-char message limit
// path (limits.ts) while the agent still receives the full text.

/** Pastes longer than this become placeholder-attached. */
export const LARGE_PASTE_CHARS = 1200;

/**
 * Refuse to attach pastes beyond this size instead of failing late at the
 * model call: the 8000-char message limit does not apply to attached pastes
 * (the limit check sees only the collapsed placeholder), so the practical
 * ceiling is the model's context window. 400k chars is roughly 100k tokens,
 * comfortably inside a 1M-token context even with other conversation content.
 */
export const LARGE_PASTE_MAX_CHARS = 400_000;

/** Registry cap so a long session cannot accumulate unbounded pastes. */
export const LARGE_PASTE_MAX_ENTRIES = 20;

export type LargePaste = {
  /** Stable id referenced by the placeholder. */
  readonly id: string;
  /** One-line composer placeholder shown where the paste landed. */
  readonly placeholder: string;
  readonly content: string;
  readonly charCount: number;
};

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

export function makePastePlaceholder(id: string, charCount: number): string {
  return `[Pasted text ${id} +${formatCount(charCount)} chars]`;
}

const PLACEHOLDER_PATTERN = /\[Pasted text (paste-\d+) \+[\d,]+ chars\]/g;

/**
 * The core capture: given the composer text before the paste, the paste text,
 * and the caret selection, decides whether the paste should be attached.
 * Returns null when the paste is small enough to insert normally.
 */
export function createAttachedPaste(input: {
  readonly composerText: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
  readonly pastedText: string;
  readonly nextIndex: number;
}): { composerText: string; placeholder: string; content: string; id: string } | null {
  if (input.pastedText.length < LARGE_PASTE_CHARS) {
    return null;
  }

  const id = `paste-${input.nextIndex}`;
  const placeholder = makePastePlaceholder(id, input.pastedText.length);
  const before = input.composerText.slice(0, input.selectionStart);
  const after = input.composerText.slice(input.selectionEnd);
  // Keep the placeholder from gluing onto the preceding word.
  const joinBefore = before.length > 0 && !/\s$/.test(before) ? " " : "";
  const composerText = `${before}${joinBefore}${placeholder}${after}`;

  return { composerText, placeholder, content: input.pastedText, id };
}

/** All paste ids whose placeholder still appears in the text. */
export function findPlaceholderIds(text: string): string[] {
  const ids: string[] = [];
  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    ids.push(match[1] as string);
  }

  return ids;
}

export type LargePasteRegistry = ReadonlyMap<string, LargePaste>;

/** The exact inline block delimiters expandLargePastes produces. */
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

const BLOCK_START_PATTERN = /\[pasted text (paste-\d+) · ([\d,]+) characters\]\n?/;

/**
 * Splits an expanded message (the text produced by expandLargePastes) into
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

    const headerMatch = /^\[pasted text (paste-\d+) · ([\d,]+) characters\]\n?/.exec(
      text.slice(start),
    );

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
 * Expands composer placeholders into the delimited inline blocks the agent
 * (and the sent message) should contain, and returns the entries whose
 * placeholders the user deleted so they can be dropped from the registry.
 */
export function expandLargePastes(
  text: string,
  registry: LargePasteRegistry,
): { text: string; removedIds: string[] } {
  let expanded = text;
  const referenced = new Set(findPlaceholderIds(text));
  const removedIds: string[] = [];

  for (const id of registry.keys()) {
    if (!referenced.has(id)) {
      removedIds.push(id);
    }
  }

  for (const [id, paste] of registry) {
    if (!referenced.has(id)) {
      continue;
    }

    expanded = expanded
      .split(paste.placeholder)
      .join(pasteBlock(id, paste.content, paste.charCount));
  }

  return { text: expanded, removedIds };
}
