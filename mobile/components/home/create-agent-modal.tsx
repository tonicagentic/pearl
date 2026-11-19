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

import { AgentMarkPicker } from "@/components/custom-agents/agent-mark-picker";
import { Icon } from "@/components/ui/icon";
import { Text, textVariants } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import {
  DEFAULT_AGENT_MARK_ACCENT,
  DEFAULT_AGENT_MARK_BROWS,
  DEFAULT_AGENT_MARK_GAZE,
  DEFAULT_AGENT_MARK_SHAPE,
  DEFAULT_AGENT_MARK_TALK,
  type AgentMarkBrows,
  type AgentMarkGaze,
  type AgentMarkShape,
  type AgentMarkTalk,
} from "../../../lib/custom-agents/mark";
import {
  createCustomAgentRequest,
  type CustomAgentDto,
} from "@/src/custom-agents-client";

/** New custom-agent composer in an Expo UI bottom sheet. */
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
  const [markBrows, setMarkBrows] = useState<AgentMarkBrows>(
    DEFAULT_AGENT_MARK_BROWS,
  );
  const [markGaze, setMarkGaze] = useState<AgentMarkGaze>(
    DEFAULT_AGENT_MARK_GAZE,
  );
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
    setAccent(DEFAULT_AGENT_MARK_ACCENT);
    setMarkShape(DEFAULT_AGENT_MARK_SHAPE);
    setMarkTalk(DEFAULT_AGENT_MARK_TALK);
    setMarkBrows(DEFAULT_AGENT_MARK_BROWS);
    setMarkGaze(DEFAULT_AGENT_MARK_GAZE);
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
      markBrows,
      markGaze,
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
    <BottomSheet
      isPresented={open}
      onDismiss={onClose}
      snapPoints={["half", "full"]}
      containerColor={backgroundColor}
      contentPadding={{ top: 4, left: 0, right: 0, bottom: 0 }}
    >
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
              accessibilityLabel="Create agent"
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

          <AgentMarkPicker
            accent={accent}
            markShape={markShape}
            markTalk={markTalk}
            markBrows={markBrows}
            markGaze={markGaze}
            onAccentChange={setAccent}
            onMarkShapeChange={setMarkShape}
            onMarkTalkChange={setMarkTalk}
            onMarkBrowsChange={setMarkBrows}
            onMarkGazeChange={setMarkGaze}
          />
          {error ? (
            <Text variant="secondary" tone="destructive" className="mb-3">
              {error}
            </Text>
          ) : null}
          <TextInput
            accessibilityLabel="Agent name"
            autoFocus
            className={cn(
              "min-h-12 tracking-tight",
              textVariants({ variant: "display" }),
            )}
            maxLength={80}
            onChangeText={setName}
            onSubmitEditing={submit}
            placeholder="Agent name"
            placeholderTextColor={placeholderColor}
            returnKeyType="next"
            value={name}
          />
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
        </View>
      </RNHostView>
    </BottomSheet>
  );
}
