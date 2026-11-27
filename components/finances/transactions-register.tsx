"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  fetchTransactions,
  patchTransaction,
  type FilterOptions,
  type RegisterTransaction,
} from "@/components/finances/api";

function statusLabel(status: RegisterTransaction["status"]) {
  switch (status) {
    case "pending":
      return "Pending";
    case "inbox":
      return "Inbox";
    case "categorized":
      return "Categorized";
    case "cleared":
      return "Cleared";
  }
}

export function TransactionsRegister() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<RegisterTransaction[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = searchParams.get("q") ?? "";
  const accountId = searchParams.get("accountId") ?? "";
  const categoryId = searchParams.get("categoryId") ?? "";
  const inboxOnly = searchParams.get("inboxOnly") === "1";
  const groupId = searchParams.get("groupId") ?? "";
  const groupName = searchParams.get("groupName") ?? "";
  const year = searchParams.get("year") ?? "";
  const month = searchParams.get("month") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const queryKey = useMemo(
    () =>
      [
        q,
        accountId,
        categoryId,
        inboxOnly ? "1" : "",
        groupId,
        groupName,
        year,
        month,
        from,
        to,
      ].join("|"),
    [
      q,
      accountId,
      categoryId,
      inboxOnly,
      groupId,
      groupName,
      year,
      month,
      from,
      to,
    ],
  );

  const buildParams = useCallback(
    (cursor?: string | null) => {
      const p = new URLSearchParams();
      if (q.trim()) p.set("q", q.trim());
      if (accountId) p.set("accountId", accountId);
      if (categoryId) p.set("categoryId", categoryId);
      if (inboxOnly) p.set("inboxOnly", "1");
      if (groupId) p.set("groupId", groupId);
      if (groupName) p.set("groupName", groupName);
      if (year) p.set("year", year);
      if (month) p.set("month", month);
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      p.set("limit", "50");
      if (cursor) p.set("cursor", cursor);
      return p;
    },
    [
      q,
      accountId,
      categoryId,
      inboxOnly,
      groupId,
      groupName,
      year,
      month,
      from,
      to,
    ],
  );

  const setParam = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    // Changing filters resets pagination; drop Sankey-only keys when using account/q.
    if (key === "accountId" || key === "q" || key === "inboxOnly" || key === "categoryId") {
      p.delete("groupId");
      p.delete("groupName");
      p.delete("cursor");
    }
    router.replace(`${pathname}?${p.toString()}`);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchTransactions(buildParams());
        if (cancelled) return;
        setItems(payload.items);
        setFilterOptions(payload.filterOptions);
        setNextCursor(payload.nextCursor);
        setHasMore(Boolean(payload.hasMore));
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load transactions.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buildParams, queryKey]);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    setError(null);
    try {
      const payload = await fetchTransactions(buildParams(nextCursor));
      setItems((prev) => [...prev, ...payload.items]);
      setNextCursor(payload.nextCursor);
      setHasMore(Boolean(payload.hasMore));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load more.");
    } finally {
      setLoadingMore(false);
    }
  };

  const onCategoryChange = async (id: string, nextCategoryId: string) => {
    setBusyId(id);
    setError(null);
    try {
      const result = await patchTransaction(id, {
        categoryId: nextCategoryId || null,
      });
      setItems((prev) =>
        prev.map((row) =>
          row.id === id
            ? {
                ...row,
                category: result.item.category
                  ? {
                      id: result.item.category.id,
                      name: result.item.category.name,
                      code: result.item.category.code ?? null,
                      groupName: result.item.category.groupName ?? null,
                    }
                  : null,
                status:
                  row.status === "cleared"
                    ? "cleared"
                    : nextCategoryId
                      ? "categorized"
                      : "inbox",
              }
            : row,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update category.");
    } finally {
      setBusyId(null);
    }
  };

  const onReconcileToggle = async (row: RegisterTransaction) => {
    setBusyId(row.id);
    setError(null);
    try {
      const clear = row.status !== "cleared";
      await patchTransaction(row.id, { reconcile: clear });
      setItems((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? {
                ...item,
                reconciledAt: clear ? new Date().toISOString() : null,
                status: clear
                  ? "cleared"
                  : item.category
                    ? "categorized"
                    : "inbox",
              }
            : item,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update reconcile.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-lg font-semibold">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Search, filter, categorize, and clear lines.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <input
          className="h-9 min-w-[12rem] flex-1 rounded-md border bg-background px-3 text-sm"
          placeholder="Search memo"
          defaultValue={q}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setParam("q", (e.target as HTMLInputElement).value.trim());
            }
          }}
          onBlur={(e) => setParam("q", e.target.value.trim())}
        />
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={accountId}
          onChange={(e) => setParam("accountId", e.target.value)}
        >
          <option value="">All accounts</option>
          {filterOptions?.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={categoryId}
          onChange={(e) => setParam("categoryId", e.target.value)}
        >
          <option value="">All categories</option>
          {filterOptions?.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.groupName} · {c.name}
            </option>
          ))}
        </select>
        <label className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
          <input
            type="checkbox"
            checked={inboxOnly}
            onChange={(e) => setParam("inboxOnly", e.target.checked ? "1" : "")}
          />
          Inbox only
        </label>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
          Loading transactions…
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No transactions match.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {row.memo || "Untitled"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(row.date).toLocaleDateString("en-US")} ·{" "}
                  {row.account?.name ?? "No account"} · {statusLabel(row.status)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-8 max-w-[12rem] rounded-md border bg-background px-2 text-xs"
                  value={row.category?.id ?? ""}
                  disabled={busyId === row.id}
                  onChange={(e) => void onCategoryChange(row.id, e.target.value)}
                >
                  <option value="">Uncategorized</option>
                  {filterOptions?.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Button
                  size="xs"
                  variant={row.status === "cleared" ? "secondary" : "outline"}
                  disabled={busyId === row.id}
                  onClick={() => void onReconcileToggle(row)}
                >
                  {row.status === "cleared" ? "Uncleared" : "Clear"}
                </Button>
                <span className="min-w-[5.5rem] text-right text-sm font-medium tabular-nums">
                  {row.amountLabel}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasMore ? (
        <Button
          variant="outline"
          disabled={loadingMore}
          onClick={() => void loadMore()}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}
