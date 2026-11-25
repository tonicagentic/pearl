import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { useNetworkStatus } from "@/src/network-status";

/** Neutral offline line — one per surface, never red. */
export function OfflineBanner({
  compact = false,
}: {
  readonly compact?: boolean;
}) {
  const { offline } = useNetworkStatus();
  if (!offline) return null;
  return (
    <View
      className={
        compact
          ? "px-5 py-2"
          : "mx-4 mb-2 rounded-xl bg-muted/60 px-3 py-2"
      }
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
    >
      <Text variant="caption" tone="muted">
        You're offline. Showing what was last saved.
      </Text>
    </View>
  );
}
