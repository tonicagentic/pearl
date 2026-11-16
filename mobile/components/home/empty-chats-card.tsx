import { View } from "react-native";

import { Text } from "@/components/ui/text";

/** Home inbox placeholder when the signed-in chat list is empty. */
export function EmptyChatsCard() {
  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel="No chats yet. Ask Pearl and the conversation will show up here."
      className="rounded-2xl border border-border/70 bg-card px-4 py-4"
    >
      <Text variant="label" weight="semibold">
        No chats yet
      </Text>
      <Text variant="body" tone="muted" className="mt-1.5">
        Ask Pearl and the conversation will show up here.
      </Text>
    </View>
  );
}
