"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePlaidLink } from "react-plaid-link";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  createEntity,
  createLinkToken,
  exchangePlaid,
  fetchAccounts,
  fetchEntities,
  removePlaidItem,
  sandboxLinkBank,
  syncPlaidItem,
  type BankFeed,
  type FinanceAccount,
  type FinanceEntity,
} from "@/components/finances/api";

export function ConnectionsPanel() {
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [feeds, setFeeds] = useState<BankFeed[]>([]);
  const [entities, setEntities] = useState<FinanceEntity[]>([]);
  const [youId, setYouId] = useState<string | null>(null);
  const [entityId, setEntityId] = useState("");
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [sandbox, setSandbox] = useState(false);
  const [reconnectItemId, setReconnectItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newEntityName, setNewEntityName] = useState("");

  const reload = useCallback(async () => {
    setError(null);
    const [acc, ent] = await Promise.all([fetchAccounts(), fetchEntities()]);
    setAccounts(acc.accounts);
    setFeeds(acc.feeds);
    setEntities(ent.entities);
    setYouId(ent.youId);
    setEntityId((prev) => {
      if (prev && ent.entities.some((e) => e.id === prev)) return prev;
      const preferred =
        ent.entities.find((e) => e.id === ent.youId) ??
        ent.entities.find((e) => e.taxClass === "individual") ??
        ent.entities[0];
      return preferred?.id ?? "";
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await reload();
        const token = await createLinkToken();
        if (!cancelled) {
          setSandbox(Boolean(token.sandbox) || token.env === "sandbox");
          if (token.linkToken) setLinkToken(token.linkToken);
          if (token.error) setError(token.error);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load connections.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const onSuccess = useCallback(
    async (
      publicToken: string | null,
      metadata: { institution?: { name?: string | null } | null },
    ) => {
      if (!publicToken) {
        setError("Plaid did not return a public token.");
        return;
      }
      if (!entityId && !reconnectItemId) {
        setError("Create or select an entity before linking a bank.");
        return;
      }
      setBusy("link");
      setError(null);
      try {
        if (reconnectItemId) {
          await exchangePlaid({ plaidItemId: reconnectItemId });
        } else {
          await exchangePlaid({
            publicToken,
            entityId,
            institutionName: metadata.institution?.name ?? null,
          });
        }
        setReconnectItemId(null);
        await reload();
        const token = await createLinkToken();
        if (token.linkToken) setLinkToken(token.linkToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not link bank.");
      } finally {
        setBusy(null);
      }
    },
    [entityId, reconnectItemId, reload],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  const openLink = useCallback(
    async (plaidItemId?: string) => {
      setBusy("token");
      setError(null);
      try {
        const token = await createLinkToken(plaidItemId);
        setSandbox(Boolean(token.sandbox) || token.env === "sandbox");
        if (!token.linkToken) {
          throw new Error(token.error ?? "Could not start Plaid Link.");
        }
        setReconnectItemId(plaidItemId ?? null);
        setLinkToken(token.linkToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start Plaid Link.");
        setBusy(null);
        return;
      }
      setBusy(null);
    },
    [],
  );

  // Open Link once a freshly requested token is ready.
  useEffect(() => {
    if (linkToken && ready && (busy === null || busy === "token") && reconnectItemId !== undefined) {
      // only auto-open after an explicit openLink that set reconnectItemId path
    }
  }, [linkToken, ready, busy, reconnectItemId]);

  const [pendingOpen, setPendingOpen] = useState(false);
  useEffect(() => {
    if (pendingOpen && linkToken && ready) {
      setPendingOpen(false);
      open();
    }
  }, [pendingOpen, linkToken, ready, open]);

  const startLink = async (plaidItemId?: string) => {
    await openLink(plaidItemId);
    setPendingOpen(true);
  };

  const onSandboxLink = async () => {
    if (!entityId) {
      setError("Create or select an entity before linking a bank.");
      return;
    }
    setBusy("sandbox");
    setError(null);
    try {
      await sandboxLinkBank(entityId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sandbox link failed.");
    } finally {
      setBusy(null);
    }
  };

  const onSync = async (id: string) => {
    setBusy(`sync:${id}`);
    setError(null);
    try {
      await syncPlaidItem(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setBusy(null);
    }
  };

  const onRemove = async (id: string) => {
    if (!window.confirm("Remove this bank connection and its imported transactions?")) {
      return;
    }
    setBusy(`remove:${id}`);
    setError(null);
    try {
      await removePlaidItem(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed.");
    } finally {
      setBusy(null);
    }
  };

  const onCreateEntity = async () => {
    const name = newEntityName.trim();
    if (!name) return;
    setBusy("entity");
    setError(null);
    try {
      const result = await createEntity({ name, taxClass: "individual" });
      setEntities(result.entities);
      setYouId(result.youId);
      setEntityId(result.createdId);
      setNewEntityName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create entity.");
    } finally {
      setBusy(null);
    }
  };

  const onXero = async (action: "authorize" | "revoke") => {
    setBusy("xero");
    setError(null);
    try {
      if (action === "authorize") {
        const response = await fetch("/api/connections/authorize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: "xero" }),
        });
        if (!response.ok) throw new Error(`Could not start Xero (${response.status}).`);
        const data = (await response.json()) as { url: string };
        window.location.assign(data.url);
        return;
      }
      const response = await fetch("/api/connections/revoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: "xero" }),
      });
      if (!response.ok) throw new Error(`Could not disconnect Xero (${response.status}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xero action failed.");
    } finally {
      setBusy(null);
    }
  };

  const entityLabel = useMemo(() => {
    const e = entities.find((row) => row.id === entityId);
    return e?.name ?? (youId ? "You" : "Entity");
  }, [entities, entityId, youId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
        Loading connections…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-lg font-semibold">Connections</h1>
        <p className="text-sm text-muted-foreground">
          Link banks with Plaid for your ledger. Xero stays read-only for chat.
        </p>
      </header>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">Entity for new links</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bank accounts are filed under a legal entity ({entityLabel}).
        </p>
        {entities.length > 0 ? (
          <select
            className="mt-3 h-9 w-full max-w-sm rounded-md border bg-background px-3 text-sm"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
          >
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.taxClass})
              </option>
            ))}
          </select>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              className="h-9 min-w-[12rem] flex-1 rounded-md border bg-background px-3 text-sm"
              placeholder="Your name"
              value={newEntityName}
              onChange={(e) => setNewEntityName(e.target.value)}
            />
            <Button
              size="sm"
              disabled={busy === "entity" || !newEntityName.trim()}
              onClick={() => void onCreateEntity()}
            >
              Create entity
            </Button>
          </div>
        )}
      </section>

      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Banks (Plaid)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {sandbox
                ? "Sandbox mode — use First Platypus Bank or the one-click link."
                : "Connect a bank or credit card."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {sandbox ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={!entityId || busy !== null}
                onClick={() => void onSandboxLink()}
              >
                {busy === "sandbox" ? "Linking…" : "Add sandbox bank"}
              </Button>
            ) : null}
            <Button
              size="sm"
              disabled={!entityId || busy !== null}
              onClick={() => void startLink()}
            >
              Link bank
            </Button>
          </div>
        </div>

        {feeds.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No banks linked yet.</p>
        ) : (
          <ul className="mt-4 divide-y">
            {feeds.map((feed) => (
              <li
                key={feed.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <div className="text-sm font-medium">{feed.institutionName}</div>
                  <div className="text-xs text-muted-foreground">
                    {feed.accountCount} account{feed.accountCount === 1 ? "" : "s"} ·{" "}
                    {feed.status}
                    {feed.lastSyncedAt
                      ? ` · synced ${new Date(feed.lastSyncedAt).toLocaleString("en-US")}`
                      : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {feed.status === "login_required" ? (
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => void startLink(feed.id)}
                    >
                      Reconnect
                    </Button>
                  ) : null}
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => void onSync(feed.id)}
                  >
                    {busy === `sync:${feed.id}` ? "Syncing…" : "Sync"}
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={busy !== null}
                    onClick={() => void onRemove(feed.id)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">Accounts</h2>
        {accounts.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No accounts yet.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {accounts.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <div className="text-sm font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.institutionName ?? a.sourceLabel} · {a.entityName}
                    {a.needsReconcile
                      ? ` · ${a.unclearedCount} uncleared`
                      : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-sm tabular-nums">
                    <div>{a.balanceLabel}</div>
                    <div className="text-xs text-muted-foreground">
                      books {a.booksBalanceLabel}
                    </div>
                  </div>
                  {a.needsReconcile ? (
                    <Button size="xs" variant="outline" asChild>
                      <Link href={`/finances/reconcile?accountId=${a.id}`}>
                        Reconcile
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Xero</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Read-only organisation access for chat. Does not edit Xero.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => void onXero("authorize")}
            >
              Connect / Update
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy !== null}
              onClick={() => void onXero("revoke")}
            >
              Disconnect
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
