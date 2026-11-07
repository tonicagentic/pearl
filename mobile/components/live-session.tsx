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
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LiveVoiceOrb } from "@/components/live-voice-orb";
import { useChats } from "@/src/chat-context";
import { resizeLiveJpeg } from "@/src/live-camera";
import {
  LIVE_BARGE_IN_LEVEL,
  LIVE_MAX_SESSION_MS,
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
  pcm16PeakLevel,
  wavFromPcm16,
  type LiveTurn,
  type LiveVoiceMode,
} from "@/src/live-media";
import { fetchLiveToken } from "@/src/live-token-client";
import { getModelSelection } from "@/src/model-selection";

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

export function LiveSession({ onClose }: { readonly onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { store } = useChats();
  const cameraRef = useRef<CameraView>(null);
  const onCapture = useRef<(buffer: AudioStreamBuffer) => void>(() => {});
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const { stream } = useAudioStream({
    sampleRate: LIVE_SAMPLE_RATE,
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
  }, [settleAfterPlayback]);

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
      if (suppressMicRef.current) {
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
  }, [sendEvent, stopPlayback]);

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
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          shouldRouteThroughEarpiece: false,
          interruptionMode: "duckOthers",
        });
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
          if (!mutedRef.current) {
            void streamRef.current.start().catch(() => {
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
              for (const chunk of playbackRef.current.pushBase64(message.delta)) enqueueWav(chunk);
            } else if (message.type === "audio-done" || message.type === "response-done") {
              const tail = playbackRef.current.flush();
              if (tail) enqueueWav(tail);
              awaitPlaybackDrainRef.current = true;
              settleAfterPlayback();
            } else if (message.type === "speech-started") {
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
              if (!suppressMicRef.current && !mutedRef.current) setVoiceMode("idle");
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
      stopPlayback();
    };
  }, [enqueueWav, sendEvent, settleAfterPlayback, stopPlayback]);

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
    if (next) {
      stopStream(streamRef.current);
      setVoiceMode("muted");
    } else if (phase === "live" && !closedRef.current) {
      setVoiceMode(suppressMicRef.current ? "speaking" : "idle");
      void streamRef.current.start().catch(() => setError("The microphone did not start."));
    }
  };

  const cameraGranted = cameraPermission?.granted === true;
  const recent = turns.slice(-4);
  const endLabel = phase === "live" || phase === "connecting"
    ? "End"
    : turns.length > 0 || handoffError
      ? "Save to chat"
      : "Close";

  return (
    <Modal animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={finish}>
      <View style={styles.root}>
        {cameraOn && cameraGranted ? (
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
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.cameraOff]} />
        )}
        <View style={styles.orbStage} pointerEvents="none">
          <LiveVoiceOrb
            mode={phase === "connecting" ? "connecting" : phase === "error" ? "ended" : voiceMode}
            level={voiceMode === "speaking" ? Math.max(micLevel, 0.35) : micLevel}
          />
        </View>
        <View style={[styles.top, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
          <Text style={styles.status}>
            {phase === "connecting" ? "Connecting" : phase === "live" ? "Live" : phase === "error" ? "Live stopped" : "Live ended"}
          </Text>
          {error ? <Text style={styles.banner}>{error}</Text> : null}
          {notice ? <Text style={styles.banner}>{notice}</Text> : null}
          {videoRejected ? (
            <Text style={styles.banner}>
              {phase === "live"
                ? "The model is not receiving video. Voice stays on until you end."
                : "The model is not receiving video."}
            </Text>
          ) : null}
          {cameraOn && !cameraGranted ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Allow camera"
              onPress={() => void requestCameraPermission()}
              style={styles.permission}
            >
              <Text style={styles.controlText}>Allow camera</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
          <View accessibilityLiveRegion="polite" style={styles.captions}>
            {recent.map((turn, index) => (
              <Text key={`${turn.role}-${index}`} style={styles.caption}>
                {turn.role === "user" ? "You" : "Pearl"}: {turn.text}
              </Text>
            ))}
            {assistantCaption ? <Text style={styles.caption}>Pearl: {assistantCaption}</Text> : null}
          </View>
          {handoffError ? <Text style={styles.banner}>{handoffError}</Text> : null}
          <View style={styles.controls}>
            <Control label={muted ? "Unmute" : "Mute"} onPress={toggleMute} />
            {cameraOn && cameraGranted ? (
              <Control
                label="Flip camera"
                onPress={() => {
                  setCameraReady(false);
                  setFacing((current) => current === "back" ? "front" : "back");
                }}
              />
            ) : null}
            <Control
              label={cameraOn ? "Turn camera off" : "Turn camera on"}
              onPress={() => {
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
              }}
            />
            <Control label={endLabel} onPress={finish} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Control({ label, onPress }: { readonly label: string; readonly onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.control}>
      <Text style={styles.controlText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  cameraOff: { backgroundColor: "#0B0D12" },
  orbStage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 48,
  },
  top: { position: "absolute", top: 0, left: 16, right: 16, gap: 8 },
  bottom: { position: "absolute", left: 16, right: 16, bottom: 0, gap: 12 },
  status: { color: "#fff", fontSize: 17, fontWeight: "600" },
  banner: { color: "#fff", backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 12, padding: 10, overflow: "hidden" },
  captions: { gap: 4 },
  caption: { color: "#fff", fontSize: 16 },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  control: { backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  controlText: { color: "#fff", fontSize: 15 },
  permission: { alignSelf: "flex-start", backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
});
