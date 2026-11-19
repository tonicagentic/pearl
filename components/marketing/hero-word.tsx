"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { usePrefersReducedMotion } from "@/components/marketing/use-prefers-reduced-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

const wordHidden = {
  opacity: 0,
  rotateX: -40,
  y: "45%",
};

const wordVisible = {
  opacity: 1,
  rotateX: 0,
  y: 0,
};

function wordTransition(wordIndex: number, reduceMotion: boolean) {
  if (reduceMotion) {
    return { duration: 0 };
  }
  return {
    duration: 0.65,
    ease: EASE,
    delay: 0.1 + 0.055 * wordIndex,
  };
}

export function HeroWord({
  children,
  wordIndex,
}: {
  readonly children: ReactNode;
  readonly wordIndex: number;
}) {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <motion.span
      animate={wordVisible}
      initial={reduceMotion ? false : wordHidden}
      style={{
        display: "inline-block",
        position: "relative",
        verticalAlign: "bottom",
      }}
      transition={wordTransition(wordIndex, reduceMotion)}
    >
      {children}
    </motion.span>
  );
}

export function HeroWords({
  children,
  wordIndexOffset = 0,
}: {
  readonly children: string;
  readonly wordIndexOffset?: number;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const words = children.trim().split(/\s+/).filter(Boolean);

  return (
    <>
      {words.map((word, index) => {
        const wordIndex = wordIndexOffset + index;
        return (
          <span key={`${wordIndex}-${word}`}>
            {index > 0 ? " " : null}
            <motion.span
              animate={wordVisible}
              initial={reduceMotion ? false : wordHidden}
              style={{ display: "inline-block", position: "relative" }}
              transition={wordTransition(wordIndex, reduceMotion)}
            >
              {word}
            </motion.span>
          </span>
        );
      })}
    </>
  );
}

export { EASE };
