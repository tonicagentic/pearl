import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { FolderIcon, PlusIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { ScreenChrome } from "@/components/navigation/screen-chrome";
import { CreateProjectModal } from "@/components/workspaces/create-project-modal";
import { ProjectMark } from "@/components/project-mark";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { fetchProjects, type ProjectDto } from "@/src/projects-client";
import { useStackSearch } from "@/src/use-stack-search";

/** Lists workspaces (projects) and opens the new-workspace composer. */
export function WorkspacesScreen() {
  const [projects, setProjects] = useState<readonly ProjectDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const search = useStackSearch();
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

  const ordered = useMemo(
    () =>
      [...(projects ?? [])].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      ),
    [projects],
  );
  const visible = useMemo(() => {
    if (!search.active) return ordered;
    return ordered.filter((project) =>
      search.matches(project.name, project.instructions),
    );
  }, [ordered, search.active, search.matches]);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setProjects(await fetchProjects());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to load workspaces.",
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void fetchProjects()
        .then((rows) => {
          if (!cancelled) {
            setProjects(rows);
            setError(null);
          }
        })
        .catch((cause) => {
          if (!cancelled) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Failed to load workspaces.",
            );
          }
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const openComposer = useCallback(() => setShowForm(true), []);

  return (
    <ScreenChrome
      title="Workspaces"
      leading="drawer"
      actions={[
        {
          label: "New workspace",
          systemImage: "plus",
          icon: PlusIcon,
          onPress: openComposer,
        },
      ]}
      search={{
        placeholder: "Search workspaces",
        hideWhenScrolling: true,
        autoCapitalize: "none",
        onChangeText: search.onChangeText,
        onCancelButtonPress: search.onCancelButtonPress,
      }}
    >
      <View style={{ flex: 1, backgroundColor }}>
        {error ? (
          <Pressable className="px-5 py-3" onPress={() => void reload()}>
            <Text variant="secondary" tone="destructive">
              {error} Tap to retry.
            </Text>
          </Pressable>
        ) : null}

        {projects === null && !error ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : (
          <ScrollView
            className="flex-1 px-5"
            contentContainerClassName="pt-0"
            contentContainerStyle={{ paddingBottom: 24 }}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
          >
            {!search.active && ordered.length === 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="New workspace"
                className="min-h-12 flex-row items-center gap-3 py-3 active:opacity-80"
                onPress={openComposer}
              >
                <View className="size-8 items-center justify-center rounded-lg bg-muted">
                  <Icon
                    as={FolderIcon}
                    className="size-4 text-muted-foreground"
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <Text variant="body" weight="medium">
                    New Workspace
                  </Text>
                  <Text variant="secondary" className="mt-0.5">
                    No workspaces yet
                  </Text>
                </View>
              </Pressable>
            ) : search.active && visible.length === 0 ? (
              <View className="py-8">
                <Text variant="secondary">No workspaces match</Text>
              </View>
            ) : (
              visible.map((project) => (
                <Pressable
                  key={project.id}
                  accessibilityRole="button"
                  accessibilityLabel={project.name}
                  className="min-h-12 flex-row items-center gap-3 py-3 active:opacity-80"
                  onPress={() =>
                    router.push(`/workspaces/projects/${encodeURIComponent(project.id)}`)
                  }
                >
                  <ProjectMark name={project.name} />
                  <View className="min-w-0 flex-1">
                    <Text variant="body" weight="medium" numberOfLines={1}>
                      {project.name}
                    </Text>
                    {project.instructions.trim() ? (
                      <Text
                        variant="secondary"
                        className="mt-0.5"
                        numberOfLines={1}
                      >
                        {project.instructions.trim()}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}
      </View>

      <CreateProjectModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onCreated={(project) => {
          setShowForm(false);
          setProjects((current) =>
            current
              ? [project, ...current.filter((row) => row.id !== project.id)]
              : [project],
          );
          router.push(`/workspaces/projects/${encodeURIComponent(project.id)}`);
        }}
      />
    </ScreenChrome>
  );
}
