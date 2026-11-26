"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { LibraryQuoteDto } from "@/lib/db/library-quotes";

const HIGHLIGHT_NAME = "pearl-quote";

type ChatQuotesContextValue = {
  /** Quotes for the open chat, keyed by message id (quotes without a message id are omitted). */
  readonly quotesByMessageId: ReadonlyMap<string, readonly LibraryQuoteDto[]>;
  /** Register CSS Highlight ranges for one message. Pass [] to clear. */
  readonly setMessageRanges: (messageId: string, ranges: readonly Range[]) => void;
  /** Optimistically add a just-saved quote so the mark appears before refetch. */
  readonly addQuote: (quote: LibraryQuoteDto) => void;
};

const ChatQuotesContext = createContext<ChatQuotesContextValue | null>(null);

type HighlightLike = {
  add(range: AbstractRange): void;
};

type HighlightRegistryLike = {
  set(name: string, highlight: HighlightLike): void;
  delete(name: string): void;
};

function getHighlightRegistry(): HighlightRegistryLike | null {
  if (typeof CSS === "undefined") return null;
  const highlights = (CSS as { highlights?: HighlightRegistryLike }).highlights;
  return highlights ?? null;
}

function createHighlight(ranges: readonly Range[]): HighlightLike | null {
  const HighlightCtor = (
    globalThis as { Highlight?: new (...ranges: AbstractRange[]) => HighlightLike }
  ).Highlight;
  if (!HighlightCtor) return null;
  return new HighlightCtor(...ranges);
}

/**
 * Loads Library quotes for the open chat and aggregates per-message CSS
 * Highlight ranges into one document-level `pearl-quote` highlight.
 */
export function ChatQuotesProvider({
  chatId,
  children,
}: {
  readonly chatId: string | null;
  readonly children: ReactNode;
}) {
  const [quotes, setQuotes] = useState<readonly LibraryQuoteDto[]>([]);
  const rangesByMessageRef = useRef(new Map<string, readonly Range[]>());
  const [, bump] = useState(0);

  useEffect(() => {
    setQuotes([]);
    rangesByMessageRef.current = new Map();
    bump((n) => n + 1);

    if (!chatId) return;

    let cancelled = false;
    void fetch(`/api/quotes?chatId=${encodeURIComponent(chatId)}`)
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as {
          quotes?: readonly LibraryQuoteDto[];
        };
        if (!cancelled) setQuotes(data.quotes ?? []);
      })
      .catch(() => {
        // Highlighting is best-effort; Library still lists all quotes.
      });

    return () => {
      cancelled = true;
    };
  }, [chatId]);

  // Library "Open chat" links to `/chat/{id}#quote-{messageId}`. Scroll once
  // the matching assistant message root is in the DOM.
  useEffect(() => {
    if (!chatId || typeof window === "undefined") return;
    const hash = window.location.hash;
    const match = /^#quote-(.+)$/.exec(hash);
    if (!match?.[1]) return;

    const targetId = `quote-${match[1]}`;
    let attempts = 0;
    let timer: number | null = null;

    const tryScroll = () => {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      attempts += 1;
      if (attempts < 40) {
        timer = window.setTimeout(tryScroll, 100);
      }
    };

    timer = window.setTimeout(tryScroll, 50);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [chatId]);

  const publishHighlight = useCallback(() => {
    const registry = getHighlightRegistry();
    if (!registry) return;

    const all: Range[] = [];
    for (const ranges of rangesByMessageRef.current.values()) {
      for (const range of ranges) all.push(range);
    }

    if (all.length === 0) {
      registry.delete(HIGHLIGHT_NAME);
      return;
    }

    const highlight = createHighlight(all);
    if (!highlight) return;
    registry.set(HIGHLIGHT_NAME, highlight);
  }, []);

  useEffect(() => {
    publishHighlight();
    return () => {
      getHighlightRegistry()?.delete(HIGHLIGHT_NAME);
    };
  }, [publishHighlight, quotes]);

  const setMessageRanges = useCallback(
    (messageId: string, ranges: readonly Range[]) => {
      const prev = rangesByMessageRef.current.get(messageId);
      if (
        prev &&
        prev.length === ranges.length &&
        prev.every((range, index) => range === ranges[index])
      ) {
        return;
      }
      if (ranges.length === 0) {
        rangesByMessageRef.current.delete(messageId);
      } else {
        rangesByMessageRef.current.set(messageId, ranges);
      }
      publishHighlight();
      bump((n) => n + 1);
    },
    [publishHighlight],
  );

  const addQuote = useCallback((quote: LibraryQuoteDto) => {
    setQuotes((current) => {
      if (current.some((row) => row.id === quote.id)) return current;
      return [quote, ...current];
    });
  }, []);

  const quotesByMessageId = useMemo(() => {
    const map = new Map<string, LibraryQuoteDto[]>();
    for (const quote of quotes) {
      const messageId = quote.messageId?.trim();
      if (!messageId) continue;
      const list = map.get(messageId);
      if (list) list.push(quote);
      else map.set(messageId, [quote]);
    }
    return map;
  }, [quotes]);

  const value = useMemo(
    () => ({ quotesByMessageId, setMessageRanges, addQuote }),
    [quotesByMessageId, setMessageRanges, addQuote],
  );

  return (
    <ChatQuotesContext.Provider value={value}>
      {children}
    </ChatQuotesContext.Provider>
  );
}

