"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  createCategory,
  createCategoryGroup,
  fetchCategories,
  patchCategory,
  patchCategoryGroup,
  type CategoryGroup,
} from "@/components/finances/api";

export function ChartOfAccountsPanel() {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [period, setPeriod] = useState<{ year: number; month: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newCategoryByGroup, setNewCategoryByGroup] = useState<
    Record<string, string>
  >({});
  const [renameDraft, setRenameDraft] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    const payload = await fetchCategories();
    setGroups(payload.groups);
    setPeriod(payload.period);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await reload();
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load categories.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const onAddGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    setBusy("group");
    setError(null);
    try {
      const payload = await createCategoryGroup({ name });
      setGroups(payload.groups);
      setNewGroupName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create group.");
    } finally {
      setBusy(null);
    }
  };

  const onRenameGroup = async (id: string) => {
    const name = (renameDraft[`g:${id}`] ?? "").trim();
    if (!name) return;
    setBusy(`g:${id}`);
    setError(null);
    try {
      const payload = await patchCategoryGroup(id, { name });
      setGroups(payload.groups);
      setRenameDraft((d) => {
        const next = { ...d };
        delete next[`g:${id}`];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename group.");
    } finally {
      setBusy(null);
    }
  };

  const onAddCategory = async (groupId: string) => {
    const name = (newCategoryByGroup[groupId] ?? "").trim();
    if (!name) return;
    setBusy(`add:${groupId}`);
    setError(null);
    try {
      const payload = await createCategory({ name, groupId });
      setGroups(payload.groups);
      setNewCategoryByGroup((d) => ({ ...d, [groupId]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create category.");
    } finally {
      setBusy(null);
    }
  };

  const onRenameCategory = async (id: string) => {
    const name = (renameDraft[`c:${id}`] ?? "").trim();
    if (!name) return;
    setBusy(`c:${id}`);
    setError(null);
    try {
      const payload = await patchCategory(id, { name });
      setGroups(payload.groups);
      setRenameDraft((d) => {
        const next = { ...d };
        delete next[`c:${id}`];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename category.");
    } finally {
      setBusy(null);
    }
  };

  const onArchiveCategory = async (id: string) => {
    setBusy(`c:${id}`);
    setError(null);
    try {
      const payload = await patchCategory(id, { isArchived: true });
      setGroups(payload.groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not archive category.");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
        Loading chart of accounts…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-lg font-semibold">Chart of accounts</h1>
        <p className="text-sm text-muted-foreground">
          Lifestyle categories for spend
          {period
            ? ` · actuals for ${period.month}/${period.year}`
            : ""}
          .
        </p>
      </header>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">Add group</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="h-9 min-w-[12rem] flex-1 rounded-md border bg-background px-3 text-sm"
            placeholder="Group name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <Button
            size="sm"
            disabled={busy !== null || !newGroupName.trim()}
            onClick={() => void onAddGroup()}
          >
            Add group
          </Button>
        </div>
      </section>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No category groups yet. Add a group to start your chart.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.id} className="rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="h-8 min-w-[10rem] flex-1 rounded-md border bg-background px-2 text-sm font-medium"
                value={renameDraft[`g:${group.id}`] ?? group.name}
                onChange={(e) =>
                  setRenameDraft((d) => ({
                    ...d,
                    [`g:${group.id}`]: e.target.value,
                  }))
                }
              />
              <span className="text-xs text-muted-foreground">{group.kind}</span>
              {renameDraft[`g:${group.id}`] !== undefined &&
              renameDraft[`g:${group.id}`] !== group.name ? (
                <Button
                  size="xs"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => void onRenameGroup(group.id)}
                >
                  Save
                </Button>
              ) : null}
            </div>

            <ul className="mt-3 divide-y">
              {group.categories.map((cat) => (
                <li
                  key={cat.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <input
                      className="h-8 min-w-[8rem] flex-1 rounded-md border bg-background px-2 text-sm"
                      value={renameDraft[`c:${cat.id}`] ?? cat.name}
                      onChange={(e) =>
                        setRenameDraft((d) => ({
                          ...d,
                          [`c:${cat.id}`]: e.target.value,
                        }))
                      }
                    />
                    {cat.code ? (
                      <span className="text-xs text-muted-foreground">
                        {cat.code}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm tabular-nums">
                      {cat.monthActualLabel}
                    </span>
                    {renameDraft[`c:${cat.id}`] !== undefined &&
                    renameDraft[`c:${cat.id}`] !== cat.name ? (
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() => void onRenameCategory(cat.id)}
                      >
                        Save
                      </Button>
                    ) : null}
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={busy !== null}
                      onClick={() => void onArchiveCategory(cat.id)}
                    >
                      Archive
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap gap-2">
              <input
                className="h-8 min-w-[10rem] flex-1 rounded-md border bg-background px-2 text-sm"
                placeholder="New category"
                value={newCategoryByGroup[group.id] ?? ""}
                onChange={(e) =>
                  setNewCategoryByGroup((d) => ({
                    ...d,
                    [group.id]: e.target.value,
                  }))
                }
              />
              <Button
                size="xs"
                disabled={
                  busy !== null || !(newCategoryByGroup[group.id] ?? "").trim()
                }
                onClick={() => void onAddCategory(group.id)}
              >
                Add category
              </Button>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
