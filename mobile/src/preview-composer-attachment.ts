import { File } from "expo-file-system";

import { mimeTypeForPath } from "../../lib/design/file-preview";
import { previewWorkspaceFile } from "./preview-workspace-file";

/**
 * Open a staged composer attachment in the platform viewer (Quick Look /
 * Android ACTION_VIEW). Prefers a local picker/cache URI, then falls back to
 * downloading or decoding an image content URL.
 */
export async function previewComposerAttachment(args: {
  readonly name: string;
  readonly contentType?: string | null;
  readonly previewUri?: string | null;
  readonly imageUri?: string | null;
}): Promise<boolean> {
  const localUri = args.previewUri?.trim();
  if (localUri && /^(file:|content:|\/)/i.test(localUri)) {
    try {
      const file = new File(localUri);
      if (file.exists) {
        const mimeType =
          args.contentType?.trim() || mimeTypeForPath(args.name);
        const can = await file.canPreview({ mimeType });
        if (can) {
          await file.preview({ title: args.name, mimeType });
          return true;
        }
      }
    } catch {
      // Fall through to content-based preview.
    }
  }

  const imageUri = args.imageUri?.trim();
  if (imageUri) {
    return previewWorkspaceFile({
      path: args.name || "pasted-image.png",
      content: imageUri,
    });
  }

  return false;
}
