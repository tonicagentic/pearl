import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PlusIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { CreateProjectModal } from "@/components/create-project-modal";
import { ProjectMark } from "@/components/project-mark";
import { Icon } from "@/components/ui/icon";
import { fetchProjects, type ProjectDto } from "@/src/projects-client";

/** Sheet to pick or create a project before Plan-mode sends. */
export function ProjectPickerModal({
  open,
  onClose,
  onSelect,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSelect: (project: {
    readonly id: string;
    readonly name: string;
  }) => void;
}) {
  const [projects, setProjects] = useState<readonly ProjectDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const insets = useSafeAreaInsets();
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setShowCreate(false);
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
    <>
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
                contentContainerClassName="gap-1 pb-3"
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
                      className="min-h-12 flex-row items-center gap-3 rounded-lg px-2 py-2 active:bg-muted/50"
                      onPress={() => {
                        onSelect({ id: project.id, name: project.name });
                        onClose();
                      }}
                    >
                      <ProjectMark name={project.name} size="sm" />
                      <Text
                        className="min-w-0 flex-1 text-base font-medium text-foreground"
                        numberOfLines={1}
                      >
                        {project.name}
                      </Text>
                    </Pressable>
                  ))
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="New project"
                  className="mt-2 min-h-12 flex-row items-center gap-3 rounded-lg border border-border/60 px-3 active:bg-muted/40"
                  onPress={() => setShowCreate(true)}
                >
                  <View className="h-7 w-7 items-center justify-center rounded-lg bg-muted/60">
                    <Icon as={PlusIcon} className="size-4 text-foreground" />
                  </View>
                  <Text className="text-base font-medium text-foreground">
                    New project
                  </Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <CreateProjectModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(project) => {
          setShowCreate(false);
          onSelect({ id: project.id, name: project.name });
          onClose();
        }}
      />
    </>
  );
}
