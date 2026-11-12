import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";
import { MessageSquareIcon } from "lucide-react-native";
import { KeyboardController, useKeyboardHandler } from "react-native-keyboard-controller";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Icon } from "@/components/ui/icon";
import { HISTORY_SEARCH_DOCK_CLEARANCE } from "@/components/history-search-bar";
import { useChats } from "@/src/chat-context";
import {
  searchChats,
  type ChatListItem,
  type ChatSearchHit,
} from "@/src/chats-client";
import { formatChatUpdatedAt } from "@/src/format-chat-updated-at";

const DEBOUNCE_MS = 250;
const SUGGESTION_COUNT = 8;
const MORPH_MS = 280;

/**
 * Search overlay content (result pills). The glass dock lives in
 * HistorySearchBar and stays mounted across idle/active.
 */
export function HistorySearchScreen({
  visible,
  query,
  onClose,
  onOpenChat,
}: {
  readonly visible: boolean;
  readonly query: string;
  readonly onClose: () => void;
  readonly onOpenChat: (chatId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { chats, selectChat } = useChats();
  const [results, setResults] = useState<readonly ChatSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestGen = useRef(0);

  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const cardColor = useCSSVariable("--color-card") as string | undefined;
  const borderColor = useCSSVariable("--color-border") as string | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const mutedColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const visibleProgress = useSharedValue(0);
  const keyboardHeight = useSharedValue(
    KeyboardController.isVisible() ? KeyboardController.state().height : 0,
  );
  const restingPad = Math.max(insets.bottom, 12) + 4;

  useEffect(() => {
    visibleProgress.value = withTiming(visible ? 1 : 0, {
      duration: MORPH_MS,
      easing: Easing.out(Easing.cubic),
    });
    if (!visible) {
      setResults([]);
      setError(null);
      setLoading(false);
    }
  }, [visible, visibleProgress]);

  useKeyboardHandler({
    onStart: (event) => {
      "worklet";
      keyboardHeight.value = Math.max(0, event.height);
    },
    onMove: (event) => {
      "worklet";
      keyboardHeight.value = Math.max(0, event.height);
    },
    onInteractive: (event) => {
      "worklet";
      keyboardHeight.value = Math.max(0, event.height);
    },
    onEnd: (event) => {
      "worklet";
      keyboardHeight.value = Math.max(0, event.height);
    },
  });

  useEffect(() => {
    if (!visible) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const gen = ++requestGen.current;
    setLoading(true);
    const timer = setTimeout(() => {
      void searchChats(q)
        .then((hits) => {
          if (gen !== requestGen.current) return;
          setResults(hits);
          setError(null);
        })
        .catch(() => {
          if (gen !== requestGen.current) return;
          setResults([]);
          setError("Could not search. Check your connection.");
        })
        .finally(() => {
          if (gen !== requestGen.current) return;
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, visible]);

  const suggestions = useMemo(
    () => chats.slice(0, SUGGESTION_COUNT),
    [chats],
  );

  const openHit = useCallback(
    async (chatId: string) => {
      const ok = await selectChat(chatId);
      if (!ok) return;
      onOpenChat(chatId);
      onClose();
    },
    [onClose, onOpenChat, selectChat],
  );

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      visibleProgress.value,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          visibleProgress.value,
          [0, 1],
          [12, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const listPadStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(keyboardHeight.value, restingPad) + 16,
  }));

  const showSuggestions = query.trim().length === 0;
  const rows: readonly (ChatSearchHit | ChatListItem)[] = showSuggestions
    ? suggestions
    : results;

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[styles.root, { backgroundColor }, overlayStyle]}
    >
      <Animated.View style={[styles.flex, listPadStyle]}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.listContent,
            {
              // Leave room under the top search dock so pills start below it.
              paddingTop: insets.top + HISTORY_SEARCH_DOCK_CLEARANCE + 8,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {showSuggestions ? (
            rows.map((chat) => (
              <SearchPill
                key={chat.id}
                title={chat.title}
                subtitle={formatChatUpdatedAt(chat.updatedAt)}
                waiting={Boolean(chat.waitingForInput)}
                cardColor={cardColor}
                borderColor={borderColor}
                foregroundColor={foregroundColor}
                mutedColor={mutedColor}
                onPress={() => void openHit(chat.id)}
              />
            ))
          ) : loading ? (
            <View style={styles.centered}>
              <ActivityIndicator />
            </View>
          ) : error ? (
            <Text style={[styles.statusText, { color: mutedColor }]}>
              {error}
            </Text>
          ) : rows.length === 0 ? (
            <Text style={[styles.statusText, { color: mutedColor }]}>
              No chats match “{query.trim()}”.
            </Text>
          ) : (
            rows.map((chat) => {
              const snippet =
                "snippet" in chat ? (chat.snippet as string | null) : null;
              return (
                <SearchPill
                  key={chat.id}
                  title={chat.title}
                  subtitle={
                    snippet?.trim() || formatChatUpdatedAt(chat.updatedAt)
                  }
                  waiting={Boolean(chat.waitingForInput)}
                  cardColor={cardColor}
                  borderColor={borderColor}
                  foregroundColor={foregroundColor}
                  mutedColor={mutedColor}
                  onPress={() => void openHit(chat.id)}
                />
              );
            })
          )}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

function SearchPill({
  title,
  subtitle,
  waiting,
  cardColor,
  borderColor,
  foregroundColor,
  mutedColor,
  onPress,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly waiting: boolean;
  readonly cardColor: string | undefined;
  readonly borderColor: string | undefined;
  readonly foregroundColor: string | undefined;
  readonly mutedColor: string | undefined;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        waiting ? `${title}, waiting for your reply` : title
      }
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: cardColor,
          borderColor: borderColor ?? "transparent",
        },
      ]}
    >
      <View
        style={[
          styles.thumb,
          {
            backgroundColor: waiting
              ? "rgba(245,158,11,0.2)"
              : "rgba(127,127,127,0.18)",
          },
        ]}
      >
        <Icon
          as={MessageSquareIcon}
          className={
            waiting ? "size-5 text-amber-500" : "size-5 text-muted-foreground"
          }
        />
      </View>
      <View style={styles.pillText}>
        <Text
          numberOfLines={1}
          style={[styles.pillTitle, { color: foregroundColor }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={[styles.pillSubtitle, { color: mutedColor }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
  },
  flex: { flex: 1 },
  listContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  pill: {
    minHeight: 72,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  pillTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  pillSubtitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  centered: {
    paddingVertical: 32,
    alignItems: "center",
  },
  statusText: {
    paddingHorizontal: 8,
    paddingVertical: 24,
    fontSize: 15,
    lineHeight: 20,
  },
});
