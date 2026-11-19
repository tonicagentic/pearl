import {
  BotIcon,
  ClockIcon,
  Link2Icon,
  ShieldCheckIcon,
  SparklesIcon,
  WrenchIcon,
} from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MarketingSection } from "@/components/marketing/section";
import { marketingType } from "@/components/marketing/type";

const FEATURES = [
  {
    title: "Works in your apps",
    body: "Connect Gmail, Calendar, Drive, GitHub, and more from Settings.",
    icon: Link2Icon,
  },
  {
    title: "Skills",
    body: "Teach Pearl a workflow once. It can reuse the steps later.",
    icon: WrenchIcon,
  },
  {
    title: "Remembers",
    body: "Pearl keeps context about you over time so work doesn’t start from zero.",
    icon: SparklesIcon,
  },
  {
    title: "Routines",
    body: "Custom agents can run on a schedule for the jobs you assign.",
    icon: ClockIcon,
  },
  {
    title: "Hands off work",
    body: "Spin up specialized agents and let them handle ongoing tasks.",
    icon: BotIcon,
  },
  {
    title: "Approvals",
    body: "Sensitive actions wait for you — send, deploy, merge, and more.",
    icon: ShieldCheckIcon,
  },
] as const;

export function FeaturesSection() {
  return (
    <MarketingSection id="features">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className={marketingType.sectionTitle}>More than chat</h2>
        <p className={`mt-4 ${marketingType.body}`}>
          Connections, memory, routines, and approvals around the conversation.
        </p>
      </div>
      <ul className="mt-12 grid gap-4 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <li key={feature.title}>
              <Card className="h-full overflow-hidden gap-0 py-0 shadow-none">
                <div className="flex h-28 items-center justify-center bg-muted/60">
                  <span className="flex size-12 items-center justify-center rounded-full border border-border bg-card">
                    <Icon aria-hidden className="size-5 text-foreground" />
                  </span>
                </div>
                <CardHeader className="gap-2 px-5 py-5">
                  <CardTitle className="text-base font-medium tracking-tight">
                    {feature.title}
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.body}
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
