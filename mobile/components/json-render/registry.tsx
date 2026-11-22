import type { ComponentRegistry } from "@json-render/react-native";
import { useActions } from "@json-render/react-native";
import { VideoPlayer } from "@/components/assistant-ui/elements/media-player";
import { MermaidPreview } from "@/components/assistant-ui/elements/mermaid-preview";
import { creativeMobileCards } from "@/components/json-render/creative-cards";
import { devopsMobileCards } from "@/components/json-render/devops-cards";
import { structuredMobileCards } from "@/components/json-render/structured-cards";
import {
  chartDeltaTone,
  chartSeriesLayout,
  clampVisibleCount,
  inferChartTrend,
} from "../../../lib/json-render/chart";
import { comparisonBarShares } from "../../../lib/json-render/comparison-bar";
import {
  CHORD_LIBRARY,
  findChordByName,
  initialLibraryIndex,
  mergeVoicings,
  type ChordVoicing,
} from "../../../lib/json-render/chord-library";
import {
  clampPin,
  circleOfFifthsPositions,
  guitarChordDots,
  GUITAR_FRET_COUNT,
  GUITAR_STRING_COUNT,
  regionBarWidths,
} from "../../../lib/json-render/diagrams";
import {
  bookingCancelMessage,
  bookingConfirmMessage,
  createEventConfirmMessage,
  createEventDiscardMessage,
  emailBatchConfirmMessage,
  emailDraftSaveMessage,
  emailDraftSendMessage,
} from "../../../lib/json-render/reply-messages";
import {
  fetchAiSpeechUrl,
  playAudioUrl,
  speakText,
} from "../../../lib/json-render/speak";
import {
  formatSnowLevelCount,
  snowTrailLevelMeta,
} from "../../../lib/json-render/snow";
import { resolveVideoEmbed } from "../../../lib/json-render/video-embed";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { AGENT_URL, getAuthCookie } from "@/src/eve-transport";
import { createAudioPlayer, useAudioPlayer } from "expo-audio";
import { Volume2Icon } from "lucide-react-native";
import { Pressable, View, Image as RNImage, ScrollView } from "react-native";
import Svg, {
  Circle,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import {
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

type WebViewComponent = ComponentType<{
  source: { html?: string; uri?: string };
  style?: object;
  originWhitelist?: string[];
  scrollEnabled?: boolean;
}>;

function loadWebView(): WebViewComponent | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-webview").WebView as WebViewComponent;
  } catch {
    return null;
  }
}


function EmbedWebView({ uri }: { readonly uri: string }) {
  const WebView = useMemo(() => loadWebView(), []);
  if (!WebView) {
    return (
      <Text variant="caption" className="opacity-70">
        Open {uri}
      </Text>
    );
  }
  return (
    <WebView
      originWhitelist={["https://*"]}
      source={{ uri }}
      style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" }}
    />
  );
}

