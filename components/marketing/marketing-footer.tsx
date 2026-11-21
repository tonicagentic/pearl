import Link from "next/link";
import type { ReactNode } from "react";
import { PearlIcon } from "@/components/icons";
import { GITHUB_URL } from "@/components/marketing/constants";
import { MarketingContainer } from "@/components/marketing/section";
import { cn } from "@/lib/utils";

type FooterNavLink = {
  readonly href: string;
  readonly label: string;
  readonly external?: boolean;
};

const PRODUCT_LINKS: readonly FooterNavLink[] = [
  { href: "/#features", label: "Features" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/pricing", label: "Pricing" },
  { href: "/download", label: "Download" },
];

const RESOURCE_LINKS: readonly FooterNavLink[] = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/#faq", label: "FAQ" },
  { href: GITHUB_URL, label: "GitHub", external: true },
];

const COMPANY_LINKS: readonly FooterNavLink[] = [
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

const linkClassName =
  "text-sm font-medium text-foreground transition-colors hover:text-muted-foreground";

const headingClassName =
  "text-xs font-medium tracking-wide text-muted-foreground";

function FooterLink({
  href,
  label,
  external = false,
}: {
  readonly href: string;
  readonly label: string;
  readonly external?: boolean;
}) {
  if (external) {
    return (
      <a
        className={linkClassName}
        href={href}
        rel="noreferrer"
        target="_blank"
      >
        {label}
      </a>
    );
  }

  return (
    <Link className={linkClassName} href={href}>
      {label}
    </Link>
  );
}

function FooterColumn({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <div>
      <p className={headingClassName}>{title}</p>
      <ul className="mt-4 flex flex-col gap-3">{children}</ul>
    </div>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border">
      <MarketingContainer className="py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_repeat(3,1fr)] lg:gap-10">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-foreground"
              href="/"
            >
              <PearlIcon className="size-8" />
              <span className="text-sm font-medium tracking-tight">Pearl</span>
            </Link>
            <p className="mt-4 max-w-xs font-serif text-base leading-relaxed text-foreground/90 italic">
              Your AI sidekick.
            </p>
          </div>

          <FooterColumn title="Product">
            {PRODUCT_LINKS.map((link) => (
              <li key={link.href}>
                <FooterLink href={link.href} label={link.label} />
              </li>
            ))}
            <li>
              <Link
                className={cn(
                  "text-sm text-muted-foreground transition-colors hover:text-foreground",
                )}
                href="/marketplace"
              >
                Explore more →
              </Link>
            </li>
          </FooterColumn>

          <FooterColumn title="Resources">
            {RESOURCE_LINKS.map((link) => (
              <li key={link.label}>
                <FooterLink
                  external={link.external}
                  href={link.href}
                  label={link.label}
                />
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="Company">
            {COMPANY_LINKS.map((link) => (
              <li key={link.href}>
                <FooterLink href={link.href} label={link.label} />
              </li>
            ))}
          </FooterColumn>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © 2026 Tonic Agentic
          </p>
          <p className="text-xs text-muted-foreground sm:text-center">
            We do not sell or share your personal information.
          </p>
          <nav
            aria-label="Legal"
            className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground"
          >
            <Link
              className="transition-colors hover:text-foreground"
              href="/privacy"
            >
              Privacy
            </Link>
            <Link
              className="transition-colors hover:text-foreground"
              href="/terms"
            >
              Terms
            </Link>
          </nav>
        </div>
      </MarketingContainer>
    </footer>
  );
}
