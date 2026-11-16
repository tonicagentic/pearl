import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Alert, Platform } from "react-native";
import { router, useFocusEffect } from "expo-router";
import {
  BrainIcon,
  CircleDollarSignIcon,
  CircleUserIcon,
  CloudIcon,
  CoinsIcon,
  InfoIcon,
  IdCardIcon,
  LogOutIcon,
  NotebookPenIcon,
  ShapesIcon,
  SparklesIcon,
  Trash2Icon,
  WalletIcon,
} from "lucide-react-native";

import { CodeSection } from "@/components/settings/code-section";
import { SheetScaffold } from "@/components/settings/sheet-scaffold";
import { Icon } from "@/components/ui/icon";
import { SettingsCard } from "@/components/ui/settings-card";
import { SettingsRow } from "@/components/ui/settings-row";
import { Text } from "@/components/ui/text";
import { agentHostname } from "@/src/agent-url";
import { getAppVersionDetail } from "@/src/app-version";
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
import { listCalendarAccounts } from "@/src/calendar-accounts-client";
import { listMailboxes } from "@/src/mailboxes-client";
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
import { fetchUsageSummary, formatSpendCents } from "@/src/usage-client";
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
  const [connections, setConnections] = useState<
    readonly ConnectionStatus[] | null
  >(null);
  const [mailboxCount, setMailboxCount] = useState<number | null>(null);
  const [calendarDetail, setCalendarDetail] = useState<string | null>(null);
  const [memoryDetail, setMemoryDetail] = useState("Facts Pearl keeps");
  const [usageDetail, setUsageDetail] = useState("Spend by period");

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void fetchMemories()
        .then((snapshot) => {
          if (!cancelled) setMemoryDetail(memoryCountLabel(snapshot.entries.length));
        })
        .catch(() => {});
      void getConnections()
        .then((next) => {
          if (!cancelled) setConnections(next);
        })
        .catch(() => {
          if (!cancelled) setConnections(null);
        });
      void listMailboxes()
        .then((next) => {
          if (!cancelled) {
            setMailboxCount(
              next.filter((item) => item.status === "connected").length,
            );
          }
        })
        .catch(() => {
          if (!cancelled) setMailboxCount(null);
        });
      void listCalendarAccounts()
        .then((icloud) => {
          if (cancelled) return;
          setCalendarDetail(
            icloud.accounts.filter((item) => item.status === "connected")
              .length > 0
              ? "icloud-linked"
              : "icloud-none",
          );
        })
        .catch(() => {
          if (!cancelled) setCalendarDetail(null);
        });
      void fetchUsageSummary()
        .then((summary) => {
          if (cancelled || !summary) return;
          const latest = summary.periods[0];
          setUsageDetail(
            latest
              ? `${formatSpendCents(latest.totalCents)} this period`
              : "No usage yet",
          );
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const emailDetail =
    mailboxCount == null
      ? "Gmail accounts"
      : mailboxCount === 0
        ? "None connected"
        : `${mailboxCount} connected`;
  const googleCalendarConnected =
    connections?.some(
      (item) => item.id === "calendar" && item.status === "connected",
    ) ?? false;
  const calendarRowDetail = (() => {
    if (connections == null && calendarDetail == null) {
      return "Google / iCloud";
    }
    const parts: string[] = [];
    if (googleCalendarConnected) parts.push("Google");
    if (calendarDetail === "icloud-linked") parts.push("iCloud");
    if (parts.length === 0) {
      if (connections != null || calendarDetail != null) {
        return "None connected";
      }
      return "Google / iCloud";
    }
    return parts.join(" · ");
  })();

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
      <SettingsCard>
        <SettingsRow
          icon={<Icon as={IdCardIcon} className="size-5 text-blue-500" />}
          label="Account"
          detail={viewerEmail ?? "Email and password"}
          onPress={() => router.push("/account")}
          showSeparator
        />
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
          icon={<Icon as={ShapesIcon} className="size-5 text-violet-500" />}
          label="Schemas"
          detail="Precise concept definitions"
          onPress={() => router.push("/plugins/schema-designer")}
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
            <Icon as={CircleDollarSignIcon} className="size-5 text-emerald-500" />
          }
          label="Money"
          detail="Pearl Money"
          onPress={() => router.push("/money")}
        />
      </SettingsCard>

      <CodeSection
        emailDetail={emailDetail}
        calendarDetail={calendarRowDetail}
      />

      <SettingsCard>
        <SettingsRow
          icon={<Icon as={SparklesIcon} className="size-5 text-violet-500" />}
          label="Models"
          detail={selectedLabel}
          onPress={() => router.push("/models")}
          showSeparator
        />
        <SettingsRow
          icon={<Icon as={CoinsIcon} className="size-5 text-amber-500" />}
          label="Usage"
          detail={usageDetail}
          onPress={() => router.push("/usage")}
          showSeparator
        />
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

      <Text variant="caption" className="px-1 pb-2 text-center opacity-70">
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
