import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useCSSVariable } from "uniwind";

import { MarkdownRichEditor } from "@/components/markdown-rich-editor";
import { revealChatThread } from "@/components/chat-history-push";
import { LoadingCenter } from "@/components/ui/loading-center";
import { StackScreen } from "@/components/ui/stack-screen";
import { Text } from "@/components/ui/text";
import { setAgentMode } from "@/src/agent-mode";
import { useChats } from "@/src/chat-context";
import {
  carryOutProjectFileRequest,
  fetchProjectFileContent,
  unlinkProjectArtifactRequest,
  updateProjectFileRequest,
  type ProjectArtifactDto,
} from "@/src/projects-client";

/** Project file editor — enriched markdown for .md, plain otherwise. */
export function FileEditorScreen({
  projectId,
  artifactId,
}: {
  readonly projectId: string;
  readonly artifactId: string;
}) {
  const { selectChat, setActiveProjectId } = useChats();
  const [artifact, setArtifact] = useState<ProjectArtifactDto | null>(null);
  const [path, setPath] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [carryingOut, setCarryingOut] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const isMarkdown = useMemo(() => {
    const name = artifact?.pathname ?? "";
    return /\.(md|markdown)$/i.test(name) || name.includes("/docs/plans/");
  }, [artifact?.pathname]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const row = await fetchProjectFileContent(projectId, artifactId);
        if (!cancelled) {
          setArtifact(row.artifact);
          setPath(row.path);
          setTitle(row.artifact.title);
          setContent(row.content);
          setLoaded(true);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "Failed to load file.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, artifactId]);

  const [baseline, setBaseline] = useState<{
    title: string;
    content: string;
  } | null>(null);
  useEffect(() => {
    if (loaded && artifact && baseline === null) {
      setBaseline({ title: artifact.title, content });
    }
  }, [artifact, baseline, content, loaded]);

  const isDirty =
    baseline !== null &&
    (title.trim() !== baseline.title || content !== baseline.content);

  const save = useCallback(() => {
    if (!isDirty || saving) return;
    setSaving(true);
    setError(null);
    void updateProjectFileRequest(projectId, artifactId, {
      title: title.trim() || "Untitled",
      content,
    })
      .then((row) => {
        setArtifact(row.artifact);
        setPath(row.path);
        setTitle(row.artifact.title);
        setContent(row.content);
        setBaseline({ title: row.artifact.title, content: row.content });
      })
      .catch((cause) => {
        setError(
          cause instanceof Error ? cause.message : "Could not save file.",
        );
      })
      .finally(() => setSaving(false));
  }, [artifactId, content, isDirty, projectId, saving, title]);

  const confirmUnlink = useCallback(() => {
    Alert.alert("Unlink file?", title || "File", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unlink",
        style: "destructive",
        onPress: () => {
          void unlinkProjectArtifactRequest(projectId, artifactId)
            .then(() => {
              if (router.canGoBack()) router.back();
              else
                router.replace(
                  `/workspaces/projects/${encodeURIComponent(projectId)}`,
                );
            })
            .catch((cause) => {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Could not unlink file.",
              );
            });
        },
      },
    ]);
  }, [artifactId, projectId, title]);

  const carryOut = useCallback(() => {
    const run = () => {
      setCarryingOut(true);
      setError(null);
      void carryOutProjectFileRequest(projectId, artifactId)
        .then(async (result) => {
          setAgentMode("agent");
          setActiveProjectId(result.projectId);
          revealChatThread();
          await selectChat(result.chatId);
        })
        .catch((cause) => {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not start carry-out chat.",
          );
        })
        .finally(() => setCarryingOut(false));
    };

    if (isDirty) {
      setSaving(true);
      void updateProjectFileRequest(projectId, artifactId, {
        title: title.trim() || "Untitled",
        content,
      })
        .then((row) => {
          setArtifact(row.artifact);
          setBaseline({ title: row.artifact.title, content: row.content });
          run();
        })
        .catch((cause) => {
          setError(
            cause instanceof Error ? cause.message : "Could not save file.",
          );
        })
        .finally(() => setSaving(false));
      return;
    }
    run();
  }, [
    artifactId,
    content,
    isDirty,
    projectId,
    selectChat,
    setActiveProjectId,
    title,
  ]);

  if (!loaded && !error) {
    return (
      <StackScreen>
        <LoadingCenter />
      </StackScreen>
    );
  }

  return (
    <StackScreen>
      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="pb-28 gap-4"
        contentContainerStyle={{ paddingTop: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {error ? (
          <Text className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </Text>
        ) : null}

        <TextInput
          className="text-xl font-semibold text-foreground"
          onChangeText={setTitle}
          placeholder="File title"
          placeholderTextColor={placeholderColor}
          value={title}
        />
        {path ? (
          <Text className="text-xs text-muted-foreground" numberOfLines={2}>
            {path}
          </Text>
        ) : null}

        {loaded ? (
          <MarkdownRichEditor
            defaultValue={content}
            onChangeMarkdown={setContent}
            placeholder="File contents…"
            plainText={!isMarkdown}
          />
        ) : null}

        <View className="flex-row flex-wrap gap-3">
          <Pressable
            className="rounded-full bg-foreground px-4 py-2.5"
            disabled={!isDirty || saving}
            onPress={save}
          >
            <Text className="text-sm font-medium text-background">
              {saving ? "Saving…" : "Save"}
            </Text>
          </Pressable>
          {isMarkdown ? (
            <Pressable
              className="rounded-full border border-border px-4 py-2.5"
              disabled={carryingOut}
              onPress={carryOut}
            >
              <Text className="text-sm font-medium text-foreground">
                {carryingOut ? "Starting…" : "Carry out"}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            className="rounded-full border border-border px-4 py-2.5"
            onPress={confirmUnlink}
          >
            <Text className="text-sm font-medium text-destructive">Unlink</Text>
          </Pressable>
        </View>
      </ScrollView>
    </StackScreen>
  );
}
