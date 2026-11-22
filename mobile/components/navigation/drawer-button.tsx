import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { useCSSVariable } from "uniwind";

/**
 * Menu handle: two bars (top slightly longer).
 * - `disc` (default): ChatGPT-style soft circle + shadow (Android / opaque headers).
 * - `bare`: glyph only for iOS liquid-glass toolbar so it morphs into back.
 */
export function DrawerButton({
  onPress,
  accessibilityLabel = "Open menu",
  style,
  variant = "disc",
}: {
  readonly onPress: () => void;
  readonly accessibilityLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly variant?: "disc" | "bare";
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
  const bare = variant === "bare";

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
          backgroundColor: bare ? "transparent" : backgroundColor,
          shadowColor: "#000",
          shadowOpacity: bare ? 0 : 0.16,
          shadowRadius: bare ? 0 : 10,
          shadowOffset: { width: 0, height: bare ? 0 : 3 },
          elevation: bare ? 0 : 4,
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
