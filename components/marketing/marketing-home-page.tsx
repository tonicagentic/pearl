"use client";

import { ConnectionsSection } from "@/components/marketing/connections-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { FeaturesSection } from "@/components/marketing/features-section";
import { FinalCtaSection } from "@/components/marketing/final-cta-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { JobsSection } from "@/components/marketing/jobs-section";
import { KnowsSection } from "@/components/marketing/knows-section";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { OpenSourceSection } from "@/components/marketing/open-source-section";
import { PlatformsSection } from "@/components/marketing/platforms-section";
import { SelfHostedSection } from "@/components/marketing/self-hosted-section";
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
          <JobsSection onGetStarted={onGetStarted} />
          <ConnectionsSection />
          <KnowsSection />
          <FeaturesSection />
          <SelfHostedSection onGetStarted={onGetStarted} />
          <PlatformsSection />
          <OpenSourceSection />
          <FaqSection />
          <FinalCtaSection onGetStarted={onGetStarted} />
        </>
      )}
    </MarketingShell>
  );
}
