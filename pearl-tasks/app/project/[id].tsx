import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  Body,
  Button,
  Caption,
  Field,
  Loading,
  Screen,
  useTheme,
} from "@/components/ui";
import { TaskList } from "@/components/task-list";
import {
  deleteProject,
  fetchIssues,
  fetchProjects,
  updateProject,
  type IssueDto,
  type ProjectDto,
} from "@/lib/api";

export default function ProjectDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = typeof id === "string" ? id : "";
  const [project, setProject] = useState<ProjectDto | null>(null);
  const [issues, setIssues] = useState<IssueDto[] | null>(null);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const [projects, payload] = await Promise.all([
        fetchProjects(),
        fetchIssues(),
      ]);
      const owned = projects.find((row) => row.id === projectId) ?? null;
      if (!owned) {
        setError("Project not found.");
        setProject(null);
        setIssues([]);
        return;
      }
      setProject(owned);
      setName(owned.name);
      setInstructions(owned.instructions);
      setIssues(payload.issues.filter((issue) => issue.projectId === projectId));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to load project.",
      );
    }
  }, [projectId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const saveMeta = () => {
    if (!project || busy || !name.trim()) return;
    if (
      name.trim() === project.name &&
      instructions === project.instructions
    ) {
      return;
    }
    setBusy(true);
    void updateProject(project.id, {
      name: name.trim(),
      instructions,
    })
      .then((next) => {
        setProject(next);
        setName(next.name);
        setInstructions(next.instructions);
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Could not save.");
      })
      .finally(() => setBusy(false));
  };

  const remove = () => {
    if (!project || busy) return;
    Alert.alert(
      "Delete project?",
      "Tasks in this project move back to the inbox.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setBusy(true);
            void deleteProject(project.id)
              .then(() => {
                if (router.canGoBack()) router.back();
                else router.replace("/(tabs)/projects");
              })
              .catch((cause) => {
                setError(
                  cause instanceof Error ? cause.message : "Could not delete.",
                );
                setBusy(false);
              });
          },
        },
      ],
    );
  };

  if (!project && !error) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: project?.name ?? "Project",
          headerRight: () => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/task/new",
                  params: { projectId },
                })
              }
              hitSlop={12}
              style={{ paddingHorizontal: 4 }}
            >
              <Body>Add</Body>
            </Pressable>
          ),
        }}
      />
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
        keyboardShouldPersistTaps="handled"
      >
        {error ? <Caption>{error}</Caption> : null}
        <Field
          value={name}
          onChangeText={setName}
          onEndEditing={saveMeta}
          placeholder="Project name"
        />
        <Field
          multiline
          value={instructions}
          onChangeText={setInstructions}
          onEndEditing={saveMeta}
          placeholder="Instructions"
          style={{ minHeight: 90, textAlignVertical: "top" }}
        />
        <TaskList
          issues={issues ?? []}
          emptyLabel="No tasks in this project yet."
        />
        <View style={{ marginTop: 16 }}>
          <Button
            label="Delete project"
            variant="danger"
            onPress={remove}
            disabled={busy}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
