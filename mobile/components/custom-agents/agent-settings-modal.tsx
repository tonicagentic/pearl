import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { BottomSheet, RNHostView } from "@expo/ui";
import { CheckIcon, XIcon } from "lucide-react-native";
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
import type { CustomAgentRef } from "@/src/chats-client";
import { updateCustomAgentRequest } from "@/src/custom-agents-client";

export function AgentSettingsModal({
  open,
  agent,
  onClose,
  onSaved,
}: {
  readonly open: boolean;
  readonly agent: CustomAgentRef | null;
  readonly onClose: () => void;
  readonly onSaved: (agent: CustomAgentRef) => void;
}) {
  const [name, setName] = useState(agent?.name ?? "");
  const [instructions, setInstructions] = useState(agent?.instructions ?? "");
  const [accent, setAccent] = useState(
    agent?.accent ?? DEFAULT_AGENT_MARK_ACCENT,
  );
  const [markShape, setMarkShape] = useState<AgentMarkShape>(
    agent?.markShape ?? DEFAULT_AGENT_MARK_SHAPE,
  );
  const [markTalk, setMarkTalk] = useState<AgentMarkTalk>(
    agent?.markTalk ?? DEFAULT_AGENT_MARK_TALK,
  );
  const [markBrows, setMarkBrows] = useState<AgentMarkBrows>(
    agent?.markBrows ?? DEFAULT_AGENT_MARK_BROWS,
  );
  const [markGaze, setMarkGaze] = useState<AgentMarkGaze>(
    agent?.markGaze ?? DEFAULT_AGENT_MARK_GAZE,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const canSubmit = Boolean(agent) && name.trim().length > 0 && !busy;

  useEffect(() => {
    if (!open || !agent) return;
    setName(agent.name);
    setInstructions(agent.instructions);
    setAccent(agent.accent || DEFAULT_AGENT_MARK_ACCENT);
    setMarkShape(agent.markShape ?? DEFAULT_AGENT_MARK_SHAPE);
    setMarkTalk(agent.markTalk ?? DEFAULT_AGENT_MARK_TALK);
    setMarkBrows(agent.markBrows ?? DEFAULT_AGENT_MARK_BROWS);
    setMarkGaze(agent.markGaze ?? DEFAULT_AGENT_MARK_GAZE);
    setError(null);
    setBusy(false);
  }, [open, agent]);

  const submit = () => {
    if (!canSubmit || !agent) return;
    setBusy(true);
    setError(null);
    void updateCustomAgentRequest(agent.id, {
      name: name.trim(),
      instructions,
      accent,
      markShape,
      markTalk,
      markBrows,
      markGaze,
    })
      .then((row) => {
        onSaved({
          id: row.id,
          name: row.name,
          accent: row.accent,
          markShape: row.markShape,
          markTalk: row.markTalk,
          markBrows: row.markBrows,
          markGaze: row.markGaze,
          instructions: row.instructions,
        });
        onClose();
      })
      .catch((cause) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not save agent settings.",
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
              accessibilityLabel="Save agent"
              hitSlop={8}
              className={`h-10 w-10 items-center justify-center rounded-full ${canSubmit ? "bg-foreground" : "bg-muted/60"}`}
              disabled={!canSubmit}
              onPress={submit}
            >
              {busy ? (
                <ActivityIndicator size="small" />
              ) : (
                <Icon
                  as={CheckIcon}
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
            className={cn(
              "min-h-12 tracking-tight",
              textVariants({ variant: "display" }),
            )}
            maxLength={80}
            onChangeText={setName}
            placeholder="Agent name"
            placeholderTextColor={placeholderColor}
            value={name}
          />
          <TextInput
            accessibilityLabel="Standing instructions"
            className={cn("mt-2 min-h-28", textVariants({ variant: "body" }))}
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
