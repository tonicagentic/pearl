"use client";

import { useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";

import {
  reopenIssueAction,
  resolveIssueAction,
  updateIssueAction,
} from "@/app/actions/issues";
import type { IssueWithResponsibility } from "@/lib/db/issues";
import { daysUntil, issueState, type DerivedIssueState } from "@/lib/issues";

import { IssueFields, type IssueFormOption } from "./new-issue-form";

/**
 * One inbox row. Collapsed, it shows title, dates, and responsibility; the
 * detail panel (open on click) carries the v1 fields — notes, responsibility,
 * the two dates — with Edit and Resolve.
 */
export function IssueRow({
  issue,
  options,
}: {
  readonly issue: IssueWithResponsibility;
  readonly options: readonly IssueFormOption[];
}) {
  const state: DerivedIssueState = issueState(issue);
  const resolved = issue.status === "resolved";
  const overdue =
    !resolved && issue.dueDate !== null && daysUntil(issue.dueDate) < 0;

  return (
    <li>
      <details className="rounded-lg border bg-card" open={false}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <span
              className={`truncate text-sm font-medium ${resolved ? "text-muted-foreground line-through" : ""}`}
            >
              {issue.title}
            </span>
            <span className="text-xs text-muted-foreground">
              {issue.responsibilityName}
              {issue.dueDate
                ? ` · ${overdue ? "overdue, due" : "due"} ${issue.dueDate}`
                : ""}
              {issue.reviewDate ? ` · review ${issue.reviewDate}` : ""}
              {state === "dormant" ? " · parked" : ""}
            </span>
          </div>
          <ResolveButton issueId={issue.id} resolved={resolved} />
        </summary>
        <IssueDetail issue={issue} options={options} />
      </details>
    </li>
  );
}

function ResolveButton({
  issueId,
  resolved,
}: {
  readonly issueId: string;
  readonly resolved: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (resolved) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={(event) => {
          event.preventDefault();
          startTransition(async () => {
            try {
              await reopenIssueAction(issueId);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Failed to reopen.");
            }
          });
        }}
        className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
      >
        Reopen
      </button>
    );
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={(event) => {
          event.preventDefault();
          startTransition(async () => {
            try {
              await resolveIssueAction(issueId);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Failed to resolve.");
            }
          });
        }}
        className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? <Loader2Icon className="size-3 animate-spin" /> : null}
        Resolve
      </button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}

function IssueDetail({
  issue,
  options,
}: {
  readonly issue: IssueWithResponsibility;
  readonly options: readonly IssueFormOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    return (
      <form
        className="flex flex-col gap-3 border-t px-4 py-3"
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
              await updateIssueAction(issue.id, {
                title,
                description: String(data.get("description") ?? ""),
                responsibilityId: String(data.get("responsibilityId") ?? ""),
                dueDate: String(data.get("dueDate") ?? "") || null,
                reviewDate: String(data.get("reviewDate") ?? "") || null,
              });
              setEditing(false);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Failed to update.");
            }
          });
        }}
      >
        <input
          name="title"
          required
          defaultValue={issue.title}
          className="rounded-md border bg-background px-3 py-2 text-sm"
          aria-label="Issue title"
        />
        <IssueFields
          options={options}
          issue={{
            description: issue.description,
            responsibilityId: issue.responsibilityId,
            dueDate: issue.dueDate,
            reviewDate: issue.reviewDate,
          }}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3">
      {issue.description ? (
        <p className="whitespace-pre-wrap text-sm text-foreground">
          {issue.description}
        </p>
      ) : (
        <p className="text-sm italic text-muted-foreground">No notes yet.</p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => setEditing(true)}
        className="self-start rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent disabled:opacity-50"
      >
        Edit
      </button>
    </div>
  );
}
