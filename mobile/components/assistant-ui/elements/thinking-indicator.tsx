import { Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";

import { cn } from "@/lib/utils";
import {
  ShimmerLabel,
  THINK_SWAP_MS,
  THINK_SWAP_Y,
  threadMeta,
  useMotion,
} from "./surfaces";

/** Quiet shimmer + elapsed; label swaps with thinking-states exit/enter. */
export function ThinkingIndicator({
  label,
  elapsed,
  className,
}: {
  label: string;
  elapsed?: string;
  className?: string;
}) {
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
      className={cn("flex-row items-center gap-1.5 py-0.5", className)}
    >
      <View className="min-h-[15px] justify-center overflow-hidden">
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
          <ShimmerLabel className={cn(threadMeta, "leading-none")}>
            {label}
          </ShimmerLabel>
        </Animated.View>
      </View>
      {elapsed !== undefined ? (
        <Text className={cn(threadMeta, "tabular-nums opacity-80")}>
          {elapsed}
        </Text>
      ) : null}
    </Animated.View>
  );
}
