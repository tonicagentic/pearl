import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import {
  getPluginById,
  isMarketplacePluginId,
} from "@/lib/plugins/catalog";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";
import { PluginDetailClient } from "./detail-client";

type PageProps = {
  readonly params: Promise<{ id: string }>;
};

/** Plugin detail needs auth + dynamic id; do not require instant UI. */
export const instant = false;

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const plugin = isMarketplacePluginId(id) ? getPluginById(id) : null;
  return { title: plugin?.label ?? "Plugin" };
}

export default function PluginDetailPage({ params }: PageProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="h-full overflow-y-auto px-4 pt-14 pb-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">Loading plugin…</p>
            }
          >
            <AuthenticatedPluginDetail params={params} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function AuthenticatedPluginDetail({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isMarketplacePluginId(id)) notFound();
  const plugin = getPluginById(id);
  if (!plugin) notFound();

  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup);
  if (!viewer) {
    redirect("/");
  }
  return <PluginDetailClient plugin={plugin} />;
}
