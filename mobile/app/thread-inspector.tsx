import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, router } from "expo-router";
import {
  AssistantRuntimeProvider,
  useAui,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react-native";
import { ChevronLeftIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { ToolFallback } from "@/components/assistant-ui/elements/tool-fallback";
import { TimelineDurationEventsProvider } from "@/components/assistant-ui/elements/session-timeline";
import { ConversationProvider } from "@/src/conversation-context";
import { focusComposerInput } from "@/src/composer-input-focus";
import { toThreadMessages } from "@/src/eve-transport";
import { Icon } from "@/components/ui/icon";
import {
  threadSample,
  threadSamplesForGroup,
  type ThreadSampleId,
} from "@/src/thread-samples";
import {
  STREAM_PLAY_SCENARIOS,
  conversationAt,
  eventTypeAt,
  rebaseEvents,
  streamPlayScenario,
  type StreamPlayScenarioId,
} from "@/src/stream-playground";

type Mode = "samples" | "replay";
type WidthMode = "phone" | "full";
type Speed = 0.5 | 1 | 2;

const MULTILINE_DRAFT = [
  "Line one — collapsed pill should grow.",
  "Line two with a bit more text for the field.",
  "Line three keeps the same TextInput mounted.",
  "",
  "Final paragraph to push toward the expanded max height while typing stays smooth.",
].join("\n");

function leaveInspector() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

function SampleToolFallback(props: ToolCallMessagePartProps) {
  const respondToApproval =
    props.respondToApproval ??
    (async () => {
      /* fixture */
    });
  return <ToolFallback {...props} respondToApproval={respondToApproval} />;
}

function Pill({
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

/** Seeds the live composer after mount (Multiline pill). */
function ComposerDraftSeeder({
  draft,
  seedKey,
}: {
  readonly draft: string | null;
  readonly seedKey: number;
}) {
  const aui = useAui();
  useEffect(() => {
    if (draft == null || seedKey === 0) return;
    aui.composer.setText(draft);
    if (Platform.OS !== "ios") return;
    // Focus so the keyboard morph runs and content-size can measure full width.
    const timer = setTimeout(() => focusComposerInput(), 60);
    return () => clearTimeout(timer);
  }, [aui, draft, seedKey]);
  return null;
}

function appendMessageToLike(message: AppendMessage): ThreadMessageLike {
  return {
    role: "user",
    content: message.content,
  };
}

/**
 * Dev-only React Native Thread Inspector (runs on both Expo Web for DOM/CSS
 * DevTools inspection and iOS/Android simulators). Combines static component
 * samples (bubbles, timeline, markdown, HITL) and live v27 stream replay.
 * The composer is interactive in Samples mode for iOS keyboard/layout work.
 */
export default function ThreadInspectorScreen() {
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;

  const [mode, setMode] = useState<Mode>("samples");
  const [widthMode, setWidthMode] = useState<WidthMode>(
    Platform.OS === "web" ? "phone" : "full",
  );
  const [sampleId, setSampleId] = useState<ThreadSampleId>("empty");
  const sample = threadSample(sampleId);

  const [localMessages, setLocalMessages] = useState<ThreadMessageLike[]>(() => [
    ...sample.messages,
  ]);
  const [forceRunning, setForceRunning] = useState(false);
  const [draftSeed, setDraftSeed] = useState<string | null>(null);
  const [draftSeedKey, setDraftSeedKey] = useState(0);

  const [scenarioId, setScenarioId] =
    useState<StreamPlayScenarioId>("reasoning-tools");
  const scenario = streamPlayScenario(scenarioId);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [replayEpochMs, setReplayEpochMs] = useState<number>(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectSample = useCallback((id: ThreadSampleId) => {
    const next = threadSample(id);
    setSampleId(id);
    setLocalMessages([...next.messages]);
    setForceRunning(false);
    setDraftSeed(null);
    setDraftSeedKey(0);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearTimer();
    if (mode !== "replay" || !playing) return undefined;
    if (index >= scenario.events.length) {
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
      (message) =>
        message.role === "assistant" && message.metadata?.status === "streaming",
    );
  const playedEvents = useMemo(
    () => rebaseEvents(scenario.events.slice(0, index), replayEpochMs),
    [index, replayEpochMs, scenario.events],
  );
  const replayMessages = useMemo(
    () =>
      toThreadMessages(conversation, {
        isRunning: replayRunning,
        events: playedEvents,
      }),
    [conversation, playedEvents, replayRunning],
  );

  const hitlBlocksSend = sample.waitingAction != null;

  const sampleAdapter = useMemo(
    () => ({
      messages: localMessages,
      convertMessage: (message: ThreadMessageLike) => message,
      isRunning: forceRunning,
      isDisabled: false,
      isSendDisabled: hitlBlocksSend,
      onNew: async (message: AppendMessage) => {
        setLocalMessages((prev) => [...prev, appendMessageToLike(message)]);
        setForceRunning(true);
      },
      onCancel: async () => {
        setForceRunning(false);
      },
    }),
    [forceRunning, hitlBlocksSend, localMessages],
  );
  const replayAdapter = useMemo(
    () => ({
      messages: [...replayMessages],
      convertMessage: (message: (typeof replayMessages)[number]) => message,
      isRunning: replayRunning,
      isDisabled: false,
      // Keep the composer mounted for keyboard checks; do not rewrite steps.
      isSendDisabled: true,
      onNew: async () => {},
      onCancel: async () => {},
    }),
    [replayMessages, replayRunning],
  );

  const sampleRuntime = useExternalStoreRuntime(sampleAdapter);
  const replayRuntime = useExternalStoreRuntime(replayAdapter);
  const runtime = mode === "samples" ? sampleRuntime : replayRuntime;

  const waitingAction =
    mode === "samples" && sample.waitingAction
      ? sample.waitingAction.kind === "questions"
        ? {
            ...sample.waitingAction,
            onRespond: async () => {},
            onSkip: async () => {},
          }
        : {
            ...sample.waitingAction,
            onRespond: async () => {},
          }
      : null;

  const phaseLabel =
    index === 0
      ? "ready"
      : index >= scenario.events.length
        ? "settled"
        : eventTypeAt(scenario.events, index - 1);

  // Empty sample mirrors a new chat (null id → keyboard seed at zero).
  const conversationId =
    mode === "samples"
      ? sample.id === "empty" && localMessages.length === 0
        ? null
        : `sample:${sample.id}`
      : `replay:${scenario.id}`;

  const runtimeKey =
    mode === "samples" ? `samples:${sample.id}` : `replay:${scenario.id}`;

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <Stack.Screen
        options={{
          title: "RN Thread Inspector",
          headerShown: true,
          headerBackVisible: false,
          headerTintColor: foregroundColor,
          headerStyle: backgroundColor ? { backgroundColor } : undefined,
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={12}
              onPress={leaveInspector}
              className="size-10 items-center justify-center"
            >
              <Icon as={ChevronLeftIcon} className="size-6 text-foreground" />
            </Pressable>
          ),
        }}
      />

      <View
        className="gap-2 border-b border-border/60 px-3 py-2"
        style={{ backgroundColor, zIndex: 2, elevation: 2 }}
      >
        <View className="flex-row flex-wrap items-center gap-1.5">
          <Pill
            label="Samples"
            active={mode === "samples"}
            onPress={() => {
              clearTimer();
              setPlaying(false);
              setMode("samples");
            }}
          />
          <Pill
            label="Stream Replay"
            active={mode === "replay"}
            onPress={() => setMode("replay")}
          />
          {Platform.OS === "web" ? (
            <>
              <Pill
                label="390px"
                active={widthMode === "phone"}
                onPress={() => setWidthMode("phone")}
              />
              <Pill
                label="Full"
                active={widthMode === "full"}
                onPress={() => setWidthMode("full")}
              />
            </>
          ) : null}
        </View>

        {mode === "samples" ? (
          <View className="gap-1.5">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-1.5"
            >
              {threadSamplesForGroup("default").map((entry) => (
                <Pill
                  key={entry.id}
                  label={entry.label}
                  active={entry.id === sampleId}
                  onPress={() => selectSample(entry.id)}
                />
              ))}
            </ScrollView>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-1.5"
            >
              {threadSamplesForGroup("answer").map((entry) => (
                <Pill
                  key={entry.id}
                  label={entry.label}
                  active={entry.id === sampleId}
                  onPress={() => selectSample(entry.id)}
                />
              ))}
            </ScrollView>
            <View className="flex-row flex-wrap items-center gap-1.5">
              <Pill
                label="Running"
                active={forceRunning}
                onPress={() => setForceRunning((prev) => !prev)}
              />
              <Pill
                label="Multiline"
                onPress={() => {
                  setDraftSeed(MULTILINE_DRAFT);
                  setDraftSeedKey((key) => key + 1);
                }}
              />
              <Pill
                label="Reset"
                onPress={() => selectSample(sampleId)}
              />
              {sample.id !== "empty" ? (
                <Pill
                  label="Replay this sample"
                  onPress={() => {
                    clearTimer();
                    setPlaying(false);
                    setIndex(0);
                    setReplayEpochMs(Date.now());
                    setScenarioId(sampleId);
                    setMode("replay");
                    setPlaying(true);
                  }}
                />
              ) : null}
            </View>
          </View>
        ) : (
          <View className="gap-1.5">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-1.5"
            >
              {STREAM_PLAY_SCENARIOS.map((entry) => (
                <Pill
                  key={entry.id}
                  label={entry.title}
                  active={entry.id === scenarioId}
                  onPress={() => {
                    clearTimer();
                    setPlaying(false);
                    setIndex(0);
                    setReplayEpochMs(Date.now());
                    setScenarioId(entry.id);
                  }}
                />
              ))}
            </ScrollView>
            <View className="flex-row flex-wrap items-center gap-1.5">
              <Pill
                label={playing ? "Pause" : "Play"}
                active={playing}
                onPress={() => {
                  if (index === 0 || index >= scenario.events.length) {
                    setIndex(0);
                    setReplayEpochMs(Date.now());
                    setPlaying(true);
                    return;
                  }
                  setPlaying((p) => !p);
                }}
              />
              <Pill
                label="Restart"
                onPress={() => {
                  clearTimer();
                  setPlaying(false);
                  setIndex(0);
                  setReplayEpochMs(Date.now());
                }}
              />
              <Pill
                label="Step +1"
                onPress={() => {
                  clearTimer();
                  setPlaying(false);
                  if (index === 0) setReplayEpochMs(Date.now());
                  setIndex((p) => Math.min(p + 1, scenario.events.length));
                }}
              />
              {([0.5, 1, 2] as const).map((s) => (
                <Pill
                  key={s}
                  label={`${s}x`}
                  active={speed === s}
                  onPress={() => setSpeed(s)}
                />
              ))}
              <Text className="font-mono text-[11px] text-muted-foreground">
                {phaseLabel} · {index}/{scenario.events.length}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View className="flex-1 items-center">
        <View
          className={
            Platform.OS === "web" && widthMode === "phone"
              ? "w-full max-w-[390px] flex-1 border-x border-border/60"
              : "w-full flex-1"
          }
        >
          <ConversationProvider
            conversation={
              mode === "replay"
                ? {
                    messages: conversation.messages,
                    agents: conversation.agents,
                  }
                : { messages: [] }
            }
            waitKind={null}
          >
            <TimelineDurationEventsProvider
              events={mode === "replay" ? playedEvents : sample.durationEvents}
            >
              <AssistantRuntimeProvider key={runtimeKey} runtime={runtime}>
                {mode === "samples" ? (
                  <ComposerDraftSeeder
                    draft={draftSeed}
                    seedKey={draftSeedKey}
                  />
                ) : null}
                <Thread
                  autoFocus={false}
                  chromeRevealed
                  contentPaddingTop={16}
                  conversationId={conversationId}
                  components={{ ToolFallback: SampleToolFallback }}
                  waitingAction={waitingAction}
                />
              </AssistantRuntimeProvider>
            </TimelineDurationEventsProvider>
          </ConversationProvider>
        </View>
      </View>
    </View>
  );
}
