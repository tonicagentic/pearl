import { Platform, Pressable, View } from "react-native";
import { Host, Picker, Text as SwiftText } from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";

import { Text } from "@/components/ui/text";
import {
  HOME_TAB_LABEL,
  HOME_TABS,
  type HomeTab,
} from "@/components/home/home-tab";

/** Native Chat | Agents segmented control for the home header. */
export function HomeTabSwitcher({
  tab,
  onChange,
}: {
  readonly tab: HomeTab;
  readonly onChange: (tab: HomeTab) => void;
}) {
  if (Platform.OS === "ios") {
    return (
      <Host matchContents={{ vertical: true }} style={{ minWidth: 180 }}>
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
    );
  }

  return (
    <View className="bg-muted flex-row rounded-full p-0.5">
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
    </View>
  );
}
