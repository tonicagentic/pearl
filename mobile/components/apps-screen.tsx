import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { fetchApps, type MiniAppDto } from "@/src/apps-client";

/** List of Pearl mini apps; opens the WebView viewer for each. */
export function AppsScreen() {
  const [apps, setApps] = useState<MiniAppDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

  const reload = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchApps();
      setApps(data.apps);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load apps.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchApps();
        if (!cancelled) {
          setApps(data.apps);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "Failed to load apps.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
        <Text className="text-xl font-semibold text-foreground">Apps</Text>
        <Pressable accessibilityRole="button" onPress={() => void reload()}>
          <Text className="text-sm text-muted-foreground">Refresh</Text>
        </Pressable>
      </View>

      {error ? (
        <Pressable className="px-4 py-3" onPress={() => void reload()}>
          <Text className="text-sm text-destructive">
            {error} Tap to retry.
          </Text>
        </Pressable>
      ) : null}

      {apps === null && !error ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView className="flex-1 px-4">
          {(apps ?? []).length === 0 ? (
            <Text className="py-4 text-sm text-muted-foreground">
              No mini apps yet. Ask Pearl in chat to build one.
            </Text>
          ) : (
            (apps ?? []).map((app) => (
              <Pressable
                accessibilityRole="button"
                className="mb-2 rounded-xl border border-border bg-card px-3 py-3"
                key={app.id}
                onPress={() => router.push(`/apps/${app.id}`)}
              >
                <Text className="text-base font-medium text-foreground">
                  {app.title}
                </Text>
                <Text className="mt-1 text-xs text-muted-foreground">
                  {app.slug} · {app.status}
                  {app.productionUrl
                    ? " · live"
                    : app.previewUrl
                      ? " · preview"
                      : ""}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
