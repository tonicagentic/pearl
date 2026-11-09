import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { openWebUrlExternally } from "@/src/open-web-url";
import { fetchRepos, type RepoDto } from "@/src/repos-client";

/** Paginated list of the signed-in user's GitHub repos; rows open GitHub. */
export function ReposScreen() {
  const [repos, setRepos] = useState<RepoDto[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [failedPage, setFailedPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

  const loadPage = useCallback(async (nextPage: number) => {
    setLoading(true);
    try {
      const data = await fetchRepos(nextPage);
      setError(null);
      setNotice(data.connected ? null : (data.message ?? "Connect GitHub in Settings."));
      setRepos((current) =>
        nextPage === 1 ? data.repos : [...current, ...data.repos],
      );
      setPage(nextPage);
      setHasNext(data.hasNext);
    } catch (cause) {
      setFailedPage(nextPage);
      setError(cause instanceof Error ? cause.message : "Failed to load repos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(1);
  }, [loadPage]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
        <Text className="text-xl font-semibold text-foreground">Repos</Text>
        <Pressable accessibilityRole="button" onPress={() => void loadPage(1)}>
          <Text className="text-sm text-muted-foreground">Refresh</Text>
        </Pressable>
      </View>

      {error ? (
        <Pressable className="px-4 py-3" onPress={() => void loadPage(failedPage)}>
          <Text className="text-sm text-destructive">{error} Tap to retry.</Text>
        </Pressable>
      ) : null}

      {notice ? (
        <View className="px-4 py-6">
          <Text className="text-base font-medium text-foreground">GitHub not connected</Text>
          <Text className="mt-1.5 text-sm leading-5 text-muted-foreground">{notice}</Text>
        </View>
      ) : (
        <FlatList
          className="flex-1 px-4"
          data={repos}
          keyExtractor={(repo) => String(repo.id)}
          ListEmptyComponent={
            loading ? (
              <View className="py-8">
                <ActivityIndicator />
              </View>
            ) : error ? undefined : (
              <View className="py-8">
                <Text className="text-base font-medium text-foreground">No repos found</Text>
              </View>
            )
          }
          ListFooterComponent={
            hasNext ? (
              <Pressable
                accessibilityRole="button"
                className="items-center py-4"
                disabled={loading}
                onPress={() => void loadPage(page + 1)}
              >
                {loading ? (
                  <ActivityIndicator />
                ) : (
                  <Text className="text-sm text-muted-foreground">Load more</Text>
                )}
              </Pressable>
            ) : undefined
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="link"
              className="mb-2 rounded-xl border border-border bg-card px-3 py-3"
              onPress={() => openWebUrlExternally(item.htmlUrl)}
            >
              <View className="flex-row items-center gap-2">
                <Text className="shrink text-base font-medium text-foreground" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {item.private ? "Private" : "Public"}
                </Text>
              </View>
              {item.description ? (
                <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
