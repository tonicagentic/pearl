import { Pressable, View } from "react-native";
import { router } from "expo-router";

import { PluginLogo } from "@/components/settings/plugin-logo";
import { Text } from "@/components/ui/text";
import {
  PLUGIN_SECTIONS,
  isConnectablePlugin,
  pluginsForSection,
  type PluginCatalogEntry,
  type PluginMarkId,
  type ResolvedPlugin,
} from "../../../lib/plugins/catalog";
import type { ConnectionStatus } from "@/src/connections-client";

const CODE_SECTION_ID = "build";

function codingPlugins(): readonly ResolvedPlugin[] {
  const section = PLUGIN_SECTIONS.find((item) => item.id === CODE_SECTION_ID);
  return section ? pluginsForSection(section) : [];
}

/** GitHub, Vercel, and the other coding tools, nested under Coder. */
function coderToolPlugins(): readonly ResolvedPlugin[] {
  return codingPlugins().filter((plugin) => plugin.id !== "coder");
}

/**
 * Accounts and tools Coder uses. Rendered on the Coder screen.
 */
export function CoderToolsList({
  connections,
}: {
  readonly connections: readonly ConnectionStatus[] | null;
}) {
  const plugins = coderToolPlugins();
  const statusById = new Map(
    (connections ?? []).map((item) => [item.id, item] as const),
  );

  return (
    <>
      {plugins.map((plugin, index) => (
        <CodePluginRow
          key={plugin.id}
          plugin={plugin}
          trailing={trailingForPlugin(plugin, statusById)}
          trailingAccent={
            isConnectablePlugin(plugin) &&
            (statusById.get(plugin.connectionId)?.status === "not-connected" ||
              statusById.get(plugin.connectionId)?.status === "available")
          }
          showSeparator={index < plugins.length - 1}
        />
      ))}
    </>
  );
}

/** Connected accounts that still appear on the Plugins screen. */
export function connectedPluginCount(
  connections: readonly ConnectionStatus[],
): number {
  const ids = new Set<string>(
    PLUGIN_SECTIONS.filter((section) => section.id !== CODE_SECTION_ID).flatMap(
      (section) =>
        pluginsForSection(section).flatMap((plugin) =>
          isConnectablePlugin(plugin) ? [plugin.connectionId] : [],
        ),
    ),
  );
  return connections.filter(
    (item) => item.status === "connected" && ids.has(item.id),
  ).length;
}

function trailingForPlugin(
  plugin: ResolvedPlugin,
  statusById: Map<string, ConnectionStatus>,
): string {
  if (plugin.kind === "coming_soon") return "Coming soon";
  if (plugin.kind === "builtin") return "Enabled";
  if (plugin.kind === "credential") return "Connect";
  if (!isConnectablePlugin(plugin)) return "…";
  return trailingForStatus(statusById.get(plugin.connectionId));
}

function trailingForStatus(status: ConnectionStatus | undefined): string {
  if (!status) return "…";
  if (status.status === "connected") {
    return status.accountLabel?.trim() || "Connected";
  }
  if (status.status === "unavailable") return "Unavailable";
  return "Connect";
}

function CodePluginRow({
  plugin,
  trailing,
  trailingAccent,
  showSeparator,
}: {
  readonly plugin: ResolvedPlugin | PluginCatalogEntry;
  readonly trailing: string;
  readonly trailingAccent?: boolean;
  readonly showSeparator?: boolean;
}) {
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={plugin.label}
        className="active:bg-muted/80"
        onPress={() => router.push(`/plugins/${plugin.id}`)}
      >
        <View className="flex-row items-center gap-3 px-4 py-3.5">
          <PluginLogo id={plugin.id as PluginMarkId} />
          <View className="min-w-0 flex-1 gap-0.5">
            <Text variant="label">{plugin.label}</Text>
            <Text variant="secondary" numberOfLines={2}>
              {plugin.detail}
            </Text>
          </View>
          <Text
            variant="secondary"
            tone={trailingAccent ? "primary" : "muted"}
            weight="medium"
            className="max-w-[28%] text-right"
            numberOfLines={2}
          >
            {trailing}
          </Text>
          <Text variant="title" tone="muted" weight="light" className="opacity-40">
            ›
          </Text>
        </View>
      </Pressable>
      {showSeparator ? <View className="ml-[68px] h-px bg-border" /> : null}
    </View>
  );
}
