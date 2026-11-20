"use client";

import { PricingSection } from "@/components/marketing/pricing-section";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import type { AuthMode } from "@/lib/chat/types";

export function PricingPage({
  authMode,
  githubStars,
}: {
  readonly authMode: AuthMode;
  readonly githubStars: number | null;
}) {
  return (
    <MarketingShell
      authMode={authMode}
      callbackPath="/pricing"
      githubStars={githubStars}
    >
      {({ onGetStarted }) => (
        <PricingSection
          className="pt-28 pb-16 sm:pt-32 sm:pb-24"
          onGetStarted={onGetStarted}
          titleAs="h1"
        />
      )}
    </MarketingShell>
  );
}
