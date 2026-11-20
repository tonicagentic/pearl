"use client";

import { FaqSection } from "@/components/marketing/faq-section";
import { FeaturesSection } from "@/components/marketing/features-section";
import { FinalCtaSection } from "@/components/marketing/final-cta-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { JobsSection } from "@/components/marketing/jobs-section";
import { KnowsSection } from "@/components/marketing/knows-section";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { PricingSection } from "@/components/marketing/pricing-section";
import type { AuthMode } from "@/lib/chat/types";

export function MarketingHomePage({
  authMode,
  githubStars,
}: {
  readonly authMode: AuthMode;
  readonly githubStars: number | null;
}) {
  return (
    <MarketingShell authMode={authMode} githubStars={githubStars}>
      {({ onGetStarted }) => (
        <>
          <HeroSection onGetStarted={onGetStarted} />
          <KnowsSection />
          <FeaturesSection />
          <JobsSection onGetStarted={onGetStarted} />
          <PricingSection onGetStarted={onGetStarted} />
          <FaqSection />
          <FinalCtaSection onGetStarted={onGetStarted} />
        </>
      )}
    </MarketingShell>
  );
}
