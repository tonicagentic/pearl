import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  embeddableAppUrl,
  embeddableProductionUrl,
  preferEmbedUrl,
} from "../lib/apps/embed.ts";
import {
  DEFAULT_PREVIEW_PORT,
  mergePreviewPorts,
  SANDBOX_RELAY_PORT,
} from "../lib/apps/preview-ports.ts";
import type { PreviewSandbox } from "../lib/apps/preview-service.ts";
import {
  captureAppScreenshot,
  ensureAppPreview,
  ensurePreviewOnSandbox,
} from "../lib/apps/preview-service.ts";

test("mergePreviewPorts always keeps the harness relay port", () => {
  assert.deepEqual(mergePreviewPorts(3000), [SANDBOX_RELAY_PORT, 3000]);
  assert.deepEqual(mergePreviewPorts(5173), [SANDBOX_RELAY_PORT, 5173]);
  assert.deepEqual(mergePreviewPorts(SANDBOX_RELAY_PORT), [SANDBOX_RELAY_PORT]);
  assert.deepEqual(mergePreviewPorts(Number.NaN), [
    SANDBOX_RELAY_PORT,
    DEFAULT_PREVIEW_PORT,
  ]);
});

test("embeddableAppUrl accepts https vercel.run and production hosts", () => {
  assert.equal(
    embeddableAppUrl("https://abc.vercel.run"),
    "https://abc.vercel.run/",
  );
  assert.equal(
    embeddableAppUrl("https://pearl-notes.vercel.app"),
    "https://pearl-notes.vercel.app/",
  );
  assert.equal(embeddableProductionUrl("https://x.vercel.run"), "https://x.vercel.run/");
});

test("embeddableAppUrl rejects unsafe URLs", () => {
  assert.equal(embeddableAppUrl("http://evil.example"), null);
  assert.equal(embeddableAppUrl("javascript:alert(1)"), null);
  assert.equal(embeddableAppUrl("https://user:pass@evil.example"), null);
  assert.equal(embeddableAppUrl(null), null);
  assert.equal(embeddableAppUrl("not a url"), null);
});

test("preferEmbedUrl prefers production over preview", () => {
  assert.equal(
    preferEmbedUrl({
      productionUrl: "https://live.vercel.app",
      previewUrl: "https://draft.vercel.run",
    }),
    "https://live.vercel.app/",
  );
  assert.equal(
    preferEmbedUrl({
      productionUrl: null,
      previewUrl: "https://draft.vercel.run",
    }),
    "https://draft.vercel.run/",
  );
  assert.equal(
    preferEmbedUrl({ productionUrl: null, previewUrl: null }),
    null,
  );
});

function mockSandbox(overrides: Partial<PreviewSandbox> = {}): PreviewSandbox {
  let listening = false;
  return {
    async update() {},
    domain(port) {
      return `https://mock-${port}.vercel.run`;
    },
    async runCommand(params) {
      const joined = [params.cmd, ...(params.args ?? [])].join(" ");
      if (joined.includes("curl -sf")) {
        return {
          exitCode: listening ? 0 : 1,
          async stdout() {
            return "";
          },
          async stderr() {
            return listening ? "" : "connection refused";
          },
        };
      }
      if (joined.includes("next dev") || params.detached) {
        listening = true;
        return {
          exitCode: 0,
          async stdout() {
            return "1";
          },
          async stderr() {
            return "";
          },
        };
      }
      if (joined.includes("playwright") || joined.includes("SCREENSHOT_PATH")) {
        return {
          exitCode: 0,
          async stdout() {
            return "ok";
          },
          async stderr() {
            return "";
          },
        };
      }
      return {
        exitCode: 0,
        async stdout() {
          return "";
        },
        async stderr() {
          return "";
        },
      };
    },
    async readFileToBuffer() {
      return Buffer.from("fake-png-bytes");
    },
    ...overrides,
  };
}

