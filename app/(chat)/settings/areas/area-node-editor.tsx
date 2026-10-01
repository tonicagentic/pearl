"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, PlusIcon } from "lucide-react";

import {
  createAreaAction,
  deleteAreaAction,
  renameAreaAction,
} from "@/app/actions/issues";
import type { AreaNode } from "@/lib/db/issues";

/**
 * One node of the area tree with its inline editor. The structure
 * is just parentId; no drag-and-drop — add child, rename, delete (blocked
 * while open issues exist anywhere in the subtree).
 */
export function AreaNodeEditor({
  node,
  depth,
}: {
  readonly node: AreaNode;
  readonly depth: number;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const childIndent = `pl-${Math.min(depth * 4, 12)}`;

  return (
    <div className={childIndent}>
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
        {open ? (
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const name = String(data.get("name") ?? "").trim();

              if (!name) {
                return;
              }

              startTransition(async () => {
                try {
                  await renameAreaAction(node.id, { name });
                  setOpen(false);
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : "Failed to rename.");
                }
              });
            }}
          >
            <input
              name="name"
              defaultValue={node.name}
              required
              className="flex-1 rounded-md border bg-background px-2 py-1 text-sm"
              aria-label="Area name"
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
            <span className="text-sm">{node.name}</span>
            <span className="flex items-center gap-1">
              {error ? (
                <span className="text-xs text-destructive">{error}</span>
              ) : null}
              <button
                type="button"
                aria-label={`Rename ${node.name}`}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                onClick={() => setOpen(true)}
              >
                Rename
              </button>
              <button
                type="button"
                aria-label={`Delete ${node.name}`}
                disabled={pending}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Delete “${node.name}”? Sub-areas go with it. Open issues block the delete.`,
                    )
                  ) {
                    return;
                  }

                  startTransition(async () => {
                    try {
                      await deleteAreaAction(node.id);
                    } catch (cause) {
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Failed to delete.",
                      );
                    }
                  });
                }}
              >
                {pending ? (
                  <Loader2Icon className="size-3 animate-spin" />
                ) : (
                  "Delete"
                )}
              </button>
            </span>
          </>
        )}
      </div>

      <div className="flex flex-col gap-1 pl-4 pt-1">
        {node.children.map((child) => (
          <AreaNodeEditor key={child.id} node={child} depth={depth + 1} />
        ))}

        {adding ? (
          <form
            className="flex items-center gap-2 py-1"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const name = String(data.get("name") ?? "").trim();

              if (!name) {
                return;
              }

              startTransition(async () => {
                try {
                  await createAreaAction({
                    name,
                    parentId: node.id,
                  });
                  setAdding(false);
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : "Failed to add.");
                }
              });
            }}
          >
            <input
              name="name"
              required
              placeholder={`Under ${node.name}…`}
              className="flex-1 rounded-md border bg-background px-2 py-1 text-sm"
              aria-label={`New area under ${node.name}`}
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              Add
            </button>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
              onClick={() => setAdding(false)}
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="flex items-center gap-1 self-start rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
            onClick={() => setAdding(true)}
          >
            <PlusIcon className="size-3" />
            Add area
          </button>
        )}
      </div>
    </div>
  );
}
