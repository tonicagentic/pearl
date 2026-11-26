"use client";

import { defineRegistry, useActions } from "@json-render/react";
import { MermaidBlock } from "@/components/assistant-ui/elements/mermaid-block";
import { chatCatalog } from "@/lib/json-render/catalog";
import {
  chartDeltaTone,
  chartSeriesLayout,
  clampVisibleCount,
  inferChartTrend,
} from "@/lib/json-render/chart";
import { comparisonBarShares } from "@/lib/json-render/comparison-bar";
import {
  isCompactTableColumn,
  isNumericTableColumn,
} from "@/lib/json-render/table";
import {
  CHORD_LIBRARY,
  findChordByName,
  initialLibraryIndex,
  mergeVoicings,
  type ChordVoicing,
} from "@/lib/json-render/chord-library";
import {
  clampPin,
  circleOfFifthsPositions,
  guitarChordDots,
  GUITAR_FRET_COUNT,
  GUITAR_STRING_COUNT,
  regionBarWidths,
} from "@/lib/json-render/diagrams";
import {
  bookingCancelMessage,
  bookingConfirmMessage,
  createEventConfirmMessage,
  createEventDiscardMessage,
  emailBatchConfirmMessage,
  emailDraftSaveMessage,
  emailDraftSendMessage,
} from "@/lib/json-render/reply-messages";
import { playSpeakable } from "@/lib/json-render/speak";
import {
  formatSnowLevelCount,
  snowTrailLevelMeta,
} from "@/lib/json-render/snow";
import { resolveVideoEmbed } from "@/lib/json-render/video-embed";
import { cn } from "@/lib/utils";
import { Button as UiButton } from "@/components/ui/button";
import { creativeWebCards } from "@/components/json-render/creative-cards";
import { devopsWebCards } from "@/components/json-render/devops-cards";
import { structuredWebCards } from "@/components/json-render/structured-cards";
import { useMemo, useState } from "react";

/** Light fretboard panel so dots stay readable in dark mode. */
const CHORD_BOARD = {
  fill: "#E8E4DC",
  line: "#3A3A3A",
  dot: "#1A1A1A",
  label: "#1A1A1A",
} as const;

const gapClass = {
  sm: "gap-2",
  md: "gap-3",
  lg: "gap-4",
} as const;

const badgeToneClass = {
  neutral: "bg-muted text-muted-foreground",
  positive: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  negative: "bg-red-500/15 text-red-700 dark:text-red-300",
  warning: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
} as const;

function httpsSrc(src: string | null | undefined): string | null {
  if (!src || typeof src !== "string") return null;
  try {
    const url = new URL(src);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function GuitarChordDiagram({
  name,
  frets,
  baseFret,
}: {
  name: string;
  frets: readonly number[];
  baseFret: number | null;
}) {
  const { dots, baseFret: windowBase } = guitarChordDots(frets, baseFret);
  const width = 148;
  const height = 168;
  const left = 28;
  const top = 36;
  const boardW = 84;
  const boardH = 100;
  const stringGap = boardW / (GUITAR_STRING_COUNT - 1);
  const fretGap = boardH / GUITAR_FRET_COUNT;
  const pad = 8;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${name} guitar chord`}
    >
      <rect
        x={left - pad}
        y={top - pad}
        width={boardW + pad * 2}
        height={boardH + pad * 2}
        rx={8}
        fill={CHORD_BOARD.fill}
      />
      {windowBase > 1 ? (
        <text
          x={12}
          y={top + fretGap * 0.7}
          fill={CHORD_BOARD.label}
          fontSize="11"
          fontWeight="700"
        >
          {windowBase}
        </text>
      ) : null}
      {Array.from({ length: GUITAR_FRET_COUNT + 1 }, (_, fret) => (
        <line
          key={`fret-${fret}`}
          x1={left}
          y1={top + fret * fretGap}
          x2={left + boardW}
          y2={top + fret * fretGap}
          stroke={CHORD_BOARD.line}
          strokeWidth={fret === 0 && windowBase === 1 ? 3.5 : 1.4}
        />
      ))}
      {Array.from({ length: GUITAR_STRING_COUNT }, (_, stringIndex) => (
        <line
          key={`string-${stringIndex}`}
          x1={left + stringIndex * stringGap}
          y1={top}
          x2={left + stringIndex * stringGap}
          y2={top + boardH}
          stroke={CHORD_BOARD.line}
          strokeWidth={1.1}
        />
      ))}
      {dots.map((dot) => {
        const x = left + dot.stringIndex * stringGap;
        if (dot.muted) {
          return (
            <text
              key={`m-${dot.stringIndex}`}
              x={x}
              y={top - 12}
              fill={CHORD_BOARD.label}
              fontSize="13"
              fontWeight="700"
              textAnchor="middle"
            >
              ×
            </text>
          );
        }
        if (dot.open) {
          return (
            <circle
              key={`o-${dot.stringIndex}`}
              cx={x}
              cy={top - 14}
              r={5}
              stroke={CHORD_BOARD.line}
              strokeWidth={1.75}
              fill="none"
            />
          );
        }
        if (dot.fret < 1 || dot.fret > GUITAR_FRET_COUNT) return null;
        return (
          <circle
            key={`d-${dot.stringIndex}`}
            cx={x}
            cy={top + (dot.fret - 0.5) * fretGap}
            r={7}
            fill={CHORD_BOARD.dot}
          />
        );
      })}
    </svg>
  );
}

function GuitarChordBrowser({
  name,
  frets,
  baseFret,
  agentVoicings,
}: {
  name: string;
  frets: number[];
  baseFret: number | null;
  agentVoicings: ChordVoicing[] | null;
}) {
  const [chordIndex, setChordIndex] = useState(() =>
    initialLibraryIndex(name),
  );
  const [voicingIndex, setVoicingIndex] = useState(0);

  const selected = CHORD_LIBRARY[chordIndex] ?? CHORD_LIBRARY[0]!;
  const matchedLibrary = findChordByName(name);
  const usingAgentSeed =
    matchedLibrary != null && selected.id === matchedLibrary.id;

  const voicings = useMemo(() => {
    if (usingAgentSeed) {
      return mergeVoicings(matchedLibrary, {
        name,
        frets,
        baseFret,
        voicings: agentVoicings,
      });
    }
    return selected.voicings;
  }, [
    agentVoicings,
    baseFret,
    frets,
    matchedLibrary,
    name,
    selected.voicings,
    usingAgentSeed,
  ]);

  const activeVoicing =
    voicings[Math.min(voicingIndex, voicings.length - 1)] ?? voicings[0]!;

  const selectChord = (index: number) => {
    setChordIndex(index);
    setVoicingIndex(0);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-foreground text-[15px] font-medium">
        {selected.name}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {CHORD_LIBRARY.map((chord, index) => {
          const active = index === chordIndex;
          return (
            <button
              key={chord.id}
              type="button"
              aria-pressed={active}
              onClick={() => selectChord(index)}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-1 text-[12px] font-medium",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/70 bg-muted/40 text-muted-foreground",
              )}
            >
              {chord.name.replace(" major", "").replace(" minor", "m")}
            </button>
          );
        })}
      </div>
      {voicings.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {voicings.map((voicing, index) => {
            const active = index === voicingIndex;
            return (
              <button
                key={`${voicing.label}-${index}`}
                type="button"
                aria-pressed={active}
                onClick={() => setVoicingIndex(index)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-[12px] font-medium",
                  active
                    ? "border-foreground/40 bg-muted text-foreground"
                    : "border-border/50 text-muted-foreground",
                )}
              >
                {voicing.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <GuitarChordDiagram
        name={selected.name}
        frets={activeVoicing.frets}
        baseFret={activeVoicing.baseFret}
      />
    </div>
  );
}

function SpeakButton({
  text,
  lang,
  audioUrl,
  label,
}: {
  text: string;
  lang?: string | null;
  audioUrl?: string | null;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Play pronunciation of ${label}`}
      disabled={busy || !text.trim()}
      onClick={() => {
        void (async () => {
          setBusy(true);
          try {
            await playSpeakable({
              text,
              lang,
              audioUrl,
              aiSpeech: {
                text,
                lang,
                endpoint: "/api/speech",
              },
            });
          } finally {
            setBusy(false);
          }
        })();
      }}
      className="border-border/60 bg-muted/40 text-foreground hover:bg-muted inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium disabled:opacity-50"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="size-3.5 fill-none stroke-current"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </svg>
      {busy ? "Playing…" : "Play"}
    </button>
  );
}

