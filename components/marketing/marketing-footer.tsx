import Link from "next/link";
import { GITHUB_URL } from "@/components/marketing/constants";
import { MarketingContainer } from "@/components/marketing/section";
import { marketingType } from "@/components/marketing/type";

const FOOTER_LINKS = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/download", label: "Download" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
] as const;

export function MarketingFooter() {
  return (
    <footer className="border-t border-border">
      <MarketingContainer className="flex flex-col gap-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <p className={marketingType.caption}>Pearl by Tonic Agentic</p>
        <nav
          aria-label="Footer"
          className="flex flex-wrap gap-x-5 gap-y-2 text-sm"
        >
          {FOOTER_LINKS.map((link) => (
            <Link
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
          <a
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href={GITHUB_URL}
            rel="noreferrer"
            target="_blank"
          >
            GitHub
          </a>
        </nav>
      </MarketingContainer>
    </footer>
  );
}
