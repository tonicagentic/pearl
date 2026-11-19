import {
  CalendarIcon,
  FolderGit2Icon,
  HardDriveIcon,
  MailIcon,
  RocketIcon,
  SmartphoneIcon,
} from "lucide-react";
import { PearlIcon } from "@/components/icons";
import { MarketingSection } from "@/components/marketing/section";
import { marketingType } from "@/components/marketing/type";
import { Card, CardContent } from "@/components/ui/card";

const CONNECTIONS = [
  { label: "Gmail", icon: MailIcon },
  { label: "Google Calendar", icon: CalendarIcon },
  { label: "Google Drive", icon: HardDriveIcon },
  { label: "GitHub", icon: FolderGit2Icon },
  { label: "Vercel", icon: RocketIcon },
  { label: "Expo", icon: SmartphoneIcon },
] as const;

export function ConnectionsSection() {
  return (
    <MarketingSection id="connections">
      <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <h2 className={marketingType.sectionTitle}>
            Connect the tools you use
          </h2>
          <p className={`mt-4 ${marketingType.body}`}>
            Pearl works with the accounts you authorize — mail, calendar, files,
            and the services you build with.
          </p>
          <ul className="mt-8 space-y-3">
            {CONNECTIONS.map((row) => {
              const Icon = row.icon;
              return (
                <li key={row.label}>
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-muted">
                      <Icon aria-hidden className="size-4 text-foreground" />
                    </span>
                    <span className="text-sm font-medium tracking-tight">
                      {row.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className={`mt-4 ${marketingType.caption}`}>And more from Settings.</p>
        </div>

        <Card className="overflow-hidden py-0 shadow-none">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <span
                aria-hidden
                className="size-2.5 rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.2)]"
              />
              <span
                aria-hidden
                className="size-2.5 rounded-full bg-[#febc2e] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.2)]"
              />
              <span
                aria-hidden
                className="size-2.5 rounded-full bg-[#28c840] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.2)]"
              />
              <span className="ml-2 text-xs text-muted-foreground">Pearl</span>
            </div>
            <div className="space-y-4 px-5 py-6 sm:px-6">
              <div className="flex justify-end">
                <p className="max-w-[90%] rounded-2xl bg-secondary px-4 py-2.5 text-sm leading-6 text-secondary-foreground">
                  What’s waiting in my inbox that I should answer today?
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
                  <PearlIcon className="size-3.5 text-foreground" />
                </div>
                <p className="max-w-[90%] text-sm leading-6 text-foreground">
                  Three threads need a reply. I drafted answers for two and
                  parked a contract question for you to read first.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MarketingSection>
  );
}
