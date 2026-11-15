import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";

/** Chevron row inside a SettingsCard (icon + label + optional detail). */
export function SettingsRow({
  icon,
  label,
  detail,
  detailAccent,
  labelDestructive,
  onPress,
  showSeparator,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly detail?: string;
  readonly detailAccent?: boolean;
  readonly labelDestructive?: boolean;
  readonly onPress: () => void;
  readonly showSeparator?: boolean;
}) {
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        className="active:bg-muted/80"
        onPress={onPress}
        style={styles.row}
      >
        <View className="size-9 items-center justify-center overflow-hidden rounded-[10px] bg-muted">
          {icon}
        </View>
        <Text
          variant="label"
          tone={labelDestructive ? "destructive" : "default"}
          className="min-w-0 flex-1"
          numberOfLines={1}
        >
          {label}
        </Text>
        {detail ? (
          <Text
            variant="body"
            tone={detailAccent ? "primary" : "muted"}
            className="max-w-[42%] text-right"
            numberOfLines={1}
          >
            {detail}
          </Text>
        ) : null}
        <Text variant="title" tone="muted" weight="light" className="opacity-40">
          ›
        </Text>
      </Pressable>
      {showSeparator ? (
        <View
          className="ml-[52px] h-px bg-border"
          style={styles.separatorHairline}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  separatorHairline: {
    height: StyleSheet.hairlineWidth,
  },
});
