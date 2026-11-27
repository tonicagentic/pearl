"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClockIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react";

import {
  formatScheduleSummary,
  triggerKindLabel,
} from "@/lib/automations/schedule";
import type {
  AutomationDto,
  PearlAutomationTriggerConfig,
  PearlAutomationTriggerKind,
} from "@/lib/automations";
import { TRIGGER_KINDS } from "@/lib/automations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EditorState = {
  readonly id?: string;
  readonly name: string;
  readonly instructions: string;
  readonly triggerKind: PearlAutomationTriggerKind | null;
  readonly triggerConfig: PearlAutomationTriggerConfig;
  readonly notifyPush: boolean;
  readonly notifyEmail: boolean;
};

const EMPTY_EDITOR: EditorState = {
  name: "",
  instructions: "",
  triggerKind: null,
  triggerConfig: {},
  notifyPush: true,
  notifyEmail: true,
};

function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  return body.error ?? `Request failed (${response.status}).`;
}

/** Client Automations hub: list, empty state, create/edit form. */
export function AutomationsPanel() {
  const [automations, setAutomations] = useState<readonly AutomationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);
  const [saving, setSaving] = useState(false);
  const timezone = useMemo(() => deviceTimeZone(), []);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/automations", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      const data = (await response.json()) as {
        automations: AutomationDto[];
      };
      setAutomations(data.automations);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to load automations.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openCreate = () => {
    setEditor(EMPTY_EDITOR);
    setEditorOpen(true);
    setError(null);
  };

  const openEdit = (row: AutomationDto) => {
    setEditor({
      id: row.id,
      name: row.name,
      instructions: row.instructions,
      triggerKind: row.triggerKind,
      triggerConfig: row.triggerConfig,
      notifyPush: row.notifyPush,
      notifyEmail: row.notifyEmail,
    });
    setEditorOpen(true);
    setError(null);
  };

  const canSave =
    editor.name.trim().length > 0 &&
    editor.instructions.trim().length > 0 &&
    editor.triggerKind !== null;

  const save = async () => {
    if (!canSave || !editor.triggerKind) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: editor.name.trim(),
        instructions: editor.instructions.trim(),
        triggerKind: editor.triggerKind,
        triggerConfig: editor.triggerConfig,
        timezone,
        notifyPush: editor.notifyPush,
        notifyEmail: editor.notifyEmail,
        enabled: true,
      };
      const response = await fetch(
        editor.id
          ? `/api/automations/${encodeURIComponent(editor.id)}`
          : "/api/automations",
        {
          method: editor.id ? "PATCH" : "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) throw new Error(await readError(response));
      setEditorOpen(false);
      setLoading(true);
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save automation.",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (row: AutomationDto, enabled: boolean) => {
    setError(null);
    try {
      const response = await fetch(
        `/api/automations/${encodeURIComponent(row.id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enabled }),
        },
      );
      if (!response.ok) throw new Error(await readError(response));
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update automation.",
      );
    }
  };

  const remove = async (row: AutomationDto) => {
    if (!window.confirm(`Delete “${row.name}”? This cannot be undone.`)) {
      return;
    }
    setError(null);
    try {
      const response = await fetch(
        `/api/automations/${encodeURIComponent(row.id)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!response.ok) throw new Error(await readError(response));
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not delete automation.",
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Automations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Schedule prompts for Pearl and get notified when they finish.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <PlusIcon />
          New Automation
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {editorOpen ? (
        <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">
              {editor.id ? "Edit automation" : "New automation"}
            </h2>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditorOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!canSave || saving}
                onClick={() => void save()}
              >
                {saving ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : null}
                {editor.id ? "Save" : "Create"}
              </Button>
            </div>
          </div>

          <label className="mb-3 block">
            <span className="mb-1.5 block text-xs text-muted-foreground">
              Name
            </span>
            <input
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              value={editor.name}
              onChange={(event) =>
                setEditor((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Automation Name"
            />
          </label>

          <div className="mb-3">
            <span className="mb-1.5 block text-xs text-muted-foreground">
              Trigger
            </span>
            <div className="grid gap-2 sm:grid-cols-2">
              {TRIGGER_KINDS.map((kind) => {
                const selected = editor.triggerKind === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-left transition-colors",
                      selected
                        ? "border-foreground/30 bg-muted/60"
                        : "border-border hover:bg-muted/40",
                    )}
                    onClick={() =>
                      setEditor((current) => ({
                        ...current,
                        triggerKind: kind,
                        triggerConfig: {},
                      }))
                    }
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <ClockIcon className="size-3.5 text-muted-foreground" />
                      {triggerKindLabel(kind)}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatScheduleSummary(kind, {}, timezone)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="mb-3 block">
            <span className="mb-1.5 block text-xs text-muted-foreground">
              Instructions
            </span>
            <textarea
              className="min-h-28 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              value={editor.instructions}
              onChange={(event) =>
                setEditor((current) => ({
                  ...current,
                  instructions: event.target.value,
                }))
              }
              placeholder="Tell the agent what it should do"
            />
          </label>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={editor.notifyPush}
                onChange={(event) =>
                  setEditor((current) => ({
                    ...current,
                    notifyPush: event.target.checked,
                  }))
                }
              />
              Push
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={editor.notifyEmail}
                onChange={(event) =>
                  setEditor((current) => ({
                    ...current,
                    notifyEmail: event.target.checked,
                  }))
                }
              />
              Email
            </label>
          </div>
        </section>
      ) : null}

      {automations.length === 0 && !editorOpen ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
            <ZapIcon className="size-6 text-foreground" />
          </div>
          <h2 className="text-lg font-semibold">
            Start by adding an automation
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Schedule an automation to run any prompt and get reminded when it
            completes
          </p>
          <Button type="button" className="mt-6" variant="outline" onClick={openCreate}>
            <PlusIcon />
            New Automation
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {automations.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => openEdit(row)}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  <ZapIcon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {row.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {row.scheduleSummary}
                  </span>
                </span>
              </button>
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(event) =>
                    void toggleEnabled(row, event.target.checked)
                  }
                />
                On
              </label>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Delete ${row.name}`}
                onClick={() => void remove(row)}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
