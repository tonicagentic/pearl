import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ElementRef,
} from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { CopyIcon, PencilIcon } from "lucide-react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { isSvgWorkspacePath } from "../../../../lib/design/chat-file-url";
import { fileBasename } from "../../../../lib/design/file-preview";
import { prepareSvgDocument } from "../../../../lib/design/svg";
import {
  useWorkspaceOptional,
  type CanvasOrigin,
} from "@/src/workspace-context";
import {
  writeFileContentFromArgs,
  writeFilePathFromArgs,
} from "@/src/write-file-args";
import { WorkspaceSvgPreview } from "./workspace-svg-preview";
import {
  mono,
  monoStyle,
  ShimmerLabel,
  stepEnter,
  useMotion,
} from "./surfaces";

const PREVIEW_LINES = 12;
const PREVIEW_CHARS = 900;

function resultPath(result: unknown): string | undefined {
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const path = (result as { path?: unknown }).path;
    return typeof path === "string" ? path : undefined;
  }
  return undefined;
}

function previewText(content: string): string {
  const clipped = content.length > PREVIEW_CHARS
    ? `${content.slice(0, PREVIEW_CHARS).trimEnd()}…`
    : content;
  const lines = clipped.split("\n");
  if (lines.length <= PREVIEW_LINES) return clipped;
  return `${lines.slice(0, PREVIEW_LINES).join("\n")}…`;
}

function wordCount(content: string): number {
  const trimmed = content.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * ChatGPT-style inline “Writing” card for write_file: preview in the thread,
 * pencil/copy actions, tap to open the full-screen file canvas.
 */
export function WritingFileCard({
  args,
  argsText,
  status,
  result,
}: {
  readonly args?: Record<string, unknown>;
  readonly argsText?: string;
  readonly status: { readonly type: string };
  readonly result?: unknown;
}) {
  const workspace = useWorkspaceOptional();
  const motion = useMotion();
  const nativeMotion = motion && Platform.OS !== "web";
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const cardRef = useRef<ElementRef<typeof View>>(null);

  const running = status.type === "running";
  const path =
    resultPath(result) ??
    writeFilePathFromArgs(args, argsText) ??
    "Document";
  const content = writeFileContentFromArgs(args, argsText) ?? "";
  const title = running ? "Writing" : fileBasename(path);
  const preview = useMemo(() => previewText(content), [content]);
  const words = wordCount(content);
  const svgContent = useMemo(() => {
    if (!isSvgWorkspacePath(path) || !content) return null;
    return (
      prepareSvgDocument(content) ??
      (content.trim().startsWith("<") ? content : null)
    );
  }, [path, content]);

  const measureOrigin = useCallback((): Promise<CanvasOrigin | undefined> => {
    return new Promise((resolve) => {
      const node = cardRef.current;
      if (!node || typeof node.measureInWindow !== "function") {
        resolve(undefined);
        return;
      }
      node.measureInWindow((x, y, width, height) => {
        if (width <= 0 || height <= 0) {
          resolve(undefined);
          return;
        }
        resolve({ x, y, width, height });
      });
    });
  }, []);

  const openCanvas = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (workspace) {
      const origin = await measureOrigin();
      workspace.openFile({
        path,
        content,
        openCanvas: true,
        ...(origin ? { origin } : {}),
      });
      return;
    }
    setFallbackOpen(true);
  }, [workspace, path, content, measureOrigin]);

  const copyAll = useCallback(async () => {
    if (!content) return;
    await Clipboard.setStringAsync(content);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [content]);

  if (svgContent && !running) {
    return (
      <Animated.View
        entering={nativeMotion ? stepEnter : undefined}
        className="w-full max-w-lg"
      >
        <WorkspaceSvgPreview path={path} content={svgContent} label={path} />
      </Animated.View>
    );
  }

  return (
    <>
      <Animated.View
        entering={nativeMotion ? stepEnter : undefined}
        className="w-full max-w-lg"
      >
        <View
          ref={cardRef}
          collapsable={false}
          className="bg-muted/40 border-border/60 overflow-hidden rounded-2xl border"
        >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            running ? `Open writing draft ${path}` : `Open ${path}`
          }
          onPress={() => {
            void openCanvas();
          }}
        >
          <View className="flex-row items-center gap-2 px-3.5 pb-1.5 pt-3">
            {running ? (
              <ShimmerLabel
                active
                variant="secondary"
                weight="semibold"
                className="flex-1"
              >
                Writing
              </ShimmerLabel>
            ) : (
              <Text
                variant="secondary"
                weight="semibold"
                className="min-w-0 flex-1"
                numberOfLines={1}
              >
                {title}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit in canvas"
              hitSlop={10}
              className="h-8 w-8 items-center justify-center"
              onPress={(event) => {
                event.stopPropagation?.();
                void openCanvas();
              }}
            >
              <Icon
                as={PencilIcon}
                className="text-muted-foreground size-4"
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy"
              hitSlop={10}
              disabled={!content}
              className="h-8 w-8 items-center justify-center"
              style={{ opacity: content ? 1 : 0.35 }}
              onPress={(event) => {
                event.stopPropagation?.();
                void copyAll();
              }}
            >
              <Icon as={CopyIcon} className="text-muted-foreground size-4" />
            </Pressable>
          </View>

          {preview ? (
            <View className="px-3.5 pb-3.5">
              <Text
                variant="body"
                className={cn("leading-6", running && "opacity-90")}
                numberOfLines={PREVIEW_LINES}
              >
                {preview}
              </Text>
            </View>
          ) : (
            <View className="px-3.5 pb-3.5">
              <Text variant="secondary" tone="muted">
                {running ? "Starting…" : "Empty file"}
              </Text>
            </View>
          )}

          {!running && path ? (
            <View className="border-border/50 flex-row items-center justify-between border-t px-3.5 py-2">
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {path}
              </Text>
              {words > 0 ? (
                <Text variant="caption" tone="muted" className="tabular-nums">
                  {words} words
                </Text>
              ) : null}
            </View>
          ) : null}
        </Pressable>
        </View>
      </Animated.View>

      <Modal
        visible={fallbackOpen}
        animationType="slide"
        onRequestClose={() => setFallbackOpen(false)}
      >
        <SafeAreaView className="bg-background flex-1 p-4">
          <Pressable
            accessibilityRole="button"
            className="min-h-11 justify-center"
            onPress={() => setFallbackOpen(false)}
          >
            <Text variant="body" tone="primary">
              Close
            </Text>
          </Pressable>
          <Text
            variant="body"
            weight="semibold"
            className="mb-3"
            numberOfLines={2}
          >
            {path}
          </Text>
          <ScrollView className="flex-1">
            <Text
              selectable
              variant="secondary"
              className={mono}
              style={monoStyle}
            >
              {content.slice(0, 5_000)}
              {content.length > 5_000
                ? "\n… Preview limited to 5,000 characters"
                : ""}
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
