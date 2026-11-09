import { put } from "@vercel/blob";
import { Sandbox } from "@vercel/sandbox";

/** Minimal sandbox surface used by design rendering (mockable in tests). */
export type DesignRenderSandbox = {
  runCommand(params: {
    readonly cmd: string;
    readonly args?: string[];
    readonly cwd?: string;
    readonly env?: Record<string, string>;
  }): Promise<{
    readonly exitCode: number | null;
    stdout(): Promise<string>;
    stderr(): Promise<string>;
  }>;
  writeFiles(
    files: ReadonlyArray<{
      readonly path: string;
      readonly content: Buffer | string;
    }>,
  ): Promise<void>;
  readFileToBuffer(params: {
    readonly path: string;
  }): Promise<Buffer | null | undefined>;
  stop(): Promise<void>;
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
] as const;

const PDF_PATH = "/workspace/.pearl-design.pdf";
const HTML_PATH = "/workspace/.pearl-design-source.html";
const MMD_PATH = "/workspace/.pearl-design.mmd";
const SVG_PATH = "/workspace/.pearl-design.svg";

export type RenderPdfResult = {
  readonly url: string;
  readonly downloadUrl: string;
  readonly pathname: string;
  readonly contentType: string;
  readonly bytes: number;
};

export type RenderDiagramResult = {
  readonly svg: string;
  readonly url: string;
  readonly downloadUrl: string;
  readonly pathname: string;
  readonly contentType: string;
};

async function defaultCreateSandbox(): Promise<DesignRenderSandbox> {
  return (await Sandbox.create({
    name: `pearl-design-${Date.now().toString(36)}`,
    runtime: "node22",
    timeout: 10 * 60 * 1000,
    resources: { vcpus: 2 },
    networkPolicy: { allow: [...PREVIEW_NETWORK_ALLOW] },
  })) as unknown as DesignRenderSandbox;
}

async function uploadBinary(args: {
  readonly pathname: string;
  readonly body: Buffer;
  readonly contentType: string;
}): Promise<{
  readonly url: string;
  readonly downloadUrl: string;
  readonly pathname: string;
  readonly contentType: string;
}> {
  const blob = await put(args.pathname, args.body, {
    access: "public",
    addRandomSuffix: true,
    contentType: args.contentType,
  });
  return {
    url: blob.url,
    downloadUrl: blob.downloadUrl,
    pathname: blob.pathname,
    contentType: blob.contentType ?? args.contentType,
  };
}

async function ensurePlaywright(sandbox: DesignRenderSandbox): Promise<void> {
  const result = await sandbox.runCommand({
    cmd: "bash",
    args: [
      "-c",
      [
        "set -euo pipefail",
        "mkdir -p /workspace/.pearl-tools",
        "cd /workspace/.pearl-tools",
        "if [ ! -d node_modules/playwright-core ]; then",
        "  npm init -y >/dev/null 2>&1 || true",
        "  npm install --no-fund --no-audit playwright-core@1.55.0 mermaid@11.4.1",
        "  npx playwright-core install chromium",
        "fi",
      ].join("\n"),
    ],
  });
  if (result.exitCode !== 0) {
    const err = await result.stderr();
    throw new Error(`Playwright setup failed: ${err.slice(0, 500)}`);
  }
}

/**
 * Render print HTML to PDF in an ephemeral Vercel Sandbox with Playwright
 * Chromium (same approach as app screenshots).
 */
