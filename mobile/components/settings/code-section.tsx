import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Code2Icon, FolderGit2Icon } from "lucide-react-native";

import { PluginLogo } from "@/components/settings/plugin-logo";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { SettingsRow } from "@/components/ui/settings-row";
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
 * Profile section for coding. Repos stays here; GitHub, Vercel, and the
 * other build tools open from inside Coder.
 */
export function CodeSection() {
  return (
    <Section title="Code">
      <SettingsRow
        icon={<Icon as={FolderGit2Icon} className="size-5 text-orange-500" />}
        label="Repos"
        detail="Pinned GitHub / Vercel / Expo"
        onPress={() => router.push("/workbench")}
        showSeparator
      />
      <SettingsRow
        icon={<Icon as={Code2Icon} className="size-5 text-emerald-600" />}
        label="Coder"
        detail="Build, PR, deploy"
        onPress={() => router.push("/plugins/coder")}
      />
    </Section>
  );
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
            className={`max-w-[28%] text-right text-[13px] font-medium ${trailingAccent ? "text-primary" : "text-muted-foreground"}`}
            numberOfLines={2}
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
