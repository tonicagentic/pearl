"use client";

import { useEffect, useId, useState } from "react";

import {
  DEFAULT_AGENT_MARK_ACCENT,
  DEFAULT_AGENT_MARK_BROWS,
  DEFAULT_AGENT_MARK_GAZE,
  DEFAULT_AGENT_MARK_HEIGHT_RATIO,
  DEFAULT_AGENT_MARK_SHAPE,
  DEFAULT_AGENT_MARK_TALK,
  markEyeColor,
  type AgentMarkBrows,
  type AgentMarkGaze,
  type AgentMarkMotion,
  type AgentMarkShape,
  type AgentMarkTalk,
} from "@/lib/custom-agents/mark";
import { cn } from "@/lib/utils";

const MOUTH_Y_RATIO = 0.62;
const MOUTH_GAP_RATIO = 0.035;

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
): string {
  const dx = ovalMouthDx(cx, cy, rx, ry, mouthY);
  const leftX = cx - dx;
  const rightX = cx + dx;
  // Chord, then right → left, small-arc + clockwise = through the bottom pole.
  return `M ${leftX} ${mouthY} L ${rightX} ${mouthY} A ${rx} ${ry} 0 0 1 ${leftX} ${mouthY} Z`;
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
        top: `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${topCut} L 0 ${topCut} L 0 ${r} Q 0 0 ${r} 0 Z`,
        bottom: `M 0 ${bottomCut} L ${w} ${bottomCut} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} Z`,
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
        bottom: ovalBottomPath(cx, cy, rx, ry, bottomCut),
      };
    }
  }
}

const STATIC_JAW = `0%, 100% { transform: none; }`;

function bounceLiftPx(talk: AgentMarkTalk, width: number): number {
  switch (talk) {
    case "lift":
      return Math.max(4, Math.round(width * 0.16));
    case "chatter":
      return Math.max(3, Math.round(width * 0.08));
    case "hinge":
    default:
      return 0;
  }
}

/** Hinge = V-tilt about a fixed fulcrum; lift/chatter = crown bounce. Jaw static. */
function talkKeyframes(
  talk: AgentMarkTalk,
  width: number,
): { readonly crown: string; readonly jaw: string; readonly duration: string } {
  const liftPx = bounceLiftPx(talk, width);
  switch (talk) {
    case "lift":
      return {
        crown: `
          0%, 55%, 100% { transform: translateY(0) rotate(0deg); }
          12%, 18% { transform: translateY(-${liftPx}px) rotate(-4deg); }
          28% { transform: translateY(-${Math.round(liftPx * 0.2)}px) rotate(-1deg); }
          36% { transform: translateY(-${Math.round(liftPx * 0.7)}px) rotate(-3deg); }
        `,
        jaw: STATIC_JAW,
        duration: "3.2s",
      };
    case "chatter":
      return {
        crown: `
          0%, 70%, 100% { transform: translateY(0); }
          8% { transform: translateY(-${liftPx}px); }
          14% { transform: translateY(-${Math.round(liftPx * 0.15)}px); }
          20% { transform: translateY(-${Math.round(liftPx * 0.85)}px); }
          26% { transform: translateY(0); }
          32% { transform: translateY(-${Math.round(liftPx * 0.55)}px); }
          38% { transform: translateY(0); }
        `,
        jaw: STATIC_JAW,
        duration: "1.6s",
      };
    case "hinge":
    default:
      return {
        crown: `
          0%, 55%, 100% { transform: rotate(0deg); }
          12%, 18% { transform: rotate(-16deg); }
          28% { transform: rotate(-4deg); }
          36% { transform: rotate(-12deg); }
        `,
        jaw: STATIC_JAW,
        duration: "3.2s",
      };
  }
}

