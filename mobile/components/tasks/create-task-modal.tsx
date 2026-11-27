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

type Step = 0 | 1;

/** New-task wizard: Title → Notes + dates. Optional projectId/goalId filing. */
export function CreateTaskModal({
  open,
  onClose,
  onCreated,
  projectId,
  goalId,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCreated: (issue: IssueDto) => void;
  readonly projectId?: string | null;
  readonly goalId?: string | null;
}) {
  const [step, setStep] = useState<Step>(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setTitle("");
    setDescription("");
    setDueDate("");
    setReviewDate("");
    setError(null);
    setBusy(false);
  }, [open]);

  const create = () => {
    if (busy || title.trim().length === 0) return;
    setBusy(true);
    setError(null);
    void createIssueRequest({
      title: title.trim(),
      description: description.trim() || undefined,
      projectId: projectId ?? undefined,
      goalId: goalId ?? undefined,
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

  const goBack = () => {
    if (step === 0) {
      onClose();
      return;
    }
    setError(null);
    setStep(0);
  };

  const primary = () => {
    if (step === 0) {
      if (title.trim().length === 0) return;
      setError(null);
      setStep(1);
      return;
    }
    create();
  };

  return (
    <AddComposer
      open={open}
      onClose={onClose}
      onSubmit={primary}
      canSubmit={step === 0 ? title.trim().length > 0 && !busy : !busy}
      busy={busy && step === 1}
      sheetTitle="New task"
      submitLabel={step === 0 ? "Continue" : "Create task"}
      leading={step === 0 ? "close" : "back"}
      onLeadingPress={step === 0 ? onClose : goBack}
      showTitleField={step === 0}
      title={title}
      onChangeTitle={setTitle}
      titlePlaceholder="What needs doing?"
      titleAccessibilityLabel="Task title"
      titleMaxLength={200}
      titleAutoFocus={step === 0}
      scrollable={step === 1}
      error={error}
    >
      {step === 1 ? (
        <>
          <TextInput
            accessibilityLabel="Task notes"
            autoFocus
            className={cn("min-h-24", textVariants({ variant: "body" }))}
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
        </>
      ) : null}
    </AddComposer>
  );
}
