import { cn } from "@/lib/utils";
import {
  type FC,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Platform,
  View,
  type LayoutChangeEvent,
  type TextStyle,
} from "react-native";
import { Text, type TextProps } from "@/components/ui/text";
// React 19 typings for this package are incomplete; cast for JSX.
import MaskedViewOrigin from "@react-native-masked-view/masked-view";
const MaskedView = MaskedViewOrigin as unknown as FC<{
  readonly style?: object;
  readonly maskElement: ReactNode;
  readonly children?: ReactNode;
}>;
import Reanimated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useCSSVariable } from "uniwind";

export const paper = "bg-background border border-border/60 dark:bg-card";

export const field = "bg-foreground/5 dark:bg-foreground/10";

export const inkButton = "bg-foreground active:opacity-90";

/** Mono tracking only — pair with `Text variant="caption"` (or `text-caption`). */
export const mono = "tracking-tight";

/**
 * Thinking / tool chrome — Cursor-like muted status (softer than answer copy).
 * Pair with `Text variant="body"` (15px) so meta sits slightly under message
 * `label` (17px); mute via tone / these color classes.
 */
export const threadMeta = "text-muted-foreground/75";

/** Tool call verb — secondary text (stronger than detail chips). */
export const threadMetaCall = "text-muted-foreground";

/** Tool paths / counts — lighter muted than the verb. */
export const threadMetaDetail = "text-muted-foreground/55";

/** Cursor-style green/red line deltas on edit summaries. */
export const threadDiffAdd = "text-emerald-600/90 dark:text-emerald-400/90";
export const threadDiffRemove = "text-red-600/90 dark:text-red-400/90";

export const textButtonHitSlop = { top: 12, bottom: 12 };

export const webLiveRegion =
  Platform.OS === "web" ? ("polite" as const) : undefined;

export const useAnnounce = (
  message: string | undefined,
  { onMount = true }: { onMount?: boolean } = {},
) => {
  const announced = useRef(onMount ? undefined : message);

  useEffect(() => {
    if (message !== undefined && message !== announced.current) {
      AccessibilityInfo.announceForAccessibility(message);
    }
    announced.current = message;
  }, [message]);
};

const subscribeHydration = () => () => {};
const getHydrated = () => true;
const getServerHydrated = () => false;

export const useHydrated = () =>
  useSyncExternalStore(subscribeHydration, getHydrated, getServerHydrated);

export const monoStyle: TextStyle = {
  fontFamily: Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  }),
};

let reduceMotion: boolean | undefined;
let reduceMotionQuery = 0;
let reduceMotionSubscription: { remove(): void } | undefined;
const motionListeners = new Set<() => void>();

const setReduceMotion = (reduced: boolean) => {
  reduceMotion = reduced;
  for (const listener of motionListeners) listener();
};

const subscribeMotion = (listener: () => void) => {
  if (motionListeners.size === 0) {
    const query = ++reduceMotionQuery;
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (reduced) => {
        if (query === reduceMotionQuery) setReduceMotion(reduced);
      },
      () => {},
    );
    reduceMotionSubscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
  }
  motionListeners.add(listener);
  return () => {
    motionListeners.delete(listener);
    if (motionListeners.size === 0) {
      reduceMotionQuery++;
      reduceMotionSubscription?.remove();
      reduceMotionSubscription = undefined;
      reduceMotion = undefined;
    }
  };
};

// Default ON until AccessibilityInfo resolves — otherwise first paint of a
// stream takes the no-motion path and dumps the whole string as one block.
const getMotion = () => reduceMotion !== true;

export const useMotion = () =>
  useSyncExternalStore(subscribeMotion, getMotion, getMotion);

// ---------------------------------------------------------------------------
// transitions.dev motion tokens
// shimmer-text / thinking-states / streaming-text
// ---------------------------------------------------------------------------

/** shimmer-text `--shimmer-dur` */
export const SHIMMER_DUR_MS = 2000;
/** thinking-states `--think-swap` */
export const THINK_SWAP_MS = 150;
/** thinking-states `--think-gap` */
export const THINK_GAP_MS = 50;
/** thinking-states `--think-distance` */
export const THINK_SWAP_Y = 8;
/** thinking-states `--think-blur` (web filter; RN approximates via opacity) */
export const THINK_SWAP_BLUR = 2;
/** streaming-text `--stream-gap` */
export const STREAM_GAP_MS = 60;
/** streaming-text `--stream-fade` */
export const STREAM_FADE_MS = 350;
/** streaming-text `--stream-blur` */
export const STREAM_BLUR = 1;
/** streaming-text `--stream-ease` */
export const STREAM_EASE = Easing.bezier(0.22, 1, 0.36, 1);

