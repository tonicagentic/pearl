import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import { Stack, router, useFocusEffect } from "expo-router";

import { AnswersScreen } from "@/components/settings/answers-screen";
import { ResearchScreen } from "@/components/settings/research-screen";
import { CoderToolsList } from "@/components/settings/code-section";
import { SettingsButton } from "@/components/settings/native";
import { PluginLogo } from "@/components/settings/plugin-logo";
import { SheetScaffold } from "@/components/settings/sheet-scaffold";
import { SettingsCard } from "@/components/ui/settings-card";
import { Text, textVariants } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import {
  capabilitiesForConnection,
  capabilitiesForPlugin,
  type PluginCapabilities,
} from "../../../lib/plugins/capabilities";
import {
  isConnectablePlugin,
  isCredentialPlugin,
  type ResolvedPlugin,
} from "../../../lib/plugins/catalog";
import {
  fetchExpoProjectsCatalog,
  fetchGithubReposCatalog,
  fetchVercelProjectsCatalog,
  fetchVercelResourcesCatalog,
  type CatalogExpoAccount,
  type CatalogExpoProject,
  type CatalogRepo,
  type CatalogVercelDomain,
  type CatalogVercelIntegration,
  type CatalogVercelProject,
  type CatalogVercelStore,
  type CatalogVercelTeam,
  type ExpoProjectsCatalog,
  type GithubReposCatalog,
  type VercelProjectsCatalog,
  type VercelResourcesCatalog,
} from "@/src/catalog-client";
import {
  authorizeConnection,
  getConnectionGrants,
  getConnections,
  revokeConnection,
  type ConnectionGrantSummary,
  type ConnectionId,
  type ConnectionStatus,
} from "@/src/connections-client";
import {
  listMailboxes,
  type MailboxClientSummary,
} from "@/src/mailboxes-client";
import {
  fetchSandboxSettings,
  type SandboxSettings,
} from "@/src/sandbox-settings-client";

const FILTER_THRESHOLD = 12;

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

