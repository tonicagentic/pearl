import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import {
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioStream,
  type AudioPlayer,
  type AudioStreamBuffer,
} from "expo-audio";
import { File, Paths } from "expo-file-system";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import {
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  SwitchCameraIcon,
  VideoIcon,
  VideoOffIcon,
} from "lucide-react-native";

import { LiveVoiceOrb } from "@/components/live-voice-orb";
import { Icon } from "@/components/ui/icon";
import { createLiveVoice, type LiveVoice } from "@/modules/live-voice";
import { useChats } from "@/src/chat-context";
import { resizeLiveJpeg } from "@/src/live-camera";
import {
  LIVE_BARGE_IN_LEVEL,
  LIVE_CAPTURE_SAMPLE_RATE,
  LIVE_MAX_SESSION_MS,
  LIVE_MIC_SETTLE_MS,
  LIVE_SAMPLE_RATE,
  PcmPlaybackBuffer,
  captureToPcm16Base64,
  formatLiveTranscript,
  isFatalLiveError,
  isVideoFrameRejection,
  liveFrameEvent,
  liveGreetingResponseEvent,
  liveSessionUpdateEvent,
  liveSocketProtocols,
  liveVoiceStatusLabel,
  pcm16PeakLevel,
  wavFromPcm16,
  type LiveTurn,
  type LiveVoiceMode,
} from "@/src/live-media";
import { fetchLiveToken } from "@/src/live-token-client";
import { getModelSelection } from "@/src/model-selection";
import { cn } from "@/lib/utils";

type Phase = "connecting" | "live" | "closed" | "error";

type ServerEvent = {
  type?: string;
  delta?: unknown;
  message?: unknown;
  transcript?: unknown;
};

function writeWav(pcm: Uint8Array): string {
  const file = new File(Paths.cache, `pearl-live-${Date.now()}-${Math.random().toString(16).slice(2)}.wav`);
  file.create({ overwrite: true });
  file.write(wavFromPcm16(pcm));
  return file.uri;
}

function deleteWav(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Leaving a short cache file behind is harmless.
  }
}

function stopStream(stream: { stop: () => void }) {
  try {
    stream.stop();
  } catch {
    // The microphone may already be stopped.
  }
}

async function startMicStream(stream: { start: () => Promise<unknown> }) {
  // Give AVAudioSession time to settle after permission / category changes.
  // Starting immediately can leave inputNode at 0 Hz and abort in installTap.
  // The session must stay play-and-record. plugins/with-live-audio-session.js
  // keeps AudioStream.start() from switching iOS to record-only, which would
  // silence playback and hold the microphone closed until that playback ends.
  await new Promise((resolve) => setTimeout(resolve, LIVE_MIC_SETTLE_MS));
  await stream.start();
}

