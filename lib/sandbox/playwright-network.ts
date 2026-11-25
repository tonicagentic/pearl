/**
 * Egress allowlist for short-lived Playwright capture sandboxes (screenshots /
 * recordings). Intentionally tight — not `allow-all`.
 */
export const PLAYWRIGHT_CAPTURE_NETWORK_ALLOW = [
  "registry.npmjs.org",
  "*.npmjs.org",
  "nodejs.org",
  "*.nodejs.org",
  "playwright.azureedge.net",
  "cdn.playwright.dev",
  "*.playwright.dev",
  "storage.googleapis.com",
  // Preview / deploy hosts the capture navigates to:
  "*.vercel.app",
  "*.vercel.run",
  "vercel.com",
  "*.vercel.com",
] as const;

export function playwrightCaptureNetworkPolicy(targetUrl?: string): {
  readonly allow: string[];
} {
  const allow: string[] = [...PLAYWRIGHT_CAPTURE_NETWORK_ALLOW];
  if (targetUrl) {
    try {
      const host = new URL(targetUrl).hostname;
      // Always pin the navigation host explicitly (in addition to wildcards).
      if (host && !allow.includes(host)) {
        allow.push(host);
      }
    } catch {
      // ignore invalid URL — caller validates https separately
    }
  }
  return { allow };
}