export const STEP_ENTER_MS = 220;
export const STEP_ENTER_Y = 6;
export const MESSAGE_ENTER_MS = 220;
export const MESSAGE_ENTER_Y = 14;
export const COLLAPSE_MS = 200;

/** Accordion / collapse ease (web collapsePanel). */
export const collapseEase = Easing.bezier(0.32, 0.72, 0, 1);

export const stepEnter = FadeInDown.duration(STEP_ENTER_MS).withInitialValues({
  opacity: 0,
  transform: [{ translateY: STEP_ENTER_Y }],
});

/** thinking-states enter half (rise from below). */
export const thinkSwapEnter = FadeInDown.duration(THINK_SWAP_MS)
  .delay(THINK_GAP_MS)
  .withInitialValues({
    opacity: 0,
    transform: [{ translateY: THINK_SWAP_Y }],
  });

/** thinking-states exit half (float up + fade). */
export const thinkSwapExit = FadeOutUp.duration(THINK_SWAP_MS).withInitialValues(
  {
    opacity: 1,
    transform: [{ translateY: 0 }],
  },
);

export const messageEnter = FadeInDown.duration(MESSAGE_ENTER_MS)
  .easing(STREAM_EASE)
  .withInitialValues({
    opacity: 0,
    transform: [{ translateY: MESSAGE_ENTER_Y }],
  });

/** Copy / share bar after the assistant message settles. */
export const ACTION_BAR_ENTER_MS = 240;
export const ACTION_BAR_ENTER_Y = 5;
export const actionBarEnter = FadeInDown.duration(ACTION_BAR_ENTER_MS)
  .delay(60)
  .easing(STREAM_EASE)
  .withInitialValues({
    opacity: 0,
    transform: [{ translateY: ACTION_BAR_ENTER_Y }],
  });

export const layoutTransition = LinearTransition.duration(COLLAPSE_MS).easing(
  collapseEase,
);

export const usePulse = (active: boolean, low = 0.45) => {
  const [opacity] = useState(() => new Animated.Value(1));
  const motion = useMotion();

  useEffect(() => {
    if (!active || !motion) {
      opacity.setValue(1);
      return;
    }
    const useNativeDriver = Platform.OS !== "web";
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: low,
          duration: 700,
          useNativeDriver,
          isInteraction: false,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver,
          isInteraction: false,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [active, low, motion, opacity]);

  return opacity;
};

function childrenToLabel(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(childrenToLabel).join("");
  }
  return "";
}

/**
 * transitions.dev `shimmer-text`: base muted glyphs + masked highlight band
 * sweeping LTR with `--shimmer-dur` (2000ms) linear across a 400%-wide
 * gradient (transparent → highlight → transparent).
 */
