import {
  useCallback,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { useColorScheme, View } from "react-native";

import { Text } from "@/components/ui/text";

const DEFAULT_HEIGHT = 180;
const MIN_HEIGHT = 96;
const MAX_HEIGHT = 420;

type WebViewMessageEvent = {
  readonly nativeEvent: { readonly data: string };
};

type WebViewComponent = ComponentType<{
  source: { html?: string; uri?: string };
  style?: object;
  originWhitelist?: string[];
  scrollEnabled?: boolean;
  nestedScrollEnabled?: boolean;
  onMessage?: (event: WebViewMessageEvent) => void;
}>;

function loadWebView(): WebViewComponent | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-webview").WebView as WebViewComponent;
  } catch {
    return null;
  }
}

type MermaidMessage =
  | { readonly type: "ready"; readonly height: number }
  | { readonly type: "error"; readonly message: string };

function parseMermaidMessage(raw: string): MermaidMessage | null {
  try {
    const data = JSON.parse(raw) as Partial<MermaidMessage>;
    if (data.type === "ready" && typeof data.height === "number") {
      return { type: "ready", height: data.height };
    }
    if (data.type === "error" && typeof data.message === "string") {
      return { type: "error", message: data.message };
    }
  } catch {
    // Ignore non-JSON posts from the page.
  }
  return null;
}

function buildMermaidHtml(code: string, theme: "neutral" | "dark"): string {
  const source = JSON.stringify(code);
  const textColor = theme === "dark" ? "#E8E4DC" : "#111111";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/><style>html,body{margin:0;padding:0;background:transparent;color:${textColor};}#wrap{padding:8px;box-sizing:border-box;}svg{max-width:100%;height:auto;display:block;}</style><script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
const code = ${source};
function post(payload) {
  if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === "function") {
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }
}
function reportHeight() {
  const wrap = document.getElementById("wrap");
  const height = Math.ceil(Math.max(
    wrap ? wrap.getBoundingClientRect().height : 0,
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
  ));
  post({ type: "ready", height });
}
mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: ${JSON.stringify(theme)} });
try {
  const { svg } = await mermaid.render("pearl-mmd", code);
  document.getElementById("wrap").innerHTML = svg;
  requestAnimationFrame(() => requestAnimationFrame(reportHeight));
} catch (error) {
  const message = error instanceof Error ? error.message : "Mermaid render failed.";
  document.getElementById("wrap").textContent = code;
  post({ type: "error", message });
}
</script></head><body><div id="wrap"></div></body></html>`;
}

/**
 * Inline Mermaid diagram for chat (json-render cards and `.mmd` write_file).
 * Posts measured height back so the WebView can size to the graph.
 */
export function MermaidPreview({
  code,
  className,
  onError,
  fallback,
}: {
  readonly code: string;
  readonly className?: string;
  readonly onError?: (message: string) => void;
  /** Shown when WebView is unavailable (Expo web / missing native module). */
  readonly fallback?: ReactNode;
}) {
  const WebView = useMemo(() => loadWebView(), []);
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? "dark" : "neutral";
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [failed, setFailed] = useState(false);

  const html = useMemo(
    () => buildMermaidHtml(code.trim(), theme),
    [code, theme],
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const message = parseMermaidMessage(event.nativeEvent.data);
      if (!message) return;
      if (message.type === "ready") {
        const next = Math.min(
          MAX_HEIGHT,
          Math.max(MIN_HEIGHT, Math.round(message.height)),
        );
        setHeight(next);
        setFailed(false);
        return;
      }
      setFailed(true);
      onError?.(message.message);
    },
    [onError],
  );

  if (!WebView || failed) {
    if (fallback !== undefined) return <>{fallback}</>;
    return (
      <Text variant="caption" className="opacity-70">
        {code}
      </Text>
    );
  }

  const scrollable = height >= MAX_HEIGHT;

  return (
    <View className={className}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={{
          width: "100%",
          height,
          backgroundColor: "transparent",
        }}
        scrollEnabled={scrollable}
        nestedScrollEnabled={scrollable}
        onMessage={handleMessage}
      />
    </View>
  );
}

/** True when react-native-webview is loadable on this platform. */
export function canRenderMermaidPreview(): boolean {
  return loadWebView() !== null;
}
