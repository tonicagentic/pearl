// Opt-in, development-only stream diagnostics. Log timing and lengths, never
// message text, attachment names, credentials, or event payloads.
export function traceStream(stage: "delta" | "source" | "paint" | "settled", length: number, pending = 0) {
  if (!__DEV__ || process.env.EXPO_PUBLIC_STREAM_TRACE !== "1") return;
  console.info(`[stream-ui] ${stage} t=${Math.round(performance.now())}ms chars=${length} pending=${pending}`);
}
