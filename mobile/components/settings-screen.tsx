import type { ReactNode } from "react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  BrainIcon,
  CircleUserIcon,
  CloudIcon,
  InfoIcon,
  LogOutIcon,
  PuzzleIcon,
  SparklesIcon,
  WalletIcon,
} from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { PluginLogo } from "@/components/plugin-logo";
import { SheetScaffold } from "@/components/sheet-scaffold";
import { Icon } from "@/components/ui/icon";
import { agentHostname } from "@/src/agent-url";
import { useAuth } from "@/src/auth";
import {
  fetchBillingStatus,
  startBillingCheckout,
  type MobileBillingStatus,
} from "@/src/billing-client";
import {
  getConnections,
  type ConnectionStatus,
} from "@/src/connections-client";
import {
  AGENT_URL,
  getAgentUrl,
  getAuthCookie,
  subscribeAgentUrlBinding,
} from "@/src/eve-transport";
import {
  COMPOSER_MODELS,
  getModelSelection,
  subscribeModelSelection,
} from "@/src/model-selection";
import {
  ACCOUNT_PLUGINS,
  MARKETPLACE_CONNECTION_IDS,
  TONIC_PLUGINS,
} from "../../lib/plugins/catalog";
import * as Linking from "expo-linking";

const MARKETPLACE_PLUGINS = [...ACCOUNT_PLUGINS, ...TONIC_PLUGINS];

export function SettingsScreen() {
  const { viewerEmail, signOut } = useAuth();
  const selectedKey = useSyncExternalStore(
    subscribeModelSelection,
    getModelSelection,
    getModelSelection,
  );
  const agentUrl = useSyncExternalStore(
    subscribeAgentUrlBinding,
    getAgentUrl,
    getAgentUrl,
  );
  const selectedLabel =
    COMPOSER_MODELS.find((model) => model.key === selectedKey)?.label ??
    selectedKey;
  const agentHostLabel = agentHostname(agentUrl);
  const [connections, setConnections] = useState<ConnectionStatus[] | null>(
    null,
  );

  const loadConnections = useCallback(async () => {
    try {
      setConnections(await getConnections());
    } catch {
      setConnections(null);
    }
  }, []);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  const connectedCount =
    connections?.filter((item) => item.status === "connected").length ?? 0;
  const pluginsDetail =
    connections == null
      ? "Accounts, tools, agents"
      : connectedCount === 0
        ? "None connected"
        : `${connectedCount} connected`;

  const accountRows = MARKETPLACE_CONNECTION_IDS.map((id) => {
    const status = connections?.find((item) => item.id === id);
    const plugin = MARKETPLACE_PLUGINS.find(
      (entry) => entry.connectionId === id,
    );
    if (!status || !plugin) return null;
    return { status, plugin };
  }).filter(
    (
      item,
    ): item is {
      status: ConnectionStatus;
      plugin: (typeof MARKETPLACE_PLUGINS)[number];
    } => Boolean(item),
  );

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
    <SheetScaffold title="Settings">
      {viewerEmail ? (
        <Text className="px-1 text-center text-[13px] text-muted-foreground">
          {viewerEmail}
        </Text>
      ) : null}

      <SettingsCard>
        <SettingsRow
          icon={<Icon as={CircleUserIcon} className="size-5 text-sky-500" />}
          label="Identity"
          detail="Name, body, health, home"
          onPress={() => router.push("/identity")}
          showSeparator
        />
        <SettingsRow
          icon={<Icon as={SparklesIcon} className="size-5 text-violet-500" />}
          label="Models"
          detail={selectedLabel}
          onPress={() => router.push("/models")}
          showSeparator
        />
        <SettingsRow
          icon={<Icon as={PuzzleIcon} className="size-5 text-emerald-500" />}
          label="Plugins"
          detail={pluginsDetail}
          onPress={() => router.push("/plugins")}
          showSeparator
        />
        <SettingsRow
          icon={<Icon as={BrainIcon} className="size-5 text-amber-500" />}
          label="Skills"
          detail="Custom and published"
          onPress={() => router.push("/skills")}
        />
      </SettingsCard>

      {accountRows.length > 0 ? (
        <SettingsCard>
          {accountRows.map(({ status, plugin }, index) => (
            <SettingsRow
              key={plugin.id}
              icon={<PluginLogo id={plugin.id} size={28} />}
              label={plugin.label}
              detail={accountTrailing(status)}
              detailAccent={
                status.status === "not-connected" ||
                status.status === "available"
              }
              onPress={() => router.push(`/plugins/${plugin.id}`)}
              showSeparator={index < accountRows.length - 1}
            />
          ))}
        </SettingsCard>
      ) : null}

      <SettingsCard>
        <BillingRow />
        <SettingsRow
          icon={<Icon as={CloudIcon} className="size-5 text-muted-foreground" />}
          label="Self-host"
          detail={agentHostLabel}
          onPress={() => router.push("/self-host")}
          showSeparator
        />
        <SettingsRow
          icon={<Icon as={InfoIcon} className="size-5 text-muted-foreground" />}
          label="About Pearl"
          detail="Intro"
          onPress={() => router.push("/about")}
          showSeparator
        />
        <SettingsRow
          icon={<Icon as={LogOutIcon} className="size-5 text-destructive" />}
          label="Sign out"
          labelDestructive
          onPress={confirmSignOut}
        />
      </SettingsCard>
    </SheetScaffold>
  );
}

