import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { router, Stack, useFocusEffect } from "expo-router";
import { Body, Loading, Screen, useTheme } from "@/components/ui";
import { TaskList } from "@/components/task-list";
import { fetchIssues, type IssueDto } from "@/lib/api";

export default function InboxScreen() {
  const theme = useTheme();
  const [issues, setIssues] = useState<IssueDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const payload = await fetchIssues();
      setIssues(payload.issues.filter((issue) => !issue.projectId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load tasks.");
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
          title: "Inbox",
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/task/new")}
              hitSlop={12}
              style={{ paddingHorizontal: 4 }}
            >
              <Body>New</Body>
            </Pressable>
          ),
        }}
      />
      {issues === null && !error ? (
        <Loading />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
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
          <TaskList
            issues={issues ?? []}
            emptyLabel="No inbox tasks. Add one, or file work under a project."
          />
        </ScrollView>
      )}
    </Screen>
  );
}
