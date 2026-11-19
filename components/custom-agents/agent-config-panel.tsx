"use client";

import { useEffect, useState, useTransition } from "react";

import {
  addCustomAgentMemoryAction,
  deleteCustomAgentMemoryAction,
  deleteCustomAgentRoutineAction,
  deleteCustomAgentSkillAction,
  getCustomAgentConfigAction,
  setCustomAgentIntegrationsAction,
  upsertCustomAgentRoutineAction,
  upsertCustomAgentSkillAction,
} from "@/app/actions/custom-agent-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AGENT_INTEGRATION_IDS,
  AGENT_INTEGRATION_LABELS,
  type AgentIntegrationId,
} from "@/lib/custom-agents/integrations";
import type { CustomAgentConfigBundle } from "@/lib/custom-agents/template-types";
import { cn } from "@/lib/utils";

type Section = "memories" | "skills" | "routines" | "integrations" | null;

const SECTION_META: Record<
  Exclude<Section, null>,
  { readonly title: string; readonly subtitle: string }
> = {
  memories: { title: "Memories", subtitle: "Facts it already knows" },
  skills: { title: "Skills", subtitle: "Playbooks it can run" },
  routines: { title: "Routines", subtitle: "Jobs that run on their own" },
  integrations: { title: "Integrations", subtitle: "Apps it can use" },
};

