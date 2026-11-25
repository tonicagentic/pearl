import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { PlusIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { ScreenChrome } from "@/components/navigation/screen-chrome";
import { CreateNoteModal } from "@/components/notes/create-note-modal";
import { Text } from "@/components/ui/text";
import {
  fetchAllNotes,
  type NoteSummaryDto,
} from "@/src/notes-client";

/** Notes hub: all notes by updatedAt with optional project filing. */
export function NotesScreen() {
  const [notes, setNotes] = useState<readonly NoteSummaryDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const reload = useCallback(async () => {
    try {
      setError(null);
      setNotes(await fetchAllNotes());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load notes.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
          const rows = await fetchAllNotes();
          if (!cancelled) {
            setNotes(rows);
            setError(null);
          }
        } catch (cause) {
          if (!cancelled) {
            setError(
              cause instanceof Error ? cause.message : "Failed to load notes.",
            );
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <ScreenChrome
      title="Notes"
      leading="drawer"
      actions={[
        {
          label: "New note",
          systemImage: "plus",
          icon: PlusIcon,
          onPress: () => setComposerOpen(true),
        },
      ]}
    >
      <View style={{ flex: 1, backgroundColor }}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pt-0"
          contentContainerStyle={{ paddingBottom: 24 }}
          contentInsetAdjustmentBehavior="automatic"
        >
          {error ? (
            <Pressable
              accessibilityRole="button"
              className="mb-4 rounded-2xl bg-destructive/10 px-4 py-3"
              onPress={() => void reload()}
            >
              <Text variant="secondary" tone="destructive">
                {error}
              </Text>
              <Text
                variant="caption"
                tone="destructive"
                className="mt-1 opacity-80"
              >
                Tap to retry
              </Text>
            </Pressable>
          ) : null}

          {notes === null && !error ? (
            <ActivityIndicator color={placeholderColor ?? undefined} />
          ) : notes?.length === 0 ? (
            <Text variant="body" tone="muted" className="px-1 py-8">
              No notes yet.
            </Text>
          ) : (
            <View className="overflow-hidden rounded-2xl bg-muted/35">
              {(notes ?? []).map((note, index) => (
                <View key={note.id}>
                  {index > 0 ? (
                    <View className="mx-4 h-px bg-border" />
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={note.title}
                    className="min-h-14 px-4 py-3.5 active:opacity-80"
                    onPress={() =>
                      router.push(`/notes/${encodeURIComponent(note.id)}`)
                    }
                  >
                    <Text variant="label" numberOfLines={1}>
                      {note.title}
                    </Text>
                    <Text variant="caption" tone="muted" className="mt-1">
                      {note.projectName ?? "No project"} ·{" "}
                      {formatUpdated(note.updatedAt)}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <CreateNoteModal
          open={composerOpen}
          onClose={() => setComposerOpen(false)}
          onCreated={(created) => {
            setComposerOpen(false);
            router.push(`/notes/${encodeURIComponent(created.id)}`);
          }}
        />
      </View>
    </ScreenChrome>
  );
}

function formatUpdated(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
