import { useEffect, useState } from "react";
import { TextInput } from "react-native";
import { useCSSVariable } from "uniwind";

import { AgentMarkPicker } from "@/components/custom-agents/agent-mark-picker";
import { AddComposer } from "@/components/ui/add-composer";
import { textVariants } from "@/components/ui/text";
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

/** New custom-agent composer in the shared AddComposer sheet. */
export function CreateAgentModal({
  open,
  onClose,
  onCreated,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCreated: (agent: CustomAgentDto) => void;
}) {
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
  const canSubmit = name.trim().length > 0 && !busy;

  useEffect(() => {
    if (!open) return;
    setName("");
    setInstructions("");
    setAccent(DEFAULT_AGENT_MARK_ACCENT);
    setMarkShape(DEFAULT_AGENT_MARK_SHAPE);
    setMarkTalk(DEFAULT_AGENT_MARK_TALK);
    setError(null);
    setBusy(false);
  }, [open]);

  const submit = () => {
    if (!canSubmit) return;
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

  return (
    <AddComposer
      open={open}
      onClose={onClose}
      onSubmit={submit}
      canSubmit={canSubmit}
      busy={busy}
      submitAccessibilityLabel="Create agent"
      title={name}
      onChangeTitle={setName}
      titlePlaceholder="Agent name"
      titleAccessibilityLabel="Agent name"
      titleMaxLength={80}
      titleAutoFocus={false}
      snapPoints={["full"]}
      scrollable
      error={error}
      hero={
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
      }
    >
      <TextInput
        accessibilityLabel="Standing instructions"
        className={cn("mt-2 min-h-24", textVariants({ variant: "body" }))}
        multiline
        onChangeText={setInstructions}
        placeholder="Standing instructions…"
        placeholderTextColor={placeholderColor}
        textAlignVertical="top"
        value={instructions}
      />
    </AddComposer>
  );
}
