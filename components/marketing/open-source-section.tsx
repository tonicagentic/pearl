import { FolderGit2Icon } from "lucide-react";
import {
  GITHUB_REPO,
  GITHUB_URL,
} from "@/components/marketing/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketingSection } from "@/components/marketing/section";
import { marketingType } from "@/components/marketing/type";

const RECENT = [
  {
    title: "Coder subagent for GitHub repos, deploys, and EAS",
    meta: "Unreleased",
  },
  {
    title: "Model router: Sol by default, Astra when the task is hard",
    meta: "Unreleased",
  },
  {
    title: "Billing screen for plan, spend, and payment method",
    meta: "0.1.8",
  },
  {
    title: "Home lists projects under Recents",
    meta: "0.1.8",
  },
] as const;

export function OpenSourceSection() {
  return (
    <MarketingSection id="open-source">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <h2 className={marketingType.sectionTitle}>Open source</h2>
          <p className={`mt-4 ${marketingType.body}`}>
            Apache-2.0. Run it, change it, make it yours.
          </p>
          <div className="mt-6">
            <Button asChild className="rounded-full">
              <a href={GITHUB_URL} rel="noreferrer" target="_blank">
                <FolderGit2Icon className="size-4" />
                Star on GitHub
              </a>
            </Button>
          </div>
        </div>

        <Card className="gap-0 overflow-hidden py-0 shadow-none">
          <CardHeader className="flex-row items-center gap-3 space-y-0 border-b border-border px-5 py-4">
            <FolderGit2Icon aria-hidden className="size-4 text-foreground" />
            <CardTitle className="text-sm font-medium tracking-tight">
              {GITHUB_REPO}
            </CardTitle>
            <span className="ml-auto text-xs text-muted-foreground">
              Apache-2.0
            </span>
          </CardHeader>
          <CardContent className="px-0 py-0">
            <ul>
              {RECENT.map((item) => (
                <li
                  className="flex items-start gap-3 border-b border-border px-5 py-3 last:border-b-0"
                  key={item.title}
                >
                  <span
                    aria-hidden
                    className="mt-1.5 size-2 shrink-0 rounded-full bg-foreground/70"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug tracking-tight">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.meta}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </MarketingSection>
  );
}
