import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";

import {
  AgentMark,
  pearlMarkMetrics,
} from "@/components/custom-agents/agent-mark";
import { Text } from "@/components/ui/text";
import {
  DEFAULT_AGENT_MARK_HEIGHT_RATIO,
  TERRANCE_FLESH,
  type AgentMarkBrows,
  type AgentMarkShape,
  type AgentMarkTalk,
} from "../../../lib/custom-agents/mark";

const MARK_SIZE = 44;
const MARK_METRICS = pearlMarkMetrics(MARK_SIZE, DEFAULT_AGENT_MARK_HEIGHT_RATIO);

type EmptyAgentPreset = {
  readonly accent: string;
  readonly markShape: AgentMarkShape;
  readonly markTalk: AgentMarkTalk;
  readonly markBrows?: AgentMarkBrows;
  readonly offsetY: number;
};

const EMPTY_AGENT_PRESETS: readonly EmptyAgentPreset[] = [
  {
    accent: TERRANCE_FLESH,
    markShape: "oval",
    markTalk: "hinge",
    offsetY: 6,
  },
  {
    accent: "#F97316",
    markShape: "square",
    markTalk: "chatter",
    offsetY: -4,
  },
  {
    accent: "#EAB308",
    markShape: "trap",
    markTalk: "lift",
    offsetY: 8,
  },
  {
    accent: "#22C55E",
    markShape: "diamond",
    markTalk: "hinge",
    offsetY: -2,
  },
  {
    accent: "#2DD4BF",
    markShape: "oval",
    markTalk: "chatter",
    offsetY: 10,
  },
  {
    accent: "#3B82F6",
    markShape: "diamond",
    markTalk: "lift",
    markBrows: "line",
    offsetY: -6,
  },
  {
    accent: "#8B5CF6",
    markShape: "square",
    markTalk: "hinge",
    offsetY: 4,
  },
  {
    accent: "#EC4899",
    markShape: "oval",
    markTalk: "lift",
    offsetY: -8,
  },
  {
    accent: "#F2E8D8",
    markShape: "trap",
    markTalk: "chatter",
    offsetY: 2,
  },
];

/** Centered Agents-tab placeholder: idle mark cluster + create / directory hints. */
export function EmptyAgentsState() {
  const router = useRouter();

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel="No agents yet. Tap plus to create one, or browse the directory."
      className="items-center px-8"
      pointerEvents="box-none"
    >
      <View
        pointerEvents="none"
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "flex-end",
          gap: 10,
          maxWidth: 320,
          marginBottom: 20,
        }}
      >
        {EMPTY_AGENT_PRESETS.map((preset, index) => (
          <View
            key={`${preset.accent}-${preset.markShape}-${index}`}
            style={{
              width: MARK_METRICS.width,
              height: MARK_METRICS.layoutHeight,
              transform: [{ translateY: preset.offsetY }],
            }}
          >
            <AgentMark
              accent={preset.accent}
              size={MARK_SIZE}
              markShape={preset.markShape}
              markTalk={preset.markTalk}
              markBrows={preset.markBrows}
              markGaze="wander"
              motion="idle"
              eyeMotion="idle"
            />
          </View>
        ))}
      </View>
      <Text variant="label" weight="semibold" className="text-center">
        No agents yet
      </Text>
      <Text variant="body" tone="muted" className="mt-1.5 text-center">
        Tap + to create one, or browse the directory.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Browse agent directory"
        className="mt-4 rounded-full border border-border bg-card px-4 py-2 active:opacity-80"
        onPress={() => router.push("/agent-directory")}
      >
        <Text variant="label" weight="semibold">
          Browse directory
        </Text>
      </Pressable>
    </View>
  );
}
