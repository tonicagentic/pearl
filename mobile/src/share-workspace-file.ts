import { Platform, Share } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

function basename(path: string): string {
  return path.split("/").pop() || "file.txt";
}

function sanitizeName(name: string): string {
  const cleaned = name.replace(/[/\\?%*:|"<>]/g, "_").trim();
  return cleaned || "file.txt";
}

/**
 * Write a workspace file tab to cache and open the system share sheet
 * (Save to Files, AirDrop, Messages, etc.).
 */
export async function shareWorkspaceFile(args: {
  readonly path: string;
  readonly content: string;
}): Promise<void> {
  const name = sanitizeName(basename(args.path));
  const file = new File(
    Paths.cache,
    `pearl-share-${Date.now()}-${name}`,
  );
  file.create({ overwrite: true });
  file.write(args.content);

  try {
    if (Platform.OS === "android" && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(file.uri, { dialogTitle: name });
      return;
    }
    if (Platform.OS === "ios") {
      await Share.share({ url: file.uri, title: name });
      return;
    }
    await Share.share({ message: args.content, title: name });
  } catch {
    // User cancelled or share is unavailable.
  }
}

/** Share a browser workspace page via its URL. */
export async function shareWorkspacePage(args: {
  readonly url: string;
  readonly title?: string;
}): Promise<void> {
  const title = args.title?.trim() || args.url;
  try {
    await Share.share(
      Platform.OS === "ios"
        ? { url: args.url, title }
        : { message: args.url, title },
    );
  } catch {
    // User cancelled or share is unavailable.
  }
}
