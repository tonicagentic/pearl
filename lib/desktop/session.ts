import { Sandbox } from "@vercel/sandbox";

import { noteSandboxOpened } from "@/lib/billing/sandbox-meter";
import {
  getChatDesktopSession,
  setChatDesktopSession,
} from "@/lib/db/queries";
import {
  browserTimeoutMs,
  DEFAULT_SANDBOX_SETTINGS,
  type SandboxSettings,
} from "@/lib/sandbox/settings";
import { getSandboxSettings } from "@/lib/sandbox/store";

/** screen-relay serves the viewer and stream on this port. */
export const DESKTOP_RELAY_PORT = 8080;

export type DesktopSessionHandle = {
  readonly sandboxName: string;
  readonly publicUrl: string;
  readonly viewUrl: string;
};

export type DesktopSandbox = {
  domain(port: number): string;
  extendTimeout(duration: number): Promise<void>;
  update(params: {
    readonly ports?: number[];
    readonly timeout?: number;
  }): Promise<void>;
  stop?(): Promise<void>;
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
  return `desktop-${chatId}`;
}

async function defaultGetOrCreateSandbox(
  name: string,
  settings: SandboxSettings,
): Promise<DesktopSandbox> {
  return (await Sandbox.getOrCreate({
    name,
    ports: [DESKTOP_RELAY_PORT],
    timeout: browserTimeoutMs(settings),
    resources: { vcpus: settings.browserVcpus },
  })) as unknown as DesktopSandbox;
}

async function defaultGetSandbox(name: string): Promise<DesktopSandbox> {
  return (await Sandbox.get({ name })) as unknown as DesktopSandbox;
}

/**
 * Parse the viewer link screen-relay prints on stdout. The last line must be
 * a URL on the sandbox's public origin with a `#token=` fragment.
 */
export function parseDesktopViewerLink(
  stdout: string,
  publicUrl: string,
): string {
  const link = stdout.trim().split("\n").at(-1)?.trim() ?? "";
  const viewer = URL.canParse(link) ? new URL(link) : null;
  const expected = new URL(publicUrl);
  if (
    !viewer ||
    viewer.origin !== expected.origin ||
    !viewer.hash.startsWith("#token=")
  ) {
    throw new Error("screen-relay printed an unexpected viewer link.");
  }
  return viewer.href;
}

async function isRelayUp(sandbox: DesktopSandbox): Promise<boolean> {
  const probe = await sandbox.runCommand({
    cmd: "bash",
    args: [
      "-c",
      `curl -sf --max-time 2 "http://127.0.0.1:${DESKTOP_RELAY_PORT}/" >/dev/null`,
    ],
  });
  return probe.exitCode === 0;
}

async function startScreenRelay(
  sandbox: DesktopSandbox,
  publicUrl: string,
): Promise<string> {
  // Install noise goes to stderr; the viewer link is the last stdout line.
  const result = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      `npm install -g screen-relay >&2 && screen-relay up -d --yes --public "$1"`,
      "sh",
      publicUrl,
    ],
  });
  if (result.exitCode !== 0) {
    const err = await result.stderr();
    const out = await result.stdout();
    throw new Error(
      `screen-relay did not start: ${err || out || "unknown error"}`,
    );
  }
  return parseDesktopViewerLink(await result.stdout(), publicUrl);
}

export type EnsureDesktopSessionDeps = {
  readonly getChatDesktopSession?: typeof getChatDesktopSession;
  readonly setChatDesktopSession?: typeof setChatDesktopSession;
  readonly getOrCreateSandbox?: (
    name: string,
    settings: SandboxSettings,
  ) => Promise<DesktopSandbox>;
  readonly getSandbox?: (name: string) => Promise<DesktopSandbox>;
};

/**
 * Ensure a dedicated screen-relay desktop sandbox exists for this chat and
 * the desktop is streaming. Returns the public viewer URL (token included).
 */
