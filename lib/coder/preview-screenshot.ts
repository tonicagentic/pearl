import { put } from "@vercel/blob";
import { Sandbox } from "@vercel/sandbox";

export type CaptureResult =
  | { readonly status: "ok"; readonly url: string }
  | { readonly status: "error"; readonly error: string };

export type RecordingCaptureResult =
  | {
      readonly status: "ok";
      readonly url: string;
      readonly durationMs: number;
      readonly posterUrl?: string;
    }
  | { readonly status: "error"; readonly error: string };

const PLAYWRIGHT_INSTALL = [
  "set -e",
  "cd /tmp",
  "npm init -y >/dev/null",
  "npm install --no-fund --no-audit playwright-core@1.65.0 >/dev/null",
  "npx playwright-core install --with-deps chromium >/dev/null",
].join("\n");

async function withPlaywrightSandbox<T>(
  run: (sandbox: Sandbox) => Promise<T>,
): Promise<T> {
  let sandbox: Sandbox | null = null;
  try {
    sandbox = await Sandbox.create({
      timeout: 5 * 60 * 1000,
      resources: { vcpus: 2 },
      networkPolicy: "allow-all",
    });
    const install = await sandbox.runCommand({
      cmd: "bash",
      args: ["-c", PLAYWRIGHT_INSTALL],
    });
    if (install.exitCode !== 0) {
      throw new Error("Failed to install Playwright in the capture sandbox.");
    }
    return await run(sandbox);
  } finally {
    try {
      await sandbox?.stop();
    } catch {
      // ignore
    }
  }
}

/**
 * Best-effort screenshot of a public HTTPS URL using a short-lived Vercel
 * Sandbox with Playwright. Kept out of the coder image on purpose.
 */
export async function captureUrlScreenshot(
  targetUrl: string,
): Promise<CaptureResult> {
  if (!/^https:\/\//i.test(targetUrl)) {
    return { status: "error", error: "Screenshot URL must be https." };
  }

  try {
    return await withPlaywrightSandbox(async (sandbox) => {
      const script = `
const { chromium } = require("playwright-core");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(${JSON.stringify(targetUrl)}, { waitUntil: "networkidle", timeout: 45000 });
  await page.screenshot({ path: "/tmp/preview.png", fullPage: false });
  await browser.close();
})().catch((err) => { console.error(err); process.exit(1); });
`;
      await sandbox.writeFiles([
        { path: "/tmp/shot.js", content: Buffer.from(script, "utf8") },
      ]);
      const shot = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", "node /tmp/shot.js"],
      });
      if (shot.exitCode !== 0) {
        const err = await shot.stderr();
        return {
          status: "error" as const,
          error: `Screenshot failed: ${err.slice(0, 400)}`,
        };
      }

      const read = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", "base64 -w0 /tmp/preview.png"],
      });
      if (read.exitCode !== 0) {
        return { status: "error" as const, error: "Could not read screenshot bytes." };
      }
      const b64 = (await read.stdout()).trim();
      const bytes = Buffer.from(b64, "base64");
      const blob = await put(`pearl-coder/previews/${Date.now()}.png`, bytes, {
        access: "public",
        contentType: "image/png",
      });
      return { status: "ok" as const, url: blob.url };
    });
  } catch (cause) {
    return {
      status: "error",
      error:
        cause instanceof Error
          ? cause.message
          : "Screenshot sandbox failed.",
    };
  }
}

const RECORDING_DURATION_MS = 8_000;

/**
 * Short Playwright screen recording of a public HTTPS URL: load, wait, one
 * slow scroll. Uploads webm to Blob. Kept out of the coder image on purpose.
 */
export async function captureUrlRecording(
  targetUrl: string,
): Promise<RecordingCaptureResult> {
  if (!/^https:\/\//i.test(targetUrl)) {
    return { status: "error", error: "Recording URL must be https." };
  }

  try {
    return await withPlaywrightSandbox(async (sandbox) => {
      const script = `
const { chromium } = require("playwright-core");
const fs = require("fs");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: "/tmp/videos", size: { width: 1280, height: 800 } },
  });
  const page = await context.newPage();
  await page.goto(${JSON.stringify(targetUrl)}, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/tmp/preview-poster.png", fullPage: false });
  await page.evaluate(async () => {
    const distance = Math.min(document.body.scrollHeight, 1200);
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      window.scrollBy(0, distance / steps);
      await new Promise((r) => setTimeout(r, ${Math.floor(RECORDING_DURATION_MS / 24)}));
    }
  });
  await page.waitForTimeout(800);
  await context.close();
  await browser.close();
  const dir = "/tmp/videos";
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".webm"));
  if (!files.length) throw new Error("No video file produced.");
  fs.renameSync(dir + "/" + files[0], "/tmp/preview.webm");
})().catch((err) => { console.error(err); process.exit(1); });
`;
      await sandbox.writeFiles([
        { path: "/tmp/record.js", content: Buffer.from(script, "utf8") },
      ]);
      const recorded = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", "node /tmp/record.js"],
      });
      if (recorded.exitCode !== 0) {
        const err = await recorded.stderr();
        return {
          status: "error" as const,
          error: `Recording failed: ${err.slice(0, 400)}`,
        };
      }

      const readVideo = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", "base64 -w0 /tmp/preview.webm"],
      });
      if (readVideo.exitCode !== 0) {
        return { status: "error" as const, error: "Could not read recording bytes." };
      }
      const videoBytes = Buffer.from((await readVideo.stdout()).trim(), "base64");
      const stamp = Date.now();
      const videoBlob = await put(
        `pearl-coder/previews/${stamp}.webm`,
        videoBytes,
        { access: "public", contentType: "video/webm" },
      );

      let posterUrl: string | undefined;
      const readPoster = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", "base64 -w0 /tmp/preview-poster.png"],
      });
      if (readPoster.exitCode === 0) {
        const posterBytes = Buffer.from(
          (await readPoster.stdout()).trim(),
          "base64",
        );
        const posterBlob = await put(
          `pearl-coder/previews/${stamp}-poster.png`,
          posterBytes,
          { access: "public", contentType: "image/png" },
        );
        posterUrl = posterBlob.url;
      }

      return {
        status: "ok" as const,
        url: videoBlob.url,
        durationMs: RECORDING_DURATION_MS,
        ...(posterUrl ? { posterUrl } : {}),
      };
    });
  } catch (cause) {
    return {
      status: "error",
      error:
        cause instanceof Error
          ? cause.message
          : "Recording sandbox failed.",
    };
  }
}

/** Heuristic: Vercel / SSO login pages are not useful preview embeds. */
export function detectAuthWall(input: {
  readonly url: string;
  readonly finalUrl?: string | null;
  readonly httpStatus?: number | null;
  readonly bodySnippet?: string | null;
}): boolean {
  const status = input.httpStatus ?? 0;
  if (status === 401 || status === 403) return true;
  const haystack = [
    input.url,
    input.finalUrl ?? "",
    input.bodySnippet ?? "",
  ]
    .join("\n")
    .toLowerCase();
  return (
    /vercel\.com\/login/.test(haystack) ||
    /authentication required/.test(haystack) ||
    /sso\.vercel/.test(haystack) ||
    /vercel authentication/.test(haystack) ||
    /sign in to continue/.test(haystack)
  );
}
