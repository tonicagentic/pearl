import { useEffect, useMemo, useRef, useState, type FC } from "react";
import { Text, View, type TextProps, type TextStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { cn } from "@/lib/utils";
import {
  STREAM_BLUR,
  STREAM_EASE,
  STREAM_FADE_MS,
  useMotion,
} from "./surfaces";

/**
 * Show every word the model has already produced. When motion is on, only the
 * newest word fades in; the rest stay as plain Text so a fast model is not
 * held behind a typewriter drip.
 */
export const StreamingText: FC<
  TextProps & {
    readonly text: string;
    readonly streaming?: boolean;
  }
> = ({ text, streaming = false, className, style, ...props }) => {
  const motion = useMotion();
  const parts = useMemo(() => {
    const trimmed = text.replace(/\s+$/, "");
    if (!trimmed) return [] as string[];
    return trimmed.split(/(\s+)/).filter((part) => part.length > 0);
  }, [text]);

  const wordIndices = useMemo(
    () =>
      parts
        .map((part, index) => ({ part, index }))
        .filter(({ part }) => /\S/.test(part))
        .map(({ index }) => index),
    [parts],
  );
  const wordCount = wordIndices.length;

  const [revealedWords, setRevealedWords] = useState(wordCount);
  const prevCountRef = useRef(wordCount);

  useEffect(() => {
    // Tokens as they arrive: jump to the full received word count.
    if (wordCount !== prevCountRef.current) {
      prevCountRef.current = wordCount;
      setRevealedWords(wordCount);
    }
  }, [wordCount]);

  useEffect(() => {
    if (!streaming) {
      setRevealedWords(wordCount);
      prevCountRef.current = wordCount;
    }
  }, [streaming, wordCount]);

  if (!motion || !streaming) {
    return (
      <Text className={className} style={style} {...props}>
        {text}
      </Text>
    );
  }

  const safeRevealed = Math.min(revealedWords, wordCount);
  const animatingOrder = safeRevealed - 1;
  const settledThroughPart =
    animatingOrder > 0 ? (wordIndices[animatingOrder - 1] ?? -1) : -1;
  const animatingPartIndex =
    animatingOrder >= 0 ? (wordIndices[animatingOrder] ?? -1) : -1;

  const settledText =
    settledThroughPart >= 0
      ? parts.slice(0, settledThroughPart + 1).join("")
      : "";
  const animatingWord =
    animatingPartIndex >= 0 ? (parts[animatingPartIndex] ?? "") : "";
  const spaceAfter =
    animatingPartIndex >= 0 &&
    animatingPartIndex + 1 < parts.length &&
    !/\S/.test(parts[animatingPartIndex + 1] ?? "")
      ? (parts[animatingPartIndex + 1] ?? "")
      : "";

  return (
    <View className={cn("flex-row flex-wrap items-baseline")}>
      {settledText ? (
        <Text className={className} style={style} {...props}>
          {settledText}
        </Text>
      ) : null}
      {animatingWord ? (
        <StreamWord
          key={`w-${animatingPartIndex}-${animatingOrder}`}
          word={animatingWord}
          className={className}
          style={style as TextStyle}
          textProps={props}
        />
      ) : null}
      {spaceAfter ? (
        <Text className={className} style={style} {...props}>
          {spaceAfter}
        </Text>
      ) : null}
    </View>
  );
};

function StreamWord({
  word,
  className,
  style,
  textProps,
}: {
  readonly word: string;
  readonly className?: string;
  readonly style?: TextStyle;
  readonly textProps: TextProps;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: STREAM_FADE_MS,
      easing: STREAM_EASE,
    });
  }, [word, progress]);

  // CSS `filter: blur` → RN stand-in: opacity + slight Y (same ease/duration).
  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * (STREAM_BLUR + 2) },
    ],
  }));

  return (
    <Animated.View style={animStyle}>
      <Text className={className} style={style} {...textProps}>
        {word}
      </Text>
    </Animated.View>
  );
}
