import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

const LIVE_FRAME_EDGE = 768;

/** Longest side 768, JPEG, so a frame stays under the Gateway message cap. */
export async function resizeLiveJpeg(
  uri: string,
  width: number,
  height: number,
): Promise<string | null> {
  const context = ImageManipulator.manipulate(uri);
  try {
    if (Math.max(width, height) > LIVE_FRAME_EDGE) {
      context.resize(
        width >= height ? { width: LIVE_FRAME_EDGE } : { height: LIVE_FRAME_EDGE },
      );
    }
    const image = await context.renderAsync();
    try {
      const saved = await image.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.5,
        base64: true,
      });
      return saved.base64 ?? null;
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}
