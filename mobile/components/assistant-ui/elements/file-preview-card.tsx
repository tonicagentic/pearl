import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import {
  BracesIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
} from "lucide-react-native";

import { Icon } from "@/components/ui/icon";
import { previewKindForPath } from "../../../../lib/design/preview-kind";
import {
  fileBasename,
  filePreviewSnippet,
  isContentUrl,
  previewKindLabel,
} from "../../../../lib/design/file-preview";
import { fetchChatFileContent } from "@/src/chat-files";
import { useWorkspaceOptional } from "@/src/workspace-context";
import {
  stepEnter,
  useMotion,
} from "@/components/assistant-ui/elements/surfaces";

function KindIcon({ path }: { readonly path: string }) {
  const kind = previewKindForPath(path);
  if (kind === "image" || kind === "svg") {
    return <Icon as={ImageIcon} className="text-muted-foreground size-4" />;
  }
  if (kind === "markdown" || kind === "html" || kind === "pdf") {
    return <Icon as={FileTextIcon} className="text-muted-foreground size-4" />;
  }
  if (kind === "scene" || path.toLowerCase().endsWith(".json")) {
    return <Icon as={BracesIcon} className="text-muted-foreground size-4" />;
  }
  return <Icon as={FileIcon} className="text-muted-foreground size-4" />;
}

/**
 * Chat / Computer mention of a workspace file. Tap opens the native viewer
 * when possible, otherwise the in-app workspace reader.
 */
export function FilePreviewCard({
  path,
  content: contentProp,
  onOpen,
}: {
  readonly path: string;
  /** When already known (Computer list), skip the network fetch. */
  readonly content?: string | null;
  readonly onOpen?: (
    path: string,
    content: string | null,
  ) => void | Promise<void>;
}) {
  const workspace = useWorkspaceOptional();
  const chatId = workspace?.chatId ?? null;
  const [content, setContent] = useState<string | null>(contentProp ?? null);
  const [loading, setLoading] = useState(
    contentProp == null && Boolean(chatId),
  );
  const [opening, setOpening] = useState(false);

  const name = fileBasename(path);
  const kind = previewKindForPath(path);
  const label = previewKindLabel(kind);

  useEffect(() => {
    if (contentProp != null) {
      setContent(contentProp);
      setLoading(false);
      return;
    }
    if (!chatId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchChatFileContent(chatId, path).then((text) => {
      if (cancelled) return;
      setContent(text);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [chatId, contentProp, path]);

  const imageSrc =
    content && kind === "image" && isContentUrl(content)
      ? content.trim()
      : content &&
          kind === "svg" &&
          content.trim().startsWith("<")
        ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(content)}`
        : content && kind === "svg" && isContentUrl(content)
          ? content.trim()
          : null;

  const snippet =
    content &&
    (kind === "markdown" || kind === "text" || kind === "mermaid")
      ? filePreviewSnippet(content)
      : null;

  const handlePress = async () => {
    if (opening) return;
    setOpening(true);
    try {
      if (onOpen) {
        await onOpen(path, content);
        return;
      }
      await workspace?.openPath(path, content ?? undefined);
    } finally {
      setOpening(false);
    }
  };

  const motion = useMotion();
  const nativeMotion = motion && Platform.OS !== "web";

  return (
    <Animated.View entering={nativeMotion ? stepEnter : undefined}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${name}`}
        accessibilityState={{ disabled: opening }}
        disabled={opening}
        className="border-border/50 bg-card w-full overflow-hidden rounded-2xl border"
        onPress={() => void handlePress()}
      >
        {imageSrc ? (
          <Image
            source={{ uri: imageSrc }}
            accessibilityIgnoresInvertColors
            className="bg-muted h-36 w-full"
            resizeMode="cover"
          />
        ) : null}
        <View className="flex-row items-start gap-3 px-3.5 py-3">
          <View className="bg-foreground/5 size-9 items-center justify-center rounded-xl">
            <KindIcon path={path} />
          </View>
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-foreground text-sm font-medium">
              {name}
            </Text>
            <Text className="text-muted-foreground mt-0.5 text-xs">
              {loading ? "Loading…" : label}
            </Text>
            {snippet ? (
              <Text
                numberOfLines={3}
                className="text-muted-foreground mt-2 text-xs leading-5"
              >
                {snippet}
              </Text>
            ) : null}
          </View>
          {opening ? <ActivityIndicator size="small" /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}
