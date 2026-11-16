import { File, Paths } from "expo-file-system";

import {
  fileBasename,
  isContentUrl,
  mimeTypeForPath,
  prefersInAppPreview,
} from "../../lib/design/file-preview";
import { previewKindForPath } from "../../lib/design/preview-kind";

function sanitizeName(name: string): string {
  const cleaned = name.replace(/[/\\?%*:|"<>]/g, "_").trim();
  return cleaned || "file.txt";
}

async function writePreviewFile(args: {
  readonly path: string;
  readonly content: string;
}): Promise<File | null> {
  const name = sanitizeName(fileBasename(args.path));
  const kind = previewKindForPath(args.path);
  const trimmed = args.content.trim();

  try {
    // Image/PDF bodies are often a remote or data URL — download or decode
    // into a real cache file so Quick Look / Android can open them.
    if (
      (kind === "image" || kind === "pdf") &&
      isContentUrl(trimmed) &&
      /^https?:\/\//i.test(trimmed)
    ) {
      const destination = new File(
        Paths.cache,
        `pearl-preview-${Date.now()}-${name}`,
      );
      return await File.downloadFileAsync(trimmed, destination, {
        idempotent: true,
      });
    }

    if (
      (kind === "image" || kind === "pdf") &&
      /^data:/i.test(trimmed)
    ) {
      const comma = trimmed.indexOf(",");
      if (comma < 0) return null;
      const meta = trimmed.slice(0, comma);
      const payload = trimmed.slice(comma + 1);
      const file = new File(
        Paths.cache,
        `pearl-preview-${Date.now()}-${name}`,
      );
      file.create({ overwrite: true });
      if (/;base64$/i.test(meta)) {
        const binary = atob(payload);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        file.writeSync(bytes);
      } else {
        file.writeSync(decodeURIComponent(payload));
      }
      return file;
    }

    const file = new File(
      Paths.cache,
      `pearl-preview-${Date.now()}-${name}`,
    );
    file.create({ overwrite: true });
    file.writeSync(args.content);
    return file;
  } catch {
    return null;
  }
}

/**
 * Present the platform file viewer (Quick Look / Android ACTION_VIEW).
 * Returns true when the system preview was presented.
 */
export async function previewWorkspaceFile(args: {
  readonly path: string;
  readonly content: string;
}): Promise<boolean> {
  if (prefersInAppPreview(args.path)) return false;

  const file = await writePreviewFile(args);
  if (!file) return false;

  try {
    const mimeType = mimeTypeForPath(args.path);
    const can = await file.canPreview({ mimeType });
    if (!can) return false;
    await file.preview({ title: fileBasename(args.path), mimeType });
    return true;
  } catch {
    return false;
  }
}
