"use client";

import { useChatShell } from "@/app/_components/chat-shell-context";
import type { SuggestedPrompt } from "@/lib/chat/suggested-prompts";
import { AuiIf, ThreadPrimitive } from "@assistant-ui/react";
import { useCallback, useEffect, useRef, useState, type FC } from "react";

let cachedPrompts: readonly SuggestedPrompt[] = [];

async function fetchSuggestedPrompts(): Promise<readonly SuggestedPrompt[]> {
  const response = await fetch("/api/chat/suggested-prompts", {
    cache: "no-store",
  });
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as {
    prompts?: SuggestedPrompt[];
  };
  if (!Array.isArray(data.prompts)) {
    return [];
  }
  return data.prompts.filter(
    (item): item is SuggestedPrompt =>
      typeof item?.title === "string" &&
      typeof item?.prompt === "string" &&
      item.title.trim().length > 0 &&
      item.prompt.trim().length > 0,
  );
}

const SuggestedPromptsRow: FC = () => {
  const { viewer } = useChatShell();
  const [prompts, setPrompts] = useState<readonly SuggestedPrompt[]>(
    () => cachedPrompts,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const rtlRef = useRef<boolean | null>(null);
  const [fades, setFades] = useState({ left: false, right: false });
  const [ready, setReady] = useState(cachedPrompts.length > 0);

  useEffect(() => {
    if (!viewer) {
      cachedPrompts = [];
      setPrompts([]);
      setReady(false);
      return;
    }

    let cancelled = false;
    void fetchSuggestedPrompts().then((next) => {
      if (cancelled) return;
      cachedPrompts = next;
      setPrompts(next);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [viewer]);

  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const fromStart = Math.abs(el.scrollLeft);
    const rtl = (rtlRef.current ??= getComputedStyle(el).direction === "rtl");
    const [left, right] = rtl
      ? [maxScroll - fromStart, fromStart]
      : [fromStart, maxScroll - fromStart];
    setFades((prev) => {
      const next = { left: left > 1, right: right > 1 };
      return prev.left === next.left && prev.right === next.right ? prev : next;
    });
  }, []);

  useEffect(() => {
    updateFades();
    const el = scrollRef.current;
    if (!el?.firstElementChild) return undefined;
    const observer = new ResizeObserver(updateFades);
    observer.observe(el);
    observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [prompts, updateFades]);

  if (!viewer || !ready || prompts.length === 0) {
    return null;
  }

  const maskImage = `linear-gradient(to right, ${
    fades.left ? "transparent, black 2rem" : "black"
  }, ${fades.right ? "black calc(100% - 2rem), transparent" : "black"})`;

  return (
    <div
      ref={scrollRef}
      onScroll={updateFades}
      className="aui-thread-suggested-prompts fade-in slide-in-from-bottom-2 animate-in -my-1 w-full overflow-x-auto py-1 fill-mode-both duration-200 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ maskImage, WebkitMaskImage: maskImage }}
    >
      <div className="mx-auto flex min-h-8 w-max items-center gap-2 px-0.5">
        {prompts.map((suggestion) => (
          <ThreadPrimitive.Suggestion
            key={suggestion.prompt}
            className="aui-thread-suggested-prompt bg-background hover:bg-muted/80 rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors ease-in"
            prompt={suggestion.prompt}
            send
          >
            {suggestion.title}
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </div>
  );
};

/** Personalized starter chips above the composer on an empty new chat. */
export const ThreadSuggestedPrompts: FC = () => (
  <AuiIf condition={(s) => s.thread.messages.length === 0 && (!s.thread.isLoading || s.threads.isLoading)}>
    <SuggestedPromptsRow />
  </AuiIf>
);
