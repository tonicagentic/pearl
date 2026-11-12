import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  FileTextIcon,
  GlobeIcon,
  ShareIcon,
  XIcon,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { previewKindForPath } from "../../lib/design/preview-kind";
import {
  shareWorkspaceFile,
  shareWorkspacePage,
} from "@/src/share-workspace-file";
import { useWorkspace } from "@/src/workspace-context";
import { AGENT_URL, getAuthCookie } from "@/src/eve-transport";

type WebViewComponent = ComponentType<{
  readonly source: { readonly uri: string } | { readonly html: string };
  readonly style?: object;
  readonly allowsBackForwardNavigationGestures?: boolean;
  readonly sharedCookiesEnabled?: boolean;
  readonly startInLoadingState?: boolean;
  readonly originWhitelist?: readonly string[];
  readonly javaScriptEnabled?: boolean;
  readonly scalesPageToFit?: boolean;
}>;

function loadWebView(): WebViewComponent | null {
  try {
    return require("react-native-webview").WebView as WebViewComponent;
  } catch {
    return null;
  }
}

function basename(path: string): string {
  return path.split("/").pop() || path;
}

/** Render workspace SVG as an image tree (WebView, JS off) instead of raw XML. */
function SvgFilePreview({
  path,
  content,
  WebView,
}: {
  readonly path: string;
  readonly content: string;
  readonly WebView: WebViewComponent | null;
}) {
  if (!WebView) {
    return (
      <ScrollView className="flex-1 px-4 py-3">
        <Text className="text-muted-foreground mb-2 text-xs">{path}</Text>
        <Text selectable className="text-foreground text-sm leading-6">
          {content}
        </Text>
      </ScrollView>
    );
  }
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><style>html,body{margin:0;padding:24px;background:#fff;min-height:100%;display:flex;align-items:center;justify-content:center;}svg{max-width:100%;height:auto;}</style></head><body>${content}</body></html>`;
  return (
    <WebView
      source={{ html }}
      style={{ flex: 1, backgroundColor: "#fff" }}
      originWhitelist={["*"]}
      javaScriptEnabled={false}
      scalesPageToFit
    />
  );
}

/**
 * In-place workspace pane: file/page tabs + preview body.
 * Used as Computer detail drill-in (not a full-screen overlay).
 */
export function WorkspacePanel({
  topInset = 0,
}: {
  /** Extra top padding under floating iOS chrome. */
  readonly topInset?: number;
}) {
  const {
    tabs,
    activeTabId,
    viewUrl,
    controlMode,
    chatId,
    selectWorkspaceTab,
    closeWorkspaceTab,
    setControlMode,
    ensureViewUrl,
  } = useWorkspace();
  const { height } = useWindowDimensions();
  const WebView = useMemo(() => loadWebView(), []);
  const [sharing, setSharing] = useState(false);

  const active = tabs.find((tab) => tab.id === activeTabId) ?? null;

  useEffect(() => {
    if (active?.kind === "page") {
      void ensureViewUrl();
    }
  }, [active?.kind, ensureViewUrl]);

  const onSelect = (tabId: string) => {
    selectWorkspaceTab(tabId);
    const tab = tabs.find((t) => t.id === tabId);
    if (tab?.kind === "page" && chatId) {
      void fetch(
        `${AGENT_URL}/api/chats/${encodeURIComponent(chatId)}/browser`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(getAuthCookie()
              ? { authorization: `Bearer ${getAuthCookie()}` }
              : {}),
          },
          body: JSON.stringify({ op: "select", tabId: tab.pageId }),
        },
      ).catch(() => {});
    }
  };

  const setMode = (mode: "agent" | "user") => {
    setControlMode(mode);
    if (!chatId) return;
    void fetch(
      `${AGENT_URL}/api/chats/${encodeURIComponent(chatId)}/browser`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(getAuthCookie()
            ? { authorization: `Bearer ${getAuthCookie()}` }
            : {}),
        },
        body: JSON.stringify({ op: "control", mode }),
      },
    ).catch(() => {});
  };

  const onShare = () => {
    if (!active || sharing) return;
    setSharing(true);
    const done = () => setSharing(false);
    if (active.kind === "file") {
      void shareWorkspaceFile({
        path: active.path,
        content: active.content,
      }).finally(done);
      return;
    }
    void shareWorkspacePage({
      url: active.url,
      title: active.title,
    }).finally(done);
  };

  const canShare =
    active?.kind === "file"
      ? Boolean(active.content !== undefined)
      : active?.kind === "page"
        ? Boolean(active.url)
        : false;

  return (
    <View className="bg-background flex-1" style={{ paddingTop: topInset }}>
      <View className="border-border/60 flex-row items-center gap-2 border-b px-2 py-2">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-1"
          contentContainerStyle={{ alignItems: "center", gap: 4 }}
        >
          {tabs.map((tab) => {
            const activeTab = tab.id === activeTabId;
            const label =
              tab.kind === "file"
                ? basename(tab.path)
                : tab.title || tab.url || "Page";
            return (
              <View
                key={tab.id}
                className={cn(
                  "max-w-[10rem] flex-row items-center gap-1 rounded-lg px-2 py-1.5",
                  activeTab ? "bg-foreground/10" : "bg-transparent",
                )}
              >
                <Pressable
                  accessibilityRole="button"
                  className="min-w-0 flex-1 flex-row items-center gap-1.5"
                  onPress={() => onSelect(tab.id)}
                >
                  <Icon
                    as={tab.kind === "page" ? GlobeIcon : FileTextIcon}
                    className="text-muted-foreground size-3.5"
                  />
                  <Text
                    numberOfLines={1}
                    className="text-foreground max-w-[7rem] text-xs font-medium"
                  >
                    {label}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Close ${label}`}
                  className="size-7 items-center justify-center"
                  onPress={() => closeWorkspaceTab(tab.id)}
                >
                  <Icon as={XIcon} className="text-muted-foreground size-3.5" />
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
        {canShare ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share"
            accessibilityState={{ disabled: sharing }}
            disabled={sharing}
            className="size-11 items-center justify-center disabled:opacity-40"
            onPress={onShare}
          >
            {sharing ? (
              <ActivityIndicator size="small" />
            ) : (
              <Icon as={ShareIcon} className="text-foreground size-5" />
            )}
          </Pressable>
        ) : null}
        {active?.kind === "page" ? (
          <Pressable
            accessibilityRole="button"
            className="min-h-11 justify-center px-2"
            onPress={() =>
              setMode(controlMode === "user" ? "agent" : "user")
            }
          >
            <Text className="text-foreground text-xs">
              {controlMode === "user" ? "Hand back" : "Take over"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ flex: 1, minHeight: height * 0.5 }}>
        {tabs.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Icon as={FileTextIcon} className="text-muted-foreground mb-3 size-8" />
            <Text className="text-foreground mb-1 text-center text-base font-medium">
              No open files
            </Text>
            <Text className="text-muted-foreground text-center text-sm leading-5">
              Files and browser pages the agent opens will show up here. You can
              preview, manage tabs, and share them.
            </Text>
          </View>
        ) : active?.kind === "page" ? (
          viewUrl && WebView ? (
            <WebView
              source={{ uri: viewUrl }}
              style={{ flex: 1 }}
              startInLoadingState
              allowsBackForwardNavigationGestures
            />
          ) : (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-muted-foreground text-sm">
                {WebView ? "Starting browser…" : "WebView is unavailable."}
              </Text>
            </View>
          )
        ) : active?.kind === "file" ? (
          previewKindForPath(active.path) === "svg" ? (
            <SvgFilePreview
              path={active.path}
              content={active.content}
              WebView={WebView}
            />
          ) : (
            <ScrollView className="flex-1 px-4 py-3">
              <Text className="text-muted-foreground mb-2 text-xs">
                {active.path}
              </Text>
              <Text selectable className="text-foreground text-sm leading-6">
                {active.content}
              </Text>
            </ScrollView>
          )
        ) : null}
      </View>
    </View>
  );
}

/**
 * @deprecated Prefer ComputerPanel / WorkspacePanel inside Chat | Computer.
 * Kept as a thin alias so older imports keep resolving during the migration.
 */
export function WorkspaceScreen() {
  const insets = useSafeAreaInsets();
  const { open } = useWorkspace();
  if (!open) return null;
  return (
    <View
      className="bg-background absolute inset-0 z-50"
      style={{ paddingTop: insets.top }}
      accessibilityViewIsModal
    >
      <WorkspacePanel />
    </View>
  );
}
