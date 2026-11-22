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

/** New-workspace composer in the shared AddComposer sheet. */
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
            : "Could not create the workspace.",
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
      submitAccessibilityLabel="Create workspace"
      title={name}
      onChangeTitle={setName}
      titlePlaceholder="Workspace name"
      titleAccessibilityLabel="Workspace name"
      titleMaxLength={120}
      error={error}
      hero={<ProjectMark name={name || "workspace"} size="lg" />}
    >
      <TextInput
        accessibilityLabel="Workspace summary"
        className={cn("mt-2 min-h-24", textVariants({ variant: "body" }))}
        multiline
        onChangeText={setInstructions}
        placeholder="Short summary…"
        placeholderTextColor={placeholderColor}
        textAlignVertical="top"
        value={instructions}
      />
    </AddComposer>
  );
}
