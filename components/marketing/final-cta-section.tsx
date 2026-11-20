import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MarketingSection } from "@/components/marketing/section";
import { marketingType } from "@/components/marketing/type";

export function FinalCtaSection({
  onGetStarted,
}: {
  readonly onGetStarted: () => void;
}) {
  return (
    <MarketingSection id="get-started">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <h2 className={marketingType.sectionTitle}>
          Take it from here, Pearl.
        </h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <Button
            className="rounded-full"
            onClick={onGetStarted}
            type="button"
          >
            Get started
          </Button>
          <Button asChild className="rounded-full" variant="outline">
            <Link href="/download">Download</Link>
          </Button>
        </div>
      </div>
    </MarketingSection>
  );
}
