/** Playback helpers for Pronounce / Phrase cards. */

function isPlayableUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" ||
      parsed.protocol === "http:" ||
      parsed.protocol === "blob:" ||
      parsed.protocol === "data:"
    );
  } catch {
    return false;
  }
}

type SpeechSynthesisLike = {
  cancel: () => void;
  speak: (utterance: SpeechSynthesisUtterance) => void;
};

function getSpeechSynthesis(): SpeechSynthesisLike | null {
  if (typeof globalThis === "undefined") return null;
  const synth = (globalThis as { speechSynthesis?: SpeechSynthesisLike })
    .speechSynthesis;
  return synth ?? null;
}

/** Play an audio URL (https / blob / data) via the DOM Audio API when present. */
export async function playAudioUrl(url: string): Promise<boolean> {
  if (!isPlayableUrl(url)) return false;
  const AudioCtor = (globalThis as { Audio?: typeof Audio }).Audio;
  if (!AudioCtor) return false;
  const audio = new AudioCtor(url);
  await audio.play();
  return true;
}

/** Speak text via the Web Speech API when available (fallback). */
export function speakText(
  text: string,
  lang?: string | null,
): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const synth = getSpeechSynthesis();
  if (!synth) return false;
  const Utterance = (
    globalThis as { SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance }
  ).SpeechSynthesisUtterance;
  if (!Utterance) return false;
  synth.cancel();
  const utterance = new Utterance(trimmed);
  if (lang && lang.trim()) utterance.lang = lang.trim();
  synth.speak(utterance);
  return true;
}

const aiSpeechCache = new Map<string, string>();

export type FetchAiSpeechOptions = {
  text: string;
  lang?: string | null;
  /** Absolute or relative speech endpoint. */
  endpoint: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

/** Request AI SDK speech audio and return a playable object/data URL. */
export async function fetchAiSpeechUrl(
  options: FetchAiSpeechOptions,
): Promise<string | null> {
  const text = options.text.trim();
  if (!text) return null;
  const cacheKey = `${options.endpoint}|${options.lang ?? ""}|${text}`;
  const cached = aiSpeechCache.get(cacheKey);
  if (cached) return cached;

  const response = await fetch(options.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "audio/mpeg, application/json",
      ...options.headers,
    },
    body: JSON.stringify({
      text,
      lang: options.lang ?? null,
    }),
    credentials: "include",
    signal: options.signal,
  });
  if (!response.ok) return null;

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return null;

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0) return null;

  const BlobCtor = (globalThis as { Blob?: typeof Blob }).Blob;
  const urlApi = (globalThis as { URL?: typeof URL }).URL;
  if (BlobCtor && urlApi?.createObjectURL) {
    const blob = new BlobCtor([buffer], {
      type: contentType || "audio/mpeg",
    });
    const objectUrl = urlApi.createObjectURL(blob);
    aiSpeechCache.set(cacheKey, objectUrl);
    return objectUrl;
  }

  // RN / environments without Blob URL support: data URL.
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const btoaFn = (globalThis as { btoa?: (data: string) => string }).btoa;
  if (!btoaFn) return null;
  const dataUrl = `data:${contentType || "audio/mpeg"};base64,${btoaFn(binary)}`;
  aiSpeechCache.set(cacheKey, dataUrl);
  return dataUrl;
}

/**
 * Prefer an explicit https clip, then AI speech, then browser TTS.
 * Returns whether playback was started.
 */
export async function playSpeakable(options: {
  text: string;
  lang?: string | null;
  audioUrl?: string | null;
  aiSpeech?: FetchAiSpeechOptions | null;
}): Promise<boolean> {
  const audioUrl =
    typeof options.audioUrl === "string" && isPlayableUrl(options.audioUrl)
      ? options.audioUrl
      : null;
  if (audioUrl) {
    try {
      if (await playAudioUrl(audioUrl)) return true;
    } catch {
      // Fall through.
    }
  }

  if (options.aiSpeech) {
    try {
      const url = await fetchAiSpeechUrl(options.aiSpeech);
      if (url && (await playAudioUrl(url))) return true;
    } catch {
      // Fall through to browser TTS.
    }
  }

  return speakText(options.text, options.lang);
}
