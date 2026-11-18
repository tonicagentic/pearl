"use client";

import { defineRegistry } from "@json-render/react";
import { chatCatalog } from "@/lib/json-render/catalog";
import { comparisonBarShares } from "@/lib/json-render/comparison-bar";
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
import { playSpeakable } from "@/lib/json-render/speak";
import { cn } from "@/lib/utils";
import { Button as UiButton } from "@/components/ui/button";
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
    Table: ({ props }) => (
      <div className="border-border/60 overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[16rem] border-collapse text-left text-[13.5px]">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              {props.columns.map((column) => (
                <th key={column} className="px-2.5 py-1.5 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-border/50 border-t">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="text-foreground px-2.5 py-1.5 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
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
  },
  actions: {
    // Bound at render time via ActionProvider handlers in ChatJsonRender.
    reply: async () => undefined,
  },
});
