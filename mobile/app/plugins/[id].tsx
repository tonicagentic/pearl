import { Redirect, useLocalSearchParams } from "expo-router";

import { PluginDetailScreen } from "@/components/plugin-detail-screen";
import { getPluginById, isMarketplacePluginId } from "../../../lib/plugins/catalog";
import { useAuth } from "@/src/auth";

/** Plugin detail route; requires auth and a known marketplace plugin id. */
export default function PluginDetailRoute() {
  const { signedIn } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!signedIn) return <Redirect href="/" />;

  const pluginId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : null;
  if (!pluginId || !isMarketplacePluginId(pluginId)) {
    return <Redirect href="/plugins" />;
  }

  const plugin = getPluginById(pluginId);
  if (!plugin) return <Redirect href="/plugins" />;

  return <PluginDetailScreen plugin={plugin} />;
}
