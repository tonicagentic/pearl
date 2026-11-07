import {
  applySpecPatch,
  createMixedStreamParser,
  type Spec,
} from "@json-render/core";

export type InlineTextSegment = {
  readonly type: "text";
  readonly text: string;
};

export type InlineSpecSegment = {
  readonly type: "spec";
};

export type InlineSegment = InlineTextSegment | InlineSpecSegment;

export type InlineSpecParseResult = {
  /** Ordered layout: prose slices with at most one `spec` marker. */
  readonly segments: readonly InlineSegment[];
  /** Merged spec compiled from every patch, or null when none applied. */
  readonly spec: Spec | null;
  readonly hasSpec: boolean;
  /** All prose joined for copy/share (no JSONL). */
  readonly prose: string;
};

export type ParseInlineSpecOptions = {
  /**
   * When false, leave a trailing incomplete line buffered so a half-written
   * patch does not flash as markdown. Default true (settled messages).
   */
  readonly complete?: boolean;
};

function emptySpec(): Spec {
  return { root: "", elements: {} };
}

function appendTextLine(current: string, line: string): string {
  if (!current) return line;
  return `${current}\n${line}`;
}

/**
 * Split assistant text into prose + one merged json-render spec.
 *
 * Uses `createMixedStreamParser` (the same classifier family as
 * `pipeJsonRender`): ```spec fences and bare JSONL patches become a spec;
 * everything else is prose.
 */
export function parseInlineSpec(
  text: string,
  options: ParseInlineSpecOptions = {},
): InlineSpecParseResult {
  const complete = options.complete !== false;
  const segments: InlineSegment[] = [];
  let currentText = "";
  let firstSpecEmitted = false;
  const spec = emptySpec();
  let patchCount = 0;

  const flushText = () => {
    if (currentText.length === 0) return;
    segments.push({ type: "text", text: currentText });
    currentText = "";
  };

  const parser = createMixedStreamParser({
    onText(line) {
      currentText = appendTextLine(currentText, line);
    },
    onPatch(patch) {
      if (!firstSpecEmitted) {
        flushText();
        segments.push({ type: "spec" });
        firstSpecEmitted = true;
      }
      applySpecPatch(spec, patch);
      patchCount += 1;
    },
  });

  parser.push(text);
  if (complete) {
    parser.flush();
  }

  flushText();

  const hasSpec = patchCount > 0 && Boolean(spec.root);
  const prose = segments
    .filter((segment): segment is InlineTextSegment => segment.type === "text")
    .map((segment) => segment.text)
    .join("\n\n")
    .trim();

  return {
    segments: hasSpec
      ? segments
      : segments.filter((segment) => segment.type === "text"),
    spec: hasSpec ? spec : null,
    hasSpec,
    prose,
  };
}

/** Join text parts then strip json-render patches for clipboard/share. */
export function proseFromMessageText(text: string): string {
  return parseInlineSpec(text, { complete: true }).prose;
}
