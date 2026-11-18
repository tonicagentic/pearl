/** Resolve https video sources for answer cards (file / YouTube / Vimeo). */

export type VideoProvider = "file" | "youtube" | "vimeo";

export type ResolvedVideo = {
  readonly provider: VideoProvider;
  readonly src: string;
  /** Embeddable player URL for youtube/vimeo; same as src for file. */
  readonly embedUrl: string;
  readonly poster: string | null;
};

function httpsUrl(raw: string | null | undefined): URL | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id || null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname.startsWith("/embed/")) {
      return url.pathname.split("/")[2] || null;
    }
    if (url.pathname.startsWith("/shorts/")) {
      return url.pathname.split("/")[2] || null;
    }
    return url.searchParams.get("v");
  }
  return null;
}

function vimeoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    if (host === "player.vimeo.com" && parts[0] === "video") {
      return parts[1] || null;
    }
    const id = parts.find((part) => /^\d+$/.test(part));
    return id || null;
  }
  return null;
}

/**
 * Infer provider from URL when omitted; reject non-https.
 * Returns null when the source cannot be used.
 */
export function resolveVideoEmbed(input: {
  readonly src: string;
  readonly provider?: VideoProvider | null;
  readonly poster?: string | null;
}): ResolvedVideo | null {
  const url = httpsUrl(input.src);
  if (!url) return null;

  const posterUrl = httpsUrl(input.poster ?? null);
  const poster = posterUrl ? posterUrl.toString() : null;

  const forced = input.provider ?? null;
  const yt = youtubeId(url);
  const vim = vimeoId(url);

  if (forced === "youtube" || (!forced && yt)) {
    const id = yt;
    if (!id) return null;
    return {
      provider: "youtube",
      src: url.toString(),
      embedUrl: `https://www.youtube.com/embed/${id}`,
      poster,
    };
  }

  if (forced === "vimeo" || (!forced && vim)) {
    const id = vim;
    if (!id) return null;
    return {
      provider: "vimeo",
      src: url.toString(),
      embedUrl: `https://player.vimeo.com/video/${id}`,
      poster,
    };
  }

  if (forced === "file" || !forced) {
    return {
      provider: "file",
      src: url.toString(),
      embedUrl: url.toString(),
      poster,
    };
  }

  return null;
}
