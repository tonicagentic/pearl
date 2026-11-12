"use client";

import { Loader2Icon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { blockMessage, type BillingBlockReason } from "@/lib/billing/config";

export function BillingCheckoutClient({
  reason,
}: {
  readonly reason: BillingBlockReason | null;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          successPath: "/billing/success",
          cancelPath: "/billing",
        }),
      });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !body.url) {
        setError(body.error ?? "Could not start checkout.");
        setPending(false);
        return;
      }
      window.location.assign(body.url);
    } catch {
      setError("Could not start checkout. Check your connection.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      {reason && reason !== "unpaid" ? (
        <p className="text-sm text-muted-foreground">{blockMessage(reason)}</p>
      ) : null}
      <Button
        aria-busy={pending}
        className="h-11 w-full"
        disabled={pending}
        onClick={() => void startCheckout()}
        type="button"
      >
        {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
        {pending ? "Redirecting to Stripe…" : "Continue to Stripe"}
      </Button>
      {error ? (
        <p aria-live="polite" className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        You will not be able to chat until the subscription is active. Usage is
        billed separately at the end of each period.
      </p>
    </div>
  );
}
