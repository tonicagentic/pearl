import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { BillingSuccessClient } from "@/app/billing/success/billing-success-client";
import { getBillingAccess, isBillingActive } from "@/lib/billing/accounts";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export const metadata: Metadata = {
  title: "Subscription",
};

export default function BillingSuccessPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center gap-6 px-4 py-16">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Confirming…</p>}>
        <ResolvedSuccess />
      </Suspense>
    </div>
  );
}

async function ResolvedSuccess() {
  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup);

  if (!viewer) {
    redirect("/");
  }

  if (!(await isBillingActive())) {
    redirect("/");
  }

  const access = await getBillingAccess(viewer.id);
  if (access.exempt || access.allowed) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">You are ready</h1>
        <p className="text-sm text-muted-foreground">
          Your subscription is active. Start a chat whenever you like.
        </p>
        <Link className="text-sm font-medium underline" href="/">
          Go to chat
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Confirming payment</h1>
      <p className="text-sm text-muted-foreground">
        Stripe is finishing checkout. This page unlocks only after the webhook
        marks your subscription active.
      </p>
      <BillingSuccessClient />
    </>
  );
}
