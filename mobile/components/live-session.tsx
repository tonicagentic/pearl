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
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MicIcon,
  MicOffIcon,
  PlusIcon,
  SwitchCameraIcon,
  VideoIcon,
  VideoOffIcon,
  XIcon,
} from "lucide-react-native";

import { LiveVoiceOrb } from "@/components/live-voice-orb";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { createLiveVoice, type LiveVoice } from "@/modules/live-voice";
import { useChats } from "@/src/chat-context";
import { focusComposerInput } from "@/src/composer-input-focus";
import { resizeLiveJpeg } from "@/src/live-camera";
import {
  LIVE_BARGE_IN_LEVEL,
  LIVE_CAPTURE_SAMPLE_RATE,
  LIVE_MAX_SESSION_MS,
  LIVE_MIC_SETTLE_MS,
  LIVE_PLAYBACK_TAIL_MS,
  LIVE_SAMPLE_RATE,
  PcmPlaybackBuffer,
  captureToPcm16Base64,
  isFatalLiveError,
  isVideoFrameRejection,
  liveFrameEvent,
  liveGreetingResponseEvent,
  liveSessionUpdateEvent,
  liveSocketProtocols,
  liveVoiceStatusLabel,
  pcm16PeakLevel,
  shouldUploadIosMicFrame,
  wavFromPcm16,
  type LiveTurn,
  type LiveVoiceMode,
} from "@/src/live-media";
import { fetchLiveToken } from "@/src/live-token-client";
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
  const { saveSpokenTurns } = useChats();
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
  /** iOS: Pearl is audible on the speaker. Mic stays open; echo cancellation removes her. */
  const assistantAudibleRef = useRef(false);
  const modelAudioDoneRef = useRef(false);
  /** True after an audio-delta until native playbackDrained. */
  const playbackScheduledRef = useRef(false);
  /** iOS: mute uplink only for the short flush after playback drains. */
  const inPlaybackTailRef = useRef(false);
  /**
   * iOS: hold the uplink through the opening greeting until AEC has heard
   * one full playout. Cleared after the first drain+tail.
   */
  const holdUplinkRef = useRef(Platform.OS === "ios");
  const drainTailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const levelTickRef = useRef(0);
  const voiceRef = useRef<LiveVoice | null>(null);
  const iosDuplex = Platform.OS === "ios";

  const sendEvent = useCallback((event: object) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || closedRef.current) return;
    socket.send(JSON.stringify(event));
  }, []);

  const clearDrainTail = useCallback(() => {
    if (drainTailTimerRef.current) {
      clearTimeout(drainTailTimerRef.current);
      drainTailTimerRef.current = null;
    }
    inPlaybackTailRef.current = false;
  }, []);

  const releaseAssistantAudible = useCallback(() => {
    clearDrainTail();
    assistantAudibleRef.current = false;
    modelAudioDoneRef.current = false;
    playbackScheduledRef.current = false;
    // First completed reply primes the canceller — open the mic after that.
    holdUplinkRef.current = false;
    setMicLevel(0);
    if (!closedRef.current && !mutedRef.current) setVoiceMode("idle");
  }, [clearDrainTail]);

  const startAudibleTailIfReady = useCallback(() => {
    if (closedRef.current) return;
    if (!assistantAudibleRef.current || !modelAudioDoneRef.current) return;
    if (playbackScheduledRef.current) return;
    if (drainTailTimerRef.current) return;
    // Speaker flush after drain — mute uplink briefly, then reopen.
    inPlaybackTailRef.current = true;
    drainTailTimerRef.current = setTimeout(() => {
      drainTailTimerRef.current = null;
      releaseAssistantAudible();
    }, LIVE_PLAYBACK_TAIL_MS);
  }, [releaseAssistantAudible]);

  const markAssistantAudible = useCallback(() => {
    clearDrainTail();
    assistantAudibleRef.current = true;
    modelAudioDoneRef.current = false;
    playbackScheduledRef.current = true;
    // Drop anything buffered before the greeting while the uplink was held.
    if (holdUplinkRef.current) {
      sendEvent({ type: "input-audio-clear" });
    }
    setVoiceMode((current) => (current === "muted" || current === "speaking" ? current : "speaking"));
  }, [clearDrainTail, sendEvent]);

  const noteModelAudioDone = useCallback(() => {
    if (!assistantAudibleRef.current) return;
    modelAudioDoneRef.current = true;
    startAudibleTailIfReady();
  }, [startAudibleTailIfReady]);

  const notePlaybackDrained = useCallback(() => {
    if (closedRef.current) return;
    playbackScheduledRef.current = false;
    if (!assistantAudibleRef.current || !modelAudioDoneRef.current) {
      setMicLevel(0);
      setVoiceMode((current) =>
        current === "listening" || current === "muted" ? current : "idle",
      );
      return;
    }
    startAudibleTailIfReady();
  }, [startAudibleTailIfReady]);

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
    clearDrainTail();
    assistantAudibleRef.current = false;
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
    const spokenTurns = turnsRef.current;
    if (spokenTurns.length === 0) {
      onClose();
      return;
    }
    void saveSpokenTurns(spokenTurns)
      .then(() => {
        onClose();
      })
      .catch((cause: unknown) => {
        endingRef.current = false;
        setHandoffError(
          cause instanceof Error
            ? cause.message
            : "Could not save the live conversation to this chat.",
        );
      });
  }, [clearDrainTail, onClose, saveSpokenTurns, stopPlayback]);

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
      notePlaybackDrained();
    });
    return () => {
      buffers.remove();
      drained.remove();
      voice.stop();
      if (voiceRef.current === voice) voiceRef.current = null;
    };
  }, [iosDuplex, notePlaybackDrained]);

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
      // iOS: hold through the greeting; then open mic, mute only the post-drain flush.
      if (
        iosDuplex &&
        !shouldUploadIosMicFrame({
          holdUplink: holdUplinkRef.current,
          inPlaybackTail: inPlaybackTailRef.current,
        })
      ) {
        return;
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
          const status = await voice.start();
          if (!status.voiceProcessing) {
            voice.stop();
            throw new Error("The microphone did not start.");
          }
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
                markAssistantAudible();
                voiceRef.current?.enqueuePcm16Base64(message.delta);
              } else {
                for (const chunk of playbackRef.current.pushBase64(message.delta)) enqueueWav(chunk);
              }
            } else if (message.type === "audio-done" || message.type === "response-done") {
              if (iosDuplex) {
                noteModelAudioDone();
              } else {
                const tail = playbackRef.current.flush();
                if (tail) enqueueWav(tail);
                awaitPlaybackDrainRef.current = true;
                settleAfterPlayback();
              }
            } else if (message.type === "speech-started") {
              // During the greeting hold, treat speech-started as echo — clear
              // the buffer and keep playing. After AEC is primed, barge-in stops her.
              if (iosDuplex && holdUplinkRef.current) {
                sendEvent({ type: "input-audio-clear" });
                continue;
              }
              clearDrainTail();
              assistantAudibleRef.current = false;
              modelAudioDoneRef.current = false;
              playbackScheduledRef.current = false;
              voiceRef.current?.stopPlayback();
              stopPlayback();
              suppressMicRef.current = false;
              if (!mutedRef.current) setVoiceMode("listening");
            } else if (message.type === "audio-transcript-delta" && typeof message.delta === "string") {
              partialRef.current += message.delta;
            } else if (message.type === "audio-transcript-done") {
              const text = (typeof message.transcript === "string" ? message.transcript : partialRef.current).trim();
              partialRef.current = "";
              if (text) {
                turnsRef.current = [...turnsRef.current, { role: "pearl", text }];
                setTurns(turnsRef.current);
              }
            } else if (message.type === "input-transcription-completed" && typeof message.transcript === "string") {
              // Greeting-hold echo must not become a saved user turn.
              if (iosDuplex && holdUplinkRef.current) continue;
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
      clearDrainTail();
      if (sessionTimer) clearTimeout(sessionTimer);
      socket?.close();
      if (socketRef.current === socket) socketRef.current = null;
      stopStream(streamRef.current);
      voiceRef.current?.stopPlayback();
      voiceRef.current?.stop();
      stopPlayback();
    };
  }, [
    clearDrainTail,
    enqueueWav,
    iosDuplex,
    markAssistantAudible,
    noteModelAudioDone,
    notePlaybackDrained,
    sendEvent,
    settleAfterPlayback,
    stopPlayback,
  ]);

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

  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const cameraGranted = cameraPermission?.granted === true;
  const orbMode = phase === "connecting" ? "connecting" : phase === "error" ? "ended" : voiceMode;
  const endLabel = phase === "live" || phase === "connecting"
    ? "End live"
    : turns.length > 0 || handoffError
      ? "Save to chat"
      : "Close";
  const stageBg = colorScheme === "dark" ? "#0B0D12" : "#FFFFFF";

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

  const askPearl = () => {
    finish();
    // After the call closes, put focus back in the text composer.
    requestAnimationFrame(() => focusComposerInput());
  };

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={finish}
      statusBarTranslucent
    >
      <View
        accessibilityLiveRegion="polite"
        style={[styles.stage, { backgroundColor: stageBg, paddingTop: insets.top }]}
      >
        <View style={styles.orbArea}>
          <LiveVoiceOrb
            mode={orbMode}
            level={voiceMode === "speaking" ? Math.max(micLevel, 0.35) : micLevel}
            size="stage"
            showLabel={false}
          />
          {(error || notice || videoRejected || handoffError) ? (
            <View style={styles.notices}>
              {error ? (
                <Text variant="secondary" tone="destructive" className="text-center">
                  {error}
                </Text>
              ) : null}
              {notice ? (
                <Text variant="secondary" className="text-center">
                  {notice}
                </Text>
              ) : null}
              {videoRejected ? (
                <Text variant="secondary" className="text-center">
                  The model is not receiving video. Voice stays on.
                </Text>
              ) : null}
              {handoffError ? (
                <Text variant="secondary" tone="destructive" className="text-center">
                  {handoffError}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text variant="secondary" className="text-center opacity-60">
              {phase === "connecting" ? "Starting…" : liveVoiceStatusLabel(orbMode)}
            </Text>
          )}
        </View>

        {cameraOn && cameraGranted ? (
          <View style={styles.previewWrap}>
            <View style={styles.preview}>
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
            <CallControl
              label="Flip camera"
              onPress={() => {
                setCameraReady(false);
                setFacing((current) => (current === "back" ? "front" : "back"));
              }}
            >
              <Icon as={SwitchCameraIcon} className="text-foreground size-5" />
            </CallControl>
          </View>
        ) : null}

        <View style={[styles.bottomChrome, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ask Pearl"
            onPress={askPearl}
            style={styles.askPill}
            className="bg-card border-border/50 active:bg-accent/40"
          >
            <Icon as={PlusIcon} className="text-foreground size-5" />
            <Text variant="secondary" className="flex-1" numberOfLines={1}>
              Ask Pearl
            </Text>
          </Pressable>

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

          {cameraOn && !cameraGranted ? (
            <CallControl
              label="Allow camera"
              onPress={() => void requestCameraPermission()}
              active
            >
              <Icon as={VideoOffIcon} className="text-foreground size-5" />
            </CallControl>
          ) : null}

          <CallControl label={endLabel} onPress={finish} solid>
            <Icon as={XIcon} className="size-5 text-white" />
          </CallControl>
        </View>
      </View>
    </Modal>
  );
}

function CallControl({
  label,
  onPress,
  active = false,
  solid = false,
  children,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly active?: boolean;
  readonly solid?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      className={cn(
        "size-12 items-center justify-center rounded-full",
        solid
          ? "bg-foreground active:bg-foreground/90"
          : active
            ? "bg-foreground/12 active:bg-foreground/18"
            : "bg-card border-border/40 border active:bg-foreground/8",
      )}
      style={solid ? undefined : styles.softShadow}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
  },
  orbArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 24,
  },
  notices: {
    gap: 6,
    maxWidth: 320,
  },
  previewWrap: {
    position: "absolute",
    right: 20,
    bottom: 118,
    alignItems: "flex-end",
    gap: 8,
  },
  preview: {
    width: 96,
    height: 128,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#0B0D12",
  },
  bottomChrome: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  askPill: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  softShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
