import { useCallback, useMemo, useState } from "react";
import type { NativeSyntheticEvent } from "react-native";

type SearchBarTextEvent = NativeSyntheticEvent<{ readonly text: string }>;

/**
 * Query state for expo-router `Stack.SearchBar`.
 * Wire `onChangeText` / `onCancelButtonPress` onto the bar.
 */
export function useStackSearch() {
  const [query, setQuery] = useState("");

  const onChangeText = useCallback((event: SearchBarTextEvent) => {
    setQuery(event.nativeEvent.text);
  }, []);

  const onCancelButtonPress = useCallback(() => {
    setQuery("");
  }, []);

  const trimmed = useMemo(() => query.trim(), [query]);
  const active = trimmed.length > 0;

  const matches = useCallback(
    (...parts: readonly (string | null | undefined)[]) => {
      if (!active) return true;
      const needle = trimmed.toLowerCase();
      return parts.some((part) =>
        (part ?? "").toLowerCase().includes(needle),
      );
    },
    [active, trimmed],
  );

  return {
    query,
    trimmed,
    active,
    matches,
    onChangeText,
    onCancelButtonPress,
  };
}
