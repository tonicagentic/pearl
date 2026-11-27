import { Redirect, useLocalSearchParams } from "expo-router";

import { PluginDetailScreen } from "@/components/settings/plugin-detail-screen";
import {
  getPluginById,
  isMarketplacePluginId,
} from "@/src/plugins-catalog";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Plugin detail route; requires auth and a known marketplace plugin id. */
export default function PluginDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const pluginId =
    typeof id === "string" ? id : Array.isArray(id) ? id[0] : null;
  if (!pluginId || !isMarketplacePluginId(pluginId)) {
    return <Redirect href="/settings/plugins" />;
  }

  const plugin = getPluginById(pluginId);
  if (!plugin) {
    return <Redirect href="/settings/plugins" />;
  }

  return (
    <RequireSignedIn>
      <PluginDetailScreen plugin={plugin} />
    </RequireSignedIn>
  );
}
