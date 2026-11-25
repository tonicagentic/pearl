import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { AddComposer } from "@/components/ui/add-composer";
import { Text } from "@/components/ui/text";
import {
  createGoalRequest,
  type GoalDto,
} from "@/src/goals-client";
import { fetchProjects, type ProjectDto } from "@/src/projects-client";

type Step = 0 | 1;

/** New-goal wizard: Title → optional project. */
export function CreateGoalModal({
  open,
  onClose,
  onCreated,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCreated: (goal: GoalDto) => void;
}) {
  const [step, setStep] = useState<Step>(0);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<readonly ProjectDto[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setTitle("");
    setProjectId(null);
    setError(null);
    setBusy(false);
  }, [open]);

  useEffect(() => {
    if (!open || step !== 1) return;
    setLoadingProjects(true);
    void fetchProjects()
      .then(setProjects)
      .catch((cause) => {
        setError(
          cause instanceof Error ? cause.message : "Could not load projects.",
        );
      })
      .finally(() => setLoadingProjects(false));
  }, [open, step]);

  const create = () => {
    if (busy || title.trim().length === 0) return;
    setBusy(true);
    setError(null);
    void createGoalRequest({
      title: title.trim(),
      projectId,
    })
      .then(onCreated)
      .catch((cause) => {
        setError(
          cause instanceof Error ? cause.message : "Could not create the goal.",
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
      sheetTitle="New goal"
      submitLabel={step === 0 ? "Continue" : "Create goal"}
      leading={step === 0 ? "close" : "back"}
      onLeadingPress={step === 0 ? onClose : goBack}
      showTitleField={step === 0}
      title={title}
      onChangeTitle={setTitle}
      titlePlaceholder="What are you aiming for?"
      titleAccessibilityLabel="Goal title"
      titleMaxLength={200}
      titleAutoFocus={step === 0}
      scrollable={step === 1}
      error={error}
    >
      {step === 1 ? (
        <View className="gap-2">
          <Text variant="secondary">
            File on a project, or leave as standalone.
          </Text>
          {loadingProjects ? (
            <ActivityIndicator
              color={placeholderColor ?? undefined}
              className="py-4"
            />
          ) : (
            <>
              <ProjectChip
                label="No project"
                selected={projectId === null}
                onPress={() => setProjectId(null)}
              />
              {projects.map((project) => (
                <ProjectChip
                  key={project.id}
                  label={project.name}
                  selected={projectId === project.id}
                  onPress={() => setProjectId(project.id)}
                />
              ))}
            </>
          )}
        </View>
      ) : null}
    </AddComposer>
  );
}

function ProjectChip({
  label,
  selected,
  onPress,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`rounded-2xl px-4 py-3 ${selected ? "bg-foreground" : "bg-muted"}`}
      onPress={onPress}
    >
      <Text
        variant="label"
        className={selected ? "text-background" : "text-foreground"}
      >
        {label}
      </Text>
    </Pressable>
  );
}
