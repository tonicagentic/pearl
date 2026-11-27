"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const NAV = [
  { href: "/finances", label: "Spend", match: (p: string) => p === "/finances" },
  {
    href: "/finances/transactions",
    label: "Transactions",
    match: (p: string) => p.startsWith("/finances/transactions"),
  },
  {
    href: "/finances/reconcile",
    label: "Reconcile",
    match: (p: string) => p.startsWith("/finances/reconcile"),
  },
  {
    href: "/finances/connections",
    label: "Connections",
    match: (p: string) => p.startsWith("/finances/connections"),
  },
  {
    href: "/finances/accounts",
    label: "Chart of accounts",
    match: (p: string) => p.startsWith("/finances/accounts"),
  },
  {
    href: "/finances/tasks",
    label: "Tasks",
    match: (p: string) => p.startsWith("/finances/tasks"),
  },
] as const;

export function FinancesShell({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname() ?? "/finances";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="h-full overflow-y-auto px-4 pt-14 pb-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <nav
            className="flex flex-wrap gap-1 border-b pb-2"
            aria-label="Finances"
          >
            {NAV.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {children}
        </div>
      </div>
    </div>
  );
}

export function FinancesLoading({
  label = "Loading…",
}: {
  readonly label?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function FinancesCard({
  title = "Finances",
  message,
}: {
  readonly title?: string;
  readonly message: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-base font-medium">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
