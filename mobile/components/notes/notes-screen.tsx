import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { PlusIcon } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { useCSSVariable } from "uniwind";

import { ScreenChrome } from "@/components/navigation/screen-chrome";
import { CreateNoteModal } from "@/components/notes/create-note-modal";
import { Text } from "@/components/ui/text";
import { fetchAllNotes } from "@/src/notes-client";
import { useNetworkStatus } from "@/src/network-status";
import {
  queryErrorMessage,
  queryKeys,
  showQueryErrorBanner,
} from "@/src/query-client";

/** Notes hub: all notes by updatedAt with optional project filing. */
export function NotesScreen() {
  const { offline } = useNetworkStatus();
  const [composerOpen, setComposerOpen] = useState(false);
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const notesQuery = useQuery({
    queryKey: queryKeys.notes,
    queryFn: fetchAllNotes,
  });

  useFocusEffect(
    useCallback(() => {
      void notesQuery.refetch();
    }, [notesQuery.refetch]),
  );

  const notes = notesQuery.data ?? null;
  const showError = showQueryErrorBanner(offline, notesQuery.error);

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
          {showError ? (
            <Pressable
              accessibilityRole="button"
              className="mb-4 rounded-2xl bg-destructive/10 px-4 py-3"
              onPress={() => void notesQuery.refetch()}
            >
              <Text variant="secondary" tone="destructive">
                {queryErrorMessage(notesQuery.error, "Failed to load notes.")}
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

          {notes === null && notesQuery.isPending ? (
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