import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  type PressableProps,
} from "react-native";
import { CheckIcon, ChevronDownIcon } from "lucide-react-native";
import { useState, useSyncExternalStore } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  COMPOSER_MODELS,
  COMPOSER_MODEL_SECTIONS,
  getModelSelection,
  setModelSelection,
  subscribeModelSelection,
  type ComposerModel,
} from "@/src/model-selection";

/** Modal model picker for Android and web; iOS uses model-picker.ios.tsx. */
export function ComposerModelPicker({ disabled = false }: { disabled?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const selectedKey = useSyncExternalStore(
    subscribeModelSelection,
    getModelSelection,
    getModelSelection,
  );

  const selected =
    COMPOSER_MODELS.find((model) => model.key === selectedKey) ??
    COMPOSER_MODELS[0];

  return (
    <View>
      <Pressable
        accessibilityLabel={`Model: ${selected.label}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: menuOpen, disabled }}
        className="min-h-11 flex-row items-center gap-1 rounded-full px-3 active:opacity-70"
        disabled={disabled}
        onPress={() => setMenuOpen(true)}
      >
        <Text className="text-xs font-medium text-muted-foreground">
          {selected.label}
        </Text>
        <ChevronDownIcon className="size-3 text-muted-foreground" />
      </Pressable>

      <ModelMenu
        open={menuOpen}
        selectedKey={selected.key}
        onClose={() => setMenuOpen(false)}
        onSelect={(key) => {
          void setModelSelection(key).catch(() =>
            Alert.alert(
              "Could not save model choice",
              "Try selecting the model again.",
            ),
          );
          setMenuOpen(false);
        }}
      />
    </View>
  );
}

function ModelMenu({
  open,
  selectedKey,
  onClose,
  onSelect,
}: {
  readonly open: boolean;
  readonly selectedKey: string;
  readonly onClose: () => void;
  readonly onSelect: (key: string) => void;
}) {
  const insets = useSafeAreaInsets();

  if (!open) {
    return null;
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close model menu"
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
            {COMPOSER_MODEL_SECTIONS.map((section) => (
              <View key={section.id} className="gap-2">
                <View className="px-1">
                  <Text className="text-[13px] font-normal uppercase tracking-[0.04em] text-muted-foreground">
                    {section.title}
                  </Text>
                  {section.description ? (
                    <Text className="mt-1 text-[13px] leading-[18px] text-muted-foreground">
                      {section.description}
                    </Text>
                  ) : null}
                </View>
                <View className="overflow-hidden rounded-xl border border-border/60 bg-popover p-1">
                  {section.models.map((model: ComposerModel) => (
                    <ModelOption
                      key={model.key}
                      model={model}
                      isSelected={model.key === selectedKey}
                      onPress={() => onSelect(model.key)}
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
        <Text className="text-sm font-medium text-foreground">{model.label}</Text>
        <Text className="text-xs text-muted-foreground">{`by ${model.company}`}</Text>
        {model.openWeight ? (
          <View className="mt-0.5 self-start rounded-full bg-muted px-2 py-0.5">
            <Text className="text-[11px] font-medium text-muted-foreground">
              Open Weight
            </Text>
          </View>
        ) : null}
      </View>
      {isSelected ? <CheckIcon className="size-3.5 text-foreground" /> : null}
    </Pressable>
  );
}
