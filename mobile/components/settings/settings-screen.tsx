import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Alert, Platform, Pressable, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import {
  BellIcon,
  BotIcon,
  BrainIcon,
  CalendarIcon,
  CircleDollarSignIcon,
  ClipboardListIcon,
  CloudIcon,
  Code2Icon,
  CoinsIcon,
  FileSearchIcon,
  FolderIcon,
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

import { SearchDock } from "@/components/search/search-dock";
import { useSettingsModalChromeOptional } from "@/components/settings/settings-modal-chrome";
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
import { openWebUrlExternally } from "@/src/open-web-url";
import {
  getPushPermissionStatus,
  requestPushNotificationPermission,
} from "@/src/push-notifications";

const PRIVACY_URL = "https://pearl.diy/privacy";
const TERMS_URL = "https://pearl.diy/terms";
import { listMailboxes } from "@/src/mailboxes-client";
import { fetchCapabilities } from "@/src/capabilities-client";
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
import { useStackSearch } from "@/src/use-stack-search";

export function SettingsScreen() {
  const { viewerEmail, viewerName, signOut } = useAuth();
  const search = useStackSearch();
  const chrome = useSettingsModalChromeOptional();
  const searchOpen = chrome?.searchOpen ?? false;
  useEffect(() => {
    if (!searchOpen) search.setQueryText("");
    // Only react to chrome open/close — not search identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [searchOpen]);
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
  const [capabilitiesDetail, setCapabilitiesDetail] = useState(
    "What you can sell",
  );
  const [usageDetail, setUsageDetail] = useState("Spend by period");
  const [pushStatus, setPushStatus] = useState<
    "granted" | "denied" | "undetermined" | "loading"
  >("loading");
  const [pushPending, setPushPending] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getPushPermissionStatus().then((status) => {
        if (!cancelled) setPushStatus(status);
      });
      void fetchMemories()
        .then((snapshot) => {
          if (!cancelled) setMemoryDetail(memoryCountLabel(snapshot.entries.length));
        })
        .catch(() => {});
      void fetchCapabilities(false)
        .then((rows) => {
          if (!cancelled) {
            setCapabilitiesDetail(
              rows.length === 0
                ? "What you can sell"
                : rows.length === 1
                  ? "1 capability"
                  : `${String(rows.length)} capabilities`,
            );
          }
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

  const accountHeading = accountTitle(viewerName, viewerEmail);
  const showAccount = search.matches(
    "Account",
    accountHeading,
    viewerName,
    viewerEmail,
  );
  const showEmail = search.matches("Email", emailDetail);
  const showCalendar = search.matches("Calendar", calendarRowDetail);
  const showWorkspaces = search.matches(
    "Projects",
    "Projects for chats",
  );
  const showMoney = search.matches("Money", "Pearl Money");
  const showTasks = search.matches("Tasks", "Due soon and parked");
  const showAnswers = search.matches("Answers", "Web and connected accounts");
  const showResearch = search.matches("Research", "Deep research with citations");
  const showPlan = search.matches("Plan", "Travel and how you plan");
  const showDrafting = search.matches("Drafting", "Writing and style");
  const showAnalysis = search.matches("Analysis", "PDF, images, tables, text");
  const showCoder = search.matches("Coder", "Build, PR, deploy");
  const showVisualize = search.matches(
    "Visualize",
    "Graphics, diagrams, images",
  );
  const showDesign = search.matches(
    "Design",
    "Presentations, documents, layouts",
  );
  const showModels = search.matches("Models", selectedLabel);
  const showMemory = search.matches("Memory", memoryDetail);
  const showCapabilities = search.matches(
    "Capabilities",
    capabilitiesDetail,
    "sell",
    "product",
    "service",
  );
  const showSchemas = search.matches("Schemas", "Precise concept definitions");
  const showSkills = search.matches("Skills", "Custom and published");
  const showUsage = search.matches("Usage", usageDetail);
  const showStorage = search.matches("Storage", "Chat, saved files, Drive");
  const showConnected = search.matches(
    "Connected agents",
    "Private eve deployments",
  );
  const showSelfHost =
    !isHostedLocked() && search.matches("Self-host", agentHostLabel);
  const showSignOut = search.matches("Sign out");
  const showNotifications = search.matches(
    "Notifications",
    "Enable",
    "push",
    "alerts",
  );

  const showAccountSection =
    showAccount || showEmail || showCalendar || showNotifications;
  const showAppsCard = showWorkspaces || showMoney || showTasks;
  const showThink =
    showAnswers || showResearch || showPlan || showDrafting || showAnalysis;
  const showMake = showCoder || showVisualize || showDesign;
  const showAgent =
    showModels ||
    showMemory ||
    showCapabilities ||
    showSchemas ||
    showSkills;
  const showUsageSection = showUsage || showStorage || search.matches("Billing");
  const showHostingCard = showConnected || showSelfHost;

  return (
    <View style={{ flex: 1 }}>
      <SheetScaffold footer={searchOpen ? <View style={{ height: 72 }} /> : null}>
        {showAccountSection ? (
          <Section title="Account">
            {showAccount ? (
              <AccountRow
                name={viewerName}
                email={viewerEmail}
                onPress={() => router.push("/settings/account")}
              />
            ) : null}
            {showEmail ? (
              <SettingsRow
                icon={<Icon as={MailIcon} className="size-5 text-sky-600" />}
                label="Email"
                detail={emailDetail}
                onPress={() => router.push("/settings/email")}
                showSeparator={showCalendar || showNotifications}
              />
            ) : null}
            {showCalendar ? (
              <SettingsRow
                icon={
                  <Icon as={CalendarIcon} className="size-5 text-rose-500" />
                }
                label="Calendar"
                detail={calendarRowDetail}
                onPress={() => router.push("/settings/calendar")}
                showSeparator={showNotifications}
              />
            ) : null}
            {showNotifications ? (
              <SettingsRow
                icon={
                  <Icon as={BellIcon} className="size-5 text-muted-foreground" />
                }
                label="Notifications"
                detail={
                  pushStatus === "granted"
                    ? "On"
                    : pushStatus === "denied"
                      ? "Off — enable in Settings"
                      : pushPending
                        ? "Enabling…"
                        : "Enable"
                }
                onPress={() => {
                  if (pushStatus === "granted" || pushPending) return;
                  if (pushStatus === "denied") {
                    Alert.alert(
                      "Notifications are off",
                      "Enable Pearl notifications in iOS Settings → Pearl.",
                    );
                    return;
                  }
                  setPushPending(true);
                  void requestPushNotificationPermission()
                    .then((next) => setPushStatus(next))
                    .finally(() => setPushPending(false));
                }}
              />
            ) : null}
          </Section>
        ) : null}

        {showAppsCard ? (
          <SettingsCard>
            {showWorkspaces ? (
              <SettingsRow
                icon={
                  <Icon as={FolderIcon} className="size-5 text-amber-600" />
                }
                label="Projects"
                detail="Organize chats"
                onPress={() => router.navigate("/workspaces")}
                showSeparator={showMoney || showTasks}
              />
            ) : null}
            {showMoney ? (
              <SettingsRow
                icon={
                  <Icon
                    as={CircleDollarSignIcon}
                    className="size-5 text-emerald-500"
                  />
                }
                label="Money"
                detail="Pearl Money"
                onPress={() => router.push("/settings/money")}
                showSeparator={showTasks}
              />
            ) : null}
            {showTasks ? (
              <SettingsRow
                icon={<Icon as={ListTodoIcon} className="size-5 text-teal-500" />}
                label="Tasks"
                detail="Due soon and parked"
                onPress={() => router.navigate("/tasks")}
              />
            ) : null}
          </SettingsCard>
        ) : null}

        {showThink ? (
          <Section title="Think">
            {showAnswers ? (
              <SettingsRow
                icon={
                  <Icon
                    as={MessageCircleQuestionIcon}
                    className="size-5 text-sky-500"
                  />
                }
                label="Answers"
                detail="Web and connected accounts"
                onPress={() => router.push("/settings/answers")}
                showSeparator={
                  showResearch || showPlan || showDrafting || showAnalysis
                }
              />
            ) : null}
            {showResearch ? (
              <SettingsRow
                icon={
                  <Icon as={ScanSearchIcon} className="size-5 text-violet-500" />
                }
                label="Research"
                detail="Deep research with citations"
                onPress={() => router.push("/settings/research")}
                showSeparator={showPlan || showDrafting || showAnalysis}
              />
            ) : null}
            {showPlan ? (
              <SettingsRow
                icon={
                  <Icon
                    as={ClipboardListIcon}
                    className="size-5 text-amber-500"
                  />
                }
                label="Plan"
                detail="Travel and how you plan"
                onPress={() => router.push("/settings/plan")}
                showSeparator={showDrafting || showAnalysis}
              />
            ) : null}
            {showDrafting ? (
              <SettingsRow
                icon={
                  <Icon as={PenLineIcon} className="size-5 text-indigo-500" />
                }
                label="Drafting"
                detail="Writing and style"
                onPress={() => router.push("/settings/drafting")}
                showSeparator={showAnalysis}
              />
            ) : null}
            {showAnalysis ? (
              <SettingsRow
                icon={
                  <Icon as={FileSearchIcon} className="size-5 text-sky-600" />
                }
                label="Analysis"
                detail="PDF, images, tables, text"
                onPress={() => router.push("/settings/analysis")}
              />
            ) : null}
          </Section>
        ) : null}

        {showMake ? (
          <Section title="Make">
            {showCoder ? (
              <SettingsRow
                icon={
                  <Icon as={Code2Icon} className="size-5 text-emerald-600" />
                }
                label="Coder"
                detail="Build, PR, deploy"
                onPress={() => router.push("/settings/plugins/coder")}
                showSeparator={showVisualize || showDesign}
              />
            ) : null}
            {showVisualize ? (
              <SettingsRow
                icon={
                  <Icon as={ImageIcon} className="size-5 text-fuchsia-500" />
                }
                label="Visualize"
                detail="Graphics, diagrams, images"
                onPress={() => router.push("/settings/visualize")}
                showSeparator={showDesign}
              />
            ) : null}
            {showDesign ? (
              <SettingsRow
                icon={
                  <Icon
                    as={LayoutTemplateIcon}
                    className="size-5 text-violet-500"
                  />
                }
                label="Design"
                detail="Presentations, documents, layouts"
                onPress={() => router.push("/settings/design")}
              />
            ) : null}
          </Section>
        ) : null}

        {showAgent ? (
          <Section title="Agent">
            {showModels ? (
              <SettingsRow
                icon={
                  <Icon as={SparklesIcon} className="size-5 text-violet-500" />
                }
                label="Models"
                detail={selectedLabel}
                onPress={() => router.push("/settings/models")}
                showSeparator={
                  showMemory ||
                  showCapabilities ||
                  showSchemas ||
                  showSkills
                }
              />
            ) : null}
            {showMemory ? (
              <SettingsRow
                icon={
                  <Icon as={NotebookPenIcon} className="size-5 text-rose-500" />
                }
                label="Memory"
                detail={memoryDetail}
                onPress={() => router.push("/settings/memory")}
                showSeparator={
                  showCapabilities || showSchemas || showSkills
                }
              />
            ) : null}
            {showCapabilities ? (
              <SettingsRow
                icon={
                  <Icon as={SparklesIcon} className="size-5 text-emerald-500" />
                }
                label="Capabilities"
                detail={capabilitiesDetail}
                onPress={() => router.push("/settings/capabilities")}
                showSeparator={showSchemas || showSkills}
              />
            ) : null}
            {showSchemas ? (
              <SettingsRow
                icon={
                  <Icon as={ShapesIcon} className="size-5 text-violet-500" />
                }
                label="Schemas"
                detail="Precise concept definitions"
                onPress={() => router.push("/settings/plugins/schema-designer")}
                showSeparator={showSkills}
              />
            ) : null}
            {showSkills ? (
              <SettingsRow
                icon={<Icon as={BrainIcon} className="size-5 text-amber-500" />}
                label="Skills"
                detail="Custom and published"
                onPress={() => router.push("/settings/skills")}
              />
            ) : null}
          </Section>
        ) : null}

        {showUsageSection ? (
          <Section title="Usage">
            {showUsage ? (
              <SettingsRow
                icon={<Icon as={CoinsIcon} className="size-5 text-amber-500" />}
                label="Usage"
                detail={usageDetail}
                onPress={() => router.push("/settings/usage")}
                showSeparator={showStorage || search.matches("Billing")}
              />
            ) : null}
            {showStorage ? (
              <SettingsRow
                icon={
                  <Icon as={HardDriveIcon} className="size-5 text-sky-600" />
                }
                label="Storage"
                detail="Chat, saved files, Drive"
                onPress={() => router.push("/settings/storage")}
                showSeparator={search.matches("Billing")}
              />
            ) : null}
            <BillingRow matches={search.matches} />
          </Section>
        ) : null}

        {showHostingCard ? (
          <SettingsCard>
            {showConnected ? (
              <SettingsRow
                icon={
                  <Icon as={BotIcon} className="size-5 text-muted-foreground" />
                }
                label="Connected agents"
                detail="Private eve deployments"
                onPress={() => router.push("/settings/connected-agents")}
                showSeparator={showSelfHost}
              />
            ) : null}
            {showSelfHost ? (
              <SettingsRow
                icon={
                  <Icon
                    as={CloudIcon}
                    className="size-5 text-muted-foreground"
                  />
                }
                label="Self-host"
                detail={agentHostLabel}
                onPress={() => router.push("/settings/self-host")}
              />
            ) : null}
          </SettingsCard>
        ) : null}

        {showSignOut ? (
          <SettingsCard>
            <SettingsRow
              icon={<Icon as={LogOutIcon} className="size-5 text-destructive" />}
              label="Sign out"
              labelDestructive
              onPress={confirmSignOut}
            />
          </SettingsCard>
        ) : null}

        {search.active || searchOpen ? null : (
          <View className="items-center gap-2 px-1 pb-2">
            <View className="flex-row items-center gap-3">
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Privacy policy"
                onPress={() => openWebUrlExternally(PRIVACY_URL)}
              >
                <Text variant="caption" className="opacity-70 underline">
                  Privacy
                </Text>
              </Pressable>
              <Text variant="caption" className="opacity-40">
                ·
              </Text>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Terms of service"
                onPress={() => openWebUrlExternally(TERMS_URL)}
              >
                <Text variant="caption" className="opacity-70 underline">
                  Terms
                </Text>
              </Pressable>
            </View>
            <Text variant="caption" className="opacity-70">
              Pearl {getAppVersionDetail()}
            </Text>
          </View>
        )}
      </SheetScaffold>
      {searchOpen ? (
        <SearchDock
          value={search.query}
          onChangeText={search.setQueryText}
          onDismiss={() => {
            search.setQueryText("");
            chrome?.setSearchOpen(false);
          }}
          placeholder="Search"
          accessibilityLabel="Search settings"
        />
      ) : null}
    </View>
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

function BillingRow({
  matches,
}: {
  readonly matches: (
    ...parts: readonly (string | null | undefined)[]
  ) => boolean;
}) {
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
      if (status.reason === "trial_cap_reached") return "Allowance used — upgrade";
      if (status.remainingCents != null) {
        return `${formatCents(status.remainingCents)} left · trial`;
      }
      return `${formatCents(status.spentCents)} of ${formatCents(status.usageCapCents)} trial`;
    }
    if (status.needsCheckout) return "Subscribe";
    if (status.remainingCents != null) {
      return `${formatCents(status.remainingCents)} left`;
    }
    return `${formatCents(status.spentCents)} of ${formatCents(status.usageCapCents)}`;
  })();

  if (!matches("Billing", detail)) return null;

  return (
    <SettingsRow
      icon={<Icon as={WalletIcon} className="size-5 text-foreground" />}
      label="Billing"
      detail={detail}
      onPress={() => router.push("/settings/billing")}
    />
  );
}
