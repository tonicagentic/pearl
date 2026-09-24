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
  meta: string;
}

export const COMPOSER_MODELS: readonly ComposerModel[] = [
  { key: "glm-5.3-flash", label: "GLM 5.3 Flash", meta: "Default" },
  { key: "gpt-6-sol", label: "GPT 6 Sol", meta: "$2/$10 per 1M tokens" },
];

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