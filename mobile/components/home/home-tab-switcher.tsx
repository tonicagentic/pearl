import { Platform, Pressable } from "react-native";
import { Host, Picker, Text as SwiftText } from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";

import { Text } from "@/components/ui/text";
import { LiquidGlassShell } from "@/components/ui/liquid-glass";
import {
  HOME_TAB_LABEL,
  HOME_TABS,
  type HomeTab,
} from "@/components/home/home-tab";

const CAPSULE_RADIUS = 18;
const CAPSULE_MIN_WIDTH = 210;

/** Native Chat | Delegate segmented control for the home header. */
export function HomeTabSwitcher({
  tab,
  onChange,
}: {
  readonly tab: HomeTab;
  readonly onChange: (tab: HomeTab) => void;
}) {
  if (Platform.OS === "ios") {
    return (
      <LiquidGlassShell
        style={{
          minWidth: CAPSULE_MIN_WIDTH,
          borderRadius: CAPSULE_RADIUS,
          borderCurve: "continuous",
        }}
        contentStyle={{
          minWidth: CAPSULE_MIN_WIDTH,
          paddingHorizontal: 2,
          paddingVertical: 2,
        }}
      >
        <Host matchContents={{ vertical: true }} style={{ minWidth: CAPSULE_MIN_WIDTH - 4 }}>
          <Picker
            selection={tab}
            onSelectionChange={(value) => {
              if (value === "pearl" || value === "agents") onChange(value);
            }}
            modifiers={[pickerStyle("segmented")]}
          >
            {HOME_TABS.map((value) => (
              <SwiftText key={value} modifiers={[tag(value)]}>
                {HOME_TAB_LABEL[value]}
              </SwiftText>
            ))}
          </Picker>
        </Host>
      </LiquidGlassShell>
    );
  }

  return (
    <LiquidGlassShell
      style={{
        borderRadius: CAPSULE_RADIUS,
        borderCurve: "continuous",
      }}
      contentStyle={{
        flexDirection: "row",
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
            className={`min-w-[72px] items-center justify-center rounded-full px-3 py-1.5 ${selected ? "bg-background" : "bg-transparent"}`}
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
