"use client";

import { AgentAccentMark } from "@/components/custom-agents/agent-identity-pill";
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

/** Live preview + shape/talk/brows/gaze/color swatches for web agent settings. */
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
    <div className="flex flex-col gap-3">
      <div className="flex justify-center py-1">
        <AgentAccentMark
          accent={accent}
          markShape={markShape}
          markTalk={markTalk}
          markBrows={markBrows}
          markGaze={markGaze}
          size="lg"
          motion="burst"
          eyeMotion="idle"
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
                  markBrows={markBrows}
                  markGaze={markGaze}
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
                  markBrows={markBrows}
                  markGaze={markGaze}
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
        <p className="mb-2 text-sm text-muted-foreground">Brows</p>
        <div className="flex flex-wrap gap-2">
          {AGENT_MARK_BROWS.map((brows) => {
            const selected = brows === markBrows;
            return (
              <button
                key={brows}
                aria-label={`${BROWS_LABEL[brows]} brows`}
                aria-pressed={selected}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-2.5 py-2 text-xs transition-colors",
                  selected ? "bg-muted" : "hover:bg-muted/60",
                )}
                onClick={() => onMarkBrowsChange(brows)}
                type="button"
              >
                <AgentAccentMark
                  accent={accent}
                  markShape={markShape}
                  markTalk={markTalk}
                  markBrows={brows}
                  markGaze={markGaze}
                  size="md"
                  motion="off"
                />
                <span>{BROWS_LABEL[brows]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm text-muted-foreground">Gaze</p>
        <div className="flex flex-wrap gap-2">
          {AGENT_MARK_GAZES.map((gaze) => {
            const selected = gaze === markGaze;
            return (
              <button
                key={gaze}
                aria-label={`${GAZE_LABEL[gaze]} gaze`}
                aria-pressed={selected}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-2.5 py-2 text-xs transition-colors",
                  selected ? "bg-muted" : "hover:bg-muted/60",
                )}
                onClick={() => onMarkGazeChange(gaze)}
                type="button"
              >
                <AgentAccentMark
                  accent={accent}
                  markShape={markShape}
                  markTalk={markTalk}
                  markBrows={markBrows}
                  markGaze={gaze}
                  size="md"
                  motion="off"
                  eyeMotion="idle"
                />
                <span>{GAZE_LABEL[gaze]}</span>
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
