import {
  clampRevealCount,
  criterionBarPercent,
  httpsPosterSrc,
  isHttpsGltfUrl,
  scoreRatioTone,
} from "../../../lib/json-render/model-3d";
import {
  openPreviewExternal,
  PreviewWebFrame,
  WebPreview,
} from "@/components/assistant-ui/elements/web-preview";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { CheckIcon, MinusIcon } from "lucide-react-native";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Image as RNImage,
  Linking,
  Pressable,
  View,
} from "react-native";

type WebViewComponent = ComponentType<{
  source: { html?: string; uri?: string };
  style?: object;
  originWhitelist?: string[];
  scrollEnabled?: boolean;
  onLoadEnd?: () => void;
  onError?: () => void;
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

function asBool(value: unknown): boolean | null {
  if (value == null) return null;
  return Boolean(value);
}

function asObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      item != null && typeof item === "object" && !Array.isArray(item),
  );
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(asString) : [];
}

function asTraitArray(value: unknown): (string | false)[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (item === false) return false;
    if (item == null) return false;
    return String(item);
  });
}

function ModelViewerFrame({
  src,
  poster,
  autoRotate,
  title,
}: {
  readonly src: string;
  readonly poster: string | null;
  readonly autoRotate: boolean;
  readonly title: string | null;
}) {
  const WebView = useMemo(() => loadWebView(), []);
  const [failed, setFailed] = useState(false);
  const html = useMemo(() => {
    const posterAttr = poster
      ? ` poster="${poster.replace(/"/g, "&quot;")}"`
      : "";
    const rotateAttr = autoRotate ? " auto-rotate" : "";
    return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"></script><style>html,body{margin:0;height:100%;background:#111318}model-viewer{width:100%;height:100%;--poster-color:transparent}</style></head><body><model-viewer src="${src.replace(/"/g, "&quot;")}"${posterAttr}${rotateAttr} camera-controls touch-action="pan-y" exposure="1" shadow-intensity="0.6" alt="${(title ?? "3D model").replace(/"/g, "&quot;")}"></model-viewer></body></html>`;
  }, [src, poster, autoRotate, title]);

  if (!WebView || failed) {
    return (
      <View className="h-56 items-center justify-center gap-2 px-4">
        {poster ? (
          <RNImage
            source={{ uri: poster }}
            accessibilityLabel={title ?? "3D model"}
            className="h-28 w-full"
            resizeMode="contain"
          />
        ) : null}
        <Pressable onPress={() => void Linking.openURL(src)}>
          <Text variant="caption" className="underline">
            Open model
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <WebView
      source={{ html }}
      style={{ height: 224, width: "100%", backgroundColor: "#111318" }}
      originWhitelist={["*"]}
      scrollEnabled={false}
      onError={() => setFailed(true)}
    />
  );
}

function PreviewFrame({ url }: { readonly url: string }) {
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);
  let origin = url;
  try {
    origin = new URL(url).host;
  } catch {
    /* keep raw */
  }

  useEffect(() => {
    setLoading(true);
    setKey((k) => k + 1);
  }, [url]);

  if (!url.toLowerCase().startsWith("https://")) {
    return <Text variant="caption">Preview needs an https URL.</Text>;
  }

  return (
    <WebPreview
      origin={origin}
      loading={loading}
      onReload={() => {
        setLoading(true);
        setKey((k) => k + 1);
      }}
      onOpenExternal={() => openPreviewExternal(url)}
    >
      <PreviewWebFrame
        key={key}
        url={url}
        onLoadEnd={() => setLoading(false)}
      />
    </WebPreview>
  );
}

