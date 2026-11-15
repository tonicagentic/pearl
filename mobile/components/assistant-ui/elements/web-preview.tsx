import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  View,
  type ViewProps,
} from "react-native";
import { ExternalLinkIcon, RefreshCwIcon } from "lucide-react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { field, mono, paper } from "./surfaces";

type WebViewComponent = ComponentType<
  ViewProps & {
    source: { uri: string };
    style?: object;
    onLoadEnd?: () => void;
    onError?: () => void;
    originWhitelist?: string[];
    setSupportMultipleWindows?: boolean;
  }
>;

function loadWebView(): WebViewComponent | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-webview").WebView as WebViewComponent;
  } catch {
    return null;
  }
}

export function WebPreview({
  origin,
  loading,
  onReload,
  onOpenExternal,
  children,
  className,
}: {
  readonly origin: string;
  readonly loading: boolean;
  readonly onReload?: () => void;
  readonly onOpenExternal?: () => void;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <View className={cn(paper, "w-full overflow-hidden rounded-2xl", className)}>
      <View className="flex-row items-center gap-1.5 border-b border-border/60 px-2 py-1.5">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reload preview"
          onPress={onReload}
          className="size-7 items-center justify-center rounded-full"
        >
          <Icon
            as={RefreshCwIcon}
            className={cn("size-3.5 text-foreground/45", loading && "opacity-60")}
          />
        </Pressable>
        <View className={cn(field, "min-w-0 flex-1 rounded-full px-3 py-1")}>
          <Text variant="caption" tone="default" numberOfLines={1} className={cn(mono, "opacity-55")}>
            {origin}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open preview"
          onPress={onOpenExternal}
          className="size-7 items-center justify-center rounded-full"
        >
          <Icon as={ExternalLinkIcon} className="size-3.5 text-foreground/45" />
        </Pressable>
      </View>
      <View className="relative min-h-56 w-full">
        <View className={cn("min-h-56 w-full", loading && "opacity-0")}>{children}</View>
        {loading ? (
          <View className="absolute inset-0 items-center justify-center">
            <ActivityIndicator />
            <Text variant="caption" tone="default" className="mt-2 opacity-45">
              Loading preview
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function PreviewWebFrame({
  url,
  onLoadEnd,
}: {
  readonly url: string;
  readonly onLoadEnd?: () => void;
}) {
  const WebView = useMemo(() => loadWebView(), []);
  if (!WebView) {
    return (
      <View className="h-56 items-center justify-center px-4">
        <Text variant="caption" tone="default" className="text-center opacity-55">
          Preview unavailable on this build. Open it externally.
        </Text>
      </View>
    );
  }
  return (
    <WebView
      source={{ uri: url }}
      style={{ height: 224, width: "100%" }}
      originWhitelist={["https://*", "http://*"]}
      setSupportMultipleWindows={false}
      onLoadEnd={onLoadEnd}
      onError={onLoadEnd}
    />
  );
}

export function openPreviewExternal(url: string) {
  void Linking.openURL(url);
}
