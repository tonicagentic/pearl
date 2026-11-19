import Link from "next/link";
import { MarketingContainer } from "@/components/marketing/section";
import { marketingType } from "@/components/marketing/type";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border">
      <MarketingContainer className="flex flex-col gap-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <p className={marketingType.caption}>Pearl by Tonic Agentic</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href="/about"
          >
            About
          </Link>
          <Link
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href="/privacy"
          >
            Privacy
          </Link>
          <Link
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href="/terms"
          >
            Terms
          </Link>
        </nav>
      </MarketingContainer>
    </footer>
  );
}
