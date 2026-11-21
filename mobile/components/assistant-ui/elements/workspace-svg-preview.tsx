import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";

import { isSvgWorkspacePath } from "../../../../lib/design/chat-file-url";
import { fileBasename, isContentUrl } from "../../../../lib/design/file-preview";
import { prepareSvgDocument } from "../../../../lib/design/svg";
import { fetchChatFileContent } from "@/src/chat-files";
import { useWorkspaceOptional } from "@/src/workspace-context";

function resolveSvgXml(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  if (isContentUrl(raw)) return null;
  return prepareSvgDocument(raw) ?? (raw.trim().startsWith("<") ? raw.trim() : null);
}

/**
 * Inline SVG drawing for chat. Tap opens the workspace viewer.
 */
export function WorkspaceSvgPreview({
  path,
  label,
  content: contentProp,
}: {
  readonly path: string;
  readonly label?: string;
  readonly content?: string | null;
}) {
  const workspace = useWorkspaceOptional();
  const chatId = workspace?.chatId ?? null;
  const [fetched, setFetched] = useState<string | null>(null);
  const [loading, setLoading] = useState(
    contentProp == null && Boolean(chatId),
  );

  useEffect(() => {
    if (contentProp != null) {
      setFetched(null);
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
      setFetched(text);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [chatId, contentProp, path]);

  const xml = useMemo(
    () => resolveSvgXml(contentProp ?? fetched),
    [contentProp, fetched],
  );
  const name = label ?? fileBasename(path);

  return (
    <View className="w-full max-w-sm gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${name}`}
        className="border-border/50 bg-card overflow-hidden rounded-2xl border"
        onPress={() => {
          void workspace?.openPath(path, contentProp ?? fetched ?? undefined);
        }}
      >
        <View className="bg-muted/40 min-h-36 items-center justify-center p-4">
          {xml ? (
            <SvgXml xml={xml} width="100%" height={160} />
          ) : loading ? (
            <ActivityIndicator />
          ) : (
            <Text className="text-muted-foreground text-xs">SVG unavailable</Text>
          )}
        </View>
      </Pressable>
      {label != null ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Open ${path}`}
          onPress={() => {
            void workspace?.openPath(path, contentProp ?? fetched ?? undefined);
          }}
        >
          <Text className="text-primary text-[15px] underline">{label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function isWorkspaceSvgPath(path: string): boolean {
  return isSvgWorkspacePath(path);
}
