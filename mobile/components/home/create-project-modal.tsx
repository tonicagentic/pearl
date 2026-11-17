import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { BottomSheet, RNHostView } from "@expo/ui";
import { ArrowUpIcon, XIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { ProjectMark } from "@/components/project-mark";
import { Icon } from "@/components/ui/icon";
import { Text, textVariants } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import {
  createProjectRequest,
  type ProjectDto,
} from "@/src/projects-client";

/** New-project composer in an Expo UI bottom sheet. */
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
    <BottomSheet
      isPresented={open}
      onDismiss={onClose}
      snapPoints={["half", "full"]}
      containerColor={backgroundColor}
      contentPadding={{ top: 4, left: 0, right: 0, bottom: 0 }}
    >
      {/* RNHostView so Pressable/TextInput receive touches inside the SwiftUI sheet. */}
      <RNHostView matchContents>
        <View className="px-5 pb-6 pt-1">
          <View className="mb-3 flex-row items-center justify-between">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full bg-muted/60 active:opacity-80"
              onPress={onClose}
            >
              <Icon as={XIcon} className="size-5 text-foreground" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create project"
              hitSlop={8}
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

          <View className="mb-4">
            <ProjectMark name={name || "project"} size="lg" />
          </View>
          {error ? (
            <Text variant="secondary" tone="destructive" className="mb-3">
              {error}
            </Text>
          ) : null}
          <TextInput
            accessibilityLabel="Project name"
            autoFocus
            className={cn(
              "min-h-12 tracking-tight",
              textVariants({ variant: "display" }),
            )}
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
            className={cn("mt-2 min-h-24", textVariants({ variant: "body" }))}
            multiline
            onChangeText={setInstructions}
            placeholder="Short summary…"
            placeholderTextColor={placeholderColor}
            textAlignVertical="top"
            value={instructions}
          />
        </View>
      </RNHostView>
    </BottomSheet>
  );
}
