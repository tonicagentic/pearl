import type { ComponentRegistry } from "@json-render/react-native";
import { comparisonBarShares } from "../../../lib/json-render/comparison-bar";
import {
  clampPin,
  circleOfFifthsPositions,
  guitarChordDots,
  GUITAR_FRET_COUNT,
  GUITAR_STRING_COUNT,
  regionBarWidths,
} from "../../../lib/json-render/diagrams";
import {
  fetchAiSpeechUrl,
  playAudioUrl,
  speakText,
} from "../../../lib/json-render/speak";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { AGENT_URL, getAuthCookie } from "@/src/eve-transport";
import { createAudioPlayer, useAudioPlayer } from "expo-audio";
import { Volume2Icon } from "lucide-react-native";
import { Pressable, View, Image as RNImage, ScrollView } from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import { useState, type ReactNode } from "react";

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

const gapClass = {
  sm: "gap-2",
  md: "gap-3",
  lg: "gap-4",
} as const;

const badgeToneClass = {
  neutral: "bg-muted",
  positive: "bg-emerald-500/15",
  negative: "bg-red-500/15",
  warning: "bg-amber-500/15",
} as const;

const badgeToneText = {
  neutral: undefined,
  positive: "text-emerald-700 dark:text-emerald-300",
  negative: "text-red-700 dark:text-red-300",
  warning: "text-amber-800 dark:text-amber-200",
} as const;

type Gap = keyof typeof gapClass;
type BadgeTone = keyof typeof badgeToneClass;

