import {
  Pressable,
  Text,
  View,
  type PressableProps,
} from "react-native";
import { Modal } from "react-native";
import { CheckIcon, ChevronDownIcon } from "lucide-react-native";
import { useSyncExternalStore } from "react";

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
        className="flex-row items-center gap-1 rounded-full px-2 py-1 active:opacity-70"
        disabled={disabled}
        onPress={() => setModelMenuOpen(true)}
      >
        <Text className="text-xs font-medium text-muted-foreground">
          {selected.label}
        </Text>
        <ChevronDownIcon className="size-3 text-muted-foreground" />
      </Pressable>

      <ModelMenu
        selectedKey={selected.key}
        onSelect={(key) => {
          setModelSelection(key);
          setModelMenuOpen(false);
        }}
      />
    </View>
  );
}

// Module-level menu visibility keeps the pill stateless; the Modal is only
// mounted while open.
let modelMenuOpen = false;
const modelMenuListeners = new Set<() => void>();

function setModelMenuOpen(open: boolean) {
  modelMenuOpen = open;
  for (const listener of modelMenuListeners) listener();
}

function subscribeModelMenu(listener: () => void): () => void {
  modelMenuListeners.add(listener);
  return () => {
    modelMenuListeners.delete(listener);
  };
}

function getModelMenuOpen(): boolean {
  return modelMenuOpen;
}

function ModelMenu({
  selectedKey,
  onSelect,
}: {
  readonly selectedKey: string;
  readonly onSelect: (key: string) => void;
}) {
  const open = useSyncExternalStore(
    subscribeModelMenu,
    getModelMenuOpen,
    getModelMenuOpen,
  );

  if (!open) {
    return null;
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={() => setModelMenuOpen(false)}>
      {/* Full-screen backdrop: tap anywhere outside the menu to dismiss. */}
      <Pressable
        accessibilityLabel="Close model menu"
        className="flex-1"
        onPress={() => setModelMenuOpen(false)}
      >
        <View className="flex-1 justify-end px-4 pb-4">
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
      </Pressable>
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
      className={`flex-row items-center justify-between gap-2 rounded-lg px-2.5 py-2.5 ${isSelected ? "bg-accent/60" : ""}`}
      onPress={onPress}
    >
      <Text className="text-sm font-medium text-foreground">{model.label}</Text>
      {isSelected ? <CheckIcon className="size-3.5 text-foreground" /> : null}
    </Pressable>
  );
}
