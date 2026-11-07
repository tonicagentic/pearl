import assert from "node:assert/strict";
import { test } from "node:test";

import { GATEWAY_PROVIDER_OPTIONS } from "../agent/agent.ts";
import { describeLiveTokenError, LIVE_MODEL_ID } from "../lib/live-token.ts";
import {
  LIVE_FRAME_MAX_BYTES,
  LIVE_GATEWAY_OPTIONS,
  LIVE_PLAYBACK_CHUNK_BYTES,
  LIVE_SAMPLE_RATE,
  PcmPlaybackBuffer,
  base64ToBytes,
  bytesToBase64,
  captureToPcm16Base64,
  formatLiveTranscript,
  isFatalLiveError,
  isVideoFrameRejection,
  liveFrameEvent,
  liveSocketProtocols,
  resampleLinear,
  wavFromPcm16,
} from "../mobile/src/live-media.ts";

test("live routing matches the agent gateway data policy", () => {
  assert.deepEqual(LIVE_GATEWAY_OPTIONS, GATEWAY_PROVIDER_OPTIONS);
  assert.equal(LIVE_MODEL_ID, "google/gemini-3.8-live");
});

test("a data-policy mint failure is explained and other failures stay generic", () => {
  assert.equal(
    describeLiveTokenError(new Error("no_providers_available for zero data retention")),
    "Live video is not available under the current data policy.",
  );
  assert.equal(
    describeLiveTokenError(new Error("gateway timeout")),
    "Could not start the live session.",
  );
});

test("pcm16 capture round-trips and resamples to 24 kHz", () => {
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

  const halved = resampleLinear(samples, 48_000, LIVE_SAMPLE_RATE);
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
