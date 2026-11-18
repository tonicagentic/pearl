import { useCallback, useState, useSyncExternalStore } from "react";
import { Alert, Platform, Pressable, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import {
  BrainIcon,
  CalendarIcon,
  CircleDollarSignIcon,
  ClipboardListIcon,
  CloudIcon,
  Code2Icon,
  CoinsIcon,
  FileSearchIcon,
  HardDriveIcon,
  ImageIcon,
  IdCardIcon,
  LayoutTemplateIcon,
  ListTodoIcon,
  LogOutIcon,
  MailIcon,
  MessageCircleQuestionIcon,
  NotebookPenIcon,
  PenLineIcon,
  ScanSearchIcon,
  ShapesIcon,
  SparklesIcon,
  WalletIcon,
} from "lucide-react-native";

import { SheetScaffold } from "@/components/settings/sheet-scaffold";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { SettingsCard } from "@/components/ui/settings-card";
import { SettingsRow } from "@/components/ui/settings-row";
import { Text } from "@/components/ui/text";
import { agentHostname } from "@/src/agent-url";
import { getAppVersionDetail } from "@/src/app-version";
import { useAuth } from "@/src/auth";
import { initials } from "@/src/initials";
import {
  fetchBillingStatus,
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
  getAgentUrl,
  isHostedLocked,
  subscribeAgentUrlBinding,
} from "@/src/eve-transport";
import {
  COMPOSER_MODELS,
  getModelSelection,
  subscribeModelSelection,
} from "@/src/model-selection";
import { fetchUsageSummary, formatSpendCents } from "@/src/usage-client";

export function SettingsScreen() {
  const { viewerEmail, viewerName, signOut } = useAuth();
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

  return (
    <SheetScaffold>
      <Section title="Account">
        <AccountRow
          name={viewerName}
          email={viewerEmail}
          onPress={() => router.push("/account")}
        />
        <SettingsRow
          icon={<Icon as={MailIcon} className="size-5 text-sky-600" />}
          label="Email"
          detail={emailDetail}
          onPress={() => router.push("/email")}
          showSeparator
        />
        <SettingsRow
          icon={<Icon as={CalendarIcon} className="size-5 text-rose-500" />}
          label="Calendar"
          detail={calendarRowDetail}
          onPress={() => router.push("/calendar")}
        />
      </Section>

      <SettingsCard>
        <SettingsRow
          icon={
            <Icon as={CircleDollarSignIcon} className="size-5 text-emerald-500" />
          }
          label="Money"
          detail="Pearl Money"
          onPress={() => router.push("/money")}
          showSeparator
        />
        <SettingsRow
          icon={<Icon as={ListTodoIcon} className="size-5 text-teal-500" />}
          label="Tasks"
          detail="Pearl Tasks"
          onPress={() => router.push("/tasks")}
        />
      </SettingsCard>

      <Section title="Think">
        <SettingsRow
          icon={
            <Icon
              as={MessageCircleQuestionIcon}
              className="size-5 text-sky-500"
            />
          }
          label="Answers"
          detail="Web and connected accounts"
          onPress={() => router.push("/answers")}
          showSeparator
        />
        <SettingsRow
          icon={<Icon as={ScanSearchIcon} className="size-5 text-violet-500" />}
          label="Research"
          detail="Deep research with citations"
          onPress={() => router.push("/research")}
          showSeparator
        />
        <SettingsRow
          icon={<Icon as={ClipboardListIcon} className="size-5 text-amber-500" />}
          label="Plan"
          detail="Travel and how you plan"
          onPress={() => router.push("/plan")}
          showSeparator
        />
        <SettingsRow
          icon={<Icon as={PenLineIcon} className="size-5 text-indigo-500" />}
          label="Drafting"
          detail="Writing and style"
          onPress={() => router.push("/drafting")}
          showSeparator
        />
        <SettingsRow
          icon={<Icon as={FileSearchIcon} className="size-5 text-sky-600" />}
          label="Analysis"
          detail="PDF, images, tables, text"
          onPress={() => router.push("/analysis")}
        />
      </Section>

      <Section title="Make">
        <SettingsRow
          icon={<Icon as={Code2Icon} className="size-5 text-emerald-600" />}
          label="Coder"
          detail="Build, PR, deploy"
          onPress={() => router.push("/plugins/coder")}
          showSeparator
        />
        <SettingsRow
          icon={<Icon as={ImageIcon} className="size-5 text-fuchsia-500" />}
          label="Visualize"
          detail="Graphics, diagrams, images"
          onPress={() => router.push("/visualize")}
          showSeparator
        />
        <SettingsRow
          icon={
            <Icon as={LayoutTemplateIcon} className="size-5 text-violet-500" />
          }
          label="Design"
          detail="Presentations, documents, layouts"
          onPress={() => router.push("/design")}
        />
      </Section>

      <Section title="Agent">
        <SettingsRow
          icon={<Icon as={SparklesIcon} className="size-5 text-violet-500" />}
          label="Models"
          detail={selectedLabel}
          onPress={() => router.push("/models")}
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
      </Section>

      <Section title="Usage">
        <SettingsRow
          icon={<Icon as={CoinsIcon} className="size-5 text-amber-500" />}
          label="Usage"
          detail={usageDetail}
          onPress={() => router.push("/usage")}
          showSeparator
        />
        <SettingsRow
          icon={<Icon as={HardDriveIcon} className="size-5 text-sky-600" />}
          label="Storage"
          detail="Chat, saved files, Drive"
          onPress={() => router.push("/storage")}
          showSeparator
        />
        <BillingRow />
      </Section>

      {isHostedLocked() ? null : (
        <SettingsCard>
          <SettingsRow
            icon={
              <Icon as={CloudIcon} className="size-5 text-muted-foreground" />
            }
            label="Self-host"
            detail={agentHostLabel}
            onPress={() => router.push("/self-host")}
          />
        </SettingsCard>
      )}

      <SettingsCard>
        <SettingsRow
          icon={<Icon as={LogOutIcon} className="size-5 text-destructive" />}
          label="Sign out"
          labelDestructive
          onPress={confirmSignOut}
        />
      </SettingsCard>

      <Text variant="caption" className="px-1 pb-2 text-center opacity-70">
        Pearl {getAppVersionDetail()}
      </Text>
    </SheetScaffold>
  );
}

function accountTitle(
  name: string | null,
  email: string | null,
): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  const local = email?.split("@")[0]?.trim();
  if (local) return local;
  return "Account";
}

