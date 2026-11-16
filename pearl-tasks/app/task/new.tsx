import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Body,
  Button,
  Caption,
  Field,
  Screen,
  SectionLabel,
  useTheme,
} from "@/components/ui";
import { createIssue, fetchProjects, type ProjectDto } from "@/lib/api";

export default function NewTaskScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ projectId?: string }>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [projectId, setProjectId] = useState<string | null>(
    typeof params.projectId === "string" ? params.projectId : null,
  );
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  const submit = () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    void createIssue({
      title: title.trim(),
      description: description.trim() || undefined,
      projectId,
      dueDate: dueDate.trim() || null,
      reviewDate: reviewDate.trim() || null,
    })
      .then((issue) => {
        router.replace(`/task/${encodeURIComponent(issue.id)}`);
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Could not create.");
        setBusy(false);
      });
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Field
            autoFocus
            placeholder="Task title"
            value={title}
            onChangeText={setTitle}
          />
          <Field
            placeholder="Notes"
            multiline
            value={description}
            onChangeText={setDescription}
            style={{ minHeight: 100, textAlignVertical: "top" }}
          />
          <Field
            placeholder="Due date (YYYY-MM-DD)"
            autoCapitalize="none"
            value={dueDate}
            onChangeText={setDueDate}
          />
          <Field
            placeholder="Review date (YYYY-MM-DD)"
            autoCapitalize="none"
            value={reviewDate}
            onChangeText={setReviewDate}
          />

          <SectionLabel>Project</SectionLabel>
          <Pressable
            onPress={() => setProjectId(null)}
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
              onPress={() => setProjectId(project.id)}
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

          {error ? <Caption>{error}</Caption> : null}
          <View style={{ marginTop: 8 }}>
            <Button
              label={busy ? "Creating…" : "Create task"}
              onPress={submit}
              disabled={busy || !title.trim()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
