import { put } from "@vercel/blob";
import { Sandbox } from "@vercel/sandbox";

export type CaptureResult =
  | { readonly status: "ok"; readonly url: string }
  | { readonly status: "error"; readonly error: string };

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

  let sandbox: Sandbox | null = null;
  try {
    sandbox = await Sandbox.create({
      timeout: 5 * 60 * 1000,
      resources: { vcpus: 2 },
      networkPolicy: "allow-all",
    });

    const install = await sandbox.runCommand({
      cmd: "bash",
      args: [
        "-c",
        [
          "set -e",
          "cd /tmp",
          "npm init -y >/dev/null",
          "npm install --no-fund --no-audit playwright-core@1.65.0 >/dev/null",
          "npx playwright-core install --with-deps chromium >/dev/null",
        ].join("\n"),
      ],
    });
    if (install.exitCode !== 0) {
      return {
        status: "error",
        error: "Failed to install Playwright for the screenshot.",
      };
    }

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
        status: "error",
        error: `Screenshot failed: ${err.slice(0, 400)}`,
      };
    }

    const read = await sandbox.runCommand({
      cmd: "bash",
      args: ["-c", "base64 -w0 /tmp/preview.png"],
    });
    if (read.exitCode !== 0) {
      return { status: "error", error: "Could not read screenshot bytes." };
    }
    const b64 = (await read.stdout()).trim();
    const bytes = Buffer.from(b64, "base64");
    const blob = await put(`pearl-coder/previews/${Date.now()}.png`, bytes, {
      access: "public",
      contentType: "image/png",
    });
    return { status: "ok", url: blob.url };
  } catch (cause) {
    return {
      status: "error",
      error:
        cause instanceof Error
          ? cause.message
          : "Screenshot sandbox failed.",
    };
  } finally {
    try {
      await sandbox?.stop();
    } catch {
      // ignore
    }
  }
}
