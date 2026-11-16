import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  Body,
  Button,
  Caption,
  Field,
  Loading,
  Screen,
  SectionLabel,
  useTheme,
} from "@/components/ui";
import {
  deleteIssue,
  fetchIssue,
  fetchProjects,
  setIssueResolved,
  updateIssue,
  type IssueDto,
  type ProjectDto,
} from "@/lib/api";

export default function TaskDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const issueId = typeof id === "string" ? id : "";
  const [issue, setIssue] = useState<IssueDto | null>(null);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = useCallback((row: IssueDto) => {
    setIssue(row);
    setTitle(row.title);
    setDescription(row.description ?? "");
    setDueDate(row.dueDate ?? "");
    setReviewDate(row.reviewDate ?? "");
    setProjectId(row.projectId);
  }, []);

  const reload = useCallback(async () => {
    try {
      setError(null);
      apply(await fetchIssue(issueId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load task.");
    }
  }, [apply, issueId]);

  useEffect(() => {
    void reload();
    void fetchProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [reload]);

  const save = (patch: Parameters<typeof updateIssue>[1]) => {
    if (!issue || busy) return;
    setBusy(true);
    setError(null);
    void updateIssue(issue.id, patch)
      .then(apply)
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Could not save.");
      })
      .finally(() => setBusy(false));
  };

  const toggleResolved = () => {
    if (!issue || busy) return;
    setBusy(true);
    void setIssueResolved(issue.id, issue.status !== "resolved")
      .then(apply)
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Could not update.");
      })
      .finally(() => setBusy(false));
  };

  const remove = () => {
    if (!issue || busy) return;
    Alert.alert("Delete task?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setBusy(true);
          void deleteIssue(issue.id)
            .then(() => {
              if (router.canGoBack()) router.back();
              else router.replace("/(tabs)");
            })
            .catch((cause) => {
              setError(
                cause instanceof Error ? cause.message : "Could not delete.",
              );
              setBusy(false);
            });
        },
      },
    ]);
  };

  if (!issue && !error) {
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
          title: "Task",
          headerRight: () => (
            <Pressable onPress={remove} hitSlop={12} style={{ paddingHorizontal: 4 }}>
              <Body>Delete</Body>
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {error ? <Caption>{error}</Caption> : null}
          <Field
            value={title}
            onChangeText={setTitle}
            onEndEditing={() => {
              if (title.trim() && title.trim() !== issue?.title) {
                save({ title: title.trim() });
              }
            }}
          />
          <Field
            multiline
            placeholder="Notes"
            value={description}
            onChangeText={setDescription}
            onEndEditing={() => {
              const next = description.trim() || null;
              if (next !== (issue?.description ?? null)) {
                save({ description: next });
              }
            }}
            style={{ minHeight: 100, textAlignVertical: "top" }}
          />
          <Field
            placeholder="Due date (YYYY-MM-DD)"
            autoCapitalize="none"
            value={dueDate}
            onChangeText={setDueDate}
            onEndEditing={() => {
              const next = dueDate.trim() || null;
              if (next !== (issue?.dueDate ?? null)) {
                save({ dueDate: next });
              }
            }}
          />
          <Field
            placeholder="Review date (YYYY-MM-DD)"
            autoCapitalize="none"
            value={reviewDate}
            onChangeText={setReviewDate}
            onEndEditing={() => {
              const next = reviewDate.trim() || null;
              if (next !== (issue?.reviewDate ?? null)) {
                save({ reviewDate: next });
              }
            }}
          />

          <SectionLabel>Project</SectionLabel>
          <Pressable
            onPress={() => {
              if (projectId !== null) {
                setProjectId(null);
                save({ projectId: null });
              }
            }}
            style={{
              paddingVertical: 10,
              borderBottomWidth: 0.5,
              borderBottomColor: theme.border,
            }}
          >
            <Body>{projectId === null ? "● Inbox" : "○ Inbox"}</Body>
          </Pressable>
          {projects.map((project) => (
            <Pressable
              key={project.id}
              onPress={() => {
                if (projectId !== project.id) {
                  setProjectId(project.id);
                  save({ projectId: project.id });
                }
              }}
              style={{
                paddingVertical: 10,
                borderBottomWidth: 0.5,
                borderBottomColor: theme.border,
              }}
            >
              <Body>
                {projectId === project.id ? "● " : "○ "}
                {project.name}
              </Body>
            </Pressable>
          ))}

          <View style={{ marginTop: 12, gap: 10 }}>
            <Button
              label={
                issue?.status === "resolved" ? "Reopen task" : "Mark resolved"
              }
              onPress={toggleResolved}
              disabled={busy}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
