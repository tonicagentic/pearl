import {
  BotIcon,
  BrainIcon,
  CalendarIcon,
  CodeIcon,
  InboxIcon,
  LightbulbIcon,
  MapIcon,
  PenLineIcon,
} from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MarketingSection } from "@/components/marketing/section";
import { marketingType } from "@/components/marketing/type";

const JOBS = [
  {
    title: "Thinking partner",
    body: "Turn unorganized thoughts into well-reasoned ideas.",
    icon: BrainIcon,
  },
  {
    title: "Research",
    body: "Ask questions and get cited answers across sources.",
    icon: LightbulbIcon,
  },
  {
    title: "Writing",
    body: "Draft, critique, and revise writing alongside Pearl.",
    icon: PenLineIcon,
  },
  {
    title: "Areas",
    body: "Track unresolved issues and bring them back on time.",
    icon: MapIcon,
  },
  {
    title: "Inbox",
    body: "Triage Gmail, draft replies, and archive with approval.",
    icon: InboxIcon,
  },
  {
    title: "Coding",
    body: "Inspect repos, open PRs, and ship with the coder agent.",
    icon: CodeIcon,
  },
  {
    title: "Calendar",
    body: "Plan around meetings and free time on your calendar.",
    icon: CalendarIcon,
  },
  {
    title: "Custom agents",
    body: "Spin up specialized agents for ongoing jobs you define.",
    icon: BotIcon,
  },
] as const;

export function JobsSection() {
  return (
    <MarketingSection id="jobs">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className={marketingType.sectionTitle}>Give Pearl a job</h2>
        <p className={`mt-4 ${marketingType.body}`}>
          Start with a role. Make it yours.
        </p>
      </div>
      <ul className="mt-12 grid gap-4 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
        {JOBS.map((job) => {
          const Icon = job.icon;
          return (
            <li key={job.title}>
              <Card className="h-full gap-4 py-5 shadow-none">
                <CardHeader className="gap-3 px-5">
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <Icon aria-hidden className="size-4 text-foreground" />
                  </div>
                  <CardTitle className="text-base font-medium tracking-tight">
                    {job.title}
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {job.body}
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