function CircleOfFifthsSvg({ highlightKey }: { highlightKey: string | null }) {
  const size = 160;
  const positions = circleOfFifthsPositions(highlightKey, 80, 80, 58);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={
        highlightKey
          ? `Circle of fifths highlighting ${highlightKey}`
          : "Circle of fifths"
      }
      className="text-foreground"
    >
      <circle
        cx={80}
        cy={80}
        r={58}
        stroke="currentColor"
        strokeWidth={1.25}
        fill="none"
        opacity={0.35}
      />
      {positions.map((pos) => (
        <text
          key={pos.key}
          x={pos.x}
          y={pos.y + 4}
          fill="currentColor"
          fontSize={pos.highlighted ? 13 : 11}
          fontWeight={pos.highlighted ? 700 : 500}
          textAnchor="middle"
          opacity={pos.highlighted ? 1 : 0.7}
        >
          {pos.key}
        </text>
      ))}
      {highlightKey ? (
        <circle cx={80} cy={80} r={18} fill="currentColor" opacity={0.08} />
      ) : null}
    </svg>
  );
}

export const { registry: chatRegistry } = defineRegistry(chatCatalog, {
  components: {
    Stack: ({ props, children }) => (
      <div
        className={cn(
          "flex",
          props.direction === "horizontal" ? "flex-row flex-wrap items-center" : "flex-col",
          gapClass[props.gap ?? "md"],
        )}
      >
        {children}
      </div>
    ),
    Card: ({ props, children }) => (
      <div className="border-border/60 bg-muted/20 flex flex-col gap-3 rounded-xl border px-3.5 py-3">
        {(props.title || props.description) && (
          <div className="flex flex-col gap-0.5">
            {props.title ? (
              <div className="text-foreground text-[15px] font-medium leading-snug">
                {props.title}
              </div>
            ) : null}
            {props.description ? (
              <div className="text-muted-foreground text-[13.5px] leading-relaxed">
                {props.description}
              </div>
            ) : null}
          </div>
        )}
        {children}
      </div>
    ),
    Divider: () => <hr className="border-border/60 my-1 border-t" />,
    Heading: ({ props }) => {
      const className = cn(
        "text-foreground font-medium",
        props.level === "1" && "text-lg leading-7",
        props.level === "3" && "text-sm leading-5",
        (!props.level || props.level === "2") && "text-base leading-6",
      );
      if (props.level === "1") return <h2 className={className}>{props.text}</h2>;
      if (props.level === "3") return <h4 className={className}>{props.text}</h4>;
      return <h3 className={className}>{props.text}</h3>;
    },
    Text: ({ props }) => (
      <p
        className={cn(
          "text-[15px] leading-6",
          props.muted ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {props.text}
      </p>
    ),
    Metric: ({ props }) => (
      <div className="flex min-w-[7rem] flex-col gap-0.5">
        <div className="text-muted-foreground text-[12.5px] leading-4">{props.label}</div>
        <div className="text-foreground text-xl font-semibold tracking-tight tabular-nums">
          {props.value}
        </div>
        {props.hint ? (
          <div className="text-muted-foreground text-[12px] leading-4">{props.hint}</div>
        ) : null}
      </div>
    ),
    Badge: ({ props }) => (
      <span
        className={cn(
          "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[12px] font-medium",
          badgeToneClass[props.tone ?? "neutral"],
        )}
      >
        {props.label}
      </span>
    ),
    ComparisonBar: ({ props }) => {
      const shares = comparisonBarShares(props.leftValue, props.rightValue);
      return (
        <div className="flex w-full flex-col gap-1.5">
          <div className="text-foreground flex items-baseline justify-between gap-3 text-[13px] font-medium">
            <span>
              {props.leftLabel}{" "}
              <span className="tabular-nums">{props.leftValue}%</span>
            </span>
            <span className="text-right">
              {props.rightLabel}{" "}
              <span className="tabular-nums">{props.rightValue}%</span>
            </span>
          </div>
          <div
            className="bg-muted flex h-2.5 w-full overflow-hidden rounded-full"
            role="img"
            aria-label={`${props.leftLabel} ${props.leftValue}%, ${props.rightLabel} ${props.rightValue}%`}
          >
            <div
              className="bg-foreground/80 h-full"
              style={{ width: `${shares.left}%` }}
            />
            <div
              className="bg-foreground/25 h-full"
              style={{ width: `${shares.right}%` }}
            />
          </div>
          {props.caption ? (
            <div className="text-muted-foreground text-[12px] leading-4">
              {props.caption}
            </div>
          ) : null}
        </div>
      );
    },
    Table: ({ props }) => {
      const compactColumns = props.columns.map((column, columnIndex) =>
        isCompactTableColumn(column, props.rows, columnIndex),
      );
      const numericColumns = props.columns.map((_, columnIndex) =>
        isNumericTableColumn(props.rows, columnIndex),
      );
      return (
        <div className="overflow-x-auto">
          <table className="w-max min-w-full border-collapse text-left text-[13.5px] leading-5">
            <thead>
              <tr className="border-border/50 border-b">
                {props.columns.map((column, columnIndex) => (
                  <th
                    key={column}
                    className={cn(
                      "text-muted-foreground py-1.5 text-[12.5px] font-medium align-bottom",
                      columnIndex === 0 ? "pr-3 pl-0" : "px-3",
                      numericColumns[columnIndex]
                        ? "whitespace-nowrap text-right tabular-nums"
                        : compactColumns[columnIndex]
                          ? "whitespace-nowrap"
                          : "min-w-[12rem] max-w-[20rem]",
                    )}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-border/40 border-b last:border-b-0"
                >
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={cn(
                        "text-foreground py-1.5 align-top",
                        cellIndex === 0 ? "pr-3 pl-0" : "px-3",
                        numericColumns[cellIndex]
                          ? "whitespace-nowrap text-right tabular-nums"
                          : compactColumns[cellIndex]
                            ? "whitespace-nowrap"
                            : "min-w-[12rem] max-w-[20rem] wrap-break-word",
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    },
    Image: ({ props }) => {
      const src = httpsSrc(props.src);
      if (!src) return null;
      return (
        // eslint-disable-next-line @next/next/no-img-element -- generative UI URLs are dynamic https sources
        <img
          src={src}
          alt={props.alt ?? ""}
          className="border-border/50 max-h-64 w-full rounded-lg border object-cover"
        />
      );
    },
    Button: ({ props, emit }) => (
      <UiButton
        type="button"
        size="sm"
        variant={props.variant ?? "default"}
        onClick={() => emit("press")}
      >
        {props.label}
      </UiButton>
    ),
    SearchResults: ({ props }) => (
      <div className="flex flex-col gap-2.5">
        {props.items.map((item, index) => {
          const image = httpsSrc(item.image);
          return (
            <div
              key={index}
              className={cn(
                "gap-2.5",
                image ? "flex flex-row items-start" : "flex flex-col",
              )}
            >
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element -- generative UI URLs are dynamic https sources
                <img
                  src={image}
                  alt={item.title}
                  className="border-border/50 h-16 w-16 shrink-0 rounded-lg border object-cover"
                />
              ) : null}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="text-foreground text-[15px] font-medium leading-snug">
                  {item.title}
                </div>
                {item.detail ? (
                  <div className="text-muted-foreground text-[13.5px] leading-relaxed">
                    {item.detail}
                  </div>
                ) : null}
                {item.meta ? (
                  <div className="text-muted-foreground text-[12px]">
                    {item.meta}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    ),
    PlaceMap: ({ props }) => (
      <div className="flex flex-col gap-2">
        {props.title ? (
          <div className="text-foreground text-[15px] font-medium">{props.title}</div>
        ) : null}
        {props.address ? (
          <div className="text-muted-foreground text-[13.5px]">{props.address}</div>
        ) : null}
        <div className="border-border/60 bg-muted/30 relative h-40 w-full overflow-hidden rounded-lg border">
          <div className="bg-border/40 absolute top-1/3 right-0 left-0 h-px" />
          <div className="bg-border/40 absolute top-0 bottom-0 left-1/2 w-px" />
          {props.pins.map((pin, index) => {
            const x = clampPin(pin.x);
            const y = clampPin(pin.y);
            return (
              <div
                key={index}
                className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <span className="bg-foreground border-background h-3.5 w-3.5 rounded-full border-2" />
                <span className="bg-background/90 text-foreground mt-0.5 max-w-[5.5rem] truncate rounded px-1 text-[11px] font-medium">
                  {pin.label}
                </span>
              </div>
            );
          })}
        </div>
        {props.pins.some((pin) => pin.detail) ? (
          <div className="flex flex-col gap-1">
            {props.pins.map((pin, index) =>
              pin.detail ? (
                <div key={index} className="text-muted-foreground text-[12px]">
                  {pin.label} — {pin.detail}
                </div>
              ) : null,
            )}
          </div>
        ) : null}
      </div>
    ),
    NewsBrief: ({ props }) => (
      <div className="flex flex-col gap-2">
        {props.kicker ? (
          <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            {props.kicker}
          </div>
        ) : null}
        <div className="text-foreground text-base font-medium leading-snug">
          {props.headline}
        </div>
        {props.dek ? (
          <div className="text-muted-foreground text-[13.5px] leading-relaxed">
            {props.dek}
          </div>
        ) : null}
        {props.bullets && props.bullets.length > 0 ? (
          <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-4 text-[13.5px]">
            {props.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        ) : null}
        {props.sources && props.sources.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {props.sources.map((source) => (
              <span
                key={source}
                className="bg-muted text-muted-foreground inline-flex rounded-full px-2 py-0.5 text-[12px] font-medium"
              >
                {source}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    ),
    Encyclopedia: ({ props }) => {
      const image = httpsSrc(props.image);
      return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="text-foreground text-base font-medium">{props.title}</div>
          <div className="text-muted-foreground text-[13.5px] leading-relaxed">
            {props.lead}
          </div>
        </div>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- generative UI URLs are dynamic https sources
          <img
            src={image}
            alt={props.title}
            className="border-border/50 h-40 w-full rounded-lg border object-cover"
          />
        ) : null}
        {props.infobox && props.infobox.length > 0 ? (
          <div className="border-border/60 bg-muted/30 flex flex-col gap-1.5 rounded-lg border px-2.5 py-2">
            {props.infobox.map((pair) => (
              <div key={pair.label} className="flex justify-between gap-3 text-[12.5px]">
                <span className="text-muted-foreground font-medium">{pair.label}</span>
                <span className="text-foreground text-right">{pair.value}</span>
              </div>
            ))}
          </div>
        ) : null}
        {props.sections?.map((section) => (
          <div key={section.heading} className="flex flex-col gap-0.5">
            <div className="text-foreground text-[15px] font-medium">
              {section.heading}
            </div>
            <div className="text-muted-foreground text-[13.5px] leading-relaxed">
              {section.body}
            </div>
          </div>
        ))}
      </div>
      );
    },
    Pronounce: ({ props }) => {
      const spoken = props.spoken?.trim() || props.word;
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="text-foreground text-base font-medium">
                {props.word}
              </div>
              {props.ipa ? (
                <div className="text-foreground text-[15px] tracking-wide">
                  /{props.ipa}/
                </div>
              ) : null}
              {props.syllables ? (
                <div className="text-muted-foreground text-[13.5px] font-medium">
                  {props.syllables}
                </div>
              ) : null}
              {props.note ? (
                <div className="text-muted-foreground text-[12px]">
                  {props.note}
                </div>
              ) : null}
            </div>
            <SpeakButton
              text={spoken}
              lang={props.lang}
              audioUrl={props.audio}
              label={props.word}
            />
          </div>
        </div>
      );
    },
    Phrase: ({ props }) => {
      const spoken = props.spoken?.trim() || props.translation;
      return (
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground text-[12px] font-medium">
            {props.sourceLanguage} → {props.targetLanguage}
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="text-foreground text-base font-medium">
                {props.phrase}
              </div>
              <div className="text-foreground text-[15px]">{props.translation}</div>
              {props.literal ? (
                <div className="text-muted-foreground text-[12px]">
                  Literal: {props.literal}
                </div>
              ) : null}
            </div>
            <SpeakButton
              text={spoken}
              lang={props.lang}
              audioUrl={props.audio}
              label={props.translation}
            />
          </div>
        </div>
      );
    },
    GuitarChord: ({ props }) => (
      <GuitarChordBrowser
        name={props.name}
        frets={props.frets}
        baseFret={props.baseFret}
        agentVoicings={props.voicings}
      />
    ),
    TheoryBoard: ({ props }) => (
      <div className="flex flex-col gap-3">
        {props.title ? (
          <div className="text-foreground text-[15px] font-medium">{props.title}</div>
        ) : null}
        {props.progression && props.progression.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {props.progression.map((roman, index) => (
              <span
                key={`${roman}-${index}`}
                className="bg-muted text-foreground rounded-lg px-2.5 py-1 text-[15px] font-medium"
              >
                {roman}
              </span>
            ))}
          </div>
        ) : null}
        {props.showCircle !== false ? (
          <CircleOfFifthsSvg highlightKey={props.highlightKey} />
        ) : null}
      </div>
    ),
    RegionChart: ({ props }) => {
      const widths = regionBarWidths(props.regions.map((r) => r.value));
      const unit = props.unit ?? "%";
      return (
        <div className="flex flex-col gap-2">
          {props.title ? (
            <div className="text-foreground text-[15px] font-medium">{props.title}</div>
          ) : null}
          {props.regions.map((region, index) => (
            <div key={region.label} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className="text-foreground font-medium">{region.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {region.value}
                  {unit}
                  {region.hint ? ` · ${region.hint}` : ""}
                </span>
              </div>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className="bg-foreground/70 h-full rounded-full"
                  style={{ width: `${widths[index] ?? 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      );
    },
    Explainer: ({ props }) => (
      <div className="flex flex-col gap-2.5">
        <div className="text-foreground text-[15px] font-medium">{props.title}</div>
        {props.steps.map((step, index) => (
          <div key={step.heading} className="flex gap-2.5">
            <div className="bg-muted text-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-medium">
              {index + 1}
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="text-foreground text-[13.5px] font-medium">
                {step.heading}
              </div>
              <div className="text-muted-foreground text-[13.5px] leading-relaxed">
                {step.body}
              </div>
            </div>
          </div>
        ))}
      </div>
    ),
    Recipe: ({ props }) => (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <div className="text-foreground text-[15px] font-medium">{props.title}</div>
          <div className="text-muted-foreground flex flex-wrap gap-2 text-[12px]">
            {props.time ? <span>{props.time}</span> : null}
            {props.yield ? <span>{props.yield}</span> : null}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-foreground text-[13.5px] font-medium">Ingredients</div>
          <ul className="text-muted-foreground list-disc space-y-0.5 pl-4 text-[13.5px]">
            {props.ingredients.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="text-foreground text-[13.5px] font-medium">Method</div>
          <ol className="text-muted-foreground list-decimal space-y-1 pl-4 text-[13.5px] leading-relaxed">
            {props.method.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </div>
    ),
    Chart: ({ props }) => {
      const points = props.points ?? [];
      const visibleCount = clampVisibleCount(points.length, props.visibleCount);
      const layout = chartSeriesLayout(points, visibleCount);
      const trend = inferChartTrend(props.delta, props.trend);
      const tone = chartDeltaTone(trend, props.upIsGood);
      const variant = props.variant ?? "area";
      return (
        <div className="flex flex-col gap-2" data-slot="chart">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">
              {props.label}
            </span>
            {props.delta ? (
              <span
                className={cn(
                  "font-mono text-[11px]",
                  tone === "positive" && "text-emerald-600 dark:text-emerald-400",
                  tone === "negative" && "text-red-600 dark:text-red-400",
                  tone === "neutral" && "text-muted-foreground",
                )}
              >
                {props.delta}
              </span>
            ) : null}
          </div>
          <div className="text-foreground text-2xl font-semibold tracking-tight tabular-nums">
            {props.value}
          </div>
          <svg viewBox="0 0 240 72" className="text-foreground h-16 w-full" aria-hidden>
            {variant === "bars"
              ? layout.bars.map((bar, index) => (
                  <rect
                    key={index}
                    x={bar.x}
                    y={bar.y}
                    width={bar.w}
                    height={bar.h}
                    rx={1}
                    className={bar.last ? "fill-blue-500" : "fill-foreground/25"}
                  />
                ))
              : null}
            {variant === "area" && layout.areaPath ? (
              <path d={layout.areaPath} className="fill-blue-500/20" />
            ) : null}
            {(variant === "area" || variant === "line") && layout.linePath ? (
              <path
                d={layout.linePath}
                fill="none"
                strokeWidth={2}
                className="stroke-blue-500"
              />
            ) : null}
            {(variant === "area" || variant === "line") && layout.visible.length > 0 ? (
              <circle
                cx={layout.visible[layout.visible.length - 1]!.x}
                cy={layout.visible[layout.visible.length - 1]!.y}
                r={3}
                className="fill-blue-500"
              />
            ) : null}
          </svg>
        </div>
      );
    },
    SpecSheet: ({ props }) => {
      const count =
        props.visibleCount == null || !Number.isFinite(props.visibleCount)
          ? props.rows.length
          : Math.max(0, Math.min(props.rows.length, Math.floor(props.visibleCount)));
      const rows = props.rows.slice(0, count);
      return (
        <div className="flex flex-col gap-3" data-slot="spec-sheet">
          <div className="flex flex-col gap-0.5">
            <span className="text-foreground text-[15px] font-medium">{props.title}</span>
            {props.subtitle ? (
              <span className="text-muted-foreground text-[12px]">{props.subtitle}</span>
            ) : null}
          </div>
          <div className="flex flex-col">
            {rows.map((row, index) => (
              <div
                key={row.label}
                className={cn(
                  "flex items-baseline justify-between gap-3 py-1.5 text-[13px]",
                  index > 0 && "border-border/60 border-t",
                )}
              >
                <span className="text-muted-foreground font-mono text-[11px]">
                  {row.label}
                </span>
                <span
                  className={cn(
                    "text-right",
                    row.emphasis
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground",
                  )}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    },
    MermaidDiagram: ({ props }) => (
      <div className="flex flex-col gap-2">
        {props.title ? (
          <div className="text-foreground text-[15px] font-medium">{props.title}</div>
        ) : null}
        {props.streaming ? (
          <div
            data-slot="mermaid-skeleton"
            className="bg-muted/40 text-muted-foreground rounded-xl border border-dashed p-4 text-[13px]"
            aria-label="Rendering diagram"
          >
            Rendering diagram…
          </div>
        ) : (
          <MermaidBlock code={props.code} />
        )}
      </div>
    ),
    FlightTracker: ({ props }) => {
      const progress = Math.max(0, Math.min(100, props.progress));
      return (
        <div className="flex flex-col gap-3">
          <div className="text-muted-foreground flex justify-between text-[12px]">
            <span>
              {props.airline} · {props.flightNumber}
            </span>
            <span>{props.status}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-foreground text-3xl font-bold tracking-tight">
              {props.origin}
            </span>
            <span className="text-muted-foreground text-lg" aria-hidden>
              ✈
            </span>
            <span className="text-foreground text-3xl font-bold tracking-tight">
              {props.destination}
            </span>
          </div>
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-muted-foreground flex justify-between text-[12px]">
            <span>{props.elapsed ?? ""}</span>
            <span>{props.remaining ?? ""}</span>
          </div>
        </div>
      );
    },
    CalendarEvent: ({ props }) => (
      <div className="flex flex-col gap-1.5">
        <div className="text-muted-foreground text-[12px]">{props.date}</div>
        <div className="text-foreground text-[17px] font-medium">{props.title}</div>
        <div className="text-muted-foreground text-[13px]">
          {props.time}
          {props.location ? ` · ${props.location}` : ""}
        </div>
      </div>
    ),
    CreateEvent: ({ props }) => {
      const actions = useActions();
      const events = props.events ?? [];
      return (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-foreground text-3xl font-bold tabular-nums">
              {props.day}
            </span>
            <div className="flex flex-col">
              <span className="text-foreground text-[14px] font-semibold">
                {props.month}
              </span>
              <span className="text-muted-foreground text-[12px]">{props.weekday}</span>
            </div>
          </div>
          <div className="border-border/60 border-t" />
          {events.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {events.map((event) => (
                <div key={`${event.title}-${event.time}`} className="flex items-center gap-3">
                  <div className="bg-foreground/50 h-8 w-0.5 rounded-full" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-foreground text-[13.5px] font-medium">
                      {event.title}
                    </span>
                    <span className="text-muted-foreground text-[12px]">{event.time}</span>
                  </div>
                  {event.tag ? (
                    <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px]">
                      {event.tag}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              <span className="text-foreground text-[13.5px] font-medium">{props.title}</span>
              <span className="text-muted-foreground text-[12px]">
                {props.start}
                {props.end ? ` – ${props.end}` : ""}
                {props.location ? ` · ${props.location}` : ""}
              </span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <UiButton
              type="button"
              size="sm"
              onClick={() =>
                void actions.execute({
                  action: "reply",
                  params: {
                    message: createEventConfirmMessage({
                      title: props.title,
                      start: props.start,
                      end: props.end,
                      location: props.location,
                      calendarId: props.calendarId,
                    }),
                  },
                })
              }
            >
              Add to calendar
            </UiButton>
            <UiButton
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                void actions.execute({
                  action: "reply",
                  params: { message: createEventDiscardMessage(props.title) },
                })
              }
            >
              Discard
            </UiButton>
          </div>
        </div>
      );
    },
    Booking: ({ props }) => {
      const actions = useActions();
      return (
        <div className="flex flex-col gap-3">
          <div className="text-foreground text-[15px] font-medium">
            {props.restaurant ? `Reserve · ${props.restaurant}` : "Reserve a table"}
          </div>
          <div className="text-muted-foreground grid grid-cols-2 gap-2 text-[13px]">
            {props.name ? (
              <>
                <span>Name</span>
                <span className="text-foreground text-right">{props.name}</span>
              </>
            ) : null}
            <span>Party</span>
            <span className="text-foreground text-right">{props.partySize}</span>
            <span>Date</span>
            <span className="text-foreground text-right">{props.date}</span>
            {props.seating ? (
              <>
                <span>Seating</span>
                <span className="text-foreground text-right capitalize">
                  {props.seating}
                </span>
              </>
            ) : null}
            {props.reminder != null ? (
              <>
                <span>Reminder</span>
                <span className="text-foreground text-right">
                  {props.reminder ? "Yes" : "No"}
                </span>
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <UiButton
              type="button"
              size="sm"
              onClick={() =>
                void actions.execute({
                  action: "reply",
                  params: {
                    message: bookingConfirmMessage({
                      restaurant: props.restaurant,
                      name: props.name,
                      partySize: props.partySize,
                      date: props.date,
                      seating: props.seating,
                      reminder: props.reminder,
                    }),
                  },
                })
              }
            >
              Confirm reservation
            </UiButton>
            <UiButton
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                void actions.execute({
                  action: "reply",
                  params: { message: bookingCancelMessage(props.restaurant) },
                })
              }
            >
              Cancel
            </UiButton>
          </div>
        </div>
      );
    },
    EmailDraft: ({ props }) => {
      const actions = useActions();
      return (
        <div className="flex flex-col gap-3">
          <div className="text-muted-foreground flex flex-col gap-1 text-[12px]">
            <div>
              <span className="font-medium">To</span> {props.to}
            </div>
            {props.cc ? (
              <div>
                <span className="font-medium">Cc</span> {props.cc}
              </div>
            ) : null}
            {props.bcc ? (
              <div>
                <span className="font-medium">Bcc</span> {props.bcc}
              </div>
            ) : null}
            <div className="text-foreground text-[14px] font-medium">{props.subject}</div>
          </div>
          <pre className="text-muted-foreground whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed">
            {props.body}
          </pre>
          <div className="flex flex-wrap gap-2">
            <UiButton
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                void actions.execute({
                  action: "reply",
                  params: {
                    message: emailDraftSaveMessage({
                      to: props.to,
                      cc: props.cc,
                      bcc: props.bcc,
                      subject: props.subject,
                      body: props.body,
                      accountId: props.accountId,
                      threadId: props.threadId,
                    }),
                  },
                })
              }
            >
              Save draft
            </UiButton>
            <UiButton
              type="button"
              size="sm"
              onClick={() =>
                void actions.execute({
                  action: "reply",
                  params: {
                    message: emailDraftSendMessage({
                      to: props.to,
                      cc: props.cc,
                      bcc: props.bcc,
                      subject: props.subject,
                      body: props.body,
                      accountId: props.accountId,
                      threadId: props.threadId,
                    }),
                  },
                })
              }
            >
              Send
            </UiButton>
          </div>
        </div>
      );
    },
    EmailBatch: ({ props }) => {
      const actions = useActions();
      return (
        <div className="flex flex-col gap-3">
          <div className="text-foreground text-[14px] font-medium">
            {props.items.length} thread{props.items.length === 1 ? "" : "s"}
          </div>
          <div className="flex flex-col gap-2">
            {props.items.map((item) => (
              <div
                key={`${item.accountId}:${item.threadId}`}
                className="border-border/50 flex flex-col gap-0.5 rounded-lg border px-2.5 py-2"
              >
                <div className="text-foreground text-[13px] font-medium">
                  {item.subject ?? item.threadId}
                </div>
                <div className="text-muted-foreground text-[12px]">
                  {item.from ? `${item.from} · ` : ""}
                  {item.action === "archive" ? "Archive" : "Mark read"}
                </div>
              </div>
            ))}
          </div>
          <UiButton
            type="button"
            size="sm"
            onClick={() =>
              void actions.execute({
                action: "reply",
                params: { message: emailBatchConfirmMessage(props.items) },
              })
            }
          >
            Confirm batch
          </UiButton>
        </div>
      );
    },
    SurfReport: ({ props }) => (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <div className="text-foreground text-[15px] font-medium">{props.spot}</div>
          <div className="text-muted-foreground text-[12px]">
            {[props.region, props.updated, props.rating].filter(Boolean).join(" · ")}
          </div>
        </div>
        {props.summary ? (
          <div className="text-muted-foreground text-[13.5px] leading-relaxed">
            {props.summary}
          </div>
        ) : null}
        <div className="grid grid-cols-3 gap-2 text-[12px]">
          {props.wave ? (
            <div className="bg-muted/40 rounded-lg p-2">
              <div className="text-muted-foreground">Wave</div>
              <div className="text-foreground font-medium">{props.wave}</div>
            </div>
          ) : null}
          {props.wind ? (
            <div className="bg-muted/40 rounded-lg p-2">
              <div className="text-muted-foreground">Wind</div>
              <div className="text-foreground font-medium">{props.wind}</div>
            </div>
          ) : null}
          {props.tide ? (
            <div className="bg-muted/40 rounded-lg p-2">
              <div className="text-muted-foreground">Tide</div>
              <div className="text-foreground font-medium">{props.tide}</div>
            </div>
          ) : null}
        </div>
        {props.periods && props.periods.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {props.periods.map((period) => (
              <div
                key={period.label}
                className="text-muted-foreground flex justify-between gap-2 text-[12px]"
              >
                <span className="text-foreground font-medium">{period.label}</span>
                <span>
                  {period.wave} · {period.wind}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    ),
    SurfSpotPick: ({ props }) => (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          {props.timeframe ? (
            <div className="text-muted-foreground text-[12px]">{props.timeframe}</div>
          ) : null}
          <div className="text-foreground text-[15px] font-medium">
            Go to {props.pick}
          </div>
          {props.reason ? (
            <div className="text-muted-foreground text-[13.5px] leading-relaxed">
              {props.reason}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          {props.options.map((option) => {
            const isPick = option.name === props.pick;
            return (
              <div
                key={option.name}
                className={cn(
                  "flex flex-col gap-0.5 rounded-lg border px-2.5 py-2",
                  isPick
                    ? "border-foreground/30 bg-muted/50"
                    : "border-border/50",
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={cn(
                      "text-[13.5px]",
                      isPick
                        ? "text-foreground font-semibold"
                        : "text-foreground font-medium",
                    )}
                  >
                    {option.name}
                    {isPick ? " · pick" : ""}
                  </span>
                  {option.rating ? (
                    <span className="text-muted-foreground text-[12px]">
                      {option.rating}
                    </span>
                  ) : null}
                </div>
                <div className="text-muted-foreground text-[12px]">
                  {[option.wave, option.wind].filter(Boolean).join(" · ")}
                </div>
                {option.note ? (
                  <div className="text-muted-foreground text-[12px] leading-relaxed">
                    {option.note}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    ),
    SnowReport: ({ props }) => {
      const image = httpsSrc(props.image);
      const trailLevels = props.trailLevels ?? [];
      return (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <div className="text-foreground text-[15px] font-medium">{props.resort}</div>
            <div className="text-muted-foreground text-[12px]">
              {[props.region, props.updated].filter(Boolean).join(" · ")}
            </div>
          </div>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- generative UI URLs are dynamic https sources
            <img
              src={image}
              alt={props.resort}
              className="border-border/50 max-h-40 w-full rounded-lg border object-cover"
            />
          ) : null}
          {props.summary ? (
            <div className="text-muted-foreground text-[13.5px] leading-relaxed">
              {props.summary}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            {props.baseDepth ? (
              <div>
                <div className="text-muted-foreground">Base</div>
                <div className="text-foreground font-medium">{props.baseDepth}</div>
              </div>
            ) : null}
            {props.newSnow ? (
              <div>
                <div className="text-muted-foreground">New snow</div>
                <div className="text-foreground font-medium">{props.newSnow}</div>
              </div>
            ) : null}
            {props.conditions ? (
              <div>
                <div className="text-muted-foreground">Conditions</div>
                <div className="text-foreground font-medium">{props.conditions}</div>
              </div>
            ) : null}
            {props.liftsOpen ? (
              <div>
                <div className="text-muted-foreground">Lifts</div>
                <div className="text-foreground font-medium">{props.liftsOpen}</div>
              </div>
            ) : null}
            {props.trailsOpen ? (
              <div>
                <div className="text-muted-foreground">Trails</div>
                <div className="text-foreground font-medium">{props.trailsOpen}</div>
              </div>
            ) : null}
          </div>
          {trailLevels.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <div className="text-muted-foreground text-[12px]">Open by level</div>
              <div className="flex flex-col gap-1.5">
                {trailLevels.map((entry) => {
                  const meta = snowTrailLevelMeta(entry.level);
                  return (
                    <div
                      key={entry.level}
                      className="flex items-center justify-between gap-3 text-[13px]"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="inline-flex w-5 items-center justify-start gap-0.5"
                        >
                          <span
                            className={cn(
                              "inline-block shrink-0",
                              meta.symbol === "circle" &&
                                "h-2.5 w-2.5 rounded-full",
                              meta.symbol === "square" &&
                                "h-2.5 w-2.5 rounded-[2px]",
                              (meta.symbol === "diamond" ||
                                meta.symbol === "double-diamond") &&
                                "h-2.5 w-2.5 rotate-45 rounded-[1px]",
                            )}
                            style={{ backgroundColor: meta.color }}
                          />
                          {meta.symbol === "double-diamond" ? (
                            <span
                              className="inline-block h-2.5 w-2.5 shrink-0 rotate-45 rounded-[1px]"
                              style={{ backgroundColor: meta.color }}
                            />
                          ) : null}
                        </span>
                        <span className="text-foreground">{meta.label}</span>
                      </div>
                      <span className="text-foreground font-medium tabular-nums">
                        {formatSnowLevelCount(entry.open, entry.total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      );
    },
    MountainPick: ({ props }) => (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          {props.timeframe ? (
            <div className="text-muted-foreground text-[12px]">{props.timeframe}</div>
          ) : null}
          <div className="text-foreground text-[15px] font-medium">
            Go to {props.pick}
          </div>
          {props.reason ? (
            <div className="text-muted-foreground text-[13.5px] leading-relaxed">
              {props.reason}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          {props.options.map((option) => {
            const isPick = option.name === props.pick;
            return (
              <div
                key={option.name}
                className={cn(
                  "flex flex-col gap-0.5 rounded-lg border px-2.5 py-2",
                  isPick
                    ? "border-foreground/30 bg-muted/50"
                    : "border-border/50",
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={cn(
                      "text-[13.5px]",
                      isPick
                        ? "text-foreground font-semibold"
                        : "text-foreground font-medium",
                    )}
                  >
                    {option.name}
                    {isPick ? " · pick" : ""}
                  </span>
                  {option.newSnow ? (
                    <span className="text-muted-foreground text-[12px]">
                      {option.newSnow}
                    </span>
                  ) : null}
                </div>
                <div className="text-muted-foreground text-[12px]">
                  {[option.baseDepth, option.conditions, option.liftsOpen]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {option.note ? (
                  <div className="text-muted-foreground text-[12px] leading-relaxed">
                    {option.note}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    ),
    DailyBrief: ({ props }) => (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <div className="text-foreground text-[15px] font-medium">
            {props.title ?? "Daily brief"}
          </div>
          {props.date ? (
            <div className="text-muted-foreground text-[12px]">{props.date}</div>
          ) : null}
        </div>
        <div className="flex flex-col gap-3">
          {props.stories.map((story, index) => {
            const image = httpsSrc(story.image);
            return (
              <div
                key={`${story.headline}-${index}`}
                className={cn(
                  "gap-2.5",
                  image ? "flex flex-row items-start" : "flex flex-col",
                )}
              >
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- generative UI URLs are dynamic https sources
                  <img
                    src={image}
                    alt=""
                    className="border-border/50 h-14 w-14 shrink-0 rounded-lg border object-cover"
                  />
                ) : null}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="text-foreground text-[13.5px] font-medium leading-snug">
                    {story.headline}
                  </div>
                  {story.dek ? (
                    <div className="text-muted-foreground text-[12.5px] leading-relaxed">
                      {story.dek}
                    </div>
                  ) : null}
                  {story.source ? (
                    <div className="text-muted-foreground text-[11px]">{story.source}</div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ),
    Video: ({ props }) => {
      const resolved = resolveVideoEmbed({
        src: props.src,
        provider: props.provider,
        poster: props.poster,
      });
      if (!resolved) {
        return (
          <div className="text-muted-foreground text-[13px]">
            Video needs an https URL.
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-2">
          {props.title ? (
            <div className="text-foreground text-[15px] font-medium">{props.title}</div>
          ) : null}
          {resolved.provider === "file" ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption -- generative clips rarely ship captions
            <video
              className="border-border/50 aspect-video w-full rounded-lg border bg-black"
              src={resolved.src}
              poster={resolved.poster ?? undefined}
              controls
              playsInline
            />
          ) : (
            <iframe
              title={props.title ?? "Video"}
              src={resolved.embedUrl}
              className="border-border/50 aspect-video w-full rounded-lg border"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      );
    },
    ...devopsWebCards,
    ...creativeWebCards,
    ...structuredWebCards,
  },
  actions: {
    // Bound at render time via ActionProvider handlers in ChatJsonRender.
    reply: async () => undefined,
  },
});
