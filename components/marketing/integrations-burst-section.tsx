"use client";

import { animate, motion, useInView } from "motion/react";
import { useEffect, useRef } from "react";
import { PluginLogo } from "@/components/connections/plugin-logo";
import { usePrefersReducedMotion } from "@/components/marketing/use-prefers-reduced-motion";
import { marketingType } from "@/components/marketing/type";
import type { PluginMarkId } from "@/lib/plugins/catalog";
import { cn } from "@/lib/utils";

type BurstIcon = {
  readonly id: PluginMarkId;
  readonly label: string;
  readonly left: string;
  readonly top: string;
  readonly size: number;
  readonly rotate: number;
};

type BurstPixel = {
  readonly left: string;
  readonly top: string;
  readonly size: number;
  readonly color: string;
};

/** Parked positions around the centered headline (Wajo-style cloud). */
const BURST_ICONS: readonly BurstIcon[] = [
  {
    id: "gmail",
    label: "Gmail",
    left: "21.7%",
    top: "20.1%",
    size: 76,
    rotate: -13,
  },
  {
    id: "calendar",
    label: "Google Calendar",
    left: "64.7%",
    top: "9.3%",
    size: 59,
    rotate: 21,
  },
  {
    id: "drive",
    label: "Google Drive",
    left: "81.1%",
    top: "22.5%",
    size: 72,
    rotate: -15,
  },
  {
    id: "github",
    label: "GitHub",
    left: "76.6%",
    top: "48%",
    size: 86,
    rotate: 13,
  },
  {
    id: "vercel",
    label: "Vercel",
    left: "35.4%",
    top: "4%",
    size: 70,
    rotate: -18,
  },
  {
    id: "expo",
    label: "Expo",
    left: "9.3%",
    top: "42%",
    size: 64,
    rotate: -22,
  },
  {
    id: "sheets",
    label: "Google Sheets",
    left: "54.7%",
    top: "78%",
    size: 80,
    rotate: 15,
  },
  {
    id: "neon",
    label: "Neon",
    left: "72.4%",
    top: "72%",
    size: 68,
    rotate: 18,
  },
  {
    id: "betterstack",
    label: "Better Stack",
    left: "17.7%",
    top: "70%",
    size: 62,
    rotate: -16,
  },
  {
    id: "xero",
    label: "Xero",
    left: "88%",
    top: "38%",
    size: 58,
    rotate: 24,
  },
  {
    id: "tempo",
    label: "Tempo",
    left: "12%",
    top: "18%",
    size: 56,
    rotate: -10,
  },
  {
    id: "icloud-calendar",
    label: "iCloud Calendar",
    left: "42%",
    top: "82%",
    size: 74,
    rotate: 8,
  },
];

const BURST_PIXELS: readonly BurstPixel[] = [
  { left: "10.9%", top: "10.5%", size: 24, color: "#F97316" },
  { left: "92.2%", top: "16.1%", size: 28, color: "#EAB308" },
  { left: "50.7%", top: "32.7%", size: 20, color: "#A855F7" },
  { left: "17.2%", top: "67%", size: 16, color: "#EC4899" },
  { left: "79.7%", top: "71%", size: 19, color: "#3B82F6" },
];

/** Offset from parked position toward cloud center (burst origin). */
function burstFromOffset(left: string, top: string): { x: number; y: number } {
  const lx = Number.parseFloat(left) / 100;
  const ty = Number.parseFloat(top) / 100;
  // Approximate cloud size at lg; direction toward 50%/50%.
  return {
    x: (0.5 - lx) * 900,
    y: (0.5 - ty) * 700,
  };
}

