import { useEffect, useRef } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SearchIcon, XIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/ui/icon";
import { KeyboardStickyView } from "@/src/keyboard-controller";
import {
  usePearlForeground,
  usePearlMutedBackground,
} from "@/src/navigation-theme";

type SearchDockProps = {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  /** Dismisses the whole search surface (not just clear). */
  readonly onDismiss: () => void;
  readonly placeholder?: string;
  readonly autoFocus?: boolean;
  readonly accessibilityLabel?: string;
};

/**
 * ChatGPT-style bottom search: rounded pill + circular X, sticky above the
 * keyboard. Shared by chat search overlay and Settings in-list filter.
 */
export function SearchDock({
  value,
  onChangeText,
  onDismiss,
  placeholder = "Search",
  autoFocus = true,
  accessibilityLabel = "Search",
}: SearchDockProps) {
  const inputRef = useRef<{ focus: () => void } | null>(null);
  const insets = useSafeAreaInsets();
  const foregroundColor = usePearlForeground();
  const mutedColor = usePearlMutedBackground();
  const mutedForeground = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  useEffect(() => {
    if (!autoFocus) return;
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  return (
    <KeyboardStickyView
      offset={{ closed: 0, opened: 0 }}
      style={[
        styles.sticky,
        { paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.pill, { backgroundColor: mutedColor }]}>
          <Icon as={SearchIcon} className="size-4 text-muted-foreground" />
          <TextInput
            ref={inputRef as never}
            accessibilityLabel={accessibilityLabel}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus={autoFocus}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={mutedForeground}
            returnKeyType="search"
            style={[styles.input, { color: foregroundColor }]}
            value={value}
            clearButtonMode="never"
          />
          {value.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
              onPress={() => onChangeText("")}
              style={[styles.clearChip, { backgroundColor: mutedForeground }]}
            >
              <Icon as={XIcon} className="size-3 text-background" />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close search"
          hitSlop={8}
          onPress={onDismiss}
          style={[styles.dismiss, { backgroundColor: mutedColor }]}
        >
          <Icon as={XIcon} className="size-5 text-foreground" />
        </Pressable>
      </View>
    </KeyboardStickyView>
  );
}

const styles = StyleSheet.create({
  sticky: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 17,
    paddingVertical: 0,
  },
  clearChip: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.55,
  },
  dismiss: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