export function LiveSession({ onClose }: { readonly onClose: () => void }) {
  const { store } = useChats();
  const cameraRef = useRef<CameraView>(null);
  const onCapture = useRef<(buffer: AudioStreamBuffer) => void>(() => {});
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  // Capture at a hardware-friendly rate; captureToPcm16Base64 resamples to 24 kHz.
  const { stream } = useAudioStream({
    sampleRate: LIVE_CAPTURE_SAMPLE_RATE,
    channels: 1,
    encoding: "int16",
    onBuffer: (buffer) => onCapture.current(buffer),
  });

  const [phase, setPhase] = useState<Phase>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [facing, setFacing] = useState<CameraType>("back");
  const [cameraReady, setCameraReady] = useState(false);
  const [videoRejected, setVideoRejected] = useState(false);
  const [turns, setTurns] = useState<readonly LiveTurn[]>([]);
  const [assistantCaption, setAssistantCaption] = useState("");
  const [voiceMode, setVoiceMode] = useState<LiveVoiceMode>("connecting");
  const [micLevel, setMicLevel] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef(stream);
  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);
  const mutedRef = useRef(false);
  const videoRejectedRef = useRef(false);
  const frameSentRef = useRef(false);
  const closedRef = useRef(false);
  const endingRef = useRef(false);
  const turnsRef = useRef<LiveTurn[]>([]);
  const partialRef = useRef("");
  const playbackRef = useRef(new PcmPlaybackBuffer());
  const playersRef = useRef<AudioPlayer[] | null>(null);
  const busyRef = useRef([false, false]);
  const slotUri = useRef<(string | null)[]>([null, null]);
  const queueRef = useRef<string[]>([]);
  const finishRef = useRef<() => void>(() => {});
  const suppressMicRef = useRef(false);
  const awaitPlaybackDrainRef = useRef(false);
  const levelTickRef = useRef(0);
  const voiceRef = useRef<LiveVoice | null>(null);
  const iosDuplex = Platform.OS === "ios";

  const sendEvent = useCallback((event: object) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || closedRef.current) return;
    socket.send(JSON.stringify(event));
  }, []);

  const settleAfterPlayback = useCallback(() => {
    if (!awaitPlaybackDrainRef.current) return;
    if (queueRef.current.length > 0 || busyRef.current.some(Boolean)) return;
    awaitPlaybackDrainRef.current = false;
    suppressMicRef.current = false;
    setMicLevel(0);
    if (!closedRef.current && !mutedRef.current) setVoiceMode("idle");
  }, []);

  const enqueueWav = useCallback((pcm: Uint8Array) => {
    const players = playersRef.current;
    if (!players) return;
    let uri: string;
    try {
      uri = writeWav(pcm);
    } catch {
      return;
    }
    suppressMicRef.current = true;
    awaitPlaybackDrainRef.current = false;
    setVoiceMode((current) => current === "muted" ? current : "speaking");
    const index = busyRef.current.findIndex((busy) => !busy);
    if (index < 0) {
      queueRef.current.push(uri);
      return;
    }
    const previous = slotUri.current[index];
    slotUri.current[index] = uri;
    busyRef.current[index] = true;
    players[index]?.replace(uri);
    players[index]?.play();
    if (previous) deleteWav(previous);
  }, []);

  const stopPlayback = useCallback(() => {
    playbackRef.current.flush();
    for (const uri of queueRef.current) deleteWav(uri);
    queueRef.current = [];
    playersRef.current?.forEach((player, index) => {
      busyRef.current[index] = false;
      player.pause();
      const uri = slotUri.current[index];
      slotUri.current[index] = null;
      if (uri) deleteWav(uri);
    });
    awaitPlaybackDrainRef.current = false;
  }, []);

  const finish = useCallback(() => {
    if (endingRef.current) return;
    endingRef.current = true;
    closedRef.current = true;
    const socket = socketRef.current;
    socketRef.current = null;
    socket?.close();
    stopStream(streamRef.current);
    voiceRef.current?.stopPlayback();
    voiceRef.current?.stop();
    stopPlayback();
    suppressMicRef.current = false;
    setVoiceMode("ended");
    setMicLevel(0);
    setPhase("closed");
    const spoken = partialRef.current.trim();
    partialRef.current = "";
    if (spoken) {
      turnsRef.current = [...turnsRef.current, { role: "pearl", text: spoken }];
      setTurns(turnsRef.current);
    }
    const transcript = formatLiveTranscript(turnsRef.current);
    if (!transcript) {
      onClose();
      return;
    }
    const status = store.snapshot.status;
    if (status === "streaming" || status === "submitted" || status === "resuming") {
      endingRef.current = false;
      setHandoffError("This chat is still responding. Save the live conversation after it finishes.");
      return;
    }
    void store.send({
      message: transcript,
      clientContext: { eveModelSelection: getModelSelection() },
    }).then(() => {
      onClose();
    }).catch((cause: unknown) => {
      endingRef.current = false;
      setHandoffError(cause instanceof Error ? cause.message : "Could not save the live conversation to this chat.");
    });
  }, [onClose, stopPlayback, store]);

  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);

  useEffect(() => {
    if (iosDuplex) return;
    const players = [createAudioPlayer(null), createAudioPlayer(null)];
    playersRef.current = players;
    const subscriptions = players.map((player, index) => player.addListener("playbackStatusUpdate", (status) => {
      if (!status.didJustFinish) return;
      const next = queueRef.current.shift();
      const previous = slotUri.current[index];
      if (next) {
        slotUri.current[index] = next;
        busyRef.current[index] = true;
        player.replace(next);
        player.play();
      } else {
        busyRef.current[index] = false;
        slotUri.current[index] = null;
        settleAfterPlayback();
      }
      if (previous && previous !== next) deleteWav(previous);
    }));
    return () => {
      for (const subscription of subscriptions) subscription.remove();
      for (const player of players) player.remove();
      playersRef.current = null;
    };
  }, [iosDuplex, settleAfterPlayback]);

  useEffect(() => {
    if (!iosDuplex) return;
    const voice = createLiveVoice();
    if (!voice) return;
    voiceRef.current = voice;
    const buffers = voice.addBufferListener((buffer) => {
      onCapture.current({ ...buffer, timestamp: 0 });
    });
    const drained = voice.addDrainedListener(() => {
      if (closedRef.current) return;
      setMicLevel(0);
      setVoiceMode((current) => current === "listening" || current === "muted" ? current : "idle");
    });
    return () => {
      buffers.remove();
      drained.remove();
      voice.stop();
      if (voiceRef.current === voice) voiceRef.current = null;
    };
  }, [iosDuplex]);

  useEffect(() => {
    onCapture.current = (buffer) => {
      if (mutedRef.current || closedRef.current) return;
      const bytes = new Uint8Array(buffer.data);
      const level = pcm16PeakLevel(bytes);
      const now = Date.now();
      if (now - levelTickRef.current > 80) {
        levelTickRef.current = now;
        setMicLevel(level);
      }
      if (!iosDuplex && suppressMicRef.current) {
        if (level < LIVE_BARGE_IN_LEVEL) return;
        stopPlayback();
        suppressMicRef.current = false;
        setVoiceMode("listening");
      }
      const audio = captureToPcm16Base64({
        data: bytes,
        encoding: "int16",
        sampleRate: buffer.sampleRate || LIVE_SAMPLE_RATE,
        channels: buffer.channels || 1,
      });
      if (audio) sendEvent({ type: "input-audio-append", audio });
    };
  }, [iosDuplex, sendEvent, stopPlayback]);

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;
    let sessionTimer: ReturnType<typeof setTimeout> | undefined;
    const connect = async () => {
      try {
        const permission = await requestRecordingPermissionsAsync();
        if (cancelled) return;
        if (!permission.granted) {
          setPhase("error");
          setError("Microphone access is required for a live conversation.");
          return;
        }
        if (iosDuplex) {
          // The native engine owns the session. setAudioModeAsync would put it
          // back in mode .default and the echo canceller would lose its reference.
          await new Promise((resolve) => setTimeout(resolve, LIVE_MIC_SETTLE_MS));
          if (cancelled) return;
          const voice = voiceRef.current;
          if (!voice) throw new Error("The microphone did not start.");
          await voice.start();
          if (cancelled || closedRef.current) {
            voice.stop();
            return;
          }
        } else {
          await setAudioModeAsync({
            allowsRecording: true,
            playsInSilentMode: true,
            shouldRouteThroughEarpiece: false,
            interruptionMode: "duckOthers",
          });
        }
        const secret = await fetchLiveToken();
        if (cancelled) return;
        if (secret.expiresAt != null && Date.now() >= secret.expiresAt * 1000) {
          throw new Error("Could not start the live session.");
        }
        socket = new WebSocket(secret.url, liveSocketProtocols(secret.token));
        socketRef.current = socket;
        socket.onopen = () => {
          if (cancelled || closedRef.current) return;
          sendEvent(liveSessionUpdateEvent());
          sendEvent(liveGreetingResponseEvent());
          setPhase("live");
          setVoiceMode(mutedRef.current ? "muted" : "idle");
          sessionTimer = setTimeout(() => {
            setNotice("The 25 minute live session ended.");
            finishRef.current();
          }, LIVE_MAX_SESSION_MS);
          if (!iosDuplex && !mutedRef.current) {
            void startMicStream(streamRef.current).catch(() => {
              setError("The microphone did not start.");
            });
          }
        };
        socket.onmessage = (event) => {
          if (typeof event.data !== "string") return;
          let parsed: unknown;
          try {
            parsed = JSON.parse(event.data);
          } catch {
            return;
          }
          const events = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of events) {
            if (!item || typeof item !== "object") continue;
            const message = item as ServerEvent;
            if (message.type === "audio-delta" && typeof message.delta === "string") {
              if (iosDuplex) {
                voiceRef.current?.enqueuePcm16Base64(message.delta);
                setVoiceMode((current) => current === "muted" || current === "speaking" ? current : "speaking");
              } else {
                for (const chunk of playbackRef.current.pushBase64(message.delta)) enqueueWav(chunk);
              }
            } else if (message.type === "audio-done" || message.type === "response-done") {
              if (!iosDuplex) {
                const tail = playbackRef.current.flush();
                if (tail) enqueueWav(tail);
                awaitPlaybackDrainRef.current = true;
                settleAfterPlayback();
              }
            } else if (message.type === "speech-started") {
              voiceRef.current?.stopPlayback();
              stopPlayback();
              suppressMicRef.current = false;
              if (!mutedRef.current) setVoiceMode("listening");
            } else if (message.type === "audio-transcript-delta" && typeof message.delta === "string") {
              partialRef.current += message.delta;
              setAssistantCaption(partialRef.current);
            } else if (message.type === "audio-transcript-done") {
              const text = (typeof message.transcript === "string" ? message.transcript : partialRef.current).trim();
              partialRef.current = "";
              setAssistantCaption("");
              if (text) {
                turnsRef.current = [...turnsRef.current, { role: "pearl", text }];
                setTurns(turnsRef.current);
              }
            } else if (message.type === "input-transcription-completed" && typeof message.transcript === "string") {
              const text = message.transcript.trim();
              if (text) {
                turnsRef.current = [...turnsRef.current, { role: "user", text }];
                setTurns(turnsRef.current);
              }
              if (!iosDuplex && !suppressMicRef.current && !mutedRef.current) setVoiceMode("idle");
            } else if (message.type === "error" && typeof message.message === "string") {
              const text = message.message.slice(0, 240);
              if (isFatalLiveError(text)) {
                setError(text);
                setPhase("error");
                setVoiceMode("ended");
                socketRef.current?.close();
              } else if (frameSentRef.current || isVideoFrameRejection(text)) {
                frameSentRef.current = false;
                videoRejectedRef.current = true;
                setVideoRejected(true);
              } else {
                setError(text);
              }
            }
          }
        };
        socket.onerror = () => {
          if (!cancelled) setError("The live connection failed.");
        };
        socket.onclose = () => {
          if (cancelled || closedRef.current) return;
          setPhase((current) => current === "error" ? current : "closed");
          setVoiceMode("ended");
          stopStream(streamRef.current);
          voiceRef.current?.stop();
        };
      } catch (cause) {
        if (cancelled) return;
        setPhase("error");
        setVoiceMode("ended");
        setError(cause instanceof Error ? cause.message : "Could not start the live session.");
      }
    };
    void connect();
    return () => {
      cancelled = true;
      if (sessionTimer) clearTimeout(sessionTimer);
      socket?.close();
      if (socketRef.current === socket) socketRef.current = null;
      stopStream(streamRef.current);
      voiceRef.current?.stopPlayback();
      voiceRef.current?.stop();
      stopPlayback();
    };
  }, [enqueueWav, iosDuplex, sendEvent, settleAfterPlayback, stopPlayback]);

  useEffect(() => {
    if (!cameraOn || !cameraReady || videoRejected || phase !== "live") return;
    let cancelled = false;
    const run = async () => {
      while (!cancelled) {
        const started = Date.now();
        try {
          const picture = await cameraRef.current?.takePictureAsync({
            quality: 0.5,
            shutterSound: false,
          });
          if (!cancelled && picture?.uri && !videoRejectedRef.current) {
            const jpeg = await resizeLiveJpeg(picture.uri, picture.width, picture.height);
            const event = jpeg ? liveFrameEvent(jpeg) : null;
            if (event) {
              frameSentRef.current = true;
              sendEvent(event);
            }
          }
        } catch {
          // A missed frame leaves the voice session running.
        }
        const wait = Math.max(0, 1000 - (Date.now() - started));
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [cameraOn, cameraReady, phase, sendEvent, videoRejected]);

  const toggleMute = () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    setMicLevel(0);
    if (iosDuplex) {
      setVoiceMode(next ? "muted" : "idle");
      return;
    }
    if (next) {
      stopStream(streamRef.current);
      setVoiceMode("muted");
    } else if (phase === "live" && !closedRef.current) {
      setVoiceMode(suppressMicRef.current ? "speaking" : "idle");
      void startMicStream(streamRef.current).catch(() => setError("The microphone did not start."));
    }
  };

  const cameraGranted = cameraPermission?.granted === true;
  const lastTurn = turns[turns.length - 1];
  const caption = assistantCaption
    ? `Pearl: ${assistantCaption}`
    : lastTurn
      ? `${lastTurn.role === "user" ? "You" : "Pearl"}: ${lastTurn.text}`
      : null;
  const orbMode = phase === "connecting" ? "connecting" : phase === "error" ? "ended" : voiceMode;
  const endLabel = phase === "live" || phase === "connecting"
    ? "End live"
    : turns.length > 0 || handoffError
      ? "Save to chat"
      : "Close";

  const toggleCamera = () => {
    setCameraReady(false);
    if (cameraOn) {
      setCameraOn(false);
      return;
    }
    if (cameraGranted) {
      setCameraOn(true);
      return;
    }
    void requestCameraPermission().then((result) => {
      if (result.granted) setCameraOn(true);
      else setNotice("Camera permission is optional. Voice stays on.");
    });
  };

  return (
    <View accessibilityLiveRegion="polite" className="w-full gap-3 px-1 py-1">
      <View className="flex-row items-center gap-3">
        <LiveVoiceOrb
          mode={orbMode}
          level={voiceMode === "speaking" ? Math.max(micLevel, 0.35) : micLevel}
          size="compact"
          showLabel={false}
        />
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-foreground text-[15px] font-semibold" numberOfLines={1}>
            {liveVoiceStatusLabel(orbMode)}
          </Text>
          {caption ? (
            <Text className="text-muted-foreground text-[13px] leading-[18px]" numberOfLines={2}>
              {caption}
            </Text>
          ) : (
            <Text className="text-muted-foreground text-[13px] leading-[18px]" numberOfLines={1}>
              {phase === "connecting" ? "Starting the call…" : "Say something"}
            </Text>
          )}
        </View>
      </View>

      {cameraOn && cameraGranted ? (
        <View className="overflow-hidden rounded-2xl" style={styles.preview}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            mode="picture"
            mute
            animateShutter={false}
            onCameraReady={() => setCameraReady(true)}
            onMountError={() => {
              setCameraReady(false);
              setCameraOn(false);
              setNotice("Camera unavailable. Voice stays on.");
            }}
          />
        </View>
      ) : null}

      {error ? <Text className="text-destructive text-[13px]">{error}</Text> : null}
      {notice ? <Text className="text-muted-foreground text-[13px]">{notice}</Text> : null}
      {videoRejected ? (
        <Text className="text-muted-foreground text-[13px]">
          The model is not receiving video. Voice stays on.
        </Text>
      ) : null}
      {cameraOn && !cameraGranted ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Allow camera"
          onPress={() => void requestCameraPermission()}
        >
          <Text className="text-primary text-[13px] font-medium">Allow camera</Text>
        </Pressable>
      ) : null}
      {handoffError ? <Text className="text-destructive text-[13px]">{handoffError}</Text> : null}

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <CallControl
            label={muted ? "Unmute" : "Mute"}
            onPress={toggleMute}
            active={muted}
          >
            <Icon as={muted ? MicOffIcon : MicIcon} className="text-foreground size-5" />
          </CallControl>
          <CallControl
            label={cameraOn ? "Turn camera off" : "Turn camera on"}
            onPress={toggleCamera}
            active={cameraOn}
          >
            <Icon as={cameraOn ? VideoIcon : VideoOffIcon} className="text-foreground size-5" />
          </CallControl>
          {cameraOn && cameraGranted ? (
            <CallControl
              label="Flip camera"
              onPress={() => {
                setCameraReady(false);
                setFacing((current) => current === "back" ? "front" : "back");
              }}
            >
              <Icon as={SwitchCameraIcon} className="text-foreground size-5" />
            </CallControl>
          ) : null}
        </View>
        <CallControl
          label={endLabel}
          onPress={finish}
          danger
        >
          <Icon as={PhoneOffIcon} className="size-5 text-white" />
        </CallControl>
      </View>
    </View>
  );
}

function CallControl({
  label,
  onPress,
  active = false,
  danger = false,
  children,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly active?: boolean;
  readonly danger?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      className={cn(
        "size-10 items-center justify-center rounded-full",
        danger
          ? "bg-destructive active:bg-destructive/90"
          : active
            ? "bg-foreground/15 active:bg-foreground/20"
            : "bg-foreground/8 active:bg-foreground/12",
      )}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  preview: {
    height: 120,
    width: "100%",
    backgroundColor: "#0B0D12",
  },
});
