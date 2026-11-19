import { Pressable, Text, View } from "react-native";

import { AgentMark } from "@/components/custom-agents/agent-mark";
import {
  DEFAULT_AGENT_MARK_ACCENT,
  DEFAULT_AGENT_MARK_HEIGHT_RATIO,
  DEFAULT_AGENT_MARK_SHAPE,
  DEFAULT_AGENT_MARK_TALK,
  type AgentMarkMotion,
  type AgentMarkShape,
  type AgentMarkTalk,
} from "../../../lib/custom-agents/mark";

/** Mobile Grok-style attachment pill for Pearl / custom-agent threads. */
export function AgentIdentityPill({
  name,
  accent = DEFAULT_AGENT_MARK_ACCENT,
  markShape = DEFAULT_AGENT_MARK_SHAPE,
  markTalk = DEFAULT_AGENT_MARK_TALK,
  motion = "idle",
  heightRatio = DEFAULT_AGENT_MARK_HEIGHT_RATIO,
  onPress,
}: {
  readonly name: string;
  readonly accent?: string;
  readonly markShape?: AgentMarkShape;
  readonly markTalk?: AgentMarkTalk;
  readonly motion?: AgentMarkMotion;
  readonly heightRatio?: number;
  readonly onPress?: () => void;
}) {
  const label = name.trim() || "Agent";
  const body = (
    <>
      <AgentMark
        accent={accent}
        size={16}
        markShape={markShape}
        markTalk={markTalk}
        motion={motion}
        heightRatio={heightRatio}
      />
      <Text
        numberOfLines={1}
        className="shrink text-xs font-medium text-foreground"
      >
        {label}
      </Text>
    </>
  );
  // h-8 fits the taller pearl silhouette (16 → ~18 + flap room).
  const chrome =
    "h-8 max-w-[11rem] flex-row items-center gap-1.5 rounded-full border border-border bg-muted/50 px-1.5 pr-2.5";
  if (!onPress) {
    return <View className={chrome}>{body}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} actions`}
      hitSlop={6}
      onPress={onPress}
      className={`${chrome} active:opacity-80`}
    >
      {body}
    </Pressable>
  );
}
