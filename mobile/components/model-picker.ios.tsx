import { Host, Menu, RNHostView, Toggle } from "@expo/ui/swift-ui";
import { accessibilityLabel, disabled as nativeDisabled } from "@expo/ui/swift-ui/modifiers";
import { useSyncExternalStore } from "react";
import { Text, View } from "react-native";

import {
  COMPOSER_MODELS,
  getModelSelection,
  setModelSelection,
  subscribeModelSelection,
} from "@/src/model-selection";

/** An anchored native menu on iOS; the shared module is used on other platforms. */
export function ComposerModelPicker({ disabled = false }: { disabled?: boolean }) {
  const selectedKey = useSyncExternalStore(
    subscribeModelSelection,
    getModelSelection,
    getModelSelection,
  );
  const selected =
    COMPOSER_MODELS.find((model) => model.key === selectedKey) ??
    COMPOSER_MODELS[0];
  const suffixStart = selected.label.lastIndexOf(" ");

  return (
    <Host style={{ width: 132, height: 44 }} ignoreSafeArea="keyboard">
      <Menu
        label={
          <RNHostView matchContents>
            <View className="h-11 w-[132px] flex-row items-center justify-center gap-1 px-1">
              <Text className="text-foreground text-[15px] font-medium" numberOfLines={1}>
                {selected.label.slice(0, suffixStart)}
              </Text>
              <Text className="text-muted-foreground text-[14px]" numberOfLines={1}>
                {selected.label.slice(suffixStart + 1)}
              </Text>
            </View>
          </RNHostView>
        }
        modifiers={[
          nativeDisabled(disabled),
          accessibilityLabel(`Model: ${selected.label}`),
        ]}
      >
        {COMPOSER_MODELS.map((model) => (
          <Toggle
            key={model.key}
            label={model.label}
            isOn={model.key === selected.key}
            onIsOnChange={() => setModelSelection(model.key)}
          />
        ))}
      </Menu>
    </Host>
  );
}
