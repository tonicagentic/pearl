"use client";

import { useState } from "react";
import { SignInModal } from "@/components/auth/sign-in-modal";
import { ConnectionsSection } from "@/components/marketing/connections-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { FeaturesSection } from "@/components/marketing/features-section";
import { FinalCtaSection } from "@/components/marketing/final-cta-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { JobsSection } from "@/components/marketing/jobs-section";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { OpenSourceSection } from "@/components/marketing/open-source-section";
import { PlatformsSection } from "@/components/marketing/platforms-section";
import { SelfHostedSection } from "@/components/marketing/self-hosted-section";
import type { AuthMode } from "@/lib/chat/types";

export function MarketingHomePage({
  authMode,
}: {
  readonly authMode: AuthMode;
}) {
  const [authOpen, setAuthOpen] = useState(false);

  const openAuth = () => setAuthOpen(true);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <MarketingHeader onGetStarted={openAuth} onSignIn={openAuth} />
      <main>
        <HeroSection onGetStarted={openAuth} />
        <JobsSection />
        <ConnectionsSection />
        <FeaturesSection />
        <SelfHostedSection onGetStarted={openAuth} />
        <PlatformsSection />
        <OpenSourceSection />
        <FaqSection />
        <FinalCtaSection onGetStarted={openAuth} />
      </main>
      <MarketingFooter />
      <SignInModal
        authMode={authMode}
        callbackPath="/"
        onOpenChange={setAuthOpen}
        open={authOpen}
      />
    </div>
  );
}
