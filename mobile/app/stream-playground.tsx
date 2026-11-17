import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack, router } from "expo-router";
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
} from "@assistant-ui/react-native";
import { ChevronLeftIcon } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { TimelineDurationEventsProvider } from "@/components/assistant-ui/elements/session-timeline";
import { ConversationProvider } from "@/src/conversation-context";
import { toThreadMessages } from "@/src/eve-transport";
import { Icon } from "@/components/ui/icon";
import {
  STREAM_PLAY_SCENARIOS,
  conversationAt,
  eventTypeAt,
  rebaseEvents,
  streamPlayScenario,
  type StreamPlayScenarioId,
} from "@/src/stream-playground";

type Speed = 0.5 | 1 | 2;

function leavePlayground() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

function ControlPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`rounded-full border px-3 py-1.5 ${
        active
          ? "border-foreground bg-foreground"
          : "border-border bg-background"
      }`}
    >
      <Text
        className={`text-xs font-medium ${
          active ? "text-background" : "text-foreground"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Dev stream playback — open from Settings (__DEV__ / unlocked) or
 * pearl:///stream-playground. Replays timed v27 fixtures through
 * conversationOf + toThreadMessages into the real Thread.
 */
export default function StreamPlaygroundScreen() {
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;

  const [scenarioId, setScenarioId] =
    useState<StreamPlayScenarioId>("reasoning-tools");
  const scenario = streamPlayScenario(scenarioId);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [replayEpochMs, setReplayEpochMs] = useState<number>(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bump to remount playback state when the scenario changes (avoids
  // setState-in-effect when switching pills).
  const [playbackKey, setPlaybackKey] = useState(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const selectScenario = useCallback((id: StreamPlayScenarioId) => {
    clearTimer();
    setScenarioId(id);
    setIndex(0);
    setPlaying(false);
    setReplayEpochMs(Date.now());
    setPlaybackKey((key) => key + 1);
  }, [clearTimer]);

  const restart = useCallback(() => {
    clearTimer();
    setIndex(0);
    setPlaying(false);
    setReplayEpochMs(Date.now());
    setPlaybackKey((key) => key + 1);
  }, [clearTimer]);

  useEffect(() => {
    clearTimer();
    if (!playing) return undefined;
    if (index >= scenario.events.length) {
      // Schedule stop so we don't setState synchronously in this effect body.
      timerRef.current = setTimeout(() => setPlaying(false), 0);
      return clearTimer;
    }
    const current = scenario.events[index]!;
    const next = scenario.events[index + 1];
    const delayMs = next
      ? Math.max(16, (next.atMs - current.atMs) / speed)
      : 400 / speed;
    timerRef.current = setTimeout(() => {
      setIndex((prev) => Math.min(prev + 1, scenario.events.length));
    }, delayMs);
    return clearTimer;
  }, [clearTimer, index, playbackKey, playing, scenario.events, speed]);

  const conversation = useMemo(
    () => conversationAt(scenario.events, index, replayEpochMs),
    [index, replayEpochMs, scenario.events],
  );
  const isRunning =
    index > 0 &&
    index < scenario.events.length &&
    conversation.messages.some(
      (message) =>
        message.role === "assistant" && message.metadata?.status === "streaming",
    );
  const messages = useMemo(
    () => toThreadMessages(conversation, { isRunning }),
    [conversation, isRunning],
  );
  const playedEvents = useMemo(
    () => rebaseEvents(scenario.events.slice(0, index), replayEpochMs),
    [index, replayEpochMs, scenario.events],
  );

  const adapter = useMemo(
    () => ({
      messages: [...messages],
      convertMessage: (message: (typeof messages)[number]) => message,
      isRunning,
      isDisabled: true,
      isSendDisabled: true,
      onNew: async () => {
        /* playback is read-only */
      },
    }),
    [isRunning, messages],
  );
  const runtime = useExternalStoreRuntime(adapter);

  const phaseLabel =
    index === 0
      ? "ready"
      : index >= scenario.events.length
        ? "settled"
        : eventTypeAt(scenario.events, index - 1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "Stream playground",
          headerShown: true,
          headerBackVisible: false,
          headerTintColor: foregroundColor,
          headerStyle: backgroundColor
            ? { backgroundColor }
            : undefined,
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={12}
              onPress={leavePlayground}
              className="size-10 items-center justify-center"
            >
              <Icon as={ChevronLeftIcon} className="size-6 text-foreground" />
            </Pressable>
          ),
        }}
      />

      <View className="gap-2 border-b border-border/60 px-3 py-2">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2"
        >
          {STREAM_PLAY_SCENARIOS.map((entry) => (
            <ControlPill
              key={entry.id}
              label={entry.title}
              active={entry.id === scenarioId}
              onPress={() => selectScenario(entry.id)}
            />
          ))}
        </ScrollView>
        <Text className="text-xs text-muted-foreground">
          {scenario.description}
        </Text>
        <View className="flex-row flex-wrap items-center gap-2">
          <ControlPill
            label={playing ? "Pause" : "Play"}
            active={playing}
            onPress={() => {
              if (index === 0 || index >= scenario.events.length) {
                setIndex(0);
                setReplayEpochMs(Date.now());
                setPlaybackKey((key) => key + 1);
                setPlaying(true);
                return;
              }
              setPlaying((prev) => !prev);
            }}
          />
          <ControlPill label="Restart" onPress={restart} />
          <ControlPill
            label="Step +1"
            onPress={() => {
              clearTimer();
              setPlaying(false);
              if (index === 0) setReplayEpochMs(Date.now());
              setIndex((prev) =>
                Math.min(prev + 1, scenario.events.length),
              );
            }}
          />
          {([0.5, 1, 2] as const).map((value) => (
            <ControlPill
              key={value}
              label={`${value}x`}
              active={speed === value}
              onPress={() => setSpeed(value)}
            />
          ))}
        </View>
        <Text className="font-mono text-[11px] text-muted-foreground">
          {phaseLabel} · {index} / {scenario.events.length}
        </Text>
      </View>

      <ConversationProvider
        conversation={{
          messages: conversation.messages,
          agents: conversation.agents,
        }}
        waitKind={null}
      >
        <TimelineDurationEventsProvider events={playedEvents}>
          <AssistantRuntimeProvider runtime={runtime}>
            <Thread autoFocus={false} />
          </AssistantRuntimeProvider>
        </TimelineDurationEventsProvider>
      </ConversationProvider>
    </SafeAreaView>
  );
}
