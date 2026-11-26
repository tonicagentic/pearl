import { Platform, Pressable } from "react-native";
import { Host, Picker, Text as SwiftText } from "@expo/ui/swift-ui";
import {
  controlSize,
  frame,
  glassEffect,
  pickerStyle,
  tag,
} from "@expo/ui/swift-ui/modifiers";

import { Text } from "@/components/ui/text";
import {
  canUseLiquidGlass,
  LiquidGlassShell,
} from "@/components/ui/liquid-glass";
import {
  HOME_TAB_LABEL,
  HOME_TABS,
  type HomeTab,
} from "@/components/home/home-tab";
import { usePearlCardBackground } from "@/src/navigation-theme";

const CAPSULE_MIN_WIDTH = 210;
const CAPSULE_RADIUS = 18;

/**
 * Chat | Track control for the home header.
 * iOS: native segmented Picker with SwiftUI `glassEffect` (no RN glass wrap —
 * wrapping stacked a second capsule on the system segmented fill).
 * Android: custom liquid-glass shell + pressable segments.
 */
export function HomeTabSwitcher({
  tab,
  onChange,
}: {
  readonly tab: HomeTab;
  readonly onChange: (tab: HomeTab) => void;
}) {
  const cardColor = usePearlCardBackground();

  if (Platform.OS === "ios") {
    const modifiers = [
      pickerStyle("segmented" as const),
      controlSize("large" as const),
      frame({ minWidth: CAPSULE_MIN_WIDTH }),
      ...(canUseLiquidGlass()
        ? [
            glassEffect({
              glass: { variant: "regular" as const, interactive: true },
              shape: "capsule" as const,
            }),
          ]
        : []),
    ];

    return (
      <Host
        matchContents={{ vertical: true }}
        style={{ minWidth: CAPSULE_MIN_WIDTH }}
      >
        <Picker
          selection={tab}
          onSelectionChange={(value) => {
            if (value === "pearl" || value === "track") onChange(value);
          }}
          modifiers={modifiers}
        >
          {HOME_TABS.map((value) => (
            <SwiftText key={value} modifiers={[tag(value)]}>
              {HOME_TAB_LABEL[value]}
            </SwiftText>
          ))}
        </Picker>
      </Host>
    );
  }

  return (
    <LiquidGlassShell
      fallbackColor={cardColor}
      style={{
        minWidth: CAPSULE_MIN_WIDTH,
        borderRadius: CAPSULE_RADIUS,
        borderCurve: "continuous",
      }}
      contentStyle={{
        flexDirection: "row",
        minWidth: CAPSULE_MIN_WIDTH,
        padding: 2,
      }}
    >
      {HOME_TABS.map((value) => {
        const selected = value === tab;
        return (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={HOME_TAB_LABEL[value]}
            className={`min-w-[72px] flex-1 items-center justify-center rounded-full px-3 py-1.5 ${selected ? "bg-background" : "bg-transparent"}`}
            onPress={() => onChange(value)}
          >
            <Text
              variant="label"
              weight={selected ? "semibold" : "medium"}
              className={selected ? "text-foreground" : "text-muted-foreground"}
            >
              {HOME_TAB_LABEL[value]}
            </Text>
          </Pressable>
        );
      })}
    </LiquidGlassShell>
  );
}
