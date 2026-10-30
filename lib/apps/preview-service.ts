import { put } from "@vercel/blob";
import { Sandbox } from "@vercel/sandbox";

import {
  getMiniApp,
  updateMiniApp,
  type MiniApp,
  type MiniAppPublic,
  toPublicMiniApp,
} from "./queries.ts";
import {
  DEFAULT_PREVIEW_PORT,
  mergePreviewPorts,
} from "./preview-ports.ts";

/** Minimal sandbox surface used by preview/screenshot (mockable in tests). */
export type PreviewSandbox = {
  update(params: {
    readonly ports?: number[];
    readonly networkPolicy?: { readonly allow?: readonly string[] };
  }): Promise<void>;
  domain(port: number): string;
  runCommand(params: {
    readonly cmd: string;
    readonly args?: string[];
    readonly cwd?: string;
    readonly env?: Record<string, string>;
    readonly detached?: boolean;
  }): Promise<{
    readonly exitCode: number | null;
    stdout(): Promise<string>;
    stderr(): Promise<string>;
  }>;
  readFileToBuffer(params: {
    readonly path: string;
  }): Promise<Buffer | null | undefined>;
};

type AppStore = {
  get(userId: string, appId: string): Promise<MiniApp | null>;
  update(
    userId: string,
    appId: string,
    patch: {
      readonly previewUrl?: string | null;
      readonly previewPort?: number;
    },
  ): Promise<MiniApp | null>;
};

const defaultStore: AppStore = {
  get: getMiniApp,
  update: updateMiniApp,
};

export type EnsureAppPreviewInput = {
  readonly userId: string;
  readonly appId: string;
  readonly port?: number;
  /** Injected for tests. */
  readonly getSandbox?: (name: string) => Promise<PreviewSandbox>;
  readonly store?: AppStore;
};

export type CaptureAppScreenshotInput = {
  readonly userId: string;
  readonly appId: string;
  readonly getSandbox?: (name: string) => Promise<PreviewSandbox>;
  readonly store?: AppStore;
  readonly uploadPng?: (args: {
    readonly pathname: string;
    readonly body: Buffer;
  }) => Promise<{ readonly url: string; readonly contentType: string }>;
};

const PREVIEW_NETWORK_ALLOW = [
  "registry.npmjs.org",
  "*.npmjs.org",
  "nodejs.org",
  "*.nodejs.org",
  "playwright.azureedge.net",
  "cdn.playwright.dev",
  "*.playwright.dev",
  "storage.googleapis.com",
  "*.githubusercontent.com",
  "github.com",
  "api.github.com",
] as const;

const SCREENSHOT_PATH = "/workspace/.pearl-preview.png";

async function defaultGetSandbox(name: string): Promise<PreviewSandbox> {
  return Sandbox.get({ name }) as unknown as PreviewSandbox;
}

async function defaultUploadPng(args: {
  readonly pathname: string;
  readonly body: Buffer;
}): Promise<{ readonly url: string; readonly contentType: string }> {
  const blob = await put(args.pathname, args.body, {
    access: "public",
    addRandomSuffix: true,
    contentType: "image/png",
  });
  return { url: blob.url, contentType: blob.contentType ?? "image/png" };
}

async function isDevServerUp(
  sandbox: PreviewSandbox,
  port: number,
): Promise<boolean> {
  const probe = await sandbox.runCommand({
    cmd: "bash",
    args: [
      "-c",
      `curl -sf --max-time 2 "http://127.0.0.1:${port}/" >/dev/null`,
    ],
  });
  return probe.exitCode === 0;
}

async function startDevServer(
  sandbox: PreviewSandbox,
  port: number,
): Promise<void> {
  await sandbox.runCommand({
    cmd: "bash",
    args: [
      "-c",
      [
        "cd /workspace",
        "if [ ! -d node_modules ]; then npm install --no-fund --no-audit; fi",
        `nohup npx next dev --hostname 0.0.0.0 -p ${port} > /tmp/pearl-next-dev.log 2>&1 &`,
        "echo $!",
      ].join(" && "),
    ],
    detached: true,
  });

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await isDevServerUp(sandbox, port)) return;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(
    `Dev server on port ${port} did not become ready within 90s. Check /tmp/pearl-next-dev.log in the sandbox.`,
  );
}

/**
 * Expose the sandbox preview port (keeping the harness relay), start Next if
 * needed, and return the public `*.vercel.run` URL.
 */
export async function ensurePreviewOnSandbox(
  sandbox: PreviewSandbox,
  port: number = DEFAULT_PREVIEW_PORT,
): Promise<string> {
  const ports = mergePreviewPorts(port);
  await sandbox.update({
    ports,
    networkPolicy: { allow: [...PREVIEW_NETWORK_ALLOW] },
  });

  if (!(await isDevServerUp(sandbox, port))) {
    await startDevServer(sandbox, port);
  }

  return sandbox.domain(port);
}

