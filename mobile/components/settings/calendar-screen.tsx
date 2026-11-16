import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
  SettingsField,
  SettingsForm,
  SettingsFormText,
  SettingsLabeledValue,
  SettingsSection,
  SettingsSecureField,
} from "@/components/settings/native";
import {
  capabilitiesForConnection,
  capabilitiesForPlugin,
  type PluginCapabilities,
} from "../../../lib/plugins/capabilities";
import {
  createCalendarAccount,
  listCalendarAccounts,
  revokeCalendarAccount,
  type IcloudCalendarAccountSummary,
} from "@/src/calendar-accounts-client";
import {
  authorizeConnection,
  getConnectionGrants,
  revokeConnection,
  type ConnectionGrantSummary,
} from "@/src/connections-client";

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

const GOOGLE_STATUS: Record<ConnectionGrantSummary["status"], string> = {
  available: "Available",
  connected: "Connected",
  "not-connected": "Not connected",
  unavailable: "Unavailable",
  unknown: "Unable to verify",
};

/** Mobile Settings → Calendar: Google OAuth + iCloud CalDAV accounts. */
export function CalendarScreen() {
  const [googleGrant, setGoogleGrant] =
    useState<ConnectionGrantSummary | null>(null);
  const [icloudAccounts, setIcloudAccounts] = useState<
    readonly IcloudCalendarAccountSummary[] | null
  >(null);
  const [icloudAvailable, setIcloudAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showIcloudForm, setShowIcloudForm] = useState(false);
  const [appleId, setAppleId] = useState("");
  const [appSpecificPassword, setAppSpecificPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const mounted = useRef(true);
  const waitingForReturn = useRef(false);
  const busy = loading || busyId !== null;
  const googleCapabilities = capabilitiesForConnection("calendar");
  const icloudCapabilities = capabilitiesForPlugin("icloud-calendar");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [grants, icloud] = await Promise.all([
        getConnectionGrants(),
        listCalendarAccounts(),
      ]);
      if (mounted.current) {
        setGoogleGrant(
          grants.find((item) => item.id === "calendar") ?? null,
        );
        setIcloudAccounts(icloud.accounts);
        setIcloudAvailable(icloud.available);
        if (grants.some((item) => item.id === "calendar" && item.status === "connected")) {
          setUserCode(null);
        }
      }
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load calendar accounts.",
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

  const authorizeGoogle = async () => {
    if (busy) return;
    setBusyId("google");
    setError(null);
    setUserCode(null);
    try {
      const result = await authorizeConnection("calendar");
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

  const disconnectGoogle = async () => {
    if (busy) return;
    setBusyId("google-disconnect");
    setError(null);
    try {
      await revokeConnection("calendar");
      await load();
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

  const confirmDisconnectGoogle = () => {
    const title = "Disconnect Google Calendar?";
    const body = googleGrant?.accountLabel?.trim() || "Google Calendar";
    const run = () => void disconnectGoogle();
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

  const connectIcloud = async () => {
    if (busy) return;
    setBusyId("icloud-add");
    setError(null);
    try {
      const result = await createCalendarAccount({
        appleId,
        appSpecificPassword,
        ...(nickname.trim() ? { nickname: nickname.trim() } : {}),
      });
      if (mounted.current) {
        setIcloudAccounts(result.accounts);
        setAppleId("");
        setAppSpecificPassword("");
        setNickname("");
        setShowIcloudForm(false);
      }
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not link iCloud Calendar.",
        );
      }
    } finally {
      if (mounted.current) setBusyId(null);
    }
  };

  const disconnectIcloud = async (accountId: string) => {
    if (busy) return;
    setBusyId(accountId);
    setError(null);
    try {
      const next = await revokeCalendarAccount(accountId);
      if (mounted.current) setIcloudAccounts(next);
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

  const confirmDisconnectIcloud = (account: IcloudCalendarAccountSummary) => {
    const title = "Disconnect this iCloud Calendar?";
    const body = account.nickname?.trim()
      ? `${account.nickname.trim()} · ${account.appleId}`
      : account.appleId;
    const run = () => void disconnectIcloud(account.id);
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

  const googleConnected = googleGrant?.status === "connected";
  const icloudConnected =
    icloudAccounts?.filter((item) => item.status === "connected").length ?? 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Calendar",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <SettingsForm
        footer={
          <SettingsFormText tone="secondary">
            Google Calendar uses Vercel Connect. iCloud Calendar uses CalDAV with
            an Apple app-specific password stored encrypted in Pearl — never on
            this device after you save it.
          </SettingsFormText>
        }
      >
        <SettingsFormText>
          Connect Google Calendar and iCloud Calendar so Pearl can read upcoming
          events and help you plan around your day.
        </SettingsFormText>

        {error ? (
          <SettingsFormText tone="destructive">{error}</SettingsFormText>
        ) : null}

        {loading && googleGrant == null && icloudAccounts == null ? (
          <ActivityIndicator accessibilityLabel="Loading calendars" />
        ) : null}

        <SettingsSection title="Google Calendar">
          <SettingsLabeledValue
            label="Status"
            value={
              (googleGrant
                ? GOOGLE_STATUS[googleGrant.status]
                : loading
                  ? "Loading…"
                  : "Not connected") +
              (googleGrant?.accountLabel?.trim()
                ? ` · ${googleGrant.accountLabel.trim()}`
                : "")
            }
          />
          {userCode ? (
            <SettingsLabeledValue label="Code" value={userCode} />
          ) : null}
          {googleConnected ? (
            <SettingsButton
              disabled={busy}
              label={busyId === "google" ? "Opening…" : "Update"}
              onPress={() => void authorizeGoogle()}
            />
          ) : googleGrant?.status !== "unavailable" ? (
            <SettingsButton
              disabled={busy}
              label={busyId === "google" ? "Connecting…" : "Connect"}
              onPress={() => void authorizeGoogle()}
            />
          ) : null}
          {googleConnected || googleGrant?.status === "unknown" ? (
            <SettingsButton
              destructive
              disabled={busy}
              label={
                busyId === "google-disconnect" ? "Disconnecting…" : "Disconnect"
              }
              onPress={confirmDisconnectGoogle}
            />
          ) : null}
        </SettingsSection>

        {googleCapabilities ? (
          <CapabilitiesSection
            capabilities={googleCapabilities}
            heading={
              googleConnected
                ? "What Pearl can do with Google Calendar"
                : "What Pearl can do after you connect Google Calendar"
            }
          />
        ) : null}

        <SettingsSection title="iCloud Calendar">
          <SettingsLabeledValue
            label="Status"
            value={
              !icloudAvailable
                ? "Unavailable on this deployment"
                : icloudAccounts == null
                  ? "Loading…"
                  : icloudConnected === 0
                    ? "None connected"
                    : `${icloudConnected} connected`
            }
          />

          {showIcloudForm ? (
            <>
              <SettingsField
                label="Apple ID"
                onChangeText={setAppleId}
                placeholder="you@icloud.com"
                value={appleId}
              />
              <SettingsSecureField
                label="App-specific password"
                onChangeText={setAppSpecificPassword}
                placeholder="xxxx-xxxx-xxxx-xxxx"
                value={appSpecificPassword}
              />
              <SettingsField
                label="Nickname (optional)"
                onChangeText={setNickname}
                placeholder="Personal"
                value={nickname}
              />
              <SettingsFormText tone="secondary">
                Create an app-specific password at appleid.apple.com. Pearl
                encrypts it at rest and never shows it again.
              </SettingsFormText>
              <SettingsButton
                disabled={busy || !icloudAvailable}
                label={
                  busyId === "icloud-add" ? "Connecting…" : "Connect iCloud"
                }
                onPress={() => void connectIcloud()}
              />
              <SettingsButton
                disabled={busy}
                label="Cancel"
                onPress={() => {
                  setShowIcloudForm(false);
                  setAppSpecificPassword("");
                }}
                variant="plain"
              />
            </>
          ) : (
            <SettingsButton
              disabled={busy || !icloudAvailable}
              label="Add iCloud Calendar"
              onPress={() => setShowIcloudForm(true)}
            />
          )}
        </SettingsSection>

        {icloudAccounts?.map((account) => (
          <SettingsSection
            key={account.id}
            title={
              account.nickname?.trim()
                ? `${account.nickname.trim()} · ${account.appleId}`
                : account.appleId
            }
          >
            <SettingsLabeledValue
              label="Status"
              value={
                account.status === "connected"
                  ? "Connected"
                  : account.status === "unavailable"
                    ? "Unavailable"
                    : "Unable to verify"
              }
            />
            <SettingsButton
              destructive
              disabled={busy}
              label={busyId === account.id ? "…" : "Disconnect"}
              onPress={() => confirmDisconnectIcloud(account)}
            />
          </SettingsSection>
        ))}

        {icloudCapabilities ? (
          <CapabilitiesSection
            capabilities={icloudCapabilities}
            heading={
              icloudConnected > 0
                ? "What Pearl can do with iCloud Calendar"
                : "What Pearl can do after you connect iCloud Calendar"
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
