import { getEffectiveAppUrl } from "@/lib/auth-url";

/**
 * Native clients (iOS URLSession via expo/fetch) cannot set Origin; the
 * platform sends the literal string "null" or omits the header. better-auth's
 * CSRF check rejects that with MISSING_OR_NULL_ORIGIN.
 *
 * Stamp the canonical app origin only when the request has no browser
 * signals (cookies, Sec-Fetch-*, or a real Origin/Referer). Never trust a
 * client-supplied origin.
 */
export function withTrustedNativeOrigin(request: Request): Request {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return request;
  }

  if (looksLikeBrowserAuthRequest(request.headers)) {
    return request;
  }

  const originHeader = request.headers.get("origin");
  if (originHeader && originHeader !== "null") {
    return request;
  }

  const referer = request.headers.get("referer");
  if (referer && referer.trim() && referer !== "null") {
    return request;
  }

  const trustedOrigin = new URL(getEffectiveAppUrl()).origin;
  const headers = new Headers(request.headers);
  headers.set("origin", trustedOrigin);

  return new Request(request.url, {
    method: request.method,
    headers,
    body: request.body,
    // Preserve duplex when body is a stream (Node fetch / undici).
    duplex: "half",
    redirect: request.redirect,
    signal: request.signal,
  } as RequestInit);
}

function looksLikeBrowserAuthRequest(headers: Headers): boolean {
  if (headers.has("cookie")) {
    return true;
  }

  const site = headers.get("sec-fetch-site");
  const mode = headers.get("sec-fetch-mode");
  const dest = headers.get("sec-fetch-dest");
  if (
    Boolean(
      (site && site.trim()) ||
        (mode && mode.trim()) ||
        (dest && dest.trim()),
    )
  ) {
    return true;
  }

  return false;
}
