"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Deletes one Library quote after confirm, then refreshes or calls onDeleted.
 */
export function DeleteQuoteButton({
  quoteId,
  onDeleted,
}: {
  readonly quoteId: string;
  readonly onDeleted?: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);

    const response = await fetch(`/api/quotes/${encodeURIComponent(quoteId)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(data?.error ?? "Failed to delete.");
      return;
    }

    if (onDeleted) {
      onDeleted();
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        className="rounded-md border px-2.5 py-1 text-destructive hover:bg-destructive/10"
        onClick={() => setConfirming(true)}
      >
        Delete
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        className="rounded-md bg-destructive px-2.5 py-1 text-destructive-foreground hover:opacity-90 disabled:opacity-60"
        onClick={() => {
          void handleDelete();
        }}
        disabled={pending}
      >
        {pending ? "Deleting…" : "Confirm delete"}
      </button>
      <button
        type="button"
        className="rounded-md border px-2.5 py-1 hover:bg-accent"
        onClick={() => {
          setConfirming(false);
          setError(null);
        }}
        disabled={pending}
      >
        Cancel
      </button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}
