import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { BillingCheckoutClient } from "@/app/billing/billing-checkout-client";
import { getBillingAccess, isBillingActive } from "@/lib/billing/accounts";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export const metadata: Metadata = {
  title: "Subscribe",
};

export default function BillingPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center gap-6 px-4 py-16">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <ResolvedBilling />
      </Suspense>
    </div>
  );
}

async function ResolvedBilling() {
  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup);

  if (!viewer) {
    redirect("/");
  }

  if (!(await isBillingActive())) {
    redirect("/");
  }

  const access = await getBillingAccess(viewer.id);

  if (access.exempt) {
    redirect("/");
  }

  if (access.allowed) {
    redirect("/settings");
  }

  return (
    <>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Subscribe to Pearl</h1>
        <p className="text-sm text-muted-foreground">
          $10 per month, plus usage for models, research, sandboxes, and
          images. New accounts start with a $50 monthly usage cap you can
          raise anytime.
        </p>
      </header>
      <BillingCheckoutClient reason={access.reason} />
    </>
  );
}
