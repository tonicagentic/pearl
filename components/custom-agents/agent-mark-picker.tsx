"use client";

import { AgentAccentMark } from "@/components/custom-agents/agent-identity-pill";
import {
  AGENT_MARK_ACCENTS,
  AGENT_MARK_SHAPES,
  AGENT_MARK_TALKS,
  type AgentMarkShape,
  type AgentMarkTalk,
} from "@/lib/custom-agents/mark";
import { cn } from "@/lib/utils";

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

/** Live preview + shape/talk/color swatches for web agent settings. */
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
    <div className="flex flex-col gap-3">
      <div className="flex justify-center py-1">
        <AgentAccentMark
          accent={accent}
          markShape={markShape}
          markTalk={markTalk}
          size="lg"
          motion="burst"
        />
      </div>

      <div>
        <p className="mb-2 text-sm text-muted-foreground">Shape</p>
        <div className="flex flex-wrap gap-2">
          {AGENT_MARK_SHAPES.map((shape) => {
            const selected = shape === markShape;
            return (
              <button
                key={shape}
                aria-label={`${SHAPE_LABEL[shape]} shape`}
                aria-pressed={selected}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-2.5 py-2 text-xs transition-colors",
                  selected ? "bg-muted" : "hover:bg-muted/60",
                )}
                onClick={() => onMarkShapeChange(shape)}
                type="button"
              >
                <AgentAccentMark
                  accent={accent}
                  markShape={shape}
                  markTalk={markTalk}
                  size="md"
                  motion="burst"
                />
                <span>{SHAPE_LABEL[shape]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm text-muted-foreground">Talk</p>
        <div className="flex flex-wrap gap-2">
          {AGENT_MARK_TALKS.map((talk) => {
            const selected = talk === markTalk;
            return (
              <button
                key={talk}
                aria-label={`${TALK_LABEL[talk]} talk`}
                aria-pressed={selected}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-2.5 py-2 text-xs transition-colors",
                  selected ? "bg-muted" : "hover:bg-muted/60",
                )}
                onClick={() => onMarkTalkChange(talk)}
                type="button"
              >
                <AgentAccentMark
                  accent={accent}
                  markShape={markShape}
                  markTalk={talk}
                  size="md"
                  motion="burst"
                />
                <span>{TALK_LABEL[talk]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm text-muted-foreground">Color</p>
        <div className="flex flex-wrap gap-2">
          {AGENT_MARK_ACCENTS.map((swatch) => {
            const selected =
              swatch.toUpperCase() === accent.trim().toUpperCase();
            return (
              <button
                key={swatch}
                aria-label={`Color ${swatch}`}
                aria-pressed={selected}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full",
                  selected
                    ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                    : "ring-1 ring-transparent",
                )}
                onClick={() => onAccentChange(swatch)}
                type="button"
              >
                <span
                  className="size-7 rounded-full"
                  style={{ backgroundColor: swatch }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
