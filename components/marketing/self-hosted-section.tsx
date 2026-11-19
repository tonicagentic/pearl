import { ClockIcon, CpuIcon, ShieldCheckIcon } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GITHUB_URL } from "@/components/marketing/constants";
import { MarketingSection } from "@/components/marketing/section";
import { marketingType } from "@/components/marketing/type";

const POINTS = [
  {
    title: "Your model",
    body: "Pick the model Pearl uses for each kind of work.",
    icon: CpuIcon,
  },
  {
    title: "Work on a schedule",
    body: "Custom agents can run routines while you are away.",
    icon: ClockIcon,
  },
  {
    title: "You set the limits",
    body: "Decide which actions need your approval before they run.",
    icon: ShieldCheckIcon,
  },
] as const;

const PROVIDERS = ["AI Gateway", "Auto", "Sol", "Astra", "Grok Imagine"] as const;

export function SelfHostedSection({
  onGetStarted,
}: {
  readonly onGetStarted: () => void;
}) {
  return (
    <MarketingSection id="self-hosted">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <h2 className={marketingType.sectionTitle}>Self-hosted</h2>
          <p className={`mt-4 ${marketingType.body}`}>
            Your machine, your models, your control.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="rounded-full" onClick={onGetStarted} type="button">
            Get started
          </Button>
          <Button asChild className="rounded-full" variant="outline">
            <a href={GITHUB_URL} rel="noreferrer" target="_blank">
              View on GitHub
            </a>
          </Button>
        </div>
      </div>

      <ul className="mt-12 grid gap-4 sm:grid-cols-3">
        {POINTS.map((point) => {
          const Icon = point.icon;
          return (
            <li key={point.title}>
              <Card className="h-full overflow-hidden gap-0 py-0 shadow-none">
                <div className="flex h-28 items-center justify-center bg-muted/60">
                  <span className="flex size-12 items-center justify-center rounded-full border border-border bg-card">
                    <Icon aria-hidden className="size-5 text-foreground" />
                  </span>
                </div>
                <CardHeader className="gap-2 px-5 py-5">
                  <CardTitle className="text-base font-medium tracking-tight">
                    {point.title}
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {point.body}
                  </CardDescription>
                </CardHeader>
              </Card>
            </li>
          );
        })}
      </ul>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className={marketingType.caption}>Works with</p>
        <div className="flex flex-wrap gap-2">
          {PROVIDERS.map((name) => (
            <Badge key={name} variant="outline">
              {name}
            </Badge>
          ))}
        </div>
      </div>
    </MarketingSection>
  );
}
