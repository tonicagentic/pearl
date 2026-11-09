import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleDollarSignIcon, Trash2Icon } from "lucide-react-native";

import { Icon } from "@/components/ui/icon";

/** Bottom drawer for thread-level actions (Cost, Delete). */
export function ThreadActionsDrawer({
  open,
  title,
  canDelete,
  onClose,
  onOpenCost,
  onDelete,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly canDelete: boolean;
  readonly onClose: () => void;
  readonly onOpenCost: () => void;
  readonly onDelete: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          className="absolute inset-0 bg-foreground/40"
          onPress={onClose}
        />
        <View
          className="rounded-t-3xl border-t border-border/60 bg-background"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <View className="items-center pt-2.5 pb-1">
            <View className="h-1 w-9 rounded-full bg-border" />
          </View>
          <Text
            className="px-5 pb-2 pt-1 text-[13px] font-medium text-muted-foreground"
            numberOfLines={1}
          >
            {title === "New chat" ? "Thread" : title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cost"
            className="min-h-[52px] flex-row items-center gap-3 px-5 active:bg-muted/50"
            onPress={onOpenCost}
          >
            <Icon
              as={CircleDollarSignIcon}
              className="size-5 text-foreground"
            />
            <Text className="flex-1 text-[17px] text-foreground">Cost</Text>
          </Pressable>
          {canDelete ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete thread"
              className="min-h-[52px] flex-row items-center gap-3 px-5 active:bg-muted/50"
              onPress={onDelete}
            >
              <Icon as={Trash2Icon} className="size-5 text-destructive" />
              <Text className="flex-1 text-[17px] text-destructive">Delete</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            className="mx-5 mt-2 min-h-12 items-center justify-center rounded-2xl bg-muted/60 active:opacity-80"
            onPress={onClose}
          >
            <Text className="text-[17px] font-medium text-foreground">
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
