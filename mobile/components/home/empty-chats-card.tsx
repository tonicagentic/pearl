import { View } from "react-native";

import { Text } from "@/components/ui/text";

/** Home inbox placeholder when the chat list is empty. */
export function EmptyChatsCard() {
  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel="No chats yet. Ask Pearl and the conversation will show up here."
      className="items-center px-8"
    >
      <Text variant="label" weight="semibold" className="text-center">
        No chats yet
      </Text>
      <Text variant="body" tone="muted" className="mt-1.5 text-center">
        Ask Pearl and the conversation will show up here.
      </Text>
    </View>
  );
}
