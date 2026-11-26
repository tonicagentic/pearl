import type { ChatPresence } from "./shared-client-types.ts";

/**
 * Fast Recents poll when any row still needs presence catch-up.
 * Idle lists back off (push + foreground cover the rest).
 */
export function chatListNeedsPresencePoll(
  items: readonly { readonly presence?: ChatPresence | null }[],
): boolean {
  return items.some(
    (item) =>
      item.presence === "working" ||
      item.presence === "waiting" ||
      item.presence === "unread",
  );
}