function httpsSrc(src: unknown): string | null {
  if (typeof src !== "string") return null;
  try {
    const url = new URL(src);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function asString(value: unknown): string {
  return value == null ? "" : String(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(asString) : [];
}

function asObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      item != null && typeof item === "object" && !Array.isArray(item),
  );
}

function GuitarChordSvg({
  name,
  frets,
  baseFret,
}: {
  name: string;
  frets: number[];
  baseFret: number | null;
}) {
  const { dots, baseFret: windowBase } = guitarChordDots(frets, baseFret);
  const width = 140;
  const height = 168;
  const left = 28;
  const top = 36;
  const boardW = 84;
  const boardH = 100;
  const stringGap = boardW / (GUITAR_STRING_COUNT - 1);
  const fretGap = boardH / GUITAR_FRET_COUNT;

  return (
    <View className="self-start flex-col gap-1">
      <Text variant="body" weight="medium">
        {name}
      </Text>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        accessibilityLabel={`${name} guitar chord`}
      >
        {windowBase > 1 ? (
          <SvgText
            x={10}
            y={top + fretGap * 0.7}
            fill="currentColor"
            fontSize="11"
            fontWeight="600"
          >
            {windowBase}
          </SvgText>
        ) : null}
        {Array.from({ length: GUITAR_FRET_COUNT + 1 }, (_, fret) => (
          <Line
            key={`fret-${fret}`}
            x1={left}
            y1={top + fret * fretGap}
            x2={left + boardW}
            y2={top + fret * fretGap}
            stroke="currentColor"
            strokeWidth={fret === 0 && windowBase === 1 ? 3 : 1.25}
            opacity={0.85}
          />
        ))}
        {Array.from({ length: GUITAR_STRING_COUNT }, (_, stringIndex) => (
          <Line
            key={`string-${stringIndex}`}
            x1={left + stringIndex * stringGap}
            y1={top}
            x2={left + stringIndex * stringGap}
            y2={top + boardH}
            stroke="currentColor"
            strokeWidth={1}
            opacity={0.7}
          />
        ))}
        {dots.map((dot) => {
          const x = left + dot.stringIndex * stringGap;
          if (dot.muted) {
            return (
              <SvgText
                key={`m-${dot.stringIndex}`}
                x={x}
                y={top - 12}
                fill="currentColor"
                fontSize="12"
                textAnchor="middle"
              >
                ×
              </SvgText>
            );
          }
          if (dot.open) {
            return (
              <Circle
                key={`o-${dot.stringIndex}`}
                cx={x}
                cy={top - 14}
                r={5}
                stroke="currentColor"
                strokeWidth={1.5}
                fill="none"
              />
            );
          }
          if (dot.fret < 1 || dot.fret > GUITAR_FRET_COUNT) return null;
          return (
            <Circle
              key={`d-${dot.stringIndex}`}
              cx={x}
              cy={top + (dot.fret - 0.5) * fretGap}
              r={7}
              fill="currentColor"
            />
          );
        })}
      </Svg>
    </View>
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
  const url = httpsSrc(audioUrl);
  const player = useAudioPlayer(url);
  const [busy, setBusy] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Play pronunciation of ${label}`}
      disabled={busy || !text.trim()}
      onPress={() => {
        void (async () => {
          setBusy(true);
          try {
            if (url) {
              try {
                await player.seekTo(0);
              } catch {
                /* fresh players may not need seek */
              }
              player.play();
              return;
            }

            const cookie = getAuthCookie();
            const speechUrl = await fetchAiSpeechUrl({
              text,
              lang,
              endpoint: `${AGENT_URL}/api/speech`,
              headers: cookie
                ? { Authorization: `Bearer ${cookie}` }
                : undefined,
            }).catch(() => null);

            if (speechUrl) {
              try {
                if (await playAudioUrl(speechUrl)) return;
              } catch {
                /* try expo-audio below */
              }
              try {
                const clip = createAudioPlayer(speechUrl);
                clip.play();
                return;
              } catch {
                /* fall through to browser TTS */
              }
            }

            speakText(text, lang);
          } finally {
            setBusy(false);
          }
        })();
      }}
      className="border-border/60 bg-muted/40 self-start flex-row items-center gap-1.5 rounded-full border px-2.5 py-1 active:opacity-80"
    >
      <Icon as={Volume2Icon} className="size-3.5 text-foreground" />
      <Text variant="caption" weight="medium">
        {busy ? "Playing…" : "Play"}
      </Text>
    </Pressable>
  );
}

function CircleOfFifthsSvg({ highlightKey }: { highlightKey: string | null }) {
  const size = 160;
  const positions = circleOfFifthsPositions(highlightKey, 80, 80, 58);
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      accessibilityLabel={
        highlightKey
          ? `Circle of fifths highlighting ${highlightKey}`
          : "Circle of fifths"
      }
    >
      <Circle
        cx={80}
        cy={80}
        r={58}
        stroke="currentColor"
        strokeWidth={1.25}
        fill="none"
        opacity={0.35}
      />
      {positions.map((pos) => (
        <SvgText
          key={pos.key}
          x={pos.x}
          y={pos.y + 4}
          fill="currentColor"
          fontSize={pos.highlighted ? "13" : "11"}
          fontWeight={pos.highlighted ? "700" : "500"}
          textAnchor="middle"
          opacity={pos.highlighted ? 1 : 0.7}
        >
          {pos.key}
        </SvgText>
      ))}
      {highlightKey ? (
        <Circle
          cx={80}
          cy={80}
          r={18}
          fill="currentColor"
          opacity={0.08}
        />
      ) : null}
    </Svg>
  );
}

/**
 * Mobile registry for the shared Pearl chat catalog.
 * Mirrors web `components/json-render/registry.tsx` with React Native views.
 * RN renderers read props from `element.props`.
 */
export const chatRegistry: ComponentRegistry = {
  Stack: ({ element, children }) => {
    const direction =
      element.props.direction === "horizontal" ? "horizontal" : "vertical";
    const gap = (element.props.gap as Gap | null | undefined) ?? "md";
    return (
      <View
        className={cn(
          direction === "horizontal"
            ? "flex-row flex-wrap items-center"
            : "flex-col",
          gapClass[gap] ?? gapClass.md,
        )}
      >
        {children as ReactNode}
      </View>
    );
  },
  Card: ({ element, children }) => (
    <View className="border-border/60 bg-muted/20 flex-col gap-3 rounded-xl border px-3.5 py-3">
      {(element.props.title || element.props.description) && (
        <View className="flex-col gap-0.5">
          {element.props.title ? (
            <Text variant="body" weight="medium" className="leading-snug">
              {asString(element.props.title)}
            </Text>
          ) : null}
          {element.props.description ? (
            <Text variant="secondary" className="leading-relaxed">
              {asString(element.props.description)}
            </Text>
          ) : null}
        </View>
      )}
      {children as ReactNode}
    </View>
  ),
  Divider: () => <View className="bg-border/60 my-1 h-px w-full" />,
  Heading: ({ element }) => (
    <Text
      variant={
        element.props.level === "1"
          ? "label"
          : element.props.level === "3"
            ? "secondary"
            : "body"
      }
      weight="medium"
      tone="default"
    >
      {asString(element.props.text)}
    </Text>
  ),
  Text: ({ element }) => (
    <Text
      variant="body"
      tone={element.props.muted ? "muted" : "default"}
    >
      {asString(element.props.text)}
    </Text>
  ),
  Metric: ({ element }) => (
    <View className="min-w-[7rem] flex-col gap-0.5">
      <Text variant="caption">{asString(element.props.label)}</Text>
      <Text variant="title" className="tracking-tight">
        {asString(element.props.value)}
      </Text>
      {element.props.hint ? (
        <Text variant="caption">{asString(element.props.hint)}</Text>
      ) : null}
    </View>
  ),
  Badge: ({ element }) => {
    const tone =
      (element.props.tone as BadgeTone | null | undefined) ?? "neutral";
    return (
      <View
        className={cn(
          "self-start rounded-full px-2 py-0.5",
          badgeToneClass[tone] ?? badgeToneClass.neutral,
        )}
      >
        <Text
          variant="caption"
          weight="medium"
          tone={tone === "neutral" ? "muted" : "default"}
          className={badgeToneText[tone] ?? badgeToneText.neutral}
        >
          {asString(element.props.label)}
        </Text>
      </View>
    );
  },
  ComparisonBar: ({ element }) => {
    const leftLabel = asString(element.props.leftLabel);
    const rightLabel = asString(element.props.rightLabel);
    const leftValue = asNumber(element.props.leftValue);
    const rightValue = asNumber(element.props.rightValue);
    const shares = comparisonBarShares(leftValue, rightValue);
    return (
      <View className="w-full flex-col gap-1.5">
        <View className="flex-row items-baseline justify-between gap-3">
          <Text variant="secondary" weight="medium">
            {leftLabel} {leftValue}%
          </Text>
          <Text variant="secondary" weight="medium" className="text-right">
            {rightLabel} {rightValue}%
          </Text>
        </View>
        <View
          accessibilityRole="image"
          accessibilityLabel={`${leftLabel} ${leftValue}%, ${rightLabel} ${rightValue}%`}
          className="bg-muted h-2.5 w-full flex-row overflow-hidden rounded-full"
        >
          <View
            className="bg-foreground/80 h-full"
            style={{ width: `${shares.left}%` }}
          />
          <View
            className="bg-foreground/25 h-full"
            style={{ width: `${shares.right}%` }}
          />
        </View>
        {element.props.caption ? (
          <Text variant="caption">{asString(element.props.caption)}</Text>
        ) : null}
      </View>
    );
  },
  Table: ({ element }) => {
    const columns = asStringArray(element.props.columns);
    const rows = Array.isArray(element.props.rows)
      ? (element.props.rows as unknown[]).map((row) => asStringArray(row))
      : [];
    return (
      <ScrollView
        horizontal
        className="border-border/60 rounded-lg border"
        contentContainerClassName="min-w-full"
      >
        <View className="flex-col">
          <View className="bg-muted/40 flex-row">
            {columns.map((column) => (
              <Text
                key={column}
                variant="secondary"
                weight="medium"
                className="min-w-[5.5rem] flex-1 px-2.5 py-1.5"
              >
                {column}
              </Text>
            ))}
          </View>
          {rows.map((row, rowIndex) => (
            <View
              key={rowIndex}
              className="border-border/50 flex-row border-t"
            >
              {row.map((cell, cellIndex) => (
                <Text
                  key={cellIndex}
                  variant="secondary"
                  tone="default"
                  className="min-w-[5.5rem] flex-1 px-2.5 py-1.5"
                >
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    );
  },
  Image: ({ element }) => {
    const src = httpsSrc(element.props.src);
    if (!src) return null;
    return (
      <RNImage
        source={{ uri: src }}
        accessibilityLabel={
          typeof element.props.alt === "string" ? element.props.alt : undefined
        }
        className="border-border/50 h-48 w-full rounded-lg border"
        resizeMode="cover"
      />
    );
  },
  Button: ({ element, emit }) => (
    <Pressable
      accessibilityRole="button"
      onPress={() => emit("press")}
      className={cn(
        "self-start rounded-full px-3.5 py-2 active:opacity-80",
        element.props.variant === "outline" &&
          "border-border border bg-transparent",
        element.props.variant === "secondary" && "bg-secondary",
        (element.props.variant == null || element.props.variant === "default") &&
          "bg-primary",
      )}
    >
      <Text
        variant="secondary"
        weight="medium"
        tone="default"
        className={cn(
          element.props.variant === "secondary" && "text-secondary-foreground",
          (element.props.variant == null ||
            element.props.variant === "default") &&
            "text-primary-foreground",
        )}
      >
        {asString(element.props.label)}
      </Text>
    </Pressable>
  ),
  SearchResults: ({ element }) => {
    const items = asObjectArray(element.props.items);
    return (
      <View className="flex-col gap-2.5">
        {items.map((item, index) => {
          const image = httpsSrc(item.image);
          return (
            <View
              key={index}
              className={cn(
                "gap-2.5",
                image ? "flex-row items-start" : "flex-col",
              )}
            >
              {image ? (
                <RNImage
                  source={{ uri: image }}
                  accessibilityLabel={asString(item.title)}
                  className="border-border/50 h-16 w-16 shrink-0 rounded-lg border"
                  resizeMode="cover"
                />
              ) : null}
              <View className="min-w-0 flex-1 flex-col gap-0.5">
                <Text variant="body" weight="medium" className="leading-snug">
                  {asString(item.title)}
                </Text>
                {item.detail ? (
                  <Text variant="secondary" className="leading-relaxed">
                    {asString(item.detail)}
                  </Text>
                ) : null}
                {item.meta ? (
                  <Text variant="caption">{asString(item.meta)}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    );
  },
  PlaceMap: ({ element }) => {
    const pins = asObjectArray(element.props.pins);
    const title = element.props.title ? asString(element.props.title) : null;
    const address = element.props.address
      ? asString(element.props.address)
      : null;
    return (
      <View className="flex-col gap-2">
        {title ? (
          <Text variant="body" weight="medium">
            {title}
          </Text>
        ) : null}
        {address ? (
          <Text variant="secondary">{address}</Text>
        ) : null}
        <View className="border-border/60 bg-muted/30 relative h-40 w-full overflow-hidden rounded-lg border">
          <View className="bg-border/40 absolute top-1/3 right-0 left-0 h-px" />
          <View className="bg-border/40 absolute top-0 bottom-0 left-1/2 w-px" />
          {pins.map((pin, index) => {
            const x = clampPin(asNumber(pin.x));
            const y = clampPin(asNumber(pin.y));
            return (
              <View
                key={index}
                className="absolute items-center"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: [{ translateX: -8 }, { translateY: -16 }],
                }}
              >
                <View className="bg-foreground h-3.5 w-3.5 rounded-full border-2 border-background" />
                <Text
                  variant="caption"
                  weight="medium"
                  className="bg-background/90 mt-0.5 max-w-[5.5rem] rounded px-1"
                  numberOfLines={1}
                >
                  {asString(pin.label)}
                </Text>
              </View>
            );
          })}
        </View>
        {pins.some((pin) => pin.detail) ? (
          <View className="flex-col gap-1">
            {pins.map((pin, index) =>
              pin.detail ? (
                <Text key={index} variant="caption">
                  {asString(pin.label)} — {asString(pin.detail)}
                </Text>
              ) : null,
            )}
          </View>
        ) : null}
      </View>
    );
  },
  NewsBrief: ({ element }) => {
    const bullets = asStringArray(element.props.bullets);
    const sources = asStringArray(element.props.sources);
    return (
      <View className="flex-col gap-2">
        {element.props.kicker ? (
          <Text variant="caption" weight="medium" className="uppercase tracking-wide">
            {asString(element.props.kicker)}
          </Text>
        ) : null}
        <Text variant="label" weight="medium" className="leading-snug">
          {asString(element.props.headline)}
        </Text>
        {element.props.dek ? (
          <Text variant="secondary" className="leading-relaxed">
            {asString(element.props.dek)}
          </Text>
        ) : null}
        {bullets.length > 0 ? (
          <View className="flex-col gap-1">
            {bullets.map((bullet, index) => (
              <Text key={index} variant="secondary">
                • {bullet}
              </Text>
            ))}
          </View>
        ) : null}
        {sources.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5">
            {sources.map((source) => (
              <View
                key={source}
                className="bg-muted self-start rounded-full px-2 py-0.5"
              >
                <Text variant="caption" weight="medium" tone="muted">
                  {source}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  },
  Encyclopedia: ({ element }) => {
    const infobox = asObjectArray(element.props.infobox);
    const sections = asObjectArray(element.props.sections);
    const image = httpsSrc(element.props.image);
    return (
      <View className="flex-col gap-3">
        <View className="flex-col gap-1">
          <Text variant="label" weight="medium">
            {asString(element.props.title)}
          </Text>
          <Text variant="secondary" className="leading-relaxed">
            {asString(element.props.lead)}
          </Text>
        </View>
        {image ? (
          <RNImage
            source={{ uri: image }}
            accessibilityLabel={asString(element.props.title)}
            className="border-border/50 h-40 w-full rounded-lg border"
            resizeMode="cover"
          />
        ) : null}
        {infobox.length > 0 ? (
          <View className="border-border/60 bg-muted/30 flex-col gap-1.5 rounded-lg border px-2.5 py-2">
            {infobox.map((pair, index) => (
              <View key={index} className="flex-row justify-between gap-3">
                <Text variant="caption" weight="medium">
                  {asString(pair.label)}
                </Text>
                <Text variant="caption" className="flex-1 text-right">
                  {asString(pair.value)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {sections.map((section, index) => (
          <View key={index} className="flex-col gap-0.5">
            <Text variant="body" weight="medium">
              {asString(section.heading)}
            </Text>
            <Text variant="secondary" className="leading-relaxed">
              {asString(section.body)}
            </Text>
          </View>
        ))}
      </View>
    );
  },
  Pronounce: ({ element }) => {
    const word = asString(element.props.word);
    const spoken =
      typeof element.props.spoken === "string" && element.props.spoken.trim()
        ? asString(element.props.spoken)
        : word;
    const lang =
      typeof element.props.lang === "string" ? element.props.lang : null;
    const audio =
      typeof element.props.audio === "string" ? element.props.audio : null;
    return (
      <View className="flex-col gap-2">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 flex-col gap-1">
            <Text variant="label" weight="medium">
              {word}
            </Text>
            {element.props.ipa ? (
              <Text variant="body" className="tracking-wide">
                /{asString(element.props.ipa)}/
              </Text>
            ) : null}
            {element.props.syllables ? (
              <Text variant="secondary" weight="medium">
                {asString(element.props.syllables)}
              </Text>
            ) : null}
            {element.props.note ? (
              <Text variant="caption">{asString(element.props.note)}</Text>
            ) : null}
          </View>
          <SpeakButton text={spoken} lang={lang} audioUrl={audio} label={word} />
        </View>
      </View>
    );
  },
  Phrase: ({ element }) => {
    const translation = asString(element.props.translation);
    const spoken =
      typeof element.props.spoken === "string" && element.props.spoken.trim()
        ? asString(element.props.spoken)
        : translation;
    const lang =
      typeof element.props.lang === "string" ? element.props.lang : null;
    const audio =
      typeof element.props.audio === "string" ? element.props.audio : null;
    return (
      <View className="flex-col gap-2">
        <Text variant="caption" weight="medium" tone="muted">
          {asString(element.props.sourceLanguage)} →{" "}
          {asString(element.props.targetLanguage)}
        </Text>
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 flex-col gap-1.5">
            <Text variant="label" weight="medium">
              {asString(element.props.phrase)}
            </Text>
            <Text variant="body">{translation}</Text>
            {element.props.literal ? (
              <Text variant="caption">
                Literal: {asString(element.props.literal)}
              </Text>
            ) : null}
          </View>
          <SpeakButton
            text={spoken}
            lang={lang}
            audioUrl={audio}
            label={translation}
          />
        </View>
      </View>
    );
  },
  GuitarChord: ({ element }) => {
    const frets = Array.isArray(element.props.frets)
      ? (element.props.frets as unknown[]).map(asNumber)
      : [];
    const baseFret =
      element.props.baseFret == null
        ? null
        : asNumber(element.props.baseFret);
    return (
      <GuitarChordSvg
        name={asString(element.props.name)}
        frets={frets}
        baseFret={baseFret != null && baseFret > 0 ? baseFret : null}
      />
    );
  },
  TheoryBoard: ({ element }) => {
    const progression = asStringArray(element.props.progression);
    const showCircle = element.props.showCircle !== false;
    const highlightKey =
      typeof element.props.highlightKey === "string"
        ? element.props.highlightKey
        : null;
    return (
      <View className="flex-col gap-3">
        {element.props.title ? (
          <Text variant="body" weight="medium">
            {asString(element.props.title)}
          </Text>
        ) : null}
        {progression.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5">
            {progression.map((roman, index) => (
              <View
                key={`${roman}-${index}`}
                className="bg-muted rounded-lg px-2.5 py-1"
              >
                <Text variant="body" weight="medium">
                  {roman}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {showCircle ? <CircleOfFifthsSvg highlightKey={highlightKey} /> : null}
      </View>
    );
  },
  RegionChart: ({ element }) => {
    const regions = asObjectArray(element.props.regions);
    const widths = regionBarWidths(regions.map((r) => asNumber(r.value)));
    const unit = element.props.unit ? asString(element.props.unit) : "%";
    return (
      <View className="flex-col gap-2">
        {element.props.title ? (
          <Text variant="body" weight="medium">
            {asString(element.props.title)}
          </Text>
        ) : null}
        {regions.map((region, index) => (
          <View key={index} className="flex-col gap-1">
            <View className="flex-row items-baseline justify-between gap-2">
              <Text variant="secondary" weight="medium">
                {asString(region.label)}
              </Text>
              <Text variant="caption">
                {asNumber(region.value)}
                {unit}
                {region.hint ? ` · ${asString(region.hint)}` : ""}
              </Text>
            </View>
            <View className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <View
                className="bg-foreground/70 h-full rounded-full"
                style={{ width: `${widths[index] ?? 0}%` }}
              />
            </View>
          </View>
        ))}
      </View>
    );
  },
  Explainer: ({ element }) => {
    const steps = asObjectArray(element.props.steps);
    return (
      <View className="flex-col gap-2.5">
        <Text variant="body" weight="medium">
          {asString(element.props.title)}
        </Text>
        {steps.map((step, index) => (
          <View key={index} className="flex-row gap-2.5">
            <View className="bg-muted h-6 w-6 items-center justify-center rounded-full">
              <Text variant="caption" weight="medium">
                {index + 1}
              </Text>
            </View>
            <View className="flex-1 flex-col gap-0.5">
              <Text variant="secondary" weight="medium">
                {asString(step.heading)}
              </Text>
              <Text variant="secondary" className="leading-relaxed">
                {asString(step.body)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  },
  Recipe: ({ element }) => {
    const ingredients = asStringArray(element.props.ingredients);
    const method = asStringArray(element.props.method);
    return (
      <View className="flex-col gap-3">
        <View className="flex-col gap-0.5">
          <Text variant="body" weight="medium">
            {asString(element.props.title)}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {element.props.time ? (
              <Text variant="caption">{asString(element.props.time)}</Text>
            ) : null}
            {element.props.yield ? (
              <Text variant="caption">{asString(element.props.yield)}</Text>
            ) : null}
          </View>
        </View>
        <View className="flex-col gap-1">
          <Text variant="secondary" weight="medium">
            Ingredients
          </Text>
          {ingredients.map((item, index) => (
            <Text key={index} variant="secondary">
              • {item}
            </Text>
          ))}
        </View>
        <View className="flex-col gap-1.5">
          <Text variant="secondary" weight="medium">
            Method
          </Text>
          {method.map((step, index) => (
            <Text key={index} variant="secondary" className="leading-relaxed">
              {index + 1}. {step}
            </Text>
          ))}
        </View>
      </View>
    );
  },
};
