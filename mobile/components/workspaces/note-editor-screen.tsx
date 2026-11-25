import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useCSSVariable } from "uniwind";

import { MarkdownRichEditor } from "@/components/markdown-rich-editor";
import { LoadingCenter } from "@/components/ui/loading-center";
import { StackScreen } from "@/components/ui/stack-screen";
import { Text } from "@/components/ui/text";
import {
  deleteNoteRequest,
  fetchNote,
  updateNoteRequest,
  type NoteDto,
} from "@/src/notes-client";

/** Canonical note editor — loads by noteId via GET /api/notes/[id]. */
export function NoteEditorScreen({
  noteId,
}: {
  readonly noteId: string;
}) {
  const [note, setNote] = useState<NoteDto | null>(null);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const row = await fetchNote(noteId);
        if (!cancelled) {
          setNote(row);
          setTitle(row.title);
          setMarkdown(row.markdown);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "Failed to load note.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  const dirty =
    note !== null &&
    (title.trim() !== note.title || markdown !== note.markdown);

  const save = useCallback(() => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    void updateNoteRequest(noteId, {
      title: title.trim() || "Untitled note",
      markdown,
    })
      .then((row) => {
        setNote(row);
        setTitle(row.title);
        setMarkdown(row.markdown);
      })
      .catch((cause) => {
        setError(
          cause instanceof Error ? cause.message : "Could not save note.",
        );
      })
      .finally(() => setSaving(false));
  }, [dirty, markdown, noteId, saving, title]);

  const confirmDelete = useCallback(() => {
    Alert.alert("Delete note?", title || "Untitled note", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteNoteRequest(noteId)
            .then(() => {
              if (router.canGoBack()) router.back();
              else router.replace("/notes");
            })
            .catch((cause) => {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Could not delete note.",
              );
            });
        },
      },
    ]);
  }, [noteId, title]);

  if (!note && !error) {
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

        {note?.projectName ? (
          <Text variant="caption" tone="muted">
            {note.projectName}
          </Text>
        ) : note ? (
          <Text variant="caption" tone="muted">
            No project
          </Text>
        ) : null}

        <TextInput
          className="text-xl font-semibold text-foreground"
          onChangeText={setTitle}
          placeholder="Note title"
          placeholderTextColor={placeholderColor}
          value={title}
        />

        <MarkdownRichEditor
          defaultValue={note?.markdown ?? ""}
          onChangeMarkdown={setMarkdown}
          placeholder="Write your note…"
        />

        <View className="flex-row flex-wrap gap-3">
          <Pressable
            className="rounded-full bg-foreground px-4 py-2.5"
            disabled={!dirty || saving}
            onPress={save}
          >
            <Text className="text-sm font-medium text-background">
              {saving ? "Saving…" : "Save"}
            </Text>
          </Pressable>
          <Pressable
            className="rounded-full border border-border px-4 py-2.5"
            onPress={confirmDelete}
          >
            <Text className="text-sm font-medium text-destructive">Delete</Text>
          </Pressable>
        </View>
      </ScrollView>
    </StackScreen>
  );
}
