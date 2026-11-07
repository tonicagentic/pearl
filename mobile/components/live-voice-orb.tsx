import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
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

function modeAccent(mode: LiveVoiceMode): string {
  switch (mode) {
    case "speaking":
      return "#7EC8FF";
    case "listening":
      return "#9BE7C4";
    case "muted":
      return "#8A8A8A";
    default:
      return "#D7DEE8";
  }
}

export function LiveVoiceOrb({
  mode,
  level,
}: {
  readonly mode: LiveVoiceMode;
  readonly level: number;
}) {
  const breath = useSharedValue(0);
  const energy = useSharedValue(0);
  const boost = useSharedValue(0.04);
  const baseOpacity = useSharedValue(0.92);
  const active = mode === "listening" || mode === "speaking";

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: active ? 900 : 2400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [active, breath]);

  useEffect(() => {
    energy.value = withTiming(Math.min(1, Math.max(0, level)), {
      duration: 90,
      easing: Easing.out(Easing.quad),
    });
  }, [energy, level]);

  useEffect(() => {
    boost.value = withTiming(
      mode === "speaking" ? 0.18 : mode === "listening" ? 0.12 : 0.04,
      { duration: 180 },
    );
    baseOpacity.value = withTiming(
      mode === "ended" ? 0.35 : mode === "connecting" ? 0.6 : 0.92,
      { duration: 180 },
    );
  }, [baseOpacity, boost, mode]);

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + boost.value + energy.value * 0.28 + breath.value * (boost.value > 0.05 ? 0.08 : 0.03) }],
    opacity: baseOpacity.value,
  }));

  const ringStyle = useAnimatedStyle(() => {
    const lively = boost.value > 0.05;
    return {
      transform: [{ scale: 1.15 + breath.value * 0.22 + energy.value * 0.35 }],
      opacity: interpolate(breath.value, [0, 1], lively ? [0.35, 0.12] : [0.16, 0.06]),
    };
  });

  const outerStyle = useAnimatedStyle(() => {
    const lively = boost.value > 0.05;
    return {
      transform: [{ scale: 1.35 + breath.value * 0.3 + energy.value * 0.45 }],
      opacity: interpolate(breath.value, [0, 1], lively ? [0.22, 0.05] : [0.1, 0.03]),
    };
  });

  const tint = modeAccent(mode);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={liveVoiceStatusLabel(mode)}
      style={styles.wrap}
      pointerEvents="none"
    >
      <Animated.View style={[styles.ring, { borderColor: tint }, outerStyle]} />
      <Animated.View style={[styles.ring, { borderColor: tint }, ringStyle]} />
      <Animated.View style={[styles.core, { backgroundColor: tint }, coreStyle]} />
      <Text style={styles.label}>{liveVoiceStatusLabel(mode)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 220,
  },
  core: {
    width: 92,
    height: 92,
    borderRadius: 999,
    shadowColor: "#9EC7FF",
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  ring: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 999,
    borderWidth: 2,
  },
  label: {
    marginTop: 28,
    color: "rgba(255,255,255,0.82)",
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
});
