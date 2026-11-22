/** Classify durable artifact basenames for Library Filters. */

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg)$/i;

export type ArtifactKind = "image" | "file";

export function artifactKindFromBasename(basename: string): ArtifactKind {
  return IMAGE_EXT.test(basename) ? "image" : "file";
}
