import { generateSpeech } from "ai";

const MAX_CHARS = 280;

function aiConfigured(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim() ||
      process.env.VERCEL === "1",
  );
}

/** Map BCP-47 / ISO tags to a short language name for TTS instructions. */
export function languageLabel(lang: string | null | undefined): string | null {
  if (!lang) return null;
  const primary = lang.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  const names: Record<string, string> = {
    it: "Italian",
    ja: "Japanese",
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    pt: "Portuguese",
    zh: "Chinese",
    ko: "Korean",
    hi: "Hindi",
    ar: "Arabic",
  };
  return names[primary] ?? null;
}

function speechInstructions(lang: string | null | undefined): string {
  const label = languageLabel(lang);
  if (label) {
    return `Speak as a clear native ${label} speaker. Natural conversational pacing; accurate pronunciation; no theatrical flair.`;
  }
  return "Speak clearly and naturally with accurate pronunciation.";
}

export type GeneratedSpeech = {
  readonly bytes: Uint8Array;
  readonly mediaType: string;
  readonly modelId: string;
};

/**
 * Generate spoken audio via the AI SDK + AI Gateway.
 * Prefers gpt-4o-mini-tts for instruction-following multilingual speech.
 */
export async function generatePronunciationSpeech(options: {
  text: string;
  lang?: string | null;
  signal?: AbortSignal;
}): Promise<GeneratedSpeech> {
  if (!aiConfigured()) {
    throw new Error("AI Gateway is not configured for speech.");
  }
  const text = options.text.trim();
  if (!text) {
    throw new Error("Text is required.");
  }
  if (text.length > MAX_CHARS) {
    throw new Error(`Text must be ${MAX_CHARS} characters or fewer.`);
  }

  const language = options.lang?.trim()
    ? options.lang.trim().split(/[-_]/)[0]?.toLowerCase()
    : undefined;

  const result = await generateSpeech({
    model: "openai/gpt-4o-mini-tts",
    text,
    voice: "alloy",
    outputFormat: "mp3",
    language: language || undefined,
    instructions: speechInstructions(options.lang),
    abortSignal: options.signal,
  });

  return {
    bytes: result.audio.uint8Array,
    mediaType: result.audio.mediaType || "audio/mpeg",
    modelId: "openai/gpt-4o-mini-tts",
  };
}

export { MAX_CHARS as SPEECH_MAX_CHARS };
