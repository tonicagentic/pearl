import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Pressable, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Ellipse, Path } from "react-native-svg";

import {
  DEFAULT_AGENT_MARK_ACCENT,
  DEFAULT_AGENT_MARK_SHAPE,
  DEFAULT_AGENT_MARK_TALK,
  type AgentMarkMotion,
  type AgentMarkShape,
  type AgentMarkTalk,
} from "../../../lib/custom-agents/mark";

/** Tall oval like Terrance/Phillip. */
const PEARL_HEIGHT_RATIO = 1.28;
const MOUTH_Y_RATIO = 0.62;
const EYE_COLOR = "#111111";
/** Closed mouth = small gap between halves (not a drawn line). */
const MOUTH_GAP_RATIO = 0.035;

type TalkProfile = {
  readonly topOpenDeg: number;
  readonly bottomOpenDeg: number;
  readonly topLift: number;
  readonly topTiltDeg: number;
};

function talkProfile(talk: AgentMarkTalk, size: number): TalkProfile {
  switch (talk) {
    case "lift":
      return {
        topOpenDeg: 0,
        bottomOpenDeg: 0,
        topLift: Math.max(4, Math.round(size * 0.16)),
        topTiltDeg: 4,
      };
    case "chatter":
      return {
        topOpenDeg: 8,
        bottomOpenDeg: 4,
        topLift: 0,
        topTiltDeg: 0,
      };
    case "hinge":
    default:
      return {
        topOpenDeg: 14,
        bottomOpenDeg: 7,
        topLift: 0,
        topTiltDeg: 0,
      };
  }
}

