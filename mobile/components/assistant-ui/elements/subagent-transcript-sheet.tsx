import { useMemo } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import type { ConversationAgentSession } from "eve/client";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  WaitingActionCard,
  type WaitingAction,
} from "@/components/assistant-ui/elements/waiting-action-card";
import { Text } from "@/components/ui/text";
import {
  getPendingApprovals,
  composerWaitingQuestions,
  type PendingApproval,
} from "@/src/message-projection";
import { subagentMessageBlocks } from "@/src/subagent-preview";
import { cn } from "@/lib/utils";
import { mono, paper } from "./surfaces";

export type SubagentTranscriptTarget = {
  readonly sessionId: string;
  readonly name: string;
  readonly callId?: string;
  readonly agent?: ConversationAgentSession;
};

function observationLabel(agent: ConversationAgentSession | undefined): string {
  if (!agent) return "Subagent not followed yet.";
  const { observation } = agent;
  switch (observation.status) {
    case "not-followed":
      return `Not followed${observation.reason ? ` (${observation.reason})` : ""}.`;
    case "queued":
      return "Connecting to subagent…";
    case "following":
      return observation.caughtUp ? "Live" : "Streaming…";
    case "caught-up":
      return "Caught up";
    case "interrupted":
      return `Interrupted${observation.reason ? ` · ${observation.reason}` : ""}`;
    case "unavailable":
      return `Unavailable${observation.reason ? ` · ${observation.reason}` : ""}`;
  }
}

function waitingActionFor(
  pending: readonly PendingApproval[],
  onRespond: (pending: PendingApproval, response: {
    readonly optionId?: string;
    readonly text?: string;
  }) => Promise<void>,
): WaitingAction | null {
  const questions = composerWaitingQuestions(pending);
  if (questions.length > 0) {
    return {
      kind: "questions",
      items: questions.map((item) => ({
        id: item.requestId,
        prompt: item.prompt,
        ...(item.detail ? { detail: item.detail } : {}),
        options: item.options,
        allowFreeform: item.allowFreeform,
        ...(item.dismissible ? { dismissible: true } : {}),
        ...(item.skipOptionId ? { skipOptionId: item.skipOptionId } : {}),
      })),
      onRespond: async (response) => {
        const match = questions.find(
          (item) => item.requestId === response.interactionId,
        );
        if (!match) return;
        await onRespond(match, response);
      },
    };
  }
  const approval = pending.find((item) => item.kind === "approval");
  if (!approval) return null;
  return {
    kind: "approval",
    title: "The agent is paused until you respond.",
    prompt: approval.prompt,
    detail: approval.detail,
    options: approval.options,
    onRespond: async (response) => {
      await onRespond(approval, response);
    },
  };
}

export function SubagentTranscriptSheet({
  target,
  onClose,
  onAnswer,
}: {
  readonly target: SubagentTranscriptTarget | null;
  readonly onClose: () => void;
  readonly onAnswer: (response: {
    readonly interactionId: string;
    readonly optionId?: string;
    readonly text?: string;
  }) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const agent = target?.agent;
  const messages =
    agent && agent.observation.status !== "not-followed"
      ? agent.observation.conversation.messages
      : [];
  const blocks = useMemo(() => subagentMessageBlocks(messages), [messages]);
  const pending = useMemo(
    () => getPendingApprovals({ messages }),
    [messages],
  );
  const waitingAction = useMemo(
    () =>
      waitingActionFor(pending, async (item, response) => {
        await onAnswer({
          interactionId: item.requestId,
          ...(response.optionId ? { optionId: response.optionId } : {}),
          ...(response.text !== undefined ? { text: response.text } : {}),
        });
      }),
    [pending, onAnswer],
  );

  if (!target) return null;

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        className="bg-background flex-1"
        style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }}
      >
        <View className="flex-row items-center justify-between px-4 pb-3">
          <View className="min-w-0 flex-1 pr-3">
            <Text variant="body" weight="medium" numberOfLines={1}>
              {target.name}
            </Text>
            <Text
              variant="caption"
              tone="default"
              className={cn(mono, "opacity-45")}
            >
              {observationLabel(agent)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close subagent transcript"
            className="min-h-11 justify-center px-2"
            onPress={onClose}
          >
            <Text variant="secondary" tone="primary" weight="medium">
              Done
            </Text>
          </Pressable>
        </View>

        <ScrollView
          className="flex-1 px-4"
          contentContainerClassName="gap-3 pb-4"
        >
          {blocks.length === 0 ? (
            <View className={cn(paper, "rounded-2xl px-3.5 py-3")}>
              <Text variant="secondary" className="opacity-60">
                {agent?.observation.status === "not-followed"
                  ? "This subagent stream is not available on this device yet."
                  : "Waiting for the subagent to start streaming…"}
              </Text>
            </View>
          ) : (
            blocks.map((block) => (
              <View
                key={block.id}
                className={cn(paper, "rounded-2xl px-3.5 py-3")}
              >
                <Text
                  variant="caption"
                  tone="default"
                  className={cn(mono, "mb-1.5 opacity-35")}
                >
                  {block.role === "user" ? "You" : target.name}
                </Text>
                {block.lines.map((line, index) => (
                  <Text
                    key={`${block.id}-${index}`}
                    variant="secondary"
                    tone="default"
                    className="mb-1"
                    selectable
                  >
                    {line}
                  </Text>
                ))}
              </View>
            ))
          )}
        </ScrollView>

        {waitingAction ? (
          <View className="border-border/60 border-t px-3 pt-3">
            <WaitingActionCard action={waitingAction} variant="composer" />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
