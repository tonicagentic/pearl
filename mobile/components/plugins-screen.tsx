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

import { PluginLogo } from "@/components/plugin-logo";
import { SheetScaffold } from "@/components/sheet-scaffold";
import {
  authorizeConnection,
  checkConnection,
  getConnections,
  revokeConnection,
  type ConnectionId,
  type ConnectionStatus,
} from "@/src/connections-client";

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

/**
 * Plugins manager: connect Google, GitHub, Vercel, and other account plugins.
 * Same /api/connections surface as web Settings → Plugins.
 */
export function PluginsScreen() {
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
          cause instanceof Error ? cause.message : "Could not load plugins.",
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
    <SheetScaffold title="Plugins">
      <Text className="px-1 text-[13px] leading-[18px] text-muted-foreground">
        Connect Google, GitHub, Vercel, and other services for your account.
        Checking may refresh a token; it does not approve access.
      </Text>

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void load()}
        className="min-h-11 self-start justify-center rounded-[10px] bg-card px-4 disabled:opacity-50"
      >
        <Text className="text-[17px] text-foreground">
          {loading ? "Loading…" : "Refresh list"}
        </Text>
      </Pressable>

      {loading && !connections ? (
        <ActivityIndicator accessibilityLabel="Loading plugins" />
      ) : null}
      {error ? (
        <Text
          accessibilityRole="alert"
          className="px-1 text-[13px] text-destructive"
        >
          {error}
        </Text>
      ) : null}
      {connections?.length === 0 ? (
        <Text className="px-1 text-muted-foreground">
          No plugins available.
        </Text>
      ) : null}

      <View className="overflow-hidden rounded-[10px] bg-card">
        {connections?.map((connection, index) => (
          <View
            key={connection.id}
            className={`gap-3 px-4 py-3.5 ${index > 0 ? "border-t border-border/40" : ""}`}
          >
            <View className="flex-row items-start gap-3">
              <PluginLogo id={connection.id} />
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-[17px] leading-[22px] text-foreground">
                  {connection.label}
                </Text>
                <Text className="text-[13px] text-muted-foreground">
                  {STATUS_LABEL[connection.status]}
                </Text>
                {connection.detail ? (
                  <Text className="text-[13px] text-muted-foreground">
                    {connection.detail}
                  </Text>
                ) : null}
              </View>
            </View>

            {challenge?.id === connection.id ? (
              <View className="gap-1">
                <Text
                  selectable
                  className="text-[17px] font-semibold text-foreground"
                >
                  Code: {challenge.userCode}
                </Text>
                <Text className="text-[13px] text-muted-foreground">
                  Enter this code on the authorization page if prompted. Return
                  here to refresh status, or tap Refresh list.
                </Text>
              </View>
            ) : null}

            {rowError?.id === connection.id ? (
              <Text
                accessibilityRole="alert"
                className="text-[13px] text-destructive"
              >
                {rowError.message}
              </Text>
            ) : null}

            <View className="flex-row flex-wrap gap-2">
              {connection.status === "not-connected" ||
              connection.status === "available" ||
              connection.status === "unknown" ? (
                <ActionChip
                  disabled={busy}
                  label={connecting === connection.id ? "Opening…" : "Connect"}
                  onPress={() => void connect(connection.id)}
                />
              ) : null}
              {connection.status === "connected" ||
              connection.status === "unknown" ? (
                <ActionChip
                  destructive
                  disabled={busy}
                  label={
                    disconnecting === connection.id
                      ? "Disconnecting…"
                      : "Disconnect"
                  }
                  onPress={() => void disconnect(connection.id)}
                />
              ) : null}
              <ActionChip
                disabled={busy || connection.status === "unavailable"}
                label={
                  checking === connection.id ? "Checking…" : "Check status"
                }
                onPress={() => void check(connection.id)}
              />
            </View>
          </View>
        ))}
      </View>
    </SheetScaffold>
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