export const ShimmerLabel: FC<TextProps & { active?: boolean }> = ({
  active = true,
  className,
  children,
  style,
  numberOfLines,
  ...props
}) => {
  const motion = useMotion();
  const label = childrenToLabel(children);
  const base =
    (useCSSVariable("--color-muted-foreground") as string | undefined) ??
    "#7c7c7c";
  const highlight =
    (useCSSVariable("--color-foreground") as string | undefined) ?? "#0d0d0d";
  const progress = useSharedValue(0);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const sweep = active && motion && label.length > 0;

  useEffect(() => {
    if (!sweep) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, {
        duration: SHIMMER_DUR_MS,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [sweep, progress]);

  // background-size: 400% → band travels from 0% → 100% of that canvas (LTR).
  const bandWidth = Math.max(size.width * 4, 1);
  const bandStyle = useAnimatedStyle(() => {
    const travel = bandWidth - Math.max(size.width, 1);
    return {
      transform: [{ translateX: (progress.value - 1) * travel }],
    };
  }, [bandWidth, size.width]);

  const onMaskLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.ceil(event.nativeEvent.layout.width);
    const height = Math.ceil(event.nativeEvent.layout.height);
    if (width <= 0 || height <= 0) return;
    setSize((prev) =>
      prev.width === width && prev.height === height
        ? prev
        : { width, height },
    );
  }, []);

  if (!sweep) {
    return (
      <Text
        className={cn("aui-shimmer-label", className)}
        style={style}
        numberOfLines={numberOfLines}
        {...props}
      >
        {children}
      </Text>
    );
  }

  if (Platform.OS === "web") {
    return (
      <Text
        className={cn("aui-shimmer-label t-shimmer", className)}
        {...({ "data-text": label } as object)}
        style={[{ color: base }, style]}
        numberOfLines={numberOfLines}
        {...props}
      >
        {children}
      </Text>
    );
  }

  const w = Math.max(size.width, 1);
  const h = Math.max(size.height, 1);

  // CSS recipe: base glyphs always paint; ::before is only the clipped highlight.
  // Keep the Text in-flow so thinking never collapses to an empty MaskedView.
  return (
    <View
      accessibilityRole="text"
      accessible
      accessibilityLabel={label}
      className="shrink-0"
      collapsable={false}
    >
      <Text
        className={cn("aui-shimmer-label", className)}
        style={[{ color: base }, style]}
        numberOfLines={numberOfLines}
        onLayout={onMaskLayout}
        {...props}
      >
        {label}
      </Text>
      {size.width > 0 && size.height > 0 ? (
        <MaskedView
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: size.width,
            height: size.height,
          }}
          maskElement={
            <View style={{ backgroundColor: "transparent" }}>
              <Text
                className={cn("aui-shimmer-label", className)}
                style={[style, { color: "#000" }]}
                numberOfLines={numberOfLines}
                {...props}
              >
                {label}
              </Text>
            </View>
          }
        >
          <View style={{ width: w, height: h, overflow: "hidden" }}>
            <Reanimated.View
              style={[
                {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: h,
                  width: bandWidth,
                },
                bandStyle,
              ]}
            >
              <Svg width={bandWidth} height={h}>
                <Defs>
                  <LinearGradient id="shimmerBand" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={highlight} stopOpacity="0" />
                    <Stop offset="0.4" stopColor={highlight} stopOpacity="0" />
                    <Stop offset="0.5" stopColor={highlight} stopOpacity="1" />
                    <Stop offset="0.6" stopColor={highlight} stopOpacity="0" />
                    <Stop offset="1" stopColor={highlight} stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Rect
                  x={0}
                  y={0}
                  width={bandWidth}
                  height={h}
                  fill="url(#shimmerBand)"
                />
              </Svg>
            </Reanimated.View>
          </View>
        </MaskedView>
      ) : null}
    </View>
  );
};

/**
 * Height-collapsing panel (web collapsePanel / accordion feel).
 */
export function CollapsePanel({
  open,
  children,
  className,
}: {
  readonly open: boolean;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const motion = useMotion();
  const [contentHeight, setContentHeight] = useState(0);
  const [settledOpen, setSettledOpen] = useState(open);
  const height = useSharedValue(0);
  const opacity = useSharedValue(open ? 1 : 0);
  const prevOpenRef = useRef(open);

  useEffect(() => {
    const toggled = prevOpenRef.current !== open;
    prevOpenRef.current = open;

    if (!motion || !toggled) {
      setSettledOpen(open);
      if (contentHeight > 0) {
        height.value = open ? contentHeight : 0;
      }
      opacity.value = open ? 1 : 0;
      return;
    }

    if (open) {
      if (contentHeight <= 0) {
        setSettledOpen(true);
        opacity.value = 1;
        return;
      }
      height.value = withTiming(contentHeight, {
        duration: COLLAPSE_MS,
        easing: collapseEase,
      });
      opacity.value = withTiming(1, {
        duration: COLLAPSE_MS,
        easing: collapseEase,
      });
      const done = setTimeout(() => setSettledOpen(true), COLLAPSE_MS);
      return () => clearTimeout(done);
    }

    setSettledOpen(false);
    height.value = withTiming(0, {
      duration: COLLAPSE_MS,
      easing: collapseEase,
    });
    opacity.value = withTiming(0, {
      duration: COLLAPSE_MS,
      easing: collapseEase,
    });
    return undefined;
  }, [open, contentHeight, motion, height, opacity]);

  const animatedStyle = useAnimatedStyle(() =>
    settledOpen
      ? { opacity: 1 }
      : {
          height: height.value,
          opacity: opacity.value,
          overflow: "hidden" as const,
        },
  );

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.ceil(event.nativeEvent.layout.height);
    if (next > 0) {
      setContentHeight((prev) => (prev === next ? prev : next));
    }
  }, []);

  if (!motion) {
    if (!open) return null;
    return <View className={className}>{children}</View>;
  }

  return (
    <Reanimated.View style={animatedStyle} className={className}>
      <View
        style={
          open
            ? undefined
            : { position: "absolute", opacity: 0, left: 0, right: 0 }
        }
        onLayout={onLayout}
        pointerEvents={open ? "auto" : "none"}
      >
        {children}
      </View>
    </Reanimated.View>
  );
}