export async function renderHtmlToPdf(input: {
  readonly html: string;
  readonly pathname?: string;
  readonly createSandbox?: () => Promise<DesignRenderSandbox>;
  readonly upload?: typeof uploadBinary;
}): Promise<RenderPdfResult> {
  const createSandbox = input.createSandbox ?? defaultCreateSandbox;
  const upload = input.upload ?? uploadBinary;
  const sandbox = await createSandbox();

  try {
    await sandbox.writeFiles([{ path: HTML_PATH, content: input.html }]);
    await ensurePlaywright(sandbox);

    const script = `
set -euo pipefail
cd /workspace/.pearl-tools
export HTML_PATH=${JSON.stringify(HTML_PATH)}
export PDF_PATH=${JSON.stringify(PDF_PATH)}
node <<'NODE'
const { chromium } = require("playwright-core");
const fs = require("fs");
(async () => {
  const html = fs.readFileSync(process.env.HTML_PATH, "utf8");
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle", timeout: 60_000 });
  await page.pdf({
    path: process.env.PDF_PATH,
    printBackground: true,
    preferCSSPageSize: true,
  });
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
        `PDF render failed (exit ${result.exitCode}): ${err.slice(0, 500)}`,
      );
    }

    const buf = await sandbox.readFileToBuffer({ path: PDF_PATH });
    if (!buf || buf.byteLength === 0) {
      throw new Error("PDF file was empty or missing.");
    }
    const body = Buffer.from(buf);
    const uploaded = await upload({
      pathname: input.pathname ?? "design/print.pdf",
      body,
      contentType: "application/pdf",
    });
    return { ...uploaded, bytes: body.byteLength };
  } finally {
    await sandbox.stop().catch(() => {});
  }
}

/**
 * Render Mermaid source to SVG via Playwright + mermaid in a Vercel Sandbox,
 * then upload the SVG to Blob.
 */
export async function renderMermaidToSvg(input: {
  readonly source: string;
  readonly pathname?: string;
  readonly createSandbox?: () => Promise<DesignRenderSandbox>;
  readonly upload?: typeof uploadBinary;
}): Promise<RenderDiagramResult> {
  const createSandbox = input.createSandbox ?? defaultCreateSandbox;
  const upload = input.upload ?? uploadBinary;
  const sandbox = await createSandbox();

  try {
    await sandbox.writeFiles([{ path: MMD_PATH, content: input.source }]);
    await ensurePlaywright(sandbox);

    const script = `
set -euo pipefail
cd /workspace/.pearl-tools
export MMD_PATH=${JSON.stringify(MMD_PATH)}
export SVG_PATH=${JSON.stringify(SVG_PATH)}
node <<'NODE'
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");
(async () => {
  const source = fs.readFileSync(process.env.MMD_PATH, "utf8");
  const mermaidPath = path.join(process.cwd(), "node_modules/mermaid/dist/mermaid.min.js");
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setContent(
    "<!doctype html><html><body><div id=\\"graph\\"></div></body></html>",
    { waitUntil: "domcontentloaded" },
  );
  await page.addScriptTag({ path: mermaidPath });
  const svg = await page.evaluate(async (code) => {
    // @ts-expect-error mermaid is loaded in the page
    window.mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
    // @ts-expect-error mermaid is loaded in the page
    const out = await window.mermaid.render("pearl-graph", code);
    return out.svg;
  }, source.trim());
  fs.writeFileSync(process.env.SVG_PATH, svg, "utf8");
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
        `Diagram render failed (exit ${result.exitCode}): ${err.slice(0, 500)}`,
      );
    }

    const buf = await sandbox.readFileToBuffer({ path: SVG_PATH });
    if (!buf || buf.byteLength === 0) {
      throw new Error("SVG file was empty or missing.");
    }
    const svg = Buffer.from(buf).toString("utf8");
    const uploaded = await upload({
      pathname: input.pathname ?? "design/diagram.svg",
      body: Buffer.from(svg, "utf8"),
      contentType: "image/svg+xml",
    });
    return { ...uploaded, svg };
  } finally {
    await sandbox.stop().catch(() => {});
  }
}

/**
 * Pure Mermaid → SVG for unit tests / offline fixtures when a sandbox is not
 * available. Uses a minimal SVG wrapper when mermaid cannot run; callers that
 * need a real diagram should use renderMermaidToSvg.
 */
export function wrapMermaidAsSvgFixture(source: string): string {
  const escaped = source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="200"><foreignObject width="100%" height="100%"><pre xmlns="http://www.w3.org/1999/xhtml">${escaped}</pre></foreignObject></svg>`;
}
