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

    const block = [
      `[pasted text ${id} · ${formatCount(paste.charCount)} characters]`,
      paste.content.replace(/\n+$/, ""),
      `[end ${id}]`,
    ].join("\n");
    expanded = expanded.split(paste.placeholder).join(block);
  }

  return { text: expanded, removedIds };
}
