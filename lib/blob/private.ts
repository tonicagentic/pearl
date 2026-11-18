import { get, issueSignedToken, put, presignUrl } from "@vercel/blob";

/**
 * Default signed GET lifetime for private image URLs embedded in chat.
 * Vercel Blob rejects `validUntil` more than 7 days ahead.
 */
export const PRIVATE_BLOB_SIGNED_GET_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Time-limited HTTPS GET URL for a private Blob pathname. Clients and
 * `<img>` tags cannot fetch the canonical private URL without a signature.
 */
export async function signedPrivateBlobGetUrl(
  pathname: string,
  ttlMs: number = PRIVATE_BLOB_SIGNED_GET_TTL_MS,
): Promise<string> {
  const validUntil = Date.now() + ttlMs;
  const token = await issueSignedToken({
    pathname,
    operations: ["get"],
    validUntil,
  });
  const { presignedUrl } = await presignUrl(token, {
    operation: "get",
    pathname,
    access: "private",
    validUntil,
  });
  return presignedUrl;
}

/**
 * Upload to the project's private Blob store. The store rejects
 * `access: "public"`. When `signGet` is true (default), `url` /
 * `downloadUrl` are time-limited signed GETs for clients; set `signGet:
 * false` when only the pathname is needed for later server-side reads.
 */
export async function putPrivateBlob(
  pathname: string,
  body: Buffer | string | Blob | ArrayBuffer | ReadableStream,
  options: {
    readonly contentType?: string;
    readonly addRandomSuffix?: boolean;
    readonly allowOverwrite?: boolean;
    readonly signedGetTtlMs?: number;
    readonly signGet?: boolean;
  } = {},
): Promise<{
  readonly url: string;
  readonly downloadUrl: string;
  readonly pathname: string;
  readonly contentType: string;
  readonly canonicalUrl: string;
}> {
  const blob = await put(pathname, body, {
    access: "private",
    addRandomSuffix: options.addRandomSuffix ?? true,
    allowOverwrite: options.allowOverwrite ?? false,
    contentType: options.contentType,
  });
  const signGet = options.signGet !== false;
  const clientUrl = signGet
    ? await signedPrivateBlobGetUrl(blob.pathname, options.signedGetTtlMs)
    : blob.url;
  return {
    url: clientUrl,
    downloadUrl: clientUrl,
    pathname: blob.pathname,
    contentType:
      blob.contentType ?? options.contentType ?? "application/octet-stream",
    canonicalUrl: blob.url,
  };
}

/** Server-side text read of a private blob (stream via SDK auth). */
export async function readPrivateBlobText(
  pathname: string,
): Promise<string | null> {
  const result = await get(pathname, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }
  return await new Response(result.stream).text();
}

/** Server-side binary read of a private blob. */
export async function readPrivateBlobBytes(
  pathname: string,
): Promise<Uint8Array | null> {
  const result = await get(pathname, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }
  return new Uint8Array(await new Response(result.stream).arrayBuffer());
}
