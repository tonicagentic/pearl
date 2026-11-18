import assert from "node:assert/strict";
import { test } from "node:test";

import { GATEWAY_PROVIDER_OPTIONS } from "../agent/agent.ts";
import {
  describeLiveTokenError,
  LIVE_MODEL_ID,
} from "../lib/live-token.ts";
import {
  isLiveHistoryId,
  spokenTurnsAsHistory,
  toSpokenTurns,
} from "../lib/chat/spoken-turns.ts";
import {
  LIVE_CHAT_TOOLS,
  LIVE_POST_TOOL_AUDIO_TIMEOUT_MS,
  buildLiveInstructions,
  formatLiveElapsed,
  formatTranscriptLines,
  liveFunctionCallOutputEvent,
  liveToolActivityLabel,
  linesFromChatEvents,
  primaryAskPearlCard,
  raceWithTimeout,
  truncateForVoice,
} from "../mobile/src/live-chat-tools.ts";
import {
  LIVE_BARGE_IN_LEVEL,
  LIVE_CAPTURE_SAMPLE_RATE,
  LIVE_FRAME_MAX_BYTES,
  LIVE_PLAYBACK_CHUNK_BYTES,
  LIVE_PLAYBACK_TAIL_MS,
  LIVE_SAMPLE_RATE,
  LIVE_SESSION_CONFIG,
  PcmPlaybackBuffer,
  base64ToBytes,
  bytesToBase64,
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
  resampleLinear,
  shouldUploadIosMicFrame,
  shouldUploadWhileSpeaking,
  wavFromPcm16,
} from "../mobile/src/live-media.ts";

test("live session config stays voice-first without gateway providerOptions", () => {
  // Chat still uses ZDR; realtime client-secret mint cannot pin it today.
  assert.equal(GATEWAY_PROVIDER_OPTIONS.zeroDataRetention, true);
  assert.equal(GATEWAY_PROVIDER_OPTIONS.disallowPromptTraining, true);
  assert.equal("providerOptions" in LIVE_SESSION_CONFIG, false);
  assert.equal(LIVE_MODEL_ID, "spacexai/grok-voice-3.0");
  assert.equal(LIVE_SESSION_CONFIG.voice, "coral");
  assert.equal(LIVE_SESSION_CONFIG.turnDetection.type, "server-vad");
  assert.equal(LIVE_SESSION_CONFIG.turnDetection.threshold, 0.6);
  assert.equal(liveGreetingResponseEvent().type, "response-create");
  assert.ok(LIVE_CHAT_TOOLS.some((tool) => tool.name === "ask_pearl"));
  assert.ok(LIVE_CHAT_TOOLS.some((tool) => tool.name === "list_chats"));
  const update = liveSessionUpdateEvent({
    instructions: buildLiveInstructions({ chatId: "c1", title: "Hello" }),
    tools: LIVE_CHAT_TOOLS,
  });
  assert.equal(update.type, "session-update");
  assert.match(update.config.instructions, /Current chat id: c1/);
  assert.ok(update.config.tools.some((tool) => tool.name === "ask_pearl"));
});

test("pcm peak level and voice labels support the speaking orb", () => {
  const silent = new Uint8Array(4);
  assert.equal(pcm16PeakLevel(silent), 0);
  const loud = new Uint8Array(4);
  new DataView(loud.buffer).setInt16(0, 20000, true);
  new DataView(loud.buffer).setInt16(2, -20000, true);
  assert.ok(pcm16PeakLevel(loud) > LIVE_BARGE_IN_LEVEL);
  // Android half-duplex still uses a peak barge-in while Pearl is playing.
  assert.equal(shouldUploadWhileSpeaking(0), false);
  assert.equal(shouldUploadWhileSpeaking(LIVE_BARGE_IN_LEVEL - 0.01), false);
  assert.equal(shouldUploadWhileSpeaking(LIVE_BARGE_IN_LEVEL), true);
  assert.equal(liveVoiceStatusLabel("speaking"), "Pearl is talking");
  assert.equal(liveVoiceStatusLabel("listening"), "You're talking");
});

