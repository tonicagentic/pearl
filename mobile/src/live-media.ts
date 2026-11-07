// Pure helpers for the mobile live session. The Gateway socket speaks the
// normalized AI SDK realtime events; this file does not open that socket.

/** Wire rate for gateway realtime PCM (input-audio-append / playback). */
export const LIVE_SAMPLE_RATE = 24_000;
/**
 * Mic capture rate for expo-audio's AudioStream. Physical iOS devices can
 * abort in installTap when the preferred rate is 24 kHz (expo's own guidance
 * lists 48000 / 44100 / 16000). Capture at 48 kHz and resample to the wire rate.
 */
export const LIVE_CAPTURE_SAMPLE_RATE = 48_000;
/** Brief pause after audio-session / permission setup before AudioStream.start. */
export const LIVE_MIC_SETTLE_MS = 200;
export const LIVE_FRAME_MAX_BYTES = 200 * 1024;
export const LIVE_MAX_SESSION_MS = 25 * 60 * 1000;
/** 200 ms of 16-bit mono audio. Short enough to start playback, long enough to hear. */
export const LIVE_PLAYBACK_CHUNK_BYTES = Math.floor(LIVE_SAMPLE_RATE * 2 * 0.2);

export const LIVE_SOCKET_PROTOCOL = "ai-gateway-realtime.v1";
export const LIVE_AUTH_PROTOCOL_PREFIX = "ai-gateway-auth.";

/**
 * Client session-update payload. Gateway data-policy flags (ZDR, no-training,
 * inferenceRegion) must be pinned when minting the client secret — see
 * lib/live-token.ts — not sent here.
 */
export const LIVE_SESSION_CONFIG = {
  instructions:
    "You are Pearl, a personal agent in a live voice conversation. On the first response, greet the user in one short spoken sentence and invite them to talk. After that, answer out loud and briefly. If the user shares a camera frame, say what you see; otherwise stay on the voice conversation.",
  voice: "alloy",
  outputModalities: ["audio"],
  inputAudioTranscription: {},
  outputAudioTranscription: {},
  inputAudioFormat: { type: "audio/pcm", rate: LIVE_SAMPLE_RATE },
  outputAudioFormat: { type: "audio/pcm", rate: LIVE_SAMPLE_RATE },
  turnDetection: { type: "server-vad" },
} as const;

/** Peak amplitude 0..1 from little-endian PCM16 mono bytes. */
export function pcm16PeakLevel(pcm: Uint8Array): number {
  const even = pcm.byteLength - (pcm.byteLength % 2);
  if (even < 2) return 0;
  const view = new DataView(pcm.buffer, pcm.byteOffset, even);
  let peak = 0;
  for (let i = 0; i < even; i += 2) {
    const sample = Math.abs(view.getInt16(i, true)) / 0x8000;
    if (sample > peak) peak = sample;
  }
  return Math.min(1, peak);
}

/** While Pearl is speaking, a strong local mic peak means the user is interrupting. */
export const LIVE_BARGE_IN_LEVEL = 0.14;

export type LiveVoiceMode =
  | "connecting"
  | "idle"
  | "listening"
  | "speaking"
  | "muted"
  | "ended";

export function liveVoiceStatusLabel(mode: LiveVoiceMode): string {
  switch (mode) {
    case "connecting":
      return "Connecting";
    case "idle":
      return "Listening";
    case "listening":
      return "You're talking";
    case "speaking":
      return "Pearl is talking";
    case "muted":
      return "Muted";
    case "ended":
      return "Live ended";
  }
}

export function liveSessionUpdateEvent() {
  return { type: "session-update" as const, config: LIVE_SESSION_CONFIG };
}

/** Kick the model so the first turn is an audible greeting. */
export function liveGreetingResponseEvent() {
  return { type: "response-create" as const };
}

export function liveSocketProtocols(token: string): [string, string] {
  return [LIVE_SOCKET_PROTOCOL, `${LIVE_AUTH_PROTOCOL_PREFIX}${token}`];
}

export type LiveImageEvent = {
  readonly type: "input-image-append";
  readonly image: string;
  readonly mediaType: "image/jpeg";
};

const FRAME_OVERHEAD = JSON.stringify({
  type: "input-image-append",
  image: "",
  mediaType: "image/jpeg",
}).length;

/** JPEG frames the Gateway message cap would reject are dropped, not resized here. */
export function liveFrameEvent(jpegBase64: string): LiveImageEvent | null {
  if (!jpegBase64) return null;
  if (FRAME_OVERHEAD + jpegBase64.length > LIVE_FRAME_MAX_BYTES) return null;
  return { type: "input-image-append", image: jpegBase64, mediaType: "image/jpeg" };
}

export function isVideoFrameRejection(message: string): boolean {
  return /image|video|frame|unsupported|unknown event|invalid event|unrecognized/i.test(message);
}

export function isFatalLiveError(message: string): boolean {
  return /no_providers|unauthorized|forbidden|expired|retention|policy/i.test(message);
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = i + 1 < bytes.length ? bytes[i + 1] ?? 0 : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] ?? 0 : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += B64[(triple >> 18) & 63];
    out += B64[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(triple >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? B64[triple & 63] : "=";
  }
  return out;
}

