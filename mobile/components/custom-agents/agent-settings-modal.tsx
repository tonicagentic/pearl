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

import { Icon } from "@/components/ui/icon";
import { Text, textVariants } from "@/components/ui/text";
import { cn } from "@/lib/utils";
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
    })
      .then((row) => {
        onSaved({
          id: row.id,
          name: row.name,
          accent: row.accent,
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

          <View
            accessibilityElementsHidden
            className="mb-4 size-10 items-center justify-center rounded-full"
            style={{ backgroundColor: agent?.accent || "#2DD4BF" }}
          >
            <View className="flex-row items-center gap-0.5">
              <View className="h-2.5 w-0.5 rounded-full bg-white" />
              <View className="h-2.5 w-0.5 rounded-full bg-white" />
            </View>
          </View>
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