function idleSequence(talk: AgentMarkTalk) {
  if (talk === "chatter") {
    return withRepeat(
      withSequence(
        withTiming(1, {
          duration: 90,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(0.15, {
          duration: 80,
          easing: Easing.in(Easing.quad),
        }),
        withTiming(0.85, {
          duration: 70,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(0, {
          duration: 90,
          easing: Easing.in(Easing.quad),
        }),
        withTiming(0.7, {
          duration: 75,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(0, {
          duration: 100,
          easing: Easing.in(Easing.quad),
        }),
        withTiming(0, { duration: 900 }),
      ),
      -1,
      false,
    );
  }
  // hinge / lift — lazy talky rhythm.
  return withRepeat(
    withSequence(
      withTiming(1, {
        duration: 350,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(1, { duration: 220 }),
      withTiming(0.2, {
        duration: 400,
        easing: Easing.in(Easing.cubic),
      }),
      withTiming(0.75, {
        duration: 280,
        easing: Easing.out(Easing.quad),
      }),
      withTiming(0, {
        duration: 450,
        easing: Easing.inOut(Easing.quad),
      }),
      withTiming(0, { duration: 1800 }),
    ),
    -1,
    false,
  );
}

function burstSequence(talk: AgentMarkTalk, onDone: () => void) {
  if (talk === "chatter") {
    return withSequence(
      withTiming(1, {
        duration: 70,
        easing: Easing.out(Easing.quad),
      }),
      withTiming(0.2, {
        duration: 60,
        easing: Easing.in(Easing.quad),
      }),
      withTiming(0.9, {
        duration: 60,
        easing: Easing.out(Easing.quad),
      }),
      withTiming(
        0,
        {
          duration: 90,
          easing: Easing.in(Easing.quad),
        },
        (finished) => {
          if (finished) runOnJS(onDone)();
        },
      ),
    );
  }
  return withSequence(
    withTiming(1, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    }),
    withTiming(1, { duration: 80 }),
    withTiming(
      0,
      {
        duration: 220,
        easing: Easing.in(Easing.cubic),
      },
      (finished) => {
        if (finished) runOnJS(onDone)();
      },
    ),
  );
}

/** Layout size for a pearl mark at the given nominal `size` (includes flap room). */
export function pearlMarkMetrics(size: number): {
  readonly width: number;
  readonly height: number;
  readonly maxLift: number;
  readonly layoutHeight: number;
} {
  const width = size;
  const height = Math.round(size * PEARL_HEIGHT_RATIO);
  const maxLift = Math.max(3, Math.round(size * 0.22));
  return {
    width,
    height,
    maxLift,
    layoutHeight: height + maxLift,
  };
}

function halfPaths(
  shape: AgentMarkShape,
  width: number,
  height: number,
  topCut: number,
  bottomCut: number,
): { readonly top: string; readonly bottom: string } {
  const w = width;
  const h = height;

  switch (shape) {
    case "diamond": {
      const tipX = w / 2;
      const left = w * 0.08;
      const right = w * 0.92;
      const midL = w * 0.02;
      const midR = w * 0.98;
      return {
        top: `M ${tipX} 0 L ${right} ${topCut * 0.55} L ${midR} ${topCut} L ${midL} ${topCut} L ${left} ${topCut * 0.55} Z`,
        bottom: `M ${midL} ${bottomCut} L ${midR} ${bottomCut} L ${right} ${bottomCut + (h - bottomCut) * 0.55} L ${tipX} ${h} L ${left} ${bottomCut + (h - bottomCut) * 0.55} Z`,
      };
    }
    case "square": {
      const r = Math.max(2, w * 0.12);
      return {
        top: roundedTopRect(0, 0, w, topCut, r),
        bottom: roundedBottomRect(0, bottomCut, w, h - bottomCut, r),
      };
    }
    case "trap": {
      const topInset = w * 0.18;
      const botInset = w * 0.04;
      const topEdgeInset = topInset * 0.35;
      const botEdgeInset =
        topInset * 0.35 +
        ((botInset - topInset * 0.35) * bottomCut) / Math.max(h, 1);
      return {
        top: `M ${topInset} 0 L ${w - topInset} 0 L ${w - topEdgeInset} ${topCut} L ${topEdgeInset} ${topCut} Z`,
        bottom: `M ${botEdgeInset} ${bottomCut} L ${w - botEdgeInset} ${bottomCut} L ${w - botInset} ${h} L ${botInset} ${h} Z`,
      };
    }
    case "oval":
    default: {
      const rx = w / 2;
      const ry = h / 2;
      const cx = w / 2;
      const cy = h / 2;
      return {
        top: ovalTopPath(cx, cy, rx, ry, topCut),
        bottom: ovalBottomPath(cx, cy, rx, ry, bottomCut, h),
      };
    }
  }
}

function ovalTopPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  mouthY: number,
): string {
  const dy = mouthY - cy;
  const under = 1 - (dy * dy) / (ry * ry);
  const dx = under > 0 ? rx * Math.sqrt(under) : 0;
  const leftX = cx - dx;
  const rightX = cx + dx;
  const topY = cy - ry;
  return `M ${leftX} ${mouthY} Q ${cx - rx} ${(topY + mouthY) / 2} ${cx} ${topY} Q ${cx + rx} ${(topY + mouthY) / 2} ${rightX} ${mouthY} Z`;
}

function ovalBottomPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  mouthY: number,
  height: number,
): string {
  const dy = mouthY - cy;
  const under = 1 - (dy * dy) / (ry * ry);
  const dx = under > 0 ? rx * Math.sqrt(under) : 0;
  const leftX = cx - dx;
  const rightX = cx + dx;
  const botY = Math.min(height, cy + ry);
  return `M ${leftX} ${mouthY} L ${rightX} ${mouthY} Q ${cx + rx} ${(botY + mouthY) / 2} ${cx} ${botY} Q ${cx - rx} ${(botY + mouthY) / 2} ${leftX} ${mouthY} Z`;
}

function roundedTopRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  const rr = Math.min(r, w / 2, h);
  return `M ${x + rr} ${y} L ${x + w - rr} ${y} Q ${x + w} ${y} ${x + w} ${y + rr} L ${x + w} ${y + h} L ${x} ${y + h} L ${x} ${y + rr} Q ${x} ${y} ${x + rr} ${y} Z`;
}

function roundedBottomRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  const rr = Math.min(r, w / 2, h);
  return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h - rr} Q ${x + w} ${y + h} ${x + w - rr} ${y + h} L ${x + rr} ${y + h} Q ${x} ${y + h} ${x} ${y + h - rr} Z`;
}

/**
 * Accent-colored Canadian-style head mark: solid silhouette, mouth gap,
 * talk styles via `markTalk`. Idle loop only when `motion="idle"`.
 */
export function AgentMark({
  accent = DEFAULT_AGENT_MARK_ACCENT,
  size = 16,
  markShape = DEFAULT_AGENT_MARK_SHAPE,
  markTalk = DEFAULT_AGENT_MARK_TALK,
  motion = "burst",
}: {
  readonly accent?: string;
  readonly size?: number;
  readonly markShape?: AgentMarkShape;
  readonly markTalk?: AgentMarkTalk;
  readonly motion?: AgentMarkMotion;
}) {
  const { width, height, maxLift, layoutHeight } = pearlMarkMetrics(size);
  const mouthY = Math.round(height * MOUTH_Y_RATIO);
  const mouthGap = Math.max(1.5, Math.round(size * MOUTH_GAP_RATIO));
  const topCut = mouthY - mouthGap / 2;
  const bottomCut = mouthY + mouthGap / 2;
  const hingeX = Math.round(width * 0.12);
  const profile = talkProfile(markTalk, size);
  const paths = useMemo(
    () => halfPaths(markShape, width, height, topCut, bottomCut),
    [markShape, width, height, topCut, bottomCut],
  );

  const [reduceMotion, setReduceMotion] = useState(false);
  const [bursting, setBursting] = useState(false);
  const open = useSharedValue(0);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    cancelAnimation(open);
    open.value = 0;
    if (reduceMotion || motion === "off") {
      return;
    }
    if (motion === "idle") {
      open.value = idleSequence(markTalk);
      return () => {
        cancelAnimation(open);
        open.value = 0;
      };
    }
  }, [open, reduceMotion, motion, markTalk]);

  useEffect(() => {
    if (motion !== "burst" || reduceMotion || !bursting) return;
    open.value = burstSequence(markTalk, () => setBursting(false));
    return () => {
      cancelAnimation(open);
    };
  }, [bursting, markTalk, motion, open, reduceMotion]);

  const topStyle = useAnimatedStyle(() => {
    if (markTalk === "lift") {
      return {
        transform: [
          { translateY: -open.value * profile.topLift },
          {
            rotate: `${-open.value * profile.topTiltDeg}deg`,
          },
        ],
      };
    }
    return {
      transform: [
        { translateX: hingeX },
        { translateY: mouthY },
        { rotate: `${-open.value * profile.topOpenDeg}deg` },
        { translateX: -hingeX },
        { translateY: -mouthY },
      ],
    };
  });

  const bottomStyle = useAnimatedStyle(() => {
    if (markTalk === "lift") {
      return { transform: [] };
    }
    return {
      transform: [
        { translateX: hingeX },
        { translateY: mouthY },
        { rotate: `${open.value * profile.bottomOpenDeg}deg` },
        { translateX: -hingeX },
        { translateY: -mouthY },
      ],
    };
  });

  const mark = (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width,
        height: layoutHeight,
      }}
    >
      <View
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width,
          height: height + maxLift,
        }}
      >
        <Animated.View
          style={[
            {
              position: "absolute",
              left: 0,
              top: maxLift,
              width,
              height,
            },
            bottomStyle,
          ]}
        >
          <Svg width={width} height={height}>
            <Path d={paths.bottom} fill={accent} />
          </Svg>
        </Animated.View>

        <Animated.View
          style={[
            {
              position: "absolute",
              left: 0,
              top: maxLift,
              width,
              height,
            },
            topStyle,
          ]}
        >
          <Svg width={width} height={height}>
            <Path d={paths.top} fill={accent} />
            <Ellipse
              cx={width * 0.4}
              cy={topCut * 0.48}
              rx={Math.max(1.1, size * 0.045)}
              ry={Math.max(2.2, size * 0.09)}
              fill={EYE_COLOR}
            />
            <Ellipse
              cx={width * 0.6}
              cy={topCut * 0.48}
              rx={Math.max(1.1, size * 0.045)}
              ry={Math.max(2.2, size * 0.09)}
              fill={EYE_COLOR}
            />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );

  if (motion === "burst" && !reduceMotion) {
    return (
      <Pressable
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onPressIn={() => {
          if (!bursting) setBursting(true);
        }}
      >
        {mark}
      </Pressable>
    );
  }

  return mark;
}

/**
 * List subtitle for an agent row: prefer chat title when it differs from the
 * name; otherwise first line of instructions; otherwise null.
 */
export function agentListSubtitle(input: {
  readonly name: string;
  readonly chatTitle?: string | null;
  readonly instructions?: string | null;
}): string | null {
  const name = input.name.trim();
  const title = (input.chatTitle ?? "").trim();
  if (title && title.toLowerCase() !== name.toLowerCase()) {
    return title;
  }
  const instructions = (input.instructions ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return instructions || null;
}
