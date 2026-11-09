"use client";

import { useEffect, useState, useTransition } from "react";

import {
  createProjectAction,
  listProjectsAction,
} from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type ProjectOption = {
  readonly id: string;
  readonly name: string;
};

export function ProjectPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSelect: (project: ProjectOption) => void;
}) {
  const [projects, setProjects] = useState<readonly ProjectOption[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError(null);
    startTransition(async () => {
      try {
        const rows = await listProjectsAction();
        setProjects(rows.map((row) => ({ id: row.id, name: row.name })));
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load projects.",
        );
      }
    });
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md" side="bottom">
        <SheetHeader>
          <SheetTitle>Choose a project</SheetTitle>
          <SheetDescription>
            Plan mode writes into a project. Pick an existing one or create a
            new project for this chat.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-6">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          {projects.length > 0 ? (
            <ul className="divide-y rounded-lg border">
              {projects.map((row) => (
                <li key={row.id}>
                  <button
                    className="hover:bg-muted/50 flex w-full items-center justify-between px-3 py-2.5 text-left text-sm"
                    disabled={pending}
                    onClick={() => {
                      onSelect(row);
                      onOpenChange(false);
                    }}
                    type="button"
                  >
                    <span className="font-medium">{row.name}</span>
                    <span className="text-muted-foreground text-xs">Use</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No projects yet. Create one below.
            </p>
          )}
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              startTransition(async () => {
                try {
                  const row = await createProjectAction({ name });
                  setName("");
                  onSelect({ id: row.id, name: row.name });
                  onOpenChange(false);
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Could not create the project.",
                  );
                }
              });
            }}
          >
            <Input
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              placeholder="New project name"
              required
              value={name}
            />
            <Button disabled={pending || !name.trim()} size="sm" type="submit">
              Create and use
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