function burstKeyframes(
  talk: AgentMarkTalk,
  width: number,
): { readonly crown: string; readonly jaw: string; readonly duration: string } {
  const liftPx = bounceLiftPx(talk, width);
  switch (talk) {
    case "lift":
      return {
        crown: `
          0% { transform: translateY(0) rotate(0deg); }
          40% { transform: translateY(-${liftPx}px) rotate(-4deg); }
          100% { transform: translateY(0) rotate(0deg); }
        `,
        jaw: STATIC_JAW,
        duration: "0.45s",
      };
    case "chatter":
      return {
        crown: `
          0% { transform: translateY(0); }
          25% { transform: translateY(-${liftPx}px); }
          45% { transform: translateY(-${Math.round(liftPx * 0.15)}px); }
          65% { transform: translateY(-${Math.round(liftPx * 0.85)}px); }
          100% { transform: translateY(0); }
        `,
        jaw: STATIC_JAW,
        duration: "0.35s",
      };
    case "hinge":
    default:
      return {
        crown: `
          0% { transform: rotate(0deg); }
          40% { transform: rotate(-16deg); }
          100% { transform: rotate(0deg); }
        `,
        jaw: STATIC_JAW,
        duration: "0.45s",
      };
  }
}

export type AgentMarkEyeMotion = "idle" | "off";

