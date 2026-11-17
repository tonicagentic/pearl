import {
  Alert,
  Pressable,
  ScrollView,
  View,
  type PressableProps,
} from "react-native";
import {
  BottomSheetModal,
  type BottomSheetModal as BottomSheetModalRef,
} from "@expo/ui/community/bottom-sheet";
import {
  BrainIcon,
  CheckIcon,
  ListTodoIcon,
  SparklesIcon,
} from "lucide-react-native";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { composerControlHitSlop } from "@/components/assistant-ui/elements/icon-button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
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

const SHEET_SNAP_POINTS = ["85%"] as const;

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

/** Combined mode + model picker for Android and web; iOS uses the .ios variant. */
export function ComposerModeModelPicker({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const sheetRef = useRef<BottomSheetModalRef>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();
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

  const openMenu = useCallback(() => {
    if (disabled) return;
    setMenuOpen(true);
    sheetRef.current?.present();
  }, [disabled]);

  const finishClose = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const closeMenu = useCallback(() => {
    sheetRef.current?.dismiss();
    finishClose();
  }, [finishClose]);

  return (
    <View>
      <Pressable
        accessibilityLabel={`Mode and model: ${selectedMode.label}, ${selectedModel.label}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: menuOpen, disabled }}
        className="bg-muted active:bg-muted/80 size-11 items-center justify-center rounded-full"
        disabled={disabled}
        hitSlop={composerControlHitSlop}
        onPress={openMenu}
        style={disabled ? { opacity: 0.5 } : undefined}
      >
        <Icon as={BrainIcon} className="text-muted-foreground size-5" />
      </Pressable>

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={[...SHEET_SNAP_POINTS]}
        enablePanDownToClose
        onClose={finishClose}
      >
        <ScrollView
          nestedScrollEnabled
          className="px-4"
          contentContainerClassName="gap-5 pb-2"
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom, 16),
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-2">
            <View className="px-1">
              <Text variant="secondary" className="uppercase tracking-[0.04em]">
                Mode
              </Text>
            </View>
            <View className="overflow-hidden rounded-xl border border-border/60 bg-popover p-1">
              {MODES.map((mode) => (
                <ModeOption
                  key={mode.key}
                  mode={mode}
                  isSelected={mode.key === selectedModeKey}
                  onPress={() => {
                    setAgentMode(mode.key);
                    closeMenu();
                  }}
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
                    onPress={() => {
                      void setModelSelection(model.key).catch(() =>
                        Alert.alert(
                          "Could not save model choice",
                          "Try selecting the model again.",
                        ),
                      );
                      closeMenu();
                    }}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </BottomSheetModal>
    </View>
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
