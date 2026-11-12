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

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const plugin = isMarketplacePluginId(id) ? getPluginById(id) : null;
  return { title: plugin?.label ?? "Plugin" };
}

export default async function PluginDetailPage({ params }: PageProps) {
  const { id } = await params;
  if (!isMarketplacePluginId(id)) notFound();
  const plugin = getPluginById(id);
  if (!plugin) notFound();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="h-full overflow-y-auto px-4 pt-14 pb-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">Loading plugin…</p>
            }
          >
            <AuthenticatedPluginDetail plugin={plugin} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function AuthenticatedPluginDetail({
  plugin,
}: {
  readonly plugin: NonNullable<ReturnType<typeof getPluginById>>;
}) {
  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup);
  if (!viewer) {
    redirect("/");
  }
  return <PluginDetailClient plugin={plugin} />;
}
