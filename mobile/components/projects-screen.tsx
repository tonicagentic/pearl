import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import {
  createProjectRequest,
  fetchProjects,
  type ProjectDto,
} from "@/src/projects-client";

/** Projects list: create a project or open its detail. */
export function ProjectsScreen() {
  const [projects, setProjects] = useState<readonly ProjectDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const backgroundColor = useCSSVariable("--color-background") as
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
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={["left", "right"]}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-4">
        <Text className="text-[28px] font-semibold tracking-tight text-foreground">
          Projects
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New project"
          className="min-h-11 justify-center px-1"
          onPress={() => setShowForm(true)}
        >
          <Text className="text-[16px] font-medium text-foreground">New</Text>
        </Pressable>
      </View>

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
        <ScrollView className="flex-1 px-5" contentContainerClassName="pb-24">
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
                className="min-h-12 justify-center border-b border-border/60 py-3"
                onPress={() =>
                  router.push(`/projects/${encodeURIComponent(project.id)}`)
                }
              >
                <Text className="text-base font-medium text-foreground">
                  {project.name}
                </Text>
                {project.instructions.trim() ? (
                  <Text
                    className="text-muted-foreground mt-0.5 text-sm"
                    numberOfLines={2}
                  >
                    {project.instructions}
                  </Text>
                ) : null}
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

function CreateProjectModal({
  open,
  onClose,
  onCreated,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCreated: (project: ProjectDto) => void;
}) {
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  useEffect(() => {
    if (!open) return;
    setName("");
    setInstructions("");
    setError(null);
    setBusy(false);
  }, [open]);

  if (!open) return null;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-foreground/50">
        <Pressable className="flex-1" onPress={onClose} />
        <View
          className="gap-3 rounded-t-2xl border-t border-border px-4 pb-8 pt-4"
          style={{ backgroundColor }}
        >
          <Text className="text-lg font-semibold text-foreground">
            New project
          </Text>
          {error ? (
            <Text className="text-sm text-destructive">{error}</Text>
          ) : null}
          <TextInput
            accessibilityLabel="Project name"
            className="min-h-11 rounded-lg border border-border px-3 text-base text-foreground"
            maxLength={120}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor={placeholderColor}
            value={name}
          />
          <TextInput
            accessibilityLabel="Project instructions"
            className="min-h-24 rounded-lg border border-border px-3 py-2 text-base text-foreground"
            multiline
            onChangeText={setInstructions}
            placeholder="Optional instructions"
            placeholderTextColor={placeholderColor}
            textAlignVertical="top"
            value={instructions}
          />
          <Pressable
            accessibilityRole="button"
            className="min-h-11 items-center justify-center rounded-lg bg-primary"
            disabled={busy || !name.trim()}
            onPress={() => {
              setBusy(true);
              setError(null);
              void createProjectRequest({
                name: name.trim(),
                instructions: instructions.trim() || undefined,
              })
                .then(onCreated)
                .catch((cause) => {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Could not create the project.",
                  );
                  setBusy(false);
                });
            }}
          >
            <Text className="text-sm font-medium text-primary-foreground">
              {busy ? "Creating…" : "Create"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
