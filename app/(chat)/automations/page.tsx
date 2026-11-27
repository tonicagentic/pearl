import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2Icon } from "lucide-react";

import { AutomationsPanel } from "./automations-panel";

export const metadata: Metadata = {
  title: "Automations",
};

/**
 * Automations hub. CRUD goes through the pearl-automation channel routes
 * at /api/automations (eve context + dynamic schedules).
 */
export default function AutomationsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="h-full overflow-y-auto px-4 pt-14 pb-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <Suspense
            fallback={
              <div className="flex justify-center py-16 text-muted-foreground">
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            }
          >
            <AutomationsPanel />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
