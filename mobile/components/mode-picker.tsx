import {
  Modal,
  Pressable,
  Text,
  View,
  type PressableProps,
} from "react-native";
import {
  CheckIcon,
  ChevronDownIcon,
  ListTodoIcon,
  SparklesIcon,
} from "lucide-react-native";
import { useState, useSyncExternalStore } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getAgentMode,
  setAgentMode,
  subscribeAgentMode,
  type AgentMode,
} from "@/src/agent-mode";

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

/** Modal mode picker for Android and web; iOS uses mode-picker.ios.tsx. */
export function ComposerModePicker({ disabled = false }: { disabled?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const selectedKey = useSyncExternalStore(
    subscribeAgentMode,
    getAgentMode,
    getAgentMode,
  );
  const selected = MODES.find((mode) => mode.key === selectedKey) ?? MODES[0];
  const Icon = selected.Icon;

  return (
    <View>
      <Pressable
        accessibilityLabel={`Mode: ${selected.label}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: menuOpen, disabled }}
        className="min-h-11 flex-row items-center gap-1 rounded-full px-3 active:opacity-70"
        disabled={disabled}
        onPress={() => setMenuOpen(true)}
      >
        <Icon className="size-3.5 text-muted-foreground" />
        <Text className="text-xs font-medium text-muted-foreground">
          {selected.label}
        </Text>
        <ChevronDownIcon className="size-3 text-muted-foreground" />
      </Pressable>

      <ModeMenu
        open={menuOpen}
        selectedKey={selected.key}
        onClose={() => setMenuOpen(false)}
        onSelect={(key) => {
          setAgentMode(key);
          setMenuOpen(false);
        }}
      />
    </View>
  );
}

function ModeMenu({
  open,
  selectedKey,
  onClose,
  onSelect,
}: {
  readonly open: boolean;
  readonly selectedKey: AgentMode;
  readonly onClose: () => void;
  readonly onSelect: (key: AgentMode) => void;
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
          accessibilityLabel="Close mode menu"
          className="flex-1"
          onPress={onClose}
        />
        <View
          className="rounded-t-2xl border-t border-border bg-background"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <View className="items-center py-2">
            <View className="h-1 w-10 rounded-full bg-border" />
          </View>
          <View className="gap-1 px-4 pb-2">
            {MODES.map((mode) => (
              <ModeOption
                key={mode.key}
                mode={mode}
                isSelected={mode.key === selectedKey}
                onPress={() => onSelect(mode.key)}
              />
            ))}
          </View>
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
  const Icon = mode.Icon;
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityState={{ selected: isSelected }}
      className={`min-h-12 flex-row items-center justify-between gap-2 rounded-lg px-3 ${isSelected ? "bg-accent/60" : ""}`}
      onPress={onPress}
    >
      <View className="min-w-0 flex-1 flex-row items-center gap-3">
        <Icon className="size-4 text-foreground" />
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-sm font-medium text-foreground">
            {mode.label}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {mode.description}
          </Text>
        </View>
      </View>
      {isSelected ? <CheckIcon className="size-3.5 text-foreground" /> : null}
    </Pressable>
  );
}
