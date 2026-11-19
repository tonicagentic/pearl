import { GlobeIcon, SmartphoneIcon } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MarketingSection } from "@/components/marketing/section";
import { marketingType } from "@/components/marketing/type";

const PLATFORMS = [
  {
    title: "Web",
    body: "Full Pearl in the browser — chat, connections, agents, and settings.",
    icon: GlobeIcon,
  },
  {
    title: "iOS",
    body: "The same agent on your phone, with native chat and home screens.",
    icon: SmartphoneIcon,
  },
] as const;

export function PlatformsSection() {
  return (
    <MarketingSection id="platforms">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className={marketingType.sectionTitle}>Wherever you are</h2>
        <p className={`mt-4 ${marketingType.body}`}>
          Use Pearl on the web and on iOS.
        </p>
      </div>
      <ul className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-2">
        {PLATFORMS.map((platform) => {
          const Icon = platform.icon;
          return (
            <li key={platform.title}>
              <Card className="h-full gap-4 py-5 shadow-none">
                <CardHeader className="gap-3 px-5">
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <Icon aria-hidden className="size-4 text-foreground" />
                  </div>
                  <CardTitle className="text-base font-medium tracking-tight">
                    {platform.title}
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {platform.body}
                  </CardDescription>
                </CardHeader>
              </Card>
            </li>
          );
        })}
      </ul>
    </MarketingSection>
  );
}
