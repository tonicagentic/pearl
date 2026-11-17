import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { router } from "expo-router";
import { useCSSVariable } from "uniwind";

import { CreateProjectModal } from "@/components/home/create-project-modal";
import { ProjectMark } from "@/components/project-mark";
import { Text } from "@/components/ui/text";
import { fetchProjects, type ProjectDto } from "@/src/projects-client";

export type ProjectsScreenHandle = {
  readonly openComposer: () => void;
};

/** Projects list for the Mail home shell (Chats / Projects). */
export const ProjectsScreen = forwardRef<
  ProjectsScreenHandle,
  {
    readonly bottomInset?: number;
  }
>(function ProjectsScreen({ bottomInset = 0 }, ref) {
  const [projects, setProjects] = useState<readonly ProjectDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

  useImperativeHandle(
    ref,
    () => ({
      openComposer: () => setShowForm(true),
    }),
    [],
  );

  const reload = useCallback(async () => {
    try {
      setError(null);
      setProjects(await fetchProjects());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to load projects.",
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchProjects();
        if (!cancelled) {
          setProjects(rows);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Failed to load projects.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
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
          contentContainerStyle={{ paddingBottom: 24 + bottomInset }}
          contentInsetAdjustmentBehavior="automatic"
        >
          {(projects ?? []).length === 0 ? (
            <View className="py-8">
              <Text variant="body" weight="medium">
                No projects yet
              </Text>
              <Text variant="secondary" className="mt-1.5">
                Create a project to draft plans and keep related chats together.
              </Text>
            </View>
          ) : (
            (projects ?? []).map((project) => (
              <Pressable
                key={project.id}
                accessibilityRole="button"
                className="min-h-12 flex-row items-center gap-3 py-3 active:opacity-80"
                onPress={() =>
                  router.push(`/projects/${encodeURIComponent(project.id)}`)
                }
              >
                <ProjectMark name={project.name} />
                <View className="min-w-0 flex-1">
                  <Text variant="body" weight="medium" numberOfLines={1}>
                    {project.name}
                  </Text>
                  {project.instructions.trim() ? (
                    <Text variant="secondary" className="mt-0.5" numberOfLines={1}>
                      {project.instructions.trim()}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      <CreateProjectModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onCreated={(project) => {
          setShowForm(false);
          setProjects((current) =>
            current
              ? [...current, project].sort((a, b) =>
                  a.name.localeCompare(b.name),
                )
              : [project],
          );
          router.push(`/projects/${encodeURIComponent(project.id)}`);
        }}
      />
    </View>
  );
});
