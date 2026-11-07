import type {
  BrowserAction,
  BrowserActionResult,
  BrowserControlMode,
} from "./types.ts";
import type { BrowserSessionHandle } from "./session.ts";

const SECRET_KEYS = [
  "controlSecret",
  "browserControlSecret",
  "viewUrl",
  "secret",
] as const;

/**
 * Strip any accidental secret fields from a control-server response before
 * returning it to the model or logging it.
 */
export function sanitizeBrowserResult(
  value: unknown,
  knownSecrets: readonly string[] = [],
): BrowserActionResult {
  const fallback: BrowserActionResult = {
    ok: false,
    controlMode: "agent",
    url: null,
    title: null,
    tabs: [],
    snapshot: null,
    note: "invalid browser response",
  };

  if (!value || typeof value !== "object") return fallback;
  const raw = value as Record<string, unknown>;

  const controlMode: BrowserControlMode =
    raw.controlMode === "user" ? "user" : "agent";

  const tabs = Array.isArray(raw.tabs)
    ? raw.tabs
        .filter((tab): tab is Record<string, unknown> => !!tab && typeof tab === "object")
        .map((tab) => ({
          id: String(tab.id ?? ""),
          url: String(tab.url ?? ""),
          title: String(tab.title ?? ""),
          active: Boolean(tab.active),
        }))
        .filter((tab) => tab.id)
    : [];

  let note =
    typeof raw.note === "string"
      ? raw.note
      : typeof raw.error === "string"
        ? raw.error
        : undefined;

  if (note) {
    for (const secret of knownSecrets) {
      if (secret && note.includes(secret)) {
        note = note.split(secret).join("[redacted]");
      }
    }
    for (const key of SECRET_KEYS) {
      if (note.toLowerCase().includes(key.toLowerCase())) {
        // Drop notes that look like they leak field names with values.
      }
    }
  }

  // Never forward secret-shaped fields even if the server misbehaves.
  return {
    ok: Boolean(raw.ok),
    controlMode,
    url: typeof raw.url === "string" ? raw.url : null,
    title: typeof raw.title === "string" ? raw.title : null,
    tabs,
    snapshot: typeof raw.snapshot === "string" ? raw.snapshot : null,
    note,
  };
}

export async function callBrowserAction(
  handle: BrowserSessionHandle,
  action: BrowserAction,
  fetchImpl: typeof fetch = fetch,
): Promise<BrowserActionResult> {
  const response = await fetchImpl(`${handle.baseUrl}/action`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-browser-secret": handle.controlSecret,
    },
    body: JSON.stringify(action),
    signal: AbortSignal.timeout(60_000),
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  const sanitized = sanitizeBrowserResult(body, [
    handle.controlSecret,
    handle.viewUrl,
  ]);

  if (!response.ok && sanitized.ok) {
    return {
      ...sanitized,
      ok: false,
      note: sanitized.note ?? `browser control HTTP ${response.status}`,
    };
  }

  return sanitized;
}