test("iOS holds the uplink through the greeting, then opens with a short drain tail", () => {
  assert.equal(LIVE_PLAYBACK_TAIL_MS, 400);
  // Opening greeting: AEC has not converged — drop every frame.
  assert.equal(
    shouldUploadIosMicFrame({ holdUplink: true, inPlaybackTail: false }),
    false,
  );
  // After the first reply, mic stays open while she talks.
  assert.equal(
    shouldUploadIosMicFrame({ holdUplink: false, inPlaybackTail: false }),
    true,
  );
  // After playback drains, the speaker flush is dropped for LIVE_PLAYBACK_TAIL_MS.
  assert.equal(
    shouldUploadIosMicFrame({ holdUplink: false, inPlaybackTail: true }),
    false,
  );
  // Eve tool waits must not upload ambient noise as the user.
  assert.equal(
    shouldUploadIosMicFrame({
      holdUplink: false,
      inPlaybackTail: false,
      toolBusy: true,
    }),
    false,
  );
  assert.equal(liveVoiceStatusLabel("working"), "Looking that up…");
});

test("live chat tools format transcripts and function-call outputs", () => {
  const lines = linesFromChatEvents([
    {
      type: "delivery.consumed",
      data: { parts: [{ kind: "text", text: " What did we decide? " }] },
    },
    {
      type: "content.completed",
      data: { kind: "text", phase: "reply", value: "Ship the timeline." },
    },
  ]);
  assert.deepEqual(lines, [
    { role: "user", text: "What did we decide?" },
    { role: "assistant", text: "Ship the timeline." },
  ]);
  const transcript = formatTranscriptLines("Timeline", lines, 40);
  assert.match(transcript, /Chat: Timeline/);
  assert.match(transcript, /truncated/i);
  assert.deepEqual(truncateForVoice("abcdef", 4), {
    text: "abc…",
    truncated: true,
  });
  assert.deepEqual(
    liveFunctionCallOutputEvent({
      callId: "call_1",
      name: "ask_pearl",
      output: "{\"status\":\"ok\"}",
    }),
    {
      type: "conversation-item-create",
      item: {
        type: "function-call-output",
        callId: "call_1",
        name: "ask_pearl",
        output: "{\"status\":\"ok\"}",
      },
    },
  );
  assert.equal(liveToolActivityLabel("ask_pearl"), "Asking Pearl…");
  assert.equal(liveToolActivityLabel("list_chats"), "Checking your chats…");
  assert.equal(formatLiveElapsed(65_000), "1:05");
  assert.equal(LIVE_POST_TOOL_AUDIO_TIMEOUT_MS, 8_000);
  const card = primaryAskPearlCard({
    toolName: "ask_pearl",
    taskMessage: "Summarize my inbox",
    phase: "answering",
    messages: [],
    storeWaiting: false,
    summaryText: "Three unread.",
  });
  assert.equal(card.state, "done");
  assert.equal(card.activity, "Got it — answering…");
});

test("raceWithTimeout rejects when the promise never settles", async () => {
  await assert.rejects(
    () => raceWithTimeout(new Promise(() => {}), 20, "probe"),
    /probe timed out/,
  );
  assert.equal(await raceWithTimeout(Promise.resolve(7), 100, "probe"), 7);
});

test("live turns map to eve history without a Pearl reply turn", () => {
  const turns = toSpokenTurns("chat-1", [
    { role: "user", text: " Hello " },
    { role: "pearl", text: "Hi there." },
    { role: "user", text: "   " },
  ]);
  assert.deepEqual(turns, [
    { id: "live:chat-1:0", role: "user", text: "Hello" },
    { id: "live:chat-1:1", role: "assistant", text: "Hi there." },
  ]);
  assert.equal(isLiveHistoryId(turns[0]?.id), true);
  assert.deepEqual(spokenTurnsAsHistory(turns), [
    { id: "live:chat-1:0", role: "user", text: "Hello" },
    { id: "live:chat-1:1", role: "assistant", text: "Hi there." },
  ]);
});

