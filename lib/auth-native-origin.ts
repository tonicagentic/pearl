import { getEffectiveAppUrl } from "@/lib/auth-url";

/**
 * Native clients (iOS URLSession via expo/fetch) cannot set Origin; the
 * platform sends the literal string "null" or omits the header. better-auth's
 * CSRF check rejects that with MISSING_OR_NULL_ORIGIN whenever cookies are
 * present — and URLSession routinely attaches the cookie jar on repeat
 * sign-ins.
 *
 * Stamp the canonical app origin when Origin/Referer are opaque and there are
 * no Fetch Metadata headers (browsers always send Sec-Fetch-* on credentialed
 * navigations/fetches). Do not treat cookies alone as a browser signal: that
 * blocked legitimate phone clients. Never trust a client-supplied origin.
 */
export function withTrustedNativeOrigin(request: Request): Request {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return request;
  }

  if (hasFetchMetadata(request.headers)) {
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

/** True when the client looks like a browser (Fetch Metadata present). */
function hasFetchMetadata(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site");
  const mode = headers.get("sec-fetch-mode");
  const dest = headers.get("sec-fetch-dest");
  return Boolean(
    (site && site.trim()) || (mode && mode.trim()) || (dest && dest.trim()),
  );
}
