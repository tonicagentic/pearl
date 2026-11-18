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
import { LiveWorkCards } from "@/components/live-work-cards";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { createLiveVoice, type LiveVoice } from "@/modules/live-voice";
import { useChats } from "@/src/chat-context";
import { focusComposerInput } from "@/src/composer-input-focus";
import { resizeLiveJpeg } from "@/src/live-camera";
import {
  executeLiveChatTool,
  type LiveToolExecContext,
} from "@/src/live-chat-tool-exec";
import {
  LIVE_CHAT_TOOLS,
  LIVE_POST_TOOL_AUDIO_TIMEOUT_MS,
  buildLiveInstructions,
  formatTranscriptLines,
  linesFromEveMessages,
  liveFunctionCallOutputEvent,
  liveToolActivityLabel,
  primaryAskPearlCard,
} from "@/src/live-chat-tools";
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
import {
  nestedSubagentCards,
  type LiveWorkCardModel,
} from "@/src/live-work-progress";
import { hasPendingAction } from "@/src/message-projection";
import { cn } from "@/lib/utils";

type Phase = "connecting" | "live" | "closed" | "error";

type ServerEvent = {
  type?: string;
  delta?: unknown;
  message?: unknown;
  transcript?: unknown;
  callId?: unknown;
  name?: unknown;
  arguments?: unknown;
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
  const {
    saveSpokenTurns,
    activeChatId,
    activeTitle,
    activeProjectId,
    getActiveStore,
    getActiveChatId,
    selectChat,
    wasSendPrepared,
    clearPendingMessage,
    recoverDeadSession,
  } = useChats();
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
  /**
   * Mute uplink while tools run and until Grok starts speaking the result.
   * Ref-count so parallel/queued tools cannot clear busy early.
   */
  const toolBusyCountRef = useRef(0);
  const awaitAudioAfterToolRef = useRef(false);
  const postToolAudioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toolQueueRef = useRef<Promise<void>>(Promise.resolve());
  /** Spoken turns + ask_pearl default; never retargeted by create_chat. */
  const voiceAnchorChatIdRef = useRef<string | null>(activeChatId);
  const drainTailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const levelTickRef = useRef(0);
  const voiceRef = useRef<LiveVoice | null>(null);
  const iosDuplex = Platform.OS === "ios";

  const [workCards, setWorkCards] = useState<readonly LiveWorkCardModel[]>([]);
  const [workStartedAt, setWorkStartedAt] = useState<number | null>(null);
  const [workNow, setWorkNow] = useState(() => Date.now());
  const workTaskRef = useRef<{
    toolName: string;
    taskMessage: string;
    phase: "running" | "answering" | "needs_input" | "error" | "done";
    errorText?: string;
    summaryText?: string;
  } | null>(null);

  const toolCtxRef = useRef<LiveToolExecContext | null>(null);
  toolCtxRef.current = {
    getStore: getActiveStore,
    getActiveChatId,
    activeProjectId,
    selectChat,
    wasSendPrepared,
    clearPendingMessage,
    recoverDeadSession,
    defaultChatId: voiceAnchorChatIdRef.current,
    onAnchorEnsured: (chatId) => {
      if (!voiceAnchorChatIdRef.current) voiceAnchorChatIdRef.current = chatId;
    },
  };

  const sendEvent = useCallback((event: object) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || closedRef.current) return;
    socket.send(JSON.stringify(event));
  }, []);

  const toolUplinkHeld = useCallback(
    () => toolBusyCountRef.current > 0 || awaitAudioAfterToolRef.current,
    [],
  );

  const syncToolVoiceMode = useCallback(() => {
    const busy = toolUplinkHeld();
    suppressMicRef.current = busy;
    if (busy) {
      // Post-tool reply audio: keep uplink held but show speaking, not "working".
      if (awaitAudioAfterToolRef.current && assistantAudibleRef.current) {
        setVoiceMode((current) => (current === "muted" ? current : "speaking"));
        return;
      }
      setVoiceMode((current) => (current === "muted" ? current : "working"));
      return;
    }
    if (!closedRef.current && !mutedRef.current) {
      setVoiceMode((current) =>
        current === "speaking" || current === "listening" ? current : "idle",
      );
    }
  }, [toolUplinkHeld]);

  const beginToolBusy = useCallback(() => {
    toolBusyCountRef.current += 1;
    syncToolVoiceMode();
  }, [syncToolVoiceMode]);

  const endToolBusy = useCallback(() => {
    toolBusyCountRef.current = Math.max(0, toolBusyCountRef.current - 1);
    syncToolVoiceMode();
  }, [syncToolVoiceMode]);

  const clearPostToolAudioWait = useCallback(() => {
    if (postToolAudioTimerRef.current) {
      clearTimeout(postToolAudioTimerRef.current);
      postToolAudioTimerRef.current = null;
    }
    if (!awaitAudioAfterToolRef.current) return;
    awaitAudioAfterToolRef.current = false;
    syncToolVoiceMode();
    if (workTaskRef.current?.phase === "answering") {
      workTaskRef.current = { ...workTaskRef.current, phase: "done" };
    }
  }, [syncToolVoiceMode]);

  const armPostToolAudioWait = useCallback(() => {
    awaitAudioAfterToolRef.current = true;
    syncToolVoiceMode();
    if (postToolAudioTimerRef.current) clearTimeout(postToolAudioTimerRef.current);
    postToolAudioTimerRef.current = setTimeout(() => {
      postToolAudioTimerRef.current = null;
      clearPostToolAudioWait();
    }, LIVE_POST_TOOL_AUDIO_TIMEOUT_MS);
  }, [clearPostToolAudioWait, syncToolVoiceMode]);

  const refreshWorkCards = useCallback(() => {
    const task = workTaskRef.current;
    if (!task) {
      setWorkCards([]);
      return;
    }
    try {
      const snapshot = getActiveStore().snapshot;
      const primary = primaryAskPearlCard({
        toolName: task.toolName,
        taskMessage: task.taskMessage,
        phase: task.phase,
        messages: snapshot.messages,
        storeWaiting: hasPendingAction(snapshot),
        errorText: task.errorText,
        summaryText: task.summaryText,
      });
      const nested =
        task.toolName === "ask_pearl"
          ? nestedSubagentCards({
              events: snapshot.events,
              agents: snapshot.agents,
            })
          : [];
      setWorkCards([primary, ...nested]);
    } catch {
      setWorkCards([
        {
          key: "ask",
          label: liveToolActivityLabel(task.toolName),
          state: task.phase === "error" ? "failed" : "working",
          activity: liveToolActivityLabel(task.toolName),
        },
      ]);
    }
  }, [getActiveStore]);

  const handleFunctionCall = useCallback(
    (input: {
      readonly callId: string;
      readonly name: string;
      readonly arguments: string;
    }) => {
      toolQueueRef.current = toolQueueRef.current.then(async () => {
        const ctx = toolCtxRef.current;
        if (!ctx) return;

        let taskMessage = "";
        try {
          const parsed = JSON.parse(input.arguments || "{}") as {
            message?: unknown;
          };
          if (typeof parsed.message === "string") taskMessage = parsed.message;
        } catch {
          taskMessage = "";
        }

        beginToolBusy();
        workTaskRef.current = {
          toolName: input.name,
          taskMessage,
          phase: "running",
        };
        setWorkStartedAt(Date.now());
        refreshWorkCards();

        let outputPayload: unknown = { error: "Tool cancelled." };
        try {
          const result = await executeLiveChatTool(input.name, input.arguments, {
            ...ctx,
            defaultChatId: voiceAnchorChatIdRef.current,
          });
          outputPayload = result;

          if (
            result &&
            typeof result === "object" &&
            "status" in result &&
            (result as { status?: string }).status === "needs_input"
          ) {
            workTaskRef.current = {
              toolName: input.name,
              taskMessage,
              phase: "needs_input",
              summaryText: (result as { summary?: string }).summary,
            };
          } else if (
            result &&
            typeof result === "object" &&
            "status" in result &&
            (result as { status?: string }).status === "error"
          ) {
            workTaskRef.current = {
              toolName: input.name,
              taskMessage,
              phase: "error",
              errorText: (result as { error?: string }).error,
            };
          } else if (
            result &&
            typeof result === "object" &&
            "status" in result &&
            (result as { status?: string }).status === "ok"
          ) {
            workTaskRef.current = {
              toolName: input.name,
              taskMessage,
              phase: "answering",
              summaryText: (result as { reply?: string }).reply,
            };
          } else {
            workTaskRef.current = {
              toolName: input.name,
              taskMessage,
              phase: "answering",
              summaryText:
                typeof result === "object" ? JSON.stringify(result).slice(0, 400) : String(result),
            };
          }
          refreshWorkCards();
        } catch (cause) {
          outputPayload = {
            error:
              cause instanceof Error ? cause.message : "Tool execution failed.",
          };
          workTaskRef.current = {
            toolName: input.name,
            taskMessage,
            phase: "error",
            errorText:
              cause instanceof Error ? cause.message : "Tool execution failed.",
          };
          refreshWorkCards();
        }

        const socket = socketRef.current;
        const canSend =
          socket != null &&
          socket.readyState === WebSocket.OPEN;
        if (canSend) {
          sendEvent(
            liveFunctionCallOutputEvent({
              callId: input.callId,
              name: input.name,
              output: JSON.stringify(outputPayload),
            }),
          );
          if (!closedRef.current) {
            sendEvent(liveGreetingResponseEvent());
            armPostToolAudioWait();
          }
        }

        endToolBusy();
        if (closedRef.current || workTaskRef.current?.phase === "error") {
          // Leave error/needs_input cards visible briefly; clear busy wait.
          if (workTaskRef.current?.phase === "error") {
            awaitAudioAfterToolRef.current = false;
            syncToolVoiceMode();
          }
        }
      });
    },
    [
      armPostToolAudioWait,
      beginToolBusy,
      endToolBusy,
      refreshWorkCards,
      sendEvent,
      syncToolVoiceMode,
    ],
  );

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
    toolBusyCountRef.current = 0;
    awaitAudioAfterToolRef.current = false;
    if (postToolAudioTimerRef.current) {
      clearTimeout(postToolAudioTimerRef.current);
      postToolAudioTimerRef.current = null;
    }
    workTaskRef.current = null;
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
    const targetId = voiceAnchorChatIdRef.current;
    void (async () => {
      if (targetId && targetId !== getActiveChatId()) {
        await selectChat(targetId);
      }
      await saveSpokenTurns(spokenTurns);
      onClose();
    })().catch((cause: unknown) => {
      endingRef.current = false;
      setHandoffError(
        cause instanceof Error
          ? cause.message
          : "Could not save the live conversation to this chat.",
      );
    });
  }, [
    clearDrainTail,
    getActiveChatId,
    onClose,
    saveSpokenTurns,
    selectChat,
    stopPlayback,
  ]);

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
        // Tool waits must not be cleared by barge-in noise.
        if (toolUplinkHeld()) return;
        if (level < LIVE_BARGE_IN_LEVEL) return;
        stopPlayback();
        suppressMicRef.current = false;
        setVoiceMode("listening");
      }
      if (toolUplinkHeld()) return;
      // iOS: hold through the greeting; then open mic, mute only the post-drain flush
      // (and while an eve tool is running).
      if (
        iosDuplex &&
        !shouldUploadIosMicFrame({
          holdUplink: holdUplinkRef.current,
          inPlaybackTail: inPlaybackTailRef.current,
          toolBusy: toolUplinkHeld(),
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
  }, [iosDuplex, sendEvent, stopPlayback, toolUplinkHeld]);

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
          voiceAnchorChatIdRef.current =
            getActiveChatId() ?? voiceAnchorChatIdRef.current;
          const chatId = voiceAnchorChatIdRef.current;
          let transcript: string | null = null;
          if (chatId) {
            try {
              const messages = getActiveStore().snapshot.messages;
              if (messages.length > 0) {
                transcript = formatTranscriptLines(
                  activeTitle || "Current chat",
                  linesFromEveMessages(messages),
                  2_000,
                );
              }
            } catch {
              transcript = null;
            }
          }
          sendEvent(
            liveSessionUpdateEvent({
              instructions: buildLiveInstructions({
                chatId,
                title: activeTitle,
                transcript,
              }),
              tools: LIVE_CHAT_TOOLS,
            }),
          );
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
              // Keep uplink muted through the whole post-tool reply — clearing on
              // the first delta let her own speech trip VAD as the user.
              if (
                awaitAudioAfterToolRef.current &&
                workTaskRef.current?.phase === "answering"
              ) {
                workTaskRef.current = { ...workTaskRef.current, phase: "done" };
                refreshWorkCards();
              }
              if (iosDuplex) {
                markAssistantAudible();
                if (awaitAudioAfterToolRef.current) syncToolVoiceMode();
                voiceRef.current?.enqueuePcm16Base64(message.delta);
              } else {
                for (const chunk of playbackRef.current.pushBase64(message.delta)) enqueueWav(chunk);
              }
            } else if (message.type === "audio-done" || message.type === "response-done") {
              if (awaitAudioAfterToolRef.current) clearPostToolAudioWait();
              if (iosDuplex) {
                noteModelAudioDone();
              } else {
                const tail = playbackRef.current.flush();
                if (tail) enqueueWav(tail);
                awaitPlaybackDrainRef.current = true;
                settleAfterPlayback();
              }
            } else if (message.type === "speech-started") {
              // During the greeting hold, tool wait, or post-tool reply, treat
              // speech-started as echo — clear the buffer and keep going.
              if (iosDuplex && (holdUplinkRef.current || toolUplinkHeld())) {
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
              // Greeting-hold / tool-busy echo must not become a saved user turn.
              if (iosDuplex && (holdUplinkRef.current || toolUplinkHeld())) continue;
              const text = message.transcript.trim();
              if (text) {
                turnsRef.current = [...turnsRef.current, { role: "user", text }];
                setTurns(turnsRef.current);
              }
              if (!iosDuplex && !suppressMicRef.current && !mutedRef.current) setVoiceMode("idle");
            } else if (
              message.type === "function-call-arguments-done" &&
              typeof message.callId === "string" &&
              typeof message.name === "string"
            ) {
              const args =
                typeof message.arguments === "string" ? message.arguments : "{}";
              void handleFunctionCall({
                callId: message.callId,
                name: message.name,
                arguments: args,
              });
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
    activeTitle,
    clearDrainTail,
    clearPostToolAudioWait,
    enqueueWav,
    getActiveChatId,
    getActiveStore,
    handleFunctionCall,
    iosDuplex,
    markAssistantAudible,
    noteModelAudioDone,
    notePlaybackDrained,
    refreshWorkCards,
    sendEvent,
    settleAfterPlayback,
    stopPlayback,
    syncToolVoiceMode,
    toolUplinkHeld,
  ]);

  // 1 Hz clock + store subscription while a live work card is active.
  useEffect(() => {
    if (workStartedAt == null) return;
    const tick = () => {
      setWorkNow(Date.now());
      refreshWorkCards();
    };
    tick();
    const timer = setInterval(tick, 1000);
    let unsub: (() => void) | undefined;
    try {
      unsub = getActiveStore().subscribe(() => refreshWorkCards());
    } catch {
      unsub = undefined;
    }
    return () => {
      clearInterval(timer);
      unsub?.();
    };
  }, [getActiveStore, refreshWorkCards, workStartedAt]);

  useEffect(() => {
    if (workCards.length === 0) return;
    const allSettled = workCards.every(
      (card) => card.state === "done" || card.state === "failed" || card.state === "cancelled",
    );
    if (!allSettled || toolUplinkHeld()) return;
    const clearTimer = setTimeout(() => {
      if (toolUplinkHeld()) return;
      workTaskRef.current = null;
      setWorkCards([]);
      setWorkStartedAt(null);
    }, 2500);
    return () => clearTimeout(clearTimer);
  }, [toolUplinkHeld, workCards]);

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
          ) : workCards.length === 0 ? (
            <Text variant="secondary" className="text-center opacity-60">
              {phase === "connecting" ? "Starting…" : liveVoiceStatusLabel(orbMode)}
            </Text>
          ) : null}
          <LiveWorkCards
            cards={workCards}
            startedAt={workStartedAt}
            now={workNow}
          />
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
