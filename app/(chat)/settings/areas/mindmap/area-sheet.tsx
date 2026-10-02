"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createAreaAction,
  deleteAreaAction,
  renameAreaAction,
  updateAreaPropertiesAction,
} from "@/app/actions/issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatPropertyValue, parsePropertyValue } from "@/lib/area-properties";
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

type PropertyRow = { id: string; key: string; value: string };

function rowsFromProperties(properties: Record<string, unknown>): PropertyRow[] {
  return Object.entries(properties).map(([key, value], index) => ({
    id: String(index), key, value: formatPropertyValue(value),
  }));
}

export function AreaSheet({
  area,
  onOpenChange,
}: {
  readonly area: AreaNode | null;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(area?.name ?? "");
  const [rows, setRows] = useState<PropertyRow[]>(() => rowsFromProperties(area?.properties ?? {}));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(area?.name ?? "");
    setRows(rowsFromProperties(area?.properties ?? {}));
    setError(null);
  }, [area?.id, area?.name, area?.properties]);

  function saveProperties() {
    if (!area) return;
    const names = rows.map((row) => row.key.trim());
    if (names.some((key) => !key) || new Set(names).size !== names.length) {
      setError("Every property needs a unique name.");
      return;
    }
    let properties: Record<string, unknown>;
    try {
      properties = Object.fromEntries(rows.map((row) => [row.key.trim(), parsePropertyValue(row.value)]));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid property value.");
      return;
    }
    startTransition(async () => {
      try {
        await updateAreaPropertiesAction(area.id, properties);
        setError(null);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Properties could not be saved.");
      }
    });
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={area !== null}>
      <SheetContent className="overflow-y-auto" side="right">
        <SheetHeader>
          <SheetTitle>{area?.name ?? "Area"}</SheetTitle>
          <SheetDescription>
            Edit this area and its properties. Delete is blocked while open
            issues remain in the subtree.
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
            <section className="flex flex-col gap-3" aria-label="Area properties">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Properties</h3>
                <Button
                  disabled={pending}
                  onClick={() => setRows((current) => [...current, { id: crypto.randomUUID(), key: "", value: "" }])}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Add property
                </Button>
              </div>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No properties yet.</p>
              ) : null}
              {rows.map((row) => (
                <div className="rounded-md border border-border p-3" key={row.id}>
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label="Property name"
                      disabled={pending}
                      maxLength={100}
                      onChange={(event) => setRows((current) => current.map((item) =>
                        item.id === row.id ? { ...item, key: event.target.value } : item
                      ))}
                      placeholder="Name"
                      value={row.key}
                    />
                    <Button
                      aria-label={`Remove ${row.key || "property"}`}
                      disabled={pending}
                      onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Remove
                    </Button>
                  </div>
                  <Textarea
                    aria-label={`Value for ${row.key || "property"}`}
                    className="mt-2 min-h-16 font-mono text-xs"
                    disabled={pending}
                    onChange={(event) => setRows((current) => current.map((item) =>
                      item.id === row.id ? { ...item, value: event.target.value } : item
                    ))}
                    placeholder='Value (text, number, true, or JSON)'
                    value={row.value}
                  />
                </div>
              ))}
              <Button disabled={pending} onClick={saveProperties} type="button">
                Save properties
              </Button>
            </section>
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
