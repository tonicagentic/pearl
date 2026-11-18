import { httpsImageSrc } from "./pdf-url";

/** True when `src` is an https URL that looks like glTF / GLB. */
export function isHttpsGltfUrl(src: string | null | undefined): boolean {
  if (typeof src !== "string") return false;
  const trimmed = src.trim();
  if (!trimmed.toLowerCase().startsWith("https://")) return false;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return false;
    const path = url.pathname.toLowerCase();
    if (path.endsWith(".glb") || path.endsWith(".gltf")) return true;
    if (/\.(glb|gltf)(?:$|[?#])/i.test(trimmed)) return true;
    const format = url.searchParams.get("format")?.toLowerCase();
    return format === "glb" || format === "gltf";
  } catch {
    return false;
  }
}

export { httpsImageSrc as httpsPosterSrc };

export function clampRevealCount(
  length: number,
  visible: number | null | undefined,
): number {
  if (length <= 0) return 0;
  if (visible == null || !Number.isFinite(visible)) return length;
  return Math.max(0, Math.min(length, Math.floor(visible)));
}

export type ScoreTone = "positive" | "warning" | "negative";

/** Emerald ≥0.75, amber ≥0.5, else red — matches assistant-ui ScoreBreakdown. */
export function scoreRatioTone(total: number, outOf: number): ScoreTone {
  const ratio = outOf > 0 && Number.isFinite(total) ? total / outOf : 0;
  if (ratio >= 0.75) return "positive";
  if (ratio >= 0.5) return "warning";
  return "negative";
}

export function criterionBarPercent(score: number, outOf: number): number {
  if (!(outOf > 0) || !Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, (score / outOf) * 100));
}
