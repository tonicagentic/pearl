import { useCallback, useEffect, useRef, useState } from "react";
import * as Linking from "expo-linking";
import { Redirect } from "expo-router";
import { ActivityIndicator, AppState, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { authorizeConnection, checkConnection, getConnections, type ConnectionStatus } from "@/src/connections-client";

function validatedHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() !== value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

const STATUS_LABEL: Record<ConnectionStatus["status"], string> = {
  available: "Available",
  connected: "Connected",
  "not-connected": "Not connected",
  unavailable: "Unavailable",
  unknown: "Unable to verify",
};

export default function Settings() {
  const { restoring, signedIn } = useAuth();
  if (restoring) return null;
  if (!signedIn) return <Redirect href="/" />;
  return <ConnectionSettings />;
}

function ConnectionSettings() {
  const [connections, setConnections] = useState<ConnectionStatus[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<ConnectionStatus["id"] | null>(null);
  const [connecting, setConnecting] = useState<ConnectionStatus["id"] | null>(null);
  const [challenge, setChallenge] = useState<{ id: ConnectionStatus["id"]; userCode: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<{ id: ConnectionStatus["id"]; message: string } | null>(null);
  const mounted = useRef(true);
  const loadVersion = useRef(0);
  const waitingForReturn = useRef(false);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError(null);
    try {
      const items = await getConnections();
      if (mounted.current && version === loadVersion.current) {
        setConnections(items);
        setChallenge((current) => current && items.some((item) => item.id === current.id && item.status === "connected") ? null : current);
      }
    } catch (cause) {
      if (mounted.current && version === loadVersion.current) setError(cause instanceof Error ? cause.message : "Could not load connections.");
    } finally {
      if (mounted.current && version === loadVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const version = ++loadVersion.current;
    void getConnections().then((items) => {
      if (mounted.current && version === loadVersion.current) setConnections(items);
    }).catch((cause: unknown) => {
      if (mounted.current && version === loadVersion.current) setError(cause instanceof Error ? cause.message : "Could not load connections.");
    }).finally(() => {
      if (mounted.current && version === loadVersion.current) setLoading(false);
    });
    let previous = AppState.currentState;
    const subscription = Platform.OS === "web" ? null : AppState.addEventListener("change", (state) => {
      if (state === "active" && previous !== "active" && waitingForReturn.current) {
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

  const check = async (id: ConnectionStatus["id"]) => {
    if (checking || connecting || loading) return;
    setChecking(id);
    setCheckError(null);
    try {
      const item = await checkConnection(id);
      if (mounted.current) {
        setConnections((current) => current?.map((entry) => entry.id === id ? item : entry) ?? [item]);
        if (item.status === "connected") setChallenge((current) => current?.id === id ? null : current);
      }
    } catch (cause) {
      if (mounted.current) setCheckError({ id, message: cause instanceof Error ? cause.message : "Could not check status." });
    } finally {
      if (mounted.current) setChecking(null);
    }
  };

  const connect = async (id: ConnectionStatus["id"]) => {
    if (checking || connecting || loading || !connections?.some((item) => item.id === id && (item.status === "not-connected" || item.status === "available"))) return;
    setConnecting(id);
    setCheckError(null);
    setChallenge(null);
    try {
      const result = await authorizeConnection(id);
      const url = validatedHttpsUrl(result.url);
      if (!url) throw new Error("The authorization link is not a valid HTTPS URL.");
      if (mounted.current && typeof result.userCode === "string" && result.userCode) setChallenge({ id, userCode: result.userCode });
      waitingForReturn.current = true;
      await Linking.openURL(url);
    } catch (cause) {
      waitingForReturn.current = false;
      if (mounted.current) setCheckError({ id, message: cause instanceof Error && cause.message === "The authorization link is not a valid HTTPS URL."
        ? cause.message : "Could not open authorization. Try again or refresh the list." });
    } finally {
      if (mounted.current) setConnecting(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerClassName="gap-4 px-5 py-6">
        <Text className="text-2xl font-semibold text-foreground">Connections</Text>
        <Text className="text-sm text-muted-foreground">Connect a service when you choose, or check its status. Checking may refresh a connection token; it does not approve access.</Text>
        <Pressable accessibilityRole="button" disabled={loading || !!checking || !!connecting} onPress={() => void load()} className="min-h-11 self-start justify-center rounded-lg border border-border px-4 disabled:opacity-50">
          <Text className="font-medium text-foreground">{loading ? "Loading…" : "Refresh list"}</Text>
        </Pressable>
        {loading && !connections ? <ActivityIndicator accessibilityLabel="Loading connections" /> : null}
        {error ? <Text accessibilityRole="alert" className="text-sm text-destructive">{error}</Text> : null}
        {connections?.length === 0 ? <Text className="text-muted-foreground">No connections available.</Text> : null}
        {connections?.map((connection) => (
          <View key={connection.id} className="gap-2 rounded-xl border border-border bg-muted/40 p-4">
            <Text className="text-lg font-semibold text-foreground">{connection.label}</Text>
            <Text className="text-sm text-foreground">{STATUS_LABEL[connection.status]}</Text>
            {connection.detail ? <Text className="text-sm text-muted-foreground">{connection.detail}</Text> : null}
            {challenge?.id === connection.id ? (
              <View className="gap-1">
                <Text selectable className="text-base font-semibold text-foreground">Code: {challenge.userCode}</Text>
                <Text className="text-xs text-muted-foreground">Enter this code on the authorization page if prompted. Return here to refresh status, or tap Refresh list.</Text>
              </View>
            ) : null}
            {checkError?.id === connection.id ? <Text accessibilityRole="alert" className="text-sm text-destructive">{checkError.message}</Text> : null}
            {(connection.status === "not-connected" || connection.status === "available") ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Connect ${connection.label}`} disabled={!!checking || !!connecting || loading} onPress={() => void connect(connection.id)} className="min-h-11 self-start justify-center rounded-lg border border-border px-4 disabled:opacity-50">
                <Text className="font-medium text-foreground">{connecting === connection.id ? "Opening…" : "Connect"}</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel={`Check ${connection.label} status`} disabled={!!checking || !!connecting || loading || connection.status === "unavailable"} onPress={() => void check(connection.id)} className="min-h-11 self-start justify-center rounded-lg border border-border px-4 disabled:opacity-50">
              <Text className="font-medium text-foreground">{checking === connection.id ? "Checking…" : "Check status"}</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