/** Mobile json-render components for Model3D, WebPreview, Timeline, Comparison, Math, Score. */
export const structuredMobileCards = {
  Model3D: ({
    element,
  }: {
    element: { props: Record<string, unknown> };
  }) => {
    const title =
      element.props.title == null ? null : asString(element.props.title);
    const caption =
      element.props.caption == null ? null : asString(element.props.caption);
    const src = asString(element.props.src);
    const poster = httpsPosterSrc(
      element.props.poster == null ? null : asString(element.props.poster),
    );
    const autoRotate = asBool(element.props.autoRotate) !== false;
    const gltf = isHttpsGltfUrl(src) ? src.trim() : null;
    if (!gltf) {
      return (
        <Text variant="caption">Model needs an https .glb or .gltf URL.</Text>
      );
    }
    return (
      <View className="flex-col gap-2">
        {title ? (
          <Text variant="body" weight="medium">
            {title}
          </Text>
        ) : null}
        <View className="border-border/50 overflow-hidden rounded-lg border bg-[#111318]">
          <ModelViewerFrame
            src={gltf}
            poster={poster}
            autoRotate={autoRotate}
            title={title}
          />
        </View>
        {caption ? <Text variant="caption">{caption}</Text> : null}
      </View>
    );
  },

  WebPreview: ({
    element,
  }: {
    element: { props: Record<string, unknown> };
  }) => {
    const title =
      element.props.title == null ? null : asString(element.props.title);
    const url = asString(element.props.url);
    return (
      <View className="flex-col gap-2">
        {title ? (
          <Text variant="body" weight="medium">
            {title}
          </Text>
        ) : null}
        <PreviewFrame url={url} />
      </View>
    );
  },

  Timeline: ({
    element,
  }: {
    element: { props: Record<string, unknown> };
  }) => {
    const events = asObjectArray(element.props.events).map((event) => ({
      id: asString(event.id),
      when:
        event.when === "past" || event.when === "now" || event.when === "future"
          ? event.when
          : "past",
      time: asString(event.time),
      title: asString(event.title),
      detail: event.detail == null ? null : asString(event.detail),
    }));
    const count = clampRevealCount(
      events.length,
      element.props.visibleCount == null
        ? null
        : asNumber(element.props.visibleCount),
    );
    const shown = events.slice(0, count);
    return (
      <View className="flex-col">
        {shown.map((event, index) => {
          const isLast = index === shown.length - 1;
          const future = event.when === "future";
          const now = event.when === "now";
          return (
            <View key={event.id} className="flex-row gap-2">
              <Text
                variant="caption"
                className="w-14 pt-1 text-right font-mono tabular-nums"
              >
                {event.time}
              </Text>
              <View className="w-3 items-center">
                <View
                  className={cn(
                    "mt-1.5 size-2.5 rounded-full",
                    now && "bg-blue-500",
                    event.when === "past" && "bg-muted-foreground/70",
                    future && "border-muted-foreground/50 border-2 bg-transparent",
                  )}
                />
                {!isLast ? (
                  <View
                    className={cn(
                      "mt-1 min-h-6 w-px flex-1",
                      future ? "bg-border/40" : "bg-border/70",
                    )}
                  />
                ) : null}
              </View>
              <View className="min-w-0 flex-1 pb-4">
                <Text
                  variant="secondary"
                  weight={now ? "semibold" : "medium"}
                  className={cn(future && "opacity-60")}
                >
                  {event.title}
                </Text>
                {event.detail ? (
                  <Text variant="caption" className="mt-0.5 leading-relaxed">
                    {event.detail}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    );
  },

  ComparisonCard: ({
    element,
  }: {
    element: { props: Record<string, unknown> };
  }) => {
    const traitLabels = asStringArray(element.props.traitLabels);
    const options = asObjectArray(element.props.options).map((option) => ({
      id: asString(option.id),
      name: asString(option.name),
      headline: asString(option.headline),
      traits: asTraitArray(option.traits),
    }));
    const recommendedId = asString(element.props.recommendedId);
    const reason = asString(element.props.reason);
    return (
      <View className="flex-col gap-3">
        <View className="flex-col gap-2">
          {options.map((option) => {
            const pick = option.id === recommendedId;
            return (
              <View
                key={option.id}
                className={cn(
                  "flex-col gap-2 rounded-lg border px-3 py-2.5",
                  pick
                    ? "border-foreground/30 bg-muted/40"
                    : "border-border/50",
                )}
              >
                <View className="flex-row items-baseline justify-between gap-2">
                  <Text variant="body" weight="medium">
                    {option.name}
                  </Text>
                  {pick ? (
                    <Text
                      variant="caption"
                      className="font-mono uppercase tracking-wide"
                    >
                      pick
                    </Text>
                  ) : null}
                </View>
                <Text variant="caption">{option.headline}</Text>
                <View className="flex-col gap-1.5">
                  {traitLabels.map((label, index) => {
                    const trait = option.traits[index];
                    const present = Boolean(trait);
                    return (
                      <View
                        key={`${option.id}-${label}`}
                        className="flex-row items-center gap-2"
                      >
                        <Icon
                          as={present ? CheckIcon : MinusIcon}
                          className={cn(
                            "size-3.5",
                            present
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                        />
                        <Text
                          variant="caption"
                          className={cn(!present && "opacity-55")}
                        >
                          {present && typeof trait === "string" ? trait : label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
        <Text variant="caption" className="leading-relaxed">
          {reason}
        </Text>
      </View>
    );
  },

  MathBlock: ({
    element,
  }: {
    element: { props: Record<string, unknown> };
  }) => {
    const label =
      element.props.label == null ? null : asString(element.props.label);
    const steps = asObjectArray(element.props.steps).map((step) => ({
      expression: asString(step.expression),
      note: step.note == null ? null : asString(step.note),
    }));
    const count = clampRevealCount(
      steps.length,
      element.props.visibleSteps == null
        ? null
        : asNumber(element.props.visibleSteps),
    );
    const shown = steps.slice(0, count);
    return (
      <View className="flex-col gap-3">
        {label ? (
          <Text
            variant="caption"
            className="font-mono uppercase tracking-wide"
          >
            {label}
          </Text>
        ) : null}
        {shown.map((step, index) => (
          <View key={index} className="flex-col gap-0.5">
            <Text variant="secondary" className="font-mono leading-relaxed">
              {step.expression}
            </Text>
            {step.note ? <Text variant="caption">{step.note}</Text> : null}
          </View>
        ))}
      </View>
    );
  },

  ScoreBreakdown: ({
    element,
  }: {
    element: { props: Record<string, unknown> };
  }) => {
    const verdict = asString(element.props.verdict);
    const total = asNumber(element.props.total);
    const outOf = asNumber(element.props.outOf);
    const tone = scoreRatioTone(total, outOf);
    const criteria = asObjectArray(element.props.criteria).map((item) => ({
      label: asString(item.label),
      score: asNumber(item.score),
      weight: asNumber(item.weight),
      note: item.note == null ? null : asString(item.note),
    }));
    const count = clampRevealCount(
      criteria.length,
      element.props.visibleCount == null
        ? null
        : asNumber(element.props.visibleCount),
    );
    const shown = criteria.slice(0, count);
    return (
      <View className="flex-col gap-3">
        <View className="flex-row items-baseline gap-2">
          <Text variant="body" weight="semibold" className="text-2xl tabular-nums">
            {total.toFixed(1)}
          </Text>
          <Text variant="caption">/ {outOf}</Text>
          <View
            className={cn(
              "ml-auto rounded-full px-2 py-0.5",
              tone === "positive" && "bg-emerald-500/15",
              tone === "warning" && "bg-amber-500/15",
              tone === "negative" && "bg-red-500/15",
            )}
          >
            <Text
              variant="caption"
              weight="medium"
              className={cn(
                "capitalize",
                tone === "positive" && "text-emerald-700 dark:text-emerald-300",
                tone === "warning" && "text-amber-800 dark:text-amber-200",
                tone === "negative" && "text-red-700 dark:text-red-300",
              )}
            >
              {verdict}
            </Text>
          </View>
        </View>
        <View className="flex-col gap-3">
          {shown.map((criterion) => {
            const width = criterionBarPercent(criterion.score, outOf);
            return (
              <View key={criterion.label} className="flex-col gap-1">
                <View className="flex-row items-baseline justify-between gap-2">
                  <Text variant="secondary" weight="medium">
                    {criterion.label}
                  </Text>
                  <Text variant="caption" className="font-mono tabular-nums">
                    ×{criterion.weight} · {criterion.score.toFixed(1)}
                  </Text>
                </View>
                <View className="bg-muted h-2 w-full overflow-hidden rounded-full">
                  <View
                    className="bg-foreground/70 h-full rounded-full"
                    style={{ width: `${width}%` }}
                  />
                </View>
                {criterion.note ? (
                  <Text variant="caption">{criterion.note}</Text>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    );
  },
};