/** Solid Canadian-style head mark (Terrance/Phillip default). */
export function AgentAccentMark({
  accent = DEFAULT_AGENT_MARK_ACCENT,
  markShape = DEFAULT_AGENT_MARK_SHAPE,
  markTalk = DEFAULT_AGENT_MARK_TALK,
  markBrows = DEFAULT_AGENT_MARK_BROWS,
  markGaze = DEFAULT_AGENT_MARK_GAZE,
  motion = "burst",
  eyeMotion = "off",
  className,
  size = "sm",
  heightRatio = DEFAULT_AGENT_MARK_HEIGHT_RATIO,
}: {
  readonly accent?: string;
  readonly markShape?: AgentMarkShape;
  readonly markTalk?: AgentMarkTalk;
  readonly markBrows?: AgentMarkBrows;
  readonly markGaze?: AgentMarkGaze;
  readonly motion?: AgentMarkMotion;
  readonly eyeMotion?: AgentMarkEyeMotion;
  readonly className?: string;
  readonly size?: "sm" | "md" | "lg";
  /** Height / width. Built-in Pearl uses 1 (circle). */
  readonly heightRatio?: number;
}) {
  const reactId = useId().replace(/:/g, "");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [bursting, setBursting] = useState(false);
  const [eyesClosed, setEyesClosed] = useState(false);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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

  const width = size === "lg" ? 56 : size === "md" ? 24 : 16;
  const height = Math.round(width * heightRatio);
  const maxLift = Math.max(3, Math.round(width * 0.22));
  const layoutHeight = height + maxLift;
  const mouthY = Math.round(height * MOUTH_Y_RATIO);
  const mouthGap = Math.max(1.5, Math.round(width * MOUTH_GAP_RATIO));
  const topCut = mouthY - mouthGap / 2;
  const bottomCut = mouthY + mouthGap / 2;
  // Fulcrum = left mouth corner on the silhouette (fixed while opening).
  const hingeX = (() => {
    const cy = height / 2;
    const ry = height / 2;
    const rx = width / 2;
    const dy = topCut - cy;
    const under = 1 - (dy * dy) / (ry * ry);
    const dx = under > 0 ? rx * Math.sqrt(under) : 0;
    return Math.round(width / 2 - dx);
  })();
  const eyeColor = markEyeColor(accent);
  const eyeBaseL = width * 0.4;
  const eyeBaseR = width * 0.6;
  const eyeBaseY = maxLift + topCut * 0.48;
  const eyeR = Math.max(1.4, width * 0.055);
  const gazePad = Math.max(1.5, width * 0.04);
  const closedHalf = Math.max(2.2, width * 0.07);
  const closedStroke = Math.max(1.2, width * 0.028);
  const browY = eyeBaseY - Math.max(3, width * 0.09);
  const browHalf = Math.max(2.5, width * 0.08);
  const browStroke = Math.max(1.1, width * 0.025);
  const isHinge = markTalk === "hinge";

  useEffect(() => {
    if (eyeMotion !== "idle" || markGaze !== "wander" || reduceMotion) {
      setGaze({ x: 0, y: 0 });
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (cancelled) return;
      timer = setTimeout(() => {
        if (cancelled) return;
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * gazePad;
        setGaze({
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist * 0.65,
        });
        schedule();
      }, 900 + Math.random() * 2200);
    };
    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      setGaze({ x: 0, y: 0 });
    };
  }, [eyeMotion, markGaze, reduceMotion, gazePad]);

  const eyeCxL = eyeBaseL + gaze.x;
  const eyeCxR = eyeBaseR + gaze.x;
  const eyeCy = eyeBaseY + gaze.y;
  const isOval = markShape === "oval";
  const paths = isOval
    ? { top: "", bottom: "" }
    : halfPaths(markShape, width, height, topCut, bottomCut);
  const canAnimate = !reduceMotion && motion !== "off";
  const idleActive = canAnimate && motion === "idle";
  const burstActive = canAnimate && motion === "burst" && bursting;
  const crownClass = `pearl-crown-${reactId}`;
  const jawClass = `pearl-jaw-${reactId}`;
  const topClipId = `pearl-top-${reactId}`;
  const bottomClipId = `pearl-bot-${reactId}`;
  const animating = idleActive || burstActive;
  const frames = idleActive
    ? talkKeyframes(markTalk, width)
    : burstKeyframes(markTalk, width);

  return (
    <span
      aria-hidden
      className={cn("relative inline-block shrink-0", className)}
      style={{ width, height: layoutHeight }}
      onMouseEnter={() => {
        if (motion === "burst" && canAnimate && !bursting) {
          setBursting(true);
        }
      }}
      onAnimationEnd={() => {
        if (bursting) setBursting(false);
      }}
    >
      <span
        className="absolute inset-x-0 bottom-0"
        style={{ height: height + maxLift }}
      >
        <svg
          width={width}
          height={height + maxLift}
          viewBox={`0 0 ${width} ${height + maxLift}`}
          className="overflow-visible"
        >
          {isOval ? (
            <defs>
              <clipPath id={topClipId}>
                <rect x={0} y={maxLift} width={width} height={topCut} />
              </clipPath>
              <clipPath id={bottomClipId}>
                <rect
                  x={0}
                  y={maxLift + bottomCut}
                  width={width}
                  height={Math.max(0, height - bottomCut)}
                />
              </clipPath>
            </defs>
          ) : null}
          <g className={animating ? jawClass : undefined}>
            {isOval ? (
              <ellipse
                cx={width / 2}
                cy={maxLift + height / 2}
                rx={width / 2}
                ry={height / 2}
                fill={accent}
                clipPath={`url(#${bottomClipId})`}
              />
            ) : (
              <path
                d={paths.bottom}
                fill={accent}
                transform={`translate(0 ${maxLift})`}
              />
            )}
          </g>
          <g
            className={animating ? crownClass : undefined}
            style={{
              transformOrigin: isHinge
                ? `${hingeX}px ${maxLift + topCut}px`
                : `${width / 2}px ${maxLift + topCut}px`,
            }}
          >
            {isOval ? (
              <ellipse
                cx={width / 2}
                cy={maxLift + height / 2}
                rx={width / 2}
                ry={height / 2}
                fill={accent}
                clipPath={`url(#${topClipId})`}
              />
            ) : (
              <path
                d={paths.top}
                fill={accent}
                transform={`translate(0 ${maxLift})`}
              />
            )}
            {markBrows === "line" ? (
              <>
                <line
                  x1={eyeCxL - browHalf}
                  y1={browY + gaze.y * 0.3}
                  x2={eyeCxL + browHalf}
                  y2={browY + gaze.y * 0.3}
                  stroke={eyeColor}
                  strokeWidth={browStroke}
                  strokeLinecap="round"
                />
                <line
                  x1={eyeCxR - browHalf}
                  y1={browY + gaze.y * 0.3}
                  x2={eyeCxR + browHalf}
                  y2={browY + gaze.y * 0.3}
                  stroke={eyeColor}
                  strokeWidth={browStroke}
                  strokeLinecap="round"
                />
              </>
            ) : null}
            {eyesClosed ? (
              <>
                <line
                  x1={eyeCxL - closedHalf}
                  y1={eyeCy}
                  x2={eyeCxL + closedHalf}
                  y2={eyeCy}
                  stroke={eyeColor}
                  strokeWidth={closedStroke}
                  strokeLinecap="round"
                />
                <line
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
                <ellipse
                  cx={eyeCxL}
                  cy={eyeCy}
                  rx={eyeR}
                  ry={eyeR}
                  fill={eyeColor}
                />
                <ellipse
                  cx={eyeCxR}
                  cy={eyeCy}
                  rx={eyeR}
                  ry={eyeR}
                  fill={eyeColor}
                />
              </>
            )}
          </g>
        </svg>
      </span>
      {animating ? (
        <style>{`
          @keyframes pearl-crown-kf-${reactId} {
            ${frames.crown}
          }
          @keyframes pearl-jaw-kf-${reactId} {
            ${frames.jaw}
          }
          .${crownClass} {
            animation: pearl-crown-kf-${reactId} ${frames.duration} ease-in-out ${idleActive ? "infinite" : "1"};
          }
          .${jawClass} {
            animation: pearl-jaw-kf-${reactId} ${frames.duration} ease-in-out ${idleActive ? "infinite" : "1"};
          }
        `}</style>
      ) : null}
    </span>
  );
}

