import { View } from "react-native";

import { TaskCard } from "@/components/assistant-ui/elements/task-card";
import { Text } from "@/components/ui/text";
import { formatLiveElapsed } from "@/src/live-chat-tools";
import type { LiveWorkCardModel } from "@/src/live-work-progress";

export function LiveWorkCards({
  cards,
  startedAt,
  now,
}: {
  readonly cards: readonly LiveWorkCardModel[];
  readonly startedAt: number | null;
  readonly now: number;
}) {
  if (cards.length === 0) return null;
  const elapsed =
    startedAt != null ? formatLiveElapsed(now - startedAt) : null;

  return (
    <View className="mt-4 w-full max-w-md gap-2 px-4">
      {elapsed ? (
        <Text
          variant="caption"
          className="text-center opacity-45"
          accessibilityLiveRegion="polite"
        >
          {elapsed}
        </Text>
      ) : null}
      {cards.map((card) => (
        <TaskCard
          key={card.key}
          label={card.label}
          meta={card.modelLabel}
          activity={card.activity}
          state={card.state}
          result={card.result}
        />
      ))}
    </View>
  );
}
