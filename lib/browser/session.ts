import { randomBytes } from "node:crypto";
import { Sandbox } from "@vercel/sandbox";

import { getEffectiveAppUrl } from "@/lib/auth-url";
import {
  getChatBrowserSession,
  setChatBrowserSession,
} from "@/lib/db/queries";
import {
  BROWSER_CONTROL_PORT,
  BROWSER_CONTROL_SERVER_SOURCE,
} from "./control-server-source.ts";

export const BROWSER_TIMEOUT_MS = 30 * 60 * 1000;

/** Private / link-local / metadata ranges the browser must not reach. */
export const BROWSER_SUBNET_DENY = [
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "0.0.0.0/8",
  "::1/128",
  "fc00::/7",
  "fe80::/10",
] as const;

export type BrowserSessionHandle = {
  readonly sandboxName: string;
  readonly controlSecret: string;
  readonly baseUrl: string;
  readonly viewUrl: string;
};

export type BrowserSandbox = {
  domain(port: number): string;
  extendTimeout(duration: number): Promise<void>;
  update(params: {
    readonly ports?: number[];
    readonly timeout?: number;
    readonly networkPolicy?: {
      readonly allow?: readonly string[];
      readonly subnets?: { readonly deny?: readonly string[] };
    };
  }): Promise<void>;
  writeFiles(
    files: { path: string; content: Buffer }[],
  ): Promise<void>;
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
};

function sandboxNameForChat(chatId: string): string {
  // Vercel sandbox names are DNS-ish; UUIDs are safe.
  return `browser-${chatId}`;
}

function newControlSecret(): string {
  return randomBytes(24).toString("base64url");
}

function frameAncestors(): string {
  try {
    const origin = getEffectiveAppUrl();
    return `'self' ${origin}`;
  } catch {
    return "'self'";
  }
}

async function defaultCreateSandbox(
  name: string,
  secret: string,
): Promise<BrowserSandbox> {
  return (await Sandbox.create({
    name,
    ports: [BROWSER_CONTROL_PORT],
    timeout: BROWSER_TIMEOUT_MS,
    resources: { vcpus: 2 },
    env: {
      BROWSER_CONTROL_SECRET: secret,
      BROWSER_CONTROL_PORT: String(BROWSER_CONTROL_PORT),
      BROWSER_FRAME_ANCESTORS: frameAncestors(),
    },
    networkPolicy: {
      allow: ["*"],
      subnets: { deny: [...BROWSER_SUBNET_DENY] },
    },
  })) as unknown as BrowserSandbox;
}

async function defaultGetSandbox(name: string): Promise<BrowserSandbox> {
  return (await Sandbox.get({ name })) as unknown as BrowserSandbox;
}

async function isControlUp(sandbox: BrowserSandbox): Promise<boolean> {
  const probe = await sandbox.runCommand({
    cmd: "bash",
    args: [
      "-c",
      `curl -sf --max-time 2 "http://127.0.0.1:${BROWSER_CONTROL_PORT}/health" >/dev/null`,
    ],
  });
  return probe.exitCode === 0;
}

async function startControlServer(sandbox: BrowserSandbox): Promise<void> {
  await sandbox.writeFiles([
    {
      path: "/workspace/.pearl-browser/package.json",
      content: Buffer.from(
        JSON.stringify({
          name: "pearl-browser-control",
          private: true,
          type: "commonjs",
        }),
        "utf8",
      ),
    },
    {
      path: "/workspace/.pearl-browser/server.js",
      content: Buffer.from(BROWSER_CONTROL_SERVER_SOURCE, "utf8"),
    },
  ]);

  const install = await sandbox.runCommand({
    cmd: "bash",
    args: [
      "-c",
      [
        "cd /workspace/.pearl-browser",
        "if [ ! -d node_modules/playwright-core ]; then",
        "  npm install --no-fund --no-audit playwright-core@1.55.0 ws@8.18.3",
        "  npx playwright-core install chromium",
        "fi",
      ].join("\n"),
    ],
  });
  if (install.exitCode !== 0) {
    const err = await install.stderr();
    throw new Error(
      `Failed to install browser control deps: ${err || "unknown error"}`,
    );
  }

  await sandbox.runCommand({
    cmd: "bash",
    args: [
      "-c",
      [
        "cd /workspace/.pearl-browser",
        "pkill -f 'node server.js' >/dev/null 2>&1 || true",
        "nohup node server.js > /tmp/pearl-browser-control.log 2>&1 &",
        "echo $!",
      ].join(" && "),
    ],
    detached: true,
  });

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (await isControlUp(sandbox)) return;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(
    "Browser control server did not become ready. Check /tmp/pearl-browser-control.log.",
  );
}

export type EnsureBrowserSessionDeps = {
  readonly getChatBrowserSession?: typeof getChatBrowserSession;
  readonly setChatBrowserSession?: typeof setChatBrowserSession;
  readonly createSandbox?: (
    name: string,
    secret: string,
  ) => Promise<BrowserSandbox>;
  readonly getSandbox?: (name: string) => Promise<BrowserSandbox>;
};

/**
 * Ensure a dedicated browser sandbox exists for this chat and the control
 * server is listening. Returns the public base + viewer URL.
 */
export async function ensureBrowserSession(
  chatId: string,
  deps: EnsureBrowserSessionDeps = {},
): Promise<BrowserSessionHandle> {
  const getRow = deps.getChatBrowserSession ?? getChatBrowserSession;
  const setRow = deps.setChatBrowserSession ?? setChatBrowserSession;
  const createSandbox = deps.createSandbox ?? defaultCreateSandbox;
  const getSandbox = deps.getSandbox ?? defaultGetSandbox;

  let row = await getRow(chatId);
  let secret = row?.browserControlSecret ?? null;
  let name = row?.browserSandboxName ?? null;

  if (!secret || !name) {
    secret = secret ?? newControlSecret();
    name = name ?? sandboxNameForChat(chatId);
    await setRow({
      chatId,
      browserSandboxName: name,
      browserControlSecret: secret,
    });
  }

  let sandbox: BrowserSandbox;
  let created = false;
  try {
    sandbox = await getSandbox(name);
  } catch {
    sandbox = await createSandbox(name, secret);
    created = true;
  }

  await sandbox.update({
    ports: [BROWSER_CONTROL_PORT],
    timeout: BROWSER_TIMEOUT_MS,
    networkPolicy: {
      allow: ["*"],
      subnets: { deny: [...BROWSER_SUBNET_DENY] },
    },
  });
  await sandbox.extendTimeout(BROWSER_TIMEOUT_MS).catch(() => {});

  if (created || !(await isControlUp(sandbox))) {
    await startControlServer(sandbox);
  }

  const baseUrl = sandbox.domain(BROWSER_CONTROL_PORT).replace(/\/$/, "");
  return {
    sandboxName: name,
    controlSecret: secret,
    baseUrl,
    viewUrl: `${baseUrl}/view/${secret}`,
  };
}

/** Strip secrets from a handle before returning anything client-facing. */
export function publicBrowserView(handle: BrowserSessionHandle): {
  readonly viewUrl: string;
} {
  return { viewUrl: handle.viewUrl };
}