export function AgentConfigPanel({
  agentId,
}: {
  readonly agentId: string;
}) {
  const [section, setSection] = useState<Section>(null);
  const [config, setConfig] = useState<CustomAgentConfigBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reload = () => {
    startTransition(async () => {
      try {
        const next = await getCustomAgentConfigAction(agentId);
        setConfig(next);
        setError(null);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Could not load config.",
        );
      }
    });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per agent
  }, [agentId]);

  const counts = {
    memories: config?.memories.length ?? 0,
    skills: config?.skills.length ?? 0,
    routines: config?.routines.length ?? 0,
    integrations: config?.integrations.length ?? 0,
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-medium">Configuration</div>
      {(Object.keys(SECTION_META) as Exclude<Section, null>[]).map((key) => {
        const meta = SECTION_META[key];
        const open = section === key;
        return (
          <div key={key} className="rounded-lg border bg-card">
            <button
              className={cn(
                "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left",
                open && "bg-muted/40",
              )}
              onClick={() => setSection(open ? null : key)}
              type="button"
            >
              <div>
                <div className="text-sm font-medium">{meta.title}</div>
                <div className="text-xs text-muted-foreground">
                  {meta.subtitle}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {counts[key]}
              </span>
            </button>
            {open && config ? (
              <div className="border-t px-3 py-3">
                {key === "memories" ? (
                  <MemoriesEditor
                    agentId={agentId}
                    memories={config.memories}
                    onChange={reload}
                    pending={pending}
                  />
                ) : null}
                {key === "skills" ? (
                  <SkillsEditor
                    agentId={agentId}
                    skills={config.skills}
                    onChange={reload}
                    pending={pending}
                  />
                ) : null}
                {key === "routines" ? (
                  <RoutinesEditor
                    agentId={agentId}
                    routines={config.routines}
                    onChange={reload}
                    pending={pending}
                  />
                ) : null}
                {key === "integrations" ? (
                  <IntegrationsEditor
                    agentId={agentId}
                    selected={config.integrations.map((row) => row.connectionId)}
                    onChange={reload}
                    pending={pending}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function MemoriesEditor({
  agentId,
  memories,
  onChange,
  pending,
}: {
  readonly agentId: string;
  readonly memories: CustomAgentConfigBundle["memories"];
  readonly onChange: () => void;
  readonly pending: boolean;
}) {
  const [text, setText] = useState("");
  const [busy, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1.5">
        {memories.length === 0 ? (
          <li className="text-xs text-muted-foreground">No facts yet.</li>
        ) : (
          memories.map((row) => (
            <li
              key={row.id}
              className="flex items-start justify-between gap-2 text-sm"
            >
              <span>{row.text}</span>
              <Button
                disabled={busy || pending}
                onClick={() => {
                  startTransition(async () => {
                    await deleteCustomAgentMemoryAction({
                      agentId,
                      memoryId: row.id,
                    });
                    onChange();
                  });
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                Remove
              </Button>
            </li>
          ))
        )}
      </ul>
      <div className="flex gap-2">
        <Input
          onChange={(event) => setText(event.target.value)}
          placeholder="Add a fact"
          value={text}
        />
        <Button
          disabled={busy || pending || !text.trim()}
          onClick={() => {
            startTransition(async () => {
              await addCustomAgentMemoryAction({ agentId, text });
              setText("");
              onChange();
            });
          }}
          size="sm"
          type="button"
        >
          Add
        </Button>
      </div>
    </div>
  );
}

function SkillsEditor({
  agentId,
  skills,
  onChange,
  pending,
}: {
  readonly agentId: string;
  readonly skills: CustomAgentConfigBundle["skills"];
  readonly onChange: () => void;
  readonly pending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [busy, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {skills.length === 0 ? (
          <li className="text-xs text-muted-foreground">No skills yet.</li>
        ) : (
          skills.map((row) => (
            <li key={row.id} className="rounded border px-2 py-1.5 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{row.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.description}
                  </div>
                </div>
                <Button
                  disabled={busy || pending}
                  onClick={() => {
                    startTransition(async () => {
                      await deleteCustomAgentSkillAction({
                        agentId,
                        skillId: row.id,
                      });
                      onChange();
                    });
                  }}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Remove
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>
      <Input
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Skill title"
        value={title}
      />
      <Input
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Short description"
        value={description}
      />
      <Textarea
        className="min-h-20"
        onChange={(event) => setMarkdown(event.target.value)}
        placeholder="Playbook markdown"
        value={markdown}
      />
      <Button
        disabled={
          busy || pending || !title.trim() || !description.trim() || !markdown.trim()
        }
        onClick={() => {
          startTransition(async () => {
            await upsertCustomAgentSkillAction({
              agentId,
              slug: title,
              title,
              description,
              markdown,
            });
            setTitle("");
            setDescription("");
            setMarkdown("");
            onChange();
          });
        }}
        size="sm"
        type="button"
      >
        Add skill
      </Button>
    </div>
  );
}

function RoutinesEditor({
  agentId,
  routines,
  onChange,
  pending,
}: {
  readonly agentId: string;
  readonly routines: CustomAgentConfigBundle["routines"];
  readonly onChange: () => void;
  readonly pending: boolean;
}) {
  const [name, setName] = useState("");
  const [cron, setCron] = useState("0 9 * * 1-5");
  const [prompt, setPrompt] = useState("");
  const [busy, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {routines.length === 0 ? (
          <li className="text-xs text-muted-foreground">No routines yet.</li>
        ) : (
          routines.map((row) => (
            <li key={row.id} className="rounded border px-2 py-1.5 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{row.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.cron} · {row.timezone}
                  </div>
                </div>
                <Button
                  disabled={busy || pending}
                  onClick={() => {
                    startTransition(async () => {
                      await deleteCustomAgentRoutineAction({
                        agentId,
                        routineId: row.id,
                      });
                      onChange();
                    });
                  }}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Remove
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>
      <Input
        onChange={(event) => setName(event.target.value)}
        placeholder="Routine name"
        value={name}
      />
      <Input
        onChange={(event) => setCron(event.target.value)}
        placeholder="Cron (5 fields)"
        value={cron}
      />
      <Textarea
        className="min-h-16"
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Prompt when it runs"
        value={prompt}
      />
      <Button
        disabled={busy || pending || !name.trim() || !cron.trim() || !prompt.trim()}
        onClick={() => {
          startTransition(async () => {
            await upsertCustomAgentRoutineAction({
              agentId,
              name,
              cron,
              prompt,
            });
            setName("");
            setPrompt("");
            onChange();
          });
        }}
        size="sm"
        type="button"
      >
        Add routine
      </Button>
    </div>
  );
}

function IntegrationsEditor({
  agentId,
  selected,
  onChange,
  pending,
}: {
  readonly agentId: string;
  readonly selected: readonly AgentIntegrationId[];
  readonly onChange: () => void;
  readonly pending: boolean;
}) {
  const [local, setLocal] = useState<readonly AgentIntegrationId[]>(selected);
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    setLocal(selected);
  }, [selected]);

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1">
        {AGENT_INTEGRATION_IDS.map((id) => {
          const checked = local.includes(id);
          return (
            <li key={id}>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  checked={checked}
                  onChange={() => {
                    setLocal((current) =>
                      checked
                        ? current.filter((row) => row !== id)
                        : [...current, id],
                    );
                  }}
                  type="checkbox"
                />
                {AGENT_INTEGRATION_LABELS[id]}
              </label>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        Connect apps under Settings. This list only decides which ones this
        agent may use.
      </p>
      <Button
        disabled={busy || pending}
        onClick={() => {
          startTransition(async () => {
            await setCustomAgentIntegrationsAction({
              agentId,
              connectionIds: local,
            });
            onChange();
          });
        }}
        size="sm"
        type="button"
      >
        Save apps
      </Button>
    </div>
  );
}
