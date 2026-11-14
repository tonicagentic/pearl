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
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import { Stack, useFocusEffect } from "expo-router";

import { SheetScaffold } from "@/components/settings/sheet-scaffold";
import { SettingsCard } from "@/components/ui/settings-card";
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
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showIcloudForm, setShowIcloudForm] = useState(false);
  const [appleId, setAppleId] = useState("");
  const [appSpecificPassword, setAppSpecificPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const mounted = useRef(true);
  const waitingForReturn = useRef(false);
  const busy = (loading && !refreshing) || busyId !== null;
  const googleCapabilities = capabilitiesForConnection("calendar");
  const icloudCapabilities = capabilitiesForPlugin("icloud-calendar");

  const load = useCallback(async (opts?: { refresh?: boolean }) => {
    const isRefresh = opts?.refresh === true;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
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
      await load({ refresh: true });
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
      <SheetScaffold
        refreshing={refreshing}
        onRefresh={() => void load({ refresh: true })}
      >
        <Text className="px-1 text-[15px] leading-[22px] text-foreground">
          Connect Google Calendar and iCloud Calendar so Pearl can read
          upcoming events and help you plan around your day.
        </Text>

        {error ? (
          <Text
            accessibilityRole="alert"
            className="px-1 text-[13px] text-destructive"
          >
            {error}
          </Text>
        ) : null}

        {loading && googleGrant == null && icloudAccounts == null ? (
          <ActivityIndicator accessibilityLabel="Loading calendars" />
        ) : null}

        <View className="gap-3 rounded-[18px] bg-card px-4 py-4">
          <Text className="text-[17px] font-medium text-foreground">
            Google Calendar
          </Text>
          <Text className="text-[13px] text-muted-foreground">
            {googleGrant
              ? GOOGLE_STATUS[googleGrant.status]
              : loading
                ? "Loading…"
                : "Not connected"}
            {googleGrant?.accountLabel?.trim()
              ? ` · ${googleGrant.accountLabel.trim()}`
              : ""}
          </Text>
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
          <View className="flex-row flex-wrap gap-2">
            {googleConnected ? (
              <ActionChip
                disabled={busy}
                label={busyId === "google" ? "Opening…" : "Update"}
                onPress={() => void authorizeGoogle()}
              />
            ) : googleGrant?.status !== "unavailable" ? (
              <ActionChip
                disabled={busy}
                label={busyId === "google" ? "Connecting…" : "Connect"}
                onPress={() => void authorizeGoogle()}
              />
            ) : null}
            {googleConnected || googleGrant?.status === "unknown" ? (
              <ActionChip
                disabled={busy}
                label={
                  busyId === "google-disconnect" ? "Disconnecting…" : "Disconnect"
                }
                destructive
                onPress={confirmDisconnectGoogle}
              />
            ) : null}
          </View>
        </View>

        {googleCapabilities ? (
          <CapabilitiesCard
            capabilities={googleCapabilities}
            heading={
              googleConnected
                ? "What Pearl can do with Google Calendar"
                : "What Pearl can do after you connect Google Calendar"
            }
          />
        ) : null}

        <View className="gap-3 rounded-[18px] bg-card px-4 py-4">
          <Text className="text-[17px] font-medium text-foreground">
            iCloud Calendar
          </Text>
          <Text className="text-[13px] text-muted-foreground">
            {!icloudAvailable
              ? "Unavailable on this deployment"
              : icloudAccounts == null
                ? "Loading…"
                : icloudConnected === 0
                  ? "None connected"
                  : `${icloudConnected} connected`}
          </Text>

          {icloudAccounts && icloudAccounts.length > 0 ? (
            <SettingsCard>
              {icloudAccounts.map((account, index) => (
                <View
                  key={account.id}
                  className={
                    index < icloudAccounts.length - 1
                      ? "border-b border-border px-4 py-3"
                      : "px-4 py-3"
                  }
                >
                  <Text
                    className="text-[15px] text-foreground"
                    numberOfLines={1}
                  >
                    {account.nickname?.trim()
                      ? `${account.nickname.trim()} · ${account.appleId}`
                      : account.appleId}
                  </Text>
                  <Text className="mt-1 text-[13px] text-muted-foreground">
                    {account.status === "connected"
                      ? "Connected"
                      : account.status === "unavailable"
                        ? "Unavailable"
                        : "Unable to verify"}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => confirmDisconnectIcloud(account)}
                    className="mt-2 min-h-10 justify-center self-start rounded-[10px] border border-border px-3"
                  >
                    <Text className="text-[14px] text-destructive">
                      {busyId === account.id ? "…" : "Disconnect"}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </SettingsCard>
          ) : null}

          {showIcloudForm ? (
            <View className="gap-3">
              <LabeledField
                label="Apple ID"
                value={appleId}
                onChangeText={setAppleId}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@icloud.com"
              />
              <LabeledField
                label="App-specific password"
                value={appSpecificPassword}
                onChangeText={setAppSpecificPassword}
                autoCapitalize="none"
                secureTextEntry
                placeholder="xxxx-xxxx-xxxx-xxxx"
              />
              <LabeledField
                label="Nickname (optional)"
                value={nickname}
                onChangeText={setNickname}
                placeholder="Personal"
              />
              <Text className="text-[13px] leading-[18px] text-muted-foreground">
                Create an app-specific password at appleid.apple.com. Pearl
                encrypts it at rest and never shows it again.
              </Text>
              <View className="flex-row flex-wrap gap-2">
                <ActionChip
                  disabled={busy || !icloudAvailable}
                  label={
                    busyId === "icloud-add" ? "Connecting…" : "Connect iCloud"
                  }
                  onPress={() => void connectIcloud()}
                />
                <ActionChip
                  disabled={busy}
                  label="Cancel"
                  onPress={() => {
                    setShowIcloudForm(false);
                    setAppSpecificPassword("");
                  }}
                />
              </View>
            </View>
          ) : (
            <ActionChip
              disabled={busy || !icloudAvailable}
              label="Add iCloud Calendar"
              onPress={() => setShowIcloudForm(true)}
            />
          )}
        </View>

        {icloudCapabilities ? (
          <CapabilitiesCard
            capabilities={icloudCapabilities}
            heading={
              icloudConnected > 0
                ? "What Pearl can do with iCloud Calendar"
                : "What Pearl can do after you connect iCloud Calendar"
            }
          />
        ) : null}

        <Text className="px-1 text-[13px] leading-[18px] text-muted-foreground">
          Google Calendar uses Vercel Connect. iCloud Calendar uses CalDAV with
          an Apple app-specific password stored encrypted in Pearl — never on
          this device after you save it.
        </Text>
      </SheetScaffold>
    </>
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

function BulletList({ items }: { readonly items: readonly string[] }) {
  return (
    <View className="gap-2">
      {items.map((item) => (
        <View key={item} className="flex-row gap-2">
          <Text className="text-[15px] leading-[20px] text-muted-foreground">
            •
          </Text>
          <Text className="min-w-0 flex-1 text-[15px] leading-[20px] text-muted-foreground">
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
      onPress={onPress}
      className={`min-h-11 justify-center rounded-[10px] px-4 ${
        destructive ? "border border-border" : "bg-muted"
      } ${disabled ? "opacity-50" : ""}`}
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

function LabeledField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder?: string;
  readonly secureTextEntry?: boolean;
  readonly autoCapitalize?: "none" | "sentences" | "words" | "characters";
  readonly keyboardType?: "default" | "email-address";
}) {
  return (
    <View className="gap-1">
      <Text className="text-[13px] font-medium text-foreground">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        className="min-h-11 rounded-[10px] border border-border bg-background px-3 text-[15px] text-foreground"
      />
    </View>
  );
}
