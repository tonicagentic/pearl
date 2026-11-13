import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";

import { PluginLogo } from "@/components/plugin-logo";
import { SheetScaffold } from "@/components/sheet-scaffold";
import {
  PLUGIN_SECTIONS,
  isConnectablePlugin,
  pluginsForSection,
  type PluginCatalogEntry,
  type PluginMarkId,
  type ResolvedPlugin,
} from "../../lib/plugins/catalog";
import {
  getConnections,
  type ConnectionStatus,
} from "@/src/connections-client";

/**
 * Plugins list: sectioned catalog rows that open detail screens.
 */
export function PluginsScreen() {
  const [connections, setConnections] = useState<ConnectionStatus[] | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const statusById = new Map(
    (connections ?? []).map((item) => [item.id, item] as const),
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setConnections(await getConnections());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load plugins.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SheetScaffold>
      <Text className="px-1 text-[13px] leading-[18px] text-muted-foreground">
        Connect accounts Pearl can use, and see built-in tools from Pearl and
        Tonic Agentic.
      </Text>

      <Pressable
        accessibilityRole="button"
        disabled={loading}
        onPress={() => void load()}
        className="min-h-11 self-start justify-center rounded-[10px] bg-card px-4 disabled:opacity-50"
      >
        <Text className="text-[17px] text-foreground">
          {loading ? "Loading…" : "Refresh accounts"}
        </Text>
      </Pressable>

      {loading && !connections ? (
        <ActivityIndicator accessibilityLabel="Loading plugins" />
      ) : null}
      {error ? (
        <Text
          accessibilityRole="alert"
          className="px-1 text-[13px] text-destructive"
        >
          {error}
        </Text>
      ) : null}

      {PLUGIN_SECTIONS.map((section) => {
        const plugins = pluginsForSection(section);
        if (plugins.length === 0) return null;
        return (
          <PluginSection key={section.id} title={section.title}>
            {plugins.map((plugin, index) => (
              <CatalogRow
                key={plugin.id}
                plugin={plugin}
                trailing={trailingForPlugin(plugin, statusById)}
                trailingAccent={
                  isConnectablePlugin(plugin) &&
                  (statusById.get(plugin.connectionId)?.status ===
                    "not-connected" ||
                    statusById.get(plugin.connectionId)?.status ===
                      "available")
                }
                showSeparator={index < plugins.length - 1}
              />
            ))}
          </PluginSection>
        );
      })}
    </SheetScaffold>
  );
}

function trailingForPlugin(
  plugin: ResolvedPlugin,
  statusById: Map<string, ConnectionStatus>,
): string {
  if (plugin.kind === "coming_soon") return "Coming soon";
  if (plugin.kind === "builtin") return "Enabled";
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

function PluginSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <View className="gap-1.5">
      <Text className="px-1 text-[13px] font-medium text-muted-foreground">
        {title}
      </Text>
      <View className="overflow-hidden rounded-[18px] bg-card">{children}</View>
    </View>
  );
}

function CatalogRow({
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
            <Text className="text-[17px] font-medium leading-[22px] text-foreground">
              {plugin.label}
            </Text>
            <Text
              className="text-[13px] leading-[18px] text-muted-foreground"
              numberOfLines={2}
            >
              {plugin.detail}
            </Text>
          </View>
          <Text
            className={`text-[13px] font-medium ${trailingAccent ? "text-primary" : "text-muted-foreground"}`}
          >
            {trailing}
          </Text>
          <Text className="text-[20px] font-light text-muted-foreground/40">
            ›
          </Text>
        </View>
      </Pressable>
      {showSeparator ? <View className="ml-[68px] h-px bg-border" /> : null}
    </View>
  );
}
