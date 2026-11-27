import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ElementRef,
} from "react";
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
import { useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  BookmarkIcon,
  FileIcon,
  ImageIcon,
  Trash2Icon,
} from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AgentTemplateList } from "@/components/home/agent-template-browser";
import {
  LibraryImageViewer,
  measureViewerOrigin,
  type ViewerOrigin,
} from "@/components/library/library-image-viewer";
import { usePearlDrawer } from "@/components/navigation/drawer-context";
import { ScreenChrome } from "@/components/navigation/screen-chrome";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { router } from "expo-router";
import {
  artifactAuthHeaders,
  artifactContentUrl,
  deleteArtifact,
  downloadArtifactToCache,
  listArtifacts,
  type ArtifactDto,
  type ProjectArtifactLinkDto,
} from "@/src/artifacts-client";
import {
  usePearlMutedBackground,
  usePearlScreenBackground,
} from "@/src/navigation-theme";
import { useNetworkStatus } from "@/src/network-status";
import {
  queryErrorMessage,
  queryKeys,
  showQueryErrorBanner,
} from "@/src/query-client";
import {
  deleteQuote,
  listQuotes,
  type QuoteDto,
} from "@/src/quotes-client";
import { setPendingQuoteScroll } from "@/src/pending-quote-scroll";
import { useStackSearch } from "@/src/use-stack-search";

type KindFilter = "all" | "files" | "images" | "quotes" | "templates";
type ProjectFilter = "all" | "unlinked" | { readonly projectId: string };

