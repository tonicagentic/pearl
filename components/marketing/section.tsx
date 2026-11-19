import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
        "mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-24",
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
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-5xl px-4 sm:px-6", className)}>
      {children}
    </div>
  );
}
