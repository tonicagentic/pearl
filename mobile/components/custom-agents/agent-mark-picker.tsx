import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { AgentMark } from "@/components/custom-agents/agent-mark";
import { Text } from "@/components/ui/text";
import {
  AGENT_MARK_ACCENTS,
  AGENT_MARK_BROWS,
  AGENT_MARK_GAZES,
  AGENT_MARK_SHAPES,
  AGENT_MARK_TALKS,
  DEFAULT_AGENT_MARK_BROWS,
  DEFAULT_AGENT_MARK_GAZE,
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

function OptionChip({
  label,
  selected,
  accessibilityLabel,
  onPress,
  children,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      className={`min-w-0 flex-1 items-center gap-1 rounded-xl px-1.5 py-2 ${selected ? "bg-muted" : "bg-transparent"}`}
      onPress={onPress}
    >
      {children}
      <Text
        variant="caption"
        weight={selected ? "medium" : "regular"}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Live preview + shape/talk/brows/gaze/color swatches for agent create/settings. */
export function AgentMarkPicker({
  accent,
  markShape,
  markTalk,
  markBrows = DEFAULT_AGENT_MARK_BROWS,
  markGaze = DEFAULT_AGENT_MARK_GAZE,
  showBrows = true,
  showGaze = true,
  onAccentChange,
  onMarkShapeChange,
  onMarkTalkChange,
  onMarkBrowsChange,
  onMarkGazeChange,
}: {
  readonly accent: string;
  readonly markShape: AgentMarkShape;
  readonly markTalk: AgentMarkTalk;
  readonly markBrows?: AgentMarkBrows;
  readonly markGaze?: AgentMarkGaze;
  /** Brows row — hide on create (always none). */
  readonly showBrows?: boolean;
  /** Gaze row — hide on create (always wander). */
  readonly showGaze?: boolean;
  readonly onAccentChange: (accent: string) => void;
  readonly onMarkShapeChange: (shape: AgentMarkShape) => void;
  readonly onMarkTalkChange: (talk: AgentMarkTalk) => void;
  readonly onMarkBrowsChange?: (brows: AgentMarkBrows) => void;
  readonly onMarkGazeChange?: (gaze: AgentMarkGaze) => void;
}) {
  const brows = showBrows ? markBrows : "none";
  const gaze = showGaze ? markGaze : "wander";

  return (
    <View className="mb-3 gap-2.5">
      <View className="items-center gap-1 py-0.5">
        {/* Idle loops the selected talk so create/settings can preview it. */}
        <AgentMark
          accent={accent}
          size={56}
          markShape={markShape}
          markTalk={markTalk}
          markBrows={brows}
          markGaze={gaze}
          motion="idle"
          eyeMotion="idle"
        />
        <Text variant="caption" tone="muted">
          Talk preview
        </Text>
      </View>

      <View>
        <Text variant="secondary" weight="medium" className="mb-1.5">
          Shape
        </Text>
        <View className="flex-row gap-1.5">
          {AGENT_MARK_SHAPES.map((shape) => (
            <OptionChip
              key={shape}
              label={SHAPE_LABEL[shape]}
              selected={shape === markShape}
              accessibilityLabel={`${SHAPE_LABEL[shape]} shape`}
              onPress={() => onMarkShapeChange(shape)}
            >
              <AgentMark
                accent={accent}
                size={28}
                markShape={shape}
                markTalk={markTalk}
                markBrows={brows}
                markGaze={gaze}
                motion="off"
              />
            </OptionChip>
          ))}
        </View>
      </View>

      <View>
        <Text variant="secondary" weight="medium" className="mb-1.5">
          Talk
        </Text>
        <View className="flex-row gap-1.5">
          {AGENT_MARK_TALKS.map((talk) => (
            <OptionChip
              key={talk}
              label={TALK_LABEL[talk]}
              selected={talk === markTalk}
              accessibilityLabel={`${TALK_LABEL[talk]} talk`}
              onPress={() => onMarkTalkChange(talk)}
            >
              <AgentMark
                accent={accent}
                size={28}
                markShape={markShape}
                markTalk={talk}
                markBrows={brows}
                markGaze={gaze}
                motion="off"
              />
            </OptionChip>
          ))}
        </View>
      </View>

      {showBrows && onMarkBrowsChange ? (
        <View>
          <Text variant="secondary" weight="medium" className="mb-1.5">
            Brows
          </Text>
          <View className="flex-row gap-1.5">
            {AGENT_MARK_BROWS.map((option) => (
              <OptionChip
                key={option}
                label={BROWS_LABEL[option]}
                selected={option === markBrows}
                accessibilityLabel={`${BROWS_LABEL[option]} brows`}
                onPress={() => onMarkBrowsChange(option)}
              >
                <AgentMark
                  accent={accent}
                  size={28}
                  markShape={markShape}
                  markTalk={markTalk}
                  markBrows={option}
                  markGaze={gaze}
                  motion="off"
                />
              </OptionChip>
            ))}
          </View>
        </View>
      ) : null}

      {showGaze && onMarkGazeChange ? (
        <View>
          <Text variant="secondary" weight="medium" className="mb-1.5">
            Gaze
          </Text>
          <View className="flex-row gap-1.5">
            {AGENT_MARK_GAZES.map((option) => (
              <OptionChip
                key={option}
                label={GAZE_LABEL[option]}
                selected={option === markGaze}
                accessibilityLabel={`${GAZE_LABEL[option]} gaze`}
                onPress={() => onMarkGazeChange(option)}
              >
                <AgentMark
                  accent={accent}
                  size={28}
                  markShape={markShape}
                  markTalk={markTalk}
                  markBrows={brows}
                  markGaze={option}
                  motion="off"
                  eyeMotion="idle"
                />
              </OptionChip>
            ))}
          </View>
        </View>
      ) : null}

      <View>
        <Text variant="secondary" weight="medium" className="mb-1.5">
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
