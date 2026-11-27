import { Modal, Pressable, ScrollView, View } from "react-native";
import { ClockIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import {
  formatScheduleSummary,
  triggerKindLabel,
} from "../../../lib/automations/schedule";
import type { PearlAutomationTriggerKind } from "../../../lib/automations/types";
import { TRIGGER_KINDS } from "../../../lib/automations/types";
import { deviceTimeZone } from "@/src/automations-client";

/** Grok-style “General” trigger sheet. */
export function TriggerPickerModal({
  open,
  onClose,
  onSelect,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSelect: (kind: PearlAutomationTriggerKind) => void;
}) {
  const insets = useSafeAreaInsets();
  const backgroundColor = useCSSVariable("--color-card") as string | undefined;
  const muted = useCSSVariable("--color-muted") as string | undefined;
  const timezone = deviceTimeZone();
  const now = new Date();

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        className="flex-1 justify-end bg-foreground/40"
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: backgroundColor ?? "#1c1c1e",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: "78%",
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          <View className="items-center pt-3 pb-2">
            <View
              style={{ backgroundColor: muted ?? "#3a3a3c" }}
              className="h-1 w-10 rounded-full"
            />
          </View>
          <Text variant="title" className="px-5 pb-3">
            General
          </Text>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8 }}
          >
            {TRIGGER_KINDS.map((kind) => (
              <Pressable
                key={kind}
                accessibilityRole="button"
                accessibilityLabel={triggerKindLabel(kind)}
                className="mb-1 flex-row items-start gap-3 rounded-2xl px-3 py-3 active:bg-muted/60"
                onPress={() => {
                  onSelect(kind);
                  onClose();
                }}
              >
                <View className="mt-0.5 size-9 items-center justify-center rounded-full bg-muted">
                  <Icon
                    as={ClockIcon}
                    className="size-4 text-muted-foreground"
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <Text variant="body" className="font-semibold">
                    {triggerKindLabel(kind)}
                  </Text>
                  <Text variant="secondary" className="mt-0.5">
                    {formatScheduleSummary(kind, {}, timezone, now)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
