import { requireNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

export type LiveVoiceBuffer = {
  data: ArrayBuffer;
  sampleRate: number;
  channels: number;
};

export type LiveVoiceStartStatus = {
  sampleRate: number;
  voiceProcessing: boolean;
};

type NativeBufferEvent = {
  data: ArrayBuffer | ArrayBufferView;
  sampleRate: number;
  channels: number;
};

type LiveVoiceNative = {
  start(): Promise<LiveVoiceStartStatus>;
  stop(): void;
  enqueuePcm16Base64(audio: string): void;
  stopPlayback(): void;
  addListener(event: "buffer", listener: (event: NativeBufferEvent) => void): { remove(): void };
  addListener(event: "playbackDrained", listener: () => void): { remove(): void };
};

type LiveVoiceModule = {
  LiveVoice: new () => LiveVoiceNative;
};

export type LiveVoice = {
  start(): Promise<LiveVoiceStartStatus>;
  stop(): void;
  enqueuePcm16Base64(audio: string): void;
  stopPlayback(): void;
  addBufferListener(listener: (buffer: LiveVoiceBuffer) => void): { remove(): void };
  addDrainedListener(listener: () => void): { remove(): void };
};

function bufferData(data: ArrayBuffer | ArrayBufferView): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data;
  const copy = new Uint8Array(data.byteLength);
  copy.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  return copy.buffer;
}

/** iOS duplex engine. Other platforms keep the expo-audio path. */
export function createLiveVoice(): LiveVoice | null {
  if (Platform.OS !== "ios") return null;
  const voice = new (requireNativeModule<LiveVoiceModule>("LiveVoice").LiveVoice)();
  return {
    start: () => voice.start(),
    stop: () => {
      voice.stop();
    },
    enqueuePcm16Base64: (audio) => {
      voice.enqueuePcm16Base64(audio);
    },
    stopPlayback: () => {
      voice.stopPlayback();
    },
    addBufferListener: (listener) => voice.addListener("buffer", (event) => {
      listener({
        data: bufferData(event.data),
        sampleRate: event.sampleRate,
        channels: event.channels,
      });
    }),
    addDrainedListener: (listener) => voice.addListener("playbackDrained", listener),
  };
}
