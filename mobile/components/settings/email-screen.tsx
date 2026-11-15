import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Platform,
  Pressable,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import { Stack, useFocusEffect } from "expo-router";

import { SheetScaffold } from "@/components/settings/sheet-scaffold";
import { SettingsCard } from "@/components/ui/settings-card";
import { Text } from "@/components/ui/text";
import {
  authorizeMailbox,
  listMailboxes,
  revokeMailbox,
  type MailboxClientSummary,
} from "@/src/mailboxes-client";
import {
  capabilitiesForConnection,
  type PluginCapabilities,
} from "../../../lib/plugins/capabilities";

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

function displayName(mailbox: MailboxClientSummary): string {
  const email = mailbox.emailLabel?.trim();
  const nickname = mailbox.nickname?.trim();
  if (nickname && email) return `${nickname} · ${email}`;
  if (email) return email;
  if (nickname) return nickname;
  return mailbox.status === "connected"
    ? "Gmail account (address unavailable)"
    : "Gmail account";
}

function statusLabel(status: MailboxClientSummary["status"]): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "not-connected":
      return "Not connected";
    case "unavailable":
      return "Unavailable";
    default:
      return "Unable to verify";
  }
}

/** Mobile Settings → Email: list, add, and disconnect Gmail accounts. */
export function EmailScreen() {
  const [mailboxes, setMailboxes] = useState<
    readonly MailboxClientSummary[] | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | "add" | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const waitingForReturn = useRef(false);
  const busy = (loading && !refreshing) || busyId !== null;
  const capabilities = capabilitiesForConnection("gmail");

  const load = useCallback(async (opts?: { refresh?: boolean }) => {
    const isRefresh = opts?.refresh === true;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const next = await listMailboxes();
      if (mounted.current) {
        setMailboxes(next);
        if (next.some((item) => item.status === "connected")) {
          setUserCode(null);
        }
      }
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error ? cause.message : "Could not load mailboxes.",
        );
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    mounted.current = true;
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

  const authorize = async (mailboxId?: string) => {
    if (busy) return;
    setBusyId(mailboxId ?? "add");
    setError(null);
    setUserCode(null);
    try {
      const result = await authorizeMailbox(mailboxId);
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
          cause instanceof Error
            ? cause.message
            : "Could not open authorization. Try again.",
        );
      }
    } finally {
      if (mounted.current) setBusyId(null);
    }
  };

  const confirmDisconnect = (mailbox: MailboxClientSummary) => {
    const run = () => void disconnect(mailbox.id);
    const title = "Disconnect this Gmail account?";
    const body = displayName(mailbox);
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm(`${title}\n\n${body}`)
      ) {
        run();
      }
      return;
    }
    Alert.alert(title, body, [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: run },
    ]);
  };

  const disconnect = async (mailboxId: string) => {
    if (busy) return;
    setBusyId(mailboxId);
    setError(null);
    try {
      const next = await revokeMailbox(mailboxId);
      if (mounted.current) setMailboxes(next);
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error ? cause.message : "Could not disconnect.",
        );
      }
    } finally {
      if (mounted.current) setBusyId(null);
    }
  };

  const connectedCount =
    mailboxes?.filter((item) => item.status === "connected").length ?? 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Email",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <SheetScaffold
        refreshing={refreshing}
        onRefresh={() => void load({ refresh: true })}
      >
        <Text variant="body" className="px-1">
          Connect Gmail so Pearl can search and read threads, draft replies,
          send only after you approve, and archive or label mail in batches you
          confirm.
        </Text>

        <View className="flex-row flex-wrap gap-2 px-1">
          <ActionChip
            disabled={busy}
            label={busyId === "add" ? "Opening…" : "Add Gmail account"}
            onPress={() => void authorize()}
          />
          <ActionChip
            disabled={busy}
            label={loading && !refreshing ? "Checking…" : "Refresh"}
            onPress={() => void load({ refresh: true })}
          />
        </View>

        <Text variant="secondary" className="px-1">
          {mailboxes == null
            ? "Loading…"
            : connectedCount === 0
              ? "None connected"
              : `${connectedCount} connected`}
        </Text>

        {userCode ? (
          <View className="gap-1 rounded-[18px] bg-card px-4 py-3">
            <Text variant="label" weight="semibold" selectable>
              Code: {userCode}
            </Text>
            <Text variant="secondary">
              Enter this code on the authorization page if prompted.
            </Text>
          </View>
        ) : null}

        {error ? (
          <Text variant="secondary" tone="destructive" className="px-1" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        {loading && mailboxes == null ? (
          <ActivityIndicator accessibilityLabel="Loading mailboxes" />
        ) : null}

        {mailboxes && mailboxes.length > 0 ? (
          <SettingsCard>
            {mailboxes.map((mailbox, index) => (
              <MailboxRow
                key={mailbox.id}
                mailbox={mailbox}
                busy={busy}
                busyId={busyId}
                showSeparator={index < mailboxes.length - 1}
                onConnect={() => void authorize(mailbox.id)}
                onDisconnect={() => confirmDisconnect(mailbox)}
              />
            ))}
          </SettingsCard>
        ) : null}

        {capabilities ? (
          <EmailCapabilitiesCard
            capabilities={capabilities}
            heading={
              connectedCount > 0
                ? "What Pearl can do"
                : "What Pearl can do after you connect"
            }
          />
        ) : null}

        <Text variant="secondary" className="px-1">
          Each address is authorized separately through Google. Pearl never
          stores provider tokens on this device. Archive and mark-read need a
          one-time reconnect if an account was linked before those permissions
          were added.
        </Text>
      </SheetScaffold>
    </>
  );
}

