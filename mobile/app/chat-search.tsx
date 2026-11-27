import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { SearchIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePearlDrawer } from "@/components/navigation/drawer-context";
import { SearchDock } from "@/components/search/search-dock";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import {
  searchChats,
  type ChatSearchHit,
} from "@/src/chats-client";
import {
  usePearlMutedBackground,
  usePearlScreenBackground,
} from "@/src/navigation-theme";

const SEARCH_DEBOUNCE_MS = 250;
const DOCK_CLEARANCE = 72;

/**
 * Full-screen chat search as a root fullScreenModal. Prefer a stack route over
 * an RN Modal so Liquid Glass toolbar buttons cannot bleed through.
 */
export default function ChatSearchScreen() {
  const insets = useSafeAreaInsets();
  const backgroundColor = usePearlScreenBackground();
  const mutedColor = usePearlMutedBackground();
  const { onSelectChatFromDrawer } = usePearlDrawer();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<readonly ChatSearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchGen = useRef(0);
  const trimmed = query.trim();
  const active = trimmed.length > 0;

  const dismiss = useCallback(() => {
    setQuery("");
    if (router.canDismiss()) {
      router.dismiss();
      return;
    }
    router.back();
  }, []);

  useEffect(() => {
    if (!active) {
      searchGen.current += 1;
      setHits(null);
      setLoading(false);
      setError(null);
      return;
    }

    const gen = ++searchGen.current;
    setLoading(true);
    const timer = setTimeout(() => {
      void searchChats(trimmed)
        .then((next) => {
          if (gen !== searchGen.current) return;
          setHits(next);
          setError(null);
        })
        .catch(() => {
          if (gen !== searchGen.current) return;
          setHits([]);
          setError("Could not search. Check your connection.");
        })
        .finally(() => {
          if (gen !== searchGen.current) return;
          setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [active, trimmed]);

  return (
    <View style={[styles.root, { backgroundColor }]}>
      <View
        style={{
          flex: 1,
          paddingTop: Math.max(insets.top, 12) + 8,
        }}
      >
        {!active ? (
          <View style={styles.empty}>
            <View style={{ opacity: 0.35 }}>
              <Icon
                as={SearchIcon}
                className="size-16 text-muted-foreground"
              />
            </View>
            <Text variant="secondary" className="mt-4 opacity-70">
              Search chats
            </Text>
          </View>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: DOCK_CLEARANCE + Math.max(insets.bottom, 12),
            }}
          >
            {loading && hits == null ? (
              <SearchSkeleton mutedColor={mutedColor} />
            ) : null}
            {error ? (
              <Text
                variant="body"
                tone="destructive"
                className="py-4"
                accessibilityRole="alert"
              >
                {error}
              </Text>
            ) : null}
            {!loading && !error && hits && hits.length === 0 ? (
              <Text variant="secondary" className="py-8">
                No chats match
              </Text>
            ) : null}
            {(hits ?? []).map((hit) => (
              <Pressable
                key={hit.id}
                accessibilityRole="button"
                accessibilityLabel={hit.title}
                className="active:opacity-70"
                onPress={() => {
                  dismiss();
                  requestAnimationFrame(() => {
                    void onSelectChatFromDrawer(hit.id);
                  });
                }}
                style={styles.hit}
              >
                <Text variant="label" numberOfLines={1}>
                  {hit.title}
                </Text>
                {hit.snippet ? (
                  <Text
                    variant="secondary"
                    numberOfLines={2}
                    className="mt-1 opacity-80"
                  >
                    {hit.snippet}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      <SearchDock
        value={query}
        onChangeText={setQuery}
        onDismiss={dismiss}
        placeholder="Search"
        accessibilityLabel="Search chats"
        autoFocus
      />
    </View>
  );
}

function SearchSkeleton({ mutedColor }: { readonly mutedColor: string }) {
  return (
    <View style={{ gap: 16, paddingTop: 8 }}>
      {[0, 1, 2, 3, 4].map((index) => (
        <View key={index} style={styles.skeletonRow}>
          <View
            style={[styles.skeletonAvatar, { backgroundColor: mutedColor }]}
          />
          <View style={{ flex: 1, gap: 8 }}>
            <View
              style={[
                styles.skeletonLine,
                {
                  backgroundColor: mutedColor,
                  width: index % 2 === 0 ? "72%" : "54%",
                },
              ]}
            />
            <View
              style={[
                styles.skeletonLine,
                {
                  backgroundColor: mutedColor,
                  width: index % 2 === 0 ? "90%" : "78%",
                  height: 10,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: DOCK_CLEARANCE + 48,
  },
  hit: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.25)",
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  skeletonAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
  },
});
