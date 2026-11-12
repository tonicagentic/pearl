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
import { Stack } from "expo-router";

import { PluginLogo } from "@/components/plugin-logo";
import { SheetScaffold } from "@/components/sheet-scaffold";
import { capabilitiesForConnection } from "../../lib/plugins/capabilities";
import {
  isConnectablePlugin,
  type ResolvedPlugin,
} from "../../lib/plugins/catalog";
import {
  authorizeConnection,
  checkConnection,
  getConnections,
  revokeConnection,
  type ConnectionId,
  type ConnectionStatus,
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

const STATUS_LABEL: Record<ConnectionStatus["status"], string> = {
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
          <ConnectionPanel
            connectionId={plugin.connectionId}
            pluginLabel={plugin.label}
          />
        ) : plugin.kind === "builtin" ? (
          <StatusCard
            title="Enabled"
            body="This capability ships with Pearl and does not need a separate account connection."
          />
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
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const waitingForReturn = useRef(false);
  const busy = loading || checking || connecting || disconnecting;
  const capabilities = capabilitiesForConnection(connectionId);
  const connected = status?.status === "connected";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await getConnections();
      const item = items.find((entry) => entry.id === connectionId) ?? null;
      if (mounted.current) {
        setStatus(item);
        if (item?.status === "connected") setUserCode(null);
      }
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error ? cause.message : "Could not load status.",
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

  const check = async () => {
    if (busy) return;
    setChecking(true);
    setError(null);
    try {
      const item = await checkConnection(connectionId);
      if (mounted.current) {
        setStatus(item);
        if (item.status === "connected") setUserCode(null);
      }
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error ? cause.message : "Could not check status.",
        );
      }
    } finally {
      if (mounted.current) setChecking(false);
    }
  };

  const connect = async () => {
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
      const item = await revokeConnection(connectionId);
      if (mounted.current) {
        setStatus(item);
        setUserCode(null);
      }
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

  const state = status?.status;

  return (
    <View className="gap-4">
      <View className="gap-3 rounded-[18px] bg-card px-4 py-4">
        <Text className="text-[17px] font-medium text-foreground">
          Connection
        </Text>
        {loading && !status ? (
          <ActivityIndicator accessibilityLabel="Loading connection status" />
        ) : null}
        {status ? (
          <View className="gap-2">
            <DetailRow
              label="Status"
              value={STATUS_LABEL[status.status]}
            />
            <DetailRow
              label="Account"
              value={
                connected
                  ? (status.accountLabel ?? `Your ${pluginLabel} account`)
                  : state === "unavailable"
                    ? "Not available on this deployment"
                    : "None connected"
              }
            />
            {status.detail ? (
              <Text className="text-[13px] leading-[18px] text-muted-foreground">
                {status.detail}
              </Text>
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
          {state === "connected" || state === "unknown" ? (
            <ActionChip
              destructive
              disabled={busy}
              label={disconnecting ? "Disconnecting…" : "Disconnect"}
              onPress={() => void disconnect()}
            />
          ) : null}
          {state !== "connected" && state !== "unavailable" ? (
            <ActionChip
              disabled={busy}
              label={connecting ? "Opening…" : "Connect"}
              onPress={() => void connect()}
            />
          ) : null}
          <ActionChip
            disabled={busy || state === "unavailable"}
            label={checking ? "Checking…" : "Check status"}
            onPress={() => void check()}
          />
        </View>

        <Text className="text-[12px] leading-[16px] text-muted-foreground">
          Authorization is stored by Vercel Connect for your signed-in account.
          Pearl never stores provider tokens in this app.
        </Text>
      </View>

      {capabilities ? (
        <View className="gap-3 rounded-[18px] bg-card px-4 py-4">
          <Text className="text-[17px] font-medium text-foreground">
            {connected
              ? "What Pearl can do"
              : "What Pearl can do after you connect"}
          </Text>
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
