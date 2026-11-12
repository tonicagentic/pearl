import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowUpIcon, XIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { ProjectMark } from "@/components/project-mark";
import { Icon } from "@/components/ui/icon";
import {
  createProjectRequest,
  type ProjectDto,
} from "@/src/projects-client";

/** Full-screen new-project composer shared by the list and plan-mode picker. */
export function CreateProjectModal({
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
  const insets = useSafeAreaInsets();
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const canSubmit = name.trim().length > 0 && !busy;

  useEffect(() => {
    if (!open) return;
    setName("");
    setInstructions("");
    setError(null);
    setBusy(false);
  }, [open]);

  const submit = () => {
    if (!canSubmit) return;
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
  };

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
        style={{ backgroundColor, paddingTop: insets.top }}
      >
        <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            className="h-10 w-10 items-center justify-center rounded-full bg-muted/60 active:opacity-80"
            onPress={onClose}
          >
            <Icon as={XIcon} className="size-5 text-foreground" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create project"
            className={`h-10 w-10 items-center justify-center rounded-full ${canSubmit ? "bg-foreground" : "bg-muted/60"}`}
            disabled={!canSubmit}
            onPress={submit}
          >
            {busy ? (
              <ActivityIndicator size="small" />
            ) : (
              <Icon
                as={ArrowUpIcon}
                className={`size-5 ${canSubmit ? "text-background" : "text-muted-foreground"}`}
              />
            )}
          </Pressable>
        </View>

        <View className="flex-1 px-5 pt-4">
          <View className="mb-4">
            <ProjectMark name={name || "project"} size="lg" />
          </View>
          {error ? (
            <Text className="mb-3 text-sm text-destructive">{error}</Text>
          ) : null}
          <TextInput
            accessibilityLabel="Project name"
            autoFocus
            className="min-h-12 text-[28px] font-semibold tracking-tight text-foreground"
            maxLength={120}
            onChangeText={setName}
            onSubmitEditing={submit}
            placeholder="Project name"
            placeholderTextColor={placeholderColor}
            returnKeyType="next"
            value={name}
          />
          <TextInput
            accessibilityLabel="Project summary"
            className="mt-2 min-h-24 text-[16px] leading-6 text-foreground"
            multiline
            onChangeText={setInstructions}
            placeholder="Short summary…"
            placeholderTextColor={placeholderColor}
            textAlignVertical="top"
            value={instructions}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
