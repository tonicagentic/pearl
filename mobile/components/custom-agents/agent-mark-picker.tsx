import { Pressable, View } from "react-native";

import { AgentMark } from "@/components/custom-agents/agent-mark";
import { Text } from "@/components/ui/text";
import {
  AGENT_MARK_ACCENTS,
  AGENT_MARK_SHAPES,
  AGENT_MARK_TALKS,
  type AgentMarkShape,
  type AgentMarkTalk,
} from "../../../lib/custom-agents/mark";

const SHAPE_LABEL: Record<AgentMarkShape, string> = {
  oval: "Oval",
  diamond: "Diamond",
  square: "Square",
  trap: "Trap",
};

const TALK_LABEL: Record<AgentMarkTalk, string> = {
  hinge: "Hinge",
  lift: "Lift",
  chatter: "Chatter",
};

/** Live preview + shape/talk/color swatches for agent create/settings. */
export function AgentMarkPicker({
  accent,
  markShape,
  markTalk,
  onAccentChange,
  onMarkShapeChange,
  onMarkTalkChange,
}: {
  readonly accent: string;
  readonly markShape: AgentMarkShape;
  readonly markTalk: AgentMarkTalk;
  readonly onAccentChange: (accent: string) => void;
  readonly onMarkShapeChange: (shape: AgentMarkShape) => void;
  readonly onMarkTalkChange: (talk: AgentMarkTalk) => void;
}) {
  return (
    <View className="mb-4 gap-3">
      <View className="items-center py-1">
        <AgentMark
          accent={accent}
          size={56}
          markShape={markShape}
          markTalk={markTalk}
          motion="burst"
        />
      </View>

      <View>
        <Text variant="secondary" weight="medium" className="mb-2">
          Shape
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {AGENT_MARK_SHAPES.map((shape) => {
            const selected = shape === markShape;
            return (
              <Pressable
                key={shape}
                accessibilityRole="button"
                accessibilityLabel={`${SHAPE_LABEL[shape]} shape`}
                accessibilityState={{ selected }}
                className={`items-center gap-1 rounded-xl px-2.5 py-2 ${selected ? "bg-muted" : "bg-transparent"}`}
                onPress={() => onMarkShapeChange(shape)}
              >
                <AgentMark
                  accent={accent}
                  size={28}
                  markShape={shape}
                  markTalk={markTalk}
                  motion="burst"
                />
                <Text variant="caption" weight={selected ? "medium" : "regular"}>
                  {SHAPE_LABEL[shape]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View>
        <Text variant="secondary" weight="medium" className="mb-2">
          Talk
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {AGENT_MARK_TALKS.map((talk) => {
            const selected = talk === markTalk;
            return (
              <Pressable
                key={talk}
                accessibilityRole="button"
                accessibilityLabel={`${TALK_LABEL[talk]} talk`}
                accessibilityState={{ selected }}
                className={`items-center gap-1 rounded-xl px-2.5 py-2 ${selected ? "bg-muted" : "bg-transparent"}`}
                onPress={() => onMarkTalkChange(talk)}
              >
                <AgentMark
                  accent={accent}
                  size={28}
                  markShape={markShape}
                  markTalk={talk}
                  motion="burst"
                />
                <Text variant="caption" weight={selected ? "medium" : "regular"}>
                  {TALK_LABEL[talk]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View>
        <Text variant="secondary" weight="medium" className="mb-2">
          Color
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {AGENT_MARK_ACCENTS.map((swatch) => {
            const selected =
              swatch.toUpperCase() === accent.trim().toUpperCase();
            return (
              <Pressable
                key={swatch}
                accessibilityRole="button"
                accessibilityLabel={`Color ${swatch}`}
                accessibilityState={{ selected }}
                hitSlop={4}
                className={`h-9 w-9 items-center justify-center rounded-full ${selected ? "border-2 border-foreground" : "border border-transparent"}`}
                onPress={() => onAccentChange(swatch)}
              >
                <View
                  className="h-7 w-7 rounded-full"
                  style={{ backgroundColor: swatch }}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
