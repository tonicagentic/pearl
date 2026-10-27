import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Connection authorization" };

/** The provider never sends tokens here. Connect owns its OAuth callback and
 * stores the grant for the signed-in account before returning to this page. */
export default function ConnectionReturnPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-xl border bg-card p-6">
        <h1 className="text-lg font-semibold">Return to Pearl</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Check your connection status to confirm authorization. If you started
          this on a phone, return to the app and refresh the Connections section
          in Settings.
        </p>
        <Link
          className="mt-4 inline-flex min-h-11 items-center text-sm underline underline-offset-2"
          href="/settings/connections"
        >
          Back to connections
        </Link>
      </div>
    </div>
  );
}