function BurstTile({
  icon,
  index,
  armed,
  reduceMotion,
}: {
  readonly icon: BurstIcon;
  readonly index: number;
  readonly armed: boolean;
  readonly reduceMotion: boolean;
}) {
  const floatRef = useRef<HTMLSpanElement>(null);
  const from = burstFromOffset(icon.left, icon.top);

  useEffect(() => {
    if (!armed || reduceMotion || !floatRef.current) return;
    const controls = animate(
      floatRef.current,
      { y: [0, -8] },
      {
        duration: 2.4 + (index % 5) * 0.35,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "reverse",
      },
    );
    return () => controls.stop();
  }, [armed, index, reduceMotion]);

  return (
    <motion.span
      aria-hidden
      className="absolute"
      initial={
        reduceMotion
          ? false
          : {
              opacity: 0,
              scale: 0.4,
              x: from.x,
              y: from.y,
            }
      }
      style={{
        left: icon.left,
        top: icon.top,
        width: icon.size,
        height: icon.size,
        rotate: icon.rotate,
      }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : {
              duration: 0.7,
              ease: [0.23, 1, 0.32, 1],
              delay: index * 0.035,
            }
      }
      animate={
        armed || reduceMotion
          ? { opacity: 1, scale: 1, x: 0, y: 0 }
          : { opacity: 0, scale: 0.4, x: from.x, y: from.y }
      }
    >
      <span
        className="flex size-full items-center justify-center"
        ref={floatRef}
      >
        <span
          aria-label={icon.label}
          className="flex size-full items-center justify-center rounded-[25%] border border-border/60 bg-card shadow-sm"
          role="img"
        >
          <PluginLogo
            className="!size-[63%] rounded-[20%] [&>svg]:!size-[70%]"
            id={icon.id}
          />
        </span>
      </span>
    </motion.span>
  );
}

function BurstPixelDot({
  pixel,
  index,
  armed,
  reduceMotion,
}: {
  readonly pixel: BurstPixel;
  readonly index: number;
  readonly armed: boolean;
  readonly reduceMotion: boolean;
}) {
  return (
    <motion.span
      aria-hidden
      className="absolute rounded-sm"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.4 }}
      style={{
        left: pixel.left,
        top: pixel.top,
        width: pixel.size,
        height: pixel.size,
        backgroundColor: pixel.color,
      }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : {
              duration: 0.55,
              ease: [0.23, 1, 0.32, 1],
              delay: 0.15 + index * 0.04,
            }
      }
      animate={
        armed || reduceMotion
          ? { opacity: 1, scale: 1 }
          : { opacity: 0, scale: 0.4 }
      }
    />
  );
}

export function IntegrationsBurstSection() {
  const cloudRef = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();
  const inView = useInView(cloudRef, {
    once: true,
    // Approximate Wajo `center 70%` trigger.
    margin: "0px 0px -30% 0px",
  });

  return (
    <section
      className="flex justify-center overflow-hidden py-16 sm:py-24 lg:min-h-[calc(100svh-4rem)] lg:py-8"
      id="connections"
    >
      <div
        className="relative mx-auto min-h-[430px] w-full max-w-[1556px] sm:min-h-[560px] lg:min-h-[480px]"
        ref={cloudRef}
      >
        <div
          aria-hidden
          className={cn(
            "absolute top-1/2 left-1/2 h-[860px] w-[840px] origin-center -translate-x-1/2 -translate-y-1/2 scale-[0.49]",
            "sm:h-[880px] sm:w-[1160px] sm:scale-[0.62]",
            "lg:inset-0 lg:size-full lg:translate-x-0 lg:translate-y-0 lg:scale-100",
          )}
        >
          {BURST_ICONS.map((icon, index) => (
            <BurstTile
              armed={inView}
              icon={icon}
              index={index}
              key={icon.id}
              reduceMotion={reduceMotion}
            />
          ))}
          {BURST_PIXELS.map((pixel, index) => (
            <BurstPixelDot
              armed={inView}
              index={index}
              key={`${pixel.left}-${pixel.top}`}
              pixel={pixel}
              reduceMotion={reduceMotion}
            />
          ))}
        </div>

        <div className="relative z-10 flex h-full min-h-[430px] items-center justify-center px-6 sm:min-h-[560px] lg:min-h-[480px]">
          <h2
            className={cn(
              marketingType.sectionTitle,
              "max-w-xl text-center text-balance",
            )}
          >
            Pearl connects to the tools you already use
          </h2>
        </div>
      </div>
    </section>
  );
}
