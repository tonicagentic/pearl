"use client";

import { MarkdownContent } from "@/components/assistant-ui/elements/markdown-content";
import { useOptionalQuickPath } from "@/components/assistant-ui/elements/quick-path-context";
import { messageEnter } from "@/components/assistant-ui/elements/surfaces";
import { cn } from "@/lib/utils";

/** Renders session-free quick-path turns as normal chat bubbles. */
export function QuickTurnsOverlay() {
  const quick = useOptionalQuickPath();
  if (!quick) return null;
  const { turns, streamingText, isStreaming } = quick;
  if (turns.length === 0 && !streamingText) return null;

  return (
    <div
      data-slot="aui_quick-turns"
      className="mb-6 flex flex-col gap-y-6"
    >
      {turns.map((turn) =>
        turn.role === "user" ? (
          <div
            key={turn.id}
            data-role="user"
            className={cn(
              messageEnter,
              "grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 [&:where(>*)]:col-start-2",
            )}
          >
            <div className="bg-muted text-foreground rounded-xl px-4 py-2 wrap-break-word whitespace-pre-wrap">
              {turn.text}
            </div>
          </div>
        ) : (
          <div
            key={turn.id}
            data-role="assistant"
            className={cn(messageEnter, "px-2 text-[15px] leading-6")}
          >
            <MarkdownContent text={turn.text} />
          </div>
        ),
      )}
      {isStreaming && streamingText ? (
        <div
          data-role="assistant"
          className={cn(messageEnter, "px-2 text-[15px] leading-6")}
        >
          <MarkdownContent text={streamingText} />
        </div>
      ) : null}
      {isStreaming && !streamingText ? (
        <div className="text-muted-foreground px-2 text-sm">Thinking…</div>
      ) : null}
    </div>
  );
}
