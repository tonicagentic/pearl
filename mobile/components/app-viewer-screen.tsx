import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useCSSVariable } from "uniwind";

import { fetchApp, type MiniAppDto } from "@/src/apps-client";

/** Opens a published mini app in a WebView (https URL from the user's row). */
export function AppViewerScreen({ id }: { readonly id: string }) {
  const [app, setApp] = useState<(MiniAppDto & { embedUrl: string | null }) | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchApp(id);
        if (!cancelled) {
          setApp(data.app);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "Failed to load app.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <View className="flex-row items-center justify-between gap-2 px-4 pb-2 pt-2">
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text className="text-sm text-muted-foreground">Back</Text>
        </Pressable>
        <Text
          className="flex-1 text-center text-base font-medium text-foreground"
          numberOfLines={1}
        >
          {app?.title ?? "App"}
        </Text>
        <View className="w-10" />
      </View>

      {error ? (
        <Text className="px-4 py-3 text-sm text-destructive">{error}</Text>
      ) : null}

      {!app && !error ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : null}

      {app && !app.embedUrl ? (
        <Text className="px-4 py-4 text-sm text-muted-foreground">
          This app is not published yet. Ask Pearl to publish it, then reopen.
        </Text>
      ) : null}

      {app?.embedUrl ? (
        <WebView
          className="flex-1"
          originWhitelist={["https://*"]}
          setSupportMultipleWindows={false}
          source={{ uri: app.embedUrl }}
          startInLoadingState
        />
      ) : null}
    </SafeAreaView>
  );
}
