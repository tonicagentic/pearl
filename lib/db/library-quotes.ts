import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { chat, libraryQuote, type LibraryQuote } from "@/lib/db/schema";
import { requireQuoteText } from "@/lib/library/quote-text";

export type LibraryQuoteDto = {
  readonly id: string;
  readonly text: string;
  readonly chatId: string | null;
  readonly chatTitle: string | null;
  readonly messageId: string | null;
  readonly createdAt: string;
};

function toDto(
  row: LibraryQuote,
  chatTitle: string | null = null,
): LibraryQuoteDto {
  return {
    id: row.id,
    text: row.text,
    chatId: row.chatId,
    chatTitle,
    messageId: row.messageId,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Newest-first quotes for the Library page. */
export async function listLibraryQuotes(
  userId: string,
): Promise<readonly LibraryQuoteDto[]> {
  const rows = await db
    .select({
      quote: libraryQuote,
      chatTitle: chat.title,
    })
    .from(libraryQuote)
    .leftJoin(chat, eq(libraryQuote.chatId, chat.id))
    .where(eq(libraryQuote.userId, userId))
    .orderBy(desc(libraryQuote.createdAt));

  return rows.map((row) => toDto(row.quote, row.chatTitle ?? null));
}

/** Newest-first quotes saved from a single chat (for thread highlighting). */
export async function listLibraryQuotesForChat(
  userId: string,
  chatId: string,
): Promise<readonly LibraryQuoteDto[]> {
  const rows = await db
    .select({
      quote: libraryQuote,
      chatTitle: chat.title,
    })
    .from(libraryQuote)
    .leftJoin(chat, eq(libraryQuote.chatId, chat.id))
    .where(
      and(eq(libraryQuote.userId, userId), eq(libraryQuote.chatId, chatId)),
    )
    .orderBy(desc(libraryQuote.createdAt));

  return rows.map((row) => toDto(row.quote, row.chatTitle ?? null));
}

/**
 * Persist a quote. When chatId is set, it must belong to the user; otherwise
 * the chat link is dropped and the quote is still saved.
 */
export async function createLibraryQuote(
  userId: string,
  input: {
    readonly text: string;
    readonly chatId?: string | null;
    readonly messageId?: string | null;
  },
): Promise<LibraryQuoteDto> {
  const text = requireQuoteText(input.text);

  let chatId: string | null = null;
  let chatTitle: string | null = null;
  const requestedChatId =
    typeof input.chatId === "string" && input.chatId.trim() !== ""
      ? input.chatId.trim()
      : null;

  if (requestedChatId) {
    const [owned] = await db
      .select({ id: chat.id, title: chat.title })
      .from(chat)
      .where(and(eq(chat.id, requestedChatId), eq(chat.userId, userId)))
      .limit(1);
    if (owned) {
      chatId = owned.id;
      chatTitle = owned.title;
    }
  }

  const messageId =
    typeof input.messageId === "string" && input.messageId.trim() !== ""
      ? input.messageId.trim()
      : null;

  const [row] = await db
    .insert(libraryQuote)
    .values({
      userId,
      text,
      chatId,
      messageId,
    })
    .returning();
  if (!row) throw new Error("Failed to save quote.");

  return toDto(row, chatTitle);
}

export async function deleteLibraryQuote(
  userId: string,
  quoteId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(libraryQuote)
    .where(and(eq(libraryQuote.id, quoteId), eq(libraryQuote.userId, userId)))
    .returning({ id: libraryQuote.id });
  return deleted.length > 0;
}
