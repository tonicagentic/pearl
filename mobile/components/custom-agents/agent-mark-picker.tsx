import { Pressable, View } from "react-native";

import { AgentMark } from "@/components/custom-agents/agent-mark";
import { Text } from "@/components/ui/text";
import {
  AGENT_MARK_ACCENTS,
  AGENT_MARK_BROWS,
  AGENT_MARK_GAZES,
  AGENT_MARK_SHAPES,
  AGENT_MARK_TALKS,
  type AgentMarkBrows,
  type AgentMarkGaze,
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
  lift: "Bounce",
  chatter: "Chatter",
};

const BROWS_LABEL: Record<AgentMarkBrows, string> = {
  none: "None",
  line: "Line",
};

const GAZE_LABEL: Record<AgentMarkGaze, string> = {
  still: "Still",
  wander: "Wander",
};

/** Live preview + shape/talk/brows/gaze/color swatches for agent create/settings. */
export function AgentMarkPicker({
  accent,
  markShape,
  markTalk,
  markBrows,
  markGaze,
  onAccentChange,
  onMarkShapeChange,
  onMarkTalkChange,
  onMarkBrowsChange,
  onMarkGazeChange,
}: {
  readonly accent: string;
  readonly markShape: AgentMarkShape;
  readonly markTalk: AgentMarkTalk;
  readonly markBrows: AgentMarkBrows;
  readonly markGaze: AgentMarkGaze;
  readonly onAccentChange: (accent: string) => void;
  readonly onMarkShapeChange: (shape: AgentMarkShape) => void;
  readonly onMarkTalkChange: (talk: AgentMarkTalk) => void;
  readonly onMarkBrowsChange: (brows: AgentMarkBrows) => void;
  readonly onMarkGazeChange: (gaze: AgentMarkGaze) => void;
}) {
  return (
    <View className="mb-4 gap-3">
      <View className="items-center py-1">
        <AgentMark
          accent={accent}
          size={56}
          markShape={markShape}
          markTalk={markTalk}
          markBrows={markBrows}
          markGaze={markGaze}
          motion="burst"
          eyeMotion="idle"
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
                  markBrows={markBrows}
                  markGaze={markGaze}
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
                  markBrows={markBrows}
                  markGaze={markGaze}
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
          Brows
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {AGENT_MARK_BROWS.map((brows) => {
            const selected = brows === markBrows;
            return (
              <Pressable
                key={brows}
                accessibilityRole="button"
                accessibilityLabel={`${BROWS_LABEL[brows]} brows`}
                accessibilityState={{ selected }}
                className={`items-center gap-1 rounded-xl px-2.5 py-2 ${selected ? "bg-muted" : "bg-transparent"}`}
                onPress={() => onMarkBrowsChange(brows)}
              >
                <AgentMark
                  accent={accent}
                  size={28}
                  markShape={markShape}
                  markTalk={markTalk}
                  markBrows={brows}
                  markGaze={markGaze}
                  motion="off"
                />
                <Text variant="caption" weight={selected ? "medium" : "regular"}>
                  {BROWS_LABEL[brows]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View>
        <Text variant="secondary" weight="medium" className="mb-2">
          Gaze
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {AGENT_MARK_GAZES.map((gaze) => {
            const selected = gaze === markGaze;
            return (
              <Pressable
                key={gaze}
                accessibilityRole="button"
                accessibilityLabel={`${GAZE_LABEL[gaze]} gaze`}
                accessibilityState={{ selected }}
                className={`items-center gap-1 rounded-xl px-2.5 py-2 ${selected ? "bg-muted" : "bg-transparent"}`}
                onPress={() => onMarkGazeChange(gaze)}
              >
                <AgentMark
                  accent={accent}
                  size={28}
                  markShape={markShape}
                  markTalk={markTalk}
                  markBrows={markBrows}
                  markGaze={gaze}
                  motion="off"
                  eyeMotion="idle"
                />
                <Text variant="caption" weight={selected ? "medium" : "regular"}>
                  {GAZE_LABEL[gaze]}
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
