import {
  BottomSheet,
  Button,
  Group,
  Host,
  HStack,
  Image,
  List,
  RNHostView,
  Spacer,
  Text as SwiftText,
  VStack,
} from "@expo/ui/swift-ui";
import {
  buttonStyle,
  presentationDragIndicator,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { KeyboardController } from "react-native-keyboard-controller";
import { useCSSVariable } from "uniwind";
import { ListTodoIcon, SparklesIcon } from "lucide-react-native";

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

const CHIP_HEIGHT = 32;

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

function estimateChipWidth(label: string): number {
  return Math.ceil(36 + label.length * 8);
}

/** Native bottom-sheet mode picker on iOS; other platforms use mode-picker.tsx. */
export function ComposerModePicker({ disabled = false }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const restoreKeyboard = useRef(false);
  const chrome = useComposerChrome();
  const selectedKey = useSyncExternalStore(
    subscribeAgentMode,
    getAgentMode,
    getAgentMode,
  );
  const selected = MODES.find((mode) => mode.key === selectedKey) ?? MODES[0];
  const primaryColor =
    (useCSSVariable("--color-primary") as string | undefined) ?? "#007AFF";
  const [hostWidth, setHostWidth] = useState(() =>
    estimateChipWidth(selected.label),
  );
  const ChipIcon = selected.key === "plan" ? ListTodoIcon : SparklesIcon;

  useEffect(() => {
    setHostWidth(estimateChipWidth(selected.label));
  }, [selected.label]);

  const onChipLayout = (event: LayoutChangeEvent) => {
    const next = Math.ceil(event.nativeEvent.layout.width);
    setHostWidth((current) => (current === next ? current : next));
  };

  const openSheet = () => {
    pinComposerIfKeyboardVisible(chrome);
    restoreKeyboard.current = KeyboardController.isVisible();
    setOpen(true);
  };

  const select = (key: AgentMode) => {
    setAgentMode(key);
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
          setTimeout(() => focusComposerInput(), 60);
        }}
        fitToContents
        anchor={
          <RNHostView matchContents>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Mode: ${selected.label}`}
              accessibilityState={{ expanded: open, disabled }}
              disabled={disabled}
              onPress={openSheet}
              onLayout={onChipLayout}
              className="h-8 flex-row items-center gap-1 rounded-full px-2.5"
              style={disabled ? { opacity: 0.5 } : undefined}
            >
              <Icon as={ChipIcon} className="size-3.5 text-foreground" />
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
            {MODES.map((mode) => {
              const isSelected = mode.key === selected.key;
              return (
                <Button
                  key={mode.key}
                  onPress={() => select(mode.key)}
                  modifiers={[buttonStyle("plain")]}
                >
                  <HStack spacing={12} alignment="center">
                    <VStack spacing={4} alignment="leading">
                      <SwiftText>{mode.label}</SwiftText>
                      <SwiftText>{mode.description}</SwiftText>
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
          </List>
        </Group>
      </BottomSheet>
    </Host>
  );
}
