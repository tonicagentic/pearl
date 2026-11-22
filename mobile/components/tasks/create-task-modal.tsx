import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { TaskDateField } from "@/components/tasks/task-date-field";
import { AddComposer } from "@/components/ui/add-composer";
import { textVariants } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import {
  createIssueRequest,
  type IssueDto,
} from "@/src/issues-client";

/** New-task composer in the shared AddComposer sheet. */
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
    <AddComposer
      open={open}
      onClose={onClose}
      onSubmit={submit}
      canSubmit={canSubmit}
      busy={busy}
      submitAccessibilityLabel="Create task"
      title={title}
      onChangeTitle={setTitle}
      titlePlaceholder="What needs doing?"
      titleAccessibilityLabel="Task title"
      titleMaxLength={200}
      error={error}
    >
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
    </AddComposer>
  );
}
