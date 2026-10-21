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
  { key: "gpt-6.1-sol", label: "GPT 6.1 Sol" },
  { key: "glm-5.3-flash", label: "GLM 5.3 Flash" },
  { key: "muse-spark-open", label: "Muse Spark Open" },
  { key: "grok-4.7", label: "Grok 4.7" },
];

export const DEFAULT_MODEL_KEY = COMPOSER_MODELS[0].key;

let selectedKey = DEFAULT_MODEL_KEY;
let selectionRevision = 0;
let saveSelection: ((key: string) => Promise<void>) | undefined;
const listeners = new Set<() => void>();

export function configureModelSelectionPersistence(save: (key: string) => Promise<void>): void {
  saveSelection = save;
}

export async function restoreModelSelection(load: () => Promise<string | null>): Promise<void> {
  const revision = selectionRevision;
  const saved = await load();
  // A user's in-flight choice always wins over a slower storage read.
  if (revision !== selectionRevision || !saved || !COMPOSER_MODELS.some((model) => model.key === saved)) return;
  if (selectedKey === saved) return;
  selectedKey = saved;
  for (const listener of listeners) listener();
}

export function getModelSelection(): string {
  return selectedKey;
}

export function setModelSelection(key: string): Promise<void> {
  if (!COMPOSER_MODELS.some((model) => model.key === key)) return Promise.resolve();
  selectionRevision++;
  if (key === selectedKey) return saveSelection?.(key) ?? Promise.resolve();
  selectedKey = key;
  for (const listener of listeners) listener();
  return saveSelection?.(key) ?? Promise.resolve();
}

export function subscribeModelSelection(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
