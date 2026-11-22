import { useEffect, useState } from "react";
import { Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useCSSVariable } from "uniwind";

import { AgentMarkPicker } from "@/components/custom-agents/agent-mark-picker";
import { AddComposer } from "@/components/ui/add-composer";
import { Text, textVariants } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import {
  DEFAULT_AGENT_MARK_ACCENT,
  DEFAULT_AGENT_MARK_BROWS,
  DEFAULT_AGENT_MARK_GAZE,
  DEFAULT_AGENT_MARK_SHAPE,
  DEFAULT_AGENT_MARK_TALK,
  type AgentMarkShape,
  type AgentMarkTalk,
} from "../../../lib/custom-agents/mark";
import {
  createCustomAgentRequest,
  type CustomAgentDto,
} from "@/src/custom-agents-client";

type Step = 0 | 1 | 2;

/** New custom-agent wizard: Name → Instructions → Character. */
export function CreateAgentModal({
  open,
  onClose,
  onCreated,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCreated: (agent: CustomAgentDto) => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [accent, setAccent] = useState<string>(DEFAULT_AGENT_MARK_ACCENT);
  const [markShape, setMarkShape] = useState<AgentMarkShape>(
    DEFAULT_AGENT_MARK_SHAPE,
  );
  const [markTalk, setMarkTalk] = useState<AgentMarkTalk>(
    DEFAULT_AGENT_MARK_TALK,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const openDirectory = () => {
    onClose();
    requestAnimationFrame(() => {
      router.push("/agent-directory");
    });
  };

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setName("");
    setInstructions("");
    setAccent(DEFAULT_AGENT_MARK_ACCENT);
    setMarkShape(DEFAULT_AGENT_MARK_SHAPE);
    setMarkTalk(DEFAULT_AGENT_MARK_TALK);
    setError(null);
    setBusy(false);
  }, [open]);

  const create = () => {
    if (busy || name.trim().length === 0) return;
    setBusy(true);
    setError(null);
    void createCustomAgentRequest({
      name: name.trim(),
      instructions: instructions.trim() || undefined,
      accent,
      markShape,
      markTalk,
      markBrows: DEFAULT_AGENT_MARK_BROWS,
      markGaze: DEFAULT_AGENT_MARK_GAZE,
    })
      .then(onCreated)
      .catch((cause) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not create the agent.",
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
    setStep((current) => (current - 1) as Step);
  };

  const primary = () => {
    if (step === 0) {
      if (name.trim().length === 0) return;
      setError(null);
      setStep(1);
      return;
    }
    if (step === 1) {
      setError(null);
      setStep(2);
      return;
    }
    create();
  };

  const canSubmit =
    step === 0 ? name.trim().length > 0 && !busy : !busy;

  return (
    <AddComposer
      open={open}
      onClose={onClose}
      onSubmit={primary}
      canSubmit={canSubmit}
      busy={busy && step === 2}
      sheetTitle="New agent"
      submitLabel={
        step === 2 ? "Create agent" : step === 1 ? "Continue" : "Continue"
      }
      submitAccessibilityLabel={
        step === 2
          ? "Create agent"
          : step === 1
            ? "Continue to character"
            : "Continue"
      }
      leading={step === 0 ? "close" : "back"}
      onLeadingPress={step === 0 ? onClose : goBack}
      showTitleField={step === 0}
      title={name}
      onChangeTitle={setName}
      titlePlaceholder="Agent name"
      titleAccessibilityLabel="Agent name"
      titleMaxLength={80}
      titleAutoFocus={step === 0}
      scrollable={step !== 0}
      error={error}
      footer={
        step === 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose from a template"
            className="self-center rounded-full border border-border bg-card px-4 py-2 active:opacity-80"
            onPress={openDirectory}
          >
            <Text variant="label" weight="semibold">
              Choose from a template
            </Text>
          </Pressable>
        ) : undefined
      }
      hero={
        step === 2 ? (
          <AgentMarkPicker
            accent={accent}
            markShape={markShape}
            markTalk={markTalk}
            showBrows={false}
            showGaze={false}
            onAccentChange={setAccent}
            onMarkShapeChange={setMarkShape}
            onMarkTalkChange={setMarkTalk}
          />
        ) : undefined
      }
    >
      {step === 1 ? (
        <TextInput
          accessibilityLabel="Standing instructions"
          autoFocus
          className={cn("min-h-32", textVariants({ variant: "body" }))}
          multiline
          onChangeText={setInstructions}
          placeholder="Standing instructions…"
          placeholderTextColor={placeholderColor}
          textAlignVertical="top"
          value={instructions}
        />
      ) : null}
    </AddComposer>
  );
}
