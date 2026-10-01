"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";

import { createIssueAction } from "@/app/actions/issues";

export type IssueFormOption = {
  readonly id: string;
  readonly label: string;
};

/**
 * Capture form for a new issue. Titles are required; everything else is
 * optional so capture stays frictionless — the whole point is getting the
 * unresolved thing out of your head. The review date is phrased as the
 * "come back" date, which is the product's contract to resurface.
 */
export function NewIssueForm({
  options,
}: {
  readonly options: readonly IssueFormOption[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
      >
        + New issue
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      className="flex flex-col gap-3 rounded-lg border bg-card px-4 py-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const title = String(data.get("title") ?? "").trim();

        if (!title) {
          setError("A title is required.");
          return;
        }

        setError(null);
        startTransition(async () => {
          try {
            await createIssueAction({
              title,
              description: String(data.get("description") ?? ""),
              areaId: String(data.get("areaId") ?? ""),
              dueDate: String(data.get("dueDate") ?? "") || null,
              reviewDate: String(data.get("reviewDate") ?? "") || null,
            });
            formRef.current?.reset();
            setOpen(false);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Failed to create the issue.");
          }
        });
      }}
    >
      <input
        name="title"
        required
        placeholder="What needs resolving?"
        className="rounded-md border bg-background px-3 py-2 text-sm"
        aria-label="Issue title"
      />
      <IssueFields options={options} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          Capture
        </button>
      </div>
    </form>
  );
}

/** Shared fields: area select + the two dates + notes. */
export function IssueFields({
  options,
  issue,
}: {
  readonly options: readonly IssueFormOption[];
  readonly issue?: {
    readonly description: string | null;
    readonly areaId: string;
    readonly dueDate: string | null;
    readonly reviewDate: string | null;
  };
}) {
  return (
    <>
      <select
        name="areaId"
        defaultValue={issue?.areaId}
        required
        className="rounded-md border bg-background px-3 py-2 text-sm"
        aria-label="Area"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label.trim()}
          </option>
        ))}
      </select>
      <textarea
        name="description"
        defaultValue={issue?.description ?? ""}
        placeholder="Notes — what you're waiting on, what done looks like…"
        rows={3}
        className="rounded-md border bg-background px-3 py-2 text-sm"
        aria-label="Notes"
      />
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Due date
          <input
            type="date"
            name="dueDate"
            defaultValue={issue?.dueDate ?? ""}
            className="rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Review date (when it should come back to you)
          <input
            type="date"
            name="reviewDate"
            defaultValue={issue?.reviewDate ?? ""}
            className="rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>
      </div>
    </>
  );
}
