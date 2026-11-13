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
    id: "auto",
    title: "Auto",
    description:
      "Routes each turn for speed and cost: Sol for chat, specialists for tools and documents.",
    models: [{ key: "auto", label: "Auto", company: "Pearl" }],
  },
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
// chat model that writes replies. Keys match agent/model-selection.ts.
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

// Vector models are a third radio group for generate_svg. Keys match
// agent/model-selection.ts. Selecting one must not replace chat or image.
export const VECTOR_MODEL_SECTION: ComposerModelSection = {
  id: "vector",
  title: "Vector",
  description: "Used by generate_svg for logos, icons, and vector art.",
  models: [
    { key: "arrow-2", label: "Arrow 2", company: "QuiverAI" },
    { key: "arrow-2-telos", label: "Arrow 2 Telos", company: "QuiverAI" },
  ],
};

export const VECTOR_MODELS: readonly ComposerModel[] =
  VECTOR_MODEL_SECTION.models;

export const DEFAULT_VECTOR_MODEL_KEY = VECTOR_MODELS[0].key;

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

let selectedImageKey = DEFAULT_IMAGE_MODEL_KEY;
const imageListeners = new Set<() => void>();

export function getImageModelSelection(): string {
  return selectedImageKey;
}

export function setImageModelSelection(key: string): void {
  if (!IMAGE_MODELS.some((model) => model.key === key)) return;
  if (key === selectedImageKey) return;
  selectedImageKey = key;
  for (const listener of imageListeners) listener();
}

export function subscribeImageModelSelection(
  listener: () => void,
): () => void {
  imageListeners.add(listener);
  return () => {
    imageListeners.delete(listener);
  };
}

let selectedVectorKey = DEFAULT_VECTOR_MODEL_KEY;
const vectorListeners = new Set<() => void>();

export function getVectorModelSelection(): string {
  return selectedVectorKey;
}

export function setVectorModelSelection(key: string): void {
  if (!VECTOR_MODELS.some((model) => model.key === key)) return;
  if (key === selectedVectorKey) return;
  selectedVectorKey = key;
  for (const listener of vectorListeners) listener();
}

export function subscribeVectorModelSelection(
  listener: () => void,
): () => void {
  vectorListeners.add(listener);
  return () => {
    vectorListeners.delete(listener);
  };
}
