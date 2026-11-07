import assert from "node:assert/strict";
import { test } from "node:test";

import { GATEWAY_PROVIDER_OPTIONS } from "../agent/agent.ts";
import {
  describeLiveTokenError,
  LIVE_MODEL_ID,
} from "../lib/live-token.ts";
import {
  LIVE_BARGE_IN_LEVEL,
  LIVE_CAPTURE_SAMPLE_RATE,
  LIVE_FRAME_MAX_BYTES,
  LIVE_PLAYBACK_CHUNK_BYTES,
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
  liveSocketProtocols,
  liveVoiceStatusLabel,
  pcm16PeakLevel,
  resampleLinear,
  wavFromPcm16,
} from "../mobile/src/live-media.ts";

test("live session config stays voice-first without gateway providerOptions", () => {
  // Chat still uses ZDR; realtime client-secret mint cannot pin it today.
  assert.equal(GATEWAY_PROVIDER_OPTIONS.zeroDataRetention, true);
  assert.equal(GATEWAY_PROVIDER_OPTIONS.disallowPromptTraining, true);
  assert.equal("providerOptions" in LIVE_SESSION_CONFIG, false);
  assert.equal(LIVE_MODEL_ID, "openai/gpt-realtime-mini");
  assert.equal(LIVE_SESSION_CONFIG.turnDetection.type, "server-vad");
  assert.equal(liveGreetingResponseEvent().type, "response-create");
});

test("pcm peak level and voice labels support the speaking orb", () => {
  const silent = new Uint8Array(4);
  assert.equal(pcm16PeakLevel(silent), 0);
  const loud = new Uint8Array(4);
  new DataView(loud.buffer).setInt16(0, 20000, true);
  new DataView(loud.buffer).setInt16(2, -20000, true);
  assert.ok(pcm16PeakLevel(loud) > LIVE_BARGE_IN_LEVEL);
  assert.equal(liveVoiceStatusLabel("speaking"), "Pearl is talking");
  assert.equal(liveVoiceStatusLabel("listening"), "You're talking");
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
  assert.equal(isFatalLiveError("unknown event type"), false);
});
