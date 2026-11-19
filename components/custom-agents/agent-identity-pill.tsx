"use client";

import { useEffect, useId, useState } from "react";

import {
  DEFAULT_AGENT_MARK_ACCENT,
  DEFAULT_AGENT_MARK_HEIGHT_RATIO,
  DEFAULT_AGENT_MARK_SHAPE,
  DEFAULT_AGENT_MARK_TALK,
  markEyeColor,
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

function talkKeyframes(
  talk: AgentMarkTalk,
  width: number,
): { readonly crown: string; readonly jaw: string; readonly duration: string } {
  const liftPx = Math.max(4, Math.round(width * 0.16));
  switch (talk) {
    case "lift":
      return {
        crown: `
          0%, 55%, 100% { transform: translateY(0) rotate(0deg); }
          12%, 18% { transform: translateY(-${liftPx}px) rotate(-4deg); }
          28% { transform: translateY(-${Math.round(liftPx * 0.2)}px) rotate(-1deg); }
          36% { transform: translateY(-${Math.round(liftPx * 0.7)}px) rotate(-3deg); }
        `,
        jaw: `
          0%, 100% { transform: none; }
        `,
        duration: "3.2s",
      };
    case "chatter":
      return {
        crown: `
          0%, 70%, 100% { transform: rotate(0deg); }
          8% { transform: rotate(-8deg); }
          14% { transform: rotate(-1deg); }
          20% { transform: rotate(-7deg); }
          26% { transform: rotate(0deg); }
          32% { transform: rotate(-5deg); }
          38% { transform: rotate(0deg); }
        `,
        jaw: `
          0%, 70%, 100% { transform: rotate(0deg); }
          8% { transform: rotate(4deg); }
          14% { transform: rotate(0.5deg); }
          20% { transform: rotate(3.5deg); }
          26% { transform: rotate(0deg); }
          32% { transform: rotate(2.5deg); }
          38% { transform: rotate(0deg); }
        `,
        duration: "1.6s",
      };
    case "hinge":
    default:
      return {
        crown: `
          0%, 55%, 100% { transform: rotate(0deg); }
          12%, 18% { transform: rotate(-12deg); }
          28% { transform: rotate(-3deg); }
          36% { transform: rotate(-9deg); }
        `,
        jaw: `
          0%, 55%, 100% { transform: rotate(0deg); }
          12%, 18% { transform: rotate(6deg); }
          28% { transform: rotate(1deg); }
          36% { transform: rotate(4deg); }
        `,
        duration: "3.2s",
      };
  }
}

function burstKeyframes(
  talk: AgentMarkTalk,
  width: number,
): { readonly crown: string; readonly jaw: string; readonly duration: string } {
  const liftPx = Math.max(4, Math.round(width * 0.16));
  switch (talk) {
    case "lift":
      return {
        crown: `
          0% { transform: translateY(0) rotate(0deg); }
          40% { transform: translateY(-${liftPx}px) rotate(-4deg); }
          100% { transform: translateY(0) rotate(0deg); }
        `,
        jaw: `0%, 100% { transform: none; }`,
        duration: "0.45s",
      };
    case "chatter":
      return {
        crown: `
          0% { transform: rotate(0deg); }
          25% { transform: rotate(-8deg); }
          45% { transform: rotate(-1deg); }
          65% { transform: rotate(-7deg); }
          100% { transform: rotate(0deg); }
        `,
        jaw: `
          0% { transform: rotate(0deg); }
          25% { transform: rotate(4deg); }
          45% { transform: rotate(0.5deg); }
          65% { transform: rotate(3.5deg); }
          100% { transform: rotate(0deg); }
        `,
        duration: "0.35s",
      };
    case "hinge":
    default:
      return {
        crown: `
          0% { transform: rotate(0deg); }
          40% { transform: rotate(-12deg); }
          100% { transform: rotate(0deg); }
        `,
        jaw: `
          0% { transform: rotate(0deg); }
          40% { transform: rotate(6deg); }
          100% { transform: rotate(0deg); }
        `,
        duration: "0.45s",
      };
  }
}

/** Solid Canadian-style head mark (Terrance/Phillip default). */
export function AgentAccentMark({
  accent = DEFAULT_AGENT_MARK_ACCENT,
  markShape = DEFAULT_AGENT_MARK_SHAPE,
  markTalk = DEFAULT_AGENT_MARK_TALK,
  motion = "burst",
  className,
  size = "sm",
  heightRatio = DEFAULT_AGENT_MARK_HEIGHT_RATIO,
}: {
  readonly accent?: string;
  readonly markShape?: AgentMarkShape;
  readonly markTalk?: AgentMarkTalk;
  readonly motion?: AgentMarkMotion;
  readonly className?: string;
  readonly size?: "sm" | "md" | "lg";
  /** Height / width. Built-in Pearl uses a rounder ratio (~1.05). */
  readonly heightRatio?: number;
}) {
  const reactId = useId().replace(/:/g, "");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [bursting, setBursting] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const width = size === "lg" ? 56 : size === "md" ? 24 : 16;
  const height = Math.round(width * heightRatio);
  const maxLift = Math.max(3, Math.round(width * 0.22));
  const layoutHeight = height + maxLift;
  const mouthY = Math.round(height * MOUTH_Y_RATIO);
  const mouthGap = Math.max(1.5, Math.round(width * MOUTH_GAP_RATIO));
  const topCut = mouthY - mouthGap / 2;
  const bottomCut = mouthY + mouthGap / 2;
  const hingeX = Math.round(width * 0.12);
  const eyeColor = markEyeColor(accent);
  const eyeRx = Math.max(1.1, width * 0.045);
  const eyeRy = Math.max(2.2, width * 0.09);
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
          <g
            className={animating ? jawClass : undefined}
            style={{
              transformOrigin: `${hingeX}px ${mouthY + maxLift}px`,
            }}
          >
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
              transformOrigin: `${hingeX}px ${mouthY + maxLift}px`,
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
            <ellipse
              cx={width * 0.4}
              cy={maxLift + topCut * 0.48}
              rx={eyeRx}
              ry={eyeRy}
              fill={eyeColor}
            />
            <ellipse
              cx={width * 0.6}
              cy={maxLift + topCut * 0.48}
              rx={eyeRx}
              ry={eyeRy}
              fill={eyeColor}
            />
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
  motion = "idle",
  heightRatio = DEFAULT_AGENT_MARK_HEIGHT_RATIO,
  className,
  onClick,
}: {
  readonly name: string;
  readonly accent?: string;
  readonly markShape?: AgentMarkShape;
  readonly markTalk?: AgentMarkTalk;
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
