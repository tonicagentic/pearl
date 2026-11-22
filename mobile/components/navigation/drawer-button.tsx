import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { useCSSVariable } from "uniwind";

/**
 * Circular ChatGPT-style menu handle: soft white disc, shadow, two bars
 * (top slightly longer than bottom).
 */
export function DrawerButton({
  onPress,
  accessibilityLabel = "Open menu",
  style,
}: {
  readonly onPress: () => void;
  readonly accessibilityLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const foreground = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const card = useCSSVariable("--color-card") as string | undefined;
  const background = useCSSVariable("--color-background") as
    | string
    | undefined;
  const lineColor = foreground ?? "#3A3A3C";
  const backgroundColor = card ?? background ?? "#F4F4F5";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={onPress}
      style={[
        {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor,
          shadowColor: "#000",
          shadowOpacity: 0.16,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 },
          elevation: 4,
        },
        style,
      ]}
    >
      <TwoLinesIcon color={lineColor} />
    </Pressable>
  );
}

/** @deprecated Prefer DrawerButton */
export const HistorySidebarButton = DrawerButton;

/** Two centered bars — top a bit longer than bottom. */
export function TwoLinesIcon({
  color,
  size = 18,
}: {
  readonly color: string;
  readonly size?: number;
}) {
  const gap = Math.max(4, Math.round(size * 0.28));
  const thickness = Math.max(2, size * 0.14);
  const widths = [size, size * 0.72];

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: thickness * 2 + gap,
        alignItems: "center",
        justifyContent: "center",
        gap,
      }}
    >
      {widths.map((width, index) => (
        <View
          key={index}
          style={{
            width,
            height: thickness,
            borderRadius: thickness,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}
