"use client";

import { AgentsDialSection } from "@/components/marketing/agents-dial-section";
import { CapabilityBands } from "@/components/marketing/capability-bands";
import { FaqSection } from "@/components/marketing/faq-section";
import { FeaturesSection } from "@/components/marketing/features-section";
import { FinalCtaSection } from "@/components/marketing/final-cta-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { IntegrationsBurstSection } from "@/components/marketing/integrations-burst-section";
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
          <CapabilityBands />
          <AgentsDialSection />
          <IntegrationsBurstSection />
          <FeaturesSection />
          <PricingSection onGetStarted={onGetStarted} />
          <FaqSection />
          <FinalCtaSection onGetStarted={onGetStarted} />
        </>
      )}
    </MarketingShell>
  );
}
