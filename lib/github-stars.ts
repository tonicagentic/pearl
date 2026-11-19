import { GITHUB_API_URL } from "@/lib/marketing";

/**
 * Cached GitHub stargazer count for the Pearl repo. Returns null when the
 * request fails so the UI can still link without inventing a number.
 */
export async function getGithubStars(): Promise<number | null> {
  try {
    const headers: HeadersInit = {
      Accept: "application/vnd.github+json",
      "User-Agent": "pearl-marketing",
    };
    const token = process.env.GITHUB_TOKEN?.trim();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(GITHUB_API_URL, {
      headers,
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { stargazers_count?: unknown };
    return typeof data.stargazers_count === "number"
      ? data.stargazers_count
      : null;
  } catch {
    return null;
  }
}

/** Compact display like Rakazo (`1.2k`). */
export function formatGithubStars(count: number): string {
  if (count < 1000) {
    return String(count);
  }
  const thousands = count / 1000;
  const rounded =
    thousands >= 10 ? Math.round(thousands) : Math.round(thousands * 10) / 10;
  return `${rounded}k`;
}
