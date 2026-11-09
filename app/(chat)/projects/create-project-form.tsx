"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createProjectAction } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function CreateProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border bg-card p-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            const row = await createProjectAction({
              name,
              instructions: instructions.trim() || undefined,
            });
            setName("");
            setInstructions("");
            router.push(`/projects/${row.id}`);
            router.refresh();
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
      <div className="text-sm font-medium">New project</div>
      <Input
        maxLength={120}
        onChange={(event) => setName(event.target.value)}
        placeholder="Name"
        required
        value={name}
      />
      <Textarea
        className="min-h-20"
        maxLength={20_000}
        onChange={(event) => setInstructions(event.target.value)}
        placeholder="Optional instructions for every chat in this project"
        value={instructions}
      />
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      <div>
        <Button disabled={pending || !name.trim()} size="sm" type="submit">
          {pending ? "Creating…" : "Create project"}
        </Button>
      </div>
    </form>
  );
}