function accountTrailing(status: ConnectionStatus): string {
  if (status.status === "connected") {
    return status.accountLabel?.trim() || "Connected";
  }
  if (status.status === "unavailable") return "Unavailable";
  if (status.status === "unknown") return "Check";
  return "Connect";
}

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(0)}`;
}

function BillingRow() {
  const [status, setStatus] = useState<MobileBillingStatus | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchBillingStatus().then((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const detail = (() => {
    if (!status || !status.enabled) return "Off";
    if (status.exempt) return "Free pass";
    if (status.needsCheckout) return "Subscribe";
    return `${formatCents(status.spentCents)} of ${formatCents(status.usageCapCents)}`;
  })();

  const onPress = async () => {
    if (!status?.enabled || pending) return;
    if (status.exempt) {
      Alert.alert("Billing", "This account has a free pass and is not billed.");
      return;
    }
    setPending(true);
    try {
      if (status.needsCheckout) {
        await Linking.openURL(await startBillingCheckout());
        return;
      }
      if (status.hasPortal) {
        const token = getAuthCookie();
        const response = await fetch(`${AGENT_URL}/api/billing/portal`, {
          method: "POST",
          headers: {
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
        });
        const body = (await response.json()) as { url?: string; error?: string };
        if (!response.ok || !body.url) {
          throw new Error(body.error ?? "Could not open billing portal.");
        }
        await Linking.openURL(body.url);
        return;
      }
      Alert.alert(
        "Billing",
        `Spent ${formatCents(status.spentCents)} of ${formatCents(status.usageCapCents)} this period.`,
      );
    } catch (cause) {
      Alert.alert(
        "Billing",
        cause instanceof Error ? cause.message : "Could not open billing.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <SettingsRow
      icon={<Icon as={WalletIcon} className="size-5 text-foreground" />}
      label="Billing"
      detail={pending ? "Opening…" : detail}
      onPress={() => void onPress()}
      showSeparator
    />
  );
}

function SettingsCard({ children }: { readonly children: ReactNode }) {
  return (
    <View className="overflow-hidden rounded-[18px] bg-card">{children}</View>
  );
}

function SettingsRow({
  icon,
  label,
  detail,
  detailAccent,
  labelDestructive,
  onPress,
  showSeparator,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly detail?: string;
  readonly detailAccent?: boolean;
  readonly labelDestructive?: boolean;
  readonly onPress: () => void;
  readonly showSeparator?: boolean;
}) {
  const accentColor = useCSSVariable("--color-primary") as string | undefined;

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        className="active:bg-muted/80"
        onPress={onPress}
        style={styles.row}
      >
        <View className="size-9 items-center justify-center overflow-hidden rounded-[10px] bg-muted">
          {icon}
        </View>
        <Text
          className={`min-w-0 flex-1 text-[17px] leading-[22px] ${labelDestructive ? "text-destructive" : "text-foreground"}`}
          numberOfLines={1}
        >
          {label}
        </Text>
        {detail ? (
          <Text
            className="max-w-[42%] text-right text-[15px] text-muted-foreground"
            numberOfLines={1}
            style={
              detailAccent && accentColor ? { color: accentColor } : undefined
            }
          >
            {detail}
          </Text>
        ) : null}
        <Text className="text-[20px] font-light text-muted-foreground/40">
          ›
        </Text>
      </Pressable>
      {showSeparator ? (
        <View
          className="ml-[52px] h-px bg-border"
          style={styles.separatorHairline}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  separatorHairline: {
    height: StyleSheet.hairlineWidth,
  },
});