const thinkSwapTiming = {
  duration: THINK_SWAP_MS,
  easing: Easing.inOut(Easing.ease),
} as const;

/**
 * transitions.dev thinking-states: outgoing exits up immediately over
 * `--think-swap`; incoming snaps below, then after `--think-gap` rises in
 * over the same duration so both halves overlap (one swap, not two).
 */
export function ThinkingStatesLabel({
  label,
  shimmer = true,
  className,
  textClassName,
}: {
  label: string;
  shimmer?: boolean;
  className?: string;
  textClassName?: string;
}) {
  const motion = useMotion();
  const [active, setActive] = useState<0 | 1>(0);
  const activeRef = useRef<0 | 1>(0);
  const [slots, setSlots] = useState<[string, string]>([label, label]);
  const currentRef = useRef(label);
  const widthTargetRef = useRef(0);

  // First paint starts planted below (same as a swap enter) so the initial
  // Planning next moves / Thinking status rises in instead of popping.
  const opacity0 = useSharedValue(motion ? 0 : 1);
  const y0 = useSharedValue(motion ? THINK_SWAP_Y : 0);
  const opacity1 = useSharedValue(0);
  const y1 = useSharedValue(THINK_SWAP_Y);
  const widthSv = useSharedValue(0);

  const runEnter = useCallback(
    (slot: 0 | 1) => {
      const inOpacity = slot === 0 ? opacity0 : opacity1;
      const inY = slot === 0 ? y0 : y1;
      cancelAnimation(inOpacity);
      cancelAnimation(inY);
      inOpacity.value = 0;
      inY.value = THINK_SWAP_Y;
      inOpacity.value = withDelay(THINK_GAP_MS, withTiming(1, thinkSwapTiming));
      inY.value = withDelay(THINK_GAP_MS, withTiming(0, thinkSwapTiming));
    },
    [opacity0, opacity1, y0, y1],
  );

  const runSwap = useCallback(
    (from: 0 | 1, to: 0 | 1) => {
      const outOpacity = from === 0 ? opacity0 : opacity1;
      const outY = from === 0 ? y0 : y1;

      cancelAnimation(outOpacity);
      cancelAnimation(outY);

      // Exit outgoing immediately (up + fade).
      outOpacity.value = withTiming(0, thinkSwapTiming);
      outY.value = withTiming(-THINK_SWAP_Y, thinkSwapTiming);

      // Incoming half matches first-paint enter.
      runEnter(to);
    },
    [opacity0, opacity1, runEnter, y0, y1],
  );

  useEffect(() => {
    if (!motion) {
      opacity0.value = 1;
      y0.value = 0;
      return;
    }
    // Only animate first paint while still planted; later swaps own motion.
    if (opacity0.value !== 0 || y0.value !== THINK_SWAP_Y) return;
    runEnter(0);
  }, [motion, opacity0, runEnter, y0]);

  useEffect(() => {
    if (label === currentRef.current) return;
    const previous = currentRef.current;
    currentRef.current = label;

    if (!motion) {
      setSlots([label, label]);
      activeRef.current = 0;
      setActive(0);
      opacity0.value = 1;
      y0.value = 0;
      opacity1.value = 0;
      y1.value = THINK_SWAP_Y;
      return;
    }

    // Streaming tool chips grow in place — don't swap on every glyph.
    const streamingRefine =
      label.startsWith(previous) || previous.startsWith(label);
    if (streamingRefine) {
      const slot = activeRef.current;
      setSlots((prev) => {
        const copy: [string, string] = [prev[0], prev[1]];
        copy[slot] = label;
        return copy;
      });
      return;
    }

    const from = activeRef.current;
    const to: 0 | 1 = from === 0 ? 1 : 0;
    setSlots((prev) => {
      const copy: [string, string] = [prev[0], prev[1]];
      copy[to] = label;
      return copy;
    });
    runSwap(from, to);
    const timer = setTimeout(() => {
      activeRef.current = to;
      setActive(to);
    }, THINK_GAP_MS);
    return () => clearTimeout(timer);
  }, [label, motion, opacity0, opacity1, runSwap, y0, y1]);

  const onMeasure = useCallback(
    (event: LayoutChangeEvent) => {
      const nextWidth = Math.ceil(event.nativeEvent.layout.width);
      if (nextWidth <= 0 || nextWidth === widthTargetRef.current) return;
      const prevWidth = widthTargetRef.current;
      // Snap wider so streaming tool chips never clip mid-word; ease shrinks.
      const animate = prevWidth > 0 && motion && nextWidth < prevWidth;
      widthTargetRef.current = nextWidth;
      cancelAnimation(widthSv);
      if (!animate) {
        widthSv.value = nextWidth;
        return;
      }
      widthSv.value = withTiming(nextWidth, thinkSwapTiming);
    },
    [motion, widthSv],
  );

  const layer0Style = useAnimatedStyle(() => ({
    opacity: opacity0.value,
    transform: [{ translateY: y0.value }],
  }));
  const layer1Style = useAnimatedStyle(() => ({
    opacity: opacity1.value,
    transform: [{ translateY: y1.value }],
  }));
  const boxStyle = useAnimatedStyle(() =>
    widthSv.value > 0 ? { width: widthSv.value } : ({} as { width?: number }),
  );

  if (!motion) {
    return (
      <View className={cn("min-w-0 flex-shrink", className)}>
        <ShimmerLabel
          active={false}
          variant="body"
          numberOfLines={1}
          className={textClassName}
        >
          {label}
        </ShimmerLabel>
      </View>
    );
  }

  const layerPos = {
    position: "absolute" as const,
    left: 0,
    top: 0,
  };

  return (
    <View className={cn("relative min-w-0 flex-shrink", className)}>
      {/* Intrinsic sizer lives OUTSIDE the clipped width box — measuring
          inside overflow+fixed width locked streaming chips at the first
          short width ("Searching p"). */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: "absolute", opacity: 0, left: 0, top: 0 }}
        onLayout={onMeasure}
      >
        <ShimmerLabel
          active={false}
          variant="body"
          numberOfLines={1}
          className={textClassName}
        >
          {label}
        </ShimmerLabel>
      </View>
      <Reanimated.View className="overflow-hidden" style={boxStyle}>
        {/* In-flow height spacer (opacity 0); width comes from boxStyle. */}
        <View style={{ opacity: 0 }} pointerEvents="none">
          <ShimmerLabel
            active={false}
            variant="body"
            numberOfLines={1}
            className={textClassName}
          >
            {slots[active]}
          </ShimmerLabel>
        </View>
        <Reanimated.View
          pointerEvents={active === 0 ? "auto" : "none"}
          style={[layer0Style, layerPos]}
          accessibilityElementsHidden={active !== 0}
          importantForAccessibility={
            active === 0 ? "yes" : "no-hide-descendants"
          }
        >
          <ShimmerLabel
            active={shimmer && active === 0}
            variant="body"
            numberOfLines={1}
            className={textClassName}
          >
            {slots[0]}
          </ShimmerLabel>
        </Reanimated.View>
        <Reanimated.View
          pointerEvents={active === 1 ? "auto" : "none"}
          style={[layer1Style, layerPos]}
          accessibilityElementsHidden={active !== 1}
          importantForAccessibility={
            active === 1 ? "yes" : "no-hide-descendants"
          }
        >
          <ShimmerLabel
            active={shimmer && active === 1}
            variant="body"
            numberOfLines={1}
            className={textClassName}
          >
            {slots[1]}
          </ShimmerLabel>
        </Reanimated.View>
      </Reanimated.View>
    </View>
  );
}
