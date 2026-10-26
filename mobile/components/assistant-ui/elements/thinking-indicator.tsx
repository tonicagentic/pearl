import { Animated as RnAnimated, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";

import { cn } from "@/lib/utils";
import {
  mono,
  monoStyle,
  ShimmerLabel,
  THINK_SWAP_MS,
  THINK_SWAP_Y,
  useMotion,
  usePulse,
} from "./surfaces";

/** Blue-dot + shimmer + elapsed; label swaps with thinking-states exit/enter. */
export function ThinkingIndicator({
  label,
  elapsed,
  className,
}: {
  label: string;
  elapsed?: string;
  className?: string;
}) {
  const pulse = usePulse(true);
  const motion = useMotion();

  return (
    <Animated.View
      exiting={
        motion
          ? FadeOutUp.duration(THINK_SWAP_MS).withInitialValues({
            opacity: 1,
            transform: [{ translateY: 0 }],
          })
          : undefined
      }
      accessibilityRole="text"
      accessibilityLabel={elapsed ? `${label}, ${elapsed}` : label}
      className={cn("flex-row items-center gap-2.5 py-1", className)}
    >
      <RnAnimated.View
        accessibilityElementsHidden
        importantForAccessibility="no"
        className="size-1.5 shrink-0 rounded-full bg-blue-500 dark:bg-blue-400"
        style={{ opacity: pulse }}
      />
      <View className="min-h-[14px] justify-center overflow-hidden">
        <Animated.View
          key={label}
          entering={
            motion
              ? FadeInDown.duration(THINK_SWAP_MS).withInitialValues({
                opacity: 0,
                transform: [{ translateY: THINK_SWAP_Y }],
              })
              : undefined
          }
          exiting={
            motion
              ? FadeOutUp.duration(THINK_SWAP_MS).withInitialValues({
                opacity: 1,
                transform: [{ translateY: 0 }],
              })
              : undefined
          }
        >
          <ShimmerLabel className="text-foreground/55 text-sm leading-none">
            {label}
          </ShimmerLabel>
        </Animated.View>
      </View>
      {elapsed !== undefined ? (
        <Text
          className={cn(mono, "text-foreground/30 tabular-nums")}
          style={monoStyle}
        >
          {elapsed}
        </Text>
      ) : null}
    </Animated.View>
  );
}
