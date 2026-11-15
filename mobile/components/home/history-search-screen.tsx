import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";
import { MessageSquareIcon } from "lucide-react-native";
import {
  KeyboardController,
  useKeyboardHandler,
} from "react-native-keyboard-controller";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { HOME_DOCK_CLEARANCE } from "@/components/home/home-dock";
import { Icon } from "@/components/ui/icon";
import { MatrixDotLoader } from "@/components/ui/matrix-dot-loader";
import { Text } from "@/components/ui/text";
import { CHAT_PRESENCE_BLUE } from "@/src/chat-presence";

/** iOS uses the native bottom search toolbar; Android keeps the floating dock. */
const SEARCH_FIELD_CLEARANCE =
  Platform.OS === "ios" ? 56 : HOME_DOCK_CLEARANCE;
import { useChats } from "@/src/chat-context";
import {
  searchChats,
  type ChatListItem,
  type ChatSearchHit,
} from "@/src/chats-client";
import {
  chatListPresence,
  chatPresenceAccessibilityLabel,
  type ChatPresence,
} from "@/src/chat-presence";
import { formatChatUpdatedAt } from "@/src/format-chat-updated-at";

const DEBOUNCE_MS = 250;
const SUGGESTION_COUNT = 8;
const MORPH_MS = 280;

/**
 * Chat search overlay. The floating dock owns the field; this paints results.
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

  const trimmedQuery = query.trim();
  const showSuggestions = trimmedQuery.length === 0;

  useEffect(() => {
    if (!visible || !trimmedQuery) return;

    const gen = ++requestGen.current;
    const timer = setTimeout(() => {
      setLoading(true);
      void searchChats(trimmedQuery)
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
  }, [trimmedQuery, visible]);

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
    paddingBottom:
      Math.max(keyboardHeight.value, restingPad) + SEARCH_FIELD_CLEARANCE + 16,
  }));

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
            { paddingTop: insets.top + 56 },
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
                presence={chatListPresence(chat)}
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
            <Text variant="body" tone="muted" className="px-2 py-6">
              {error}
            </Text>
          ) : rows.length === 0 ? (
            <Text variant="body" tone="muted" className="px-2 py-6">
              No chats match “{trimmedQuery}”.
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
                  presence={chatListPresence(chat)}
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
  presence,
  cardColor,
  borderColor,
  foregroundColor,
  mutedColor,
  onPress,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly presence: ChatPresence;
  readonly cardColor: string | undefined;
  readonly borderColor: string | undefined;
  readonly foregroundColor: string | undefined;
  readonly mutedColor: string | undefined;
  readonly onPress: () => void;
}) {
  const thumbBg =
    presence === "waiting"
      ? "rgba(245,158,11,0.2)"
      : presence === "unread"
        ? "rgba(59,130,246,0.2)"
        : "rgba(127,127,127,0.18)";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={chatPresenceAccessibilityLabel(title, presence)}
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: cardColor,
          borderColor: borderColor ?? "transparent",
        },
      ]}
    >
      <View style={[styles.thumb, { backgroundColor: thumbBg }]}>
        {presence === "working" ? (
          <MatrixDotLoader
            baseColor={mutedColor ?? "#d9d9d9"}
            activeColor={CHAT_PRESENCE_BLUE}
          />
        ) : (
          <Icon
            as={MessageSquareIcon}
            className={
              presence === "waiting"
                ? "size-5 text-amber-500"
                : presence === "unread"
                  ? "size-5 text-blue-500"
                  : "size-5 text-muted-foreground"
            }
          />
        )}
      </View>
      <View style={styles.pillText}>
        <Text
          numberOfLines={1}
          variant="label"
          weight="semibold"
          style={foregroundColor ? { color: foregroundColor } : undefined}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            variant="secondary"
            className="leading-[18px]"
            style={mutedColor ? { color: mutedColor } : undefined}
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
  centered: {
    paddingVertical: 32,
    alignItems: "center",
  },
});
