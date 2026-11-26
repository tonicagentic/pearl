import { gateway } from "@ai-sdk/gateway";
import { generateText, Output } from "ai";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";

import {
  buildSuggestedPromptContextPack,
  fingerprintSuggestedPromptContext,
  formatSuggestedPromptContextPack,
  isSuggestedPromptContextEmpty,
  sanitizeSuggestedPrompts,
  SUGGESTED_PROMPT_COUNT,
  type SuggestedPrompt,
  type SuggestedPromptContextPack,
} from "@/lib/chat/suggested-prompts";
import type { SetupStatus } from "@/lib/chat/types";
import { listOpenIssues } from "@/lib/db/issues";
import { listChatsPageByUser } from "@/lib/db/queries";
import {
  listProfileMemory,
  MemoryUnavailableError,
} from "@/lib/memory/profile-document";

const suggestionSchema = z.object({
  prompts: z.array(
    z.object({
      title: z.string(),
      prompt: z.string(),
    }),
  ),
});

function aiConfigured() {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim() ||
      process.env.VERCEL === "1",
  );
}

export async function generateSuggestedPromptsWithLlm(
  pack: SuggestedPromptContextPack,
): Promise<SuggestedPrompt[]> {
  if (isSuggestedPromptContextEmpty(pack) || !aiConfigured()) {
    return [];
  }

  try {
    const result = await generateText({
      model: gateway("openai/gpt-5-mini"),
      output: Output.object({ schema: suggestionSchema }),
      prompt: `You write short chat starter prompts for a personal AI agent named Pearl.

Return exactly ${SUGGESTED_PROMPT_COUNT} items. Each item needs:
- title: a short chip label (under 6 words)
- prompt: the full message the user would send (one short sentence, first person)

Rules:
- Use ONLY the context below. Do not invent errands, people, places, or dates.
- Spread topics across memory, open issues, and recent chats when those exist.
- Prefer concrete next steps the user might ask Pearl to help with.
- Never mention that you are an AI or that this is a suggestion.

Context:
${formatSuggestedPromptContextPack(pack)}`,
    });

    if (!result.output?.prompts) {
      return [];
    }
    return sanitizeSuggestedPrompts(result.output.prompts);
  } catch {
    return [];
  }
}

export function suggestedPromptsUserTag(userId: string) {
  return `suggested-prompts:${userId}`;
}

async function cachedSuggestedPrompts(
  userId: string,
  fingerprint: string,
  pack: SuggestedPromptContextPack,
): Promise<SuggestedPrompt[]> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(suggestedPromptsUserTag(userId));
  // userId + fingerprint key the remote cache entry; pack supplies the model input.
  void fingerprint;
  return generateSuggestedPromptsWithLlm(pack);
}

export async function loadSuggestedPromptContext(input: {
  readonly authMode: string;
  readonly storageMode: SetupStatus["storageMode"];
  readonly userId: string;
}): Promise<SuggestedPromptContextPack> {
  const [memoryEntries, issues, chats] = await Promise.all([
    listProfileMemory(input.authMode, input.userId)
      .then((snapshot) => snapshot.entries)
      .catch((error: unknown) => {
        if (error instanceof MemoryUnavailableError) return [];
        return [];
      }),
    input.storageMode === "database"
      ? listOpenIssues(input.userId).catch(() => [])
      : Promise.resolve([]),
    input.storageMode === "database"
      ? listChatsPageByUser(input.userId)
          .then((page) => [...page.items])
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  return buildSuggestedPromptContextPack({
    memoryEntries,
    issues,
    chats,
  });
}

export async function getSuggestedPromptsForUser(input: {
  readonly authMode: string;
  readonly storageMode: SetupStatus["storageMode"];
  readonly userId: string;
}): Promise<SuggestedPrompt[]> {
  const pack = await loadSuggestedPromptContext(input);
  if (isSuggestedPromptContextEmpty(pack)) {
    return [];
  }

  const fingerprint = fingerprintSuggestedPromptContext(pack);
  return cachedSuggestedPrompts(input.userId, fingerprint, pack);
}
