import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import { Stack, router, useFocusEffect } from "expo-router";

import { CoderToolsList } from "@/components/settings/code-section";
import { PluginLogo } from "@/components/settings/plugin-logo";
import { SheetScaffold } from "@/components/settings/sheet-scaffold";
import { SettingsCard } from "@/components/ui/settings-card";
import {
  capabilitiesForConnection,
  capabilitiesForPlugin,
  type PluginCapabilities,
} from "../../../lib/plugins/capabilities";
import {
  isConnectablePlugin,
  type ResolvedPlugin,
} from "../../../lib/plugins/catalog";
import {
  authorizeConnection,
  getConnectionGrants,
  getConnections,
  revokeConnection,
  type ConnectionGrantSummary,
  type ConnectionId,
  type ConnectionStatus,
} from "@/src/connections-client";
import {
  listMailboxes,
  type MailboxClientSummary,
} from "@/src/mailboxes-client";

function validatedHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() !== value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !!url.hostname &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

const STATUS_LABEL: Record<ConnectionGrantSummary["status"], string> = {
  available: "Available",
  connected: "Connected",
  "not-connected": "Not connected",
  unavailable: "Unavailable",
  unknown: "Unable to verify",
};

/** Plugin detail: capability copy plus connection actions when applicable. */
export function PluginDetailScreen({
  plugin,
}: {
  readonly plugin: ResolvedPlugin;
}) {
  const builtinCapabilities =
    plugin.kind === "builtin" ? capabilitiesForPlugin(plugin.id) : null;

  return (
    <>
      <Stack.Screen options={{ title: plugin.label }} />
      <SheetScaffold>
        <View className="flex-row items-start gap-4 px-1">
          <PluginLogo id={plugin.id} size={56} />
          <View className="min-w-0 flex-1 gap-1">
            <Text className="text-[22px] font-semibold leading-[28px] text-foreground">
              {plugin.label}
            </Text>
            <Text className="text-[15px] leading-[20px] text-muted-foreground">
              {plugin.detail}
            </Text>
          </View>
        </View>

        <Text className="px-1 text-[15px] leading-[22px] text-foreground">
          {plugin.description}
        </Text>

        {isConnectablePlugin(plugin) ? (
          plugin.connectionId === "gmail" ? (
            <GmailMailboxSummaryPanel />
          ) : (
            <ConnectionPanel
              connectionId={plugin.connectionId}
              pluginLabel={plugin.label}
            />
          )
        ) : plugin.kind === "builtin" ? (
          <>
            <StatusCard
              title="Enabled"
              body="This capability ships with Pearl and does not need a separate account connection."
            />
            {builtinCapabilities ? (
              <CapabilitiesCard
                capabilities={builtinCapabilities}
                heading="What Pearl can do"
              />
            ) : null}
            {plugin.id === "coder" ? <CoderTools /> : null}
          </>
        ) : (
          <StatusCard
            title="Coming soon"
            body="This plugin is listed for the catalog preview. Connect will appear here when the connector ships."
          />
        )}
      </SheetScaffold>
    </>
  );
}

