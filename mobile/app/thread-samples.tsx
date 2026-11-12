import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Stack } from "expo-router";
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { ToolFallback } from "@/components/assistant-ui/elements/tool-fallback";
import { TimelineDurationEventsProvider } from "@/components/assistant-ui/elements/session-timeline";
import {
  THREAD_SAMPLES,
  threadSample,
  type ThreadSampleId,
} from "@/src/thread-samples";

/** Dev-only ToolFallback that always offers Allow/Deny for parked fixtures. */
function SampleToolFallback(props: ToolCallMessagePartProps) {
  const respondToApproval =
    props.respondToApproval ??
    (async () => {
      /* fixture — no session to continue */
    });
  return <ToolFallback {...props} respondToApproval={respondToApproval} />;
}

/**
 * Dev smoke for thread item styling — open from Samples in the home list,
 * or via pearl:///thread-samples. Never writes to /api/chats.
 */
export default function ThreadSamplesScreen() {
  const [sampleId, setSampleId] = useState<ThreadSampleId>("one-read");
  const sample = threadSample(sampleId);
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;

  const adapter = useMemo(
    () => ({
      messages: [...sample.messages],
      convertMessage: (message: (typeof sample.messages)[number]) => message,
      isRunning: false,
      isDisabled: true,
      isSendDisabled: true,
      onNew: async () => {
        /* samples are read-only */
      },
    }),
    [sample],
  );
  const runtime = useExternalStoreRuntime(adapter);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "Thread samples",
          headerShown: true,
          headerTintColor: foregroundColor,
        }}
      />
      <View className="border-border/60 flex-row flex-wrap gap-2 border-b px-4 py-3">
        {THREAD_SAMPLES.map((entry) => {
          const selected = entry.id === sampleId;
          return (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className={
                selected
                  ? "bg-foreground rounded-full px-3.5 py-2"
                  : "bg-muted rounded-full px-3.5 py-2"
              }
              onPress={() => setSampleId(entry.id)}
            >
              <Text
                className={
                  selected
                    ? "text-background text-sm font-medium"
                    : "text-foreground text-sm font-medium"
                }
              >
                {entry.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <TimelineDurationEventsProvider events={sample.durationEvents}>
        <AssistantRuntimeProvider runtime={runtime}>
          <Thread
            autoFocus={false}
            chromeRevealed
            conversationId={`sample:${sample.id}`}
            components={{ ToolFallback: SampleToolFallback }}
          />
        </AssistantRuntimeProvider>
      </TimelineDurationEventsProvider>
    </SafeAreaView>
  );
}
