import type { Metadata } from "next";
import { Suspense } from "react";
import { BusinessPage } from "@/components/marketing/business-page";
import { isDatabaseConfigured } from "@/lib/db/client";
import {
  listApprovedDirectoryListings,
  type PublicDirectoryListing,
} from "@/lib/directory/listings";
import { getGithubStars } from "@/lib/github-stars";
import { getInitialSetupStatus } from "@/lib/setup";

export const metadata: Metadata = {
  title: "For businesses — Pearl",
  description:
    "Join Pearl’s directory of local businesses and creatives. Free to list — Pearl can suggest you when people ask.",
};

export default function Page() {
  return (
    <Suspense fallback={<BusinessFallback />}>
      <ResolvedBusiness />
    </Suspense>
  );
}

async function loadListings(): Promise<PublicDirectoryListing[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    return await listApprovedDirectoryListings();
  } catch {
    return [];
  }
}

async function ResolvedBusiness() {
  const setupStatus = getInitialSetupStatus();
  const [githubStars, listings] = await Promise.all([
    getGithubStars(),
    loadListings(),
  ]);

  return (
    <BusinessPage
      authMode={setupStatus.authMode}
      githubStars={githubStars}
      listings={listings}
    />
  );
}

function BusinessFallback() {
  const setupStatus = getInitialSetupStatus();
  return (
    <BusinessPage
      authMode={setupStatus.authMode}
      githubStars={null}
      listings={[]}
    />
  );
}
