// Client-side store for the composer model picker (mobile mirror of
// app/_components/model-selection.ts).
//
// The selection travels through this small external store: the picker renders
// and sets it, and the chat screen reads it at send time, attaching it as
// ephemeral clientContext ({ eveModelSelection: "<key>" }), which the agent's
// step.started model resolver parses (agent/model-selection.ts). Values are
// picker keys, not gateway ids — the agent-side allowlist is the only path
// from a client-supplied string to a model id.

export interface ComposerModel {
  /** Picker key sent to the agent; validated against agent-side allowlist. */
  key: string;
  label: string;
}

export const COMPOSER_MODELS: readonly ComposerModel[] = [
  { key: "glm-5.3-flash", label: "GLM 5.3 Flash" },
  { key: "gpt-6-sol", label: "GPT 6 Sol" },
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
