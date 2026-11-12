import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { PlusIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { CreateProjectModal } from "@/components/create-project-modal";
import { ProjectMark } from "@/components/project-mark";
import { Icon } from "@/components/ui/icon";
import { fetchProjects, type ProjectDto } from "@/src/projects-client";

/** Projects list: create a project or open its detail. */
export function ProjectsScreen() {
  const [projects, setProjects] = useState<readonly ProjectDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;

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
    <SafeAreaView
      style={{ flex: 1, backgroundColor }}
      edges={["left", "right"]}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Projects",
          headerTintColor: foregroundColor,
          headerRight:
            Platform.OS === "ios"
              ? undefined
              : () => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="New project"
                    className="h-10 w-10 items-center justify-center"
                    onPress={() => setShowForm(true)}
                  >
                    <Icon as={PlusIcon} className="size-5 text-foreground" />
                  </Pressable>
                ),
        }}
      />
      {Platform.OS === "ios" ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="plus"
            accessibilityLabel="New project"
            onPress={() => setShowForm(true)}
          />
        </Stack.Toolbar>
      ) : null}

      {error ? (
        <Pressable className="px-5 py-3" onPress={() => void reload()}>
          <Text className="text-sm text-destructive">
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
          contentContainerClassName="pb-24 pt-4"
          contentInsetAdjustmentBehavior="automatic"
        >
          {(projects ?? []).length === 0 ? (
            <View className="py-8">
              <Text className="text-base font-medium text-foreground">
                No projects yet
              </Text>
              <Text className="text-muted-foreground mt-1.5 text-sm leading-5">
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
                  <Text
                    className="text-[16px] font-medium text-foreground"
                    numberOfLines={1}
                  >
                    {project.name}
                  </Text>
                  {project.instructions.trim() ? (
                    <Text
                      className="mt-0.5 text-[13px] text-muted-foreground"
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
    </SafeAreaView>
  );
}
