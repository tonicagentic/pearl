import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { ThinkingStatesLabel, threadMeta } from "./surfaces";

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
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={elapsed ? `${label}, ${elapsed}` : label}
      className={cn("flex-row items-baseline gap-1.5 py-1.5", className)}
    >
      <View className="min-h-[15px] min-w-0 flex-shrink justify-center overflow-visible">
        <ThinkingStatesLabel label={label} textClassName={threadMeta} />
      </View>
      {elapsed !== undefined ? (
        <Text variant="label" className={cn(threadMeta, "tabular-nums")}>
          {elapsed}
        </Text>
      ) : null}
    </View>
  );
}
