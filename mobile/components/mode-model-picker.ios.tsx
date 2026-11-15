import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  View,
  type PressableProps,
} from "react-native";
import {
  BrainIcon,
  CheckIcon,
  ListTodoIcon,
  SparklesIcon,
} from "lucide-react-native";
import { useRef, useState, useSyncExternalStore } from "react";
import { KeyboardController } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useComposerChrome } from "@/components/assistant-ui/elements/composer-chrome";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
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
  type ComposerModel,
} from "@/src/model-selection";

const MODES: readonly {
  readonly key: AgentMode;
  readonly label: string;
  readonly description: string;
  readonly Icon: typeof SparklesIcon;
}[] = [
  {
    key: "agent",
    label: "Agent",
    description: "Research and carry out the work",
    Icon: SparklesIcon,
  },
  {
    key: "plan",
    label: "Plan",
    description: "Draft a plan without acting",
    Icon: ListTodoIcon,
  },
];

/**
 * Mode + model picker for iOS. Uses a RN Modal sheet instead of SwiftUI
 * Popover — Popover content was painting inside the composer Host and
 * clipping as a Mode/Agent fragment over the dock.
 */
export function ComposerModeModelPicker({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
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

  const openMenu = () => {
    if (disabled) return;
    chrome?.pinExpanded();
    restoreKeyboard.current = KeyboardController.isVisible();
    setMenuOpen(true);
  };

  const closeMenu = () => {
    setMenuOpen(false);
    chrome?.scheduleCollapse();
    if (!restoreKeyboard.current) return;
    restoreKeyboard.current = false;
    setTimeout(() => focusComposerInput(), 60);
  };

  return (
    <View>
      <Pressable
        accessibilityLabel={`Mode and model: ${selectedMode.label}, ${selectedModel.label}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: menuOpen, disabled }}
        className="bg-muted size-8 items-center justify-center rounded-full"
        disabled={disabled}
        onPress={openMenu}
        onTouchStart={() => chrome?.pinExpanded()}
        style={disabled ? { opacity: 0.5 } : undefined}
      >
        <Icon as={BrainIcon} size={14} className="text-foreground" />
      </Pressable>

      <ModeModelMenu
        open={menuOpen}
        selectedModeKey={selectedMode.key}
        selectedModelKey={selectedModel.key}
        onClose={closeMenu}
        onSelectMode={(key) => {
          setAgentMode(key);
          closeMenu();
        }}
        onSelectModel={(key) => {
          void setModelSelection(key).catch(() =>
            Alert.alert(
              "Could not save model choice",
              "Try selecting the model again.",
            ),
          );
          closeMenu();
        }}
      />
    </View>
  );
}

function ModeModelMenu({
  open,
  selectedModeKey,
  selectedModelKey,
  onClose,
  onSelectMode,
  onSelectModel,
}: {
  readonly open: boolean;
  readonly selectedModeKey: AgentMode;
  readonly selectedModelKey: string;
  readonly onClose: () => void;
  readonly onSelectMode: (key: AgentMode) => void;
  readonly onSelectModel: (key: string) => void;
}) {
  const insets = useSafeAreaInsets();

  if (!open) {
    return null;
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-foreground/50">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close mode and model menu"
          className="flex-1"
          onPress={onClose}
        />
        <View
          className="max-h-[85%] rounded-t-2xl border-t border-border bg-background"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <View className="items-center py-2">
            <View className="h-1 w-10 rounded-full bg-border" />
          </View>
          <ScrollView
            className="px-4"
            contentContainerClassName="gap-5 pb-2"
            keyboardShouldPersistTaps="handled"
          >
            <View className="gap-2">
              <View className="px-1">
                <Text
                  variant="secondary"
                  className="uppercase tracking-[0.04em]"
                >
                  Mode
                </Text>
              </View>
              <View className="overflow-hidden rounded-xl border border-border/60 bg-popover p-1">
                {MODES.map((mode) => (
                  <ModeOption
                    key={mode.key}
                    mode={mode}
                    isSelected={mode.key === selectedModeKey}
                    onPress={() => onSelectMode(mode.key)}
                  />
                ))}
              </View>
            </View>
            {COMPOSER_MODEL_SECTIONS.map((section) => (
              <View key={section.id} className="gap-2">
                <View className="px-1">
                  <Text
                    variant="secondary"
                    className="uppercase tracking-[0.04em]"
                  >
                    {section.title}
                  </Text>
                  {section.description ? (
                    <Text variant="secondary" className="mt-1">
                      {section.description}
                    </Text>
                  ) : null}
                </View>
                <View className="overflow-hidden rounded-xl border border-border/60 bg-popover p-1">
                  {section.models.map((model: ComposerModel) => (
                    <ModelOption
                      key={model.key}
                      model={model}
                      isSelected={model.key === selectedModelKey}
                      onPress={() => onSelectModel(model.key)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ModeOption({
  mode,
  isSelected,
  onPress,
}: {
  readonly mode: (typeof MODES)[number];
  readonly isSelected: boolean;
  readonly onPress: PressableProps["onPress"];
}) {
  const ModeIcon = mode.Icon;
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityState={{ selected: isSelected }}
      className={`min-h-12 flex-row items-center justify-between gap-2 rounded-lg px-3 ${isSelected ? "bg-accent/60" : ""}`}
      onPress={onPress}
    >
      <View className="min-w-0 flex-1 flex-row items-center gap-3">
        <ModeIcon className="size-4 text-foreground" />
        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="secondary" tone="default" weight="medium">
            {mode.label}
          </Text>
          <Text variant="caption">{mode.description}</Text>
        </View>
      </View>
      {isSelected ? <CheckIcon className="size-3.5 text-foreground" /> : null}
    </Pressable>
  );
}

function ModelOption({
  model,
  isSelected,
  onPress,
}: {
  readonly model: ComposerModel;
  readonly isSelected: boolean;
  readonly onPress: PressableProps["onPress"];
}) {
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityState={{ selected: isSelected }}
      className={`min-h-12 flex-row items-center justify-between gap-2 rounded-lg px-3 ${isSelected ? "bg-accent/60" : ""}`}
      onPress={onPress}
    >
      <View className="min-w-0 flex-1 gap-0.5">
        <Text variant="secondary" tone="default" weight="medium">
          {model.label}
        </Text>
        <Text variant="caption">{`by ${model.company}`}</Text>
        {model.openWeight ? (
          <View className="mt-0.5 self-start rounded-full bg-muted px-2 py-0.5">
            <Text variant="caption" weight="medium">
              Open Weight
            </Text>
          </View>
        ) : null}
      </View>
      {isSelected ? <CheckIcon className="size-3.5 text-foreground" /> : null}
    </Pressable>
  );
}
