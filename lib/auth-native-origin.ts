import { getEffectiveAppUrl } from "@/lib/auth-url";

/**
 * Native clients (iOS URLSession via expo/fetch) cannot set a browser Origin;
 * the platform sends the literal string "null", omits the header, or — in
 * Expo Go — sends a custom-scheme origin like `exp://192.168.x.x:8081`.
 * better-auth's CSRF check rejects those with MISSING_OR_NULL_ORIGIN /
 * INVALID_ORIGIN whenever cookies are present.
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
  if (originHeader && !isOpaqueNativeOrigin(originHeader)) {
    return request;
  }

  const referer = request.headers.get("referer");
  if (
    referer &&
    referer.trim() &&
    referer !== "null" &&
    !isOpaqueNativeOrigin(referer)
  ) {
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

/** True for missing/"null"/custom-scheme origins (Expo Go, companion apps). */
export function isOpaqueNativeOrigin(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null") return true;
  // exp://, exp+slug://, pearlbody://, pearlmoney://, …
  if (!/^https?:\/\//i.test(trimmed)) return true;
  return false;
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
