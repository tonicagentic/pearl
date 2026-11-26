import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { Text as RNText } from "react-native";

export type TextRange = {
  readonly start: number;
  readonly end: number;
};

/**
 * Walk a React text tree by plain-text offsets and wrap overlapping slices
 * with `wrap`. Used to paint saved Library quotes inside settled markdown.
 */
export function wrapTextRanges(
  node: ReactNode,
  ranges: readonly TextRange[],
  wrap: (text: string, key: string) => ReactNode,
): ReactNode {
  if (ranges.length === 0) return node;
  let cursor = 0;

  function visit(current: ReactNode): ReactNode {
    if (current == null || typeof current === "boolean") return current;

    if (typeof current === "string" || typeof current === "number") {
      const text = String(current);
      const start = cursor;
      const end = cursor + text.length;
      cursor = end;

      const overlapping = ranges.filter(
        (range) => range.start < end && range.end > start,
      );
      if (overlapping.length === 0) return text;

      const parts: ReactNode[] = [];
      let local = 0;
      for (const range of overlapping) {
        const sliceStart = Math.max(range.start, start) - start;
        const sliceEnd = Math.min(range.end, end) - start;
        if (sliceStart > local) {
          parts.push(text.slice(local, sliceStart));
        }
        const slice = text.slice(sliceStart, sliceEnd);
        parts.push(
          wrap(slice, `q-${start + sliceStart}-${start + sliceEnd}`),
        );
        local = sliceEnd;
      }
      if (local < text.length) {
        parts.push(text.slice(local));
      }
      return parts.length === 1 ? parts[0] : parts;
    }

    if (Array.isArray(current)) {
      return Children.map(current, (child) => visit(child));
    }

    if (isValidElement(current)) {
      const element = current as ReactElement<{ children?: ReactNode }>;
      const nextChildren = visit(element.props.children);
      if (nextChildren === element.props.children) return element;
      return cloneElement(element, undefined, nextChildren);
    }

    return current;
  }

  return visit(node);
}

/** Warm wash matching web `--quote-highlight`. */
export function QuoteHighlightText({
  text,
  backgroundColor,
}: {
  readonly text: string;
  readonly backgroundColor: string;
}) {
  return (
    <RNText style={{ backgroundColor }}>{text}</RNText>
  );
}
