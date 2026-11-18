import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import {
  liveVoiceStatusLabel,
  type LiveVoiceMode,
} from "@/src/live-media";

export type LiveVoiceOrbSize = "stage" | "compact";

const SIZE = {
  stage: { core: 248, minHeight: 280, labelTop: 28, labelSize: 16 },
  compact: { core: 40, minHeight: 40, labelTop: 0, labelSize: 13 },
} as const;

function modeAccent(mode: LiveVoiceMode): string {
  switch (mode) {
    case "speaking":
      return "#5B8CFF";
    case "listening":
      return "#7EB6FF";
    case "working":
      return "#6A9BFF";
    case "muted":
      return "#9AA3B2";
    case "connecting":
      return "#B7C7E8";
    default:
      return "#8EB6FF";
  }
}

export function LiveVoiceOrb({
  mode,
  level,
  size = "stage",
  showLabel = true,
}: {
  readonly mode: LiveVoiceMode;
  readonly level: number;
  readonly size?: LiveVoiceOrbSize;
  readonly showLabel?: boolean;
}) {
  const breath = useSharedValue(0);
  const drift = useSharedValue(0);
  const energy = useSharedValue(0);
  const boost = useSharedValue(0.04);
  const baseOpacity = useSharedValue(0.96);
  const active =
    mode === "listening" || mode === "speaking" || mode === "working";
  const dim = SIZE[size];
  const stage = size === "stage";

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: active ? 1400 : 2800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [active, breath]);

  useEffect(() => {
    drift.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [drift]);

  useEffect(() => {
    energy.value = withTiming(Math.min(1, Math.max(0, level)), {
      duration: 90,
      easing: Easing.out(Easing.quad),
    });
  }, [energy, level]);

  useEffect(() => {
    boost.value = withTiming(
      mode === "speaking" ? 0.14 : mode === "listening" ? 0.09 : 0.03,
      { duration: 220 },
    );
    baseOpacity.value = withTiming(
      mode === "ended" ? 0.4 : mode === "connecting" ? 0.72 : mode === "muted" ? 0.55 : 0.98,
      { duration: 220 },
    );
  }, [baseOpacity, boost, mode]);

  const coreStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale:
          1 +
          boost.value +
          energy.value * (stage ? 0.12 : 0.28) +
          breath.value * (boost.value > 0.05 ? 0.05 : 0.02),
      },
    ],
    opacity: baseOpacity.value,
  }));

  const blobA = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(drift.value, [0, 1], [-18, 22]) },
      { translateY: interpolate(breath.value, [0, 1], [-14, 16]) },
      { scale: 1.05 + energy.value * 0.18 + breath.value * 0.08 },
    ],
    opacity: interpolate(breath.value, [0, 1], [0.85, 0.55]),
  }));

  const blobB = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(drift.value, [0, 1], [20, -16]) },
      { translateY: interpolate(breath.value, [0, 1], [18, -12]) },
      { scale: 1.1 + energy.value * 0.22 + breath.value * 0.1 },
    ],
    opacity: interpolate(breath.value, [0, 1], [0.7, 0.95]),
  }));

  const blobC = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(drift.value, [0, 1], [-8, 12]) },
      { translateY: interpolate(breath.value, [0, 1], [10, -18]) },
      { scale: 0.95 + energy.value * 0.15 },
    ],
    opacity: interpolate(breath.value, [0, 1], [0.45, 0.75]),
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1.08 + breath.value * 0.06 + energy.value * 0.1 }],
    opacity: interpolate(breath.value, [0, 1], stage ? [0.35, 0.18] : [0.2, 0.08]),
  }));

  const tint = modeAccent(mode);
  const coreBox = { width: dim.core, height: dim.core, borderRadius: 999 };

  if (!stage) {
    return (
      <View
        accessibilityRole="image"
        accessibilityLabel={liveVoiceStatusLabel(mode)}
        style={[styles.wrap, { minHeight: dim.minHeight }]}
        pointerEvents="none"
      >
        <Animated.View style={[styles.compactRing, coreBox, { borderColor: tint }, glowStyle]} />
        <Animated.View style={[styles.compactCore, coreBox, { backgroundColor: tint }, coreStyle]} />
      </View>
    );
  }

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={liveVoiceStatusLabel(mode)}
      style={[styles.wrap, { minHeight: dim.minHeight }]}
      pointerEvents="none"
    >
      <Animated.View style={[styles.glow, coreBox, { backgroundColor: tint }, glowStyle]} />
      <Animated.View style={[styles.stageClip, coreBox, coreStyle]}>
        <View style={[StyleSheet.absoluteFill, styles.stageBase]} />
        <Animated.View
          style={[
            styles.blob,
            {
              width: dim.core * 0.78,
              height: dim.core * 0.78,
              borderRadius: dim.core,
              backgroundColor: "#2F6BFF",
              top: dim.core * 0.02,
              left: dim.core * 0.08,
            },
            blobA,
          ]}
        />
        <Animated.View
          style={[
            styles.blob,
            {
              width: dim.core * 0.7,
              height: dim.core * 0.7,
              borderRadius: dim.core,
              backgroundColor: "#A9C8FF",
              bottom: dim.core * 0.02,
              right: dim.core * 0.04,
            },
            blobB,
          ]}
        />
        <Animated.View
          style={[
            styles.blob,
            {
              width: dim.core * 0.55,
              height: dim.core * 0.55,
              borderRadius: dim.core,
              backgroundColor: "#F4F8FF",
              top: dim.core * 0.32,
              left: dim.core * 0.28,
            },
            blobC,
          ]}
        />
        <Animated.View
          style={[
            styles.blob,
            {
              width: dim.core * 0.42,
              height: dim.core * 0.42,
              borderRadius: dim.core,
              backgroundColor: "#6B9BFF",
              top: dim.core * 0.1,
              right: dim.core * 0.12,
            },
            blobA,
          ]}
        />
        <BlurView intensity={42} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.stageSheen]} />
      </Animated.View>
      {showLabel ? (
        <Text style={[styles.label, { marginTop: dim.labelTop, fontSize: dim.labelSize }]}>
          {liveVoiceStatusLabel(mode)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    opacity: 0.25,
  },
  stageClip: {
    overflow: "hidden",
    shadowColor: "#6B9BFF",
    shadowOpacity: 0.35,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 8 },
  },
  stageBase: {
    backgroundColor: "#DCE8FF",
  },
  stageSheen: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  blob: {
    position: "absolute",
  },
  compactCore: {
    shadowColor: "#9EC7FF",
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  compactRing: {
    position: "absolute",
    borderWidth: 2,
  },
  label: {
    color: "rgba(0,0,0,0.45)",
    fontWeight: "500",
    letterSpacing: 0.2,
  },
});
