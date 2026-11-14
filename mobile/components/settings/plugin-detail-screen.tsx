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
  Text,
  TextInput,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import { Stack, router, useFocusEffect } from "expo-router";

import { CoderToolsList } from "@/components/settings/code-section";
import { PluginLogo } from "@/components/settings/plugin-logo";
import { SheetScaffold } from "@/components/settings/sheet-scaffold";
import { SettingsCard } from "@/components/ui/settings-card";
import {
  capabilitiesForConnection,
  capabilitiesForPlugin,
  type PluginCapabilities,
} from "../../../lib/plugins/capabilities";
import {
  isConnectablePlugin,
  type ResolvedPlugin,
} from "../../../lib/plugins/catalog";
import {
  fetchGithubReposCatalog,
  fetchVercelProjectsCatalog,
  fetchVercelResourcesCatalog,
  type CatalogRepo,
  type CatalogVercelDomain,
  type CatalogVercelIntegration,
  type CatalogVercelProject,
  type CatalogVercelStore,
  type CatalogVercelTeam,
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
  const builtinCapabilities =
    plugin.kind === "builtin" ? capabilitiesForPlugin(plugin.id) : null;

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
            {plugin.id === "coder" ? <CoderTools /> : null}
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
        <Text className="text-[17px] font-medium text-foreground">
          Gmail accounts
        </Text>
        <Text className="text-[13px] leading-[18px] text-muted-foreground">
          {loading && mailboxes == null
            ? "Loading…"
            : connectedCount === 0
              ? "None connected"
              : `${connectedCount} connected`}
        </Text>
        {mailboxes?.map((mailbox) => (
          <Text
            key={mailbox.id}
            className="text-[15px] text-foreground"
            numberOfLines={1}
          >
            {mailbox.nickname?.trim()
              ? `${mailbox.nickname.trim()} · ${mailbox.emailLabel ?? "Gmail"}`
              : (mailbox.emailLabel ?? "Gmail account")}
            {mailbox.status === "connected" && !mailbox.canModify
              ? " · needs reconnect"
              : ""}
          </Text>
        ))}
        {error ? (
          <Text
            accessibilityRole="alert"
            className="text-[13px] text-destructive"
          >
            {error}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/email")}
          className="min-h-11 justify-center self-start rounded-[10px] bg-muted px-4"
        >
          <Text className="text-[15px] text-foreground">Manage Email</Text>
        </Pressable>
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
      <Text className="px-1 text-[13px] font-medium text-muted-foreground">
        Accounts and tools
      </Text>
      <Text className="px-1 text-[13px] leading-[18px] text-muted-foreground">
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
      <Text className="text-[17px] font-medium text-foreground">{heading}</Text>
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
        <Text className="text-[17px] font-medium text-foreground">Grant</Text>
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
                  : ""}
              </Text>
            ) : null}
            {grant.vercel ? (
              <Text className="text-[13px] leading-[18px] text-muted-foreground">
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
                <Text className="text-[13px] text-foreground underline">
                  Authorized OAuth Apps
                </Text>
              </Pressable>
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
          {connected ? (
            <ActionChip
              disabled={busy}
              label={connecting ? "Opening…" : "Update"}
              onPress={() => void authorize()}
            />
          ) : null}
          {state !== "connected" && state !== "unavailable" ? (
            <ActionChip
              disabled={busy}
              label={connecting ? "Opening…" : "Connect"}
              onPress={() => void authorize()}
            />
          ) : null}
          {state === "connected" || state === "unknown" ? (
            <ActionChip
              destructive
              disabled={busy}
              label={disconnecting ? "Disconnecting…" : "Disconnect"}
              onPress={() => void disconnect()}
            />
          ) : null}
          <ActionChip
            disabled={busy || state === "unavailable"}
            label={loading ? "Checking…" : "Refresh"}
            onPress={() => void load()}
          />
        </View>

        <Text className="text-[12px] leading-[16px] text-muted-foreground">
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
      className="min-h-10 rounded-xl border border-border/60 bg-background px-3 text-[15px] text-foreground"
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
        <Text className="text-[17px] font-medium text-foreground">
          Organizations
        </Text>
        {github.orgs.length > 0 ? (
          <View className="gap-2">
            {github.orgs.map((org) => (
              <Text
                key={org}
                className="text-[15px] text-foreground"
                numberOfLines={1}
              >
                {org}
              </Text>
            ))}
          </View>
        ) : (
          <Text className="text-[13px] leading-[18px] text-muted-foreground">
            No organizations visible to this grant. Approve org access on
            GitHub if you need them.
          </Text>
        )}
      </View>

      <GithubReposCatalogSection />

      {github.repos.length > 0 ? (
        <View className="gap-3 rounded-[18px] bg-card px-4 py-4">
          <Text className="text-[17px] font-medium text-foreground">
            Workbench pins
          </Text>
          <View className="gap-2">
            {github.repos.map((repo) => (
              <Text
                key={repo.fullName}
                className="text-[13px] leading-[18px] text-muted-foreground"
              >
                <Text className="text-foreground">{repo.fullName}</Text>
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
      <Text className="text-[17px] font-medium text-foreground">
        Repositories
        {catalog?.connected === true && repos.length > 0
          ? ` · ${repos.length}`
          : ""}
      </Text>
      <Text className="text-[13px] leading-[18px] text-muted-foreground">
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
          <Text
            accessibilityRole="alert"
            className="text-[13px] text-destructive"
          >
            {error}
          </Text>
          <ActionChip label="Retry" onPress={() => void load()} />
        </View>
      ) : null}

      {catalog?.connected === false ? (
        <Text className="text-[13px] leading-[18px] text-muted-foreground">
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
                  <Text
                    className="min-w-0 flex-1 text-[15px] font-medium text-foreground"
                    numberOfLines={1}
                  >
                    {repo.fullName}
                  </Text>
                  <Text className="text-[12px] text-muted-foreground">
                    {repo.private ? "Private" : "Public"}
                  </Text>
                </View>
                {repo.description ? (
                  <Text
                    className="text-[13px] leading-[18px] text-muted-foreground"
                    numberOfLines={2}
                  >
                    {repo.description}
                  </Text>
                ) : null}
              </Pressable>
            ))}
            {catalog.truncated ? (
              <Text className="text-[12px] leading-[16px] text-muted-foreground">
                Showing the first {repos.length} repositories. Refine access on
                GitHub if you expected more.
              </Text>
            ) : null}
          </View>
        ) : (
          <Text className="text-[13px] leading-[18px] text-muted-foreground">
            {needle
              ? "No repositories match that filter."
              : "No repositories visible yet. Reconnect GitHub if this looks wrong."}
          </Text>
        )
      ) : null}
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
      <Text className="text-[17px] font-medium text-foreground">
        Projects
        {catalog?.connected === true && projects.length > 0
          ? ` · ${projects.length}`
          : ""}
      </Text>
      <Text className="text-[13px] leading-[18px] text-muted-foreground">
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
          <Text
            accessibilityRole="alert"
            className="text-[13px] text-destructive"
          >
            {error}
          </Text>
          <ActionChip label="Retry" onPress={() => void load()} />
        </View>
      ) : null}

      {catalog?.connected === false ? (
        <Text className="text-[13px] leading-[18px] text-muted-foreground">
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
            <Text className="text-[12px] leading-[16px] text-muted-foreground">
              Skipped {catalog.skippedTeams.map((team) => team.slug).join(", ")}{" "}
              (no access).
            </Text>
          ) : null}
          {catalog.truncated ? (
            <Text className="text-[12px] leading-[16px] text-muted-foreground">
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
      <Text className="text-[12px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
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
              <Text
                className="text-[15px] font-medium text-foreground"
                numberOfLines={1}
              >
                {project.name}
              </Text>
              <Text className="text-[12px] text-muted-foreground">
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
        <Text className="text-[13px] leading-[18px] text-muted-foreground">
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
          <Text
            accessibilityRole="alert"
            className="text-[13px] text-destructive"
          >
            {error}
          </Text>
          <ActionChip label="Retry" onPress={() => void load()} />
        </View>
      ) : null}

      {catalog?.connected === false ? (
        <View className="gap-2 rounded-[18px] bg-card px-4 py-4">
          <Text className="text-[13px] leading-[18px] text-muted-foreground">
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
      <Text className="text-[17px] font-medium text-foreground">
        {title}
        {count > 0 ? ` · ${count}` : ""}
      </Text>
      <Text className="text-[13px] leading-[18px] text-muted-foreground">
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
        <Text className="text-[12px] leading-[16px] text-muted-foreground">
          Skipped {skippedTeams.map((team) => team.slug).join(", ")} (no
          access).
        </Text>
      ) : null}
      {truncated ? (
        <Text className="text-[12px] leading-[16px] text-muted-foreground">
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
      <Text className="text-[12px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
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
              <Text
                className="text-[15px] font-medium text-foreground"
                numberOfLines={1}
              >
                {item.title}
              </Text>
              {item.subtitle ? (
                <Text className="text-[12px] text-muted-foreground">
                  {item.subtitle}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : (
        <Text className="text-[13px] leading-[18px] text-muted-foreground">
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
