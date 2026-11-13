import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { openWebUrlExternally } from "@/src/open-web-url";
import {
  addPinDomain,
  fetchPinDatabase,
  fetchPinResources,
  fetchPinStatus,
  fetchPinUsage,
  queryPinDatabase,
  writePinEnv,
  type PinStatusDto,
  type WorkbenchPinDto,
} from "@/src/workbench-client";

type Tab = "overview" | "resources" | "database" | "usage";

export function WorkbenchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [pin, setPin] = useState<WorkbenchPinDto | null>(null);
  const [status, setStatus] = useState<PinStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await fetchPinStatus(id);
      setPin(data.pin);
      setStatus(data.status);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
        <View className="flex-1 pr-3">
          <Text className="text-xl font-semibold text-foreground">
            {pin?.fullName ?? "Repo"}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => void reload()}>
          <Text className="text-sm text-muted-foreground">Refresh</Text>
        </Pressable>
      </View>

      <View className="mb-2 flex-row gap-2 px-4">
        {(
          [
            ["overview", "Overview"],
            ["resources", "Resources"],
            ["database", "Database"],
            ["usage", "Usage"],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            className={`rounded-full px-3 py-1.5 ${
              tab === key ? "bg-primary" : "bg-muted"
            }`}
            onPress={() => setTab(key)}
          >
            <Text
              className={`text-xs font-medium ${
                tab === key ? "text-primary-foreground" : "text-foreground"
              }`}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <Text className="px-4 py-2 text-sm text-destructive">{error}</Text>
      ) : null}

      {loading && !pin ? (
        <View className="py-10">
          <ActivityIndicator />
        </View>
      ) : tab === "overview" ? (
        <OverviewTab
          status={status}
          onAskPearl={() => router.push("/chat")}
        />
      ) : tab === "resources" && id ? (
        <ResourcesTab pinId={id} />
      ) : tab === "database" && id ? (
        <DatabaseTab pinId={id} />
      ) : tab === "usage" && id ? (
        <UsageTab pinId={id} onOpenPearlBilling={() => router.push("/settings")} />
      ) : null}
    </SafeAreaView>
  );
}

