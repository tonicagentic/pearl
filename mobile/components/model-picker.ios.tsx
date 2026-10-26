import { Host, Menu, RNHostView, Toggle } from "@expo/ui/swift-ui";
import { accessibilityLabel, disabled as nativeDisabled } from "@expo/ui/swift-ui/modifiers";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Alert, Text, View, type LayoutChangeEvent } from "react-native";

import {
  COMPOSER_MODELS,
  getModelSelection,
  setModelSelection,
  subscribeModelSelection,
} from "@/src/model-selection";

const CHIP_HEIGHT = 32;

/** Approximate capsule width from the two-tone label until onLayout measures. */
function estimateChipWidth(name: string, suffix: string): number {
  return Math.ceil(20 + name.length * 8.2 + 4 + suffix.length * 7.2);
}

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
  const name =
    suffixStart > 0 ? selected.label.slice(0, suffixStart) : selected.label;
  const suffix = suffixStart > 0 ? selected.label.slice(suffixStart + 1) : "";
  const [hostWidth, setHostWidth] = useState(() =>
    estimateChipWidth(name, suffix),
  );

  useEffect(() => {
    setHostWidth(estimateChipWidth(name, suffix));
  }, [name, suffix]);

  const onChipLayout = (event: LayoutChangeEvent) => {
    const next = Math.ceil(event.nativeEvent.layout.width);
    setHostWidth((current) => (current === next ? current : next));
  };

  return (
    <Host style={{ width: hostWidth, height: CHIP_HEIGHT }} ignoreSafeArea="keyboard">
      <Menu
        label={
          <RNHostView matchContents>
            <View
              onLayout={onChipLayout}
              className="h-8 flex-row items-center gap-1 rounded-full bg-muted px-2.5"
            >
              <Text className="text-foreground text-[15px] font-medium" numberOfLines={1}>
                {name}
              </Text>
              {suffix ? (
                <Text className="text-muted-foreground text-[13px]" numberOfLines={1}>
                  {suffix}
                </Text>
              ) : null}
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
            onIsOnChange={() => void setModelSelection(model.key).catch(() => Alert.alert("Could not save model choice", "Try selecting the model again."))}
          />
        ))}
      </Menu>
    </Host>
  );
}
