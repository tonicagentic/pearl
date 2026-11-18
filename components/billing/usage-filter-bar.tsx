import Link from "next/link";

import { cn } from "@/lib/utils";

export type UsageFilterChip = {
  readonly href: string;
  readonly label: string;
  readonly active: boolean;
};

/**
 * Compact chip row for settings Usage. Plain links so the page stays a
 * server component while the filter window lives in the URL.
 */
export function UsageFilterBar({
  chips,
}: {
  readonly chips: readonly UsageFilterChip[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.href + chip.label}
          href={chip.href}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            chip.active
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          {chip.label}
        </Link>
      ))}
    </div>
  );
}
