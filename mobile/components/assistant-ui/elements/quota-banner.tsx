import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { announced, pct } from "../../../../lib/usage/range";
import { cn } from "@/lib/utils";
import { inkButton, mono, paper } from "./surfaces";

export function QuotaBanner({
  used,
  limit,
  unit,
  resetsIn,
  upgradeLabel,
  onUpgrade,
  className,
}: {
  readonly used: number;
  readonly limit: number;
  readonly unit: string;
  readonly resetsIn: string;
  readonly upgradeLabel: string;
  readonly onUpgrade?: () => void;
  readonly className?: string;
}) {
  const left = Math.round(Math.max(0, limit - used) * 100) / 100;
  const ratio = limit === 0 ? 0 : used / limit;
  const exhausted = limit > 0 && left === 0;
  const tight = !exhausted && ratio >= 0.9;

  return (
    <View
      data-slot="quota-banner"
      className={cn(
        paper,
        "w-full flex-col gap-2.5 rounded-2xl bg-card p-3.5 dark:bg-card",
        className,
      )}
    >
      <View className="flex-row flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <Text
          variant="secondary"
          weight="medium"
          className={cn(
            "text-[13.5px]",
            exhausted && "text-red-600 dark:text-red-400",
            tight && "text-amber-700 dark:text-amber-400",
          )}
        >
          {left} {unit} left
        </Text>
        <Text
          variant="caption"
          tone="default"
          className={cn(mono, "ms-auto tabular-nums opacity-55")}
        >
          resets in {resetsIn}
        </Text>
      </View>

      <View
        accessibilityRole="adjustable"
        accessibilityLabel={`${unit} used`}
        accessibilityValue={{
          min: 0,
          max: 100,
          now: announced(pct(used, limit)),
          text: `${used} of ${limit} ${unit} used`,
        }}
        className="h-1 w-full overflow-hidden rounded-full bg-foreground/5"
      >
        <View
          className={cn(
            "h-full rounded-full",
            exhausted
              ? "bg-red-500"
              : tight
                ? "bg-amber-500"
                : "bg-foreground/40",
          )}
          style={{ width: `${pct(used, limit)}%` }}
        />
      </View>

      <View className="flex-row items-center gap-2">
        <Text
          variant="caption"
          tone="default"
          className={cn(mono, "tabular-nums opacity-55")}
        >
          {used} of {limit} used
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onUpgrade}
          className={cn(
            inkButton,
            "ms-auto h-7 items-center justify-center rounded-full px-3",
          )}
        >
          <Text variant="caption" weight="medium" className="text-background">
            {upgradeLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
