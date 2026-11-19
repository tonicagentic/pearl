import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { BottomSheet, RNHostView } from "@expo/ui";
import { SymbolView } from "expo-symbols";
import { useCSSVariable } from "uniwind";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AgentMarkPicker } from "@/components/custom-agents/agent-mark-picker";
import { Button } from "@/components/ui/button";
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
  const insets = useSafeAreaInsets();
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
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const mutedColor = useCSSVariable("--color-muted-foreground") as
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
    <BottomSheet
      isPresented={open}
      onDismiss={onClose}
      snapPoints={["full"]}
      containerColor={backgroundColor}
      contentPadding={{ top: 4, left: 0, right: 0, bottom: 0 }}
    >
      {/* Parent-sized host so ScrollView can fill the sheet (not matchContents). */}
      <RNHostView>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <View className="flex-1 px-5 pt-1">
            <View className="mb-2 h-10 flex-row items-center">
              <View className="w-8" />
              <Text
                variant="label"
                weight="semibold"
                className="flex-1 text-center text-foreground"
              >
                New Agent
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
                className="h-8 w-8 items-center justify-center active:opacity-70"
                onPress={onClose}
              >
                <SymbolView
                  name={{
                    ios: "xmark.circle.fill",
                    android: "close",
                    web: "close",
                  }}
                  size={28}
                  tintColor={mutedColor ?? "#8E8E93"}
                  type="hierarchical"
                />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerClassName="pb-4"
              style={{ flex: 1 }}
            >
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
                returnKeyType="next"
                value={name}
              />
              <TextInput
                accessibilityLabel="Standing instructions"
                className={cn(
                  "mt-2 min-h-24",
                  textVariants({ variant: "body" }),
                )}
                multiline
                onChangeText={setInstructions}
                placeholder="Standing instructions…"
                placeholderTextColor={placeholderColor}
                textAlignVertical="top"
                value={instructions}
              />
            </ScrollView>

            <View style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
              <Button
                label="Create"
                loading={busy}
                loadingLabel="Creating…"
                disabled={name.trim().length === 0}
                onPress={submit}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </RNHostView>
    </BottomSheet>
  );
}
