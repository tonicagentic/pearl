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

// Image models are a second radio group — selecting one must not replace the
// chat model. Keys match agent/model-selection.ts.
export const IMAGE_MODEL_SECTION: ComposerModelSection = {
  id: "image",
  title: "Image",
  description: "Used by generate_image for pictorial graphics.",
  models: [
    { key: "gpt-image-1", label: "GPT Image 1", company: "OpenAI" },
    { key: "imagen-4", label: "Imagen 4", company: "Google" },
    { key: "grok-imagine", label: "Grok Imagine", company: "xAI" },
  ],
};

export const IMAGE_MODELS: readonly ComposerModel[] = IMAGE_MODEL_SECTION.models;

export const DEFAULT_IMAGE_MODEL_KEY = IMAGE_MODELS[0].key;

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

let selectedImageKey = DEFAULT_IMAGE_MODEL_KEY;
let imageSelectionRevision = 0;
let saveImageSelection: ((key: string) => Promise<void>) | undefined;
const imageListeners = new Set<() => void>();

export function configureImageModelSelectionPersistence(
  save: (key: string) => Promise<void>,
): void {
  saveImageSelection = save;
}

export async function restoreImageModelSelection(
  load: () => Promise<string | null>,
): Promise<void> {
  const revision = imageSelectionRevision;
  const saved = await load();
  if (
    revision !== imageSelectionRevision ||
    !saved ||
    !IMAGE_MODELS.some((model) => model.key === saved)
  ) {
    return;
  }
  if (selectedImageKey === saved) return;
  selectedImageKey = saved;
  for (const listener of imageListeners) listener();
}

export function getImageModelSelection(): string {
  return selectedImageKey;
}

export function setImageModelSelection(key: string): Promise<void> {
  if (!IMAGE_MODELS.some((model) => model.key === key)) {
    return Promise.resolve();
  }
  imageSelectionRevision++;
  if (key === selectedImageKey) {
    return saveImageSelection?.(key) ?? Promise.resolve();
  }
  selectedImageKey = key;
  for (const listener of imageListeners) listener();
  return saveImageSelection?.(key) ?? Promise.resolve();
}

export function subscribeImageModelSelection(
  listener: () => void,
): () => void {
  imageListeners.add(listener);
  return () => {
    imageListeners.delete(listener);
  };
}

/** Ephemeral clientContext markers for chat + image model pickers. */
export function modelClientContext(): Record<string, string> {
  return {
    eveModelSelection: getModelSelection(),
    eveImageModelSelection: getImageModelSelection(),
  };
}
