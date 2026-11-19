import type { Metadata } from "next";
import { Suspense } from "react";
import { DownloadPage } from "@/components/marketing/download-page";
import { getGithubStars } from "@/lib/github-stars";
import { getInitialSetupStatus } from "@/lib/setup";

export const metadata: Metadata = {
  title: "Download — Pearl",
  description: "Use Pearl on the web and on iOS. Self-host from GitHub.",
};

export default function Page() {
  return (
    <Suspense fallback={<DownloadFallback />}>
      <ResolvedDownload />
    </Suspense>
  );
}

async function ResolvedDownload() {
  const setupStatus = getInitialSetupStatus();
  const githubStars = await getGithubStars();

  return (
    <DownloadPage
      authMode={setupStatus.authMode}
      githubStars={githubStars}
    />
  );
}

function DownloadFallback() {
  const setupStatus = getInitialSetupStatus();
  return (
    <DownloadPage authMode={setupStatus.authMode} githubStars={null} />
  );
}
