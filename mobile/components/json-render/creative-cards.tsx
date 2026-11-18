import {
  chartSeriesLayout,
  clampVisibleCount,
} from "../../../lib/json-render/chart";
import {
  boardCells,
  fileLabel,
  formatDurationMs,
  pieceGlyph,
  rankLabel,
  stripAnsi,
} from "../../../lib/json-render/chess";
import { regionBarWidths } from "../../../lib/json-render/diagrams";
import { httpsImageSrc, isHttpsPdfUrl } from "../../../lib/json-render/pdf-url";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useAudioPlayer } from "expo-audio";
import { PauseIcon, PlayIcon } from "lucide-react-native";
import { useMemo, useState, type ComponentType } from "react";
import {
  Image as RNImage,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

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

function asString(value: unknown): string {
  return value == null ? "" : String(value);
}

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
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

function asBool(value: unknown): boolean | null {
  if (value == null) return null;
  return Boolean(value);
}

function SettingsGroups({
  groups,
}: {
  readonly groups: readonly {
    readonly name: string;
    readonly rows: readonly { readonly label: string; readonly value: string }[];
  }[];
}) {
  return (
    <View className="flex-col gap-3">
      {groups.map((group) => (
        <View key={group.name} className="flex-col gap-1">
          <Text variant="caption" className="uppercase tracking-wide">
            {group.name}
          </Text>
          <View className="flex-col">
            {group.rows.map((row, index) => (
              <View
                key={`${group.name}-${row.label}`}
                className={cn(
                  "flex-row items-baseline justify-between gap-3 py-1.5",
                  index > 0 && "border-border/60 border-t",
                )}
              >
                <Text variant="caption">{row.label}</Text>
                <Text variant="secondary" className="text-right">
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function parseGroups(value: unknown) {
  return asObjectArray(value).map((group) => ({
    name: asString(group.name),
    rows: asObjectArray(group.rows).map((row) => ({
      label: asString(row.label),
      value: asString(row.value),
    })),
  }));
}

function aspectRatio(aspect: string | null): number {
  if (aspect === "9:16") return 9 / 16;
  if (aspect === "1:1") return 1;
  return 16 / 9;
}

function OpenPdfLink({
  uri,
  label,
}: {
  readonly uri: string;
  readonly label: string;
}) {
  return (
    <Pressable onPress={() => void Linking.openURL(uri)} className="py-1">
      <Text variant="caption" className="underline">
        {label}
      </Text>
    </Pressable>
  );
}

function PdfEmbed({ uri, title }: { readonly uri: string; readonly title: string }) {
  // react-native-webview is native-only; Expo web falls back to open-external.
  const WebView = useMemo(
    () => (Platform.OS === "web" ? null : loadWebView()),
    [],
  );
  if (!WebView) {
    return <OpenPdfLink uri={uri} label={`Open ${title}`} />;
  }
  return (
    <View className="flex-col gap-2">
      <WebView
        originWhitelist={["https://*"]}
        source={{ uri }}
        style={{ width: "100%", height: 240, backgroundColor: "transparent" }}
        scrollEnabled
      />
      <OpenPdfLink uri={uri} label={`Open ${title}`} />
    </View>
  );
}

/** Mobile json-render components for creative / data / artifact answer cards. */
export const creativeMobileCards = {
  PhotoEditSettings: ({
    element,
  }: {
    element: { props: Record<string, unknown> };
  }) => {
    const title =
      element.props.title == null ? null : asString(element.props.title);
    const image = httpsImageSrc(
      element.props.image == null ? null : asString(element.props.image),
    );
    const groups = parseGroups(element.props.groups);
    return (
      <View className="flex-col gap-3">
        {title ? (
          <Text variant="body" weight="medium">
            {title}
          </Text>
        ) : null}
        {image ? (
          <RNImage
            source={{ uri: image }}
            accessibilityLabel={title ?? "Photo preview"}
            className="border-border/50 h-40 w-full rounded-lg border"
            resizeMode="cover"
          />
        ) : null}
        <SettingsGroups groups={groups} />
      </View>
    );
  },

  MusicProdSettings: ({
    element,
  }: {
    element: { props: Record<string, unknown> };
  }) => {
    const title =
      element.props.title == null ? null : asString(element.props.title);
    const project =
      element.props.project == null ? null : asString(element.props.project);
    const bpm = element.props.bpm == null ? null : asString(element.props.bpm);
    const key = element.props.key == null ? null : asString(element.props.key);
    const meta = [project, bpm ? `${bpm} BPM` : null, key]
      .filter(Boolean)
      .join(" · ");
    const tracks = asObjectArray(element.props.tracks);
    const groups = parseGroups(element.props.groups);
    return (
      <View className="flex-col gap-3">
        <View className="flex-col gap-0.5">
          {title ? (
            <Text variant="body" weight="medium">
              {title}
            </Text>
          ) : null}
          {meta ? <Text variant="caption">{meta}</Text> : null}
        </View>
        {tracks.length > 0 ? (
          <View className="flex-col gap-1.5">
            <Text variant="caption" className="uppercase tracking-wide">
              Tracks
            </Text>
            {tracks.map((track, index) => {
              const muted = asBool(track.muted) === true;
              return (
                <View
                  key={index}
                  className={cn(
                    "flex-row items-baseline justify-between gap-2 rounded-lg border px-2.5 py-2",
                    muted ? "border-border/40 opacity-60" : "border-border/50",
                  )}
                >
                  <View className="min-w-0 flex-1 flex-col gap-0.5">
                    <Text variant="secondary" weight="medium">
                      {asString(track.name)}
                      {muted ? " · muted" : ""}
                    </Text>
                    {track.role ? (
                      <Text variant="caption">{asString(track.role)}</Text>
                    ) : null}
                  </View>
                  {track.level ? (
                    <Text variant="caption">{asString(track.level)}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}
        {groups.length > 0 ? <SettingsGroups groups={groups} /> : null}
      </View>
    );
  },

  VideoStoryboard: ({
    element,
  }: {
    element: { props: Record<string, unknown> };
  }) => {
    const title =
      element.props.title == null ? null : asString(element.props.title);
    const aspect =
      element.props.aspect === "9:16" ||
      element.props.aspect === "1:1" ||
      element.props.aspect === "16:9"
        ? element.props.aspect
        : null;
    const ratio = aspectRatio(aspect);
    const frames = asObjectArray(element.props.frames);
    return (
      <View className="flex-col gap-2">
        {title ? (
          <Text variant="body" weight="medium">
            {title}
          </Text>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2 pr-1">
            {frames.map((frame, index) => {
              const image = httpsImageSrc(
                frame.image == null ? null : asString(frame.image),
              );
              const caption = [
                frame.beat == null ? null : asString(frame.beat),
                frame.duration == null ? null : asString(frame.duration),
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <View key={index} className="w-36 flex-col gap-1">
                  <View
                    className="border-border/50 bg-muted/40 w-full overflow-hidden rounded-lg border"
                    style={{ aspectRatio: ratio }}
                  >
                    {image ? (
                      <RNImage
                        source={{ uri: image }}
                        accessibilityLabel={
                          frame.label
                            ? asString(frame.label)
                            : `Frame ${index + 1}`
                        }
                        className="h-full w-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="h-full w-full items-center justify-center">
                        <Text variant="caption">Frame {index + 1}</Text>
                      </View>
                    )}
                  </View>
                  {frame.label ? (
                    <Text variant="caption" weight="medium" numberOfLines={1}>
                      {asString(frame.label)}
                    </Text>
                  ) : null}
                  {caption ? <Text variant="caption">{caption}</Text> : null}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  },

  IndicatorCard: ({
    element,
  }: {
    element: { props: Record<string, unknown> };
  }) => {
    const title = asString(element.props.title);
    const source =
      element.props.source == null ? null : asString(element.props.source);
    const unit =
      element.props.unit == null ? "" : asString(element.props.unit);
    const value =
      element.props.value == null ? null : asString(element.props.value);
    const delta =
      element.props.delta == null ? null : asString(element.props.delta);
    const asOf =
      element.props.asOf == null ? null : asString(element.props.asOf);
    const points = Array.isArray(element.props.points)
      ? element.props.points.map((item: unknown) => asNumber(item))
      : [];
    const regions = asObjectArray(element.props.regions);
    const rows = asObjectArray(element.props.rows);
    const layout =
      points.length > 0
        ? chartSeriesLayout(points, clampVisibleCount(points.length, null))
        : null;
    const widths =
      regions.length > 0
        ? regionBarWidths(regions.map((region) => asNumber(region.value)))
        : [];
    const meta = [source, asOf].filter(Boolean).join(" · ");
    return (
      <View className="flex-col gap-3">
        <View className="flex-col gap-0.5">
          <Text variant="body" weight="medium">
            {title}
          </Text>
          {meta ? <Text variant="caption">{meta}</Text> : null}
        </View>
        {value || delta ? (
          <View className="flex-row items-baseline justify-between gap-2">
            {value ? (
              <Text variant="body" weight="semibold" className="text-2xl">
                {value}
                {unit ? (
                  <Text variant="caption"> {unit}</Text>
                ) : null}
              </Text>
            ) : (
              <View />
            )}
            {delta ? <Text variant="caption">{delta}</Text> : null}
          </View>
        ) : null}
        {layout && layout.linePath ? (
          <Svg width="100%" height={72} viewBox="0 0 240 72">
            {layout.areaPath ? (
              <Path d={layout.areaPath} fill="rgba(59,130,246,0.2)" />
            ) : null}
            <Path
              d={layout.linePath}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={2}
            />
            {layout.visible.length > 0 ? (
              <Circle
                cx={layout.visible[layout.visible.length - 1]!.x}
                cy={layout.visible[layout.visible.length - 1]!.y}
                r={3}
                fill="#3b82f6"
              />
            ) : null}
          </Svg>
        ) : null}
        {regions.length > 0 ? (
          <View className="flex-col gap-2">
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
        ) : null}
        {rows.length > 0 ? (
          <View className="flex-col">
            {rows.map((row, index) => (
              <View
                key={index}
                className={cn(
                  "flex-row items-baseline justify-between gap-3 py-1.5",
                  index > 0 && "border-border/60 border-t",
                )}
              >
                <Text variant="caption">{asString(row.label)}</Text>
                <Text variant="secondary">{asString(row.value)}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {points.length === 0 && regions.length === 0 && rows.length === 0 ? (
          <Text variant="caption">No series or breakdown yet.</Text>
        ) : null}
      </View>
    );
  },

  Slides: ({ element }: { element: { props: Record<string, unknown> } }) => {
    const title =
      element.props.title == null ? null : asString(element.props.title);
    const theme =
      element.props.theme == null ? null : asString(element.props.theme);
    const slides = asObjectArray(element.props.slides);
    const count = slides.length;
    const rawIndex =
      element.props.index == null ? 0 : Math.floor(asNumber(element.props.index));
    const currentIndex =
      count === 0 ? 0 : Math.max(0, Math.min(count - 1, rawIndex));
    const current = slides[currentIndex] ?? { title: "" };
    const image = httpsImageSrc(
      current.image == null ? null : asString(current.image),
    );
    const bullets = asStringArray(current.bullets);
    return (
      <View className="flex-col gap-3">
        <View className="flex-row items-baseline justify-between gap-2">
          <View className="min-w-0 flex-1 flex-col gap-0.5">
            {title ? (
              <Text variant="body" weight="medium">
                {title}
              </Text>
            ) : null}
            {theme ? <Text variant="caption">{theme}</Text> : null}
          </View>
          {count > 0 ? (
            <Text variant="caption">
              {currentIndex + 1} / {count}
            </Text>
          ) : null}
        </View>
        <View className="border-border/50 bg-muted/20 flex-col gap-3 rounded-lg border p-3">
          <Text variant="body" weight="medium" className="leading-snug">
            {asString(current.title)}
          </Text>
          {image ? (
            <RNImage
              source={{ uri: image }}
              accessibilityLabel={asString(current.title)}
              className="border-border/40 h-32 w-full rounded-md border"
              resizeMode="cover"
            />
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
          {current.notes ? (
            <Text variant="caption">Notes: {asString(current.notes)}</Text>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-1.5">
            {slides.map((slide, index) => (
              <View
                key={index}
                className={cn(
                  "min-w-[4.5rem] rounded-md border px-2 py-1.5",
                  index === currentIndex
                    ? "border-foreground/40 bg-muted/60"
                    : "border-border/50",
                )}
              >
                <Text
                  variant="caption"
                  weight={index === currentIndex ? "medium" : "regular"}
                  numberOfLines={2}
                >
                  {index + 1}. {asString(slide.title)}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  },

  PdfArtifact: ({
    element,
  }: {
    element: { props: Record<string, unknown> };
  }) => {
    const title = asString(element.props.title);
    const src =
      element.props.src == null ? null : asString(element.props.src);
    const pages =
      element.props.pages == null ? null : asString(element.props.pages);
    const size =
      element.props.size == null ? null : asString(element.props.size);
    const updated =
      element.props.updated == null ? null : asString(element.props.updated);
    const embed = isHttpsPdfUrl(src);
    const meta = [pages, size, updated].filter(Boolean).join(" · ");
    return (
      <View className="flex-col gap-2">
        <View className="flex-col gap-0.5">
          <Text variant="body" weight="medium">
            {title}
          </Text>
          {meta ? <Text variant="caption">{meta}</Text> : null}
        </View>
        {embed && src ? (
          <PdfEmbed uri={src} title={title} />
        ) : (
          <View className="border-border/50 bg-muted/30 flex-col gap-1 rounded-lg border px-3 py-4">
            <Text variant="secondary" weight="medium">
              PDF artifact
            </Text>
            <Text variant="caption">
              {src
                ? "Needs an https PDF URL to embed."
                : "No file URL yet — receipt only."}
            </Text>
          </View>
        )}
      </View>
    );
  },

  ChessBoard: ({
    element,
  }: {
    element: { props: Record<string, unknown> };
  }) => {
    const fen = asString(element.props.fen);
    const title =
      element.props.title == null ? null : asString(element.props.title);
    const orientation =
      element.props.orientation === "black" ? "black" : "white";
    const lastMove =
      element.props.lastMove == null
        ? null
        : asString(element.props.lastMove);
    const moves = asStringArray(element.props.moves).slice(0, 20);
    const cells = boardCells({ fen, orientation, lastMove });
    return (
      <View className="flex-col gap-3">
        {title ? (
          <Text variant="body" weight="medium">
            {title}
          </Text>
        ) : null}
        <View className="border-border/50 aspect-square w-full max-w-[280px] overflow-hidden rounded-lg border">
          {Array.from({ length: 8 }, (_, row) => (
            <View key={row} className="flex-1 flex-row">
              {cells.slice(row * 8, row * 8 + 8).map((cell) => (
                <View
                  key={`${cell.square.file}-${cell.square.rank}`}
                  className={cn(
                    "relative flex-1 items-center justify-center",
                    cell.light ? "bg-[#f0d9b5]" : "bg-[#b58863]",
                    cell.highlighted && "border-2 border-amber-400",
                  )}
                >
                  <Text className="text-[18px] leading-none text-neutral-950">
                    {pieceGlyph(cell.piece)}
                  </Text>
                  {cell.square.file === 0 ? (
                    <Text className="absolute top-0.5 left-0.5 text-[8px] text-black/45">
                      {rankLabel(cell.square.rank)}
                    </Text>
                  ) : null}
                  {cell.square.rank === 0 ? (
                    <Text className="absolute right-0.5 bottom-0.5 text-[8px] text-black/45">
                      {fileLabel(cell.square.file)}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
        </View>
        {lastMove ? <Text variant="caption">Last: {lastMove}</Text> : null}
        {moves.length > 0 ? (
          <Text variant="caption" className="leading-relaxed">
            {moves
              .map((move, index) =>
                index % 2 === 0
                  ? `${Math.floor(index / 2) + 1}. ${move}`
                  : move,
              )
              .join(" ")}
          </Text>
        ) : null}
      </View>
    );
  },

  TerminalBlock: ({
    element,
  }: {
    element: { props: Record<string, unknown> };
  }) => {
    const command = asString(element.props.command);
    const cwd =
      element.props.cwd == null ? null : asString(element.props.cwd);
    const done = element.props.done !== false;
    const exitCode =
      element.props.exitCode == null ? 0 : asNumber(element.props.exitCode);
    const failed = done && exitCode !== 0;
    const duration = formatDurationMs(
      element.props.durationMs == null
        ? null
        : asNumber(element.props.durationMs),
    );
    const stdout = asStringArray(element.props.lines).map(stripAnsi);
    const stderr = asStringArray(element.props.stderr).map(stripAnsi);
    const all = [
      ...stdout.map((text) => ({ kind: "out" as const, text })),
      ...stderr.map((text) => ({ kind: "err" as const, text })),
    ];
    const visibleCap =
      element.props.visibleCount == null
        ? all.length
        : Math.max(
            0,
            Math.min(all.length, Math.floor(asNumber(element.props.visibleCount))),
          );
    const revealed = all.slice(0, visibleCap);
    const collapseAt =
      done && element.props.maxCollapsedLines != null
        ? Math.max(0, Math.floor(asNumber(element.props.maxCollapsedLines)))
        : null;
    const [expanded, setExpanded] = useState(false);
    const shown =
      collapseAt != null && !expanded
        ? revealed.slice(0, collapseAt)
        : revealed;
    const ink = element.props.variant !== "paper";
    return (
      <View
        className={cn(
          "flex-col overflow-hidden rounded-lg border",
          ink
            ? "border-neutral-800 bg-neutral-950"
            : "border-border/60 bg-card",
        )}
      >
        <View
          className={cn(
            "flex-row flex-wrap items-center gap-x-2 gap-y-1 border-b px-2.5 py-1.5",
            ink ? "border-neutral-800" : "border-border/60",
          )}
        >
          <Text
            variant="caption"
            className={cn("min-w-0 flex-1", ink && "text-neutral-200")}
            numberOfLines={2}
          >
            {cwd ? `${cwd} ` : ""}$ {command}
          </Text>
          {done ? (
            <Text
              variant="caption"
              className={failed ? "text-red-400" : "text-emerald-400"}
            >
              exit {exitCode}
            </Text>
          ) : (
            <Text variant="caption">running…</Text>
          )}
          {duration ? <Text variant="caption">{duration}</Text> : null}
        </View>
        <View className="min-h-[4.5rem] px-2.5 py-2">
          {shown.map((line, index) => (
            <Text
              key={index}
              variant="caption"
              className={cn(
                "leading-relaxed",
                line.kind === "err"
                  ? "text-red-400"
                  : ink
                    ? "text-neutral-300"
                    : undefined,
              )}
            >
              {line.text || " "}
              {!done && index === shown.length - 1 ? " ▍" : ""}
            </Text>
          ))}
          {element.props.truncated ? (
            <Text variant="caption" className="mt-1 opacity-50">
              output truncated
            </Text>
          ) : null}
          {collapseAt != null && revealed.length > collapseAt ? (
            <Pressable onPress={() => setExpanded((value) => !value)}>
              <Text variant="caption" className="mt-2 underline">
                {expanded
                  ? "Show less"
                  : `Show all ${revealed.length} lines`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  },

  AudioPlayback: ({
    element,
  }: {
    element: { props: Record<string, unknown> };
  }) => {
    const title =
      element.props.title == null ? null : asString(element.props.title);
    const artist =
      element.props.artist == null ? null : asString(element.props.artist);
    const duration =
      element.props.duration == null
        ? null
        : asString(element.props.duration);
    const src = httpsImageSrc(asString(element.props.src));
    const poster = httpsImageSrc(
      element.props.poster == null ? null : asString(element.props.poster),
    );
    const meta = [artist, duration].filter(Boolean).join(" · ");
    if (!src) {
      return (
        <Text variant="caption">Audio needs an https URL.</Text>
      );
    }
    return (
      <AudioClipPlayer
        src={src}
        title={title}
        meta={meta || null}
        poster={poster}
      />
    );
  },
};

function AudioClipPlayer({
  src,
  title,
  meta,
  poster,
}: {
  readonly src: string;
  readonly title: string | null;
  readonly meta: string | null;
  readonly poster: string | null;
}) {
  const player = useAudioPlayer(src);
  const [playing, setPlaying] = useState(false);
  return (
    <View className="flex-col gap-2">
      <View className="flex-row items-center gap-3">
        {poster ? (
          <RNImage
            source={{ uri: poster }}
            accessibilityLabel={title ?? "Audio"}
            className="border-border/50 h-14 w-14 shrink-0 rounded-md border"
            resizeMode="cover"
          />
        ) : null}
        <View className="min-w-0 flex-1 flex-col gap-0.5">
          {title ? (
            <Text variant="body" weight="medium">
              {title}
            </Text>
          ) : null}
          {meta ? <Text variant="caption">{meta}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? "Pause" : "Play"}
          onPress={() => {
            if (playing) {
              player.pause();
              setPlaying(false);
              return;
            }
            void (async () => {
              try {
                await player.seekTo(0);
              } catch {
                /* ok */
              }
              player.play();
              setPlaying(true);
            })();
          }}
          className="border-border/60 bg-muted/40 rounded-full border p-2.5 active:opacity-80"
        >
          <Icon
            as={playing ? PauseIcon : PlayIcon}
            className="size-4 text-foreground"
          />
        </Pressable>
      </View>
    </View>
  );
}
