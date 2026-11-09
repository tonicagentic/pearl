import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import {
  createProjectRequest,
  fetchProjects,
  type ProjectDto,
} from "@/src/projects-client";

/** Sheet to pick or create a project before Plan-mode sends. */
export function ProjectPickerModal({
  open,
  onClose,
  onSelect,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSelect: (project: { readonly id: string; readonly name: string }) => void;
}) {
  const [projects, setProjects] = useState<readonly ProjectDto[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const insets = useSafeAreaInsets();
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  useEffect(() => {
    if (!open) return;
    setName("");
    setError(null);
    setLoading(true);
    void fetchProjects()
      .then((rows) => setProjects(rows))
      .catch((cause) => {
        setError(
          cause instanceof Error ? cause.message : "Could not load projects.",
        );
      })
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-foreground/50">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close project picker"
          className="flex-1"
          onPress={onClose}
        />
        <View
          className="max-h-[85%] rounded-t-2xl border-t border-border"
          style={{
            backgroundColor,
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          <View className="items-center py-2">
            <View className="h-1 w-10 rounded-full bg-border" />
          </View>
          <View className="gap-1 px-4 pb-3">
            <Text className="text-lg font-semibold text-foreground">
              Choose a project
            </Text>
            <Text className="text-sm text-muted-foreground">
              Plan mode writes into a project. Pick an existing one or create a
              new project for this chat.
            </Text>
          </View>
          {error ? (
            <Text className="px-4 pb-2 text-sm text-destructive">{error}</Text>
          ) : null}
          {loading ? (
            <View className="items-center py-8">
              <ActivityIndicator />
            </View>
          ) : (
            <ScrollView
              className="px-4"
              contentContainerClassName="gap-2 pb-3"
              keyboardShouldPersistTaps="handled"
            >
              {projects.length === 0 ? (
                <Text className="py-2 text-sm text-muted-foreground">
                  No projects yet. Create one below.
                </Text>
              ) : (
                projects.map((project) => (
                  <Pressable
                    key={project.id}
                    accessibilityRole="button"
                    className="min-h-12 justify-center rounded-lg border border-border/60 px-3"
                    onPress={() => {
                      onSelect({ id: project.id, name: project.name });
                      onClose();
                    }}
                  >
                    <Text className="text-base font-medium text-foreground">
                      {project.name}
                    </Text>
                  </Pressable>
                ))
              )}
              <View className="mt-2 gap-2 border-t border-border/60 pt-3">
                <TextInput
                  accessibilityLabel="New project name"
                  className="min-h-11 rounded-lg border border-border px-3 text-base text-foreground"
                  maxLength={120}
                  onChangeText={setName}
                  placeholder="New project name"
                  placeholderTextColor={placeholderColor}
                  value={name}
                />
                <Pressable
                  accessibilityRole="button"
                  className="min-h-11 items-center justify-center rounded-lg bg-primary disabled:opacity-40"
                  disabled={creating || !name.trim()}
                  onPress={() => {
                    setCreating(true);
                    setError(null);
                    void createProjectRequest({ name: name.trim() })
                      .then((project) => {
                        onSelect({ id: project.id, name: project.name });
                        onClose();
                      })
                      .catch((cause) => {
                        setError(
                          cause instanceof Error
                            ? cause.message
                            : "Could not create the project.",
                        );
                      })
                      .finally(() => setCreating(false));
                  }}
                >
                  <Text className="text-sm font-medium text-primary-foreground">
                    {creating ? "Creating…" : "Create and use"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
