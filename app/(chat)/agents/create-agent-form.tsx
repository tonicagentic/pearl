"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createCustomAgentAction } from "@/app/actions/custom-agents";
import { AgentMarkPicker } from "@/components/custom-agents/agent-mark-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_AGENT_MARK_ACCENT,
  DEFAULT_AGENT_MARK_BROWS,
  DEFAULT_AGENT_MARK_GAZE,
  DEFAULT_AGENT_MARK_SHAPE,
  DEFAULT_AGENT_MARK_TALK,
  type AgentMarkBrows,
  type AgentMarkGaze,
  type AgentMarkShape,
  type AgentMarkTalk,
} from "@/lib/custom-agents/mark";

export function CreateAgentForm({
  projects,
  defaultProjectId = null,
}: {
  readonly projects: readonly { readonly id: string; readonly name: string }[];
  readonly defaultProjectId?: string | null;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(
    defaultProjectId ?? projects[0]?.id ?? "",
  );
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [accent, setAccent] = useState<string>(DEFAULT_AGENT_MARK_ACCENT);
  const [markShape, setMarkShape] = useState<AgentMarkShape>(
    DEFAULT_AGENT_MARK_SHAPE,
  );
  const [markTalk, setMarkTalk] = useState<AgentMarkTalk>(
    DEFAULT_AGENT_MARK_TALK,
  );
  const [markBrows, setMarkBrows] = useState<AgentMarkBrows>(
    DEFAULT_AGENT_MARK_BROWS,
  );
  const [markGaze, setMarkGaze] = useState<AgentMarkGaze>(
    DEFAULT_AGENT_MARK_GAZE,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (projects.length === 0) {
    return (
      <p className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
        Create a project first — it comes with a manager. Then you can add more
        agents here.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border bg-card p-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            const row = await createCustomAgentAction({
              projectId,
              name,
              instructions: instructions.trim() || undefined,
              accent,
              markShape,
              markTalk,
              markBrows,
              markGaze,
            });
            setName("");
            setInstructions("");
            setAccent(DEFAULT_AGENT_MARK_ACCENT);
            setMarkShape(DEFAULT_AGENT_MARK_SHAPE);
            setMarkTalk(DEFAULT_AGENT_MARK_TALK);
            setMarkBrows(DEFAULT_AGENT_MARK_BROWS);
            setMarkGaze(DEFAULT_AGENT_MARK_GAZE);
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
      {!defaultProjectId ? (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Project</span>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            onChange={(event) => setProjectId(event.target.value)}
            required
            value={projectId}
          >
            {projects.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <AgentMarkPicker
        accent={accent}
        markShape={markShape}
        markTalk={markTalk}
        markBrows={markBrows}
        markGaze={markGaze}
        onAccentChange={setAccent}
        onMarkShapeChange={setMarkShape}
        onMarkTalkChange={setMarkTalk}
        onMarkBrowsChange={setMarkBrows}
        onMarkGazeChange={setMarkGaze}
      />
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
        <Button
          disabled={pending || !name.trim() || !projectId}
          size="sm"
          type="submit"
        >
          {pending ? "Creating…" : "Create agent"}
        </Button>
      </div>
    </form>
  );
}
