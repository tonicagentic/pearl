import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { pct, take } from "../../../../lib/usage/range";
import { cn } from "@/lib/utils";
import { mono, paper } from "./surfaces";

export type SpanStatus = "running" | "completed" | "failed";

export type TraceSpan = {
  readonly id: string;
  readonly name: string;
  readonly depth: number;
  readonly startMs: number;
  readonly durationMs: number;
  readonly status: SpanStatus;
};

const TONE: Record<SpanStatus, string> = {
  running: "bg-blue-500 dark:bg-blue-400",
  completed: "bg-foreground/35",
  failed: "bg-red-500/80",
};

export function TraceWaterfall({
  spans,
  totalMs,
  visibleCount,
  className,
}: {
  readonly spans: readonly TraceSpan[];
  readonly totalMs: number;
  readonly visibleCount: number;
  readonly className?: string;
}) {
  const axis = totalMs || 1;

  return (
    <View
      data-slot="trace-waterfall"
      className={cn(
        paper,
        "w-full flex-col gap-2 rounded-2xl bg-card p-4 dark:bg-card",
        className,
      )}
    >
      <View className="flex-row items-baseline gap-2">
        <Text variant="secondary" weight="medium">
          Trace
        </Text>
        <Text
          variant="caption"
          tone="default"
          className={cn(mono, "ms-auto tabular-nums opacity-55")}
        >
          {totalMs}ms
        </Text>
      </View>

      <View className="flex-col gap-1.5">
        {take(spans, visibleCount).map((item) => {
          const left = pct(item.startMs, axis);
          const width = Math.max(1.5, pct(item.durationMs, axis));
          return (
            <View
              key={item.id}
              className="flex-row items-center gap-2"
              accessibilityLabel={`${item.name}, ${item.status}, ${item.durationMs}ms`}
            >
              <Text
                variant="caption"
                tone="default"
                numberOfLines={1}
                className="w-[7.5rem] opacity-70"
                style={{ paddingLeft: item.depth * 12 }}
              >
                {item.name}
              </Text>
              <View className="h-4 min-w-0 flex-1 justify-center">
                <View
                  className={cn(
                    "absolute h-[7px] rounded-full",
                    TONE[item.status],
                  )}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </View>
              <Text
                variant="caption"
                tone="default"
                className={cn(mono, "w-10 text-right tabular-nums opacity-55")}
              >
                {item.durationMs}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
