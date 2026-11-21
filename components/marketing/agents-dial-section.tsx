"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AgentAccentMark } from "@/components/custom-agents/agent-identity-pill";
import {
  MARKETPLACE_EXAMPLES,
  type MarketplaceExample,
} from "@/components/marketing/marketplace-examples";
import { marketingType } from "@/components/marketing/type";
import {
  lerp,
  smoothstep,
  useScrollProgress,
} from "@/components/marketing/use-scroll-progress";
import { usePrefersReducedMotion } from "@/components/marketing/use-prefers-reduced-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Seven agents on a ±100° arc (Wajo spacing). */
const DIAL_AGENTS: readonly MarketplaceExample[] =
  MARKETPLACE_EXAMPLES.slice(0, 7);

const ANGLE_SPAN = 100;
const FAN_FROM = 0.34;
const SCALE_ARRIVE_FROM = 0.7;
const SCALE_ARRIVE_TO = 0.9;
const TURN_DEG = 24;
const ROTATE_FACTOR = 0.7;
const HUB_FACTOR = 0.5;

function dialAngles(count: number): number[] {
  if (count <= 1) return [0];
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return -ANGLE_SPAN + t * ANGLE_SPAN * 2;
  });
}

function polar(angleDeg: number, radius: number, hub: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: Math.sin(rad) * radius,
    y: hub - Math.cos(rad) * radius,
  };
}

function cardRotate(angleDeg: number) {
  const normalized = ((((angleDeg + 180) % 360) + 360) % 360) - 180;
  return normalized * ROTATE_FACTOR;
}

function AgentDialCard({
  example,
  angle,
  fan,
  turn,
  scale,
  radius,
}: {
  readonly example: MarketplaceExample;
  readonly angle: number;
  readonly fan: number;
  readonly turn: number;
  readonly scale: number;
  readonly radius: number;
}) {
  const theta = angle * fan + turn;
  const hub = radius * HUB_FACTOR;
  const { x, y } = polar(theta, radius, hub);
  const rotate = cardRotate(theta);

  return (
    <div
      className="absolute top-1/2 left-1/2 size-0"
      style={{
        transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`,
      }}
    >
      <article
        className="flex h-[200px] w-[180px] -translate-x-1/2 -translate-y-1/2 flex-col items-start justify-between rounded-3xl border border-border bg-card p-5 shadow-sm transition-[box-shadow] duration-200 ease-out hover:shadow-md sm:h-[220px] sm:w-[200px]"
        style={{
          transform: `rotate(${rotate.toFixed(2)}deg) scale(${scale.toFixed(3)})`,
        }}
      >
        <span className="origin-top-left transition-transform duration-200 hover:scale-105">
          <AgentAccentMark
            accent={example.accent}
            eyeMotion="idle"
            markBrows={example.markBrows}
            markGaze={example.markGaze}
            markShape={example.markShape}
            markTalk={example.markTalk}
            motion="off"
            size="lg"
          />
        </span>
        <p className="text-sm leading-snug font-medium tracking-tight text-foreground">
          {example.name}
        </p>
      </article>
    </div>
  );
}

function DialCenter() {
  return (
    <div className="relative z-10 mx-auto flex max-w-md flex-col items-center px-4 text-center">
      <h2 className={marketingType.sectionTitle}>Give Pearl specialists</h2>
      <p className={`mt-4 ${marketingType.body}`}>
        Spin up custom agents for research, mail, calendar, and more — Pearl can
        delegate the jobs you assign.
      </p>
      <Button asChild className="mt-6 rounded-full" size="lg">
        <Link href="/marketplace">Explore templates</Link>
      </Button>
    </div>
  );
}

function MobileAgentStrip() {
  return (
    <ul className="mt-10 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
      {DIAL_AGENTS.map((example) => (
        <li
          className="flex w-[148px] shrink-0 flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
          key={example.slug}
        >
          <AgentAccentMark
            accent={example.accent}
            eyeMotion="off"
            markBrows={example.markBrows}
            markGaze={example.markGaze}
            markShape={example.markShape}
            markTalk={example.markTalk}
            motion="off"
            size="md"
          />
          <p className="text-sm font-medium tracking-tight text-foreground">
            {example.name}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function AgentsDialSection() {
  const scopeRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();
  const [radius, setRadius] = useState(280);
  const angles = useMemo(() => dialAngles(DIAL_AGENTS.length), []);

  const arrived = useScrollProgress(
    scopeRef,
    "start end",
    "start start",
    !reduceMotion,
  );
  const held = useScrollProgress(
    scopeRef,
    "start start",
    "end end",
    !reduceMotion,
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const update = () => {
      const { width, height } = stage.getBoundingClientRect();
      setRadius(Math.min(height * 0.62, width * 0.4, 420));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const fan = reduceMotion ? 1 : lerp(FAN_FROM, 1, smoothstep(arrived));
  const turn = reduceMotion ? 0 : TURN_DEG * (smoothstep(held) - 0.5);
  const scale = reduceMotion
    ? 1
    : lerp(lerp(SCALE_ARRIVE_FROM, SCALE_ARRIVE_TO, arrived), 1, held);

  return (
    <section
      className={cn(
        "relative isolate bg-gradient-to-b from-background to-muted/40",
        !reduceMotion && "lg:h-[calc(130svh-4rem)]",
      )}
      id="agents"
      ref={scopeRef}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-[1728px] flex-col items-center justify-center overflow-hidden py-16 sm:py-20",
          !reduceMotion &&
            "lg:sticky lg:top-16 lg:h-[calc(100svh-4rem)] lg:py-0",
        )}
        ref={stageRef}
      >
        <div className="relative flex min-h-[420px] w-full items-center justify-center lg:min-h-0 lg:flex-1">
          <div className="absolute inset-0 hidden lg:block">
            {DIAL_AGENTS.map((example, i) => (
              <AgentDialCard
                angle={angles[i] ?? 0}
                example={example}
                fan={fan}
                key={example.slug}
                radius={radius}
                scale={scale}
                turn={turn}
              />
            ))}
          </div>

          <DialCenter />
        </div>

        <div className="w-full lg:hidden">
          <MobileAgentStrip />
        </div>
      </div>
    </section>
  );
}
