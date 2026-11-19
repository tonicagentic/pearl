import type { Metadata } from "next";
import { Suspense } from "react";
import { PricingPage } from "@/components/marketing/pricing-page";
import { getGithubStars } from "@/lib/github-stars";
import { getInitialSetupStatus } from "@/lib/setup";

export const metadata: Metadata = {
  title: "Pricing — Pearl",
  description:
    "Self-host Pearl for free, or use hosted Pearl at $10/mo plus metered usage.",
};

export default function Page() {
  return (
    <Suspense fallback={<PricingFallback />}>
      <ResolvedPricing />
    </Suspense>
  );
}

async function ResolvedPricing() {
  const setupStatus = getInitialSetupStatus();
  const githubStars = await getGithubStars();

  return (
    <PricingPage
      authMode={setupStatus.authMode}
      githubStars={githubStars}
    />
  );
}

function PricingFallback() {
  const setupStatus = getInitialSetupStatus();
  return (
    <PricingPage authMode={setupStatus.authMode} githubStars={null} />
  );
}