test("ensurePreviewOnSandbox exposes ports and returns domain URL", async () => {
  const updated: number[][] = [];
  const sandbox = mockSandbox({
    async update(params) {
      if (params.ports) updated.push([...params.ports]);
    },
  });
  const url = await ensurePreviewOnSandbox(sandbox, 3000);
  assert.equal(url, "https://mock-3000.vercel.run");
  assert.deepEqual(updated[0], [SANDBOX_RELAY_PORT, 3000]);
});

function fakeApp(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: "app-1",
    userId: "user-1",
    slug: "pearl-notes",
    title: "Notes",
    githubOwner: null,
    githubRepo: null,
    fxSessionId: "wrun_test",
    sandboxName: "dh-testhash0123456789",
    vercelProjectId: null,
    productionUrl: null,
    previewUrl: null,
    previewPort: 3000,
    status: "building" as const,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test("ensureAppPreview fails when sandbox name is not dh-*", async () => {
  const app = fakeApp({ sandboxName: "pearl-app-not-ready" });
  const result = await ensureAppPreview({
    userId: "user-1",
    appId: "app-1",
    getSandbox: async () => mockSandbox(),
    store: {
      async get() {
        return app as never;
      },
      async update() {
        return app as never;
      },
    },
  });
  assert.equal(result.status, "error");
  assert.match(result.error, /Sandbox is not ready/);
});

test("ensureAppPreview persists previewUrl via store", async () => {
  let savedPreviewUrl: string | null | undefined;
  let savedPreviewPort: number | undefined;
  const app = fakeApp();
  const result = await ensureAppPreview({
    userId: "user-1",
    appId: "app-1",
    getSandbox: async () => mockSandbox(),
    store: {
      async get() {
        return app as never;
      },
      async update(_userId, _id, patch) {
        savedPreviewUrl = patch.previewUrl;
        savedPreviewPort = patch.previewPort;
        return { ...app, ...patch } as never;
      },
    },
  });
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.previewUrl, "https://mock-3000.vercel.run");
  assert.equal(savedPreviewUrl, "https://mock-3000.vercel.run");
  assert.equal(savedPreviewPort, 3000);
});

test("captureAppScreenshot uploads PNG via injected uploader", async () => {
  const app = fakeApp({ previewUrl: "https://mock-3000.vercel.run" });
  const uploaded: Buffer[] = [];
  const result = await captureAppScreenshot({
    userId: "user-1",
    appId: "app-1",
    getSandbox: async () => mockSandbox(),
    store: {
      async get() {
        return app as never;
      },
      async update(_userId, _id, patch) {
        return { ...app, ...patch } as never;
      },
    },
    uploadPng: async ({ body }) => {
      uploaded.push(body);
      return {
        url: "https://blob.example/shot.png",
        contentType: "image/png",
      };
    },
  });
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.url, "https://blob.example/shot.png");
  assert.equal(uploaded.length, 1);
  assert.equal(uploaded[0]?.toString(), "fake-png-bytes");
});

test("captureAppScreenshot fails cleanly when app is missing", async () => {
  const result = await captureAppScreenshot({
    userId: "missing-user",
    appId: "missing-app",
    getSandbox: async () => mockSandbox(),
    store: {
      async get() {
        return null;
      },
      async update() {
        return null;
      },
    },
    uploadPng: async () => ({
      url: "https://blob.example/shot.png",
      contentType: "image/png",
    }),
  });
  assert.equal(result.status, "error");
  assert.match(result.error, /not found/i);
});

test("builder screenshot_app tool exists and code_with_fx wires ensureAppPreview", async () => {
  const shot = await readFile(
    "agent/subagents/builder/tools/screenshot_app.ts",
    "utf8",
  );
  assert.match(shot, /captureAppScreenshot/);
  assert.doesNotMatch(shot, /approval:\s*always/);

  const code = await readFile("lib/apps/code-service.ts", "utf8");
  assert.match(code, /ensureAppPreview/);

  const instructions = await readFile(
    "agent/subagents/builder/instructions.md",
    "utf8",
  );
  assert.match(instructions, /screenshot_app/);
});
