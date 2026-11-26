export const DEFAULT_CHAT_TITLE = "New chat";

export function createFallbackTitle(input: string) {
  const text = input
    .replace(/\s+/g, " ")
    .replace(/[`*_#>]/g, "")
    .trim();

  if (!text) {
    return DEFAULT_CHAT_TITLE;
  }

  return sanitizeChatTitle(text);
}

/** Cap and normalize a title before persistence (manual rename / LLM). */
export function sanitizeChatTitle(title: string) {
  const next = title.replace(/\s+/g, " ").trim();
  if (!next) return DEFAULT_CHAT_TITLE;
  return next.length > 72 ? `${next.slice(0, 69).trimEnd()}...` : next;
}
