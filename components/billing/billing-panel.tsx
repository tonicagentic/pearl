"use client";

import { Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatUsd } from "@/lib/usage/usage";

type BillingStatus = {
  readonly enabled: boolean;
  readonly allowed: boolean;
  readonly exempt: boolean;
  readonly needsCheckout: boolean;
  readonly reason: string | null;
  readonly message: string | null;
  readonly status: string | null;
  readonly usageCapCents: number | null;
  readonly spentCents: number;
  readonly remainingCents: number | null;
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly hasPortal: boolean;
  readonly bySource: readonly { readonly source: string; readonly costCents: number }[];
};

function centsToUsd(cents: number | null): string {
  if (cents === null) return "—";
  return formatUsd(cents / 100);
}

export function BillingPanel() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [capDollars, setCapDollars] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/billing/status");
      if (!response.ok) {
        setStatus(null);
        return;
      }
      const body = (await response.json()) as BillingStatus;
      setStatus(body);
      if (body.usageCapCents != null) {
        setCapDollars((body.usageCapCents / 100).toFixed(2));
      }
    } catch {
      setError("Could not load billing status.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!status || !status.enabled) {
    return null;
  }

  async function openCheckout() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST" });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !body.url) {
        setError(body.error ?? "Could not start checkout.");
        setPending(false);
        return;
      }
      window.location.assign(body.url);
    } catch {
      setError("Could not start checkout.");
      setPending(false);
    }
  }

  async function openPortal() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !body.url) {
        setError(body.error ?? "Could not open portal.");
        setPending(false);
        return;
      }
      window.location.assign(body.url);
    } catch {
      setError("Could not open portal.");
      setPending(false);
    }
  }

  async function saveCap() {
    setPending(true);
    setError(null);
    const dollars = Number(capDollars);
    if (!Number.isFinite(dollars) || dollars < 0) {
      setError("Enter a non-negative dollar amount.");
      setPending(false);
      return;
    }
    try {
      const response = await fetch("/api/billing/cap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ usageCapCents: Math.round(dollars * 100) }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Could not update cap.");
        setPending(false);
        return;
      }
      await refresh();
      setPending(false);
    } catch {
      setError("Could not update cap.");
      setPending(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div>
        <h2 className="text-sm font-medium">Billing</h2>
        <p className="text-xs text-muted-foreground">
          {status.exempt
            ? "This account has a free pass and is not invoiced."
            : "Subscription plus metered usage for this billing period."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <div className="text-[11px] text-muted-foreground">Spent</div>
          <div className="text-base font-semibold tabular-nums">
            {centsToUsd(status.spentCents)}
          </div>
        </div>
        {!status.exempt ? (
          <>
            <div>
              <div className="text-[11px] text-muted-foreground">Cap</div>
              <div className="text-base font-semibold tabular-nums">
                {centsToUsd(status.usageCapCents)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Remaining</div>
              <div className="text-base font-semibold tabular-nums">
                {centsToUsd(status.remainingCents)}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {status.bySource.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {status.bySource.map((row) => (
            <li
              className="flex justify-between text-muted-foreground"
              key={row.source}
            >
              <span>{row.source}</span>
              <span className="tabular-nums">{centsToUsd(row.costCents)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No metered usage yet this period.</p>
      )}

      {!status.exempt && status.needsCheckout ? (
        <Button disabled={pending} onClick={() => void openCheckout()} type="button">
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          Subscribe — $10/month + usage
        </Button>
      ) : null}

      {!status.exempt && !status.needsCheckout ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
            Usage spend cap (USD)
            <Input
              disabled={pending}
              inputMode="decimal"
              onChange={(event) => setCapDollars(event.target.value)}
              value={capDollars}
            />
          </label>
          <Button
            disabled={pending}
            onClick={() => void saveCap()}
            type="button"
            variant="outline"
          >
            Save cap
          </Button>
          {status.hasPortal ? (
            <Button
              disabled={pending}
              onClick={() => void openPortal()}
              type="button"
              variant="outline"
            >
              Manage card
            </Button>
          ) : null}
        </div>
      ) : null}

      {status.message && !status.allowed && !status.exempt ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">{status.message}</p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
