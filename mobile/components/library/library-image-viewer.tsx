import { useCallback, useMemo } from "react";
import { Platform, Share } from "react-native";
import * as Sharing from "expo-sharing";

import {
  ImageViewer,
  measureViewerOrigin,
  type ImageViewerItem,
  type ViewerOrigin,
} from "@/components/image-viewer";
import {
  artifactAuthHeaders,
  artifactContentUrl,
  downloadArtifactToCache,
  type ArtifactDto,
} from "@/src/artifacts-client";

export type { ViewerOrigin };
export { measureViewerOrigin };

type LibraryImageViewerProps = {
  readonly images: readonly ArtifactDto[];
  readonly index: number;
  readonly origin: ViewerOrigin | null;
  readonly onClose: () => void;
  readonly onIndexChange?: (index: number) => void;
};

/**
 * Full-screen library gallery: springs open from a thumbnail rect, pages
 * horizontally, and supports pinch / double-tap zoom per image.
 */
export function LibraryImageViewer({
  images,
  index,
  origin,
  onClose,
  onIndexChange,
}: LibraryImageViewerProps) {
  const viewerImages = useMemo(
    (): ImageViewerItem[] =>
      images.map((item) => ({
        id: item.pathname,
        uri: artifactContentUrl(item.pathname),
        title: item.basename,
        headers: artifactAuthHeaders(),
      })),
    [images],
  );

  const onShare = useCallback(async (item: ImageViewerItem) => {
    const artifact = images.find((row) => row.pathname === item.id);
    if (!artifact) return;
    const file = await downloadArtifactToCache(artifact);
    if (Platform.OS === "ios") {
      await Share.share({ url: file.uri, title: artifact.basename });
      return;
    }
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { dialogTitle: artifact.basename });
      return;
    }
    await Share.share({
      message: artifact.basename,
      title: artifact.basename,
    });
  }, [images]);

  return (
    <ImageViewer
      images={viewerImages}
      index={index}
      origin={origin}
      onClose={onClose}
      onIndexChange={onIndexChange}
      onShare={onShare}
    />
  );
}
