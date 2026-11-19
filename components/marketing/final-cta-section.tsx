import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MarketingSection } from "@/components/marketing/section";
import { marketingType } from "@/components/marketing/type";

const STATS = [
  { value: "Apache-2.0", label: "License" },
  { value: "Open source", label: "Every feature in the repo" },
  { value: "Web + iOS", label: "Wherever you work" },
  { value: "Self-host", label: "Your machine, your control" },
] as const;

export function FinalCtaSection({
  onGetStarted,
}: {
  readonly onGetStarted: () => void;
}) {
  return (
    <MarketingSection id="get-started">
      <div className="rounded-3xl border border-border bg-muted/50 px-6 py-10 sm:px-10 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <h2 className={marketingType.sectionTitle}>Meet Pearl</h2>
            <p className={`mt-4 ${marketingType.body}`}>
              A personal agent for thinking, research, writing, and keeping
              track of what matters.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                className="rounded-full"
                onClick={onGetStarted}
                type="button"
              >
                Get started
              </Button>
              <Button asChild className="rounded-full" variant="outline">
                <Link href="/about">Read about</Link>
              </Button>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-6">
            {STATS.map((stat) => (
              <div key={stat.value}>
                <dt className="text-lg font-medium tracking-tight sm:text-xl">
                  {stat.value}
                </dt>
                <dd className={`mt-1 ${marketingType.caption}`}>{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </MarketingSection>
  );
}
