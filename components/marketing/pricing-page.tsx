"use client";

import {
  GITHUB_URL,
  HOSTED_PRICE_LABEL,
  HOSTED_USAGE_CAP_LABEL,
} from "@/components/marketing/constants";
import { MarketingSection } from "@/components/marketing/section";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { marketingType } from "@/components/marketing/type";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
        <PricingPageContent onGetStarted={onGetStarted} />
      )}
    </MarketingShell>
  );
}

function PricingPageContent({
  onGetStarted,
}: {
  readonly onGetStarted: () => void;
}) {
  return (
    <MarketingSection className="pt-28 sm:pt-32">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className={marketingType.sectionTitle}>Pricing</h1>
        <p className={`mt-4 ${marketingType.body}`}>
          Free to self-host. Hosted Pearl is a flat subscription plus metered
          usage.
        </p>
      </div>

      <ul className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
        <li>
          <Card className="h-full shadow-none">
            <CardHeader>
              <CardTitle className="text-lg font-medium tracking-tight">
                Self-hosted
              </CardTitle>
              <p className="text-3xl font-medium tracking-tight">Free</p>
              <CardDescription className="text-sm leading-relaxed">
                Apache-2.0. Your machine, your models, your control.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              <ul className="list-disc space-y-2 pl-5 text-left">
                <li>Run Pearl on your own stack</li>
                <li>Bring your own models and keys</li>
                <li>Full source under Apache-2.0</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full rounded-full" variant="outline">
                <a href={GITHUB_URL} rel="noreferrer" target="_blank">
                  View on GitHub
                </a>
              </Button>
            </CardFooter>
          </Card>
        </li>
        <li>
          <Card className="h-full shadow-none">
            <CardHeader>
              <CardTitle className="text-lg font-medium tracking-tight">
                Hosted
              </CardTitle>
              <p className="text-3xl font-medium tracking-tight">
                {HOSTED_PRICE_LABEL}
              </p>
              <CardDescription className="text-sm leading-relaxed">
                Hosted Pearl with models and tools metered.{" "}
                {HOSTED_USAGE_CAP_LABEL} usage cap — raise it in Settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              <ul className="list-disc space-y-2 pl-5 text-left">
                <li>Web and iOS against the hosted service</li>
                <li>Models, research, sandboxes, and images metered</li>
                <li>Subscribe after sign-in — billing stays in-app</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full rounded-full"
                onClick={onGetStarted}
                type="button"
              >
                Get started
              </Button>
            </CardFooter>
          </Card>
        </li>
      </ul>

      <p
        className={`mx-auto mt-8 max-w-2xl text-center ${marketingType.caption}`}
      >
        Usage is metered at provider cost onto your Stripe invoice.
      </p>
    </MarketingSection>
  );
}
