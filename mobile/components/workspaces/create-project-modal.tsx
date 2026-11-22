import { useEffect, useState } from "react";
import { TextInput } from "react-native";
import { useCSSVariable } from "uniwind";

import { ProjectMark } from "@/components/project-mark";
import { AddComposer } from "@/components/ui/add-composer";
import { textVariants } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import {
  createProjectRequest,
  type ProjectDto,
} from "@/src/projects-client";

type Step = 0 | 1;

/** New-workspace wizard: Name → Summary. */
export function CreateProjectModal({
  open,
  onClose,
  onCreated,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCreated: (project: ProjectDto) => void;
}) {
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setName("");
    setInstructions("");
    setError(null);
    setBusy(false);
  }, [open]);

  const create = () => {
    if (busy || name.trim().length === 0) return;
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
            : "Could not create the workspace.",
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
      if (name.trim().length === 0) return;
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
      canSubmit={step === 0 ? name.trim().length > 0 && !busy : !busy}
      busy={busy && step === 1}
      sheetTitle="New workspace"
      submitLabel={step === 0 ? "Continue" : "Create workspace"}
      leading={step === 0 ? "close" : "back"}
      onLeadingPress={step === 0 ? onClose : goBack}
      showTitleField={step === 0}
      title={name}
      onChangeTitle={setName}
      titlePlaceholder="Workspace name"
      titleAccessibilityLabel="Workspace name"
      titleMaxLength={120}
      titleAutoFocus={step === 0}
      scrollable={step === 1}
      error={error}
      hero={
        step === 1 ? (
          <ProjectMark name={name || "workspace"} size="lg" />
        ) : undefined
      }
    >
      {step === 1 ? (
        <TextInput
          accessibilityLabel="Workspace summary"
          autoFocus
          className={cn("min-h-24", textVariants({ variant: "body" }))}
          multiline
          onChangeText={setInstructions}
          placeholder="Short summary…"
          placeholderTextColor={placeholderColor}
          textAlignVertical="top"
          value={instructions}
        />
      ) : null}
    </AddComposer>
  );
}
