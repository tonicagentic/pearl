"use client";

import { useEffect, useState, useTransition } from "react";

import { updateCustomAgentAction } from "@/app/actions/custom-agents";
import { AgentMarkPicker } from "@/components/custom-agents/agent-mark-picker";
import { useActiveCustomAgent } from "@/components/custom-agents/active-custom-agent-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_AGENT_MARK_ACCENT,
  DEFAULT_AGENT_MARK_SHAPE,
  DEFAULT_AGENT_MARK_TALK,
  type AgentMarkShape,
  type AgentMarkTalk,
} from "@/lib/custom-agents/mark";

export function AgentSettingsDialog({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const { agent, updateAgent } = useActiveCustomAgent();
  const [name, setName] = useState(agent?.name ?? "");
  const [instructions, setInstructions] = useState(agent?.instructions ?? "");
  const [accent, setAccent] = useState(
    agent?.accent ?? DEFAULT_AGENT_MARK_ACCENT,
  );
  const [markShape, setMarkShape] = useState<AgentMarkShape>(
    agent?.markShape ?? DEFAULT_AGENT_MARK_SHAPE,
  );
  const [markTalk, setMarkTalk] = useState<AgentMarkTalk>(
    agent?.markTalk ?? DEFAULT_AGENT_MARK_TALK,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !agent) return;
    setName(agent.name);
    setInstructions(agent.instructions);
    setAccent(agent.accent || DEFAULT_AGENT_MARK_ACCENT);
    setMarkShape(agent.markShape ?? DEFAULT_AGENT_MARK_SHAPE);
    setMarkTalk(agent.markTalk ?? DEFAULT_AGENT_MARK_TALK);
    setError(null);
  }, [open, agent]);

  if (!agent) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agent settings</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            startTransition(async () => {
              try {
                const row = await updateCustomAgentAction({
                  agentId: agent.id,
                  name,
                  instructions,
                  accent,
                  markShape,
                  markTalk,
                });
                updateAgent({
                  name: row.name,
                  instructions: row.instructions,
                  accent: row.accent,
                  markShape: row.markShape,
                  markTalk: row.markTalk,
                });
                onOpenChange(false);
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Could not save agent settings.",
                );
              }
            });
          }}
        >
          <AgentMarkPicker
            accent={accent}
            markShape={markShape}
            markTalk={markTalk}
            onAccentChange={setAccent}
            onMarkShapeChange={setMarkShape}
            onMarkTalkChange={setMarkTalk}
          />
          <Input
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            required
            value={name}
          />
          <Textarea
            className="min-h-28"
            maxLength={20_000}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Standing instructions"
            value={instructions}
          />
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button disabled={pending || !name.trim()} type="submit">
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
