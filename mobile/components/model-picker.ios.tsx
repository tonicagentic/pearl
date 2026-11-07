import {
  BottomSheet,
  Button,
  Group,
  Host,
  HStack,
  Image,
  List,
  RNHostView,
  Section,
  Spacer,
  Text as SwiftText,
  VStack,
} from "@expo/ui/swift-ui";
import {
  background,
  buttonStyle,
  font,
  foregroundStyle,
  padding,
  presentationDragIndicator,
  shapes,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Alert,
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { KeyboardController } from "react-native-keyboard-controller";
import { useCSSVariable } from "uniwind";

import { focusComposerInput } from "@/src/composer-input-focus";
import {
  COMPOSER_MODELS,
  COMPOSER_MODEL_SECTIONS,
  getModelSelection,
  setModelSelection,
  subscribeModelSelection,
} from "@/src/model-selection";

const CHIP_HEIGHT = 32;

/** Approximate capsule width until onLayout measures. */
function estimateChipWidth(label: string): number {
  return Math.ceil(20 + label.length * 8);
}

/** Native bottom-sheet model picker on iOS; other platforms use model-picker.tsx. */
export function ComposerModelPicker({ disabled = false }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const restoreKeyboard = useRef(false);
  const selectedKey = useSyncExternalStore(
    subscribeModelSelection,
    getModelSelection,
    getModelSelection,
  );
  const selected =
    COMPOSER_MODELS.find((model) => model.key === selectedKey) ??
    COMPOSER_MODELS[0];
  const primaryColor =
    (useCSSVariable("--color-primary") as string | undefined) ?? "#007AFF";
  const [hostWidth, setHostWidth] = useState(() =>
    estimateChipWidth(selected.label),
  );

  useEffect(() => {
    setHostWidth(estimateChipWidth(selected.label));
  }, [selected.label]);

  const onChipLayout = (event: LayoutChangeEvent) => {
    const next = Math.ceil(event.nativeEvent.layout.width);
    setHostWidth((current) => (current === next ? current : next));
  };

  const openSheet = () => {
    // Remember whether the composer had the keyboard so we can bring it back.
    restoreKeyboard.current = KeyboardController.isVisible();
    setOpen(true);
  };

  const select = (key: string) => {
    void setModelSelection(key).catch(() =>
      Alert.alert("Could not save model choice", "Try selecting the model again."),
    );
    setOpen(false);
  };

  return (
    <Host style={{ width: hostWidth, height: CHIP_HEIGHT }} ignoreSafeArea="keyboard">
      <BottomSheet
        isPresented={open}
        onIsPresentedChange={(presented) => {
          if (!presented || !disabled) setOpen(presented);
        }}
        onDismiss={() => {
          if (!restoreKeyboard.current) return;
          restoreKeyboard.current = false;
          // Wait a beat after the sheet finishes dismissing so focus sticks.
          setTimeout(() => focusComposerInput(), 60);
        }}
        fitToContents
        anchor={
          <RNHostView matchContents>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Model: ${selected.label}`}
              accessibilityState={{ expanded: open, disabled }}
              disabled={disabled}
              onPress={openSheet}
              onLayout={onChipLayout}
              className="h-8 flex-row items-center rounded-full px-2.5"
              style={disabled ? { opacity: 0.5 } : undefined}
            >
              <View>
                <Text
                  className="text-foreground text-[15px] font-medium"
                  numberOfLines={1}
                >
                  {selected.label}
                </Text>
              </View>
            </Pressable>
          </RNHostView>
        }
      >
        <Group modifiers={[presentationDragIndicator("visible")]}>
          <List>
            {COMPOSER_MODEL_SECTIONS.map((section) => (
              <Section
                key={section.id}
                title={section.title}
                footer={
                  section.description ? (
                    <SwiftText>{section.description}</SwiftText>
                  ) : undefined
                }
              >
                {section.models.map((model) => {
                  const isSelected = model.key === selected.key;
                  return (
                    <Button
                      key={model.key}
                      onPress={() => select(model.key)}
                      modifiers={[buttonStyle("plain")]}
                    >
                      <HStack spacing={12} alignment="center">
                        <VStack spacing={4} alignment="leading">
                          <SwiftText>{model.label}</SwiftText>
                          <SwiftText
                            modifiers={[
                              foregroundStyle({
                                type: "hierarchical",
                                style: "secondary",
                              }),
                            ]}
                          >{`by ${model.company}`}</SwiftText>
                          {model.openWeight ? (
                            <SwiftText
                              modifiers={[
                                font({ size: 11, weight: "medium" }),
                                padding({ horizontal: 7, vertical: 3 }),
                                foregroundStyle({
                                  type: "hierarchical",
                                  style: "secondary",
                                }),
                                background(
                                  { type: "hierarchical", style: "tertiary" },
                                  shapes.capsule(),
                                ),
                              ]}
                            >
                              Open Weight
                            </SwiftText>
                          ) : null}
                        </VStack>
                        <Spacer />
                        {isSelected ? (
                          <Image
                            systemName="checkmark"
                            size={14}
                            modifiers={[tint(primaryColor)]}
                          />
                        ) : null}
                      </HStack>
                    </Button>
                  );
                })}
              </Section>
            ))}
          </List>
        </Group>
      </BottomSheet>
    </Host>
  );
}