export function useChatQuotes(): ChatQuotesContextValue | null {
  return useContext(ChatQuotesContext);
}

/** Block-ish tags that should insert a newline between adjacent text runs. */
const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "LI",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "BLOCKQUOTE",
  "PRE",
  "TR",
  "BR",
]);

type TextPoint = {
  readonly node: Text;
  readonly offset: number;
};

/**
 * Flatten visible text under `root`, inserting `\n` between block boundaries
 * so cross-paragraph selections still match `findQuoteSpan`.
 *
 * `points[i]` is the DOM location of `text[i]`, or null for a synthetic
 * newline that exists only in the flattened string.
 */
export function collectRenderedText(root: HTMLElement): {
  readonly text: string;
  readonly points: ReadonlyArray<TextPoint | null>;
} {
  const points: Array<TextPoint | null> = [];
  let text = "";
  let pendingBreak = false;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL);
  let node: Node | null = walker.currentNode;
  // Skip the root itself; walk descendants.
  node = walker.nextNode();

  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tag = el.tagName;
      if (BLOCK_TAGS.has(tag)) {
        pendingBreak = true;
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      // Skip the floating Save quote control so its label is not matched.
      if (
        textNode.parentElement?.closest(
          "[data-slot='aui_quote-save-control']",
        )
      ) {
        node = walker.nextNode();
        continue;
      }
      const value = textNode.data;
      if (value.length > 0) {
        if (pendingBreak && text.length > 0) {
          // Synthetic break — keeps text/points indexes aligned.
          text += "\n";
          points.push(null);
          pendingBreak = false;
        } else {
          pendingBreak = false;
        }
        for (let i = 0; i < value.length; i += 1) {
          points.push({ node: textNode, offset: i });
          text += value[i]!;
        }
      }
    }
    node = walker.nextNode();
  }

  return { text, points };
}

/** Build a DOM Range covering `[start, end)` in the flattened rendered text. */
export function rangeFromRenderedSpan(
  points: ReadonlyArray<TextPoint | null>,
  start: number,
  end: number,
): Range | null {
  if (start < 0 || end <= start || end > points.length) return null;

  let startPoint: TextPoint | null = null;
  for (let i = start; i < end; i += 1) {
    const point = points[i];
    if (point) {
      startPoint = point;
      break;
    }
  }

  let endPoint: TextPoint | null = null;
  for (let i = end - 1; i >= start; i -= 1) {
    const point = points[i];
    if (point) {
      endPoint = point;
      break;
    }
  }

  if (!startPoint || !endPoint) return null;

  try {
    const range = document.createRange();
    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset + 1);
    return range;
  } catch {
    return null;
  }
}
