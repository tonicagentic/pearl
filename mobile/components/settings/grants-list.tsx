import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

import { PluginLogo } from "@/components/settings/plugin-logo";
import {
  authorizeConnection,
  getConnectionGrants,
  revokeConnection,
  type ConnectionGrantSummary,
  type ConnectionId,
} from "@/src/connections-client";
import type { PluginMarkId } from "../../../lib/plugins/catalog";

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

/** Per-user grant cards with Connect / Update / Disconnect. */
export function GrantsList() {
  const [grants, setGrants] = useState<ConnectionGrantSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<ConnectionId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const mounted = useRef(true);
  const waitingForReturn = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await getConnectionGrants();
      if (mounted.current) {
        setGrants(items.filter((item) => item.status !== "unavailable"));
      }
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error ? cause.message : "Could not load grants.",
        );
      }
    } finally {
      if (mounted.current) setLoading(false);
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

  const authorize = async (id: ConnectionId) => {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    setUserCode(null);
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
        setUserCode(result.userCode);
      }
      waitingForReturn.current = true;
      await Linking.openURL(url);
    } catch (cause) {
      waitingForReturn.current = false;
      if (mounted.current) {
        setError(
          cause instanceof Error ? cause.message : "Could not open authorization.",
        );
      }
    } finally {
      if (mounted.current) setBusyId(null);
    }
  };

  const disconnect = async (id: ConnectionId) => {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      await revokeConnection(id);
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

  return (
    <View className="gap-3">
      <View className="gap-1 px-1">
        <Text className="text-[15px] font-medium text-muted-foreground">
          Your grants
        </Text>
        <Text className="text-[13px] leading-[18px] text-muted-foreground">
          Pearl acts as you with these accounts. Update refreshes scopes without
          disconnecting first.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={loading || busyId !== null}
        onPress={() => void load()}
        className="min-h-11 self-start justify-center rounded-[10px] bg-card px-4 disabled:opacity-50"
      >
        <Text className="text-[17px] text-foreground">
          {loading ? "Loading…" : "Refresh grants"}
        </Text>
      </Pressable>

      {loading && !grants ? (
        <ActivityIndicator accessibilityLabel="Loading grants" />
      ) : null}
      {error ? (
        <Text
          accessibilityRole="alert"
          className="px-1 text-[13px] text-destructive"
        >
          {error}
        </Text>
      ) : null}
      {userCode ? (
        <Text selectable className="px-1 text-[15px] font-semibold text-foreground">
          Code: {userCode}
        </Text>
      ) : null}

      {grants?.map((grant) => {
        const busy = busyId === grant.id;
        const connected = grant.status === "connected";
        const canConnect =
          grant.status !== "connected" && grant.status !== "unavailable";
        return (
          <View
            key={grant.id}
            className="gap-3 rounded-[18px] bg-card px-4 py-4"
          >
            <View className="flex-row items-start gap-3">
              <PluginLogo id={grant.id as PluginMarkId} size={40} />
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-[17px] font-medium text-foreground">
                  {grant.label}
                </Text>
                <GrantBody grant={grant} />
              </View>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {connected ? (
                <ActionChip
                  disabled={busy}
                  label={busy ? "Opening…" : "Update"}
                  onPress={() => void authorize(grant.id)}
                />
              ) : null}
              {canConnect ? (
                <ActionChip
                  disabled={busy}
                  label={busy ? "Opening…" : "Connect"}
                  onPress={() => void authorize(grant.id)}
                />
              ) : null}
              {connected || grant.status === "unknown" ? (
                <ActionChip
                  destructive
                  disabled={busy}
                  label={busy ? "Working…" : "Disconnect"}
                  onPress={() => void disconnect(grant.id)}
                />
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function GrantBody({ grant }: { readonly grant: ConnectionGrantSummary }) {
  const connected = grant.status === "connected";
  return (
    <View className="gap-1">
      <Text className="text-[13px] text-muted-foreground">
        {STATUS_LABEL[grant.status]}
        {connected && grant.accountLabel ? ` · ${grant.accountLabel}` : ""}
      </Text>
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
            : grant.github.repos.length > 0
              ? " · can push pinned repos"
              : ""}
        </Text>
      ) : null}
      {grant.vercel ? (
        <Text className="text-[13px] leading-[18px] text-muted-foreground">
          Vercel {grant.vercel.username}
          {grant.vercel.teams.length > 0
            ? ` · ${grant.vercel.teams.length} team${grant.vercel.teams.length === 1 ? "" : "s"}`
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
