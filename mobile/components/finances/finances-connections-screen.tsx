import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useCSSVariable } from "uniwind";

import { FinancesSubnav } from "@/components/finances/finances-subnav";
import { ScreenChrome } from "@/components/navigation/screen-chrome";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import {
  createFinanceEntity,
  createPlaidLinkToken,
  exchangePlaidToken,
  fetchFinanceAccounts,
  fetchFinanceEntities,
  removeFinancePlaidItem,
  sandboxLinkFinanceBank,
  syncFinancePlaidItem,
} from "@/src/finances-client";
import { openPlaidLink } from "@/src/plaid-link";
import { queryErrorMessage, showQueryErrorBanner } from "@/src/query-client";
import { useNetworkStatus } from "@/src/network-status";

export function FinancesConnectionsScreen() {
  const router = useRouter();
  const { offline } = useNetworkStatus();
  const [entityId, setEntityId] = useState("");
  const [newEntityName, setNewEntityName] = useState("");
  const [sandbox, setSandbox] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mutedColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const borderColor = useCSSVariable("--color-border") as string | undefined;

  const accountsQuery = useQuery({
    queryKey: ["finances-accounts"],
    queryFn: fetchFinanceAccounts,
  });
  const entitiesQuery = useQuery({
    queryKey: ["finances-entities"],
    queryFn: fetchFinanceEntities,
  });

  useFocusEffect(
    useCallback(() => {
      void accountsQuery.refetch();
      void entitiesQuery.refetch();
      void createPlaidLinkToken()
        .then((token) => {
          setSandbox(Boolean(token.sandbox) || token.env === "sandbox");
        })
        .catch(() => undefined);
    }, [accountsQuery.refetch, entitiesQuery.refetch]),
  );

  const entities = entitiesQuery.data?.entities ?? [];
  const selectedEntity =
    entityId ||
    entitiesQuery.data?.youId ||
    entities.find((e) => e.taxClass === "individual")?.id ||
    entities[0]?.id ||
    "";

  const reload = async () => {
    await Promise.all([accountsQuery.refetch(), entitiesQuery.refetch()]);
  };

  const onCreateEntity = async () => {
    const name = newEntityName.trim();
    if (!name) return;
    setBusy("entity");
    setError(null);
    try {
      const result = await createFinanceEntity({
        name,
        taxClass: "individual",
      });
      setEntityId(result.createdId);
      setNewEntityName("");
      await entitiesQuery.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create entity.");
    } finally {
      setBusy(null);
    }
  };

  const onSandbox = async () => {
    if (!selectedEntity) {
      setError("Create an entity before linking a bank.");
      return;
    }
    setBusy("sandbox");
    setError(null);
    try {
      await sandboxLinkFinanceBank(selectedEntity);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sandbox link failed.");
    } finally {
      setBusy(null);
    }
  };

  const onLink = async (plaidItemId?: string) => {
    if (!selectedEntity && !plaidItemId) {
      setError("Create an entity before linking a bank.");
      return;
    }
    setBusy("link");
    setError(null);
    try {
      const token = await createPlaidLinkToken(plaidItemId);
      setSandbox(Boolean(token.sandbox) || token.env === "sandbox");
      if (!token.linkToken) {
        throw new Error(token.error ?? "Could not start Plaid Link.");
      }
      await openPlaidLink({
        linkToken: token.linkToken,
        onSuccess: (publicToken, institutionName) => {
          void (async () => {
            try {
              if (plaidItemId) {
                await exchangePlaidToken({ plaidItemId });
              } else {
                await exchangePlaidToken({
                  publicToken,
                  entityId: selectedEntity,
                  institutionName,
                });
              }
              await reload();
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Could not link bank.",
              );
            } finally {
              setBusy(null);
            }
          })();
        },
        onExit: () => setBusy(null),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Link.");
      setBusy(null);
    }
  };

  const showError =
    showQueryErrorBanner(offline, accountsQuery.error || entitiesQuery.error) ||
    error;

  return (
    <ScreenChrome>
      <ScrollView className="flex-1 px-4" contentContainerClassName="pb-10">
        <FinancesSubnav />
        <Text variant="title" className="mb-1">
          Connections
        </Text>
        <Text variant="body" tone="muted" className="mb-4">
          Link banks with Plaid. Sandbox can add a test bank without Link.
        </Text>

        {showError ? (
          <Text variant="body" className="mb-3 text-rose-600">
            {error ??
              queryErrorMessage(
                accountsQuery.error || entitiesQuery.error,
                "Could not load connections.",
              )}
          </Text>
        ) : null}

        <View className="mb-4 gap-2 rounded-2xl border border-border p-4">
          <Text variant="label">Entity for new links</Text>
          {entities.length > 0 ? (
            <View className="gap-2">
              {entities.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => setEntityId(e.id)}
                  className="rounded-xl border border-border px-3 py-2"
                  style={{
                    borderColor:
                      selectedEntity === e.id ? mutedColor : borderColor,
                  }}
                >
                  <Text variant="body">
                    {e.name} ({e.taxClass})
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View className="gap-2">
              <TextInput
                value={newEntityName}
                onChangeText={setNewEntityName}
                placeholder="Your name"
                className="rounded-xl border border-border px-3 py-2 text-base text-foreground"
                placeholderTextColor={mutedColor}
              />
              <Button
                label="Create entity"
                loading={busy === "entity"}
                onPress={() => void onCreateEntity()}
              />
            </View>
          )}
        </View>

        <View className="mb-4 gap-3 rounded-2xl border border-border p-4">
          <Text variant="label">Banks</Text>
          {sandbox ? (
            <Button
              label="Add sandbox bank"
              loading={busy === "sandbox"}
              onPress={() => void onSandbox()}
            />
          ) : null}
          <Button
            label="Link bank"
            variant="secondary"
            loading={busy === "link"}
            onPress={() => void onLink()}
          />
          {(accountsQuery.data?.feeds ?? []).map((feed) => (
            <View
              key={feed.id}
              className="gap-2 border-t border-border pt-3"
            >
              <Text variant="body" weight="medium">
                {feed.institutionName}
              </Text>
              <Text variant="caption" tone="muted">
                {feed.accountCount} accounts · {feed.status}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {feed.status === "login_required" ? (
                  <Button
                    label="Reconnect"
                    variant="secondary"
                    onPress={() => void onLink(feed.id)}
                  />
                ) : null}
                <Button
                  label="Sync"
                  variant="secondary"
                  loading={busy === `sync:${feed.id}`}
                  onPress={() => {
                    setBusy(`sync:${feed.id}`);
                    void syncFinancePlaidItem(feed.id)
                      .then(reload)
                      .catch((err) =>
                        setError(
                          err instanceof Error ? err.message : "Sync failed.",
                        ),
                      )
                      .finally(() => setBusy(null));
                  }}
                />
                <Button
                  label="Remove"
                  variant="secondary"
                  onPress={() => {
                    Alert.alert(
                      "Remove bank?",
                      "This deletes the connection and imported transactions.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Remove",
                          style: "destructive",
                          onPress: () => {
                            setBusy(`remove:${feed.id}`);
                            void removeFinancePlaidItem(feed.id)
                              .then(reload)
                              .catch((err) =>
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "Remove failed.",
                                ),
                              )
                              .finally(() => setBusy(null));
                          },
                        },
                      ],
                    );
                  }}
                />
              </View>
            </View>
          ))}
        </View>

        <View className="gap-3 rounded-2xl border border-border p-4">
          <Text variant="label">Accounts</Text>
          {accountsQuery.isPending && !accountsQuery.data ? (
            <ActivityIndicator color={mutedColor} />
          ) : (accountsQuery.data?.accounts ?? []).length === 0 ? (
            <Text variant="body" tone="muted">
              No accounts yet.
            </Text>
          ) : (
            accountsQuery.data?.accounts.map((a) => (
              <Pressable
                key={a.id}
                className="gap-1 border-t border-border pt-3"
                onPress={() =>
                  a.needsReconcile
                    ? router.navigate({
                        pathname: "/finances/reconcile",
                        params: { accountId: a.id },
                      })
                    : undefined
                }
              >
                <Text variant="body" weight="medium">
                  {a.name}
                </Text>
                <Text variant="caption" tone="muted">
                  {a.institutionName ?? a.sourceLabel} · {a.balanceLabel}
                  {a.needsReconcile
                    ? ` · ${a.unclearedCount} uncleared`
                    : ""}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenChrome>
  );
}
