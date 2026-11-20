import type { Metadata } from "next";
import { Suspense } from "react";
import { MarketplacePage } from "@/components/marketing/marketplace-page";
import { getGithubStars } from "@/lib/github-stars";
import { getInitialSetupStatus } from "@/lib/setup";

export const metadata: Metadata = {
  title: "Marketplace — Pearl",
  description:
    "Browse ready-made Pearl agent roles for research, mail, calendar, coding, and more.",
};

export default function Page() {
  return (
    <Suspense fallback={<MarketplaceFallback />}>
      <ResolvedMarketplace />
    </Suspense>
  );
}

async function ResolvedMarketplace() {
  const setupStatus = getInitialSetupStatus();
  const githubStars = await getGithubStars();

  return (
    <MarketplacePage
      authMode={setupStatus.authMode}
      githubStars={githubStars}
    />
  );
}

function MarketplaceFallback() {
  const setupStatus = getInitialSetupStatus();
  return (
    <MarketplacePage authMode={setupStatus.authMode} githubStars={null} />
  );
}
