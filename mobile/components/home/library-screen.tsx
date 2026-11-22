import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  View,
  useWindowDimensions,
} from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import { FileIcon, ImageIcon, Trash2Icon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/ui/icon";
import { StackScreen } from "@/components/ui/stack-screen";
import { Text } from "@/components/ui/text";
import {
  artifactAuthHeaders,
  artifactContentUrl,
  deleteArtifact,
  downloadArtifactToCache,
  listArtifacts,
  type ArtifactDto,
} from "@/src/artifacts-client";
import { useStackSearch } from "@/src/use-stack-search";

type Filter = "all" | "files" | "images";

/** Principal Library: durable agent files and images with search + filters. */
export function LibraryScreen() {
  const [items, setItems] = useState<readonly ArtifactDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const search = useStackSearch();
  const { width } = useWindowDimensions();
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const mutedColor = useCSSVariable("--color-muted") as string | undefined;

  const visible = useMemo(() => {
    const rows = items ?? [];
    return rows.filter((item) => {
      if (filter === "images" && item.kind !== "image") return false;
      if (filter === "files" && item.kind !== "file") return false;
      if (!search.active) return true;
      return search.matches(item.basename);
    });
  }, [items, filter, search.active, search.matches]);

  const images = useMemo(
    () => visible.filter((item) => item.kind === "image"),
    [visible],
  );
  const files = useMemo(
    () => visible.filter((item) => item.kind !== "image"),
    [visible],
  );

  const reload = useCallback(async () => {
    try {
      setError(null);
      setItems(await listArtifacts());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to load library.",
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void listArtifacts()
        .then((rows) => {
          if (!cancelled) {
            setItems(rows);
            setError(null);
          }
        })
        .catch((cause) => {
          if (!cancelled) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Failed to load library.",
            );
          }
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const openItem = useCallback(async (item: ArtifactDto) => {
    setBusyPath(item.pathname);
    try {
      const file = await downloadArtifactToCache(item);
      if (Platform.OS === "ios") {
        await Share.share({ url: file.uri, title: item.basename });
        return;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { dialogTitle: item.basename });
        return;
      }
      await Share.share({ message: item.basename, title: item.basename });
    } catch (cause) {
      Alert.alert(
        "Could not open",
        cause instanceof Error ? cause.message : "Try again.",
      );
    } finally {
      setBusyPath(null);
    }
  }, []);

  const confirmDelete = useCallback(
    (item: ArtifactDto) => {
      Alert.alert("Delete from library?", item.basename, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusyPath(item.pathname);
              try {
                await deleteArtifact(item.pathname);
                setItems((current) =>
                  (current ?? []).filter((row) => row.pathname !== item.pathname),
                );
              } catch (cause) {
                Alert.alert(
                  "Could not delete",
                  cause instanceof Error ? cause.message : "Try again.",
                );
              } finally {
                setBusyPath(null);
              }
            })();
          },
        },
      ]);
    },
    [],
  );

  const gap = 10;
  const pad = 20;
  const cols = width >= 700 ? 3 : 2;
  const tile = (width - pad * 2 - gap * (cols - 1)) / cols;

  return (
    <StackScreen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Library",
          headerBackButtonDisplayMode: "minimal",
          headerTintColor: foregroundColor,
        }}
      />
      <Stack.SearchBar
        placeholder="Search library"
        hideWhenScrolling
        autoCapitalize="none"
        onChangeText={search.onChangeText}
        onCancelButtonPress={search.onCancelButtonPress}
      />

      <View style={{ flex: 1, backgroundColor }}>
        <View className="flex-row gap-1.5 px-5 pb-3 pt-4">
          {(
            [
              ["all", "All"],
              ["files", "Files"],
              ["images", "Images"],
            ] as const
          ).map(([value, label]) => {
            const selected = filter === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setFilter(value)}
                className={`rounded-full px-3 py-1.5 ${selected ? "bg-foreground" : "bg-muted"}`}
              >
                <Text
                  variant="caption"
                  weight="medium"
                  className={selected ? "text-background" : "text-foreground"}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <Pressable className="px-5 py-3" onPress={() => void reload()}>
            <Text variant="secondary" tone="destructive">
              {error} Tap to retry.
            </Text>
          </Pressable>
        ) : null}

        {items === null && !error ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-5"
            contentContainerStyle={{ paddingBottom: 24 }}
            contentInsetAdjustmentBehavior="automatic"
          >
            {visible.length === 0 ? (
              <Text variant="body" tone="muted" className="py-8 text-center">
                {items?.length
                  ? "No matches."
                  : "Nothing in your library yet. When Pearl saves a file or generates an image, it shows up here."}
              </Text>
            ) : null}

            {images.length > 0 && filter !== "files" ? (
              <View className="mb-6">
                {filter === "all" ? (
                  <Text
                    variant="secondary"
                    weight="medium"
                    className="mb-2.5 uppercase tracking-wide"
                  >
                    Images · {images.length}
                  </Text>
                ) : null}
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap,
                  }}
                >
                  {images.map((item) => (
                    <Pressable
                      key={item.pathname}
                      accessibilityRole="button"
                      accessibilityLabel={item.basename}
                      onPress={() => void openItem(item)}
                      onLongPress={() => confirmDelete(item)}
                      style={{
                        width: tile,
                        borderRadius: 12,
                        overflow: "hidden",
                        backgroundColor: mutedColor ?? "#F2F2F7",
                      }}
                    >
                      <Image
                        source={{
                          uri: artifactContentUrl(item.pathname),
                          headers: artifactAuthHeaders(),
                        }}
                        style={{ width: tile, height: tile }}
                        resizeMode="cover"
                      />
                      <View className="px-2 py-1.5">
                        <Text variant="caption" numberOfLines={1}>
                          {item.basename}
                        </Text>
                      </View>
                      {busyPath === item.pathname ? (
                        <View className="absolute inset-0 items-center justify-center bg-background/50">
                          <ActivityIndicator />
                        </View>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {files.length > 0 && filter !== "images" ? (
              <View className="mb-4">
                {filter === "all" ? (
                  <Text
                    variant="secondary"
                    weight="medium"
                    className="mb-2.5 uppercase tracking-wide"
                  >
                    Files · {files.length}
                  </Text>
                ) : null}
                <View className="overflow-hidden rounded-2xl bg-muted/35">
                  {files.map((item, index) => (
                    <View key={item.pathname}>
                      {index > 0 ? <View className="mx-4 h-px bg-border" /> : null}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={item.basename}
                        className="min-h-12 flex-row items-center gap-3 px-4 py-3 active:opacity-80"
                        onPress={() => void openItem(item)}
                        disabled={busyPath === item.pathname}
                      >
                        <View className="size-8 items-center justify-center rounded-lg bg-muted">
                          <Icon
                            as={item.kind === "image" ? ImageIcon : FileIcon}
                            className="size-4 text-muted-foreground"
                          />
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text variant="label" numberOfLines={1}>
                            {item.basename}
                          </Text>
                          <Text variant="caption" tone="muted">
                            {formatSize(item.size)} ·{" "}
                            {formatSynced(item.uploadedAt)}
                          </Text>
                        </View>
                        {busyPath === item.pathname ? (
                          <ActivityIndicator />
                        ) : (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Delete"
                            hitSlop={8}
                            onPress={() => confirmDelete(item)}
                            className="p-1"
                          >
                            <Icon
                              as={Trash2Icon}
                              className="size-4 text-muted-foreground"
                            />
                          </Pressable>
                        )}
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>
    </StackScreen>
  );
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSynced(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
