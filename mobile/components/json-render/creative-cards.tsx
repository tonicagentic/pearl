import {
  chartSeriesLayout,
  clampVisibleCount,
} from "../../../lib/json-render/chart";
import { regionBarWidths } from "../../../lib/json-render/diagrams";
import { httpsImageSrc, isHttpsPdfUrl } from "../../../lib/json-render/pdf-url";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useMemo, type ComponentType } from "react";
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
};
