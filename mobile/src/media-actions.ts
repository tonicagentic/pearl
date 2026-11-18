import { File } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform, Share } from "react-native";

import { mimeTypeForPath } from "../../lib/design/file-preview";
import {
  ensureMediaCached,
  mediaCacheKeyFromUrl,
} from "./media-disk-cache";

function sanitizeName(name: string): string {
  const cleaned = name.replace(/[/\\?%*:|"<>]/g, "_").trim();
  return cleaned || "image.jpg";
}

async function localMediaFile(args: {
  readonly url: string;
  readonly cacheKey?: string;
  readonly filename: string;
}): Promise<File | null> {
  const key =
    args.cacheKey?.trim() ||
    mediaCacheKeyFromUrl(args.url) ||
    sanitizeName(args.filename);
  try {
    const uri = await ensureMediaCached({ key, url: args.url });
    if (!uri || /^(https?:|data:)/i.test(uri)) {
      // Web / failed download — no local file to preview or share.
      return null;
    }
    const file = new File(uri);
    if (!file.exists) return null;
    return file;
  } catch {
    return null;
  }
}

/** Open a remote/cached image in the platform viewer (Quick Look / ACTION_VIEW). */
export async function previewRemoteMedia(args: {
  readonly url: string;
  readonly cacheKey?: string;
  readonly filename: string;
}): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const file = await localMediaFile(args);
  if (!file) return false;
  const mimeType = mimeTypeForPath(args.filename);
  try {
    const can = await file.canPreview({ mimeType });
    if (!can) return false;
    await file.preview({
      title: sanitizeName(args.filename),
      mimeType,
    });
    return true;
  } catch {
    return false;
  }
}

/** System share sheet for a generated/cached image file. */
export async function shareRemoteMedia(args: {
  readonly url: string;
  readonly cacheKey?: string;
  readonly filename: string;
}): Promise<void> {
  const name = sanitizeName(args.filename);
  const file = await localMediaFile(args);
  const mimeType = mimeTypeForPath(name);

  try {
    if (file) {
      if (Platform.OS === "android" && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(file.uri, {
          dialogTitle: name,
          mimeType,
        });
        return;
      }
      if (Platform.OS === "ios") {
        await Share.share({ url: file.uri, title: name });
        return;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { dialogTitle: name, mimeType });
        return;
      }
    }
    await Share.share(
      Platform.OS === "ios"
        ? { url: args.url, title: name }
        : { message: args.url, title: name },
    );
  } catch {
    // User cancelled or share unavailable.
  }
}

/**
 * Save/download path: present the share sheet aimed at saving the file
 * (Save to Files / Photos). Uses Sharing when available so the system
 * offers save destinations.
 */
export async function downloadRemoteMedia(args: {
  readonly url: string;
  readonly cacheKey?: string;
  readonly filename: string;
}): Promise<void> {
  const name = sanitizeName(args.filename);
  const file = await localMediaFile(args);
  const mimeType = mimeTypeForPath(name);

  try {
    if (file && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(file.uri, {
        dialogTitle: `Save ${name}`,
        mimeType,
        UTI: mimeType === "image/jpeg" ? "public.jpeg" : undefined,
      });
      return;
    }
    await shareRemoteMedia(args);
  } catch {
    // User cancelled or share unavailable.
  }
}
