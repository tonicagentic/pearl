import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class ConnectedAgentUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectedAgentUrlError";
  }
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
]);

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    throw new ConnectedAgentUrlError("Invalid IPv4 address.");
  }
  return ((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!;
}

function inCidr(ip: string, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split("/");
  if (!base || bitsRaw === undefined) return false;
  const bits = Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

const PRIVATE_IPV4_CIDRS = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.168.0.0/16",
] as const;

function isBlockedIpv4(ip: string): boolean {
  return PRIVATE_IPV4_CIDRS.some((cidr) => inCidr(ip, cidr));
}

function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  // Link-local fe80::/10
  if (/^fe[89ab][0-9a-f]:/i.test(normalized)) return true;
  // Unique local fc00::/7
  if (/^f[cd][0-9a-f]{2}:/i.test(normalized)) return true;
  // IPv4-mapped
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped?.[1]) return isBlockedIpv4(mapped[1]);
  return false;
}

function isBlockedAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isBlockedIpv4(address);
  if (version === 6) return isBlockedIpv6(address);
  return true;
}

/**
 * Normalize a user-entered agent base URL: require https, strip trailing slash,
 * reject credentials and fragments.
 */
export function normalizeConnectedAgentUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) {
    throw new ConnectedAgentUrlError("Enter the agent's deployment URL.");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new ConnectedAgentUrlError("That doesn’t look like a valid URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new ConnectedAgentUrlError("Use an https:// URL for the agent.");
  }
  if (parsed.username || parsed.password) {
    throw new ConnectedAgentUrlError("Don’t include credentials in the URL.");
  }
  if (parsed.hash) {
    throw new ConnectedAgentUrlError("Don’t include a URL fragment.");
  }
  const host = parsed.hostname.toLowerCase();
  if (!host || BLOCKED_HOSTNAMES.has(host) || host.endsWith(".localhost")) {
    throw new ConnectedAgentUrlError("That host isn’t allowed.");
  }
  if (isIP(host) && isBlockedAddress(host)) {
    throw new ConnectedAgentUrlError("That host isn’t allowed.");
  }
  parsed.hash = "";
  parsed.search = "";
  return parsed.toString().replace(/\/$/, "");
}

/**
 * Resolve the host and refuse private, loopback, link-local, and metadata
 * addresses. Call again immediately before Pearl places a remote-agent request.
 */
export async function assertSafeConnectedAgentUrl(url: string): Promise<string> {
  const normalized = normalizeConnectedAgentUrl(url);
  const host = new URL(normalized).hostname;

  if (isIP(host)) {
    if (isBlockedAddress(host)) {
      throw new ConnectedAgentUrlError("That host isn’t allowed.");
    }
    return normalized;
  }

  let records: { readonly address: string; readonly family: number }[];
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new ConnectedAgentUrlError("Could not resolve that host.");
  }
  if (records.length === 0) {
    throw new ConnectedAgentUrlError("Could not resolve that host.");
  }
  for (const record of records) {
    if (isBlockedAddress(record.address)) {
      throw new ConnectedAgentUrlError(
        "That host resolves to a private or reserved address.",
      );
    }
  }
  return normalized;
}

/** Probe GET /eve/v1/health on a candidate deployment. */
export async function probeConnectedAgentHealth(
  baseUrl: string,
  options?: { readonly fetchImpl?: typeof fetch; readonly timeoutMs?: number },
): Promise<void> {
  const normalized = await assertSafeConnectedAgentUrl(baseUrl);
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 8_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${normalized}/eve/v1/health`, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      throw new ConnectedAgentUrlError(
        `Health check failed (HTTP ${response.status}).`,
      );
    }
    const body = (await response.json().catch(() => null)) as {
      ok?: unknown;
      status?: unknown;
    } | null;
    if (body?.ok !== true || body?.status !== "ready") {
      throw new ConnectedAgentUrlError(
        "That URL did not return a ready eve health response.",
      );
    }
  } catch (cause) {
    if (cause instanceof ConnectedAgentUrlError) throw cause;
    if (cause instanceof Error && cause.name === "AbortError") {
      throw new ConnectedAgentUrlError("Health check timed out.");
    }
    throw new ConnectedAgentUrlError(
      cause instanceof Error
        ? `Could not reach the agent: ${cause.message}`
        : "Could not reach the agent.",
    );
  } finally {
    clearTimeout(timer);
  }
}