/**
 * Start (or refresh) a draft preview for a mini app and persist `previewUrl`.
 */
export async function ensureAppPreview(
  input: EnsureAppPreviewInput,
): Promise<
  | {
      readonly status: "ok";
      readonly app: MiniAppPublic;
      readonly previewUrl: string;
    }
  | { readonly status: "error"; readonly error: string }
> {
  const store = input.store ?? defaultStore;
  const app = await store.get(input.userId, input.appId);
  if (!app) {
    return { status: "error", error: "Mini app not found." };
  }
  if (!app.sandboxName.startsWith("dh-")) {
    return {
      status: "error",
      error:
        "Sandbox is not ready yet. Run code_with_fx first so the Vercel Sandbox exists.",
    };
  }

  const port = input.port ?? app.previewPort ?? DEFAULT_PREVIEW_PORT;
  const getSandbox = input.getSandbox ?? defaultGetSandbox;

  try {
    const sandbox = await getSandbox(app.sandboxName);
    const previewUrl = await ensurePreviewOnSandbox(sandbox, port);
    const updated = await store.update(input.userId, app.id, {
      previewUrl,
      previewPort: port,
    });
    return {
      status: "ok",
      app: toPublicMiniApp(updated ?? { ...app, previewUrl, previewPort: port }),
      previewUrl,
    };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runScreenshotInSandbox(
  sandbox: PreviewSandbox,
  targetUrl: string,
): Promise<Buffer> {
  const script = `
set -euo pipefail
cd /workspace
mkdir -p /workspace/.pearl-tools
cd /workspace/.pearl-tools
if [ ! -d node_modules/playwright-core ]; then
  npm init -y >/dev/null 2>&1 || true
  npm install --no-fund --no-audit playwright-core@1.55.0
  npx playwright-core install chromium
fi
export PREVIEW_URL=${JSON.stringify(targetUrl)}
export SCREENSHOT_PATH=${JSON.stringify(SCREENSHOT_PATH)}
node <<'NODE'
const { chromium } = require("playwright-core");
(async () => {
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(process.env.PREVIEW_URL, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  await page.screenshot({ path: process.env.SCREENSHOT_PATH, fullPage: true });
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
`.trim();

  const result = await sandbox.runCommand({
    cmd: "bash",
    args: ["-c", script],
  });
  if (result.exitCode !== 0) {
    const err = await result.stderr();
    throw new Error(
      `Screenshot command failed (exit ${result.exitCode}): ${err.slice(0, 500)}`,
    );
  }

  const buf = await sandbox.readFileToBuffer({ path: SCREENSHOT_PATH });
  if (!buf || buf.byteLength === 0) {
    throw new Error("Screenshot file was empty or missing.");
  }
  return Buffer.from(buf);
}

/**
 * Capture a PNG of the app preview (or production URL) and upload to Blob.
 */
export async function captureAppScreenshot(
  input: CaptureAppScreenshotInput,
): Promise<
  | {
      readonly status: "ok";
      readonly url: string;
      readonly contentType: string;
      readonly previewUrl: string;
    }
  | { readonly status: "error"; readonly error: string }
> {
  const store = input.store ?? defaultStore;
  const app = await store.get(input.userId, input.appId);
  if (!app) {
    return { status: "error", error: "Mini app not found." };
  }

  const getSandbox = input.getSandbox ?? defaultGetSandbox;
  const uploadPng = input.uploadPng ?? defaultUploadPng;

  try {
    if (!app.sandboxName.startsWith("dh-")) {
      return {
        status: "error",
        error: "Sandbox is not ready for screenshots.",
      };
    }

    let targetUrl = app.productionUrl;
    if (!targetUrl) {
      const ensured = await ensureAppPreview({
        userId: input.userId,
        appId: input.appId,
        getSandbox,
        store,
      });
      if (ensured.status !== "ok") {
        return ensured;
      }
      targetUrl = ensured.previewUrl;
    }

    if (!targetUrl) {
      return {
        status: "error",
        error: "No preview or production URL available to screenshot.",
      };
    }

    const sandbox = await getSandbox(app.sandboxName);
    await sandbox.update({
      networkPolicy: { allow: [...PREVIEW_NETWORK_ALLOW] },
    });
    const png = await runScreenshotInSandbox(sandbox, targetUrl);
    const uploaded = await uploadPng({
      pathname: `pearl-apps/${app.id}/preview.png`,
      body: png,
    });

    return {
      status: "ok",
      url: uploaded.url,
      contentType: uploaded.contentType,
      previewUrl: targetUrl,
    };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
