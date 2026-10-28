import { cn } from "@/lib/utils";
import {
  type FC,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Text,
  View,
  type TextProps,
  type TextStyle,
} from "react-native";

export const paper = "bg-background border border-border/60 dark:bg-card";

export const field = "bg-foreground/5 dark:bg-foreground/10";

export const inkButton = "bg-foreground active:opacity-90";

export const mono = "text-[11px] tracking-tight";

/** Shared thread type scale: body and meta stay the same size. */
export const threadText = "text-[15px] leading-6";

/** Thinking, tool, and timeline chrome — same size as body, quieter color. */
export const threadMeta = `${threadText} text-muted-foreground`;

export const threadDiffAdd = "text-emerald-600 dark:text-emerald-400";
export const threadDiffRemove = "text-red-600 dark:text-red-400";


export const textButtonHitSlop = { top: 12, bottom: 12 };

// Live regions only exist on Android and the web; announceForAccessibility covers iOS and Android and is a no-op on the web.
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

// Uniwind resolves class to prop mappings and CSS variables through the CSSOM, which a static web export renders without, and React hydration never patches the resulting attribute or style mismatch. A value that comes from the CSSOM therefore applies from the first render after hydration; a client-only render is hydrated from its first render.
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
      // react-native-web returns nothing when the environment has no matchMedia.
      reduceMotionSubscription?.remove();
      reduceMotionSubscription = undefined;
      reduceMotion = undefined;
    }
  };
};

const getMotion = () => reduceMotion === false;

export const useMotion = () =>
  useSyncExternalStore(subscribeMotion, getMotion, getMotion);

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

export const ShimmerLabel: FC<TextProps & { active?: boolean }> = ({
  active = true,
  className,
  ...props
}) => {
  const opacity = usePulse(active);

  return (
    <Animated.View style={{ opacity }}>
      <Text className={cn("aui-shimmer-label", className)} {...props} />
    </Animated.View>
  );
};

/** Thinking-states timing: status line swaps with a short opacity + Y crossfade. */
export const THINK_SWAP_MS = 150;
export const THINK_SWAP_Y = 6;

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

  useEffect(() => {
    if (!motion) {
      progress.setValue(active);
      return;
    }
    Animated.timing(progress, {
      toValue: active,
      duration: THINK_SWAP_MS,
      useNativeDriver: Platform.OS !== "web",
      isInteraction: false,
    }).start();
  }, [active, motion, progress]);

  // Crossfade both layers (web SwapLabel measures width; RN overlaps and fades).
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
    return <View className={className}>{children[active]}</View>;
  }

  return (
    <View className={cn("relative justify-center", className)}>
      {/* Invisible sizer: both labels occupy the same cell so width/height stay stable. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="opacity-0"
      >
        <View>{children[0]}</View>
        <View className="absolute left-0 top-0">{children[1]}</View>
      </View>
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
  );
}
