"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createCustomAgentAction } from "@/app/actions/custom-agents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function CreateAgentForm() {
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
            const row = await createCustomAgentAction({
              name,
              instructions: instructions.trim() || undefined,
            });
            setName("");
            setInstructions("");
            router.push(`/chat/${row.chatId}`);
            router.refresh();
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Could not create the agent.",
            );
          }
        });
      }}
    >
      <div className="text-sm font-medium">New agent</div>
      <Input
        maxLength={80}
        onChange={(event) => setName(event.target.value)}
        placeholder="Name"
        required
        value={name}
      />
      <Textarea
        className="min-h-20"
        maxLength={20_000}
        onChange={(event) => setInstructions(event.target.value)}
        placeholder="Standing instructions for this agent"
        value={instructions}
      />
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      <div>
        <Button disabled={pending || !name.trim()} size="sm" type="submit">
          {pending ? "Creating…" : "Create agent"}
        </Button>
      </div>
    </form>
  );
}
