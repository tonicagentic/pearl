/**
 * Project @-mentions use assistant-ui's directive form:
 * `:project[Name]{name=<id>}` (quoted fields when the name or id needs them).
 * Shared by the mobile composer, message chips, titles, and agent context.
 */

export type ProjectMention = {
  readonly id: string;
  readonly label: string;
};

export type DirectiveSegment =
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "mention";
      readonly type: string;
      readonly label: string;
      readonly id: string;
    };

export type ComposerDraftPart =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "project"; readonly id: string; readonly label: string };

const QUOTED_VALUE =
  String.raw`"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[\da-fA-F]{4})){1,1024}"`;
const DIRECTIVE_RE = new RegExp(
  String.raw`:([\w-]{1,64})(?:\[([^\]\n]{1,1024})\](?:\{name=([^}\n]{1,1024})\})?|\{label=(${QUOTED_VALUE})(?: name=(${QUOTED_VALUE}))?\})`,
  "gu",
);

const TRAILING_AT_QUERY = /(?:^|[\s([{])@([^\s@]*)$/;

/** Serialize a directive chip (`type` defaults to project). */
export function serializeDirective(
  type: string,
  mention: ProjectMention,
): string {
  const { id, label } = mention;
  if (label.includes("]") || (id !== label && id.includes("}"))) {
    const name = id !== label ? ` name=${JSON.stringify(id)}` : "";
    return `:${type}{label=${JSON.stringify(label)}${name}}`;
  }
  const attrs = id !== label ? `{name=${id}}` : "";
  return `:${type}[${label}]${attrs}`;
}

/** Serialize one project mention into directive text. */
export function serializeProjectMention(mention: ProjectMention): string {
  return serializeDirective("project", mention);
}

/** Parse a message into text / mention segments (any directive type). */
export function parseDirectiveSegments(text: string): readonly DirectiveSegment[] {
  const segments: DirectiveSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(DIRECTIVE_RE)) {
    if (match.index === undefined) continue;
    if (match.index > lastIndex) {
      segments.push({
        kind: "text",
        text: text.slice(lastIndex, match.index),
      });
    }
    const label =
      match[4] === undefined ? (match[2] ?? "") : (JSON.parse(match[4]) as string);
    const id =
      match[5] === undefined
        ? (match[3] ?? label)
        : (JSON.parse(match[5]) as string);
    segments.push({
      kind: "mention",
      type: match[1] ?? "project",
      label,
      id,
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ kind: "text", text: text.slice(lastIndex) });
  }
  return segments;
}

/** Deduped project mentions from message text, in first-seen order. Cap optional. */
export function extractProjectMentions(
  text: string,
  cap = 5,
): readonly ProjectMention[] {
  const seen = new Set<string>();
  const out: ProjectMention[] = [];
  for (const segment of parseDirectiveSegments(text)) {
    if (segment.kind !== "mention" || segment.type !== "project") continue;
    const id = segment.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label: segment.label });
    if (out.length >= cap) break;
  }
  return out;
}

/** Replace directives with their labels for titles / copy. */
export function plainTextFromDirectives(text: string): string {
  return parseDirectiveSegments(text)
    .map((segment) =>
      segment.kind === "text" ? segment.text : segment.label,
    )
    .join("");
}

/** Build composer draft parts from a stored/serialized message. Always ends with text. */
export function draftPartsFromText(text: string): ComposerDraftPart[] {
  const parts: ComposerDraftPart[] = [];
  for (const segment of parseDirectiveSegments(text)) {
    if (segment.kind === "text") {
      if (segment.text.length === 0) continue;
      const last = parts[parts.length - 1];
      if (last?.kind === "text") {
        parts[parts.length - 1] = {
          kind: "text",
          text: last.text + segment.text,
        };
      } else {
        parts.push({ kind: "text", text: segment.text });
      }
      continue;
    }
    if (segment.type !== "project") {
      const literal = serializeDirective(segment.type, {
        id: segment.id,
        label: segment.label,
      });
      const last = parts[parts.length - 1];
      if (last?.kind === "text") {
        parts[parts.length - 1] = {
          kind: "text",
          text: last.text + literal,
        };
      } else {
        parts.push({ kind: "text", text: literal });
      }
      continue;
    }
    parts.push({
      kind: "project",
      id: segment.id,
      label: segment.label,
    });
  }
  if (parts.length === 0 || parts[parts.length - 1]?.kind !== "text") {
    parts.push({ kind: "text", text: "" });
  }
  return parts;
}

/** Serialize draft parts for aui.composer.setText / the agent. */
export function serializeDraftParts(
  parts: readonly ComposerDraftPart[],
): string {
  return parts
    .map((part) =>
      part.kind === "text"
        ? part.text
        : serializeProjectMention({ id: part.id, label: part.label }),
    )
    .join("");
}

/** Trailing `@query` in the active (last) text run, or null when the menu should close. */
export function trailingMentionQuery(activeText: string): string | null {
  const match = TRAILING_AT_QUERY.exec(activeText);
  if (!match) return null;
  return match[1] ?? "";
}

/** Replace the trailing `@query` with a project chip and an empty trailing text run. */
export function insertProjectMention(
  parts: readonly ComposerDraftPart[],
  mention: ProjectMention,
): ComposerDraftPart[] {
  const next = parts.map((part) => ({ ...part }));
  if (next.length === 0 || next[next.length - 1]?.kind !== "text") {
    next.push({ kind: "text", text: "" });
  }
  const last = next[next.length - 1];
  if (!last || last.kind !== "text") return next;
  const query = trailingMentionQuery(last.text);
  if (query === null) return next;
  const cut = last.text.length - (query.length + 1);
  const before = last.text.slice(0, Math.max(0, cut));
  next[next.length - 1] = { kind: "text", text: before };
  next.push({ kind: "project", id: mention.id, label: mention.label });
  next.push({ kind: "text", text: "" });
  return next;
}

/** Backspace at the start of the active text run removes the preceding chip. */
export function deleteChipBeforeCaret(
  parts: readonly ComposerDraftPart[],
): ComposerDraftPart[] | null {
  if (parts.length < 2) return null;
  const last = parts[parts.length - 1];
  if (!last || last.kind !== "text" || last.text.length > 0) return null;
  const before = parts[parts.length - 2];
  if (!before || before.kind !== "project") return null;
  const head = parts.slice(0, -2);
  const prior = head[head.length - 1];
  if (prior?.kind === "text") {
    return [...head.slice(0, -1), { kind: "text", text: prior.text }];
  }
  return [...head, { kind: "text", text: "" }];
}

/**
 * Resolve which project id should become the turn default.
 * Existing chat project always wins. A single verified mention fills a missing one.
 */
export function resolveTurnProjectId(input: {
  readonly chatProjectId: string | null;
  readonly verifiedMentionIds: readonly string[];
}): string | null {
  if (input.chatProjectId) return input.chatProjectId;
  if (input.verifiedMentionIds.length === 1) {
    return input.verifiedMentionIds[0] ?? null;
  }
  return null;
}
