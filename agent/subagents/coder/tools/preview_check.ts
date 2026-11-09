import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Fetch a deploy URL and return its HTTP status. For UI changes, also " +
    "pass screenshot:true to capture a PNG via Pearl's browser sandbox when " +
    "available; otherwise returns status only.",
  inputSchema: z.object({
    url: z.string().url().describe("Preview or production URL to check."),
    screenshot: z
      .boolean()
      .nullish()
      .describe("When true, attempt a screenshot through the browser sandbox."),
  }),
  async execute(input) {
    let status: number | null = null;
    let ok = false;
    let error: string | undefined;
    try {
      const res = await fetch(input.url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
      status = res.status;
      ok = res.ok;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Fetch failed.";
    }

    let screenshotUrl: string | undefined;
    if (input.screenshot && ok) {
      try {
        const { captureUrlScreenshot } = await import("@/lib/coder/preview-screenshot");
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

    return {
      status: ok ? "ok" : "error",
      httpStatus: status,
      url: input.url,
      screenshotUrl,
      ...(ok ? {} : { error: error ?? `HTTP ${status}` }),
    };
  },
});
