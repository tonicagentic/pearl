import { useMemo, useState, type ComponentType } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type ViewProps,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ExternalLinkIcon, XIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/ui/icon";
import { openWebUrlExternally } from "@/src/open-web-url";

type WebViewNavigationEvent = {
  url?: string;
  title?: string;
  loading?: boolean;
};

type WebViewErrorEvent = {
  nativeEvent?: { description?: string; code?: number };
};

type WebViewComponent = ComponentType<
  ViewProps & {
    originWhitelist?: string[];
    setSupportMultipleWindows?: boolean;
    source: { uri: string };
    startInLoadingState?: boolean;
    allowsBackForwardNavigationGestures?: boolean;
    sharedCookiesEnabled?: boolean;
    onLoadStart?: () => void;
    onLoadEnd?: () => void;
    onError?: (event: WebViewErrorEvent) => void;
    onHttpError?: (event: {
      nativeEvent?: { statusCode?: number; description?: string };
    }) => void;
    onNavigationStateChange?: (event: WebViewNavigationEvent) => void;
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

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Full-screen in-app browser for chat links, with an escape hatch to Safari. */
export function InAppBrowserScreen({ url }: { readonly url: string }) {
  const WebView = useMemo(() => loadWebView(), []);
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [currentUrl, setCurrentUrl] = useState(url);
  const [title, setTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const heading = title?.trim() || hostnameOf(currentUrl);
  // Modal + flex alone often leaves WKWebView with a zero frame; pin a real height.
  const webHeight = Math.max(320, windowHeight - insets.top - 56);

  return (
    <View className="flex-1" style={{ backgroundColor, paddingTop: insets.top }}>
      <View className="border-border/60 flex-row items-center gap-2 border-b px-3 pb-2.5 pt-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-full active:opacity-70"
        >
          <Icon as={XIcon} className="text-foreground size-5" />
        </Pressable>
        <View className="min-w-0 flex-1">
          <Text
            className="text-foreground text-center text-[15px] font-medium"
            numberOfLines={1}
          >
            {heading}
          </Text>
          <Text
            className="text-muted-foreground text-center text-[12px]"
            numberOfLines={1}
          >
            {hostnameOf(currentUrl)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open in browser"
          hitSlop={8}
          onPress={() => openWebUrlExternally(currentUrl || url)}
          className="h-9 w-9 items-center justify-center rounded-full active:opacity-70"
        >
          <Icon as={ExternalLinkIcon} className="text-muted-foreground size-5" />
        </Pressable>
      </View>

      {!WebView ? (
        <View className="gap-3 px-4 py-6">
          <Text className="text-foreground text-base font-medium">
            Preview unavailable
          </Text>
          <Text className="text-muted-foreground text-sm leading-5">
            This build cannot embed web pages. Open the link in your browser
            instead.
          </Text>
          <Pressable
            accessibilityRole="button"
            className="mt-1 min-h-11 justify-center self-start active:opacity-70"
            onPress={() => openWebUrlExternally(url)}
          >
            <Text className="text-foreground text-sm font-medium">
              Open in browser
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1, minHeight: webHeight, height: webHeight }}>
          {loading && !error ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                zIndex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator />
            </View>
          ) : null}
          {error ? (
            <View className="gap-3 px-4 py-6">
              <Text className="text-foreground text-base font-medium">
                Couldn’t load page
              </Text>
              <Text className="text-muted-foreground text-sm leading-5">
                {error}
              </Text>
              <Pressable
                accessibilityRole="button"
                className="mt-1 min-h-11 justify-center self-start active:opacity-70"
                onPress={() => openWebUrlExternally(currentUrl || url)}
              >
                <Text className="text-foreground text-sm font-medium">
                  Open in browser
                </Text>
              </Pressable>
            </View>
          ) : (
            <WebView
              style={{ width: "100%", height: webHeight, flex: 1 }}
              originWhitelist={["http://*", "https://*"]}
              setSupportMultipleWindows={false}
              source={{ uri: url }}
              startInLoadingState
              allowsBackForwardNavigationGestures
              sharedCookiesEnabled
              onLoadStart={() => {
                setLoading(true);
                setError(null);
              }}
              onLoadEnd={() => setLoading(false)}
              onError={(event) => {
                setLoading(false);
                setError(
                  event.nativeEvent?.description?.trim() ||
                    "The page failed to load.",
                );
              }}
              onHttpError={(event) => {
                const status = event.nativeEvent?.statusCode;
                if (typeof status === "number" && status >= 400) {
                  setLoading(false);
                  setError(`The site returned HTTP ${status}.`);
                }
              }}
              onNavigationStateChange={(event) => {
                if (typeof event.url === "string" && event.url.length > 0) {
                  setCurrentUrl(event.url);
                }
                if (typeof event.title === "string" && event.title.trim()) {
                  setTitle(event.title);
                }
                if (typeof event.loading === "boolean") {
                  setLoading(event.loading);
                }
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}
