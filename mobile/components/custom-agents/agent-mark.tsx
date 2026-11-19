import { useEffect, useId, useMemo, useState } from "react";
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
import Svg, {
  ClipPath,
  Defs,
  Ellipse,
  Line,
  Path,
  Rect,
} from "react-native-svg";

import {
  DEFAULT_AGENT_MARK_ACCENT,
  DEFAULT_AGENT_MARK_HEIGHT_RATIO,
  DEFAULT_AGENT_MARK_SHAPE,
  DEFAULT_AGENT_MARK_TALK,
  markEyeColor,
  type AgentMarkMotion,
  type AgentMarkShape,
  type AgentMarkTalk,
} from "../../../lib/custom-agents/mark";

const MOUTH_Y_RATIO = 0.62;
/** Closed mouth = small gap between halves (not a drawn line). */
const MOUTH_GAP_RATIO = 0.035;

/** Presentation-only eye idle. Default off outside home. */
export type AgentMarkEyeMotion = "idle" | "off";

type TalkProfile = {
  readonly topLift: number;
  readonly topTiltDeg: number;
};

/** All talk styles: crown bounces up; jaw stays static. */
function talkProfile(talk: AgentMarkTalk, size: number): TalkProfile {
  switch (talk) {
    case "lift":
      return {
        topLift: Math.max(4, Math.round(size * 0.16)),
        topTiltDeg: 4,
      };
    case "chatter":
      return {
        topLift: Math.max(3, Math.round(size * 0.08)),
        topTiltDeg: 0,
      };
    case "hinge":
    default:
      return {
        topLift: Math.max(5, Math.round(size * 0.18)),
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
export function pearlMarkMetrics(
  size: number,
  heightRatio: number = DEFAULT_AGENT_MARK_HEIGHT_RATIO,
): {
  readonly width: number;
  readonly height: number;
  readonly maxLift: number;
  readonly layoutHeight: number;
} {
  const width = size;
  const height = Math.round(size * heightRatio);
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

function ovalMouthDx(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  mouthY: number,
): number {
  const dy = mouthY - cy;
  const under = 1 - (dy * dy) / (ry * ry);
  return under > 0 ? rx * Math.sqrt(under) : 0;
}

/** Exact ellipse halves via SVG arcs (no polyline / quadratic pinch at poles). */
function ovalTopPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  mouthY: number,
): string {
  const dx = ovalMouthDx(cx, cy, rx, ry, mouthY);
  const leftX = cx - dx;
  const rightX = cx + dx;
  // Left → right, large-arc + clockwise = through the top pole.
  return `M ${leftX} ${mouthY} A ${rx} ${ry} 0 1 1 ${rightX} ${mouthY} Z`;
}

function ovalBottomPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  mouthY: number,
  _height: number,
): string {
  const dx = ovalMouthDx(cx, cy, rx, ry, mouthY);
  const leftX = cx - dx;
  const rightX = cx + dx;
  // Chord, then right → left, small-arc + clockwise = through the bottom pole.
  return `M ${leftX} ${mouthY} L ${rightX} ${mouthY} A ${rx} ${ry} 0 0 1 ${leftX} ${mouthY} Z`;
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
 * talk styles via `markTalk` (crown bounce). Idle blink when `eyeMotion="idle"`.
 */
export function AgentMark({
  accent = DEFAULT_AGENT_MARK_ACCENT,
  size = 16,
  markShape = DEFAULT_AGENT_MARK_SHAPE,
  markTalk = DEFAULT_AGENT_MARK_TALK,
  motion = "burst",
  eyeMotion = "off",
  heightRatio = DEFAULT_AGENT_MARK_HEIGHT_RATIO,
}: {
  readonly accent?: string;
  readonly size?: number;
  readonly markShape?: AgentMarkShape;
  readonly markTalk?: AgentMarkTalk;
  readonly motion?: AgentMarkMotion;
  readonly eyeMotion?: AgentMarkEyeMotion;
  /** Height / width. Built-in Pearl uses 1 (circle). */
  readonly heightRatio?: number;
}) {
  const { width, height, maxLift, layoutHeight } = pearlMarkMetrics(
    size,
    heightRatio,
  );
  const mouthY = Math.round(height * MOUTH_Y_RATIO);
  const mouthGap = Math.max(1.5, Math.round(size * MOUTH_GAP_RATIO));
  const topCut = mouthY - mouthGap / 2;
  const bottomCut = mouthY + mouthGap / 2;
  const profile = talkProfile(markTalk, size);
  const eyeColor = markEyeColor(accent);
  const eyeCxL = width * 0.4;
  const eyeCxR = width * 0.6;
  const eyeCy = topCut * 0.48;
  const eyeRx = Math.max(1.1, size * 0.045);
  const eyeRy = Math.max(2.2, size * 0.09);
  const closedHalf = Math.max(2.2, size * 0.07);
  const closedStroke = Math.max(1.2, size * 0.028);
  const clipUid = useId().replace(/:/g, "");
  const topClipId = `mark-top-${clipUid}`;
  const bottomClipId = `mark-bot-${clipUid}`;
  const isOval = markShape === "oval";
  const paths = useMemo(
    () =>
      isOval
        ? { top: "", bottom: "" }
        : halfPaths(markShape, width, height, topCut, bottomCut),
    [isOval, markShape, width, height, topCut, bottomCut],
  );

  const [reduceMotion, setReduceMotion] = useState(false);
  const [bursting, setBursting] = useState(false);
  const [eyesClosed, setEyesClosed] = useState(false);
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

  useEffect(() => {
    if (eyeMotion !== "idle" || reduceMotion) {
      setEyesClosed(false);
      return;
    }
    let cancelled = false;
    let waitTimer: ReturnType<typeof setTimeout> | undefined;
    let blinkTimers: ReturnType<typeof setTimeout>[] = [];

    const clearBlinkTimers = () => {
      for (const t of blinkTimers) clearTimeout(t);
      blinkTimers = [];
    };

    const scheduleNext = () => {
      if (cancelled) return;
      const delay = 2500 + Math.random() * 3500;
      waitTimer = setTimeout(() => {
        if (cancelled) return;
        const doubleBlink = Math.random() < 0.28;
        setEyesClosed(true);
        blinkTimers.push(
          setTimeout(() => {
            if (cancelled) return;
            setEyesClosed(false);
            if (!doubleBlink) {
              scheduleNext();
              return;
            }
            blinkTimers.push(
              setTimeout(() => {
                if (cancelled) return;
                setEyesClosed(true);
                blinkTimers.push(
                  setTimeout(() => {
                    if (cancelled) return;
                    setEyesClosed(false);
                    scheduleNext();
                  }, 90),
                );
              }, 120),
            );
          }, 100),
        );
      }, delay);
    };

    scheduleNext();
    return () => {
      cancelled = true;
      if (waitTimer) clearTimeout(waitTimer);
      clearBlinkTimers();
      setEyesClosed(false);
    };
  }, [eyeMotion, reduceMotion]);

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -open.value * profile.topLift },
      { rotate: `${-open.value * profile.topTiltDeg}deg` },
    ],
  }));

  const bottomStyle = useAnimatedStyle(() => ({ transform: [] }));

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
            {isOval ? (
              <>
                <Defs>
                  <ClipPath id={bottomClipId}>
                    <Rect
                      x={0}
                      y={bottomCut}
                      width={width}
                      height={Math.max(0, height - bottomCut)}
                    />
                  </ClipPath>
                </Defs>
                <Ellipse
                  cx={width / 2}
                  cy={height / 2}
                  rx={width / 2}
                  ry={height / 2}
                  fill={accent}
                  clipPath={`url(#${bottomClipId})`}
                />
              </>
            ) : (
              <Path d={paths.bottom} fill={accent} />
            )}
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
            {isOval ? (
              <>
                <Defs>
                  <ClipPath id={topClipId}>
                    <Rect x={0} y={0} width={width} height={topCut} />
                  </ClipPath>
                </Defs>
                <Ellipse
                  cx={width / 2}
                  cy={height / 2}
                  rx={width / 2}
                  ry={height / 2}
                  fill={accent}
                  clipPath={`url(#${topClipId})`}
                />
              </>
            ) : (
              <Path d={paths.top} fill={accent} />
            )}
            {eyesClosed ? (
              <>
                <Line
                  x1={eyeCxL - closedHalf}
                  y1={eyeCy}
                  x2={eyeCxL + closedHalf}
                  y2={eyeCy}
                  stroke={eyeColor}
                  strokeWidth={closedStroke}
                  strokeLinecap="round"
                />
                <Line
                  x1={eyeCxR - closedHalf}
                  y1={eyeCy}
                  x2={eyeCxR + closedHalf}
                  y2={eyeCy}
                  stroke={eyeColor}
                  strokeWidth={closedStroke}
                  strokeLinecap="round"
                />
              </>
            ) : (
              <>
                <Ellipse
                  cx={eyeCxL}
                  cy={eyeCy}
                  rx={eyeRx}
                  ry={eyeRy}
                  fill={eyeColor}
                />
                <Ellipse
                  cx={eyeCxR}
                  cy={eyeCy}
                  rx={eyeRx}
                  ry={eyeRy}
                  fill={eyeColor}
                />
              </>
            )}
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
