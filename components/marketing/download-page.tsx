"use client";

import { GlobeIcon, SmartphoneIcon } from "lucide-react";
import { GITHUB_URL } from "@/components/marketing/constants";
import { MarketingSection } from "@/components/marketing/section";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { marketingType } from "@/components/marketing/type";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { AuthMode } from "@/lib/chat/types";

const ROWS = [
  {
    id: "web",
    title: "Web",
    body: "Full Pearl in the browser — chat, connections, agents, and settings.",
    icon: GlobeIcon,
    cta: "Open",
  },
  {
    id: "ios",
    title: "iOS",
    body: "The Expo app ships in the repo. Hosted get started today; App Store link when it is live.",
    icon: SmartphoneIcon,
    cta: "Get started",
  },
] as const;

export function DownloadPage({
  authMode,
  githubStars,
}: {
  readonly authMode: AuthMode;
  readonly githubStars: number | null;
}) {
  return (
    <MarketingShell
      authMode={authMode}
      callbackPath="/download"
      githubStars={githubStars}
    >
      {({ onGetStarted }) => (
        <DownloadPageContent onGetStarted={onGetStarted} />
      )}
    </MarketingShell>
  );
}

function DownloadPageContent({
  onGetStarted,
}: {
  readonly onGetStarted: () => void;
}) {
  return (
    <MarketingSection className="pt-28 sm:pt-32">
      <div className="mx-auto max-w-2xl">
        <h1 className={marketingType.sectionTitle}>Download</h1>
        <p className={`mt-4 ${marketingType.body}`}>
          Use Pearl on the web and on iOS.
        </p>

        <ul className="mt-12">
          {ROWS.map((row, index) => {
            const Icon = row.icon;
            return (
              <li key={row.id}>
                {index > 0 ? <Separator className="my-0" /> : null}
                <div className="flex items-center gap-4 py-6">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon aria-hidden className="size-4 text-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium tracking-tight text-foreground">
                      {row.title}
                    </p>
                    <p className={`mt-1 ${marketingType.caption}`}>{row.body}</p>
                  </div>
                  <Button
                    className="shrink-0 rounded-full"
                    onClick={onGetStarted}
                    type="button"
                    variant="outline"
                  >
                    {row.cta}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>

        <p className={`mt-8 ${marketingType.caption}`}>
          Prefer to run it yourself?{" "}
          <a
            className="underline underline-offset-4 transition-colors hover:text-foreground"
            href={GITHUB_URL}
            rel="noreferrer"
            target="_blank"
          >
            Self-host from GitHub
          </a>
          .
        </p>
      </div>
    </MarketingSection>
  );
}
