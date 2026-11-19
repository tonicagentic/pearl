"use client";

import { useChatShell } from "@/app/_components/chat-shell-context";
import type { SuggestedPrompt } from "@/lib/chat/suggested-prompts";
import { AuiIf, ThreadPrimitive } from "@assistant-ui/react";
import {
  ClapperboardIcon,
  CompassIcon,
  ImageIcon,
  LightbulbIcon,
  MessageCircleIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type FC } from "react";

let cachedPrompts: readonly SuggestedPrompt[] = [];

const SUGGESTION_ICONS: readonly LucideIcon[] = [
  SparklesIcon,
  ImageIcon,
  ClapperboardIcon,
  LightbulbIcon,
  MessageCircleIcon,
  CompassIcon,
];

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

  if (!viewer || !ready || prompts.length === 0) {
    return null;
  }

  // Grok-style: a short left-aligned vertical stack above the composer.
  const visible = prompts.slice(0, 3);

  return (
    <div className="aui-thread-suggested-prompts fade-in slide-in-from-bottom-2 animate-in flex w-full flex-col items-start gap-2.5 fill-mode-both duration-200">
      {visible.map((suggestion, index) => {
        const Glyph = SUGGESTION_ICONS[index % SUGGESTION_ICONS.length]!;
        return (
          <ThreadPrimitive.Suggestion
            key={suggestion.prompt}
            className="aui-thread-suggested-prompt text-muted-foreground hover:bg-muted/70 inline-flex max-w-full items-center gap-2.5 rounded-full bg-muted px-3.5 py-2.5 text-[15px] leading-5 transition-colors ease-in"
            prompt={suggestion.prompt}
            send
          >
            <Glyph className="text-foreground/70 size-4 shrink-0" aria-hidden />
            <span className="truncate">{suggestion.title}</span>
          </ThreadPrimitive.Suggestion>
        );
      })}
    </div>
  );
};

/** Personalized starter chips above the composer on an empty new chat. */
export const ThreadSuggestedPrompts: FC = () => (
  <AuiIf
    condition={(s) =>
      s.thread.messages.length === 0 &&
      (!s.thread.isLoading || s.threads.isLoading)
    }
  >
    <SuggestedPromptsRow />
  </AuiIf>
);
