"use client";

import Link from "next/link";
import { PearlIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { MarketingContainer } from "@/components/marketing/section";

export function MarketingHeader({
  onGetStarted,
  onSignIn,
}: {
  readonly onGetStarted: () => void;
  readonly onSignIn: () => void;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-background/85 backdrop-blur-md"
      />
      <MarketingContainer className="flex items-center justify-between gap-4 py-4">
        <Link
          className="flex items-center gap-2 text-foreground"
          href="/"
        >
          <PearlIcon className="size-5" />
          <span className="text-sm font-medium tracking-tight">Pearl</span>
        </Link>
        <div className="flex items-center gap-2">
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
