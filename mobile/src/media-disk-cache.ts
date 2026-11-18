import { Directory, File, Paths } from "expo-file-system";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

/**
 * Local disk cache for remote media (generated images, attachment HTTPS
 * URLs). Keys by Blob pathname (or URL path) so signed query tokens that
 * rotate do not bust the cache.
 */

const memory = new Map<string, string>();

function cacheDirectory(): Directory {
  const dir = new Directory(Paths.cache, "pearl-media");
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

function sanitizeKey(key: string): string {
  const cleaned = key.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return (cleaned || "media").slice(0, 180);
}

/** Stable cache key for a remote media URL (drops signed query params). */
export function mediaCacheKeyFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname || url;
  } catch {
    return url;
  }
}

function shouldCacheUrl(url: string): boolean {
  if (Platform.OS === "web") return false;
  if (!url) return false;
  if (/^(data:|file:|content:|ph:|assets-library:)/i.test(url)) return false;
  return /^https?:\/\//i.test(url);
}

/** Sync peek — memory or existing disk file, no network. */
export function peekCachedMediaUri(key: string): string | undefined {
  const normalized = key.trim();
  if (!normalized) return undefined;
  const hit = memory.get(normalized);
  if (hit) return hit;
  if (Platform.OS === "web") return undefined;
  try {
    const file = new File(cacheDirectory(), sanitizeKey(normalized));
    if (file.exists) {
      memory.set(normalized, file.uri);
      return file.uri;
    }
  } catch {
    // Ignore cache probe failures.
  }
  return undefined;
}

/**
 * Ensure `url` is on disk under `key`. Returns a file:// URI when cached,
 * otherwise the original remote URL (download failure / web).
 */
export async function ensureMediaCached(args: {
  readonly key: string;
  readonly url: string;
}): Promise<string> {
  const key = args.key.trim() || mediaCacheKeyFromUrl(args.url);
  if (!shouldCacheUrl(args.url)) {
    return args.url;
  }

  const existing = peekCachedMediaUri(key);
  if (existing) return existing;

  try {
    const dest = new File(cacheDirectory(), sanitizeKey(key));
    if (dest.exists) {
      memory.set(key, dest.uri);
      return dest.uri;
    }
    const file = await File.downloadFileAsync(args.url, dest, {
      idempotent: true,
    });
    memory.set(key, file.uri);
    return file.uri;
  } catch {
    return args.url;
  }
}

/**
 * Prefer a disk/memory hit for display; otherwise show the remote URL and
 * warm the cache for the next mount (no mid-display swap).
 */
export function useDisplayMediaUri(src: string, cacheKey?: string): string {
  const key = (cacheKey?.trim() || mediaCacheKeyFromUrl(src)).trim();
  const [displaySrc, setDisplaySrc] = useState(
    () => peekCachedMediaUri(key) || src,
  );

  useEffect(() => {
    const nextKey = (cacheKey?.trim() || mediaCacheKeyFromUrl(src)).trim();
    const hit = peekCachedMediaUri(nextKey);
    if (hit) {
      setDisplaySrc(hit);
      return;
    }
    setDisplaySrc(src);
    void ensureMediaCached({ key: nextKey, url: src });
  }, [src, cacheKey]);

  return displaySrc;
}
