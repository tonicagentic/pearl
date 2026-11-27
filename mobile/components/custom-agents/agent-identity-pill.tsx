import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { AgentMark } from "@/components/custom-agents/agent-mark";
import {
  DEFAULT_AGENT_MARK_ACCENT,
  DEFAULT_AGENT_MARK_BROWS,
  DEFAULT_AGENT_MARK_GAZE,
  DEFAULT_AGENT_MARK_HEIGHT_RATIO,
  DEFAULT_AGENT_MARK_SHAPE,
  DEFAULT_AGENT_MARK_TALK,
  type AgentMarkBrows,
  type AgentMarkGaze,
  type AgentMarkMotion,
  type AgentMarkShape,
  type AgentMarkTalk,
} from "../../../lib/custom-agents/mark";

const PILL_CHROME =
  "h-8 max-w-[11rem] flex-row items-center gap-1.5 rounded-full border border-border bg-muted/50 px-1.5 pr-2.5";

/** Mobile Grok-style attachment pill for Pearl / custom-agent threads. */
export function AgentIdentityPill({
  name,
  accent = DEFAULT_AGENT_MARK_ACCENT,
  markShape = DEFAULT_AGENT_MARK_SHAPE,
  markTalk = DEFAULT_AGENT_MARK_TALK,
  markBrows = DEFAULT_AGENT_MARK_BROWS,
  markGaze = DEFAULT_AGENT_MARK_GAZE,
  motion = "idle",
  heightRatio = DEFAULT_AGENT_MARK_HEIGHT_RATIO,
  onPress,
}: {
  readonly name: string;
  readonly accent?: string;
  readonly markShape?: AgentMarkShape;
  readonly markTalk?: AgentMarkTalk;
  readonly markBrows?: AgentMarkBrows;
  readonly markGaze?: AgentMarkGaze;
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
        markBrows={markBrows}
        markGaze={markGaze}
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
  if (!onPress) {
    return <View className={PILL_CHROME}>{body}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} actions`}
      hitSlop={6}
      onPress={onPress}
      className={`${PILL_CHROME} active:opacity-80`}
    >
      {body}
    </Pressable>
  );
}

/** Same chrome as the agent pill, with a project mark instead of Pearl. */
export function ProjectIdentityPill({
  name,
  onPress,
  mark,
}: {
  readonly name: string;
  readonly onPress?: () => void;
  readonly mark: ReactNode;
}) {
  const label = name.trim() || "Project";
  const body = (
    <>
      {mark}
      <Text
        numberOfLines={1}
        className="shrink text-xs font-medium text-foreground"
      >
        {label}
      </Text>
    </>
  );
  if (!onPress) {
    return <View className={PILL_CHROME}>{body}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} actions`}
      hitSlop={6}
      onPress={onPress}
      className={`${PILL_CHROME} active:opacity-80`}
    >
      {body}
    </Pressable>
  );
}
