import type { Metadata } from "next";
import { Suspense } from "react";
import { ChatAppShell } from "@/app/_components/chat-app-shell";
import { HomeChatPage } from "@/app/_components/home-chat-page";
import { MarketingHomePage } from "@/components/marketing/marketing-home-page";
import { getGithubStars } from "@/lib/github-stars";
import { getServerViewer } from "@/lib/session";
import { getInitialSetupStatus } from "@/lib/setup";

const HOME_TITLE = "Pearl — personal agent for clear thinking";
const HOME_DESCRIPTION =
  "Pearl is a personal agent for thinking, research, writing, and keeping track of what matters.";

export const metadata: Metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
};

type HomeSearchParams = Promise<{
  readonly home?: string | string[];
}>;

/**
 * Static shell: session/headers stay inside Suspense so `/` can prerender under
 * cacheComponents. Branching uses the sync initial setup status (no DB round
 * trip); ChatAppShell's bootstrap still resolves the real setup status.
 */
export default function Page({
  searchParams,
}: {
  readonly searchParams: HomeSearchParams;
}) {
  return (
    <Suspense fallback={<HomeFallback />}>
      <ResolvedHome searchParams={searchParams} />
    </Suspense>
  );
}

async function ResolvedHome({
  searchParams,
}: {
  readonly searchParams: HomeSearchParams;
}) {
  const setupStatus = getInitialSetupStatus();
  const params = await searchParams;
  const forceHome =
    process.env.NODE_ENV === "development" && paramIsOne(params.home);

  const githubStars = await getGithubStars();

  if (forceHome) {
    return (
      <MarketingHomePage
        authMode={setupStatus.authMode}
        githubStars={githubStars}
      />
    );
  }

  const viewer = await getServerViewer(setupStatus);

  if (setupStatus.appReady && !viewer) {
    return (
      <MarketingHomePage
        authMode={setupStatus.authMode}
        githubStars={githubStars}
      />
    );
  }

  return (
    <ChatAppShell>
      <HomeChatPage />
    </ChatAppShell>
  );
}

function HomeFallback() {
  const setupStatus = getInitialSetupStatus();
  return (
    <MarketingHomePage authMode={setupStatus.authMode} githubStars={null} />
  );
}

function paramIsOne(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.includes("1");
  }
  return value === "1";
}
