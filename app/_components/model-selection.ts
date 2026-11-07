"use client";

// Client-side store for the composer model picker.
//
// The assistant-ui docs' modelContext runtime API (aui.modelContext.register /
// useAuiState((s) => s.modelContext.modelName)) is not available in the
// installed @assistant-ui/react 0.15.19, so the selection travels through this
// small external store instead: the picker (model-picker.tsx) renders and sets
// it, and prepareSend (assistant-chat.tsx) reads it at send time and attaches
// the value as ephemeral clientContext, which the agent's step.started model
// resolver parses (agent/model-selection.ts).

export interface ComposerModel {
  /** Picker key sent to the agent; validated against agent-side allowlist. */
  key: string;
  label: string;
  /** Shown under the label as “by {company}”. */
  company: string;
  /** When true, the picker shows an Open Weight tag. */
  openWeight?: boolean;
}

export interface ComposerModelSection {
  id: string;
  title: string;
  description?: string;
  models: readonly ComposerModel[];
}

export const COMPOSER_MODEL_SECTIONS: readonly ComposerModelSection[] = [
  {
    id: "daily-driver",
    title: "Daily Driver",
    models: [
      { key: "gpt-6.1-sol", label: "GPT 6.1 Sol", company: "OpenAI" },
      {
        key: "glm-5.3-flash",
        label: "GLM 5.3 Flash",
        company: "Z.ai",
        openWeight: true,
      },
      {
        key: "muse-spark-open",
        label: "Muse Spark Open",
        company: "Meta",
        openWeight: true,
      },
      { key: "grok-4.7", label: "Grok 4.7", company: "xAI" },
    ],
  },
  {
    id: "frontier",
    title: "Frontier",
    description:
      "Frontier coding, long-running agents, and advanced computer use.",
    models: [
      { key: "gpt-6-astra", label: "GPT 6 Astra", company: "OpenAI" },
      { key: "gemini-4-argon", label: "Gemini 4 Argon", company: "Google" },
      { key: "muse-wonder-1.0", label: "Muse Wonder 1.0", company: "Meta" },
    ],
  },
];

export const COMPOSER_MODELS: readonly ComposerModel[] =
  COMPOSER_MODEL_SECTIONS.flatMap((section) => section.models);

export const DEFAULT_MODEL_KEY = COMPOSER_MODELS[0].key;

let selectedKey = DEFAULT_MODEL_KEY;
const listeners = new Set<() => void>();

export function getModelSelection(): string {
  return selectedKey;
}

export function setModelSelection(key: string): void {
  if (!COMPOSER_MODELS.some((model) => model.key === key)) return;
  if (key === selectedKey) return;
  selectedKey = key;
  for (const listener of listeners) listener();
}

export function subscribeModelSelection(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
