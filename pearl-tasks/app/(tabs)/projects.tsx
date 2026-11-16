import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { router, Stack, useFocusEffect } from "expo-router";
import {
  Body,
  Caption,
  Card,
  Loading,
  Screen,
  useTheme,
} from "@/components/ui";
import { fetchProjects, type ProjectDto } from "@/lib/api";

export default function ProjectsScreen() {
  const theme = useTheme();
  const [projects, setProjects] = useState<ProjectDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: "Projects",
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/project/new")}
              hitSlop={12}
              style={{ paddingHorizontal: 4 }}
            >
              <Body>New</Body>
            </Pressable>
          ),
        }}
      />
      {projects === null && !error ? (
        <Loading />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={theme.tint}
              onRefresh={() => {
                setRefreshing(true);
                void reload().finally(() => setRefreshing(false));
              }}
            />
          }
        >
          {error ? (
            <Pressable onPress={() => void reload()}>
              <Body muted>{error} Tap to retry.</Body>
            </Pressable>
          ) : null}
          {(projects ?? []).length === 0 ? (
            <Caption>
              No projects yet. Create one to group tasks for a body of work.
            </Caption>
          ) : (
            <Card>
              {(projects ?? []).map((project, index) => (
                <Pressable
                  key={project.id}
                  onPress={() =>
                    router.push(`/project/${encodeURIComponent(project.id)}`)
                  }
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderBottomWidth:
                      index < (projects?.length ?? 0) - 1 ? 0.5 : 0,
                    borderBottomColor: theme.border,
                  })}
                >
                  <Body>{project.name}</Body>
                  {project.instructions.trim() ? (
                    <Caption numberOfLines={2}>{project.instructions}</Caption>
                  ) : null}
                </Pressable>
              ))}
            </Card>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
