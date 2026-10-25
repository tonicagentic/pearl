import { Animated, Text, View } from "react-native";

import { cn } from "@/lib/utils";
import { mono, monoStyle, ShimmerLabel, usePulse } from "./surfaces";

/** Blue-dot + shimmer + elapsed badge; mirrors the web thinking indicator. */
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

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={elapsed ? `${label}, ${elapsed}` : label}
      className={cn("flex-row items-center gap-2.5 py-1", className)}
    >
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no"
        className="size-1.5 shrink-0 rounded-full bg-blue-500 dark:bg-blue-400"
        style={{ opacity: pulse }}
      />
      <ShimmerLabel
        key={label}
        className="text-foreground/55 text-sm leading-none"
      >
        {label}
      </ShimmerLabel>
      {elapsed !== undefined ? (
        <Text
          className={cn(mono, "text-foreground/30 tabular-nums")}
          style={monoStyle}
        >
          {elapsed}
        </Text>
      ) : null}
    </View>
  );
}
