"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { PearlIcon } from "@/components/icons";
import { HeroFrame } from "@/components/marketing/hero-frame";
import { EASE, HeroWord, HeroWords } from "@/components/marketing/hero-word";
import { MarketingContainer } from "@/components/marketing/section";
import { marketingType } from "@/components/marketing/type";
import { usePrefersReducedMotion } from "@/components/marketing/use-prefers-reduced-motion";
import { Button } from "@/components/ui/button";

const blurHidden = {
  opacity: 0,
  filter: "blur(12px)",
  y: -10,
};

const blurVisible = {
  opacity: 1,
  filter: "blur(0px)",
  y: 0,
};

export function HeroSection({
  onGetStarted,
}: {
  readonly onGetStarted: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Plain markup until mount so SSR HTML matches the first client paint.
  // Motion only mounts afterward — avoids transform/filter hydration mismatches.
  if (!mounted) {
    return (
      <section id="hero">
        <MarketingContainer
          className="flex flex-col items-center gap-12 pt-32 pb-16 text-center sm:gap-16 sm:pt-[148px] sm:pb-24"
          narrow
        >
          <div className="flex flex-col items-center">
            <h1 className={marketingType.display} style={{ perspective: 1200 }}>
              <span className="inline-block opacity-0">Meet</span>{" "}
              <span
                aria-hidden
                className="ml-[-0.04em] mr-[-0.14em] inline-block size-[1em] translate-y-[0.12em] opacity-0 align-baseline"
              >
                <PearlIcon className="size-full text-foreground" />
              </span>{" "}
              <span className="inline-block opacity-0">Pearl</span>
            </h1>
            <p
              className={`mt-4 max-w-xl opacity-0 sm:mt-5 sm:max-w-2xl ${marketingType.body}`}
            >
              A personal agent for thinking, research, writing, and keeping track
              of what matters.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2 opacity-0 sm:mt-7 md:gap-3">
              <HeroActions onGetStarted={onGetStarted} />
            </div>
          </div>
          <div className="w-full opacity-0">
            <HeroFrame static />
          </div>
        </MarketingContainer>
      </section>
    );
  }

  return (
    <section id="hero">
      <MarketingContainer
        className="flex flex-col items-center gap-12 pt-32 pb-16 text-center sm:gap-16 sm:pt-[148px] sm:pb-24"
        narrow
      >
        <div className="flex flex-col items-center">
          <h1 className={marketingType.display} style={{ perspective: 1200 }}>
            <HeroWords wordIndexOffset={0}>Meet</HeroWords>{" "}
            <HeroWord wordIndex={1}>
              <span
                aria-hidden
                className="ml-[-0.04em] mr-[-0.14em] inline-block size-[1em] translate-y-[0.12em] align-baseline"
              >
                <PearlIcon className="size-full text-foreground" />
              </span>
            </HeroWord>{" "}
            <HeroWords wordIndexOffset={2}>Pearl</HeroWords>
          </h1>

          <motion.p
            animate={blurVisible}
            className={`mt-4 max-w-xl sm:mt-5 sm:max-w-2xl ${marketingType.body}`}
            initial={reduceMotion ? false : blurHidden}
            transition={
              reduceMotion ? { duration: 0 } : { duration: 1.1, ease: EASE }
            }
          >
            A personal agent for thinking, research, writing, and keeping track
            of what matters.
          </motion.p>

          <motion.div
            animate={blurVisible}
            className="mt-6 flex items-center justify-center gap-2 sm:mt-7 md:gap-3"
            initial={reduceMotion ? false : blurHidden}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 1, ease: EASE, delay: 0.65 }
            }
          >
            <HeroActions onGetStarted={onGetStarted} />
          </motion.div>
        </div>

        <HeroFrame />
      </MarketingContainer>
    </section>
  );
}

function HeroActions({ onGetStarted }: { readonly onGetStarted: () => void }) {
  return (
    <>
      <Button
        className="h-9 rounded-full px-4 md:h-11 md:px-6 md:text-base"
        onClick={onGetStarted}
        type="button"
      >
        Get started
      </Button>
      <Button
        className="h-9 rounded-full px-4 md:h-11 md:px-6 md:text-base"
        onClick={() => {
          document
            .getElementById("jobs")
            ?.scrollIntoView({ behavior: "smooth" });
        }}
        type="button"
        variant="secondary"
      >
        See what it does
      </Button>
    </>
  );
}