function GmailMailboxSummaryPanel() {
  const [mailboxes, setMailboxes] = useState<
    readonly MailboxClientSummary[] | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const capabilities = capabilitiesForConnection("gmail");
  const connectedCount =
    mailboxes?.filter((item) => item.status === "connected").length ?? 0;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void listMailboxes()
        .then((next) => {
          if (!cancelled) {
            setMailboxes(next);
            setError(null);
          }
        })
        .catch((cause) => {
          if (!cancelled) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Could not load mailboxes.",
            );
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <View className="gap-4">
      <View className="gap-3 rounded-[18px] bg-card px-4 py-4">
        <Text className="text-[17px] font-medium text-foreground">
          Gmail accounts
        </Text>
        <Text className="text-[13px] leading-[18px] text-muted-foreground">
          {loading && mailboxes == null
            ? "Loading…"
            : connectedCount === 0
              ? "None connected"
              : `${connectedCount} connected`}
        </Text>
        {mailboxes?.map((mailbox) => (
          <Text
            key={mailbox.id}
            className="text-[15px] text-foreground"
            numberOfLines={1}
          >
            {mailbox.nickname?.trim()
              ? `${mailbox.nickname.trim()} · ${mailbox.emailLabel ?? "Gmail"}`
              : (mailbox.emailLabel ?? "Gmail account")}
            {mailbox.status === "connected" && !mailbox.canModify
              ? " · needs reconnect"
              : ""}
          </Text>
        ))}
        {error ? (
          <Text
            accessibilityRole="alert"
            className="text-[13px] text-destructive"
          >
            {error}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/email")}
          className="min-h-11 justify-center self-start rounded-[10px] bg-muted px-4"
        >
          <Text className="text-[15px] text-foreground">Manage Email</Text>
        </Pressable>
      </View>
      {capabilities ? (
        <CapabilitiesCard
          capabilities={capabilities}
          heading={
            connectedCount > 0
              ? "What Pearl can do"
              : "What Pearl can do after you connect"
          }
        />
      ) : null}
    </View>
  );
}

function CoderTools() {
  const [connections, setConnections] = useState<
    readonly ConnectionStatus[] | null
  >(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getConnections()
        .then((next) => {
          if (!cancelled) setConnections(next);
        })
        .catch(() => {
          if (!cancelled) setConnections(null);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <View className="gap-1.5">
      <Text className="px-1 text-[13px] font-medium text-muted-foreground">
        Accounts and tools
      </Text>
      <Text className="px-1 text-[13px] leading-[18px] text-muted-foreground">
        GitHub, Vercel, and the other connections Coder uses.
      </Text>
      <SettingsCard>
        <CoderToolsList connections={connections} />
      </SettingsCard>
    </View>
  );
}

function CapabilitiesCard({
  capabilities,
  heading,
}: {
  readonly capabilities: PluginCapabilities;
  readonly heading: string;
}) {
  return (
    <View className="gap-3 rounded-[18px] bg-card px-4 py-4">
      <Text className="text-[17px] font-medium text-foreground">{heading}</Text>
      <BulletList items={capabilities.canDo} />
      {capabilities.needsApproval.length > 0 ? (
        <View className="gap-2 pt-1">
          <Text className="text-[15px] font-medium text-foreground">
            Needs your approval
          </Text>
          <BulletList items={capabilities.needsApproval} />
        </View>
      ) : null}
    </View>
  );
}

function StatusCard({
  title,
  body,
}: {
  readonly title: string;
  readonly body: string;
}) {
  return (
    <View className="gap-2 rounded-[18px] bg-card px-4 py-4">
      <Text className="text-[17px] font-medium text-foreground">{title}</Text>
      <Text className="text-[13px] leading-[18px] text-muted-foreground">
        {body}
      </Text>
    </View>
  );
}

function ConnectionPanel({
  connectionId,
  pluginLabel,
}: {
  readonly connectionId: ConnectionId;
  readonly pluginLabel: string;
}) {
  const [grant, setGrant] = useState<ConnectionGrantSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const waitingForReturn = useRef(false);
  const busy = loading || connecting || disconnecting;
  const capabilities = capabilitiesForConnection(connectionId);
  const connected = grant?.status === "connected";
  const state = grant?.status;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await getConnectionGrants();
      const item = items.find((entry) => entry.id === connectionId) ?? null;
      if (mounted.current) {
        setGrant(item);
        if (item?.status === "connected") setUserCode(null);
      }
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error ? cause.message : "Could not load grant.",
        );
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    mounted.current = true;
    void load();
    let previous = AppState.currentState;
    const subscription =
      Platform.OS === "web"
        ? null
        : AppState.addEventListener("change", (state) => {
            if (
              state === "active" &&
              previous !== "active" &&
              waitingForReturn.current
            ) {
              waitingForReturn.current = false;
              void load();
            }
            previous = state;
          });
    return () => {
      mounted.current = false;
      subscription?.remove();
    };
  }, [load]);

  const authorize = async () => {
    if (busy) return;
    setConnecting(true);
    setError(null);
    setUserCode(null);
    try {
      const result = await authorizeConnection(connectionId);
      const url = validatedHttpsUrl(result.url);
      if (!url) {
        throw new Error("The authorization link is not a valid HTTPS URL.");
      }
      if (
        mounted.current &&
        typeof result.userCode === "string" &&
        result.userCode
      ) {
        setUserCode(result.userCode);
      }
      waitingForReturn.current = true;
      await Linking.openURL(url);
    } catch (cause) {
      waitingForReturn.current = false;
      if (mounted.current) {
        setError(
          cause instanceof Error &&
            cause.message === "The authorization link is not a valid HTTPS URL."
            ? cause.message
            : "Could not open authorization. Try again.",
        );
      }
    } finally {
      if (mounted.current) setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (busy) return;
    setDisconnecting(true);
    setError(null);
    try {
      await revokeConnection(connectionId);
      await load();
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error ? cause.message : "Could not disconnect.",
        );
      }
    } finally {
      if (mounted.current) setDisconnecting(false);
    }
  };

  return (
    <View className="gap-4">
      <View className="gap-3 rounded-[18px] bg-card px-4 py-4">
        <Text className="text-[17px] font-medium text-foreground">Grant</Text>
        {loading && !grant ? (
          <ActivityIndicator accessibilityLabel="Loading grant" />
        ) : null}
        {grant ? (
          <View className="gap-2">
            <DetailRow label="Status" value={STATUS_LABEL[grant.status]} />
            <DetailRow
              label="Account"
              value={
                connected
                  ? (grant.accountLabel ??
                    grant.github?.login ??
                    grant.vercel?.username ??
                    `Your ${pluginLabel} account`)
                  : state === "unavailable"
                    ? "Not available on this deployment"
                    : "None connected"
              }
            />
            {grant.detail ? (
              <Text className="text-[13px] leading-[18px] text-muted-foreground">
                {grant.detail}
              </Text>
            ) : null}
            {grant.missingScopes && grant.missingScopes.length > 0 ? (
              <Text className="text-[13px] text-amber-600">
                Missing: {grant.missingScopes.join(", ")}
              </Text>
            ) : null}
            {grant.github ? (
              <Text className="text-[13px] leading-[18px] text-muted-foreground">
                GitHub @{grant.github.login}
                {grant.github.hasRepoScope ? " · repo ok" : " · needs repo"}
                {grant.github.repos.some((repo) => !repo.canPush)
                  ? " · some pinned repos blocked"
                  : ""}
              </Text>
            ) : null}
            {grant.vercel ? (
              <Text className="text-[13px] leading-[18px] text-muted-foreground">
                Vercel {grant.vercel.username}
                {grant.vercel.teams.length > 0
                  ? ` · ${grant.vercel.teams.length} teams`
                  : " · personal"}
              </Text>
            ) : null}
            {grant.github?.manageUrl ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => void Linking.openURL(grant.github!.manageUrl)}
              >
                <Text className="text-[13px] text-foreground underline">
                  Authorized OAuth Apps
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {userCode ? (
          <View className="gap-1">
            <Text
              selectable
              className="text-[17px] font-semibold text-foreground"
            >
              Code: {userCode}
            </Text>
            <Text className="text-[13px] text-muted-foreground">
              Enter this code on the authorization page if prompted.
            </Text>
          </View>
        ) : null}

        {error ? (
          <Text
            accessibilityRole="alert"
            className="text-[13px] text-destructive"
          >
            {error}
          </Text>
        ) : null}

        <View className="flex-row flex-wrap gap-2 pt-1">
          {connected ? (
            <ActionChip
              disabled={busy}
              label={connecting ? "Opening…" : "Update"}
              onPress={() => void authorize()}
            />
          ) : null}
          {state !== "connected" && state !== "unavailable" ? (
            <ActionChip
              disabled={busy}
              label={connecting ? "Opening…" : "Connect"}
              onPress={() => void authorize()}
            />
          ) : null}
          {state === "connected" || state === "unknown" ? (
            <ActionChip
              destructive
              disabled={busy}
              label={disconnecting ? "Disconnecting…" : "Disconnect"}
              onPress={() => void disconnect()}
            />
          ) : null}
          <ActionChip
            disabled={busy || state === "unavailable"}
            label={loading ? "Checking…" : "Refresh"}
            onPress={() => void load()}
          />
        </View>

        <Text className="text-[12px] leading-[16px] text-muted-foreground">
          Authorization is stored by Vercel Connect for your signed-in account.
          Update reopens consent without disconnecting first. Pearl never stores
          provider tokens in this app.
        </Text>
      </View>

      {grant?.github ? <GithubAccessSections github={grant.github} /> : null}

      {capabilities ? (
        <CapabilitiesCard
          capabilities={capabilities}
          heading={
            connected
              ? "What Pearl can do"
              : "What Pearl can do after you connect"
          }
        />
      ) : null}
    </View>
  );
}

function GithubAccessSections({
  github,
}: {
  readonly github: NonNullable<ConnectionGrantSummary["github"]>;
}) {
  return (
    <View className="gap-4">
      <View className="gap-3 rounded-[18px] bg-card px-4 py-4">
        <Text className="text-[17px] font-medium text-foreground">
          Organizations
        </Text>
        {github.orgs.length > 0 ? (
          <View className="gap-2">
            {github.orgs.map((org) => (
              <Text
                key={org}
                className="text-[15px] text-foreground"
                numberOfLines={1}
              >
                {org}
              </Text>
            ))}
          </View>
        ) : (
          <Text className="text-[13px] leading-[18px] text-muted-foreground">
            No organizations visible to this grant. Approve org access on
            GitHub if you need them.
          </Text>
        )}
      </View>

      <View className="gap-3 rounded-[18px] bg-card px-4 py-4">
        <Text className="text-[17px] font-medium text-foreground">
          Repositories
        </Text>
        <Text className="text-[13px] leading-[18px] text-muted-foreground">
          Recent repos this connection can see, most recently pushed first.
        </Text>
        {(github.availableRepos ?? []).length > 0 ? (
          <View className="gap-3">
            {(github.availableRepos ?? []).map((repo) => (
              <Pressable
                key={repo.fullName}
                accessibilityRole="link"
                onPress={() => void Linking.openURL(repo.htmlUrl)}
                className="gap-1"
              >
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text
                    className="min-w-0 flex-1 text-[15px] font-medium text-foreground"
                    numberOfLines={1}
                  >
                    {repo.fullName}
                  </Text>
                  <Text className="text-[12px] text-muted-foreground">
                    {repo.private ? "Private" : "Public"}
                  </Text>
                </View>
                {repo.description ? (
                  <Text
                    className="text-[13px] leading-[18px] text-muted-foreground"
                    numberOfLines={2}
                  >
                    {repo.description}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : (
          <Text className="text-[13px] leading-[18px] text-muted-foreground">
            No repositories visible yet. Reconnect GitHub if this looks wrong.
          </Text>
        )}
      </View>

      {github.repos.length > 0 ? (
        <View className="gap-3 rounded-[18px] bg-card px-4 py-4">
          <Text className="text-[17px] font-medium text-foreground">
            Workbench pins
          </Text>
          <View className="gap-2">
            {github.repos.map((repo) => (
              <Text
                key={repo.fullName}
                className="text-[13px] leading-[18px] text-muted-foreground"
              >
                <Text className="text-foreground">{repo.fullName}</Text>
                {repo.canPush
                  ? " · can push"
                  : ` · blocked${repo.blockedReason ? `: ${repo.blockedReason}` : ""}`}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function DetailRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <View className="gap-0.5">
      <Text className="text-[12px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
        {label}
      </Text>
      <Text selectable className="text-[15px] text-foreground">
        {value}
      </Text>
    </View>
  );
}

function BulletList({ items }: { readonly items: readonly string[] }) {
  return (
    <View className="gap-2">
      {items.map((item) => (
        <View key={item} className="flex-row gap-2">
          <Text className="text-[13px] text-muted-foreground">•</Text>
          <Text className="min-w-0 flex-1 text-[13px] leading-[18px] text-muted-foreground">
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ActionChip({
  label,
  onPress,
  disabled,
  destructive,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      className="min-h-10 justify-center rounded-xl border border-border/60 px-3 active:bg-muted/60 disabled:opacity-50"
      onPress={onPress}
    >
      <Text
        className={`text-sm font-medium ${destructive ? "text-destructive" : "text-foreground"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
