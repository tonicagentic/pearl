"use client";

import { memo } from "react";
import { useAuiState } from "@assistant-ui/react";

import { MarkdownContent } from "@/components/assistant-ui/elements/markdown-content";
import {
  STREAMING_TEXT_STYLES,
  StreamingTextCursorMark,
} from "@/components/StreamingText";
import { useStreamingReveal } from "@/lib/streaming-text-reveal";
import { cn } from "@/lib/utils";

/**
 * Assistant reply with Pearl's full markdown renderer, paced by the
 * StreamingText smoother (fade defaults / 20 wps / dot cursor). History
 * that mounts complete shows at once — no replay.
 */
export const StreamingMarkdownText = memo(function StreamingMarkdownText({
  className,
}: {
  readonly className?: string;
}) {
  const text = useAuiState((s) => {
    const part = s.part;
    return part.type === "text" ? (part.text ?? "") : "";
  });
  const streaming = useAuiState((s) => {
    const part = s.part;
    if (part.type !== "text") return false;
    const partStatus = part.status?.type;
    if (partStatus === "complete" || partStatus === "incomplete") return false;
    if (partStatus === "running") return true;
    // Missing part status: follow the turn so live replies still pace.
    return (
      s.message.role === "assistant" && s.message.status?.type === "running"
    );
  });

  const { visibleText, writing } = useStreamingReveal(text, streaming);

  return (
    <div
      className={cn("aui-streaming-md", className)}
      aria-busy={writing}
      data-slot="streaming-markdown-text"
    >
      <style>{STREAMING_TEXT_STYLES}</style>
      <MarkdownContent text={visibleText} />
      {writing ? (
        <p className="text-foreground/80 mt-0 mb-0">
          <StreamingTextCursorMark cursor="dot" />
        </p>
      ) : null}
    </div>
  );
});

/**
 * Props-driven variant for places that already hold `text` / `streaming`
 * (json-render segments, inspectors).
 */
export const StreamingMarkdownBody = memo(function StreamingMarkdownBody({
  text,
  streaming,
  className,
}: {
  readonly text: string;
  readonly streaming: boolean;
  readonly className?: string;
}) {
  const { visibleText, writing } = useStreamingReveal(text, streaming);

  return (
    <div
      className={cn("aui-streaming-md", className)}
      aria-busy={writing}
      data-slot="streaming-markdown-body"
    >
      <style>{STREAMING_TEXT_STYLES}</style>
      <MarkdownContent text={visibleText} />
      {writing ? (
        <p className="text-foreground/80 mt-0 mb-0">
          <StreamingTextCursorMark cursor="dot" />
        </p>
      ) : null}
    </div>
  );
});
