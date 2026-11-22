import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowUpIcon, XIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { TaskDateField } from "@/components/tasks/task-date-field";
import { Icon } from "@/components/ui/icon";
import { Text, textVariants } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import {
  createIssueRequest,
  type IssueDto,
} from "@/src/issues-client";

/** Full-screen new-task composer. Create-only; edits happen on the detail screen. */
export function CreateTaskModal({
  open,
  onClose,
  onCreated,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCreated: (issue: IssueDto) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const canSubmit = title.trim().length > 0 && !busy;

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setDueDate("");
    setReviewDate("");
    setError(null);
    setBusy(false);
  }, [open]);

  const submit = () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    void createIssueRequest({
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueDate.trim() || null,
      reviewDate: reviewDate.trim() || null,
    })
      .then(onCreated)
      .catch((cause) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not create the task.",
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
            accessibilityLabel="Create task"
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
          {error ? (
            <Text variant="secondary" tone="destructive" className="mb-3">
              {error}
            </Text>
          ) : null}
          <TextInput
            accessibilityLabel="Task title"
            autoFocus
            className={cn(
              "min-h-12 tracking-tight",
              textVariants({ variant: "display" }),
            )}
            maxLength={200}
            onChangeText={setTitle}
            onSubmitEditing={submit}
            placeholder="What needs doing?"
            placeholderTextColor={placeholderColor}
            returnKeyType="next"
            value={title}
          />
          <TextInput
            accessibilityLabel="Task notes"
            className={cn("mt-2 min-h-24", textVariants({ variant: "body" }))}
            multiline
            onChangeText={setDescription}
            placeholder="Notes"
            placeholderTextColor={placeholderColor}
            textAlignVertical="top"
            value={description}
          />
          <View className="mt-6 flex-row gap-3">
            <TaskDateField label="Due" value={dueDate} onChange={setDueDate} />
            <TaskDateField
              label="Review"
              value={reviewDate}
              onChange={setReviewDate}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
