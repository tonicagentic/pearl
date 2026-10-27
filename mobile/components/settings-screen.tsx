import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import { CheckIcon } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { useAuth } from "@/src/auth";
import {
  authorizeConnection,
  checkConnection,
  getConnections,
  revokeConnection,
  type ConnectionId,
  type ConnectionStatus,
} from "@/src/connections-client";
import {
  COMPOSER_MODELS,
  getModelSelection,
  setModelSelection,
  subscribeModelSelection,
} from "@/src/model-selection";

const STATUS_LABEL: Record<ConnectionStatus["status"], string> = {
  available: "Available",
  connected: "Connected",
  "not-connected": "Not connected",
  unavailable: "Unavailable",
  unknown: "Unable to verify",
};

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

export function SettingsScreen() {
  const { viewerEmail, signOut } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const selectedKey = useSyncExternalStore(
    subscribeModelSelection,
    getModelSelection,
    getModelSelection,
  );
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

  const selectModel = (key: string) => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    void setModelSelection(key)
      .catch(() => {
        setSaveError("Couldn't save this choice. Tap it again to retry.");
      })
      .finally(() => setSaving(false));
  };
  const confirmSignOut = () => {
    const complete = () => {
      signOut();
      router.replace("/");
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Sign out of Pearl?")) {
        complete();
      }
      return;
    }
    Alert.alert("Sign out of Pearl?", "You can sign in again to access your chats.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: complete },
    ]);
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor }}
      edges={["left", "right", "bottom"]}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-7 px-5 pt-6 pb-8"
      >
        <View className="gap-2">
          <Text className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Account
          </Text>
          <View className="rounded-2xl border border-border/60 bg-card px-4 py-3">
            <Text className="text-xs text-muted-foreground">Signed in as</Text>
            <Text
              className="mt-1 text-base text-foreground"
              selectable
              numberOfLines={2}
            >
              {viewerEmail ?? "Account"}
            </Text>
          </View>
        </View>
        <ConnectionsSection />
        <View className="gap-2">
          <Text className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Chat
          </Text>
          <View className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <View className="border-b border-border/60 px-4 py-3">
              <Text className="text-base font-medium text-foreground">
                Default model
              </Text>
              <Text className="mt-1 text-xs text-muted-foreground">
                Used for new turns. You can also change it in the composer.
              </Text>
            </View>
            {COMPOSER_MODELS.map((model, index) => (
              <Pressable
                key={model.key}
                accessibilityRole="radio"
                accessibilityLabel={model.label}
                accessibilityState={{
                  checked: selectedKey === model.key,
                  disabled: saving,
                }}
                disabled={saving}
                className={`min-h-13 flex-row items-center justify-between px-4 active:bg-muted/60 ${index > 0 ? "border-t border-border/40" : ""}`}
                onPress={() => selectModel(model.key)}
              >
                <Text className="text-base text-foreground">{model.label}</Text>
                {selectedKey === model.key ? (
                  <CheckIcon className="size-5 text-foreground" />
                ) : null}
              </Pressable>
            ))}
          </View>
          {saveError ? (
            <Text
              className="px-1 text-sm text-destructive"
              accessibilityRole="alert"
            >
              {saveError}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          className="min-h-13 justify-center rounded-2xl border border-border/60 bg-card px-4 active:bg-muted/60"
          onPress={confirmSignOut}
        >
          <Text className="text-base font-medium text-destructive">
            Sign out
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ConnectionsSection() {
  const [connections, setConnections] = useState<ConnectionStatus[] | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<ConnectionId | null>(null);
  const [connecting, setConnecting] = useState<ConnectionId | null>(null);
  const [disconnecting, setDisconnecting] = useState<ConnectionId | null>(null);
  const [challenge, setChallenge] = useState<{
    id: ConnectionId;
    userCode: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{
    id: ConnectionId;
    message: string;
  } | null>(null);
  const mounted = useRef(true);
  const loadVersion = useRef(0);
  const waitingForReturn = useRef(false);

  const busy =
    loading ||
    checking !== null ||
    connecting !== null ||
    disconnecting !== null;

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError(null);
    try {
      const items = await getConnections();
      if (mounted.current && version === loadVersion.current) {
        setConnections(items);
        setChallenge((current) =>
          current &&
          items.some(
            (item) => item.id === current.id && item.status === "connected",
          )
            ? null
            : current,
        );
      }
    } catch (cause) {
      if (mounted.current && version === loadVersion.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load connections.",
        );
      }
    } finally {
      if (mounted.current && version === loadVersion.current) {
        setLoading(false);
      }
    }
  }, []);

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

  const check = async (id: ConnectionId) => {
    if (busy) return;
    setChecking(id);
    setRowError(null);
    try {
      const item = await checkConnection(id);
      if (mounted.current) {
        setConnections(
          (current) =>
            current?.map((entry) => (entry.id === id ? item : entry)) ?? [item],
        );
        if (item.status === "connected") {
          setChallenge((current) => (current?.id === id ? null : current));
        }
      }
    } catch (cause) {
      if (mounted.current) {
        setRowError({
          id,
          message:
            cause instanceof Error ? cause.message : "Could not check status.",
        });
      }
    } finally {
      if (mounted.current) setChecking(null);
    }
  };

  const connect = async (id: ConnectionId) => {
    if (
      busy ||
      !connections?.some(
        (item) =>
          item.id === id &&
          (item.status === "not-connected" || item.status === "available"),
      )
    ) {
      return;
    }
    setConnecting(id);
    setRowError(null);
    setChallenge(null);
    try {
      const result = await authorizeConnection(id);
      const url = validatedHttpsUrl(result.url);
      if (!url) {
        throw new Error("The authorization link is not a valid HTTPS URL.");
      }
      if (
        mounted.current &&
        typeof result.userCode === "string" &&
        result.userCode
      ) {
        setChallenge({ id, userCode: result.userCode });
      }
      waitingForReturn.current = true;
      await Linking.openURL(url);
    } catch (cause) {
      waitingForReturn.current = false;
      if (mounted.current) {
        setRowError({
          id,
          message:
            cause instanceof Error &&
            cause.message === "The authorization link is not a valid HTTPS URL."
              ? cause.message
              : "Could not open authorization. Try again or refresh the list.",
        });
      }
    } finally {
      if (mounted.current) setConnecting(null);
    }
  };

  const disconnect = async (id: ConnectionId) => {
    if (busy) return;
    setDisconnecting(id);
    setRowError(null);
    try {
      const item = await revokeConnection(id);
      if (mounted.current) {
        setConnections(
          (current) =>
            current?.map((entry) => (entry.id === id ? item : entry)) ?? [item],
        );
        setChallenge((current) => (current?.id === id ? null : current));
      }
    } catch (cause) {
      if (mounted.current) {
        setRowError({
          id,
          message:
            cause instanceof Error ? cause.message : "Could not disconnect.",
        });
      }
    } finally {
      if (mounted.current) setDisconnecting(null);
    }
  };

  return (
    <View className="gap-2">
      <Text className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Connections
      </Text>
      <Text className="px-1 text-xs text-muted-foreground">
        Connect Google, GitHub, and Vercel for your account. Checking may
        refresh a token; it does not approve access.
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void load()}
        className="min-h-11 self-start justify-center rounded-xl border border-border/60 bg-card px-4 disabled:opacity-50"
      >
        <Text className="font-medium text-foreground">
          {loading ? "Loading…" : "Refresh list"}
        </Text>
      </Pressable>
      {loading && !connections ? (
        <ActivityIndicator accessibilityLabel="Loading connections" />
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" className="px-1 text-sm text-destructive">
          {error}
        </Text>
      ) : null}
      {connections?.length === 0 ? (
        <Text className="px-1 text-muted-foreground">
          No connections available.
        </Text>
      ) : null}
      {connections?.map((connection) => (
        <View
          key={connection.id}
          className="gap-2 rounded-2xl border border-border/60 bg-card p-4"
        >
          <Text className="text-base font-medium text-foreground">
            {connection.label}
          </Text>
          <Text className="text-sm text-foreground">
            {STATUS_LABEL[connection.status]}
          </Text>
          {connection.detail ? (
            <Text className="text-sm text-muted-foreground">
              {connection.detail}
            </Text>
          ) : null}
          {challenge?.id === connection.id ? (
            <View className="gap-1">
              <Text
                selectable
                className="text-base font-semibold text-foreground"
              >
                Code: {challenge.userCode}
              </Text>
              <Text className="text-xs text-muted-foreground">
                Enter this code on the authorization page if prompted. Return
                here to refresh status, or tap Refresh list.
              </Text>
            </View>
          ) : null}
          {rowError?.id === connection.id ? (
            <Text
              accessibilityRole="alert"
              className="text-sm text-destructive"
            >
              {rowError.message}
            </Text>
          ) : null}
          {connection.status === "not-connected" ||
          connection.status === "available" ||
          connection.status === "unknown" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Connect ${connection.label}`}
              disabled={busy}
              onPress={() => void connect(connection.id)}
              className="min-h-11 self-start justify-center rounded-xl border border-border/60 px-4 disabled:opacity-50"
            >
              <Text className="font-medium text-foreground">
                {connecting === connection.id ? "Opening…" : "Connect"}
              </Text>
            </Pressable>
          ) : null}
          {connection.status === "connected" ||
          connection.status === "unknown" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Disconnect ${connection.label}`}
              disabled={busy}
              onPress={() => void disconnect(connection.id)}
              className="min-h-11 self-start justify-center rounded-xl border border-border/60 px-4 disabled:opacity-50"
            >
              <Text className="font-medium text-destructive">
                {disconnecting === connection.id
                  ? "Disconnecting…"
                  : "Disconnect"}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Check ${connection.label} status`}
            disabled={busy || connection.status === "unavailable"}
            onPress={() => void check(connection.id)}
            className="min-h-11 self-start justify-center rounded-xl border border-border/60 px-4 disabled:opacity-50"
          >
            <Text className="font-medium text-foreground">
              {checking === connection.id ? "Checking…" : "Check status"}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
