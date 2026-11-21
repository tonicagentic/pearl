"use client";

import { useMemo, useState, useTransition } from "react";
import { ArchiveIcon, Loader2Icon, PlusIcon } from "lucide-react";

import {
  archiveCapabilityAction,
  saveCapabilityAction,
  updateCapabilityAction,
} from "@/app/actions/capabilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CapabilityDto } from "@/lib/capabilities/serialize";
import {
  CAPABILITY_KINDS,
  CAPABILITY_STATUSES,
} from "@/lib/capabilities/validation";
import type { CapabilityKind, CapabilityStatus } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

type EditorMode =
  | { readonly kind: "closed" }
  | { readonly kind: "create" }
  | { readonly kind: "edit"; readonly capability: CapabilityDto };

type FormState = {
  name: string;
  kind: CapabilityKind;
  summary: string;
  audience: string;
  proof: string;
  status: CapabilityStatus;
  notes: string;
};

const emptyForm = (): FormState => ({
  name: "",
  kind: "skill",
  summary: "",
  audience: "",
  proof: "",
  status: "active",
  notes: "",
});

function fromDto(row: CapabilityDto): FormState {
  return {
    name: row.name,
    kind: row.kind,
    summary: row.summary,
    audience: row.audience ?? "",
    proof: row.proof ?? "",
    status: row.status === "archived" ? "active" : row.status,
    notes: row.notes ?? "",
  };
}

export function CapabilitiesSettings({
  initialCapabilities,
}: {
  readonly initialCapabilities: readonly CapabilityDto[];
}) {
  const [capabilities, setCapabilities] = useState(initialCapabilities);
  const [editor, setEditor] = useState<EditorMode>({ kind: "closed" });
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const filtered = showArchived
      ? capabilities
      : capabilities.filter((row) => row.status !== "archived");
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [capabilities, showArchived]);

  const upsertLocal = (row: CapabilityDto) => {
    setCapabilities((current) => {
      const without = current.filter((item) => item.id !== row.id);
      return [...without, row];
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Your catalog</h2>
          <div className="flex flex-wrap gap-1.5">
            <Button
              disabled={pending}
              onClick={() => setShowArchived((value) => !value)}
              size="sm"
              type="button"
              variant="ghost"
            >
              {showArchived ? "Hide archived" : "Show archived"}
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                setError(null);
                setEditor({ kind: "create" });
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              <PlusIcon className="size-3.5" />
              New capability
            </Button>
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
            Nothing here yet. Add a skill, product, or service you can sell.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {visible.map((row) => (
              <li
                className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
                key={row.id}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {row.name}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
                      {row.kind}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] capitalize text-muted-foreground",
                        row.status === "archived"
                          ? "bg-muted"
                          : row.status === "exploring"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                      )}
                    >
                      {row.status}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {row.summary}
                  </p>
                  {row.audience ? (
                    <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                      For: {row.audience}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <Button
                    disabled={pending || row.status === "archived"}
                    onClick={() => {
                      setError(null);
                      setEditor({ kind: "edit", capability: row });
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Edit
                  </Button>
                  {row.status !== "archived" ? (
                    <Button
                      disabled={pending}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Archive “${row.name}”? Pearl will stop treating it as active.`,
                          )
                        ) {
                          return;
                        }
                        setError(null);
                        startTransition(async () => {
                          try {
                            const next = await archiveCapabilityAction(row.id);
                            upsertLocal(next);
                            if (
                              editor.kind === "edit" &&
                              editor.capability.id === row.id
                            ) {
                              setEditor({ kind: "closed" });
                            }
                          } catch (cause) {
                            setError(
                              cause instanceof Error
                                ? cause.message
                                : "Could not archive capability.",
                            );
                          }
                        });
                      }}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <ArchiveIcon className="size-3.5" />
                      Archive
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {editor.kind !== "closed" ? (
          <CapabilityEditor
            key={editor.kind === "edit" ? editor.capability.id : "create"}
            capability={editor.kind === "edit" ? editor.capability : null}
            pending={pending}
            onCancel={() => setEditor({ kind: "closed" })}
            onSave={(form) => {
              setError(null);
              startTransition(async () => {
                try {
                  const payload = {
                    name: form.name,
                    kind: form.kind,
                    summary: form.summary,
                    audience: form.audience || null,
                    proof: form.proof || null,
                    status: form.status,
                    notes: form.notes || null,
                  };
                  const row =
                    editor.kind === "edit"
                      ? await updateCapabilityAction(
                          editor.capability.id,
                          payload,
                        )
                      : await saveCapabilityAction(payload);
                  upsertLocal(row);
                  setEditor({ kind: "closed" });
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Could not save capability.",
                  );
                }
              });
            }}
          />
        ) : null}
      </section>
    </div>
  );
}

function CapabilityEditor({
  capability,
  pending,
  onCancel,
  onSave,
}: {
  readonly capability: CapabilityDto | null;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onSave: (form: FormState) => void;
}) {
  const [form, setForm] = useState<FormState>(
    capability ? fromDto(capability) : emptyForm(),
  );

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(form);
      }}
    >
      <h3 className="text-sm font-medium">
        {capability ? "Edit capability" : "New capability"}
      </h3>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Name</span>
        <Input
          required
          value={form.name}
          onChange={(event) =>
            setForm((current) => ({ ...current, name: event.target.value }))
          }
          placeholder="Maintenance monitoring"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Kind
          </span>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={form.kind}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                kind: event.target.value as CapabilityKind,
              }))
            }
          >
            {CAPABILITY_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Status
          </span>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                status: event.target.value as CapabilityStatus,
              }))
            }
          >
            {CAPABILITY_STATUSES.filter((status) => status !== "archived").map(
              (status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ),
            )}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Summary
        </span>
        <Textarea
          required
          rows={2}
          value={form.summary}
          onChange={(event) =>
            setForm((current) => ({ ...current, summary: event.target.value }))
          }
          placeholder="What the buyer gets in one line"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Audience
        </span>
        <Input
          value={form.audience}
          onChange={(event) =>
            setForm((current) => ({ ...current, audience: event.target.value }))
          }
          placeholder="Who it is for (optional)"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Proof</span>
        <Textarea
          rows={2}
          value={form.proof}
          onChange={(event) =>
            setForm((current) => ({ ...current, proof: event.target.value }))
          }
          placeholder="Real credentials, customers, or results (optional)"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Notes</span>
        <Textarea
          rows={2}
          value={form.notes}
          onChange={(event) =>
            setForm((current) => ({ ...current, notes: event.target.value }))
          }
          placeholder="Optional notes"
        />
      </label>

      <div className="flex justify-end gap-2">
        <Button
          disabled={pending}
          onClick={onCancel}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
        <Button disabled={pending} size="sm" type="submit">
          {pending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
          Save
        </Button>
      </div>
    </form>
  );
}
