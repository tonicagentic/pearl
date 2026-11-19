import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Text, textVariants } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import {
  AGENT_INTEGRATION_IDS,
  AGENT_INTEGRATION_LABELS,
  type AgentIntegrationId,
} from "../../../lib/custom-agents/integrations";
import type { CustomAgentConfigBundle } from "../../../lib/custom-agents/template-types";
import {
  addCustomAgentMemoryRequest,
  deleteCustomAgentMemoryRequest,
  deleteCustomAgentRoutineRequest,
  deleteCustomAgentSkillRequest,
  fetchCustomAgentConfig,
  setCustomAgentIntegrationsRequest,
  upsertCustomAgentRoutineRequest,
  upsertCustomAgentSkillRequest,
} from "@/src/agent-templates-client";

type Section = "memories" | "skills" | "routines" | "integrations" | null;

const META: Record<
  Exclude<Section, null>,
  { readonly title: string; readonly subtitle: string }
> = {
  memories: { title: "Memories", subtitle: "Facts it already knows" },
  skills: { title: "Skills", subtitle: "Playbooks it can run" },
  routines: { title: "Routines", subtitle: "Jobs that run on their own" },
  integrations: { title: "Integrations", subtitle: "Apps it can use" },
};

/** Compact four-section config for the agent settings sheet. */
export function AgentConfigSections({
  agentId,
}: {
  readonly agentId: string;
}) {
  const [section, setSection] = useState<Section>(null);
  const [config, setConfig] = useState<CustomAgentConfigBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const reload = () => {
    void fetchCustomAgentConfig(agentId)
      .then((next) => {
        setConfig(next);
        setError(null);
      })
      .catch((cause) => {
        setError(
          cause instanceof Error ? cause.message : "Could not load config.",
        );
      });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const counts = {
    memories: config?.memories.length ?? 0,
    skills: config?.skills.length ?? 0,
    routines: config?.routines.length ?? 0,
    integrations: config?.integrations.length ?? 0,
  };

  return (
    <View className="mt-4 gap-2">
      <Text variant="label" weight="semibold">
        Configuration
      </Text>
      {(Object.keys(META) as Exclude<Section, null>[]).map((key) => {
        const open = section === key;
        return (
          <View key={key} className="overflow-hidden rounded-xl border border-border">
            <Pressable
              className={cn(
                "flex-row items-center justify-between px-3 py-2.5 active:opacity-80",
                open && "bg-muted/40",
              )}
              onPress={() => setSection(open ? null : key)}
            >
              <View className="min-w-0 flex-1">
                <Text variant="label">{META[key].title}</Text>
                <Text variant="secondary" tone="muted">
                  {META[key].subtitle}
                </Text>
              </View>
              <Text variant="secondary" tone="muted">
                {counts[key]}
              </Text>
            </Pressable>
            {open ? (
              <View className="border-t border-border px-3 py-3">
                {!config ? (
                  <ActivityIndicator />
                ) : key === "memories" ? (
                  <Memories
                    agentId={agentId}
                    memories={config.memories}
                    onChange={reload}
                    placeholderColor={placeholderColor}
                  />
                ) : key === "skills" ? (
                  <Skills
                    agentId={agentId}
                    skills={config.skills}
                    onChange={reload}
                    placeholderColor={placeholderColor}
                  />
                ) : key === "routines" ? (
                  <Routines
                    agentId={agentId}
                    routines={config.routines}
                    onChange={reload}
                    placeholderColor={placeholderColor}
                  />
                ) : (
                  <Integrations
                    agentId={agentId}
                    selected={config.integrations.map((row) => row.connectionId)}
                    onChange={reload}
                  />
                )}
              </View>
            ) : null}
          </View>
        );
      })}
      {error ? (
        <Text variant="secondary" tone="destructive">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function Memories({
  agentId,
  memories,
  onChange,
  placeholderColor,
}: {
  readonly agentId: string;
  readonly memories: CustomAgentConfigBundle["memories"];
  readonly onChange: () => void;
  readonly placeholderColor?: string;
}) {
  const [text, setText] = useState("");
  return (
    <View className="gap-2">
      {memories.map((row) => (
        <View key={row.id} className="flex-row items-start gap-2">
          <Text variant="body" className="flex-1">
            {row.text}
          </Text>
          <Pressable
            onPress={() => {
              void deleteCustomAgentMemoryRequest(agentId, row.id).then(onChange);
            }}
          >
            <Text variant="secondary" tone="muted">
              Remove
            </Text>
          </Pressable>
        </View>
      ))}
      <TextInput
        className={cn("min-h-10", textVariants({ variant: "body" }))}
        onChangeText={setText}
        placeholder="Add a fact"
        placeholderTextColor={placeholderColor}
        value={text}
      />
      <Pressable
        disabled={!text.trim()}
        onPress={() => {
          void addCustomAgentMemoryRequest(agentId, text).then(() => {
            setText("");
            onChange();
          });
        }}
      >
        <Text variant="label" weight="semibold">
          Add
        </Text>
      </Pressable>
    </View>
  );
}

function Skills({
  agentId,
  skills,
  onChange,
  placeholderColor,
}: {
  readonly agentId: string;
  readonly skills: CustomAgentConfigBundle["skills"];
  readonly onChange: () => void;
  readonly placeholderColor?: string;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [markdown, setMarkdown] = useState("");
  return (
    <View className="gap-2">
      {skills.map((row) => (
        <View key={row.id} className="gap-1">
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1">
              <Text variant="label">{row.title}</Text>
              <Text variant="secondary" tone="muted">
                {row.description}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                void deleteCustomAgentSkillRequest(agentId, row.id).then(onChange);
              }}
            >
              <Text variant="secondary" tone="muted">
                Remove
              </Text>
            </Pressable>
          </View>
        </View>
      ))}
      <TextInput
        className={textVariants({ variant: "body" })}
        onChangeText={setTitle}
        placeholder="Skill title"
        placeholderTextColor={placeholderColor}
        value={title}
      />
      <TextInput
        className={textVariants({ variant: "body" })}
        onChangeText={setDescription}
        placeholder="Short description"
        placeholderTextColor={placeholderColor}
        value={description}
      />
      <TextInput
        className={cn("min-h-20", textVariants({ variant: "body" }))}
        multiline
        onChangeText={setMarkdown}
        placeholder="Playbook markdown"
        placeholderTextColor={placeholderColor}
        value={markdown}
      />
      <Pressable
        disabled={!title.trim() || !description.trim() || !markdown.trim()}
        onPress={() => {
          void upsertCustomAgentSkillRequest(agentId, {
            slug: title,
            title,
            description,
            markdown,
          }).then(() => {
            setTitle("");
            setDescription("");
            setMarkdown("");
            onChange();
          });
        }}
      >
        <Text variant="label" weight="semibold">
          Add skill
        </Text>
      </Pressable>
    </View>
  );
}

function Routines({
  agentId,
  routines,
  onChange,
  placeholderColor,
}: {
  readonly agentId: string;
  readonly routines: CustomAgentConfigBundle["routines"];
  readonly onChange: () => void;
  readonly placeholderColor?: string;
}) {
  const [name, setName] = useState("");
  const [cron, setCron] = useState("0 9 * * 1-5");
  const [prompt, setPrompt] = useState("");
  return (
    <View className="gap-2">
      {routines.map((row) => (
        <View key={row.id} className="gap-1">
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1">
              <Text variant="label">{row.name}</Text>
              <Text variant="secondary" tone="muted">
                {row.cron}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                void deleteCustomAgentRoutineRequest(agentId, row.id).then(
                  onChange,
                );
              }}
            >
              <Text variant="secondary" tone="muted">
                Remove
              </Text>
            </Pressable>
          </View>
        </View>
      ))}
      <TextInput
        className={textVariants({ variant: "body" })}
        onChangeText={setName}
        placeholder="Routine name"
        placeholderTextColor={placeholderColor}
        value={name}
      />
      <TextInput
        className={textVariants({ variant: "body" })}
        onChangeText={setCron}
        placeholder="Cron"
        placeholderTextColor={placeholderColor}
        value={cron}
      />
      <TextInput
        className={cn("min-h-16", textVariants({ variant: "body" }))}
        multiline
        onChangeText={setPrompt}
        placeholder="Prompt"
        placeholderTextColor={placeholderColor}
        value={prompt}
      />
      <Pressable
        disabled={!name.trim() || !cron.trim() || !prompt.trim()}
        onPress={() => {
          void upsertCustomAgentRoutineRequest(agentId, {
            name,
            cron,
            prompt,
          }).then(() => {
            setName("");
            setPrompt("");
            onChange();
          });
        }}
      >
        <Text variant="label" weight="semibold">
          Add routine
        </Text>
      </Pressable>
    </View>
  );
}

function Integrations({
  agentId,
  selected,
  onChange,
}: {
  readonly agentId: string;
  readonly selected: readonly AgentIntegrationId[];
  readonly onChange: () => void;
}) {
  const [local, setLocal] = useState(selected);
  useEffect(() => {
    setLocal(selected);
  }, [selected]);

  return (
    <View className="gap-2">
      {AGENT_INTEGRATION_IDS.map((id) => {
        const checked = local.includes(id);
        return (
          <Pressable
            key={id}
            className="flex-row items-center gap-2"
            onPress={() => {
              setLocal((current) =>
                checked
                  ? current.filter((row) => row !== id)
                  : [...current, id],
              );
            }}
          >
            <Text variant="body">{checked ? "☑" : "☐"}</Text>
            <Text variant="body">{AGENT_INTEGRATION_LABELS[id]}</Text>
          </Pressable>
        );
      })}
      <Pressable
        onPress={() => {
          void setCustomAgentIntegrationsRequest(agentId, local).then(onChange);
        }}
      >
        <Text variant="label" weight="semibold">
          Save apps
        </Text>
      </Pressable>
    </View>
  );
}
