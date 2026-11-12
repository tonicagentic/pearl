"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export function BillingSuccessClient() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const response = await fetch("/api/billing/status");
        const body = (await response.json()) as {
          allowed?: boolean;
          exempt?: boolean;
          error?: string;
        };
        if (cancelled) return;
        if (body.allowed || body.exempt) {
          router.replace("/");
          router.refresh();
          return;
        }
        setAttempts((n) => n + 1);
        timer = setTimeout(() => void poll(), 2000);
      } catch {
        if (!cancelled) {
          setError("Could not confirm subscription status.");
        }
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [router]);

  return (
    <div className="space-y-3 rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        Waiting for Stripe ({attempts})…
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        className="w-full"
        onClick={() => {
          router.refresh();
        }}
        type="button"
        variant="outline"
      >
        Refresh
      </Button>
    </div>
  );
}