function EmailCapabilitiesCard({
  capabilities,
  heading,
}: {
  readonly capabilities: PluginCapabilities;
  readonly heading: string;
}) {
  return (
    <View className="gap-3 rounded-[18px] bg-card px-4 py-4">
      <Text variant="label">{heading}</Text>
      <BulletList items={capabilities.canDo} />
      {capabilities.needsApproval.length > 0 ? (
        <View className="gap-2 pt-1">
          <Text variant="body" weight="medium">
            Needs your approval
          </Text>
          <BulletList items={capabilities.needsApproval} />
        </View>
      ) : null}
    </View>
  );
}

function BulletList({ items }: { readonly items: readonly string[] }) {
  return (
    <View className="gap-2">
      {items.map((item) => (
        <View key={item} className="flex-row gap-2">
          <Text variant="body" tone="muted">
            •
          </Text>
          <Text variant="body" tone="muted" className="min-w-0 flex-1">
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

function MailboxRow({
  mailbox,
  busy,
  busyId,
  showSeparator,
  onConnect,
  onDisconnect,
}: {
  readonly mailbox: MailboxClientSummary;
  readonly busy: boolean;
  readonly busyId: string | "add" | null;
  readonly showSeparator: boolean;
  readonly onConnect: () => void;
  readonly onDisconnect: () => void;
}) {
  const rowBusy = busyId === mailbox.id;
  const email = mailbox.emailLabel?.trim() || null;
  const nickname = mailbox.nickname?.trim() || null;
  const title = nickname || email || displayName(mailbox);
  return (
    <View>
      <View className="gap-2 px-4 py-3">
        <Text variant="label" numberOfLines={2}
          selectable>
          {title}
        </Text>
        {nickname && email ? (
          <Text variant="secondary" numberOfLines={1}
            selectable>
            {email}
          </Text>
        ) : null}
        <Text variant="secondary">
          {statusLabel(mailbox.status)}
          {mailbox.status === "connected" && !mailbox.canModify
            ? " · reconnect for archive and mark-read"
            : ""}
        </Text>
        <View className="flex-row flex-wrap gap-2 pt-1">
          {mailbox.status === "connected" ? (
            <ActionChip
              disabled={busy}
              label={rowBusy ? "Opening…" : "Update"}
              onPress={onConnect}
            />
          ) : mailbox.status !== "unavailable" ? (
            <ActionChip
              disabled={busy}
              label={rowBusy ? "Opening…" : "Connect"}
              onPress={onConnect}
            />
          ) : null}
          <ActionChip
            destructive
            disabled={busy}
            label={rowBusy ? "…" : "Disconnect"}
            onPress={onDisconnect}
          />
        </View>
      </View>
      {showSeparator ? <View className="ml-4 h-px bg-border" /> : null}
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
      onPress={onPress}
      className={`min-h-10 justify-center rounded-[10px] px-3 disabled:opacity-50 ${
        destructive ? "bg-destructive/10" : "bg-muted"
      }`}
    >
      <Text
        variant="body"
        tone={destructive ? "destructive" : "default"}
      >
        {label}
      </Text>
    </Pressable>
  );
}
