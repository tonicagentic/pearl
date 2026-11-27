import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { formatTokenCount } from "../../../../lib/usage/tokens";
import { announced, pct } from "../../../../lib/usage/range";
import { cn } from "@/lib/utils";
import { mono, paper } from "./surfaces";

export type CostLine = {
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cost: string;
  readonly share: number;
};

export function CostMeter({
  runCost,
  sessionCost,
  lines,
  className,
}: {
  readonly runCost: string;
  readonly sessionCost: string;
  readonly lines: readonly CostLine[];
  readonly className?: string;
}) {
  return (
    <View
      data-slot="cost-meter"
      className={cn(
        paper,
        "w-full flex-col gap-3 rounded-2xl bg-card p-4 dark:bg-card",
        className,
      )}
    >
      <View className="flex-row flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <Text variant="title" className="tabular-nums tracking-tight">
          {runCost}
        </Text>
        <Text variant="caption" tone="default" className="opacity-55">
          this run
        </Text>
        <Text
          variant="caption"
          tone="default"
          className={cn(mono, "ms-auto tabular-nums opacity-55")}
        >
          {sessionCost} session
        </Text>
      </View>

      <View className="h-1.5 w-full flex-row overflow-hidden rounded-full bg-foreground/5">
        {lines.map((line, i) => {
          const width = pct(line.share, 1);
          if (announced(width) === 0) return null;
          return (
            <View
              key={line.model}
              accessibilityRole="adjustable"
              accessibilityLabel={`${line.model} cost share`}
              accessibilityValue={{ min: 0, max: 100, now: announced(width) }}
              className={cn(
                "h-full",
                i === 0
                  ? "bg-blue-500 dark:bg-blue-400"
                  : i === 1
                    ? "bg-blue-500/55 dark:bg-blue-400/55"
                    : "bg-foreground/25",
              )}
              style={{ width: `${width}%` }}
            />
          );
        })}
      </View>

      <View className="flex-col gap-2">
        {lines.map((line) => (
          <View
            key={line.model}
            className="flex-row flex-wrap items-baseline gap-x-2 gap-y-0.5"
          >
            <Text
              variant="secondary"
              numberOfLines={1}
              className="min-w-0 flex-1"
            >
              {line.model}
            </Text>
            <Text
              variant="caption"
              tone="default"
              className={cn(mono, "tabular-nums opacity-55")}
            >
              {formatTokenCount(line.inputTokens)} in ·{" "}
              {formatTokenCount(line.outputTokens)} out
            </Text>
            <Text
              variant="caption"
              tone="default"
              className={cn(mono, "tabular-nums opacity-75")}
            >
              {line.cost}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
