import {
  Button,
  Host,
  HStack,
  Image,
  List,
  Popover,
  RNHostView,
  Section,
  Spacer,
  Text as SwiftText,
  VStack,
} from "@expo/ui/swift-ui";
import {
  background,
  buttonStyle,
  disabled as nativeDisabled,
  font,
  foregroundStyle,
  frame,
  padding,
  shapes,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useRef, useState, useSyncExternalStore } from "react";
import { Alert, Pressable } from "react-native";
import { KeyboardController } from "react-native-keyboard-controller";
import { useCSSVariable } from "uniwind";
import { BrainIcon } from "lucide-react-native";

import {
  pinComposerIfKeyboardVisible,
  useComposerChrome,
} from "@/components/assistant-ui/elements/composer-chrome";
import { Icon } from "@/components/ui/icon";
import { focusComposerInput } from "@/src/composer-input-focus";
import {
  getAgentMode,
  setAgentMode,
  subscribeAgentMode,
  type AgentMode,
} from "@/src/agent-mode";
import {
  COMPOSER_MODELS,
  COMPOSER_MODEL_SECTIONS,
  getModelSelection,
  setModelSelection,
  subscribeModelSelection,
} from "@/src/model-selection";

const BUTTON_SIZE = 32;

const MODES: readonly {
  readonly key: AgentMode;
  readonly label: string;
  readonly description: string;
}[] = [
  {
    key: "agent",
    label: "Agent",
    description: "Research and carry out the work",
  },
  {
    key: "plan",
    label: "Plan",
    description: "Draft a plan without acting",
  },
];

/** Combined mode + model picker as a native SwiftUI popover on iOS. */
export function ComposerModeModelPicker({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const restoreKeyboard = useRef(false);
  const chrome = useComposerChrome();
  const selectedModeKey = useSyncExternalStore(
    subscribeAgentMode,
    getAgentMode,
    getAgentMode,
  );
  const selectedModelKey = useSyncExternalStore(
    subscribeModelSelection,
    getModelSelection,
    getModelSelection,
  );
  const selectedMode =
    MODES.find((mode) => mode.key === selectedModeKey) ?? MODES[0];
  const selectedModel =
    COMPOSER_MODELS.find((model) => model.key === selectedModelKey) ??
    COMPOSER_MODELS[0];
  const primaryColor =
    (useCSSVariable("--color-primary") as string | undefined) ?? "#007AFF";

  const openPopover = () => {
    if (disabled) return;
    pinComposerIfKeyboardVisible(chrome);
    restoreKeyboard.current = KeyboardController.isVisible();
    setOpen(true);
  };

  const closeAndRestore = () => {
    setOpen(false);
    if (!restoreKeyboard.current) return;
    restoreKeyboard.current = false;
    setTimeout(() => focusComposerInput(), 60);
  };

  const selectMode = (key: AgentMode) => {
    setAgentMode(key);
    closeAndRestore();
  };

  const selectModel = (key: string) => {
    void setModelSelection(key).catch(() =>
      Alert.alert("Could not save model choice", "Try selecting the model again."),
    );
    closeAndRestore();
  };

  return (
    <Host
      style={{ width: BUTTON_SIZE, height: BUTTON_SIZE, backgroundColor: "transparent" }}
      ignoreSafeArea="keyboard"
    >
      <Popover
        isPresented={open}
        onIsPresentedChange={(presented) => {
          if (presented) {
            if (!disabled) setOpen(true);
            return;
          }
          if (!open) return;
          closeAndRestore();
        }}
        attachmentAnchor="top"
        arrowEdge="bottom"
        modifiers={[nativeDisabled(disabled)]}
      >
        <Popover.Trigger>
          <RNHostView matchContents>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Mode and model: ${selectedMode.label}, ${selectedModel.label}`}
              accessibilityState={{ expanded: open, disabled }}
              disabled={disabled}
              onPress={openPopover}
              onTouchStart={() => pinComposerIfKeyboardVisible(chrome)}
              className="bg-muted size-8 items-center justify-center rounded-full"
              style={disabled ? { opacity: 0.5 } : undefined}
            >
              <Icon as={BrainIcon} size={14} className="text-foreground" />
            </Pressable>
          </RNHostView>
        </Popover.Trigger>
        <Popover.Content>
          <List modifiers={[frame({ width: 280 })]}>
            <Section title="Mode">
              {MODES.map((mode) => {
                const isSelected = mode.key === selectedMode.key;
                return (
                  <Button
                    key={mode.key}
                    onPress={() => selectMode(mode.key)}
                    modifiers={[buttonStyle("plain")]}
                  >
                    <HStack spacing={12} alignment="center">
                      <VStack spacing={4} alignment="leading">
                        <SwiftText>{mode.label}</SwiftText>
                        <SwiftText
                          modifiers={[
                            foregroundStyle({
                              type: "hierarchical",
                              style: "secondary",
                            }),
                          ]}
                        >
                          {mode.description}
                        </SwiftText>
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
                  const isSelected = model.key === selectedModel.key;
                  return (
                    <Button
                      key={model.key}
                      onPress={() => selectModel(model.key)}
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
        </Popover.Content>
      </Popover>
    </Host>
  );
}
