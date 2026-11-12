import { useEffect, useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import {
  assistantTextFromParts,
  useBatchedStreamText,
} from "@/src/stream-paint";
import { isStreamProbeEnabled, traceStream } from "@/src/stream-trace";

type ProbeMessage = {
  role: string;
  content?: string | readonly { type: string; text?: string }[];
};

/**
 * Dev-only overlay: plain Text of the live assistant string, batched ~40 ms,
 * with no markdown, timeline, or animated scroll. Enable with
 * EXPO_PUBLIC_STREAM_PROBE=1 (and EXPO_PUBLIC_STREAM_TRACE=1 for timings).
 */
export function StreamProbe({
  messages,
  isRunning,
}: {
  readonly messages: readonly ProbeMessage[];
  readonly isRunning: boolean;
}) {
  if (!isStreamProbeEnabled()) return null;
  return <StreamProbeInner messages={messages} isRunning={isRunning} />;
}

function StreamProbeInner({
  messages,
  isRunning,
}: {
  readonly messages: readonly ProbeMessage[];
  readonly isRunning: boolean;
}) {
  const background = useCSSVariable("--color-background") ?? "#fff";
  const foreground = useCSSVariable("--color-foreground") ?? "#111";
  const muted = useCSSVariable("--color-muted-foreground") ?? "#666";

  const sourceText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message?.role !== "assistant") continue;
      const content = message.content;
      if (typeof content === "string") return content;
      return assistantTextFromParts(content);
    }
    return "";
  }, [messages]);

  const painted = useBatchedStreamText(sourceText, isRunning);

  useEffect(() => {
    if (sourceText.length > 0) {
      traceStream(
        "source",
        sourceText.length,
        Math.max(0, sourceText.length - painted.length),
      );
    }
  }, [sourceText, painted.length]);

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        right: 8,
        bottom: 120,
        left: 8,
        maxHeight: 180,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: muted,
        backgroundColor: background,
        opacity: 0.94,
        padding: 10,
        zIndex: 50,
      }}
    >
      <Text style={{ color: muted, fontSize: 11, marginBottom: 6 }}>
        stream probe · plain text · ~40ms flush
        {isRunning ? " · running" : ""}
      </Text>
      <ScrollView>
        <Text selectable style={{ color: foreground, fontSize: 13, lineHeight: 18 }}>
          {painted || (isRunning ? "…" : "(no assistant text)")}
        </Text>
      </ScrollView>
    </View>
  );
}