/** Plugin detail: capability copy plus connection actions when applicable. */
export function PluginDetailScreen({
  plugin,
}: {
  readonly plugin: ResolvedPlugin;
}) {
  if (plugin.id === "search") {
    return <AnswersScreen />;
  }
  if (plugin.id === "researcher") {
    return <ResearchScreen />;
  }

  const builtinCapabilities =
    plugin.kind === "builtin" ? capabilitiesForPlugin(plugin.id) : null;

  return (
    <>
      <Stack.Screen options={{ title: plugin.label }} />
      <SheetScaffold>
        <View className="flex-row items-start gap-4 px-1">
          <PluginLogo id={plugin.id} size={56} />
          <View className="min-w-0 flex-1 gap-1">
            <Text variant="title">
              {plugin.label}
            </Text>
            <Text variant="body" tone="muted">
              {plugin.detail}
            </Text>
          </View>
        </View>

        <Text variant="body" className="px-1">
          {plugin.description}
        </Text>

        {(isConnectablePlugin(plugin) && plugin.connectionId === "calendar") ||
        (isCredentialPlugin(plugin) && plugin.id === "icloud-calendar") ? (
          <CalendarManagePanel />
        ) : isConnectablePlugin(plugin) ? (
          plugin.connectionId === "gmail" ? (
            <GmailMailboxSummaryPanel />
          ) : (
            <ConnectionPanel
              connectionId={plugin.connectionId}
              pluginLabel={plugin.label}
            />
          )
        ) : plugin.kind === "builtin" ? (
          <>
            <StatusCard
              title="Enabled"
              body="This capability ships with Pearl and does not need a separate account connection."
            />
            {builtinCapabilities ? (
              <CapabilitiesCard
                capabilities={builtinCapabilities}
                heading="What Pearl can do"
              />
            ) : null}
            {plugin.id === "coder" ? (
              <>
                <CoderSandbox />
                <CoderTools />
              </>
            ) : null}
          </>
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

function CalendarManagePanel() {
  const googleCapabilities = capabilitiesForConnection("calendar");
  const icloudCapabilities = capabilitiesForPlugin("icloud-calendar");

  return (
    <View className="gap-4">
      <View className="gap-3 rounded-[18px] bg-card px-4 py-4">
        <Text variant="label">
          Calendar accounts
        </Text>
        <Text variant="secondary">
          Manage Google Calendar and iCloud Calendar from one place.
        </Text>
        <SettingsButton
          hosted
          label="Manage Calendar"
          onPress={() => router.push("/calendar")}
        />
      </View>
      {googleCapabilities ? (
        <CapabilitiesCard
          capabilities={googleCapabilities}
          heading="Google Calendar"
        />
      ) : null}
      {icloudCapabilities ? (
        <CapabilitiesCard
          capabilities={icloudCapabilities}
          heading="iCloud Calendar"
        />
      ) : null}
    </View>
  );
}

function GmailMailboxSummaryPanel() {
  const [mailboxes, setMailboxes] = useState<
    readonly MailboxClientSummary[] | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const capabilities = capabilitiesForConnection("gmail");
  const connectedCount =
    mailboxes?.filter((item) => item.status === "connected").length ?? 0;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void listMailboxes()
        .then((next) => {
          if (!cancelled) {
            setMailboxes(next);
            setError(null);
          }
        })
        .catch((cause) => {
          if (!cancelled) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Could not load mailboxes.",
            );
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <View className="gap-4">
      <View className="gap-3 rounded-[18px] bg-card px-4 py-4">
        <Text variant="label">
          Gmail accounts
        </Text>
        <Text variant="secondary">
          {loading && mailboxes == null
            ? "Loading…"
            : connectedCount === 0
              ? "None connected"
              : `${connectedCount} connected`}
        </Text>
        {mailboxes?.map((mailbox) => (
          <Text key={mailbox.id} variant="body" numberOfLines={1}>
            {mailbox.nickname?.trim()
              ? `${mailbox.nickname.trim()} · ${mailbox.emailLabel ?? "Gmail"}`
              : (mailbox.emailLabel ?? "Gmail account")}
            {mailbox.status === "connected" && !mailbox.canModify
              ? " · needs reconnect"
              : ""}
          </Text>
        ))}
        {error ? (
          <Text variant="secondary" tone="destructive" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <SettingsButton
          hosted
          label="Manage Email"
          onPress={() => router.push("/email")}
        />
      </View>
      {capabilities ? (
        <CapabilitiesCard
          capabilities={capabilities}
          heading={
            connectedCount > 0
              ? "What Pearl can do"
              : "What Pearl can do after you connect"
          }
        />
      ) : null}
    </View>
  );
}

function CoderSandbox() {
  const [settings, setSettings] = useState<SandboxSettings | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void fetchSandboxSettings()
        .then((next) => {
          if (!cancelled) setSettings(next);
        })
        .catch(() => {
          if (!cancelled) setSettings(null);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const lifetime = settings ? `${settings.coderTimeoutMinutes} min` : "…";
  const compute = settings
    ? `${settings.coderVcpus} vCPU${settings.coderVcpus === 1 ? "" : "s"}`
    : "…";

  return (
    <View className="gap-1.5">
      <Text variant="secondary" weight="medium" className="px-1">
        Sandboxes
      </Text>
      <Text variant="secondary" className="px-1">
        Coder checks out the repo in a Vercel Sandbox, runs the project there,
        and publishes a preview URL. The machine has Node, git, and pnpm. It
        does not include Chrome, Xcode, or Docker. It stops when its lifetime
        ends.
      </Text>
      <SettingsCard>
        <SandboxFact label="Lifetime" value={lifetime} showSeparator />
        <SandboxFact label="Compute" value={compute} showSeparator />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change sandbox settings in Computer Use"
          className="active:bg-muted/80"
          onPress={() => router.push("/computer-use")}
        >
          <View className="min-h-[52px] flex-row items-center gap-3 px-4 py-3">
            <Text variant="label" className="min-w-0 flex-1">
              Computer Use
            </Text>
            <Text variant="body" tone="muted">
              Change
            </Text>
            <Text
              variant="title"
              tone="muted"
              weight="light"
              className="opacity-40"
            >
              ›
            </Text>
          </View>
        </Pressable>
      </SettingsCard>
    </View>
  );
}

function SandboxFact({
  label,
  value,
  showSeparator,
}: {
  readonly label: string;
  readonly value: string;
  readonly showSeparator?: boolean;
}) {
  return (
    <View>
      <View className="min-h-[52px] flex-row items-center justify-between gap-3 px-4 py-3">
        <Text variant="label">{label}</Text>
        <Text variant="body" tone="muted">
          {value}
        </Text>
      </View>
      {showSeparator ? <View className="ml-4 h-px bg-border" /> : null}
    </View>
  );
}

function CoderTools() {
  const [connections, setConnections] = useState<
    readonly ConnectionStatus[] | null
  >(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getConnections()
        .then((next) => {
          if (!cancelled) setConnections(next);
        })
        .catch(() => {
          if (!cancelled) setConnections(null);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <View className="gap-1.5">
      <Text variant="secondary" weight="medium" className="px-1">
        Accounts and tools
      </Text>
      <Text variant="secondary" className="px-1">
        GitHub, Vercel, and the other connections Coder uses.
      </Text>
      <SettingsCard>
        <CoderToolsList connections={connections} />
      </SettingsCard>
    </View>
  );
}

function CapabilitiesCard({
  capabilities,
  heading,
}: {
  readonly capabilities: PluginCapabilities;
  readonly heading: string;
}) {
  return (
    <View className="gap-3 rounded-[18px] bg-card px-4 py-4">
      <Text variant="label">{heading}</Text>
      <BulletList items={capabilities.canDo} />
      {capabilities.needsApproval.length > 0 ? (
        <View className="gap-2 pt-1">
          <Text variant="body" weight="medium">
            Needs your approval
          </Text>
          <BulletList items={capabilities.needsApproval} />
        </View>
      ) : null}
    </View>
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
      <Text variant="label">{title}</Text>
      <Text variant="secondary">
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
  const [grant, setGrant] = useState<ConnectionGrantSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const waitingForReturn = useRef(false);
  const busy = loading || connecting || disconnecting;
  const capabilities = capabilitiesForConnection(connectionId);
  const connected = grant?.status === "connected";
  const state = grant?.status;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await getConnectionGrants();
      const item = items.find((entry) => entry.id === connectionId) ?? null;
      if (mounted.current) {
        setGrant(item);
        if (item?.status === "connected") setUserCode(null);
      }
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error ? cause.message : "Could not load grant.",
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

  const authorize = async () => {
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
      await revokeConnection(connectionId);
      await load();
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

  return (
    <View className="gap-4">
      <View className="gap-3 rounded-[18px] bg-card px-4 py-4">
        <Text variant="label">Grant</Text>
        {loading && !grant ? (
          <ActivityIndicator accessibilityLabel="Loading grant" />
        ) : null}
        {grant ? (
          <View className="gap-2">
            <DetailRow label="Status" value={STATUS_LABEL[grant.status]} />
            <DetailRow
              label="Account"
              value={
                connected
                  ? (grant.accountLabel ??
                    grant.github?.login ??
                    grant.vercel?.username ??
                    `Your ${pluginLabel} account`)
                  : state === "unavailable"
                    ? "Not available on this deployment"
                    : "None connected"
              }
            />
            {grant.detail ? (
              <Text variant="secondary">
                {grant.detail}
              </Text>
            ) : null}
            {grant.missingScopes && grant.missingScopes.length > 0 ? (
              <Text variant="secondary" className="text-amber-600">
                Missing: {grant.missingScopes.join(", ")}
              </Text>
            ) : null}
            {grant.github ? (
              <Text variant="secondary">
                GitHub @{grant.github.login}
                {grant.github.hasRepoScope ? " · repo ok" : " · needs repo"}
                {grant.github.repos.some((repo) => !repo.canPush)
                  ? " · some pinned repos blocked"
                  : ""}
              </Text>
            ) : null}
            {grant.vercel ? (
              <Text variant="secondary">
                Vercel {grant.vercel.username}
                {grant.vercel.teams.length > 0
                  ? ` · ${grant.vercel.teams.length} teams`
                  : " · personal"}
              </Text>
            ) : null}
            {grant.github?.manageUrl ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => void Linking.openURL(grant.github!.manageUrl)}
              >
                <Text variant="secondary" tone="default" className="underline">
                  Authorized OAuth Apps
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {userCode ? (
          <View className="gap-1">
            <Text variant="label" weight="semibold" selectable>
              Code: {userCode}
            </Text>
            <Text variant="secondary">
              Enter this code on the authorization page if prompted.
            </Text>
          </View>
        ) : null}

        {error ? (
          <Text variant="secondary" tone="destructive" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <View className="gap-2 pt-1">
          {connected ? (
            <SettingsButton
              hosted
              disabled={busy}
              label={connecting ? "Opening…" : "Update"}
              onPress={() => void authorize()}
            />
          ) : null}
          {state !== "connected" && state !== "unavailable" ? (
            <SettingsButton
              hosted
              disabled={busy}
              label={connecting ? "Opening…" : "Connect"}
              onPress={() => void authorize()}
            />
          ) : null}
          {state === "connected" || state === "unknown" ? (
            <SettingsButton
              hosted
              destructive
              disabled={busy}
              label={disconnecting ? "Disconnecting…" : "Disconnect"}
              onPress={() => void disconnect()}
            />
          ) : null}
          <SettingsButton
            hosted
            disabled={busy || state === "unavailable"}
            label={loading ? "Checking…" : "Refresh"}
            onPress={() => void load()}
            variant="plain"
          />
        </View>

        <Text variant="caption">
          Authorization is stored by Vercel Connect for your signed-in account.
          Update reopens consent without disconnecting first. Pearl never stores
          provider tokens in this app.
        </Text>
      </View>

      {grant?.github ? <GithubAccessSections github={grant.github} /> : null}
      {grant?.vercel && connected ? (
        <>
          <VercelProjectsSection username={grant.vercel.username} />
          <VercelResourcesSections username={grant.vercel.username} />
        </>
      ) : null}
      {connectionId === "expo" && connected ? <ExpoProjectsSection /> : null}

      {capabilities ? (
        <CapabilitiesCard
          capabilities={capabilities}
          heading={
            connected
              ? "What Pearl can do"
              : "What Pearl can do after you connect"
          }
        />
      ) : null}
    </View>
  );
}

function CatalogFilter({
  value,
  onChange,
  placeholder,
}: {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly placeholder: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      autoCapitalize="none"
      autoCorrect={false}
      clearButtonMode="while-editing"
      className={cn(
        textVariants({ variant: "body" }),
        "min-h-10 rounded-xl border border-border/60 bg-background px-3",
      )}
    />
  );
}

function GithubAccessSections({
  github,
}: {
  readonly github: NonNullable<ConnectionGrantSummary["github"]>;
}) {
  return (
    <View className="gap-4">
      <View className="gap-3 rounded-[18px] bg-card px-4 py-4">
        <Text variant="label">
          Organizations
        </Text>
        {github.orgs.length > 0 ? (
          <View className="gap-2">
            {github.orgs.map((org) => (
              <Text key={org} variant="body" numberOfLines={1}>
                {org}
              </Text>
            ))}
          </View>
        ) : (
          <Text variant="secondary">
            No organizations visible to this grant. Approve org access on
            GitHub if you need them.
          </Text>
        )}
      </View>

      <GithubReposCatalogSection />

      {github.repos.length > 0 ? (
        <View className="gap-3 rounded-[18px] bg-card px-4 py-4">
          <Text variant="label">
            Workbench pins
          </Text>
          <View className="gap-2">
            {github.repos.map((repo) => (
              <Text key={repo.fullName} variant="secondary">
                <Text variant="secondary" tone="default">
                  {repo.fullName}
                </Text>
                {repo.canPush
                  ? " · can push"
                  : ` · blocked${repo.blockedReason ? `: ${repo.blockedReason}` : ""}`}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function GithubReposCatalogSection() {
  const [catalog, setCatalog] = useState<GithubReposCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchGithubReposCatalog();
      if (mounted.current) setCatalog(next);
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load repositories.",
        );
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const repos: readonly CatalogRepo[] =
    catalog?.connected === true ? catalog.repos : [];
  const needle = filter.trim().toLowerCase();
  const visible =
    needle.length === 0
      ? repos
      : repos.filter(
          (repo) =>
            repo.fullName.toLowerCase().includes(needle) ||
            (repo.description?.toLowerCase().includes(needle) ?? false),
        );
  const showFilter = repos.length >= FILTER_THRESHOLD;

  return (
    <View className="gap-3 rounded-[18px] bg-card px-4 py-4">
      <Text variant="label">
        Repositories
        {catalog?.connected === true && repos.length > 0
          ? ` · ${repos.length}`
          : ""}
      </Text>
      <Text variant="secondary">
        Every repo this connection can see, most recently pushed first.
      </Text>

      {showFilter ? (
        <CatalogFilter
          value={filter}
          onChange={setFilter}
          placeholder="Filter repositories"
        />
      ) : null}

      {loading && !catalog ? (
        <ActivityIndicator accessibilityLabel="Loading repositories" />
      ) : null}

      {error ? (
        <View className="gap-2">
          <Text variant="secondary" tone="destructive" accessibilityRole="alert">
            {error}
          </Text>
          <SettingsButton hosted label="Retry" onPress={() => void load()} />
        </View>
      ) : null}

      {catalog?.connected === false ? (
        <Text variant="secondary">
          {catalog.message}
        </Text>
      ) : null}

      {catalog?.connected === true ? (
        visible.length > 0 ? (
          <View className="gap-3">
            {visible.map((repo) => (
              <Pressable
                key={repo.fullName}
                accessibilityRole="link"
                onPress={() => void Linking.openURL(repo.htmlUrl)}
                className="gap-1"
              >
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text variant="body" weight="medium" className="min-w-0 flex-1" numberOfLines={1}>
                    {repo.fullName}
                  </Text>
                  <Text variant="caption">
                    {repo.private ? "Private" : "Public"}
                  </Text>
                </View>
                {repo.description ? (
                  <Text variant="secondary" numberOfLines={2}>
                    {repo.description}
                  </Text>
                ) : null}
              </Pressable>
            ))}
            {catalog.truncated ? (
              <Text variant="caption">
                Showing the first {repos.length} repositories. Refine access on
                GitHub if you expected more.
              </Text>
            ) : null}
          </View>
        ) : (
          <Text variant="secondary">
            {needle
              ? "No repositories match that filter."
              : "No repositories visible yet. Reconnect GitHub if this looks wrong."}
          </Text>
        )
      ) : null}
    </View>
  );
}

function ExpoProjectsSection() {
  const [catalog, setCatalog] = useState<ExpoProjectsCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchExpoProjectsCatalog();
      if (mounted.current) setCatalog(next);
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error ? cause.message : "Could not load projects.",
        );
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const projects: readonly CatalogExpoProject[] =
    catalog?.connected === true ? catalog.projects : [];
  const accounts: readonly CatalogExpoAccount[] =
    catalog?.connected === true ? catalog.accounts : [];
  const username =
    catalog?.connected === true ? catalog.username : "Expo";
  const needle = filter.trim().toLowerCase();
  const matches = (project: CatalogExpoProject) =>
    needle.length === 0 ||
    project.name.toLowerCase().includes(needle) ||
    project.slug.toLowerCase().includes(needle) ||
    project.fullName.toLowerCase().includes(needle) ||
    project.accountName.toLowerCase().includes(needle);
  const showFilter = projects.length >= FILTER_THRESHOLD;

  const accountSections = accounts
    .map((account) => ({
      account,
      projects: projects.filter(
        (project) => project.accountId === account.id && matches(project),
      ),
    }))
    .filter((section) => needle.length === 0 || section.projects.length > 0);

  return (
    <View className="gap-3 rounded-[18px] bg-card px-4 py-4">
      <Text variant="label">
        Projects
        {catalog?.connected === true && projects.length > 0
          ? ` · ${projects.length}`
          : ""}
      </Text>
      <Text variant="secondary">
        Personal account and each organization, with every project Pearl can
        see.
      </Text>

      {showFilter ? (
        <CatalogFilter
          value={filter}
          onChange={setFilter}
          placeholder="Filter projects"
        />
      ) : null}

      {loading && !catalog ? (
        <ActivityIndicator accessibilityLabel="Loading Expo projects" />
      ) : null}

      {error ? (
        <View className="gap-2">
          <Text variant="secondary" tone="destructive" accessibilityRole="alert">
            {error}
          </Text>
          <SettingsButton hosted label="Retry" onPress={() => void load()} />
        </View>
      ) : null}

      {catalog?.connected === false ? (
        <Text variant="secondary">{catalog.message}</Text>
      ) : null}

      {catalog?.connected === true ? (
        <View className="gap-4">
          {accountSections.map(({ account, projects: accountProjects }) => (
            <ExpoAccountProjects
              key={account.id}
              title={
                account.isPersonal
                  ? `Personal · ${username}`
                  : `${account.name}`
              }
              projects={accountProjects}
              emptyLabel={
                needle
                  ? "No projects match that filter."
                  : "No projects on this account."
              }
            />
          ))}
          {catalog.truncated ? (
            <Text variant="caption">
              Showing the first {projects.length} projects. Open the Expo
              dashboard if you expected more.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function ExpoAccountProjects({
  title,
  projects,
  emptyLabel,
}: {
  readonly title: string;
  readonly projects: readonly CatalogExpoProject[];
  readonly emptyLabel: string;
}) {
  return (
    <View className="gap-2">
      <Text
        variant="caption"
        weight="medium"
        className="uppercase tracking-[0.04em]"
      >
        {title}
      </Text>
      {projects.length > 0 ? (
        <View className="gap-3">
          {projects.map((project) => (
            <Pressable
              key={project.id}
              accessibilityRole="link"
              onPress={() => void Linking.openURL(project.dashboardUrl)}
              className="gap-0.5"
            >
              <Text variant="body" weight="medium" numberOfLines={1}>
                {project.name}
              </Text>
              <Text variant="caption">
                {project.fullName}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text variant="secondary">{emptyLabel}</Text>
      )}
    </View>
  );
}

function VercelProjectsSection({
  username,
}: {
  readonly username: string;
}) {
  const [catalog, setCatalog] = useState<VercelProjectsCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchVercelProjectsCatalog();
      if (mounted.current) setCatalog(next);
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error ? cause.message : "Could not load projects.",
        );
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const projects: readonly CatalogVercelProject[] =
    catalog?.connected === true ? catalog.projects : [];
  const teams: readonly CatalogVercelTeam[] =
    catalog?.connected === true ? catalog.teams : [];
  const displayUsername =
    catalog?.connected === true ? catalog.username : username;
  const needle = filter.trim().toLowerCase();
  const matches = (project: CatalogVercelProject) =>
    needle.length === 0 ||
    project.name.toLowerCase().includes(needle) ||
    (project.framework?.toLowerCase().includes(needle) ?? false) ||
    (project.teamName?.toLowerCase().includes(needle) ?? false) ||
    (project.teamSlug?.toLowerCase().includes(needle) ?? false);
  const showFilter = projects.length >= FILTER_THRESHOLD;

  const personalProjects = projects.filter(
    (project) => project.teamId == null && matches(project),
  );
  const teamSections = teams
    .map((team) => ({
      team,
      projects: projects.filter(
        (project) => project.teamId === team.id && matches(project),
      ),
    }))
    .filter((section) => needle.length === 0 || section.projects.length > 0);

  return (
    <View className="gap-3 rounded-[18px] bg-card px-4 py-4">
      <Text variant="label">
        Projects
        {catalog?.connected === true && projects.length > 0
          ? ` · ${projects.length}`
          : ""}
      </Text>
      <Text variant="secondary">
        Every project on your personal account and each team, newest updates
        first.
      </Text>

      {showFilter ? (
        <CatalogFilter
          value={filter}
          onChange={setFilter}
          placeholder="Filter projects"
        />
      ) : null}

      {loading && !catalog ? (
        <ActivityIndicator accessibilityLabel="Loading projects" />
      ) : null}

      {error ? (
        <View className="gap-2">
          <Text variant="secondary" tone="destructive" accessibilityRole="alert">
            {error}
          </Text>
          <SettingsButton hosted label="Retry" onPress={() => void load()} />
        </View>
      ) : null}

      {catalog?.connected === false ? (
        <Text variant="secondary">
          {catalog.message}
        </Text>
      ) : null}

      {catalog?.connected === true ? (
        <View className="gap-4">
          <VercelAccountProjects
            title={`Personal · ${displayUsername}`}
            projects={personalProjects}
            emptyLabel={
              needle
                ? "No personal projects match that filter."
                : "No projects on the personal account."
            }
          />
          {teamSections.map(({ team, projects: teamProjects }) => (
            <VercelAccountProjects
              key={team.id}
              title={`${team.name} · ${team.slug}`}
              projects={teamProjects}
              emptyLabel="No projects on this team."
            />
          ))}
          {catalog.skippedTeams.length > 0 ? (
            <Text variant="caption">
              Skipped {catalog.skippedTeams.map((team) => team.slug).join(", ")}{" "}
              (no access).
            </Text>
          ) : null}
          {catalog.truncated ? (
            <Text variant="caption">
              Showing the first {projects.length} projects. Open the Vercel
              dashboard if you expected more.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function VercelAccountProjects({
  title,
  projects,
  emptyLabel,
}: {
  readonly title: string;
  readonly projects: readonly CatalogVercelProject[];
  readonly emptyLabel: string;
}) {
  return (
    <View className="gap-2">
      <Text variant="caption" weight="medium" className="uppercase tracking-[0.04em]">
        {title}
      </Text>
      {projects.length > 0 ? (
        <View className="gap-3">
          {projects.map((project) => (
            <Pressable
              key={project.id}
              accessibilityRole="link"
              onPress={() => void Linking.openURL(project.dashboardUrl)}
              className="gap-0.5"
            >
              <Text variant="body" weight="medium" numberOfLines={1}>
                {project.name}
              </Text>
              <Text variant="caption">
                {[project.framework, project.updatedAt
                  ? `Updated ${new Date(project.updatedAt).toLocaleDateString()}`
                  : null]
                  .filter(Boolean)
                  .join(" · ") || "Open in Vercel"}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text variant="secondary">
          {emptyLabel}
        </Text>
      )}
    </View>
  );
}

const STORE_KIND_LABEL: Record<CatalogVercelStore["kind"], string> = {
  blob: "Blob",
  postgres: "Postgres",
  "edge-config": "Edge Config",
  kv: "KV",
  other: "Store",
};

function VercelResourcesSections({
  username,
}: {
  readonly username: string;
}) {
  const [catalog, setCatalog] = useState<VercelResourcesCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState("");
  const [integrationFilter, setIntegrationFilter] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchVercelResourcesCatalog();
      if (mounted.current) setCatalog(next);
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error ? cause.message : "Could not load resources.",
        );
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const domains: readonly CatalogVercelDomain[] =
    catalog?.connected === true ? catalog.domains : [];
  const integrations: readonly CatalogVercelIntegration[] =
    catalog?.connected === true ? catalog.integrations : [];
  const stores: readonly CatalogVercelStore[] =
    catalog?.connected === true ? catalog.stores : [];
  const teams: readonly CatalogVercelTeam[] =
    catalog?.connected === true ? catalog.teams : [];
  const displayUsername =
    catalog?.connected === true ? catalog.username : username;

  const filterDomains = (needle: string) => {
    const q = needle.trim().toLowerCase();
    if (!q) return domains;
    return domains.filter(
      (domain) =>
        domain.name.toLowerCase().includes(q) ||
        (domain.teamName?.toLowerCase().includes(q) ?? false) ||
        (domain.teamSlug?.toLowerCase().includes(q) ?? false),
    );
  };
  const filterIntegrations = (needle: string) => {
    const q = needle.trim().toLowerCase();
    if (!q) return integrations;
    return integrations.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.slug.toLowerCase().includes(q) ||
        (item.teamName?.toLowerCase().includes(q) ?? false),
    );
  };
  const filterStores = (needle: string) => {
    const q = needle.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter(
      (store) =>
        store.name.toLowerCase().includes(q) ||
        STORE_KIND_LABEL[store.kind].toLowerCase().includes(q) ||
        (store.teamName?.toLowerCase().includes(q) ?? false),
    );
  };

  const visibleDomains = filterDomains(domainFilter);
  const visibleIntegrations = filterIntegrations(integrationFilter);
  const visibleStores = filterStores(storeFilter);

  const groupByAccount = <T extends { readonly teamId: string | null }>(
    items: readonly T[],
  ) => {
    const personal = items.filter((item) => item.teamId == null);
    const teamGroups = teams.map((team) => ({
      team,
      items: items.filter((item) => item.teamId === team.id),
    }));
    return { personal, teamGroups };
  };

  return (
    <View className="gap-4">
      {loading && !catalog ? (
        <View className="gap-3 rounded-[18px] bg-card px-4 py-4">
          <ActivityIndicator accessibilityLabel="Loading Vercel resources" />
        </View>
      ) : null}

      {error ? (
        <View className="gap-2 rounded-[18px] bg-card px-4 py-4">
          <Text variant="secondary" tone="destructive" accessibilityRole="alert">
            {error}
          </Text>
          <SettingsButton hosted label="Retry" onPress={() => void load()} />
        </View>
      ) : null}

      {catalog?.connected === false ? (
        <View className="gap-2 rounded-[18px] bg-card px-4 py-4">
          <Text variant="secondary">
            {catalog.message}
          </Text>
        </View>
      ) : null}

      {catalog?.connected === true ? (
        <>
          <VercelResourceCard
            title="Domains"
            count={domains.length}
            description="Registered domains on your personal account and each team."
            filter={domainFilter}
            onFilterChange={setDomainFilter}
            showFilter={domains.length >= FILTER_THRESHOLD}
            filterPlaceholder="Filter domains"
            truncated={catalog.truncated.domains}
            truncatedLabel={`Showing the first ${domains.length} domains.`}
            skippedTeams={catalog.skippedTeams}
          >
            {(() => {
              const { personal, teamGroups } = groupByAccount(visibleDomains);
              const needle = domainFilter.trim();
              return (
                <View className="gap-4">
                  <VercelAccountResourceList
                    title={`Personal · ${displayUsername}`}
                    emptyLabel={
                      needle
                        ? "No personal domains match that filter."
                        : "No domains on the personal account."
                    }
                    items={personal.map((domain) => ({
                      key: `${domain.teamId ?? "personal"}:${domain.name}`,
                      title: domain.name,
                      subtitle: [
                        domain.verified ? "Verified" : "Unverified",
                        domain.serviceType,
                      ]
                        .filter(Boolean)
                        .join(" · "),
                      url: domain.dashboardUrl,
                    }))}
                  />
                  {teamGroups
                    .filter(
                      (group) => needle.length === 0 || group.items.length > 0,
                    )
                    .map(({ team, items }) => (
                      <VercelAccountResourceList
                        key={team.id}
                        title={`${team.name} · ${team.slug}`}
                        emptyLabel="No domains on this team."
                        items={items.map((domain) => ({
                          key: `${domain.teamId}:${domain.name}`,
                          title: domain.name,
                          subtitle: [
                            domain.verified ? "Verified" : "Unverified",
                            domain.serviceType,
                          ]
                            .filter(Boolean)
                            .join(" · "),
                          url: domain.dashboardUrl,
                        }))}
                      />
                    ))}
                </View>
              );
            })()}
          </VercelResourceCard>

          <VercelResourceCard
            title="Integrations"
            count={integrations.length}
            description="Installed integrations across personal and team accounts."
            filter={integrationFilter}
            onFilterChange={setIntegrationFilter}
            showFilter={integrations.length >= FILTER_THRESHOLD}
            filterPlaceholder="Filter integrations"
            truncated={catalog.truncated.integrations}
            truncatedLabel={`Showing the first ${integrations.length} integrations.`}
            skippedTeams={catalog.skippedTeams}
          >
            {(() => {
              const { personal, teamGroups } =
                groupByAccount(visibleIntegrations);
              const needle = integrationFilter.trim();
              return (
                <View className="gap-4">
                  <VercelAccountResourceList
                    title={`Personal · ${displayUsername}`}
                    emptyLabel={
                      needle
                        ? "No personal integrations match that filter."
                        : "No integrations on the personal account."
                    }
                    items={personal.map((item) => ({
                      key: item.id,
                      title: item.name,
                      subtitle: [
                        item.slug,
                        item.status,
                        item.projectCount != null
                          ? `${item.projectCount} projects`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · "),
                      url: item.dashboardUrl,
                    }))}
                  />
                  {teamGroups
                    .filter(
                      (group) => needle.length === 0 || group.items.length > 0,
                    )
                    .map(({ team, items }) => (
                      <VercelAccountResourceList
                        key={team.id}
                        title={`${team.name} · ${team.slug}`}
                        emptyLabel="No integrations on this team."
                        items={items.map((item) => ({
                          key: item.id,
                          title: item.name,
                          subtitle: [
                            item.slug,
                            item.status,
                            item.projectCount != null
                              ? `${item.projectCount} projects`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · "),
                          url: item.dashboardUrl,
                        }))}
                      />
                    ))}
                </View>
              );
            })()}
          </VercelResourceCard>

          <VercelResourceCard
            title="Storage"
            count={stores.length}
            description="Blob, Postgres, Edge Config, and other stores."
            filter={storeFilter}
            onFilterChange={setStoreFilter}
            showFilter={stores.length >= FILTER_THRESHOLD}
            filterPlaceholder="Filter stores"
            truncated={catalog.truncated.stores}
            truncatedLabel={`Showing the first ${stores.length} stores.`}
            skippedTeams={catalog.skippedTeams}
          >
            {(() => {
              const { personal, teamGroups } = groupByAccount(visibleStores);
              const needle = storeFilter.trim();
              return (
                <View className="gap-4">
                  <VercelAccountResourceList
                    title={`Personal · ${displayUsername}`}
                    emptyLabel={
                      needle
                        ? "No personal stores match that filter."
                        : "No storage on the personal account."
                    }
                    items={personal.map((store) => ({
                      key: store.id,
                      title: store.name,
                      subtitle: [
                        STORE_KIND_LABEL[store.kind],
                        store.region,
                        store.status,
                      ]
                        .filter(Boolean)
                        .join(" · "),
                      url: store.dashboardUrl,
                    }))}
                  />
                  {teamGroups
                    .filter(
                      (group) => needle.length === 0 || group.items.length > 0,
                    )
                    .map(({ team, items }) => (
                      <VercelAccountResourceList
                        key={team.id}
                        title={`${team.name} · ${team.slug}`}
                        emptyLabel="No storage on this team."
                        items={items.map((store) => ({
                          key: store.id,
                          title: store.name,
                          subtitle: [
                            STORE_KIND_LABEL[store.kind],
                            store.region,
                            store.status,
                          ]
                            .filter(Boolean)
                            .join(" · "),
                          url: store.dashboardUrl,
                        }))}
                      />
                    ))}
                </View>
              );
            })()}
          </VercelResourceCard>
        </>
      ) : null}
    </View>
  );
}

function VercelResourceCard({
  title,
  count,
  description,
  filter,
  onFilterChange,
  showFilter,
  filterPlaceholder,
  truncated,
  truncatedLabel,
  skippedTeams,
  children,
}: {
  readonly title: string;
  readonly count: number;
  readonly description: string;
  readonly filter: string;
  readonly onFilterChange: (next: string) => void;
  readonly showFilter: boolean;
  readonly filterPlaceholder: string;
  readonly truncated: boolean;
  readonly truncatedLabel: string;
  readonly skippedTeams: readonly {
    readonly id: string;
    readonly slug: string;
  }[];
  readonly children: ReactNode;
}) {
  return (
    <View className="gap-3 rounded-[18px] bg-card px-4 py-4">
      <Text variant="label">
        {title}
        {count > 0 ? ` · ${count}` : ""}
      </Text>
      <Text variant="secondary">
        {description}
      </Text>
      {showFilter ? (
        <CatalogFilter
          value={filter}
          onChange={onFilterChange}
          placeholder={filterPlaceholder}
        />
      ) : null}
      {children}
      {skippedTeams.length > 0 ? (
        <Text variant="caption">
          Skipped {skippedTeams.map((team) => team.slug).join(", ")} (no
          access).
        </Text>
      ) : null}
      {truncated ? (
        <Text variant="caption">
          {truncatedLabel}
        </Text>
      ) : null}
    </View>
  );
}

function VercelAccountResourceList({
  title,
  items,
  emptyLabel,
}: {
  readonly title: string;
  readonly items: readonly {
    readonly key: string;
    readonly title: string;
    readonly subtitle: string;
    readonly url: string;
  }[];
  readonly emptyLabel: string;
}) {
  return (
    <View className="gap-2">
      <Text variant="caption" weight="medium" className="uppercase tracking-[0.04em]">
        {title}
      </Text>
      {items.length > 0 ? (
        <View className="gap-3">
          {items.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="link"
              onPress={() => void Linking.openURL(item.url)}
              className="gap-0.5"
            >
              <Text variant="body" weight="medium" numberOfLines={1}>
                {item.title}
              </Text>
              {item.subtitle ? (
                <Text variant="caption">
                  {item.subtitle}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : (
        <Text variant="secondary">
          {emptyLabel}
        </Text>
      )}
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
      <Text variant="caption" weight="medium" className="uppercase tracking-[0.04em]">
        {label}
      </Text>
      <Text variant="body" selectable>
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
          <Text variant="secondary">•</Text>
          <Text variant="secondary" className="min-w-0 flex-1">
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

