import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  View,
  type ViewProps,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { fetchApp, type MiniAppDto } from "@/src/apps-client";

type WebViewComponent = ComponentType<
  ViewProps & {
    originWhitelist?: string[];
    setSupportMultipleWindows?: boolean;
    source: { uri: string };
    startInLoadingState?: boolean;
  }
>;

/** Load WebView only when embedding, so a missing native module does not crash route registration. */
function loadWebView(): WebViewComponent | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-webview").WebView as WebViewComponent;
  } catch {
    return null;
  }
}

function MiniAppWebView({ uri }: { readonly uri: string }) {
  const WebView = useMemo(() => loadWebView(), []);

  if (!WebView) {
    return (
      <View className="px-4 py-6">
        <Text className="text-base font-medium text-foreground">
          Preview unavailable
        </Text>
        <Text className="text-muted-foreground mt-1.5 text-sm leading-5">
          This build cannot embed web apps. Open the link in Safari instead.
        </Text>
        <Pressable
          accessibilityRole="button"
          className="mt-4 min-h-11 justify-center self-start"
          onPress={() => void Linking.openURL(uri)}
        >
          <Text className="text-sm font-medium text-foreground">Open in browser</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <WebView
      className="flex-1"
      originWhitelist={["https://*"]}
      setSupportMultipleWindows={false}
      source={{ uri }}
      startInLoadingState
    />
  );
}

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
        <View className="px-4 py-6">
          <Text className="text-base font-medium text-foreground">
            No preview yet
          </Text>
          <Text className="text-muted-foreground mt-1.5 text-sm leading-5">
            Ask Pearl to code this app for a sandbox draft preview, or publish
            for a durable URL.
          </Text>
        </View>
      ) : null}

      {app?.embedUrl ? <MiniAppWebView uri={app.embedUrl} /> : null}
    </SafeAreaView>
  );
}
