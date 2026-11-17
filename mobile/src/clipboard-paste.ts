import { File, Paths } from "expo-file-system";

export {
  htmlClipboardToText,
  normalizeClipboardText,
} from "../../lib/chat/clipboard-paste";

/**
 * Decode a clipboard data-URL image into a cache file the image manipulator
 * and native preview can open.
 */
export async function writeClipboardImageToCache(args: {
  readonly dataUrl: string;
  readonly preferredName?: string;
}): Promise<{ uri: string; name: string; mimeType: string }> {
  const trimmed = args.dataUrl.trim();
  const comma = trimmed.indexOf(",");
  if (comma < 0 || !/^data:/i.test(trimmed)) {
    throw new Error("Clipboard image is not a data URL.");
  }
  const meta = trimmed.slice(0, comma);
  const payload = trimmed.slice(comma + 1);
  const mimeMatch = /^data:([^;]+)/i.exec(meta);
  const mimeType = (mimeMatch?.[1] ?? "image/png").toLowerCase();
  const ext =
    mimeType === "image/jpeg" || mimeType === "image/jpg"
      ? "jpg"
      : mimeType === "image/webp"
        ? "webp"
        : mimeType === "image/gif"
          ? "gif"
          : "png";
  const name = args.preferredName
    ? `${args.preferredName.replace(/\.[^.]+$/, "")}.${ext}`
    : `pasted-image.${ext}`;
  const fileName = `pearl-paste-${Date.now()}-${name.replace(/[/\\?%*:|"<>]/g, "_")}`;
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });

  if (/;base64$/i.test(meta)) {
    const binary = globalThis.atob(payload.replace(/[\t\n\f\r ]/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    file.writeSync(bytes);
  } else {
    file.writeSync(decodeURIComponent(payload));
  }

  return { uri: file.uri, name, mimeType };
}
