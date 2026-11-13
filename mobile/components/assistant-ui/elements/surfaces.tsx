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
  Easing as RnEasing,
  Platform,
  Text,
  View,
  type LayoutChangeEvent,
  type TextProps,
  type TextStyle,
} from "react-native";
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
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useCSSVariable } from "uniwind";

export const paper = "bg-background border border-border/60 dark:bg-card";

export const field = "bg-foreground/5 dark:bg-foreground/10";

export const inkButton = "bg-foreground active:opacity-90";

export const mono = "text-[11px] tracking-tight";

/** Shared thread type scale: body and meta stay the same size. */
export const threadText = "text-[15px] leading-6";

/**
 * Thinking / tool chrome — Cursor-like muted status (softer than body copy).
 * Body answers stay on `text-foreground`; these rows stay secondary.
 */
export const threadMeta = `${threadText} text-muted-foreground/75`;

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
 * sweeping with `--shimmer-dur` (2000ms) linear across a 400%-wide gradient
 * (transparent → highlight → transparent).
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

  // background-size: 400% → band travels from 100% → 0% of that canvas.
  const bandWidth = Math.max(size.width * 4, 1);
  const bandStyle = useAnimatedStyle(() => {
    const travel = bandWidth - Math.max(size.width, 1);
    return {
      transform: [{ translateX: progress.value * -travel }],
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
  const height = useSharedValue(0);
  const opacity = useSharedValue(open ? 1 : 0);
  const measuredRef = useRef(false);

  useEffect(() => {
    if (contentHeight <= 0) return;
    // First measure: snap so an initially-open panel isn't height-0 for a frame.
    if (!measuredRef.current) {
      measuredRef.current = true;
      height.value = open ? contentHeight : 0;
      opacity.value = open ? 1 : 0;
      return;
    }
    if (!motion) {
      height.value = open ? contentHeight : 0;
      opacity.value = open ? 1 : 0;
      return;
    }
    height.value = withTiming(open ? contentHeight : 0, {
      duration: COLLAPSE_MS,
      easing: collapseEase,
    });
    opacity.value = withTiming(open ? 1 : 0, {
      duration: COLLAPSE_MS,
      easing: collapseEase,
    });
  }, [open, contentHeight, motion, height, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
    opacity: opacity.value,
    overflow: "hidden" as const,
  }));

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

/**
 * thinking-states / text-states-swap: outgoing exits up, incoming rises
 * after --think-gap, both over --think-swap with ease-in-out.
 */
export function SwapLabel({
  active,
  children,
  className,
}: {
  active: 0 | 1;
  children: [ReactNode, ReactNode];
  className?: string;
}) {
  const motion = useMotion();
  const [progress] = useState(() => new Animated.Value(active));
  const [box, setBox] = useState({ width: 0, height: 0 });
  const mergeLayout = useCallback((width: number, height: number) => {
    setBox((prev) => {
      const next = {
        width: Math.max(prev.width, Math.ceil(width)),
        height: Math.max(prev.height, Math.ceil(height)),
      };
      return next.width === prev.width && next.height === prev.height
        ? prev
        : next;
    });
  }, []);

  useEffect(() => {
    if (!motion) {
      progress.setValue(active);
      return;
    }
    const timer = setTimeout(() => {
      Animated.timing(progress, {
        toValue: active,
        duration: THINK_SWAP_MS,
        easing: RnEasing.inOut(RnEasing.ease),
        useNativeDriver: Platform.OS !== "web",
        isInteraction: false,
      }).start();
    }, THINK_GAP_MS);
    return () => clearTimeout(timer);
  }, [active, motion, progress]);

  const layer0 = {
    opacity: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
    }),
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -THINK_SWAP_Y],
        }),
      },
    ],
  };
  const layer1 = {
    opacity: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [THINK_SWAP_Y, 0],
        }),
      },
    ],
  };

  if (!motion) {
    return <View className={cn("shrink-0", className)}>{children[active]}</View>;
  }

  const sized =
    box.width > 0
      ? { width: box.width, height: box.height }
      : undefined;

  return (
    <View className={cn("shrink-0", className)}>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: "absolute", opacity: 0 }}
      >
        <View
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            mergeLayout(width, height);
          }}
        >
          {children[0]}
        </View>
        <View
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            mergeLayout(width, height);
          }}
        >
          {children[1]}
        </View>
      </View>
      <View className="relative justify-center overflow-hidden" style={sized}>
        <Animated.View
          className="absolute left-0 top-0"
          pointerEvents={active === 0 ? "auto" : "none"}
          style={layer0}
          accessibilityElementsHidden={active !== 0}
          importantForAccessibility={
            active === 0 ? "yes" : "no-hide-descendants"
          }
        >
          {children[0]}
        </Animated.View>
        <Animated.View
          className="absolute left-0 top-0"
          pointerEvents={active === 1 ? "auto" : "none"}
          style={layer1}
          accessibilityElementsHidden={active !== 1}
          importantForAccessibility={
            active === 1 ? "yes" : "no-hide-descendants"
          }
        >
          {children[1]}
        </Animated.View>
      </View>
    </View>
  );
}
