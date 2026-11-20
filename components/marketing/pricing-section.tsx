"use client";

import { FolderGit2Icon } from "lucide-react";
import {
  GITHUB_URL,
  HOSTED_PRICE_LABEL,
  HOSTED_USAGE_CAP_LABEL,
} from "@/components/marketing/constants";
import { MarketingContainer } from "@/components/marketing/section";
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
import { cn } from "@/lib/utils";

export function PricingSection({
  onGetStarted,
  className,
  titleAs: TitleTag = "h2",
}: {
  readonly onGetStarted: () => void;
  readonly className?: string;
  readonly titleAs?: "h1" | "h2";
}) {
  return (
    <section className={cn("py-16 sm:py-24", className)} id="pricing">
      <MarketingContainer>
        <div className="mx-auto max-w-2xl text-center">
          <TitleTag className={marketingType.sectionTitle}>Pricing</TitleTag>
          <p className={`mt-4 ${marketingType.body}`}>
            Free to self-host under Apache-2.0. Hosted Pearl is a flat
            subscription plus metered usage.
          </p>
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2">
          <li>
            <Card className="h-full shadow-none">
              <CardHeader>
                <CardTitle className="text-lg font-medium tracking-tight">
                  Self-hosted
                </CardTitle>
                <p className="text-3xl font-medium tracking-tight">Free</p>
                <CardDescription className="text-sm leading-relaxed">
                  Open source. Your machine, your models, your control.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-muted-foreground">
                <ul className="list-disc space-y-2 pl-5 text-left">
                  <li>Full source under Apache-2.0</li>
                  <li>Run Pearl on your own stack</li>
                  <li>Bring your own models and keys</li>
                  <li>Pick models, schedules, and approval limits</li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  asChild
                  className="w-full rounded-full"
                  variant="outline"
                >
                  <a href={GITHUB_URL} rel="noreferrer" target="_blank">
                    <FolderGit2Icon className="size-4" />
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
          className={cn(
            "mx-auto mt-8 max-w-2xl text-center",
            marketingType.caption,
          )}
        >
          Usage is metered at provider cost onto your Stripe invoice.
        </p>
      </MarketingContainer>
    </section>
  );
}
