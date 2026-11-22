import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { Stack, router, useFocusEffect } from "expo-router";

import { PluginLogo } from "@/components/settings/plugin-logo";
import { SheetScaffold } from "@/components/settings/sheet-scaffold";
import { SettingsCard } from "@/components/ui/settings-card";
import { Text } from "@/components/ui/text";
import {
  listCalendarAccounts,
  type IcloudCalendarAccountSummary,
} from "@/src/calendar-accounts-client";
import {
  getConnections,
  type ConnectionId,
  type ConnectionStatus,
} from "@/src/connections-client";
import type { PluginMarkId } from "../../../lib/plugins/catalog";

type SourceId = "web" | ConnectionId | "icloud-calendar";

type AnswerSource = {
  readonly id: SourceId;
  readonly label: string;
  readonly detail: string;
  readonly logo: PluginMarkId;
};

const SOURCES: readonly AnswerSource[] = [
  {
    id: "web",
    label: "Web",
    detail: "Search and public pages",
    logo: "browser",
  },
  {
    id: "gmail",
    label: "Gmail",
    detail: "Threads and messages",
    logo: "gmail",
  },
  {
    id: "icloud-calendar",
    label: "iCloud Calendar",
    detail: "Events and availability",
    logo: "icloud-calendar",
  },
  {
    id: "github",
    label: "GitHub Activity",
    detail: "Repos, issues, and pull requests",
    logo: "github",
  },
  {
    id: "vercel",
    label: "Vercel Activity",
    detail: "Projects and deployments",
    logo: "vercel",
  },
  {
    id: "betterstack",
    label: "Better Stack",
    detail: "Monitors, incidents, and logs",
    logo: "betterstack",
  },
  {
    id: "calendar",
    label: "Google Calendar",
    detail: "Events and availability",
    logo: "calendar",
  },
  {
    id: "drive",
    label: "Google Drive",
    detail: "Files you can open",
    logo: "drive",
  },
  {
    id: "sheets",
    label: "Google Sheets",
    detail: "Spreadsheets",
    logo: "sheets",
  },
  {
    id: "expo",
    label: "Expo",
    detail: "Projects and builds",
    logo: "expo",
  },
  {
    id: "neon",
    label: "Neon",
    detail: "Projects and schema",
    logo: "neon",
  },
  {
    id: "tempo",
    label: "Tempo",
    detail: "People, companies, and deals",
    logo: "tempo",
  },
  {
    id: "xero",
    label: "Xero",
    detail: "Organisations and spend",
    logo: "xero",
  },
];

type IcloudSnapshot = {
  readonly accounts: readonly IcloudCalendarAccountSummary[];
  readonly available: boolean;
};

/**
 * Profile → Answers, laid out like Coder: mark, summary, then a source list
 * with connection status on the trailing side.
 */
