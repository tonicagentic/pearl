"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { convertEveMessages } from "@assistant-ui/eve";

import { CanvasProvider } from "@/components/assistant-ui/elements/canvas-context";
import {
  SubagentRunsProvider,
  TaskGroup,
} from "@/components/assistant-ui/elements/task-card.aui";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { cn } from "@/lib/utils";
import {
  GALLERY_MESSAGES,
  WEB_REPLAY_SCENARIOS,
  conversationAt,
  rebaseEvents,
  webReplayScenario,
  type WebReplayScenarioId,
} from "./fixtures";

type Mode = "gallery" | "replay";
type WidthPreset = "mobile" | "thread" | "full";
type Speed = 0.5 | 1 | 2;

function ControlButton({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Dev-only web inspector workbench for tuning message thread UI components.
 * Visit /dev/thread-inspector — renders the real Thread with live CSS/DOM.
 */
export default function ThreadInspectorPage() {
  if (process.env.NODE_ENV === "production") {
    return <p className="p-6 text-sm">Not available in production.</p>;
  }
  return <ThreadInspectorWorkbench />;
}

function ThreadInspectorWorkbench() {
  const [mode, setMode] = useState<Mode>("gallery");
  const [widthPreset, setWidthPreset] = useState<WidthPreset>("thread");
  const [dark, setDark] = useState(false);

  const [scenarioId, setScenarioId] =
    useState<WebReplayScenarioId>("reasoning-tools");
  const scenario = webReplayScenario(scenarioId);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  // 0 until mount — Date.now() in useState blocks Cache Components prerender.
  const [replayEpochMs, setReplayEpochMs] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setReplayEpochMs(Date.now());
  }, []);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      const root = document.documentElement;
      root.classList.remove("dark", "light");
      root.classList.add(next ? "dark" : "light");
      root.style.colorScheme = next ? "dark" : "light";
      return next;
    });
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearTimer();
    if (mode !== "replay" || !playing) return undefined;
    if (index >= scenario.events.length) {
      timerRef.current = window.setTimeout(() => setPlaying(false), 0);
      return clearTimer;
    }
    const current = scenario.events[index]!;
    const next = scenario.events[index + 1];
    const delayMs = next
      ? Math.max(16, (next.atMs - current.atMs) / speed)
      : 400 / speed;
    timerRef.current = window.setTimeout(() => {
      setIndex((prev) => Math.min(prev + 1, scenario.events.length));
    }, delayMs);
    return clearTimer;
  }, [clearTimer, index, mode, playing, scenario.events, speed]);

  const conversation = useMemo(
    () => conversationAt(scenario.events, index, replayEpochMs),
    [index, replayEpochMs, scenario.events],
  );
  const replayRunning =
    mode === "replay" &&
    index > 0 &&
    index < scenario.events.length &&
    conversation.messages.some(
      (m) => m.role === "assistant" && m.metadata?.status === "streaming",
    );

  const replayMessages = useMemo(() => {
    const events = rebaseEvents(scenario.events.slice(0, index), replayEpochMs);
    return convertEveMessages(conversation, {
      isRunning: replayRunning,
      events,
    });
  }, [conversation, index, replayEpochMs, replayRunning, scenario.events]);

  const galleryRuntime = useExternalStoreRuntime({
    messages: GALLERY_MESSAGES,
    convertMessage: (message) => message,
    isRunning: true,
    isDisabled: false,
    onNew: async () => {},
  });

  const replayRuntime = useExternalStoreRuntime({
    messages: replayMessages,
    isRunning: replayRunning,
    isDisabled: false,
    onNew: async () => {},
  });

  const runtime = mode === "gallery" ? galleryRuntime : replayRuntime;
  const currentEvent =
    index === 0
      ? "ready"
      : index >= scenario.events.length
        ? "settled"
        : (scenario.events[index - 1]?.event.type ?? "—");

  return (
    <div className="bg-background text-foreground flex h-dvh flex-col overflow-hidden">
      <header className="border-border/60 flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <span className="text-xs font-semibold tracking-tight">
          Thread Inspector
        </span>
        <div className="flex items-center gap-1">
          <ControlButton
            active={mode === "gallery"}
            onClick={() => {
              clearTimer();
              setPlaying(false);
              setMode("gallery");
            }}
          >
            Design Gallery
          </ControlButton>
          <ControlButton
            active={mode === "replay"}
            onClick={() => setMode("replay")}
          >
            Stream Replay
          </ControlButton>
        </div>

        <div className="bg-border/60 h-4 w-px" />

        <div className="flex items-center gap-1">
          {(
            [
              ["mobile", "390px"],
              ["thread", "680px"],
              ["full", "Full"],
            ] as const
          ).map(([preset, label]) => (
            <ControlButton
              key={preset}
              active={widthPreset === preset}
              onClick={() => setWidthPreset(preset)}
            >
              {label}
            </ControlButton>
          ))}
        </div>

        <ControlButton active={dark} onClick={toggleTheme}>
          {dark ? "Dark" : "Light"}
        </ControlButton>

        {mode === "replay" && (
          <>
            <div className="bg-border/60 h-4 w-px" />
            <div className="flex flex-wrap items-center gap-1">
              {WEB_REPLAY_SCENARIOS.map((entry) => (
                <ControlButton
                  key={entry.id}
                  active={entry.id === scenarioId}
                  onClick={() => {
                    clearTimer();
                    setPlaying(false);
                    setIndex(0);
                    setReplayEpochMs(Date.now());
                    setScenarioId(entry.id);
                  }}
                >
                  {entry.title}
                </ControlButton>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <ControlButton
                active={playing}
                onClick={() => {
                  if (index === 0 || index >= scenario.events.length) {
                    setIndex(0);
                    setReplayEpochMs(Date.now());
                    setPlaying(true);
                    return;
                  }
                  setPlaying((p) => !p);
                }}
              >
                {playing ? "Pause" : "Play"}
              </ControlButton>
              <ControlButton
                onClick={() => {
                  clearTimer();
                  setPlaying(false);
                  setIndex(0);
                  setReplayEpochMs(Date.now());
                }}
              >
                Restart
              </ControlButton>
              <ControlButton
                onClick={() => {
                  clearTimer();
                  setPlaying(false);
                  if (index === 0) setReplayEpochMs(Date.now());
                  setIndex((p) => Math.min(p + 1, scenario.events.length));
                }}
              >
                Step +1
              </ControlButton>
              {([0.5, 1, 2] as const).map((s) => (
                <ControlButton
                  key={s}
                  active={speed === s}
                  onClick={() => setSpeed(s)}
                >
                  {s}x
                </ControlButton>
              ))}
            </div>
            <span className="text-muted-foreground font-mono text-[11px]">
              {currentEvent} · {index}/{scenario.events.length}
            </span>
          </>
        )}
      </header>

      <div className="flex min-h-0 flex-1 justify-center overflow-hidden">
        <div
          className={cn(
            "flex min-h-0 w-full flex-col",
            widthPreset === "mobile" &&
              "border-border/60 max-w-[390px] border-x",
            widthPreset === "thread" && "max-w-[680px]",
          )}
        >
          <AssistantRuntimeProvider key={mode} runtime={runtime}>
            <CanvasProvider chatId={null}>
              <SubagentRunsProvider>
                <Thread components={{ TaskGroup }} />
              </SubagentRunsProvider>
            </CanvasProvider>
          </AssistantRuntimeProvider>
        </div>
      </div>
    </div>
  );
}
