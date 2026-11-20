"use client";

import { motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { HeroFrame } from "@/components/marketing/hero-frame";
import { EASE, HeroWords } from "@/components/marketing/hero-word";
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
      <HeroLayout
        copy={
          <div className="flex flex-col items-center">
            <h1 className={marketingType.display} style={{ perspective: 1200 }}>
              <span className="inline-block opacity-0">
                Pearl, your AI sidekick.
              </span>
            </h1>
            <p
              className={`mt-4 max-w-xl opacity-0 sm:mt-5 sm:max-w-2xl ${marketingType.body}`}
            >
              An always-on collaborator who helps you keep momentum in work and
              life.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2 opacity-0 sm:mt-7 md:gap-3">
              <HeroActions onGetStarted={onGetStarted} />
            </div>
          </div>
        }
        media={
          <div className="w-full opacity-0">
            <HeroFrame static />
          </div>
        }
      />
    );
  }

  return (
    <HeroLayout
      copy={
        <div className="flex flex-col items-center">
          <h1 className={marketingType.display} style={{ perspective: 1200 }}>
            <HeroWords>Pearl, your AI sidekick.</HeroWords>
          </h1>

          <motion.p
            animate={blurVisible}
            className={`mt-4 max-w-xl sm:mt-5 sm:max-w-2xl ${marketingType.body}`}
            initial={reduceMotion ? false : blurHidden}
            transition={
              reduceMotion ? { duration: 0 } : { duration: 1.1, ease: EASE }
            }
          >
            An always-on collaborator who helps you keep momentum in work and
            life.
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
      }
      media={<HeroFrame />}
    />
  );
}

function HeroLayout({
  copy,
  media,
}: {
  readonly copy: ReactNode;
  readonly media: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-12 pt-32 pb-16 sm:gap-16 sm:pt-[148px] sm:pb-24" id="hero">
      <MarketingContainer className="text-center" narrow>
        {copy}
      </MarketingContainer>
      <MarketingContainer>{media}</MarketingContainer>
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
