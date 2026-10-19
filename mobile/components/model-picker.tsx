import {
  Pressable,
  Text,
  View,
  type PressableProps,
} from "react-native";
import { Modal } from "react-native";
import { CheckIcon, ChevronDownIcon } from "lucide-react-native";
import { useState, useSyncExternalStore } from "react";

import {
  COMPOSER_MODELS,
  getModelSelection,
  setModelSelection,
  subscribeModelSelection,
  type ComposerModel,
} from "@/src/model-selection";

/**
 * Composer model picker: a small pill in the composer's action row names the
 * active model and opens a short list to switch it (mirroring the web's
 * composer-model-picker anatomy). The menu is a transparent Modal anchored
 * above the composer; tapping the backdrop or choosing a model closes it.
 */
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
          setModelSelection(key);
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

  if (!open) {
    return null;
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end px-4 pb-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Close model menu" className="absolute inset-0" onPress={onClose} />
          <View className="rounded-xl border border-border/60 bg-popover p-1 shadow-lg">
            {COMPOSER_MODELS.map((model: ComposerModel) => {
              const isSelected = model.key === selectedKey;

              return (
                <ModelOption
                  key={model.key}
                  model={model}
                  isSelected={isSelected}
                  onPress={() => onSelect(model.key)}
                />
              );
            })}
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
      <Text className="text-sm font-medium text-foreground">{model.label}</Text>
      {isSelected ? <CheckIcon className="size-3.5 text-foreground" /> : null}
    </Pressable>
  );
}
