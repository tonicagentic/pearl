"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BookmarkIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { useAuiState } from "@assistant-ui/react";

import { useCanvas } from "@/components/assistant-ui/elements/canvas-context";
import {
  collectRenderedText,
  rangeFromRenderedSpan,
  useChatQuotes,
} from "@/components/assistant-ui/elements/chat-quotes-context";
import {
  findQuoteSpan,
  MAX_QUOTE_LENGTH,
} from "@/lib/library/quote-text";
import type { LibraryQuoteDto } from "@/lib/db/library-quotes";
import { cn } from "@/lib/utils";

type SelectionAnchor = {
  readonly top: number;
  readonly left: number;
  readonly text: string;
};

/**
 * Wraps a settled assistant message body. When the user selects text inside
 * it, shows a floating Save quote control at the selection. Also paints
 * Library quote highlights for this message via CSS Custom Highlight.
 */
export function SaveQuoteSelection({
  children,
}: {
  readonly children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { chatId } = useCanvas();
  const messageId = useAuiState((s) => s.message.id);
  const running = useAuiState((s) => s.message.status?.type === "running");
  const chatQuotes = useChatQuotes();
  const messageQuotes = chatQuotes?.quotesByMessageId.get(messageId) ?? null;

  const [anchor, setAnchor] = useState<SelectionAnchor | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedTimerRef = useRef<number | null>(null);

  const clearAnchor = useCallback(() => {
    setAnchor(null);
    setError(null);
    setSaving(false);
  }, []);

  const captureSelection = useCallback(() => {
    if (running) {
      clearAnchor();
      return;
    }

    const root = rootRef.current;
    if (!root) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      clearAnchor();
      return;
    }

    const range = selection.getRangeAt(0);
    if (
      !root.contains(range.commonAncestorContainer) ||
      !root.contains(range.startContainer) ||
      !root.contains(range.endContainer)
    ) {
      clearAnchor();
      return;
    }

    const text = selection.toString().trim();
    if (!text || text.length > MAX_QUOTE_LENGTH) {
      clearAnchor();
      return;
    }

    const rect = range.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      clearAnchor();
      return;
    }

    setSaved(false);
    setError(null);
    setAnchor({
      text,
      top: rect.top - rootRect.top - 36,
      left: Math.min(
        Math.max(rect.left - rootRect.left + rect.width / 2, 48),
        rootRect.width - 48,
      ),
    });
  }, [clearAnchor, running]);

  useEffect(() => {
    if (running) clearAnchor();
  }, [clearAnchor, running]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current !== null) {
        window.clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        // Keep the button visible until the user clicks away or saves —
        // selectionchange fires during button mousedown.
        return;
      }
      const root = rootRef.current;
      if (!root) return;
      if (
        selection.anchorNode &&
        selection.focusNode &&
        root.contains(selection.anchorNode) &&
        root.contains(selection.focusNode)
      ) {
        return;
      }
      clearAnchor();
    };

    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, [clearAnchor]);

  // Paint saved-quote highlights after the markdown DOM settles.
  useLayoutEffect(() => {
    if (!chatQuotes) return;

    if (running || !messageQuotes || messageQuotes.length === 0) {
      chatQuotes.setMessageRanges(messageId, []);
      return;
    }

    const root = rootRef.current;
    if (!root) {
      chatQuotes.setMessageRanges(messageId, []);
      return;
    }

    const { text, points } = collectRenderedText(root);
    const ranges: Range[] = [];
    const used = new Set<string>();

    for (const quote of messageQuotes) {
      const span = findQuoteSpan(text, quote.text);
      if (!span) continue;
      const key = `${span.start}:${span.end}`;
      if (used.has(key)) continue;
      used.add(key);
      const range = rangeFromRenderedSpan(points, span.start, span.end);
      if (range) ranges.push(range);
    }

    chatQuotes.setMessageRanges(messageId, ranges);

    return () => {
      chatQuotes.setMessageRanges(messageId, []);
    };
  }, [chatQuotes, messageId, messageQuotes, running]);

  const saveQuote = useCallback(async () => {
    if (!anchor || saving || saved) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: anchor.text,
          chatId,
          messageId,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "Failed to save quote.");
        setSaving(false);
        return;
      }

      const data = (await response.json()) as { quote?: LibraryQuoteDto };
      if (data.quote) {
        chatQuotes?.addQuote(data.quote);
      }

      setSaving(false);
      setSaved(true);
      if (savedTimerRef.current !== null) {
        window.clearTimeout(savedTimerRef.current);
      }
      savedTimerRef.current = window.setTimeout(() => {
        clearAnchor();
        setSaved(false);
      }, 1400);
    } catch {
      setSaving(false);
      setError("Failed to save quote.");
    }
  }, [anchor, chatId, chatQuotes, clearAnchor, messageId, saved, saving]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseUp={() => {
        // Defer so the browser finishes updating the selection.
        window.requestAnimationFrame(captureSelection);
      }}
    >
      {children}
      {anchor ? (
        <div
          data-slot="aui_quote-save-control"
          className="absolute z-40 -translate-x-1/2"
          style={{ top: anchor.top, left: anchor.left }}
        >
          <button
            type="button"
            className={cn(
              "bg-popover text-popover-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shadow-md",
              "hover:bg-accent hover:text-accent-foreground",
              "disabled:opacity-70",
            )}
            onMouseDown={(event) => {
              // Keep the selection so click can read the saved text.
              event.preventDefault();
            }}
            onClick={() => {
              void saveQuote();
            }}
            disabled={saving || saved}
          >
            {saving ? (
              <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
            ) : saved ? (
              <CheckIcon className="size-3.5" aria-hidden />
            ) : (
              <BookmarkIcon className="size-3.5" aria-hidden />
            )}
            {saving ? "Saving…" : saved ? "Saved" : "Save quote"}
          </button>
          {error ? (
            <div className="text-destructive mt-1 max-w-48 text-center text-[11px]">
              {error}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
