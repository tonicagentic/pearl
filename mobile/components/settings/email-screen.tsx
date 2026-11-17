import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Platform,
} from "react-native";
import * as Linking from "expo-linking";
import { Stack, useFocusEffect } from "expo-router";

import {
  SettingsButton,
  SettingsForm,
  SettingsFormText,
  SettingsLabeledValue,
  SettingsSection,
} from "@/components/settings/native";
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
  const [busyId, setBusyId] = useState<string | "add" | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const waitingForReturn = useRef(false);
  const busy = loading || busyId !== null;
  const capabilities = capabilitiesForConnection("gmail");

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
      <Stack.Screen
        options={{
          title: "Email",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <SettingsForm
        footer={
          <SettingsFormText tone="secondary">
            Each address is authorized separately through Google. Pearl never
            stores provider tokens on this device. Archive and mark-read need a
            one-time reconnect if an account was linked before those permissions
            were added.
          </SettingsFormText>
        }
      >
        <SettingsFormText>
          Connect Gmail so Pearl can search and read threads, draft replies,
          send only after you approve, and archive or label mail in batches you
          confirm.
        </SettingsFormText>

        <SettingsSection title="Accounts">
          <SettingsLabeledValue
            label="Connected"
            value={
              mailboxes == null
                ? "Loading…"
                : connectedCount === 0
                  ? "None connected"
                  : `${connectedCount} connected`
            }
          />
          {userCode ? (
            <SettingsLabeledValue label="Code" value={userCode} />
          ) : null}
          <SettingsButton
            disabled={busy}
            label={busyId === "add" ? "Opening…" : "Add Gmail account"}
            onPress={() => void authorize()}
          />
          <SettingsButton
            disabled={busy}
            label={loading ? "Checking…" : "Refresh"}
            onPress={() => void load()}
            variant="plain"
          />
        </SettingsSection>

        {error ? (
          <SettingsFormText tone="destructive">{error}</SettingsFormText>
        ) : null}

        {loading && mailboxes == null ? (
          <ActivityIndicator accessibilityLabel="Loading mailboxes" />
        ) : null}

        {mailboxes?.map((mailbox) => {
          const email = mailbox.emailLabel?.trim() || null;
          const nickname = mailbox.nickname?.trim() || null;
          const title = nickname || email || displayName(mailbox);
          const rowBusy = busyId === mailbox.id;
          return (
            <SettingsSection key={mailbox.id} title={title}>
              {nickname && email ? (
                <SettingsLabeledValue label="Email" value={email} />
              ) : null}
              <SettingsLabeledValue
                label="Status"
                value={
                  statusLabel(mailbox.status) +
                  (mailbox.status === "connected" && !mailbox.canModify
                    ? " · reconnect for archive and mark-read"
                    : "")
                }
              />
              {mailbox.status === "connected" ? (
                <SettingsButton
                  disabled={busy}
                  label={rowBusy ? "Opening…" : "Update"}
                  onPress={() => void authorize(mailbox.id)}
                />
              ) : mailbox.status !== "unavailable" ? (
                <SettingsButton
                  disabled={busy}
                  label={rowBusy ? "Opening…" : "Connect"}
                  onPress={() => void authorize(mailbox.id)}
                />
              ) : null}
              <SettingsButton
                destructive
                disabled={busy}
                label={rowBusy ? "…" : "Disconnect"}
                onPress={() => confirmDisconnect(mailbox)}
              />
            </SettingsSection>
          );
        })}

        {capabilities ? (
          <CapabilitiesSection
            capabilities={capabilities}
            heading={
              connectedCount > 0
                ? "What Pearl can do"
                : "What Pearl can do after you connect"
            }
          />
        ) : null}
      </SettingsForm>
    </>
  );
}

function CapabilitiesSection({
  capabilities,
  heading,
}: {
  readonly capabilities: PluginCapabilities;
  readonly heading: string;
}) {
  return (
    <SettingsSection title={heading}>
      {capabilities.canDo.map((item) => (
        <SettingsFormText key={item} tone="secondary">
          {`• ${item}`}
        </SettingsFormText>
      ))}
      {capabilities.needsApproval.length > 0 ? (
        <>
          <SettingsFormText>Needs your approval</SettingsFormText>
          {capabilities.needsApproval.map((item) => (
            <SettingsFormText key={item} tone="secondary">
              {`• ${item}`}
            </SettingsFormText>
          ))}
        </>
      ) : null}
    </SettingsSection>
  );
}
