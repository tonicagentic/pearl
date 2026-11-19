import { createHash } from "node:crypto";

import type { ChatListItem } from "@/lib/chat/types";
import type { IssueWithArea } from "@/lib/db/issues";

export type SuggestedPrompt = {
  readonly title: string;
  readonly prompt: string;
};

export type SuggestedPromptIssue = {
  readonly title: string;
  readonly area: string;
  readonly dueDate: string | null;
  readonly reviewDate: string | null;
};

export type SuggestedPromptContextPack = {
  readonly memory: readonly string[];
  readonly issues: readonly SuggestedPromptIssue[];
  readonly recentChats: readonly string[];
};

export const SUGGESTED_PROMPT_COUNT = 4;

const MEMORY_ENTRY_LIMIT = 12;
const MEMORY_ENTRY_MAX_CHARS = 120;
const ISSUE_LIMIT = 8;
const CHAT_LIMIT = 6;
const TITLE_MAX_CHARS = 48;
const PROMPT_MAX_CHARS = 200;

function clip(text: string, max: number): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function buildSuggestedPromptContextPack(input: {
  readonly memoryEntries?: readonly { readonly text: string }[];
  readonly issues?: readonly Pick<
    IssueWithArea,
    "title" | "areaName" | "dueDate" | "reviewDate"
  >[];
  readonly chats?: readonly Pick<ChatListItem, "title">[];
}): SuggestedPromptContextPack {
  const memory = (input.memoryEntries ?? [])
    .slice(0, MEMORY_ENTRY_LIMIT)
    .map((entry) => clip(entry.text, MEMORY_ENTRY_MAX_CHARS))
    .filter((text) => text.length > 0);

  const issues = (input.issues ?? [])
    .slice(0, ISSUE_LIMIT)
    .map((issue) => ({
      title: clip(issue.title, MEMORY_ENTRY_MAX_CHARS),
      area: clip(issue.areaName, 64),
      dueDate: issue.dueDate,
      reviewDate: issue.reviewDate,
    }))
    .filter((issue) => issue.title.length > 0);

  const recentChats = (input.chats ?? [])
    .slice(0, CHAT_LIMIT)
    .map((chat) => clip(chat.title, MEMORY_ENTRY_MAX_CHARS))
    .filter((title) => title.length > 0);

  return { memory, issues, recentChats };
}

export function isSuggestedPromptContextEmpty(
  pack: SuggestedPromptContextPack,
): boolean {
  return (
    pack.memory.length === 0 &&
    pack.issues.length === 0 &&
    pack.recentChats.length === 0
  );
}

export function fingerprintSuggestedPromptContext(
  pack: SuggestedPromptContextPack,
): string {
  return createHash("sha256")
    .update(JSON.stringify(pack))
    .digest("hex")
    .slice(0, 32);
}

export function sanitizeSuggestedPrompts(
  raw: readonly { readonly title?: unknown; readonly prompt?: unknown }[],
): SuggestedPrompt[] {
  const prompts: SuggestedPrompt[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (typeof item.title !== "string" || typeof item.prompt !== "string") {
      continue;
    }
    const title = clip(item.title, TITLE_MAX_CHARS);
    const prompt = clip(item.prompt, PROMPT_MAX_CHARS);
    if (!title || !prompt) continue;
    const key = prompt.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    prompts.push({ title, prompt });
    if (prompts.length >= SUGGESTED_PROMPT_COUNT) break;
  }

  return prompts;
}

export function formatSuggestedPromptContextPack(
  pack: SuggestedPromptContextPack,
): string {
  const memory =
    pack.memory.length > 0
      ? pack.memory.map((line) => `- ${line}`).join("\n")
      : "- (none)";
  const issues =
    pack.issues.length > 0
      ? pack.issues
          .map((issue) => {
            const dates = [
              issue.dueDate ? `due ${issue.dueDate}` : null,
              issue.reviewDate ? `review ${issue.reviewDate}` : null,
            ]
              .filter(Boolean)
              .join(", ");
            return `- ${issue.title} (${issue.area}${dates ? `; ${dates}` : ""})`;
          })
          .join("\n")
      : "- (none)";
  const chats =
    pack.recentChats.length > 0
      ? pack.recentChats.map((title) => `- ${title}`).join("\n")
      : "- (none)";

  return `Memory facts:\n${memory}\n\nOpen issues:\n${issues}\n\nRecent chat titles:\n${chats}`;
}
