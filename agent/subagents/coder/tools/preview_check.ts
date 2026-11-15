import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Fetch a deploy URL and return its HTTP status. For UI changes, also " +
    "pass screenshot:true to capture a PNG, and record:true for a short " +
    "screen recording, via Pearl's browser sandbox when available. Skip " +
    "record when the URL is an auth wall — a login page is not a demo.",
  inputSchema: z.object({
    url: z.string().url().describe("Preview or production URL to check."),
    screenshot: z
      .boolean()
      .nullish()
      .describe("When true, attempt a screenshot through the browser sandbox."),
    record: z
      .boolean()
      .nullish()
      .describe(
        "When true, attempt an ~8s screen recording. Ignored when the URL is an auth wall or HTTP check failed.",
      ),
  }),
  async execute(input) {
    let status: number | null = null;
    let ok = false;
    let error: string | undefined;
    let finalUrl: string | undefined;
    let bodySnippet: string | undefined;
    try {
      const res = await fetch(input.url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
      status = res.status;
      ok = res.ok;
      finalUrl = res.url;
      try {
        const text = await res.clone().text();
        bodySnippet = text.slice(0, 2_000);
      } catch {
        // ignore body read failures
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Fetch failed.";
    }

    const { detectAuthWall } = await import("@/lib/coder/preview-screenshot");
    const authWall = detectAuthWall({
      url: input.url,
      finalUrl,
      httpStatus: status,
      bodySnippet,
    });

    let screenshotUrl: string | undefined;
    if (input.screenshot && ok && !authWall) {
      try {
        const { captureUrlScreenshot } = await import(
          "@/lib/coder/preview-screenshot"
        );
        const shot = await captureUrlScreenshot(input.url);
        if (shot.status === "ok") screenshotUrl = shot.url;
        else error = [error, shot.error].filter(Boolean).join(" ");
      } catch (cause) {
        error = [
          error,
          cause instanceof Error
            ? cause.message
            : "Screenshot helper unavailable.",
        ]
          .filter(Boolean)
          .join(" ");
      }
    }

    let recordingUrl: string | undefined;
    let recordingPosterUrl: string | undefined;
    let recordingDurationMs: number | undefined;
    if (input.record && ok && !authWall) {
      try {
        const { captureUrlRecording } = await import(
          "@/lib/coder/preview-screenshot"
        );
        const clip = await captureUrlRecording(input.url);
        if (clip.status === "ok") {
          recordingUrl = clip.url;
          recordingPosterUrl = clip.posterUrl;
          recordingDurationMs = clip.durationMs;
        } else {
          error = [error, clip.error].filter(Boolean).join(" ");
        }
      } catch (cause) {
        error = [
          error,
          cause instanceof Error
            ? cause.message
            : "Recording helper unavailable.",
        ]
          .filter(Boolean)
          .join(" ");
      }
    }

    return {
      status: ok ? "ok" : "error",
      httpStatus: status,
      url: input.url,
      finalUrl,
      authWall,
      screenshotUrl,
      recordingUrl,
      recordingPosterUrl,
      recordingDurationMs,
      ...(ok ? {} : { error: error ?? `HTTP ${status}` }),
      ...(ok && error ? { warning: error } : {}),
    };
  },
});
