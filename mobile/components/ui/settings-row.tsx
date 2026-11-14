import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

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
  const accentColor = useCSSVariable("--color-primary") as string | undefined;

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
          className={`min-w-0 flex-1 text-[17px] leading-[22px] ${labelDestructive ? "text-destructive" : "text-foreground"}`}
          numberOfLines={1}
        >
          {label}
        </Text>
        {detail ? (
          <Text
            className="max-w-[42%] text-right text-[15px] text-muted-foreground"
            numberOfLines={1}
            style={
              detailAccent && accentColor ? { color: accentColor } : undefined
            }
          >
            {detail}
          </Text>
        ) : null}
        <Text className="text-[20px] font-light text-muted-foreground/40">
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
