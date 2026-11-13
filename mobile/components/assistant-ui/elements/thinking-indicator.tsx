import { Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { cn } from "@/lib/utils";
import {
  ShimmerLabel,
  thinkSwapEnter,
  thinkSwapExit,
  threadMeta,
  useMotion,
} from "./surfaces";

/** thinking-states: shimmer while held, swap with blur-rise on label change. */
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
  // Cursor uses an ellipsis on the live status ("Thinking…").
  const display =
    label === "Thinking" || label === "Working" ? "Thinking…" : label;

  return (
    <Animated.View
      exiting={motion ? thinkSwapExit : undefined}
      accessibilityRole="text"
      accessibilityLabel={elapsed ? `${display}, ${elapsed}` : display}
      className={cn("flex-row items-baseline gap-1.5 py-1.5", className)}
    >
      <View className="min-h-[15px] justify-center overflow-visible">
        <Animated.View
          key={display}
          entering={motion ? thinkSwapEnter : undefined}
          exiting={motion ? thinkSwapExit : undefined}
        >
          <ShimmerLabel active className={cn(threadMeta, "leading-6")}>
            {display}
          </ShimmerLabel>
        </Animated.View>
      </View>
      {elapsed !== undefined ? (
        <Text className={cn(threadMeta, "tabular-nums leading-6")}>
          {elapsed}
        </Text>
      ) : null}
    </Animated.View>
  );
}
