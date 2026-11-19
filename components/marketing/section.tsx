import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared marketing width + horizontal padding.
 * Matches x.ai/bot section containers: full width until xl, then max-w-7xl
 * (1280px), with px-4 → lg:px-6.
 */
export const marketingContainerClassName =
  "mx-auto w-full px-4 lg:px-6 xl:max-w-7xl";

/**
 * Hero / denser copy width on x.ai/bot (`--site-content-width: 64rem`) with
 * sm padding step instead of lg.
 */
export const marketingContentWidthClassName =
  "mx-auto w-full max-w-[var(--site-content-width,64rem)] px-4 sm:px-6";

export function MarketingSection({
  children,
  className,
  id,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly id?: string;
}) {
  return (
    <section
      className={cn(
        marketingContainerClassName,
        "py-16 sm:py-24",
        className,
      )}
      id={id}
    >
      {children}
    </section>
  );
}

/** Width + horizontal padding only — used by hero and header for custom vertical rhythm. */
export function MarketingContainer({
  children,
  className,
  narrow = false,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  /** Use the 64rem content width (hero). Default is the section xl:max-w-7xl shell. */
  readonly narrow?: boolean;
}) {
  return (
    <div
      className={cn(
        narrow ? marketingContentWidthClassName : marketingContainerClassName,
        className,
      )}
    >
      {children}
    </div>
  );
}
