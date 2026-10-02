"use client";

import { useEffect, useState, useTransition } from "react";

import {
  createAreaAction,
  deleteAreaAction,
  renameAreaAction,
} from "@/app/actions/issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AreaNode } from "@/lib/db/issues";

export function findArea(
  tree: readonly AreaNode[],
  id: string,
): AreaNode | null {
  for (const node of tree) {
    if (node.id === id) {
      return node;
    }
    const nested = findArea(node.children, id);
    if (nested) {
      return nested;
    }
  }
  return null;
}

export function AreaSheet({
  area,
  onOpenChange,
}: {
  readonly area: AreaNode | null;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(area?.name ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(area?.name ?? "");
    setError(null);
  }, [area]);

  return (
    <Sheet onOpenChange={onOpenChange} open={area !== null}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{area?.name ?? "Area"}</SheetTitle>
          <SheetDescription>
            Rename this area, add a child, or delete it. Delete is blocked
            while any open issues remain in the subtree.
          </SheetDescription>
        </SheetHeader>
        {area ? (
          <div className="flex flex-col gap-4 px-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm" htmlFor="area-name">
                Name
              </label>
              <Input
                disabled={pending}
                id="area-name"
                onBlur={() => {
                  const trimmed = name.trim();
                  if (!trimmed || trimmed === area.name) {
                    setName(area.name);
                    return;
                  }
                  startTransition(async () => {
                    try {
                      await renameAreaAction(area.id, { name: trimmed });
                      setError(null);
                    } catch (cause) {
                      setName(area.name);
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "The area could not be renamed.",
                      );
                    }
                  });
                }}
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
            </div>
            {area.children.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                {area.children.length === 1
                  ? "1 child area"
                  : `${area.children.length} child areas`}
              </p>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        ) : null}
        <SheetFooter>
          <Button
            disabled={pending || !area}
            onClick={() => {
              if (!area) {
                return;
              }
              startTransition(async () => {
                try {
                  await createAreaAction({
                    name: "New area",
                    parentId: area.id,
                  });
                  setError(null);
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "The area could not be created.",
                  );
                }
              });
            }}
            variant="outline"
          >
            Add child
          </Button>
          <Button
            disabled={pending || !area}
            onClick={() => {
              if (!area) {
                return;
              }
              startTransition(async () => {
                try {
                  await deleteAreaAction(area.id);
                  setError(null);
                  onOpenChange(false);
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "The area could not be deleted.",
                  );
                }
              });
            }}
            variant="destructive"
          >
            Delete
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
