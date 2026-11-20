"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PearlIcon } from "@/components/icons";
import { GithubStarsButton } from "@/components/marketing/github-stars-button";
import { MarketingContainer } from "@/components/marketing/section";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/download", label: "Download" },
  { href: "/pricing", label: "Pricing" },
] as const;

export function MarketingHeader({
  githubStars,
  onGetStarted,
  onSignIn,
}: {
  readonly githubStars: number | null;
  readonly onGetStarted: () => void;
  readonly onSignIn: () => void;
}) {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-background/85 backdrop-blur-md"
      />
      <MarketingContainer className="flex items-center gap-4 py-4">
        <Link className="flex shrink-0 items-center gap-2 text-foreground" href="/">
          <PearlIcon className="size-5" />
          <span className="text-sm font-medium tracking-tight">Pearl</span>
        </Link>

        <nav
          aria-label="Marketing"
          className="hidden items-center gap-1 sm:flex"
        >
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <GithubStarsButton stars={githubStars} />
          <Button
            className="rounded-full"
            onClick={onSignIn}
            size="sm"
            type="button"
            variant="ghost"
          >
            Sign in
          </Button>
          <Button
            className="rounded-full"
            onClick={onGetStarted}
            size="sm"
            type="button"
          >
            Get started
          </Button>
        </div>
      </MarketingContainer>
    </header>
  );
}
