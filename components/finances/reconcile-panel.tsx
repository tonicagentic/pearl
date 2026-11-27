"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  fetchAccounts,
  fetchCategories,
  fetchUncleared,
  patchTransaction,
  reconcileAccount,
  type CategoryGroup,
  type FinanceAccount,
} from "@/components/finances/api";

type UnclearedItem = {
  id: string;
  date: string;
  memo: string | null;
  amount: number;
  amountLabel: string;
  type: string;
  category: { id: string; name: string; slug: string } | null;
};

export function ReconcilePanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const accountId = searchParams.get("accountId") ?? "";

  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [items, setItems] = useState<UnclearedItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const account = useMemo(
    () => accounts.find((a) => a.id === accountId) ?? null,
    [accounts, accountId],
  );

  const categories = useMemo(
    () => groups.flatMap((g) => g.categories.map((c) => ({ ...c, groupName: g.name }))),
    [groups],
  );

  const reload = useCallback(async (id: string) => {
    const [acc, cats, uncleared] = await Promise.all([
      fetchAccounts(),
      fetchCategories(),
      id ? fetchUncleared(id) : Promise.resolve({ items: [] as UnclearedItem[] }),
    ]);
    setAccounts(acc.accounts);
    setGroups(cats.groups);
    setItems(uncleared.items);
    setSelected(new Set());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const acc = await fetchAccounts();
        if (cancelled) return;
        setAccounts(acc.accounts);
        const nextId =
          accountId ||
          acc.accounts.find((a) => a.needsReconcile)?.id ||
          acc.accounts[0]?.id ||
          "";
        if (nextId && nextId !== accountId) {
          const p = new URLSearchParams(searchParams.toString());
          p.set("accountId", nextId);
          router.replace(`${pathname}?${p.toString()}`);
          return;
        }
        await reload(nextId);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load reconcile.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, pathname, reload, router, searchParams]);

  const setAccount = (id: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (id) p.set("accountId", id);
    else p.delete("accountId");
    router.replace(`${pathname}?${p.toString()}`);
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectClearable = () => {
    setSelected(
      new Set(
        items
          .filter((i) => i.category && i.category.slug !== "uncategorized")
          .map((i) => i.id),
      ),
    );
  };

  const onAssignCategory = async (id: string, categoryId: string) => {
    setBusy(true);
    setError(null);
    try {
      await patchTransaction(id, { categoryId: categoryId || null });
      await reload(accountId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign category.");
    } finally {
      setBusy(false);
    }
  };

  const onClearSelected = async () => {
    if (!accountId || selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await reconcileAccount(accountId, [...selected], true);
      const skipped = selected.size - result.updated;
      if (skipped > 0) {
        setError(
          `Cleared ${result.updated}; skipped ${skipped} (categorize inbox lines first).`,
        );
      }
      await reload(accountId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clear.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
        Loading reconcile…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-lg font-semibold">Reconcile</h1>
        <p className="text-sm text-muted-foreground">
          Match uncleared lines to the statement balance, then clear them.
        </p>
      </header>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="rounded-lg border bg-card p-4">
        <label className="text-sm font-medium">Account</label>
        <select
          className="mt-2 h-9 w-full max-w-md rounded-md border bg-background px-3 text-sm"
          value={accountId}
          onChange={(e) => setAccount(e.target.value)}
        >
          {accounts.length === 0 ? (
            <option value="">No accounts</option>
          ) : (
            accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.needsReconcile ? ` (${a.unclearedCount} uncleared)` : ""}
              </option>
            ))
          )}
        </select>

        {account ? (
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Statement</dt>
              <dd className="font-medium tabular-nums">{account.balanceLabel}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Books</dt>
              <dd className="font-medium tabular-nums">
                {account.booksBalanceLabel}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Uncleared</dt>
              <dd className="font-medium tabular-nums">{account.unclearedCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Inbox</dt>
              <dd className="font-medium tabular-nums">{account.inboxCount}</dd>
            </div>
          </dl>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy || items.length === 0}
          onClick={selectClearable}
        >
          Select categorized
        </Button>
        <Button
          size="sm"
          disabled={busy || selected.size === 0}
          onClick={() => void onClearSelected()}
        >
          Clear selected ({selected.size})
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {accountId
            ? "No uncleared transactions for this account."
            : "Link a bank in Connections to start reconciling."}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((row) => {
            const inbox =
              !row.category || row.category.slug === "uncategorized";
            return (
              <li
                key={row.id}
                className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <label className="flex min-w-0 flex-1 items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.has(row.id)}
                    disabled={busy || inbox}
                    onChange={() => toggle(row.id)}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {row.memo || "Untitled"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {new Date(row.date).toLocaleDateString("en-US")}
                      {inbox ? " · needs category" : ` · ${row.category?.name}`}
                    </span>
                  </span>
                </label>
                <div className="flex flex-wrap items-center gap-2 pl-7 sm:pl-0">
                  <select
                    className="h-8 max-w-[12rem] rounded-md border bg-background px-2 text-xs"
                    value={row.category?.id ?? ""}
                    disabled={busy}
                    onChange={(e) => void onAssignCategory(row.id, e.target.value)}
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <span className="min-w-[5.5rem] text-right text-sm font-medium tabular-nums">
                    {row.amountLabel}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