test("a data-policy mint failure is explained and other failures stay generic", () => {
  assert.equal(
    describeLiveTokenError(new Error("no_providers_available for zero data retention")),
    "Live mode is not available under the current data policy.",
  );
  assert.equal(
    describeLiveTokenError(
      new Error("Client secrets can only be minted with a Gateway API key"),
    ),
    "Live sessions need an AI Gateway API key on the server.",
  );
  assert.equal(
    describeLiveTokenError(new Error("gateway timeout")),
    "Could not start the live session.",
  );
});

test("pcm16 capture round-trips and resamples device capture to 24 kHz", () => {
  assert.equal(LIVE_CAPTURE_SAMPLE_RATE, 48_000);
  assert.notEqual(LIVE_CAPTURE_SAMPLE_RATE, LIVE_SAMPLE_RATE);

  const samples = new Float32Array([0, 0.5, -1, 0.25]);
  const pcm = captureToPcm16Base64({
    data: new Uint8Array(samples.buffer),
    encoding: "float32",
    sampleRate: LIVE_SAMPLE_RATE,
    channels: 1,
  });
  const decoded = base64ToBytes(pcm);
  assert.equal(decoded.byteLength, samples.length * 2);
  assert.deepEqual(base64ToBytes(bytesToBase64(decoded)), decoded);

  const fromCapture = captureToPcm16Base64({
    data: new Uint8Array(new Float32Array([0, 0.5, -1, 0.25, 0, 0.25, -0.5, 0.1]).buffer),
    encoding: "float32",
    sampleRate: LIVE_CAPTURE_SAMPLE_RATE,
    channels: 1,
  });
  assert.equal(base64ToBytes(fromCapture).byteLength, 4 * 2);

  const halved = resampleLinear(samples, LIVE_CAPTURE_SAMPLE_RATE, LIVE_SAMPLE_RATE);
  assert.equal(halved.length, 2);
});

test("playback chunks are 200 ms and a jpeg over the cap is not sent", () => {
  const buffer = new PcmPlaybackBuffer();
  const ready = buffer.push(new Uint8Array(LIVE_PLAYBACK_CHUNK_BYTES));
  assert.equal(ready.length, 1);
  assert.equal(ready[0]?.byteLength, LIVE_PLAYBACK_CHUNK_BYTES);
  assert.equal(buffer.flush(), null);

  const wav = wavFromPcm16(ready[0]);
  assert.equal(String.fromCharCode(...wav.subarray(0, 4)), "RIFF");
  assert.equal(wav.byteLength, 44 + LIVE_PLAYBACK_CHUNK_BYTES);

  assert.deepEqual(liveFrameEvent("abcd"), {
    type: "input-image-append",
    image: "abcd",
    mediaType: "image/jpeg",
  });
  assert.equal(liveFrameEvent("a".repeat(LIVE_FRAME_MAX_BYTES)), null);
  assert.equal(liveFrameEvent(""), null);
});

test("transcripts and socket protocols stay on the gateway live session", () => {
  assert.equal(formatLiveTranscript([]), null);
  assert.equal(
    formatLiveTranscript([
      { role: "user", text: " What is this? " },
      { role: "pearl", text: "A blue mug." },
    ]),
    "Live conversation\n\nUser: What is this?\nPearl: A blue mug.",
  );
  assert.deepEqual(liveSocketProtocols("vcst_test"), [
    "ai-gateway-realtime.v1",
    "ai-gateway-auth.vcst_test",
  ]);
  assert.equal(isVideoFrameRejection("unknown event type"), true);
  assert.equal(isFatalLiveError("no_providers_available"), true);
  assert.equal(isFatalLiveError("eve is not a valid voice"), true);
  assert.equal(isFatalLiveError("unknown event type"), false);
});