/** Taller Profile row: name, email, and the same destination as Account. */
function AccountRow({
  name,
  email,
  onPress,
}: {
  readonly name: string | null;
  readonly email: string | null;
  readonly onPress: () => void;
}) {
  const title = accountTitle(name, email);
  const mark = initials(name, email);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={email ? `${title}, ${email}` : title}
        className="active:bg-muted/80"
        onPress={onPress}
        style={accountStyles.row}
      >
        <View className="size-14 items-center justify-center rounded-[16px] bg-muted">
          {mark ? (
            <Text variant="title" weight="semibold">
              {mark}
            </Text>
          ) : (
            <Icon as={IdCardIcon} className="size-7 text-blue-500" />
          )}
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="title" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="secondary" numberOfLines={1}>
            {email ?? "Email and password"}
          </Text>
        </View>
        <Text variant="title" tone="muted" weight="light" className="opacity-40">
          ›
        </Text>
      </Pressable>
      <View
        className="ml-[84px] bg-border"
        style={accountStyles.separatorHairline}
      />
    </View>
  );
}

const accountStyles = StyleSheet.create({
  row: {
    minHeight: 84,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  separatorHairline: {
    height: StyleSheet.hairlineWidth,
  },
});

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

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void fetchBillingStatus().then((next) => {
        if (!cancelled) setStatus(next);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

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

  return (
    <SettingsRow
      icon={<Icon as={WalletIcon} className="size-5 text-foreground" />}
      label="Billing"
      detail={detail}
      onPress={() => router.push("/billing")}
    />
  );
}