export function base64ToBytes(value: string): Uint8Array {
  const clean = value.replace(/=+$/g, "").replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let offset = 0;
  for (let i = 0; i + 1 < clean.length; i += 4) {
    const a = B64.indexOf(clean[i] ?? "");
    const b = B64.indexOf(clean[i + 1] ?? "");
    const c = i + 2 < clean.length ? B64.indexOf(clean[i + 2] ?? "") : -1;
    const d = i + 3 < clean.length ? B64.indexOf(clean[i + 3] ?? "") : -1;
    if (a < 0 || b < 0 || (c < 0 && i + 2 < clean.length) || (d < 0 && i + 3 < clean.length)) continue;
    const triple = (a << 18) | (b << 12) | ((c < 0 ? 0 : c) << 6) | (d < 0 ? 0 : d);
    out[offset++] = (triple >> 16) & 255;
    if (i + 2 < clean.length && offset < out.length) out[offset++] = (triple >> 8) & 255;
    if (i + 3 < clean.length && offset < out.length) out[offset++] = triple & 255;
  }
  return out.subarray(0, offset);
}

export function float32ToPcm16(samples: Float32Array): Uint8Array {
  const out = new Uint8Array(samples.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return out;
}

export function pcm16ToFloat32(bytes: Uint8Array): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength - (bytes.byteLength % 2));
  const count = view.byteLength / 2;
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = view.getInt16(i * 2, true) / 0x8000;
  return out;
}

export function resampleLinear(
  input: Float32Array,
  inputRate: number,
  outputRate: number,
): Float32Array {
  if (inputRate === outputRate || input.length === 0) return input;
  const ratio = inputRate / outputRate;
  const outputLength = Math.max(0, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
    const fraction = srcIndex - srcIndexFloor;
    output[i] =
      (input[srcIndexFloor] ?? 0) * (1 - fraction) + (input[srcIndexCeil] ?? 0) * fraction;
  }
  return output;
}

function float32FromBytes(bytes: Uint8Array): Float32Array {
  const aligned = bytes.byteOffset % 4 === 0 ? bytes : bytes.slice();
  return new Float32Array(
    aligned.buffer,
    aligned.byteOffset,
    Math.floor(aligned.byteLength / 4),
  );
}

export function downmixInterleaved(samples: Float32Array, channels: number): Float32Array {
  if (channels <= 1) return samples;
  const frames = Math.floor(samples.length / channels);
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel++) {
      sum += samples[i * channels + channel] ?? 0;
    }
    out[i] = sum / channels;
  }
  return out;
}

export function captureToPcm16Base64(input: {
  readonly data: Uint8Array;
  readonly encoding: "int16" | "float32";
  readonly sampleRate: number;
  readonly channels: number;
}): string {
  const floats = input.encoding === "int16"
    ? pcm16ToFloat32(input.data)
    : float32FromBytes(input.data);
  const mono = downmixInterleaved(floats, Math.max(1, input.channels));
  const rated = input.sampleRate === LIVE_SAMPLE_RATE
    ? mono
    : resampleLinear(mono, input.sampleRate, LIVE_SAMPLE_RATE);
  return bytesToBase64(float32ToPcm16(rated));
}

export function wavFromPcm16(pcm: Uint8Array, sampleRate = LIVE_SAMPLE_RATE): Uint8Array {
  const even = pcm.byteLength - (pcm.byteLength % 2);
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + even, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, even, true);
  const out = new Uint8Array(44 + even);
  out.set(new Uint8Array(header), 0);
  out.set(pcm.subarray(0, even), 44);
  return out;
}

/** Collects model PCM until a playable chunk is ready. */
export class PcmPlaybackBuffer {
  private pending = new Uint8Array(0);
  private readonly bytesPerChunk: number;

  constructor(bytesPerChunk = LIVE_PLAYBACK_CHUNK_BYTES) {
    this.bytesPerChunk = bytesPerChunk;
  }

  push(pcm: Uint8Array): Uint8Array[] {
    if (pcm.byteLength === 0) return [];
    const merged = new Uint8Array(this.pending.byteLength + pcm.byteLength);
    merged.set(this.pending, 0);
    merged.set(pcm, this.pending.byteLength);
    const ready: Uint8Array[] = [];
    let offset = 0;
    while (merged.byteLength - offset >= this.bytesPerChunk) {
      ready.push(merged.slice(offset, offset + this.bytesPerChunk));
      offset += this.bytesPerChunk;
    }
    this.pending = merged.slice(offset);
    return ready;
  }

  pushBase64(audio: string): Uint8Array[] {
    return this.push(base64ToBytes(audio));
  }

  flush(): Uint8Array | null {
    const even = this.pending.byteLength - (this.pending.byteLength % 2);
    const out = even >= 2 ? this.pending.slice(0, even) : null;
    this.pending = new Uint8Array(0);
    return out;
  }
}

export type LiveTurn = { readonly role: "user" | "pearl"; readonly text: string };

export function formatLiveTranscript(turns: readonly LiveTurn[]): string | null {
  const lines = turns
    .map((turn) => {
      const text = turn.text.trim();
      if (!text) return "";
      return `${turn.role === "user" ? "User" : "Pearl"}: ${text}`;
    })
    .filter(Boolean);
  if (lines.length === 0) return null;
  return `Live conversation\n\n${lines.join("\n")}`;
}