export async function ensureDesktopSession(
  chatId: string,
  deps: EnsureDesktopSessionDeps & { readonly userId?: string | null } = {},
): Promise<DesktopSessionHandle> {
  const getRow = deps.getChatDesktopSession ?? getChatDesktopSession;
  const setRow = deps.setChatDesktopSession ?? setChatDesktopSession;
  const getOrCreate = deps.getOrCreateSandbox ?? defaultGetOrCreateSandbox;
  const getSandbox = deps.getSandbox ?? defaultGetSandbox;
  const settings = deps.userId
    ? await getSandboxSettings(deps.userId)
    : DEFAULT_SANDBOX_SETTINGS;
  const timeoutMs = browserTimeoutMs(settings);

  let row = await getRow(chatId);
  let name = row?.desktopSandboxName ?? null;
  if (!name) {
    name = sandboxNameForChat(chatId);
    await setRow({
      chatId,
      desktopSandboxName: name,
      desktopViewerUrl: row?.desktopViewerUrl ?? null,
    });
  }

  let sandbox: DesktopSandbox;
  try {
    sandbox = await getSandbox(name);
  } catch {
    sandbox = await getOrCreate(name, settings);
  }

  await sandbox.update({
    ports: [DESKTOP_RELAY_PORT],
    timeout: timeoutMs,
  });
  await sandbox.extendTimeout(timeoutMs).catch(() => {});

  const publicUrl = sandbox.domain(DESKTOP_RELAY_PORT).replace(/\/$/, "");
  let viewUrl = row?.desktopViewerUrl ?? null;
  const cachedOk =
    viewUrl != null &&
    (() => {
      try {
        return parseDesktopViewerLink(viewUrl, publicUrl) === viewUrl;
      } catch {
        return false;
      }
    })();

  // Reuse a stored link only if it still matches this sandbox origin and the
  // relay is answering; otherwise start (or restart) and persist a fresh URL.
  if (!cachedOk || !(await isRelayUp(sandbox))) {
    viewUrl = await startScreenRelay(sandbox, publicUrl);
    await setRow({
      chatId,
      desktopSandboxName: name,
      desktopViewerUrl: viewUrl,
    });
  }

  if (!viewUrl) {
    throw new Error("Desktop viewer URL missing after screen-relay start.");
  }

  if (deps.userId) {
    noteSandboxOpened({
      sandboxId: name,
      userId: deps.userId,
      vcpus: settings.browserVcpus,
      label: "desktop",
    });
  }

  return {
    sandboxName: name,
    publicUrl,
    viewUrl,
  };
}

/** Stop screen-relay in the chat's desktop sandbox (keeps the sandbox). */
export async function stopDesktopSession(
  chatId: string,
  deps: EnsureDesktopSessionDeps = {},
): Promise<{ readonly ok: boolean; readonly note?: string }> {
  const getRow = deps.getChatDesktopSession ?? getChatDesktopSession;
  const setRow = deps.setChatDesktopSession ?? setChatDesktopSession;
  const getSandbox = deps.getSandbox ?? defaultGetSandbox;

  const row = await getRow(chatId);
  const name = row?.desktopSandboxName;
  if (!name) {
    return { ok: true, note: "No desktop session is running." };
  }

  try {
    const sandbox = await getSandbox(name);
    await sandbox.runCommand({
      cmd: "sh",
      args: ["-c", "screen-relay down || true"],
    });
  } catch (error) {
    return {
      ok: false,
      note:
        error instanceof Error
          ? error.message
          : "Failed to reach the desktop sandbox",
    };
  }

  await setRow({
    chatId,
    desktopSandboxName: name,
    desktopViewerUrl: null,
  });
  return { ok: true, note: "Desktop stopped." };
}

/** Strip secrets from a handle before returning anything client-facing. */
export function publicDesktopView(handle: DesktopSessionHandle): {
  readonly viewUrl: string;
} {
  return { viewUrl: handle.viewUrl };
}