/** Principal Library: durable agent files, images, Quotes, and templates. */
export function LibraryScreen() {
  const queryClient = useQueryClient();
  const { onSelectChatFromDrawer } = usePearlDrawer();
  const { offline } = useNetworkStatus();
  const [filter, setFilter] = useState<KindFilter>("all");
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("all");
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [busyQuoteId, setBusyQuoteId] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [viewerOrigin, setViewerOrigin] = useState<ViewerOrigin | null>(null);
  const tileRefs = useRef(new Map<string, ElementRef<typeof View> | null>());
  const search = useStackSearch();
  const { width } = useWindowDimensions();
  const backgroundColor = usePearlScreenBackground();
  const mutedColor = usePearlMutedBackground();

  const libraryQuery = useQuery({
    queryKey: queryKeys.library,
    queryFn: listArtifacts,
  });

  const quotesQuery = useQuery({
    queryKey: queryKeys.quotes,
    queryFn: () => listQuotes(),
  });

  useFocusEffect(
    useCallback(() => {
      void libraryQuery.refetch();
      void quotesQuery.refetch();
    }, [libraryQuery.refetch, quotesQuery.refetch]),
  );

  const items = libraryQuery.data?.artifacts ?? null;
  const quotes = quotesQuery.data ?? null;
  const projectLinks = libraryQuery.data?.projectLinks ?? [];
  const showError = showQueryErrorBanner(
    offline,
    libraryQuery.error ?? quotesQuery.error,
  );

  const deleteMutation = useMutation({
    mutationFn: deleteArtifact,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.library });
    },
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: deleteQuote,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.quotes });
    },
  });

  const projectOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const link of projectLinks) {
      if (!byId.has(link.projectId)) {
        byId.set(link.projectId, link.projectName);
      }
    }
    return [...byId.entries()]
      .map(([projectId, projectName]) => ({ projectId, projectName }))
      .sort((a, b) => a.projectName.localeCompare(b.projectName));
  }, [projectLinks]);

  const linkedPathnames = useMemo(() => {
    const set = new Set<string>();
    for (const link of projectLinks) set.add(link.pathname);
    return set;
  }, [projectLinks]);

  const pathnamesForProject = useMemo(() => {
    if (typeof projectFilter !== "object") return null;
    const set = new Set<string>();
    for (const link of projectLinks) {
      if (link.projectId === projectFilter.projectId) {
        set.add(link.pathname);
      }
    }
    return set;
  }, [projectFilter, projectLinks]);

  const visible = useMemo(() => {
    if (filter === "quotes" || filter === "templates") return [];
    const rows = items ?? [];
    return rows.filter((item) => {
      if (filter === "images" && item.kind !== "image") return false;
      if (filter === "files" && item.kind !== "file") return false;
      if (projectFilter === "unlinked") {
        if (linkedPathnames.has(item.pathname)) return false;
      } else if (pathnamesForProject) {
        if (!pathnamesForProject.has(item.pathname)) return false;
      }
      if (!search.active) return true;
      return search.matches(item.basename);
    });
  }, [
    items,
    filter,
    projectFilter,
    linkedPathnames,
    pathnamesForProject,
    search.active,
    search.matches,
  ]);

  const visibleQuotes = useMemo(() => {
    if (filter === "files" || filter === "images" || filter === "templates") {
      return [];
    }
    const rows = quotes ?? [];
    return rows.filter((quote) =>
      search.matches(quote.text, quote.chatTitle),
    );
  }, [quotes, filter, search.matches]);

  const images = useMemo(
    () => visible.filter((item) => item.kind === "image"),
    [visible],
  );
  const files = useMemo(
    () => visible.filter((item) => item.kind !== "image"),
    [visible],
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

  const openImageViewer = useCallback(
    async (item: ArtifactDto, index: number) => {
      const node = tileRefs.current.get(item.pathname);
      const origin = await measureViewerOrigin(
        node && typeof node.measureInWindow === "function" ? node : null,
      );
      setViewerOrigin(origin);
      setViewerIndex(index);
    },
    [],
  );

  const closeImageViewer = useCallback(() => {
    setViewerIndex(null);
    setViewerOrigin(null);
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
              const snapshot = libraryQuery.data;
              queryClient.setQueryData<{
                artifacts: readonly ArtifactDto[];
                projectLinks: readonly ProjectArtifactLinkDto[];
              }>(queryKeys.library, (current) =>
                current
                  ? {
                      artifacts: current.artifacts.filter(
                        (row) => row.pathname !== item.pathname,
                      ),
                      projectLinks: current.projectLinks.filter(
                        (row) => row.pathname !== item.pathname,
                      ),
                    }
                  : current,
              );
              try {
                await deleteMutation.mutateAsync(item.pathname);
              } catch (cause) {
                if (snapshot) {
                  queryClient.setQueryData(queryKeys.library, snapshot);
                }
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
    [deleteMutation, libraryQuery.data, queryClient],
  );

  const confirmDeleteQuote = useCallback(
    (quote: QuoteDto) => {
      Alert.alert("Delete quote?", undefined, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusyQuoteId(quote.id);
              const snapshot = quotesQuery.data;
              queryClient.setQueryData<readonly QuoteDto[]>(
                queryKeys.quotes,
                (current) =>
                  current
                    ? current.filter((row) => row.id !== quote.id)
                    : current,
              );
              try {
                await deleteQuoteMutation.mutateAsync(quote.id);
              } catch (cause) {
                if (snapshot) {
                  queryClient.setQueryData(queryKeys.quotes, snapshot);
                }
                Alert.alert(
                  "Could not delete",
                  cause instanceof Error ? cause.message : "Try again.",
                );
              } finally {
                setBusyQuoteId(null);
              }
            })();
          },
        },
      ]);
    },
    [deleteQuoteMutation, queryClient, quotesQuery.data],
  );

  const openQuoteChat = useCallback(
    (quote: QuoteDto) => {
      if (!quote.chatId) return;
      if (quote.messageId) {
        setPendingQuoteScroll({
          chatId: quote.chatId,
          messageId: quote.messageId,
        });
      }
      void onSelectChatFromDrawer(quote.chatId);
    },
    [onSelectChatFromDrawer],
  );

  const gap = 10;
  const pad = 20;
  const cols = width >= 700 ? 3 : 2;
  const tile = (width - pad * 2 - gap * (cols - 1)) / cols;

  return (
    <ScreenChrome
      title="Library"
      leading="drawer"
      search={{
        placeholder: "Search library",
        hideWhenScrolling: true,
        autoCapitalize: "none",
        onChangeText: search.onChangeText,
        onCancelButtonPress: search.onCancelButtonPress,
      }}
    >
      <View style={{ flex: 1, backgroundColor }}>
        <View className="flex-row flex-wrap gap-1.5 px-5 pb-2 pt-1">
          {(
            [
              ["all", "All"],
              ["files", "Files"],
              ["images", "Images"],
              ["quotes", "Quotes"],
              ["templates", "Templates"],
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

        {filter !== "quotes" ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="max-h-11 grow-0"
            contentContainerClassName="gap-1.5 px-5 pb-3"
          >
            <FilterChip
              label="All projects"
              selected={projectFilter === "all"}
              onPress={() => setProjectFilter("all")}
            />
            <FilterChip
              label="Unlinked"
              selected={projectFilter === "unlinked"}
              onPress={() => setProjectFilter("unlinked")}
            />
            {projectOptions.map((project) => (
              <FilterChip
                key={project.projectId}
                label={project.projectName}
                selected={
                  typeof projectFilter === "object" &&
                  projectFilter.projectId === project.projectId
                }
                onPress={() =>
                  setProjectFilter({ projectId: project.projectId })
                }
              />
            ))}
          </ScrollView>
        ) : null}

        {showError ? (
          <Pressable
            className="px-5 py-3"
            onPress={() => {
              void libraryQuery.refetch();
              void quotesQuery.refetch();
            }}
          >
            <Text variant="secondary" tone="destructive">
              {queryErrorMessage(
                libraryQuery.error ?? quotesQuery.error,
                "Failed to load library.",
              )}{" "}
              Tap to retry.
            </Text>
          </Pressable>
        ) : null}

        {items === null &&
        quotes === null &&
        (libraryQuery.isPending || quotesQuery.isPending) ? (
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
            {filter === "templates" ? (
              <View className="py-2">
                <Text variant="secondary" tone="muted" className="mb-3">
                  Add a ready-made role into one of your projects.
                </Text>
                <AgentTemplateList
                  onSelect={(slug) => {
                    router.push(
                      `/agent-directory/${encodeURIComponent(slug)}` as never,
                    );
                  }}
                />
              </View>
            ) : null}

            {filter !== "templates" &&
            visible.length === 0 &&
            visibleQuotes.length === 0 ? (
              <Text variant="body" tone="muted" className="py-8 text-center">
                {(items?.length ?? 0) > 0 || (quotes?.length ?? 0) > 0
                  ? "No matches."
                  : "Nothing in your library yet. When Pearl saves a file or generates an image, it shows up here. You can also highlight text in a chat reply and save it as a quote."}
              </Text>
            ) : null}

            {visibleQuotes.length > 0 &&
            filter !== "files" &&
            filter !== "images" &&
            filter !== "templates" ? (
              <View className="mb-6">
                {filter === "all" ? (
                  <Text
                    variant="secondary"
                    weight="medium"
                    className="mb-2.5 uppercase tracking-wide"
                  >
                    Quotes · {visibleQuotes.length}
                  </Text>
                ) : null}
                <View className="gap-2">
                  {visibleQuotes.map((quote) => (
                    <View
                      key={quote.id}
                      className="overflow-hidden rounded-2xl bg-muted/35 px-4 py-3"
                    >
                      <View className="mb-2 flex-row items-start gap-2">
                        <View className="mt-0.5 size-7 items-center justify-center rounded-lg bg-muted">
                          <Icon
                            as={BookmarkIcon}
                            className="size-3.5 text-muted-foreground"
                          />
                        </View>
                        <Text
                          variant="label"
                          className="min-w-0 flex-1"
                          style={{ lineHeight: 22 }}
                        >
                          {quote.text}
                        </Text>
                      </View>
                      <View className="flex-row items-center justify-between gap-2">
                        <Text variant="caption" tone="muted" className="flex-1">
                          {formatSynced(quote.createdAt)}
                          {quote.chatTitle ? ` · ${quote.chatTitle}` : ""}
                        </Text>
                        <View className="flex-row items-center gap-2">
                          {quote.chatId ? (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Open chat"
                              hitSlop={8}
                              onPress={() => openQuoteChat(quote)}
                              className="rounded-md border border-border px-2 py-1"
                            >
                              <Text variant="caption" weight="medium">
                                Open chat
                              </Text>
                            </Pressable>
                          ) : null}
                          {busyQuoteId === quote.id ? (
                            <ActivityIndicator />
                          ) : (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Delete quote"
                              hitSlop={8}
                              onPress={() => confirmDeleteQuote(quote)}
                              className="p-1"
                            >
                              <Icon
                                as={Trash2Icon}
                                className="size-4 text-muted-foreground"
                              />
                            </Pressable>
                          )}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {images.length > 0 && filter !== "files" && filter !== "quotes" ? (
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
                  {images.map((item, index) => (
                    <View
                      key={item.pathname}
                      ref={(node) => {
                        tileRefs.current.set(item.pathname, node);
                      }}
                      style={{
                        width: tile,
                        borderRadius: 12,
                        overflow: "hidden",
                        backgroundColor: mutedColor,
                      }}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={item.basename}
                        onPress={() => void openImageViewer(item, index)}
                        onLongPress={() => confirmDelete(item)}
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
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {files.length > 0 && filter !== "images" && filter !== "quotes" ? (
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

        {viewerIndex != null ? (
          <LibraryImageViewer
            images={images}
            index={viewerIndex}
            origin={viewerOrigin}
            onClose={closeImageViewer}
            onIndexChange={setViewerIndex}
          />
        ) : null}
      </View>
    </ScreenChrome>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
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