function ReplyButtons({
  primary,
  secondary,
}: {
  readonly primary: { readonly label: string; readonly message: string };
  readonly secondary?: { readonly label: string; readonly message: string };
}) {
  const actions = useActions();
  return (
    <View className="flex-row flex-wrap gap-2">
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          void actions.execute({
            action: "reply",
            params: { message: primary.message },
          })
        }
        className="bg-primary self-start rounded-full px-3.5 py-2 active:opacity-80"
      >
        <Text variant="secondary" weight="medium" className="text-primary-foreground">
          {primary.label}
        </Text>
      </Pressable>
      {secondary ? (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            void actions.execute({
              action: "reply",
              params: { message: secondary.message },
            })
          }
          className="border-border self-start rounded-full border bg-transparent px-3.5 py-2 active:opacity-80"
        >
          <Text variant="secondary" weight="medium">
            {secondary.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Light fretboard panel so dots stay readable in dark mode. */
const CHORD_BOARD = {
  fill: "#E8E4DC",
  line: "#3A3A3A",
  dot: "#1A1A1A",
  label: "#1A1A1A",
} as const;

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
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      accessibilityLabel={`${name} guitar chord`}
    >
      <Rect
        x={left - pad}
        y={top - pad}
        width={boardW + pad * 2}
        height={boardH + pad * 2}
        rx={8}
        fill={CHORD_BOARD.fill}
      />
      {windowBase > 1 ? (
        <SvgText
          x={12}
          y={top + fretGap * 0.7}
          fill={CHORD_BOARD.label}
          fontSize="11"
          fontWeight="700"
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
          stroke={CHORD_BOARD.line}
          strokeWidth={fret === 0 && windowBase === 1 ? 3.5 : 1.4}
        />
      ))}
      {Array.from({ length: GUITAR_STRING_COUNT }, (_, stringIndex) => (
        <Line
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
            <SvgText
              key={`m-${dot.stringIndex}`}
              x={x}
              y={top - 12}
              fill={CHORD_BOARD.label}
              fontSize="13"
              fontWeight="700"
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
              stroke={CHORD_BOARD.line}
              strokeWidth={1.75}
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
            fill={CHORD_BOARD.dot}
          />
        );
      })}
    </Svg>
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
    <View className="flex-col gap-2.5">
      <Text variant="body" weight="medium">
        {selected.name}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-1.5"
      >
        {CHORD_LIBRARY.map((chord, index) => {
          const active = index === chordIndex;
          return (
            <Pressable
              key={chord.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => selectChord(index)}
              className={cn(
                "rounded-full border px-2.5 py-1",
                active
                  ? "border-foreground bg-foreground"
                  : "border-border/70 bg-muted/40",
              )}
            >
              <Text
                variant="caption"
                weight="medium"
                className={active ? "text-background" : undefined}
                tone={active ? "default" : "muted"}
              >
                {chord.name.replace(" major", "").replace(" minor", "m")}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {voicings.length > 1 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {voicings.map((voicing, index) => {
            const active = index === voicingIndex;
            return (
              <Pressable
                key={`${voicing.label}-${index}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setVoicingIndex(index)}
                className={cn(
                  "rounded-lg border px-2.5 py-1",
                  active
                    ? "border-foreground/40 bg-muted"
                    : "border-border/50 bg-transparent",
                )}
              >
                <Text variant="caption" weight="medium">
                  {voicing.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <GuitarChordDiagram
        name={selected.name}
        frets={[...activeVoicing.frets]}
        baseFret={activeVoicing.baseFret}
      />
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
    const agentVoicings = Array.isArray(element.props.voicings)
      ? (element.props.voicings as unknown[])
          .filter(
            (item): item is Record<string, unknown> =>
              item != null && typeof item === "object",
          )
          .map((item) => ({
            label: asString(item.label) || "Voicing",
            frets: (Array.isArray(item.frets)
              ? item.frets.map(asNumber)
              : frets) as ChordVoicing["frets"],
            baseFret:
              item.baseFret == null ? null : asNumber(item.baseFret),
          }))
      : null;
    return (
      <GuitarChordBrowser
        name={asString(element.props.name)}
        frets={frets}
        baseFret={baseFret != null && baseFret > 0 ? baseFret : null}
        agentVoicings={agentVoicings}
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
  Chart: ({ element }) => {
    const points = Array.isArray(element.props.points)
      ? element.props.points.map((value: unknown) => asNumber(value))
      : [];
    const visibleCount = clampVisibleCount(
      points.length,
      element.props.visibleCount == null
        ? null
        : asNumber(element.props.visibleCount),
    );
    const layout = chartSeriesLayout(points, visibleCount);
    const delta =
      element.props.delta == null ? null : asString(element.props.delta);
    const trend = inferChartTrend(
      delta,
      element.props.trend === "up" ||
        element.props.trend === "down" ||
        element.props.trend === "flat"
        ? element.props.trend
        : null,
    );
    const tone = chartDeltaTone(
      trend,
      element.props.upIsGood == null ? null : Boolean(element.props.upIsGood),
    );
    const variant =
      element.props.variant === "line" || element.props.variant === "bars"
        ? element.props.variant
        : "area";
    return (
      <View className="flex-col gap-2">
        <View className="flex-row items-baseline justify-between gap-2">
          <Text variant="caption" className="uppercase tracking-wide">
            {asString(element.props.label)}
          </Text>
          {delta ? (
            <Text
              variant="caption"
              className={cn(
                tone === "positive" && "text-emerald-600",
                tone === "negative" && "text-red-600",
              )}
            >
              {delta}
            </Text>
          ) : null}
        </View>
        <Text variant="body" weight="semibold" className="text-2xl">
          {asString(element.props.value)}
        </Text>
        <Svg width="100%" height={72} viewBox="0 0 240 72">
          {variant === "bars"
            ? layout.bars.map((bar, index) => (
                <Rect
                  key={index}
                  x={bar.x}
                  y={bar.y}
                  width={bar.w}
                  height={bar.h}
                  rx={1}
                  fill={bar.last ? "#3B82F6" : "rgba(26,26,26,0.25)"}
                />
              ))
            : null}
          {variant === "area" && layout.areaPath ? (
            <Path d={layout.areaPath} fill="rgba(59,130,246,0.2)" />
          ) : null}
          {(variant === "area" || variant === "line") && layout.linePath ? (
            <Path
              d={layout.linePath}
              fill="none"
              stroke="#3B82F6"
              strokeWidth={2}
            />
          ) : null}
          {(variant === "area" || variant === "line") &&
          layout.visible.length > 0 ? (
            <Circle
              cx={layout.visible[layout.visible.length - 1]!.x}
              cy={layout.visible[layout.visible.length - 1]!.y}
              r={3}
              fill="#3B82F6"
            />
          ) : null}
        </Svg>
      </View>
    );
  },
  SpecSheet: ({ element }) => {
    const rows = asObjectArray(element.props.rows);
    const visibleCount =
      element.props.visibleCount == null
        ? rows.length
        : Math.max(
            0,
            Math.min(rows.length, Math.floor(asNumber(element.props.visibleCount))),
          );
    const visible = rows.slice(0, visibleCount);
    return (
      <View className="flex-col gap-3">
        <View className="flex-col gap-0.5">
          <Text variant="body" weight="medium">
            {asString(element.props.title)}
          </Text>
          {element.props.subtitle ? (
            <Text variant="caption">{asString(element.props.subtitle)}</Text>
          ) : null}
        </View>
        <View className="flex-col">
          {visible.map((row, index) => (
            <View
              key={asString(row.label)}
              className={cn(
                "flex-row items-baseline justify-between gap-3 py-1.5",
                index > 0 && "border-border/60 border-t",
              )}
            >
              <Text variant="caption" className="font-mono">
                {asString(row.label)}
              </Text>
              <Text
                variant="secondary"
                weight={row.emphasis ? "semibold" : "regular"}
                className="text-right"
              >
                {asString(row.value)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  },
  MermaidDiagram: ({ element }) => (
    <View className="flex-col gap-2">
      {element.props.title ? (
        <Text variant="body" weight="medium">
          {asString(element.props.title)}
        </Text>
      ) : null}
      {element.props.streaming ? (
        <Text variant="caption">Rendering diagram…</Text>
      ) : (
        <MermaidPreview code={asString(element.props.code)} />
      )}
    </View>
  ),
  FlightTracker: ({ element }) => {
    const progress = Math.max(0, Math.min(100, asNumber(element.props.progress)));
    return (
      <View className="flex-col gap-3">
        <View className="flex-row justify-between">
          <Text variant="caption">
            {asString(element.props.airline)} ·{" "}
            {asString(element.props.flightNumber)}
          </Text>
          <Text variant="caption">{asString(element.props.status)}</Text>
        </View>
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="body" weight="semibold" className="text-3xl">
            {asString(element.props.origin)}
          </Text>
          <Text variant="caption">✈</Text>
          <Text variant="body" weight="semibold" className="text-3xl">
            {asString(element.props.destination)}
          </Text>
        </View>
        <View className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <View
            className="h-full rounded-full bg-blue-500"
            style={{ width: `${progress}%` }}
          />
        </View>
        <View className="flex-row justify-between">
          <Text variant="caption">{asString(element.props.elapsed)}</Text>
          <Text variant="caption">{asString(element.props.remaining)}</Text>
        </View>
      </View>
    );
  },
  CalendarEvent: ({ element }) => (
    <View className="flex-col gap-1.5">
      <Text variant="caption">{asString(element.props.date)}</Text>
      <Text variant="body" weight="medium" className="text-[17px]">
        {asString(element.props.title)}
      </Text>
      <Text variant="secondary">
        {asString(element.props.time)}
        {element.props.location
          ? ` · ${asString(element.props.location)}`
          : ""}
      </Text>
    </View>
  ),
  CreateEvent: ({ element }) => {
    const events = asObjectArray(element.props.events);
    const title = asString(element.props.title);
    return (
      <View className="flex-col gap-3">
        <View className="flex-row items-center gap-3">
          <Text variant="body" weight="semibold" className="text-3xl">
            {asString(element.props.day)}
          </Text>
          <View className="flex-col">
            <Text variant="secondary" weight="semibold">
              {asString(element.props.month)}
            </Text>
            <Text variant="caption">{asString(element.props.weekday)}</Text>
          </View>
        </View>
        <View className="border-border/60 border-t" />
        {events.length > 0 ? (
          <View className="flex-col gap-2.5">
            {events.map((event, index) => (
              <View
                key={`${asString(event.title)}-${index}`}
                className="flex-row items-center gap-3"
              >
                <View className="bg-foreground/50 h-8 w-0.5 rounded-full" />
                <View className="min-w-0 flex-1 flex-col">
                  <Text variant="secondary" weight="medium">
                    {asString(event.title)}
                  </Text>
                  <Text variant="caption">{asString(event.time)}</Text>
                </View>
                {event.tag ? (
                  <Text
                    variant="caption"
                    className="bg-muted rounded-full px-2 py-0.5"
                  >
                    {asString(event.tag)}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <View className="flex-col gap-0.5">
            <Text variant="secondary" weight="medium">
              {title}
            </Text>
            <Text variant="caption">
              {asString(element.props.start)}
              {element.props.end ? ` – ${asString(element.props.end)}` : ""}
              {element.props.location
                ? ` · ${asString(element.props.location)}`
                : ""}
            </Text>
          </View>
        )}
        <ReplyButtons
          primary={{
            label: "Add to calendar",
            message: createEventConfirmMessage({
              title,
              start: asString(element.props.start),
              end:
                element.props.end == null
                  ? null
                  : asString(element.props.end),
              location:
                element.props.location == null
                  ? null
                  : asString(element.props.location),
              calendarId:
                element.props.calendarId == null
                  ? null
                  : asString(element.props.calendarId),
            }),
          }}
          secondary={{
            label: "Discard",
            message: createEventDiscardMessage(title),
          }}
        />
      </View>
    );
  },
  Booking: ({ element }) => {
    const restaurant =
      element.props.restaurant == null
        ? null
        : asString(element.props.restaurant);
    const seating =
      element.props.seating === "indoor" || element.props.seating === "patio"
        ? element.props.seating
        : null;
    return (
      <View className="flex-col gap-3">
        <Text variant="body" weight="medium">
          {restaurant ? `Reserve · ${restaurant}` : "Reserve a table"}
        </Text>
        <View className="flex-col gap-1">
          {element.props.name ? (
            <Text variant="secondary">
              Name · {asString(element.props.name)}
            </Text>
          ) : null}
          <Text variant="secondary">
            Party · {asNumber(element.props.partySize)}
          </Text>
          <Text variant="secondary">Date · {asString(element.props.date)}</Text>
          {seating ? (
            <Text variant="secondary">Seating · {seating}</Text>
          ) : null}
          {element.props.reminder != null ? (
            <Text variant="secondary">
              Reminder · {element.props.reminder ? "Yes" : "No"}
            </Text>
          ) : null}
        </View>
        <ReplyButtons
          primary={{
            label: "Confirm reservation",
            message: bookingConfirmMessage({
              restaurant,
              name:
                element.props.name == null
                  ? null
                  : asString(element.props.name),
              partySize: asNumber(element.props.partySize),
              date: asString(element.props.date),
              seating,
              reminder:
                element.props.reminder == null
                  ? null
                  : Boolean(element.props.reminder),
            }),
          }}
          secondary={{
            label: "Cancel",
            message: bookingCancelMessage(restaurant),
          }}
        />
      </View>
    );
  },
  EmailDraft: ({ element }) => {
    const draft = {
      to: asString(element.props.to),
      cc: element.props.cc == null ? null : asString(element.props.cc),
      bcc: element.props.bcc == null ? null : asString(element.props.bcc),
      subject: asString(element.props.subject),
      body: asString(element.props.body),
      accountId:
        element.props.accountId == null
          ? null
          : asString(element.props.accountId),
      threadId:
        element.props.threadId == null
          ? null
          : asString(element.props.threadId),
    };
    return (
      <View className="flex-col gap-3">
        <View className="flex-col gap-1">
          <Text variant="caption">To {draft.to}</Text>
          {draft.cc ? <Text variant="caption">Cc {draft.cc}</Text> : null}
          {draft.bcc ? <Text variant="caption">Bcc {draft.bcc}</Text> : null}
          <Text variant="body" weight="medium">
            {draft.subject}
          </Text>
        </View>
        <Text variant="secondary" className="leading-relaxed">
          {draft.body}
        </Text>
        <ReplyButtons
          primary={{
            label: "Send",
            message: emailDraftSendMessage(draft),
          }}
          secondary={{
            label: "Save draft",
            message: emailDraftSaveMessage(draft),
          }}
        />
      </View>
    );
  },
  EmailBatch: ({ element }) => {
    const items = asObjectArray(element.props.items).map((item) => ({
      accountId: asString(item.accountId),
      threadId: asString(item.threadId),
      action:
        item.action === "mark_read"
          ? ("mark_read" as const)
          : ("archive" as const),
      subject: item.subject == null ? null : asString(item.subject),
      from: item.from == null ? null : asString(item.from),
    }));
    return (
      <View className="flex-col gap-3">
        <Text variant="body" weight="medium">
          {items.length} thread{items.length === 1 ? "" : "s"}
        </Text>
        <View className="flex-col gap-2">
          {items.map((item) => (
            <View
              key={`${item.accountId}:${item.threadId}`}
              className="border-border/50 flex-col gap-0.5 rounded-lg border px-2.5 py-2"
            >
              <Text variant="secondary" weight="medium">
                {item.subject ?? item.threadId}
              </Text>
              <Text variant="caption">
                {item.from ? `${item.from} · ` : ""}
                {item.action === "archive" ? "Archive" : "Mark read"}
              </Text>
            </View>
          ))}
        </View>
        <ReplyButtons
          primary={{
            label: "Confirm batch",
            message: emailBatchConfirmMessage(items),
          }}
        />
      </View>
    );
  },
  SurfReport: ({ element }) => {
    const periods = asObjectArray(element.props.periods);
    return (
      <View className="flex-col gap-3">
        <View className="flex-col gap-0.5">
          <Text variant="body" weight="medium">
            {asString(element.props.spot)}
          </Text>
          <Text variant="caption">
            {[element.props.region, element.props.updated, element.props.rating]
              .filter((value) => value != null && asString(value))
              .map(asString)
              .join(" · ")}
          </Text>
        </View>
        {element.props.summary ? (
          <Text variant="secondary" className="leading-relaxed">
            {asString(element.props.summary)}
          </Text>
        ) : null}
        <View className="flex-row flex-wrap gap-2">
          {element.props.wave ? (
            <View className="bg-muted/40 min-w-[30%] flex-1 rounded-lg p-2">
              <Text variant="caption">Wave</Text>
              <Text variant="secondary" weight="medium">
                {asString(element.props.wave)}
              </Text>
            </View>
          ) : null}
          {element.props.wind ? (
            <View className="bg-muted/40 min-w-[30%] flex-1 rounded-lg p-2">
              <Text variant="caption">Wind</Text>
              <Text variant="secondary" weight="medium">
                {asString(element.props.wind)}
              </Text>
            </View>
          ) : null}
          {element.props.tide ? (
            <View className="bg-muted/40 min-w-[30%] flex-1 rounded-lg p-2">
              <Text variant="caption">Tide</Text>
              <Text variant="secondary" weight="medium">
                {asString(element.props.tide)}
              </Text>
            </View>
          ) : null}
        </View>
        {periods.length > 0 ? (
          <View className="flex-col gap-1.5">
            {periods.map((period) => (
              <View
                key={asString(period.label)}
                className="flex-row justify-between gap-2"
              >
                <Text variant="secondary" weight="medium">
                  {asString(period.label)}
                </Text>
                <Text variant="caption">
                  {asString(period.wave)} · {asString(period.wind)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  },
  SurfSpotPick: ({ element }) => {
    const pick = asString(element.props.pick);
    const options = asObjectArray(element.props.options);
    return (
      <View className="flex-col gap-3">
        <View className="flex-col gap-0.5">
          {element.props.timeframe ? (
            <Text variant="caption">{asString(element.props.timeframe)}</Text>
          ) : null}
          <Text variant="body" weight="medium">
            Go to {pick}
          </Text>
          {element.props.reason ? (
            <Text variant="secondary" className="leading-relaxed">
              {asString(element.props.reason)}
            </Text>
          ) : null}
        </View>
        <View className="flex-col gap-2">
          {options.map((option) => {
            const name = asString(option.name);
            const isPick = name === pick;
            return (
              <View
                key={name}
                className={cn(
                  "flex-col gap-0.5 rounded-lg border px-2.5 py-2",
                  isPick ? "border-foreground/30 bg-muted/50" : "border-border/50",
                )}
              >
                <View className="flex-row items-baseline justify-between gap-2">
                  <Text variant="secondary" weight={isPick ? "semibold" : "medium"}>
                    {name}
                    {isPick ? " · pick" : ""}
                  </Text>
                  {option.rating ? (
                    <Text variant="caption">{asString(option.rating)}</Text>
                  ) : null}
                </View>
                <Text variant="caption">
                  {[option.wave, option.wind]
                    .filter((value) => value != null && asString(value))
                    .map(asString)
                    .join(" · ")}
                </Text>
                {option.note ? (
                  <Text variant="caption" className="leading-relaxed">
                    {asString(option.note)}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    );
  },
  SnowReport: ({ element }) => {
    const image = httpsSrc(element.props.image);
    const trailLevels = asObjectArray(element.props.trailLevels);
    return (
      <View className="flex-col gap-3">
        <View className="flex-col gap-0.5">
          <Text variant="body" weight="medium">
            {asString(element.props.resort)}
          </Text>
          <Text variant="caption">
            {[element.props.region, element.props.updated]
              .filter((value) => value != null && asString(value))
              .map(asString)
              .join(" · ")}
          </Text>
        </View>
        {image ? (
          <RNImage
            source={{ uri: image }}
            accessibilityLabel={asString(element.props.resort)}
            className="border-border/50 h-40 w-full rounded-lg border"
            resizeMode="cover"
          />
        ) : null}
        {element.props.summary ? (
          <Text variant="secondary" className="leading-relaxed">
            {asString(element.props.summary)}
          </Text>
        ) : null}
        <View className="flex-row flex-wrap gap-x-4 gap-y-2">
          {element.props.baseDepth ? (
            <View>
              <Text variant="caption">Base</Text>
              <Text variant="secondary" weight="medium">
                {asString(element.props.baseDepth)}
              </Text>
            </View>
          ) : null}
          {element.props.newSnow ? (
            <View>
              <Text variant="caption">New snow</Text>
              <Text variant="secondary" weight="medium">
                {asString(element.props.newSnow)}
              </Text>
            </View>
          ) : null}
          {element.props.conditions ? (
            <View>
              <Text variant="caption">Conditions</Text>
              <Text variant="secondary" weight="medium">
                {asString(element.props.conditions)}
              </Text>
            </View>
          ) : null}
          {element.props.liftsOpen ? (
            <View>
              <Text variant="caption">Lifts</Text>
              <Text variant="secondary" weight="medium">
                {asString(element.props.liftsOpen)}
              </Text>
            </View>
          ) : null}
          {element.props.trailsOpen ? (
            <View>
              <Text variant="caption">Trails</Text>
              <Text variant="secondary" weight="medium">
                {asString(element.props.trailsOpen)}
              </Text>
            </View>
          ) : null}
        </View>
        {trailLevels.length > 0 ? (
          <View className="flex-col gap-1.5">
            <Text variant="caption">Open by level</Text>
            {trailLevels.map((entry) => {
              const level = asString(entry.level);
              const meta = snowTrailLevelMeta(level);
              return (
                <View
                  key={level}
                  className="flex-row items-center justify-between gap-3"
                >
                  <View className="flex-row items-center gap-2">
                    <View className="w-5 flex-row items-center gap-0.5">
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          backgroundColor: meta.color,
                          borderRadius:
                            meta.symbol === "circle"
                              ? 999
                              : meta.symbol === "square"
                                ? 2
                                : 1,
                          transform:
                            meta.symbol === "diamond" ||
                            meta.symbol === "double-diamond"
                              ? [{ rotate: "45deg" }]
                              : undefined,
                        }}
                      />
                      {meta.symbol === "double-diamond" ? (
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            backgroundColor: meta.color,
                            borderRadius: 1,
                            transform: [{ rotate: "45deg" }],
                          }}
                        />
                      ) : null}
                    </View>
                    <Text variant="secondary">{meta.label}</Text>
                  </View>
                  <Text variant="secondary" weight="medium">
                    {formatSnowLevelCount(
                      asNumber(entry.open),
                      entry.total == null ? null : asNumber(entry.total),
                    )}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  },
  MountainPick: ({ element }) => {
    const pick = asString(element.props.pick);
    const options = asObjectArray(element.props.options);
    return (
      <View className="flex-col gap-3">
        <View className="flex-col gap-0.5">
          {element.props.timeframe ? (
            <Text variant="caption">{asString(element.props.timeframe)}</Text>
          ) : null}
          <Text variant="body" weight="medium">
            Go to {pick}
          </Text>
          {element.props.reason ? (
            <Text variant="secondary" className="leading-relaxed">
              {asString(element.props.reason)}
            </Text>
          ) : null}
        </View>
        <View className="flex-col gap-2">
          {options.map((option) => {
            const name = asString(option.name);
            const isPick = name === pick;
            return (
              <View
                key={name}
                className={cn(
                  "flex-col gap-0.5 rounded-lg border px-2.5 py-2",
                  isPick ? "border-foreground/30 bg-muted/50" : "border-border/50",
                )}
              >
                <View className="flex-row items-baseline justify-between gap-2">
                  <Text variant="secondary" weight={isPick ? "semibold" : "medium"}>
                    {name}
                    {isPick ? " · pick" : ""}
                  </Text>
                  {option.newSnow ? (
                    <Text variant="caption">{asString(option.newSnow)}</Text>
                  ) : null}
                </View>
                <Text variant="caption">
                  {[option.baseDepth, option.conditions, option.liftsOpen]
                    .filter((value) => value != null && asString(value))
                    .map(asString)
                    .join(" · ")}
                </Text>
                {option.note ? (
                  <Text variant="caption" className="leading-relaxed">
                    {asString(option.note)}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    );
  },
  DailyBrief: ({ element }) => {
    const stories = asObjectArray(element.props.stories);
    return (
      <View className="flex-col gap-3">
        <View className="flex-col gap-0.5">
          <Text variant="body" weight="medium">
            {element.props.title
              ? asString(element.props.title)
              : "Daily brief"}
          </Text>
          {element.props.date ? (
            <Text variant="caption">{asString(element.props.date)}</Text>
          ) : null}
        </View>
        <View className="flex-col gap-3">
          {stories.map((story, index) => {
            const image = httpsSrc(story.image);
            return (
              <View
                key={`${asString(story.headline)}-${index}`}
                className={cn(
                  "gap-2.5",
                  image ? "flex-row items-start" : "flex-col",
                )}
              >
                {image ? (
                  <RNImage
                    source={{ uri: image }}
                    accessibilityLabel=""
                    className="border-border/50 h-14 w-14 shrink-0 rounded-lg border"
                    resizeMode="cover"
                  />
                ) : null}
                <View className="min-w-0 flex-1 flex-col gap-0.5">
                  <Text variant="secondary" weight="medium">
                    {asString(story.headline)}
                  </Text>
                  {story.dek ? (
                    <Text variant="caption" className="leading-relaxed">
                      {asString(story.dek)}
                    </Text>
                  ) : null}
                  {story.source ? (
                    <Text variant="caption">{asString(story.source)}</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  },
  Video: ({ element }) => {
    const resolved = resolveVideoEmbed({
      src: asString(element.props.src),
      provider:
        element.props.provider === "file" ||
        element.props.provider === "youtube" ||
        element.props.provider === "vimeo"
          ? element.props.provider
          : null,
      poster:
        element.props.poster == null ? null : asString(element.props.poster),
    });
    if (!resolved) {
      return <Text variant="caption">Video needs an https URL.</Text>;
    }
    return (
      <View className="flex-col gap-2">
        {element.props.title ? (
          <Text variant="body" weight="medium">
            {asString(element.props.title)}
          </Text>
        ) : null}
        {resolved.provider === "file" ? (
          <VideoPlayer
            src={resolved.src}
            poster={resolved.poster ?? undefined}
            title={
              element.props.title
                ? asString(element.props.title)
                : undefined
            }
          />
        ) : (
          <EmbedWebView uri={resolved.embedUrl} />
        )}
      </View>
    );
  },
  ...devopsMobileCards,
  ...creativeMobileCards,
  ...structuredMobileCards,
};