export function AnswersScreen() {
  const [connections, setConnections] = useState<
    readonly ConnectionStatus[] | null
  >(null);
  const [icloud, setIcloud] = useState<IcloudSnapshot | null>(null);
  const [ready, setReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.allSettled([getConnections(), listCalendarAccounts()]).then(
        ([connectionsResult, icloudResult]) => {
          if (cancelled) return;
          setConnections(
            connectionsResult.status === "fulfilled"
              ? connectionsResult.value
              : null,
          );
          setIcloud(
            icloudResult.status === "fulfilled"
              ? {
                  accounts: icloudResult.value.accounts,
                  available: icloudResult.value.available,
                }
              : null,
          );
          setReady(true);
        },
      );
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const visible = SOURCES.filter((source) =>
    showSource(source, connections, icloud, ready),
  );

  return (
    <>
      <Stack.Screen options={{ title: "Answers" }} />
      <SheetScaffold>
        <View className="flex-row items-start gap-4 px-1">
          <PluginLogo id="search" size={56} />
          <View className="min-w-0 flex-1 gap-1">
            <Text variant="title">Answers</Text>
            <Text variant="body" tone="muted">
              Web and connected accounts
            </Text>
          </View>
        </View>

        <Text variant="body" className="px-1">
          Pearl answers from the web and from accounts you connect, including
          mail, calendars, and activity on GitHub, Vercel, and Better Stack.
        </Text>

        <View className="gap-1.5">
          <Text variant="secondary" weight="medium" className="px-1">
            Sources
          </Text>
          <Text variant="secondary" className="px-1">
            Web is always on. Connected accounts show up here too.
          </Text>
          <SettingsCard>
            {visible.map((source, index) => {
              const trailing = trailingForSource(source, connections, icloud);
              return (
                <SourceRow
                  key={source.id}
                  source={source}
                  trailing={trailing.text}
                  trailingAccent={trailing.accent}
                  showSeparator={index < visible.length - 1}
                />
              );
            })}
          </SettingsCard>
        </View>
      </SheetScaffold>
    </>
  );
}

function showSource(
  source: AnswerSource,
  connections: readonly ConnectionStatus[] | null,
  icloud: IcloudSnapshot | null,
  ready: boolean,
): boolean {
  if (source.id === "web") return true;
  if (source.id === "icloud-calendar") {
    if (!ready || icloud == null) return true;
    return (
      icloud.available ||
      icloud.accounts.some((account) => account.status === "connected")
    );
  }
  if (source.id === "sheets" || source.id === "xero") {
    return (
      connections?.find((item) => item.id === source.id)?.status === "connected"
    );
  }
  if (!ready || connections == null) return true;
  const status = connections.find((item) => item.id === source.id);
  return status != null && status.status !== "unavailable";
}

function trailingForSource(
  source: AnswerSource,
  connections: readonly ConnectionStatus[] | null,
  icloud: IcloudSnapshot | null,
): { readonly text: string; readonly accent: boolean } {
  if (source.id === "web") return { text: "On", accent: false };
  if (source.id === "icloud-calendar") {
    if (icloud == null) return { text: "…", accent: false };
    const connected = icloud.accounts.filter(
      (account) => account.status === "connected",
    );
    if (connected.length === 0) return { text: "Connect", accent: true };
    if (connected.length === 1) {
      const account = connected[0];
      return {
        text: account.nickname?.trim() || account.appleId,
        accent: false,
      };
    }
    return { text: `${connected.length} accounts`, accent: false };
  }
  const status = connections?.find((item) => item.id === source.id);
  if (!status) return { text: "…", accent: false };
  if (status.status === "connected") {
    return {
      text: status.accountLabel?.trim() || "Connected",
      accent: false,
    };
  }
  if (status.status === "unavailable") {
    return { text: "Unavailable", accent: false };
  }
  if (status.status === "unknown") return { text: "…", accent: false };
  return { text: "Connect", accent: true };
}

function pluginHref(id: SourceId): `/settings/plugins/${string}` | null {
  if (id === "web" || id === "sheets" || id === "xero") return null;
  return `/settings/plugins/${id}`;
}

function SourceRow({
  source,
  trailing,
  trailingAccent,
  showSeparator,
}: {
  readonly source: AnswerSource;
  readonly trailing: string;
  readonly trailingAccent: boolean;
  readonly showSeparator: boolean;
}) {
  const href = pluginHref(source.id);
  const body = (
    <View className="flex-row items-center gap-3 px-4 py-3.5">
      <PluginLogo id={source.logo} />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text variant="label">{source.label}</Text>
        <Text variant="secondary" numberOfLines={2}>
          {source.detail}
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
      <Text
        accessibilityElementsHidden={!href}
        importantForAccessibility={href ? "auto" : "no"}
        variant="title"
        tone="muted"
        weight="light"
        className={href ? "opacity-40" : "opacity-0"}
      >
        ›
      </Text>
    </View>
  );

  return (
    <View>
      {href ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={source.label}
          className="active:bg-muted/80"
          onPress={() => router.push(href)}
        >
          {body}
        </Pressable>
      ) : (
        body
      )}
      {showSeparator ? <View className="ml-[68px] h-px bg-border" /> : null}
    </View>
  );
}