function OverviewTab({
  status,
  onAskPearl,
}: {
  readonly status: PinStatusDto | null;
  readonly onAskPearl: () => void;
}) {
  if (!status) return null;
  if (!status.connected) {
    return (
      <View className="px-4 py-6">
        <Text className="text-base font-medium text-foreground">
          GitHub not connected
        </Text>
        <Text className="mt-1.5 text-sm text-muted-foreground">
          {status.message}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 px-4">
      <Pressable
        accessibilityRole="button"
        className="mb-3 rounded-xl border border-border bg-card px-3 py-3"
        onPress={onAskPearl}
      >
        <Text className="text-sm font-medium text-foreground">
          Ask Pearl to change this repo
        </Text>
        <Text className="mt-1 text-xs text-muted-foreground">
          Edits, PRs, deploys, and EAS updates go through chat with approval cards.
        </Text>
      </Pressable>

      <Text className="mb-2 text-sm font-semibold text-foreground">
        Pull requests
      </Text>
      {status.githubError ? (
        <Text className="mb-2 text-xs text-destructive">{status.githubError}</Text>
      ) : null}
      {status.pullRequests.length === 0 ? (
        <Text className="mb-4 text-sm text-muted-foreground">No open PRs</Text>
      ) : (
        status.pullRequests.map((pr) => (
          <Pressable
            key={pr.number}
            className="mb-2 rounded-xl border border-border bg-card px-3 py-3"
            onPress={() => void openWebUrlExternally(pr.htmlUrl)}
          >
            <Text className="text-sm font-medium text-foreground">
              #{pr.number} {pr.title}
            </Text>
            <Text className="mt-1 text-xs text-muted-foreground">
              {pr.draft ? "Draft · " : ""}
              {pr.headRef} → {pr.baseRef}
            </Text>
          </Pressable>
        ))
      )}

      <Text className="mb-2 mt-2 text-sm font-semibold text-foreground">
        Deployments
      </Text>
      {status.vercelError ? (
        <Text className="mb-2 text-xs text-destructive">{status.vercelError}</Text>
      ) : null}
      {status.deployments.length === 0 ? (
        <Text className="mb-8 text-sm text-muted-foreground">
          No deployments (link a Vercel project id on the pin)
        </Text>
      ) : (
        status.deployments.map((d) => (
          <Pressable
            key={d.uid}
            className="mb-2 rounded-xl border border-border bg-card px-3 py-3"
            onPress={() => void openWebUrlExternally(d.url)}
          >
            <Text className="text-sm font-medium text-foreground">
              {d.target ?? "deploy"} · {d.state}
            </Text>
            <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={1}>
              {d.url}
            </Text>
          </Pressable>
        ))
      )}
      <View className="h-10" />
    </ScrollView>
  );
}

function ResourcesTab({ pinId }: { readonly pinId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domains, setDomains] = useState<
    readonly { name: string; verified: boolean; configured: boolean }[]
  >([]);
  const [envNames, setEnvNames] = useState<
    readonly { id: string; key: string; target: readonly string[] }[]
  >([]);
  const [storage, setStorage] = useState<
    readonly {
      id: string;
      kind: string;
      name: string;
      status: string | null;
      region: string | null;
    }[]
  >([]);
  const [recentErrors, setRecentErrors] = useState<readonly string[]>([]);
  const [domainInput, setDomainInput] = useState("");
  const [envKey, setEnvKey] = useState("");
  const [envValue, setEnvValue] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPinResources(pinId);
      setDomains(data.resources.domains);
      setEnvNames(data.resources.envNames);
      setStorage(data.resources.storage);
      setRecentErrors(data.resources.recentErrors);
      setError(data.resources.error ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed.");
    } finally {
      setLoading(false);
    }
  }, [pinId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const confirmAddDomain = useCallback(async () => {
    const name = domainInput.trim();
    if (!name) return;
    // Explicit confirm stands in for the approval card on mobile.
    try {
      await addPinDomain(pinId, { name, approved: true });
      setDomainInput("");
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Domain add failed.");
    }
  }, [domainInput, pinId, reload]);

  const confirmWriteEnv = useCallback(async () => {
    const key = envKey.trim();
    if (!key || !envValue) return;
    try {
      await writePinEnv(pinId, {
        key,
        value: envValue,
        target: ["production"],
        approved: true,
      });
      setEnvKey("");
      setEnvValue("");
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Env write failed.");
    }
  }, [envKey, envValue, pinId, reload]);

  if (loading) {
    return (
      <View className="py-10">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 px-4">
      {error ? (
        <Text className="mb-2 text-sm text-destructive">{error}</Text>
      ) : null}

      <Text className="mb-2 text-sm font-semibold text-foreground">Domains</Text>
      {domains.map((d) => (
        <Text key={d.name} className="mb-1 text-sm text-foreground">
          {d.name}
          {d.verified ? "" : " (unverified)"}
        </Text>
      ))}
      <TextInput
        className="mt-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        placeholder="add.example.com"
        placeholderTextColor="#888"
        value={domainInput}
        onChangeText={setDomainInput}
        autoCapitalize="none"
      />
      <Pressable
        className="mt-2 self-start rounded-lg bg-primary px-3 py-1.5"
        onPress={() => void confirmAddDomain()}
      >
        <Text className="text-sm text-primary-foreground">Add domain</Text>
      </Pressable>

      <Text className="mb-2 mt-4 text-sm font-semibold text-foreground">
        Env names
      </Text>
      {envNames.map((e) => (
        <Text key={e.id} className="mb-1 text-sm text-foreground">
          {e.key} · {e.target.join(", ") || "—"}
        </Text>
      ))}
      <TextInput
        className="mt-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        placeholder="KEY"
        placeholderTextColor="#888"
        value={envKey}
        onChangeText={setEnvKey}
        autoCapitalize="characters"
      />
      <TextInput
        className="mt-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        placeholder="value (not shown again)"
        placeholderTextColor="#888"
        value={envValue}
        onChangeText={setEnvValue}
        secureTextEntry
      />
      <Pressable
        className="mt-2 self-start rounded-lg bg-primary px-3 py-1.5"
        onPress={() => void confirmWriteEnv()}
      >
        <Text className="text-sm text-primary-foreground">Set env</Text>
      </Pressable>

      <Text className="mb-2 mt-4 text-sm font-semibold text-foreground">
        Storage
      </Text>
      {storage.length === 0 ? (
        <Text className="text-sm text-muted-foreground">No stores listed</Text>
      ) : (
        storage.map((s) => (
          <Text key={s.id} className="mb-1 text-sm text-foreground">
            {s.kind}: {s.name}
            {s.region ? ` · ${s.region}` : ""}
          </Text>
        ))
      )}

      <Text className="mb-2 mt-4 text-sm font-semibold text-foreground">
        Recent deploy errors
      </Text>
      {recentErrors.length === 0 ? (
        <Text className="mb-8 text-sm text-muted-foreground">None</Text>
      ) : (
        recentErrors.map((line, i) => (
          <Text key={`${i}-${line.slice(0, 12)}`} className="mb-1 text-xs text-destructive">
            {line}
          </Text>
        ))
      )}
      <View className="h-10" />
    </ScrollView>
  );
}

function DatabaseTab({ pinId }: { readonly pinId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tables, setTables] = useState<
    readonly {
      schema: string;
      name: string;
      approximateRows: number | null;
    }[]
  >([]);
  const [sql, setSql] = useState("SELECT 1");
  const [result, setResult] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPinDatabase(pinId);
      setTables(data.status.tables);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed.");
    } finally {
      setLoading(false);
    }
  }, [pinId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = useCallback(async () => {
    try {
      const data = await queryPinDatabase(pinId, sql);
      setResult(
        `${data.fields.join(" | ")}\n` +
          data.rows
            .map((row) => data.fields.map((f) => String(row[f] ?? "")).join(" | "))
            .join("\n") +
          (data.truncated ? "\n(truncated)" : ""),
      );
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Query failed.");
      setResult(null);
    }
  }, [pinId, sql]);

  if (loading) {
    return (
      <View className="py-10">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 px-4">
      {error ? (
        <Text className="mb-2 text-sm text-destructive">{error}</Text>
      ) : null}
      <Text className="mb-2 text-sm font-semibold text-foreground">Tables</Text>
      {tables.map((t) => (
        <Text key={`${t.schema}.${t.name}`} className="mb-1 text-sm text-foreground">
          {t.schema}.{t.name}
          {t.approximateRows != null ? ` · ~${t.approximateRows}` : ""}
        </Text>
      ))}
      <Text className="mb-2 mt-4 text-sm font-semibold text-foreground">
        Read-only query
      </Text>
      <TextInput
        className="min-h-[80px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        multiline
        value={sql}
        onChangeText={setSql}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable
        className="mt-2 self-start rounded-lg bg-primary px-3 py-1.5"
        onPress={() => void run()}
      >
        <Text className="text-sm text-primary-foreground">Run SELECT</Text>
      </Pressable>
      {result ? (
        <Text className="mt-3 font-mono text-xs text-foreground">{result}</Text>
      ) : null}
      <View className="h-10" />
    </ScrollView>
  );
}

function UsageTab({
  pinId,
  onOpenPearlBilling,
}: {
  readonly pinId: string;
  readonly onOpenPearlBilling: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{
    bandwidthBytes: number | null;
    functionInvocationCount: number | null;
    buildMinutes: number | null;
    storageBytes: number | null;
    invoiceTotalCents: number | null;
    periodStart: string | null;
    periodEnd: string | null;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchPinUsage(pinId);
        setUsage(data.usage);
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed.");
      } finally {
        setLoading(false);
      }
    })();
  }, [pinId]);

  if (loading) {
    return (
      <View className="py-10">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 px-4">
      {error ? (
        <Text className="mb-2 text-sm text-destructive">{error}</Text>
      ) : null}
      <Text className="mb-2 text-sm font-semibold text-foreground">
        Vercel usage (this team)
      </Text>
      <Text className="mb-1 text-sm text-foreground">
        Bandwidth: {formatBytes(usage?.bandwidthBytes ?? null)}
      </Text>
      <Text className="mb-1 text-sm text-foreground">
        Functions: {usage?.functionInvocationCount ?? "—"}
      </Text>
      <Text className="mb-1 text-sm text-foreground">
        Build minutes: {usage?.buildMinutes ?? "—"}
      </Text>
      <Text className="mb-1 text-sm text-foreground">
        Storage: {formatBytes(usage?.storageBytes ?? null)}
      </Text>
      <Text className="mb-4 text-sm text-foreground">
        Invoice:{" "}
        {usage?.invoiceTotalCents != null
          ? `$${(usage.invoiceTotalCents / 100).toFixed(2)}`
          : "—"}
      </Text>
      <Text className="mb-2 text-xs text-muted-foreground">
        Period {usage?.periodStart ?? "—"} → {usage?.periodEnd ?? "—"}
      </Text>

      <Pressable
        className="mt-2 rounded-xl border border-border bg-card px-3 py-3"
        onPress={onOpenPearlBilling}
      >
        <Text className="text-sm font-medium text-foreground">
          Pearl billing (separate)
        </Text>
        <Text className="mt-1 text-xs text-muted-foreground">
          Settings → Billing shows Pearl’s own subscription and spend cap. It is
          not this Vercel invoice.
        </Text>
      </Pressable>
      <View className="h-10" />
    </ScrollView>
  );
}

function formatBytes(value: number | null): string {
  if (value == null) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
