import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import { Stack, useFocusEffect } from "expo-router";

import { SheetScaffold } from "@/components/settings/sheet-scaffold";
import { SettingsCard } from "@/components/ui/settings-card";
import {
  authorizeMailbox,
  listMailboxes,
  revokeMailbox,
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

function displayName(mailbox: MailboxClientSummary): string {
  if (mailbox.nickname?.trim()) {
    return mailbox.emailLabel
      ? `${mailbox.nickname.trim()} · ${mailbox.emailLabel}`
      : mailbox.nickname.trim();
  }
  return mailbox.emailLabel ?? "Gmail account";
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
  const [busyId, setBusyId] = useState<string | "add" | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const waitingForReturn = useRef(false);
  const busy = loading || busyId !== null;

  const load = useCallback(async () => {
    setLoading(true);
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
      if (mounted.current) setLoading(false);
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
      <Stack.Screen options={{ title: "Email" }} />
      <SheetScaffold>
        <Text className="px-1 text-[13px] leading-[18px] text-muted-foreground">
          Connect one or more Gmail accounts Pearl can read and manage. Archive
          and mark-read need a reconnect if an account was linked before those
          permissions were added.
        </Text>

        <View className="flex-row flex-wrap gap-2 px-1">
          <ActionChip
            disabled={busy}
            label={busyId === "add" ? "Opening…" : "Add Gmail account"}
            onPress={() => void authorize()}
          />
          <ActionChip
            disabled={busy}
            label={loading ? "Checking…" : "Refresh"}
            onPress={() => void load()}
          />
        </View>

        <Text className="px-1 text-[13px] text-muted-foreground">
          {mailboxes == null
            ? "Loading…"
            : connectedCount === 0
              ? "None connected"
              : `${connectedCount} connected`}
        </Text>

        {userCode ? (
          <View className="gap-1 rounded-[18px] bg-card px-4 py-3">
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
            className="px-1 text-[13px] text-destructive"
          >
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
      </SheetScaffold>
    </>
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
  return (
    <View>
      <View className="gap-2 px-4 py-3">
        <Text
          className="text-[17px] font-medium text-foreground"
          numberOfLines={2}
        >
          {displayName(mailbox)}
        </Text>
        <Text className="text-[13px] text-muted-foreground">
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
        className={`text-[15px] ${
          destructive ? "text-destructive" : "text-foreground"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
