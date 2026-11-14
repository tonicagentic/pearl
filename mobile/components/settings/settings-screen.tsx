import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Alert, Platform, Text } from "react-native";
import { router, useFocusEffect } from "expo-router";
import {
  BrainIcon,
  CircleUserIcon,
  CloudIcon,
  FolderGit2Icon,
  InfoIcon,
  LogOutIcon,
  NetworkIcon,
  NotebookPenIcon,
  PuzzleIcon,
  SparklesIcon,
  Trash2Icon,
  WalletIcon,
} from "lucide-react-native";

import { SheetScaffold } from "@/components/settings/sheet-scaffold";
import { Icon } from "@/components/ui/icon";
import { SettingsCard } from "@/components/ui/settings-card";
import { SettingsRow } from "@/components/ui/settings-row";
import { agentHostname } from "@/src/agent-url";
import { getAppVersionDetail } from "@/src/app-version";
import { useAuth } from "@/src/auth";
import {
  fetchBillingStatus,
  startBillingCheckout,
  type MobileBillingStatus,
} from "@/src/billing-client";
import { getConnections } from "@/src/connections-client";
import { fetchMemories } from "@/src/memory-client";
import {
  AGENT_URL,
  getAgentUrl,
  getAuthCookie,
  isHostedLocked,
  subscribeAgentUrlBinding,
} from "@/src/eve-transport";
import {
  COMPOSER_MODELS,
  getModelSelection,
  subscribeModelSelection,
} from "@/src/model-selection";
import * as Linking from "expo-linking";

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
  const [connectedCount, setConnectedCount] = useState<number | null>(null);
  const [memoryDetail, setMemoryDetail] = useState("Facts Pearl keeps");

  const loadConnections = useCallback(async () => {
    try {
      const connections = await getConnections();
      setConnectedCount(
        connections.filter((item) => item.status === "connected").length,
      );
    } catch {
      setConnectedCount(null);
    }
  }, []);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void fetchMemories()
        .then((snapshot) => {
          if (!cancelled) setMemoryDetail(memoryCountLabel(snapshot.entries.length));
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const pluginsDetail =
    connectedCount == null
      ? "Accounts, tools, agents"
      : connectedCount === 0
        ? "None connected"
        : `${connectedCount} connected`;

  const confirmSignOut = () => {
    const complete = () => {
      // Stack.Protected redirects to /sign-in once the session clears.
      signOut();
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

  const confirmDeleteAccount = () => {
    const run = async () => {
      try {
        const credential = getAuthCookie();
        const response = await fetch(`${AGENT_URL}/api/account`, {
          method: "DELETE",
          headers: {
            "content-type": "application/json",
            Origin: AGENT_URL,
            ...(credential ? { authorization: `Bearer ${credential}` } : {}),
          },
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? `Delete failed (${response.status}).`);
        }
        signOut();
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : "Could not delete account.";
        if (Platform.OS === "web") {
          window.alert(message);
        } else {
          Alert.alert("Could not delete account", message);
        }
      }
    };

    const title = "Delete your Pearl account?";
    const body =
      "This removes your chats, projects, and connection grants on this host. It cannot be undone.";
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`${title}\n\n${body}`)) {
        void run();
      }
      return;
    }
    Alert.alert(title, body, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete account", style: "destructive", onPress: () => void run() },
    ]);
  };

  return (
    <SheetScaffold>
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
          icon={<Icon as={NotebookPenIcon} className="size-5 text-rose-500" />}
          label="Memory"
          detail={memoryDetail}
          onPress={() => router.push("/memory")}
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

      <SettingsCard>
        <SettingsRow
          icon={
            <Icon as={FolderGit2Icon} className="size-5 text-orange-500" />
          }
          label="Repos"
          detail="Pinned GitHub / Vercel / Expo"
          onPress={() => router.push("/workbench")}
          showSeparator
        />
        <SettingsRow
          icon={<Icon as={NetworkIcon} className="size-5 text-teal-500" />}
          label="Areas"
          detail="Life tree (read-only on mobile)"
          onPress={() => router.push("/areas")}
        />
      </SettingsCard>

      <SettingsCard>
        <BillingRow />
        {isHostedLocked() ? null : (
          <SettingsRow
            icon={
              <Icon as={CloudIcon} className="size-5 text-muted-foreground" />
            }
            label="Self-host"
            detail={agentHostLabel}
            onPress={() => router.push("/self-host")}
            showSeparator
          />
        )}
        <SettingsRow
          icon={<Icon as={InfoIcon} className="size-5 text-muted-foreground" />}
          label="About Pearl"
          detail={getAppVersionDetail()}
          onPress={() => router.push("/about")}
          showSeparator
        />
        <SettingsRow
          icon={<Icon as={LogOutIcon} className="size-5 text-destructive" />}
          label="Sign out"
          labelDestructive
          onPress={confirmSignOut}
          showSeparator
        />
        <SettingsRow
          icon={<Icon as={Trash2Icon} className="size-5 text-destructive" />}
          label="Delete account"
          labelDestructive
          onPress={confirmDeleteAccount}
        />
      </SettingsCard>

      <Text className="px-1 pb-2 text-center text-[12px] text-muted-foreground/70">
        Pearl {getAppVersionDetail()}
      </Text>
    </SheetScaffold>
  );
}

function memoryCountLabel(count: number): string {
  if (count === 0) return "None yet";
  if (count === 1) return "1 saved";
  return `${count} saved`;
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
    if (status.trial) {
      if (status.reason === "trial_cap_reached") return "Allowance used";
      return `${formatCents(status.spentCents)} of ${formatCents(status.usageCapCents)} trial`;
    }
    if (status.needsCheckout) return "Subscribe";
    return `${formatCents(status.spentCents)} of ${formatCents(status.usageCapCents)}`;
  })();

  const onPress = async () => {
    if (!status?.enabled || pending) return;
    if (status.exempt) {
      Alert.alert("Billing", "This account has a free pass and is not billed.");
      return;
    }
    if (status.trial) {
      Alert.alert(
        "Friend beta",
        status.message ??
          `Included ${formatCents(status.usageCapCents)} / month. Spent ${formatCents(status.spentCents)} this period.`,
      );
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