/**
 * Grok-style attachment pill: accent mark + agent name. Replaces the
 * Computer toolbar control on custom-agent threads.
 */
export function AgentIdentityPill({
  name,
  accent = DEFAULT_AGENT_MARK_ACCENT,
  markShape = DEFAULT_AGENT_MARK_SHAPE,
  markTalk = DEFAULT_AGENT_MARK_TALK,
  markBrows = DEFAULT_AGENT_MARK_BROWS,
  markGaze = DEFAULT_AGENT_MARK_GAZE,
  motion = "idle",
  heightRatio = DEFAULT_AGENT_MARK_HEIGHT_RATIO,
  className,
  onClick,
}: {
  readonly name: string;
  readonly accent?: string;
  readonly markShape?: AgentMarkShape;
  readonly markTalk?: AgentMarkTalk;
  readonly markBrows?: AgentMarkBrows;
  readonly markGaze?: AgentMarkGaze;
  readonly motion?: AgentMarkMotion;
  readonly heightRatio?: number;
  readonly className?: string;
  readonly onClick?: () => void;
}) {
  const label = name.trim() || "Agent";
  const shared = cn(
    "inline-flex h-8 max-w-[12rem] items-center gap-1.5 rounded-full border border-border bg-muted/40 px-1.5 pr-2.5 text-xs font-medium text-foreground transition-colors",
    onClick ? "hover:bg-muted/70" : null,
    className,
  );

  const body = (
    <>
      <AgentAccentMark
        accent={accent}
        markShape={markShape}
        markTalk={markTalk}
        markBrows={markBrows}
        markGaze={markGaze}
        motion={motion}
        heightRatio={heightRatio}
      />
      <span className="min-w-0 truncate">{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        aria-label={`${label} settings`}
        className={shared}
        onClick={onClick}
        type="button"
      >
        {body}
      </button>
    );
  }

  return <span className={shared}>{body}</span>;
}
