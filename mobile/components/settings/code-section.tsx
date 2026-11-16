import { Alert, Pressable, View } from "react-native";
import { router } from "expo-router";
import {
  BriefcaseIcon,
  CalendarIcon,
  ClipboardListIcon,
  Code2Icon,
  FolderOpenIcon,
  HeartIcon,
  ImageIcon,
  LayoutTemplateIcon,
  MailIcon,
  MessageCircleQuestionIcon,
  MonitorIcon,
  PenLineIcon,
  ScanSearchIcon,
  ShoppingBagIcon,
} from "lucide-react-native";

import { PluginLogo } from "@/components/settings/plugin-logo";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { SettingsRow } from "@/components/ui/settings-row";
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

function comingSoon(label: string) {
  Alert.alert(label, "This capability is coming soon.");
}

/**
 * Capabilities section: Answers first, then Coder, Computer Use, Email,
 * Calendar, and the other product capabilities. Money is its own group
 * above this section. GitHub, Vercel, and the other build tools open
 * from inside Coder.
 */
export function CodeSection({
  emailDetail,
  calendarDetail,
}: {
  readonly emailDetail: string;
  readonly calendarDetail: string;
}) {
  return (
    <Section title="Capabilities">
      <SettingsRow
        icon={
          <Icon
            as={MessageCircleQuestionIcon}
            className="size-5 text-sky-500"
          />
        }
        label="Answers"
        detail="Web and connected accounts"
        onPress={() => router.push("/answers")}
        showSeparator
      />
      <SettingsRow
        icon={<Icon as={Code2Icon} className="size-5 text-emerald-600" />}
        label="Coder"
        detail="Build, PR, deploy"
        onPress={() => router.push("/plugins/coder")}
        showSeparator
      />
      <SettingsRow
        icon={<Icon as={MonitorIcon} className="size-5 text-sky-600" />}
        label="Computer Use"
        detail="Browser and sandboxes"
        onPress={() => router.push("/computer-use")}
        showSeparator
      />
      <SettingsRow
        icon={<Icon as={MailIcon} className="size-5 text-sky-600" />}
        label="Email"
        detail={emailDetail}
        onPress={() => router.push("/email")}
        showSeparator
      />
      <SettingsRow
        icon={<Icon as={CalendarIcon} className="size-5 text-rose-500" />}
        label="Calendar"
        detail={calendarDetail}
        onPress={() => router.push("/calendar")}
        showSeparator
      />
      <SettingsRow
        icon={<Icon as={ScanSearchIcon} className="size-5 text-violet-500" />}
        label="Research"
        detail="Deep research with citations"
        onPress={() => router.push("/research")}
        showSeparator
      />
      <SettingsRow
        icon={<Icon as={ClipboardListIcon} className="size-5 text-amber-500" />}
        label="Plan"
        detail="Travel and how you plan"
        onPress={() => router.push("/plan")}
        showSeparator
      />
      <SettingsRow
        icon={<Icon as={HeartIcon} className="size-5 text-rose-500" />}
        label="Health"
        detail="Coming soon"
        onPress={() => comingSoon("Health")}
        showSeparator
      />
      <SettingsRow
        icon={<Icon as={PenLineIcon} className="size-5 text-indigo-500" />}
        label="Drafting"
        detail="Writing and style"
        onPress={() => router.push("/drafting")}
        showSeparator
      />
      <SettingsRow
        icon={<Icon as={ShoppingBagIcon} className="size-5 text-orange-500" />}
        label="Shop"
        detail="Clothing sizes"
        onPress={() => router.push("/shop")}
        showSeparator
      />
      <SettingsRow
        icon={<Icon as={ImageIcon} className="size-5 text-fuchsia-500" />}
        label="Visualize"
        detail="Graphics, diagrams, images"
        onPress={() => router.push("/visualize")}
        showSeparator
      />
      <SettingsRow
        icon={
          <Icon as={LayoutTemplateIcon} className="size-5 text-violet-500" />
        }
        label="Design"
        detail="Presentations, documents, layouts"
        onPress={() => router.push("/design")}
        showSeparator
      />
      <SettingsRow
        icon={<Icon as={FolderOpenIcon} className="size-5 text-sky-600" />}
        label="Files"
        detail="Analysis and storage"
        onPress={() => router.push("/files")}
        showSeparator
      />
      <SettingsRow
        icon={<Icon as={BriefcaseIcon} className="size-5 text-teal-600" />}
        label="Small Business"
        detail="CRM, payments, and store tools"
        onPress={() => router.push("/plugins/tempo")}
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
